const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs')
const path = require('path')

puppeteer.use(StealthPlugin())

// ─── Logger ──────────────────────────────────────────────────────────────────

const C = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	gray: '\x1b[90m',
	cyan: '\x1b[36m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	red: '\x1b[31m',
	magenta: '\x1b[35m',
	blue: '\x1b[34m',
}

class Logger {
	constructor({ enabled = true, logFile = null } = {}) {
		this.enabled = enabled
		this.logFile = logFile
	}

	_ts() {
		return new Date().toISOString().replace('T', ' ').slice(0, 23)
	}

	_write(color, label, msg) {
		if (!this.enabled) return
		const line = `${C.gray}[${this._ts()}]${C.reset} ${color}${C.bold}${label}${C.reset} ${msg}`
		console.log(line)
		if (this.logFile) {
			fs.appendFileSync(this.logFile, `[${this._ts()}] ${label} ${msg}\n`, 'utf8')
		}
	}

	info(msg) {
		this._write(C.cyan, '[INFO]   ', msg)
	}
	success(msg) {
		this._write(C.green, '[OK]     ', msg)
	}
	warn(msg) {
		this._write(C.yellow, '[WARN]   ', msg)
	}
	error(msg) {
		this._write(C.red, '[ERROR]  ', msg)
	}
	debug(msg) {
		this._write(C.magenta, '[DEBUG]  ', msg)
	}
	net(msg) {
		this._write(C.blue, '[NET]    ', msg)
	}
}

// ─── Pptr ────────────────────────────────────────────────────────────────────

class Pptr {
	/**
	 * @param {{ log?: boolean, logFile?: string | null }} options
	 */
	constructor({ log = true, logFile = null } = {}) {
		this.browser = null
		this.page = null
		this.log = new Logger({ enabled: log, logFile })
		this._networkLog = []
		// Posisi kursor virtual yang dilacak agar gerakan terasa kontinu/manusiawi
		this._mouse = { x: 0, y: 0 }
		// Guard agar setRequestInterception + listener tidak terpasang ganda
		this._interceptionReady = false
		this._launchOptions = {}
		this._devtoolsOpen = false
	}

	// ─── Launch ──────────────────────────────────────────────────────────────

	/**
	 * @param {import('puppeteer').LaunchOptions & { headless?: boolean }} options
	 */
	async launch(options = {}) {
		const defaults = {
			headless: true,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-blink-features=AutomationControlled',
				'--disable-infobars',
				'--window-size=1366,768',
			],
			defaultViewport: { width: 1366, height: 768 },
		}

		const launchOptions = { ...defaults, ...options }
		this._launchOptions = launchOptions
		this._devtoolsOpen = launchOptions.devtools === true

		this.log.info(`Launching browser (headless: ${launchOptions.headless ?? true})`)
		this.browser = await puppeteer.launch(launchOptions)
		this.page = await this.browser.newPage()
		await this._setupPage(this.page)
		this.log.success('Browser ready')
		return this
	}

	async _setupPage(page) {
		await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
		page.setDefaultTimeout(30000)
		page.setDefaultNavigationTimeout(30000)
		// Setiap page baru → interception belum aktif & kursor di pojok kiri-atas
		this._interceptionReady = false
		this._mouse = { x: 0, y: 0 }
	}

	// ─── Navigation ──────────────────────────────────────────────────────────

	async goto(url, options = { waitUntil: 'domcontentloaded' }) {
		this.log.info(`goto → ${url}`)
		const res = await this.page.goto(url, options)
		this.log.success(`Loaded [${res?.status()}] ${url}`)
		return res
	}

	async reload(options = { waitUntil: 'domcontentloaded' }) {
		this.log.info('Reloading page')
		return this.page.reload(options)
	}

	async back() {
		this.log.info('Navigate back')
		return this.page.goBack({ waitUntil: 'domcontentloaded' })
	}

	async forward() {
		this.log.info('Navigate forward')
		return this.page.goForward({ waitUntil: 'domcontentloaded' })
	}

	url() {
		return this.page.url()
	}
	title() {
		return this.page.title()
	}

	// ─── Waiting ─────────────────────────────────────────────────────────────

	async waitFor(selector, options = { visible: true }) {
		return this.page.waitForSelector(selector, options)
	}

	async waitForHidden(selector, timeout = 10000) {
		return this.page.waitForSelector(selector, { hidden: true, timeout })
	}

	async waitForNav(options = { waitUntil: 'domcontentloaded' }) {
		return this.page.waitForNavigation(options)
	}

	async waitForUrl(urlOrPredicate, timeout = 30000) {
		if (typeof urlOrPredicate === 'function') {
			const start = Date.now()
			while (Date.now() - start < timeout) {
				if (urlOrPredicate(this.page.url())) return this.page.url()
				await this.sleep(200)
			}
			throw new Error(`waitForUrl: timeout ${timeout}ms (predicate)`)
		}
		return this.page.waitForFunction(
			(expected) => window.location.href.includes(expected),
			{ timeout },
			urlOrPredicate
		)
	}

	async waitForFunction(fn, options = {}, ...args) {
		return this.page.waitForFunction(fn, options, ...args)
	}

	// Tunggu hingga jumlah elemen >= n (berguna sebelum waitForStableText)
	async waitForCount(selector, count, timeout = 30000) {
		this.log.info(`waitForCount "${selector}" >= ${count}`)
		await this.page.waitForFunction(
			(sel, n) => document.querySelectorAll(sel).length >= n,
			{ timeout },
			selector,
			count
		)
	}

	/**
	 * Tunggu teks pada elemen TERAKHIR yang cocok berhenti berubah (streaming selesai).
	 * Mengembalikan teks final yang sudah stabil.
	 * @param {string} selector
	 * @param {{ stable?: number, timeout?: number, pollInterval?: number }} options
	 *   stable:       berapa ms teks harus tidak berubah (default 1000)
	 *   timeout:      batas maksimum menunggu (default 60000)
	 *   pollInterval: seberapa sering dicek (default 200)
	 */
	async waitForStableText(selector, { stable = 1000, timeout = 60000, pollInterval = 200 } = {}) {
		this.log.info(`waitForStableText "${selector}" (stable: ${stable}ms)`)
		const start = Date.now()
		let lastText = null
		let stableSince = null

		while (Date.now() - start < timeout) {
			const els = await this.page.$$(selector)

			if (els.length) {
				const currentText = await els[els.length - 1].evaluate((el) =>
					el.textContent.trim()
				)

				if (currentText !== lastText) {
					lastText = currentText
					stableSince = Date.now()
				} else if (stableSince !== null && Date.now() - stableSince >= stable) {
					this.log.success(`waitForStableText selesai setelah ${Date.now() - start}ms`)
					return currentText
				}
			}

			await this.sleep(pollInterval)
		}

		throw new Error(`waitForStableText: timeout ${timeout}ms terlampaui untuk "${selector}"`)
	}

	async sleep(ms) {
		return new Promise((r) => setTimeout(r, ms))
	}

	async sleepRandom(min = 500, max = 1500) {
		const ms = Math.floor(Math.random() * (max - min + 1)) + min
		this.log.debug(`sleep ${ms}ms`)
		return this.sleep(ms)
	}

	// ─── Interaction ─────────────────────────────────────────────────────────

	async click(selector, options = {}) {
		this.log.info(`click "${selector}"`)
		await this.waitFor(selector)
		return this.page.click(selector, options)
	}

	async rightClick(selector) {
		this.log.info(`rightClick "${selector}"`)
		await this.waitFor(selector)
		return this.page.click(selector, { button: 'right' })
	}

	async doubleClick(selector) {
		this.log.info(`doubleClick "${selector}"`)
		await this.waitFor(selector)
		return this.page.click(selector, { clickCount: 2 })
	}

	async clickAt(x, y) {
		this.log.info(`clickAt (${x}, ${y})`)
		this._mouse = { x, y }
		return this.page.mouse.click(x, y)
	}

	async clickText(text, tag = '*') {
		this.log.info(`clickText "${text}" <${tag}>`)
		const literal = this._xpathLiteral(text)
		const el = await this.page.$$(`::-p-xpath(//${tag}[contains(., ${literal})])`)
		if (!el.length) throw new Error(`Element with text "${text}" not found`)
		return el[0].click()
	}

	// Bangun XPath string literal yang aman walau teks mengandung kutip ' atau "
	_xpathLiteral(value) {
		if (!value.includes('"')) return `"${value}"`
		if (!value.includes("'")) return `'${value}'`
		// Mengandung keduanya → pecah dengan concat()
		return 'concat(' + value.split('"').map((part) => `"${part}"`).join(', \'"\', ') + ')'
	}

	async type(selector, text, { clear = true, delay = 50 } = {}) {
		this.log.info(`type "${selector}" → "${text}"`)
		await this.waitFor(selector)
		if (clear) await this.clear(selector)
		return this.page.type(selector, text, { delay })
	}

	// Set value instantly without simulating keystrokes.
	// Otomatis mendeteksi contenteditable div vs input/textarea.
	async paste(selector, text) {
		this.log.info(`paste "${selector}"`)
		await this.waitFor(selector)
		await this.page.$eval(
			selector,
			(el, val) => {
				el.focus()

				if (el.isContentEditable) {
					// contenteditable: select all lalu replace via execCommand
					document.execCommand('selectAll', false, null)
					document.execCommand('insertText', false, val)
				} else {
					// pilih prototype yang sesuai agar tidak Illegal invocation
					const proto =
						el.tagName === 'TEXTAREA'
							? window.HTMLTextAreaElement.prototype
							: window.HTMLInputElement.prototype
					const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
					if (setter) setter.call(el, val)
					else el.value = val
					el.dispatchEvent(new Event('input', { bubbles: true }))
					el.dispatchEvent(new Event('change', { bubbles: true }))
				}
			},
			text
		)
	}

	async clear(selector) {
		await this.waitFor(selector)
		await this.page.click(selector, { clickCount: 3 })
		await this.page.keyboard.press('Backspace')
	}

	async select(selector, value) {
		this.log.info(`select "${selector}" → ${JSON.stringify(value)}`)
		await this.waitFor(selector)
		return this.page.select(selector, ...(Array.isArray(value) ? value : [value]))
	}

	async check(selector, state = true) {
		this.log.info(`check "${selector}" → ${state}`)
		await this.waitFor(selector)
		const checked = await this.page.$eval(selector, (el) => el.checked)
		if (checked !== state) await this.page.click(selector)
	}

	async focus(selector) {
		await this.waitFor(selector)
		return this.page.focus(selector)
	}

	async hover(selector) {
		this.log.info(`hover "${selector}"`)
		await this.waitFor(selector)
		return this.page.hover(selector)
	}

	async press(key) {
		this.log.debug(`press: ${key}`)
		return this.page.keyboard.press(key)
	}

	async keyDown(key) {
		this.log.debug(`keyDown: ${key}`)
		return this.page.keyboard.down(key)
	}

	async keyUp(key) {
		this.log.debug(`keyUp: ${key}`)
		return this.page.keyboard.up(key)
	}

	// Hold modifier keys and press the last key: combo('Control', 'a')
	async combo(...keys) {
		this.log.debug(`combo: ${keys.join('+')}`)
		for (const k of keys.slice(0, -1)) await this.page.keyboard.down(k)
		await this.page.keyboard.press(keys[keys.length - 1])
		for (const k of [...keys.slice(0, -1)].reverse()) await this.page.keyboard.up(k)
	}

	async uploadFile(selector, ...filePaths) {
		this.log.info(`uploadFile "${selector}" → [${filePaths.join(', ')}]`)
		await this.waitFor(selector)
		const input = await this.page.$(selector)
		await input.uploadFile(...filePaths.map((f) => path.resolve(f)))
	}

	async dragAndDrop(sourceSelector, targetSelector) {
		this.log.info(`dragAndDrop "${sourceSelector}" → "${targetSelector}"`)
		await this.waitFor(sourceSelector)
		await this.waitFor(targetSelector)

		const src = await this.page.$(sourceSelector)
		const tgt = await this.page.$(targetSelector)
		const srcBox = await src.boundingBox()
		const tgtBox = await tgt.boundingBox()

		await this.page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2)
		await this.page.mouse.down()
		await this.sleep(80)
		await this.page.mouse.move(tgtBox.x + tgtBox.width / 2, tgtBox.y + tgtBox.height / 2, {
			steps: 20,
		})
		await this.sleep(80)
		await this.page.mouse.up()
	}

	async mouseMove(x, y) {
		this._mouse = { x, y }
		return this.page.mouse.move(x, y)
	}

	async tap(selector) {
		this.log.info(`tap "${selector}"`)
		await this.waitFor(selector)
		return this.page.tap(selector)
	}

	async scrollTo(selector) {
		await this.waitFor(selector)
		await this.page.$eval(selector, (el) =>
			el.scrollIntoView({ behavior: 'smooth', block: 'center' })
		)
	}

	async scrollBy(x = 0, y = 500) {
		await this.page.evaluate((dx, dy) => window.scrollBy(dx, dy), x, y)
	}

	async scrollToBottom() {
		await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
	}

	// ─── Querying ────────────────────────────────────────────────────────────

	async $(selector) {
		return this.page.$(selector)
	}
	async $$(selector) {
		return this.page.$$(selector)
	}

	async exists(selector) {
		return (await this.page.$(selector)) !== null
	}

	async count(selector) {
		return (await this.page.$$(selector)).length
	}

	// Ambil textContent dari elemen TERAKHIR yang cocok
	async lastText(selector) {
		const els = await this.page.$$(selector)
		if (!els.length) return null
		return els[els.length - 1].evaluate((el) => el.textContent.trim())
	}

	async text(selector) {
		await this.waitFor(selector)
		return this.page.$eval(selector, (el) => el.textContent.trim())
	}

	async texts(selector) {
		return this.page.$$eval(selector, (els) => els.map((el) => el.textContent.trim()))
	}

	async attr(selector, attribute) {
		await this.waitFor(selector)
		return this.page.$eval(selector, (el, a) => el.getAttribute(a), attribute)
	}

	async attrs(selector, attribute) {
		return this.page.$$eval(
			selector,
			(els, a) => els.map((el) => el.getAttribute(a)),
			attribute
		)
	}

	async value(selector) {
		await this.waitFor(selector)
		return this.page.$eval(selector, (el) => el.value)
	}

	async html(selector) {
		if (selector) {
			await this.waitFor(selector)
			return this.page.$eval(selector, (el) => el.innerHTML)
		}
		return this.page.content()
	}

	async outerHtml(selector) {
		await this.waitFor(selector)
		return this.page.$eval(selector, (el) => el.outerHTML)
	}

	async boundingBox(selector) {
		await this.waitFor(selector)
		const el = await this.page.$(selector)
		return el.boundingBox()
	}

	// ─── Evaluation ──────────────────────────────────────────────────────────

	async evaluate(fn, ...args) {
		return this.page.evaluate(fn, ...args)
	}

	async evalOnSelector(selector, fn, ...args) {
		await this.waitFor(selector)
		return this.page.$eval(selector, fn, ...args)
	}

	async injectScript(urlOrContent) {
		this.log.info('injectScript')
		return urlOrContent.startsWith('http')
			? this.page.addScriptTag({ url: urlOrContent })
			: this.page.addScriptTag({ content: urlOrContent })
	}

	async injectStyle(urlOrContent) {
		this.log.info('injectStyle')
		return urlOrContent.startsWith('http')
			? this.page.addStyleTag({ url: urlOrContent })
			: this.page.addStyleTag({ content: urlOrContent })
	}

	// ─── Screenshot & PDF ────────────────────────────────────────────────────

	async screenshot(filePath, options = {}) {
		this.log.info(`screenshot → ${filePath}`)
		return this.page.screenshot({ path: filePath, fullPage: true, ...options })
	}

	async screenshotElement(selector, filePath) {
		this.log.info(`screenshotElement "${selector}" → ${filePath}`)
		await this.waitFor(selector)
		const el = await this.page.$(selector)
		return el.screenshot({ path: filePath })
	}

	async pdf(filePath, options = {}) {
		this.log.info(`pdf → ${filePath}`)
		return this.page.pdf({ path: filePath, format: 'A4', ...options })
	}

	// ─── Network ─────────────────────────────────────────────────────────────

	async setHeaders({ userAgent, headers } = {}) {
		if (userAgent) await this.page.setUserAgent(userAgent)
		if (headers) await this.page.setExtraHTTPHeaders(headers)
	}

	// Aktifkan request interception sekali saja; cegah listener/continue ganda
	async _enableInterception() {
		if (this._interceptionReady) return
		await this.page.setRequestInterception(true)
		this._interceptionReady = true
	}

	async intercept(urlPattern, handler) {
		await this._enableInterception()
		this.page.on('request', (req) => {
			// Hormati jika request sudah ditangani listener lain
			if (req.interceptResolutionState && req.interceptResolutionState().action !== 'continue') {
				return
			}
			req.url().includes(urlPattern) ? handler(req) : req.continue()
		})
	}

	async blockResources(types = ['image', 'stylesheet', 'font', 'media']) {
		await this._enableInterception()
		this.page.on('request', (req) => {
			if (req.interceptResolutionState && req.interceptResolutionState().action !== 'continue') {
				return
			}
			types.includes(req.resourceType()) ? req.abort() : req.continue()
		})
	}

	// Wait until a request matching the pattern is sent; returns the Request object
	async waitForRequest(urlPattern, timeout = 30000) {
		this.log.net(`waitForRequest "${urlPattern}"`)
		return this.page.waitForRequest((req) => req.url().includes(urlPattern), { timeout })
	}

	// Wait until a response matching the pattern arrives; returns the Response object
	async waitForResponse(urlPattern, timeout = 30000) {
		this.log.net(`waitForResponse "${urlPattern}"`)
		return this.page.waitForResponse((res) => res.url().includes(urlPattern), { timeout })
	}

	// Wait for a JSON response and return its parsed body
	async waitForResponseJson(urlPattern, timeout = 30000) {
		this.log.net(`waitForResponseJson "${urlPattern}"`)
		const res = await this.page.waitForResponse(
			(r) => r.url().includes(urlPattern) && r.headers()['content-type']?.includes('json'),
			{ timeout }
		)
		return res.json()
	}

	// Trigger an action and capture the first matching response — returns { status, headers, body, json() }
	async captureResponse(urlPattern, triggerFn) {
		this.log.net(`captureResponse "${urlPattern}"`)
		const [res] = await Promise.all([this.waitForResponse(urlPattern), triggerFn()])
		const body = await res.text()
		return {
			status: res.status(),
			headers: res.headers(),
			body,
			json: () => JSON.parse(body),
		}
	}

	// Read-only listener for all outgoing requests
	onRequest(handler) {
		this.page.on('request', handler)
	}

	// Read-only listener for all incoming responses
	onResponse(handler) {
		this.page.on('response', handler)
	}

	// Begin collecting all requests and responses into this._networkLog
	startNetworkLog() {
		this._networkLog = []

		this.page.on('request', (req) => {
			this._networkLog.push({
				type: 'request',
				time: Date.now(),
				method: req.method(),
				url: req.url(),
				headers: req.headers(),
				postData: req.postData() ?? null,
			})
			this.log.net(`→ ${req.method()} ${req.url()}`)
		})

		this.page.on('response', async (res) => {
			let body = null
			try {
				body = await res.text()
			} catch {}
			this._networkLog.push({
				type: 'response',
				time: Date.now(),
				status: res.status(),
				url: res.url(),
				headers: res.headers(),
				body,
			})
			this.log.net(`← ${res.status()} ${res.url()}`)
		})

		this.log.net('Network log started')
	}

	getNetworkLog() {
		return this._networkLog
	}

	// Forward browser console output to the Node.js Logger
	captureConsole() {
		this.page.on('console', (msg) => {
			const t = msg.type()
			const text = `[browser:${t}] ${msg.text()}`
			if (t === 'error' || t === 'assert') this.log.error(text)
			else if (t === 'warning' || t === 'warn') this.log.warn(text)
			else this.log.debug(text)
		})
		this.page.on('pageerror', (err) => {
			this.log.error(`[browser:pageerror] ${err.message}`)
		})
	}

	// Custom handler for browser console messages
	onConsole(handler) {
		this.page.on('console', (msg) => {
			handler({ type: msg.type(), text: msg.text(), args: msg.args() })
		})
	}

	// ─── Cookies & Storage ───────────────────────────────────────────────────

	async getCookies() {
		return this.page.cookies()
	}

	async setCookies(cookies = []) {
		return this.page.setCookie(...cookies)
	}

	async clearCookies() {
		const client = await this.page.createCDPSession()
		await client.send('Network.clearBrowserCookies')
	}

	async saveCookiesToFile(filePath) {
		const cookies = await this.getCookies()
		fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2), 'utf8')
		this.log.success(`Cookies saved → ${filePath}`)
	}

	async loadCookiesFromFile(filePath) {
		if (!fs.existsSync(filePath)) {
			this.log.warn(`Cookie file not found: ${filePath}`)
			return
		}
		const cookies = JSON.parse(fs.readFileSync(filePath, 'utf8'))
		await this.setCookies(cookies)
		this.log.success(`Cookies loaded ← ${filePath}`)
	}

	async getLocalStorage(key) {
		return this.page.evaluate((k) => localStorage.getItem(k), key)
	}

	async setLocalStorage(key, value) {
		return this.page.evaluate((k, v) => localStorage.setItem(k, v), key, value)
	}

	async getSessionStorage(key) {
		return this.page.evaluate((k) => sessionStorage.getItem(k), key)
	}

	async setSessionStorage(key, value) {
		return this.page.evaluate((k, v) => sessionStorage.setItem(k, v), key, value)
	}

	async clearStorage() {
		this.log.info('clearStorage: localStorage + sessionStorage + cookies')
		await this.page.evaluate(() => {
			localStorage.clear()
			sessionStorage.clear()
		})
		await this.clearCookies()
	}

	// ─── Dialog & Popup ──────────────────────────────────────────────────────

	async autoAcceptDialogs() {
		this.page.on('dialog', async (dialog) => {
			this.log.debug(`dialog [${dialog.type()}] accepted: "${dialog.message()}"`)
			await dialog.accept()
		})
	}

	async autoDismissDialogs() {
		this.page.on('dialog', async (dialog) => {
			this.log.debug(`dialog [${dialog.type()}] dismissed: "${dialog.message()}"`)
			await dialog.dismiss()
		})
	}

	async onDialog(handler) {
		this.page.on('dialog', handler)
	}

	// ─── Frame ───────────────────────────────────────────────────────────────

	async getFrame(nameOrUrl) {
		return this.page.frames().find((f) => f.name() === nameOrUrl || f.url().includes(nameOrUrl))
	}

	async waitForFrame(nameOrUrl, timeout = 10000) {
		const start = Date.now()
		while (Date.now() - start < timeout) {
			const frame = await this.getFrame(nameOrUrl)
			if (frame) return frame
			await this.sleep(300)
		}
		throw new Error(`Frame "${nameOrUrl}" not found within ${timeout}ms`)
	}

	// ─── Tab Management ──────────────────────────────────────────────────────

	async newTab(url) {
		const page = await this.browser.newPage()
		await this._setupPage(page)
		if (url) {
			this.log.info(`newTab → ${url}`)
			await page.goto(url, { waitUntil: 'domcontentloaded' })
		}
		this.page = page
		return page
	}

	async tabs() {
		return this.browser.pages()
	}

	async switchTab(index) {
		const pages = await this.browser.pages()
		if (!pages[index]) throw new Error(`Tab at index ${index} does not exist`)
		this.page = pages[index]
		await this.page.bringToFront()
		this.log.info(`switchTab → index ${index}`)
		return this.page
	}

	async closeTab(page) {
		const target = page || this.page
		await target.close()
		const pages = await this.browser.pages()
		this.page = pages[pages.length - 1] || null
	}

	// ─── Device & Browser ────────────────────────────────────────────────────

	async emulate(deviceName) {
		const { KnownDevices } = require('puppeteer')
		const device = KnownDevices[deviceName]
		if (!device) throw new Error(`Unknown device: ${deviceName}`)
		this.log.info(`emulate: ${deviceName}`)
		return this.page.emulate(device)
	}

	async setViewport(width = 1366, height = 768) {
		return this.page.setViewport({ width, height })
	}

	async setGeolocation(latitude, longitude, accuracy = 100) {
		this.log.info(`setGeolocation (${latitude}, ${longitude})`)
		await this.browser.defaultBrowserContext().overridePermissions(this.url(), ['geolocation'])
		return this.page.setGeolocation({ latitude, longitude, accuracy })
	}

	async grantPermissions(permissions = [], origin) {
		const ctx = this.browser.defaultBrowserContext()
		await ctx.overridePermissions(origin ?? this.url(), permissions)
		this.log.info(`grantPermissions: [${permissions.join(', ')}]`)
	}

	async getMetrics() {
		return this.page.metrics()
	}

	async getPerformanceTiming() {
		return this.page.evaluate(() => JSON.parse(JSON.stringify(window.performance.timing)))
	}

	// ─── Scraping Utilities ──────────────────────────────────────────────────

	async scrapeTable(selector) {
		await this.waitFor(selector)
		return this.page.$eval(selector, (table) => {
			const rows = Array.from(table.querySelectorAll('tr'))
			const headers = Array.from(rows[0].querySelectorAll('th, td')).map((th) =>
				th.textContent.trim()
			)
			return rows.slice(1).map((row) => {
				const cells = Array.from(row.querySelectorAll('td')).map((td) =>
					td.textContent.trim()
				)
				return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']))
			})
		})
	}

	async scrapeLinks(selector = 'a') {
		return this.page.$$eval(selector, (els) =>
			els.map((el) => ({ text: el.textContent.trim(), href: el.href }))
		)
	}

	async scrapeImages(selector = 'img') {
		return this.page.$$eval(selector, (els) => els.map((el) => ({ src: el.src, alt: el.alt })))
	}

	// Scrape <meta> tags: title, description, og:title, og:image, canonical
	async scrapeMeta() {
		return this.page.evaluate(() => {
			const get = (name) =>
				document.querySelector(`meta[name="${name}"]`)?.content ??
				document.querySelector(`meta[property="${name}"]`)?.content ??
				null
			return {
				title: document.title,
				description: get('description') ?? get('og:description'),
				ogTitle: get('og:title'),
				ogImage: get('og:image'),
				canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
			}
		})
	}

	/**
	 * Scrape a list of elements using a field map.
	 * @param {string} selector - container selector (each matched element = one row)
	 * @param {Record<string, { selector?: string, attr?: string }>} fields
	 */
	async scrapeStructured(selector, fields) {
		await this.waitFor(selector)
		return this.page.$$eval(
			selector,
			(els, fieldMap) =>
				els.map((el) => {
					const row = {}
					for (const [key, cfg] of Object.entries(fieldMap)) {
						const node = cfg.selector ? el.querySelector(cfg.selector) : el
						if (!node) {
							row[key] = null
							continue
						}
						row[key] = cfg.attr ? node.getAttribute(cfg.attr) : node.textContent.trim()
					}
					return row
				}),
			fields
		)
	}

	// ─── Human-like Behavior ───────────────────────────────────────────────────

	_rand(min, max) {
		return Math.random() * (max - min) + min
	}

	_randInt(min, max) {
		return Math.floor(this._rand(min, max + 1))
	}

	// Titik acak di dalam bounding box (cenderung ke tengah, hindari tepi)
	_pointInBox(box, { padding = 0.25 } = {}) {
		const px = box.width * padding
		const py = box.height * padding
		return {
			x: box.x + this._rand(px, box.width - px),
			y: box.y + this._rand(py, box.height - py),
		}
	}

	// Gerakkan kursor mengikuti kurva Bézier kubik dengan langkah + jitter kecil
	async humanMoveTo(x, y, { steps, jitter = 1.2 } = {}) {
		const from = { ...this._mouse }
		const dist = Math.hypot(x - from.x, y - from.y)
		const n = steps ?? Math.max(12, Math.min(40, Math.round(dist / 12)))

		// Dua control point acak agar lintasan melengkung, bukan garis lurus
		const c1 = {
			x: from.x + (x - from.x) * this._rand(0.2, 0.4) + this._rand(-dist, dist) * 0.12,
			y: from.y + (y - from.y) * this._rand(0.2, 0.4) + this._rand(-dist, dist) * 0.12,
		}
		const c2 = {
			x: from.x + (x - from.x) * this._rand(0.6, 0.8) + this._rand(-dist, dist) * 0.12,
			y: from.y + (y - from.y) * this._rand(0.6, 0.8) + this._rand(-dist, dist) * 0.12,
		}

		for (let i = 1; i <= n; i++) {
			const t = i / n
			const u = 1 - t
			// Posisi pada kurva Bézier kubik
			let bx =
				u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * x
			let by =
				u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * y

			if (i < n) {
				bx += this._rand(-jitter, jitter)
				by += this._rand(-jitter, jitter)
			}

			await this.page.mouse.move(bx, by)
			this._mouse = { x: bx, y: by }
			// Easing: lebih lambat di awal & akhir gerakan
			const ease = 1 - Math.abs(0.5 - t) * 2
			await this.sleep(this._rand(4, 10) + ease * this._rand(2, 6))
		}

		this._mouse = { x, y }
	}

	// Gerakkan kursor ke arah elemen (selector) secara manusiawi, lalu hover
	async humanMoveToTarget(selector, options = {}) {
		this.log.info(`humanMove → "${selector}"`)
		await this.waitFor(selector)
		await this.scrollTo(selector)
		await this.sleep(this._rand(120, 300))
		const box = await this.boundingBox(selector)
		if (!box) throw new Error(`humanMoveToTarget: elemen "${selector}" tidak punya bounding box`)
		const p = this._pointInBox(box, options)
		await this.humanMoveTo(p.x, p.y, options)
		return p
	}

	// Klik manusiawi: bergerak ke target, jeda kecil, tekan-lepas dengan delay
	async humanClick(selector, options = {}) {
		this.log.info(`humanClick "${selector}"`)
		await this.humanMoveToTarget(selector, options)
		await this.sleep(this._rand(40, 140))
		await this.page.mouse.down()
		await this.sleep(this._rand(40, 110))
		await this.page.mouse.up()
	}

	// Hover manusiawi (gerak melengkung + diam sebentar)
	async humanHover(selector, options = {}) {
		await this.humanMoveToTarget(selector, options)
		await this.sleep(this._rand(150, 400))
	}

	// Ketik dengan ritme manusiawi: delay variatif, jeda lebih lama setelah spasi/tanda baca
	async humanType(selector, text, { clear = false, mistakes = 0 } = {}) {
		this.log.info(`humanType "${selector}" → "${text}"`)
		await this.humanClick(selector)
		if (clear) {
			await this.combo('Control', 'a')
			await this.press('Backspace')
		}

		for (const ch of text) {
			// Sesekali salah ketik lalu hapus (jika diaktifkan)
			if (mistakes > 0 && Math.random() < mistakes) {
				const wrong = String.fromCharCode(this._randInt(97, 122))
				await this.page.keyboard.type(wrong, { delay: this._rand(40, 120) })
				await this.sleep(this._rand(120, 300))
				await this.press('Backspace')
				await this.sleep(this._rand(80, 200))
			}

			await this.page.keyboard.type(ch, { delay: this._rand(45, 140) })

			if (/[.,!?]/.test(ch)) await this.sleep(this._rand(180, 420))
			else if (ch === ' ' && Math.random() < 0.3) await this.sleep(this._rand(80, 220))
		}
	}

	// Scroll bertahap dalam langkah kecil + jeda, meniru roda mouse manusia
	async humanScroll(distance = 800, { steps } = {}) {
		this.log.info(`humanScroll ${distance}px`)
		const dir = distance < 0 ? -1 : 1
		const total = Math.abs(distance)
		const n = steps ?? this._randInt(6, 12)
		let scrolled = 0

		for (let i = 0; i < n; i++) {
			const remaining = total - scrolled
			if (remaining <= 0) break
			const step = Math.min(remaining, this._rand(total / n / 1.6, total / n / 0.7))
			await this.page.mouse.wheel({ deltaY: step * dir })
			scrolled += step
			await this.sleep(this._rand(60, 220))
		}
	}

	// Jeda "berpikir" acak ala manusia
	async humanIdle(min = 400, max = 1500) {
		const ms = this._randInt(min, max)
		this.log.debug(`humanIdle ${ms}ms`)
		await this.sleep(ms)
	}

	// Gerakkan kursor secara acak ke beberapa titik di viewport (no-op klik)
	async humanWander(times = 3) {
		const vp = this.page.viewport() ?? { width: 1366, height: 768 }
		for (let i = 0; i < times; i++) {
			await this.humanMoveTo(
				this._rand(vp.width * 0.1, vp.width * 0.9),
				this._rand(vp.height * 0.1, vp.height * 0.9)
			)
			await this.sleep(this._rand(120, 400))
		}
	}

	// Buka DevTools. Andal hanya bila browser headful & dilaunch dgn devtools:true,
	// atau via CDP Inspector (best-effort). Mengembalikan true bila berhasil dibuka.
	async openDevTools() {
		if (this._devtoolsOpen) {
			this.log.debug('DevTools sudah terbuka')
			return true
		}
		if (this._launchOptions.headless ?? true) {
			this.log.warn('openDevTools diabaikan: browser berjalan headless. Launch dengan { headless: false }')
			return false
		}
		try {
			const client = await this.page.target().createCDPSession()
			// Inspector.enable + buka window devtools untuk target aktif (best-effort)
			await client.send('Inspector.enable').catch(() => {})
			await client.send('Page.enable').catch(() => {})
			// Trik membuka jendela DevTools melalui protokol internal Chromium
			const browserClient = await this.browser.target().createCDPSession()
			const { targetInfos } = await browserClient.send('Target.getTargets')
			const pageTarget = targetInfos.find(
				(t) => t.type === 'page' && t.url === this.page.url()
			)
			if (pageTarget) {
				await browserClient
					.send('Target.createTarget', {
						url: `devtools://devtools/bundled/inspector.html?ws=${pageTarget.targetId}`,
					})
					.catch(() => {})
			}
			this._devtoolsOpen = true
			this.log.success('DevTools dibuka')
			return true
		} catch (err) {
			this.log.warn(`openDevTools gagal: ${err.message}. Saran: launch dengan { headless: false, devtools: true }`)
			return false
		}
	}

	// ─── Close ───────────────────────────────────────────────────────────────

	async close() {
		if (this.browser) {
			this.log.info('Closing browser')
			await this.browser.close()
			this.browser = null
			this.page = null
		}
	}
}

module.exports = Pptr
module.exports.Logger = Logger
