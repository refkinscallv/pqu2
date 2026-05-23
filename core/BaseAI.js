'use strict'

const Pptr = require('./Pptr')
const config = require('../config')

class BaseAI {
	/**
	 * @param {string} configKey - key di config.js, misal 'gemini' atau 'chatgpt'
	 */
	constructor(configKey) {
		this.cfg = config[configKey]
		this.SEL = this.cfg.selectors
		this.pptr = new Pptr(config.pptr)
		this.log = this.pptr.log
	}

	// ─── Init ────────────────────────────────────────────────────────────────

	async init(launchOptions = {}) {
		await this.pptr.launch({ ...config.browser, ...launchOptions })
		await this.pptr.goto(this.cfg.url)
		await this._waitReady()
		return this
	}

	async _waitReady(timeout = 30000) {
		this.log.info(`Menunggu ${this.cfg.name} siap...`)
		await this.pptr.waitFor(this.SEL.input, { visible: true, timeout })
		this.log.success(`${this.cfg.name} siap`)
	}

	// ─── Core ────────────────────────────────────────────────────────────────

	async _send(prompt) {
		await this._waitReady()

		const prevCount = await this.pptr.count(this.SEL.response)

		await this.pptr.paste(this.SEL.input, prompt)

		await this.pptr.waitForFunction(
			(sel) => {
				const btn = document.querySelector(sel)
				return btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true'
			},
			{ timeout: 10000 },
			this.SEL.sendBtn
		)

		await this.pptr.click(this.SEL.sendBtn)

		return prevCount
	}

	/**
	 * Kirim prompt dan tunggu jawaban selesai.
	 * @param {string} prompt
	 * @param {{ timeout?: number }} options
	 * @returns {Promise<string>}
	 */
	async ask(prompt, { timeout = this.cfg.timeout } = {}) {
		const preview = prompt.length > 70 ? prompt.slice(0, 70) + '…' : prompt
		this.log.info(`ask → "${preview}"`)

		const prevCount = await this._send(prompt)

		await this.pptr.waitForCount(this.SEL.response, prevCount + 1, timeout)
		await this._waitDone(timeout)

		const answer = this._stripPrefix(await this.pptr.lastText(this.SEL.response))
		this.log.success(`Jawaban diterima (${answer.length} karakter)`)

		return answer
	}

	/**
	 * Kirim prompt dan stream jawaban sebagai AsyncGenerator (delta per chunk).
	 * @param {string} prompt
	 * @param {{ timeout?: number, pollInterval?: number }} options
	 * @yields {string}
	 */
	async *stream(
		prompt,
		{ timeout = this.cfg.timeout, pollInterval = this.cfg.pollInterval } = {}
	) {
		const preview = prompt.length > 70 ? prompt.slice(0, 70) + '…' : prompt
		this.log.info(`stream → "${preview}"`)

		const prevCount = await this._send(prompt)

		await this.pptr.waitForCount(this.SEL.response, prevCount + 1, timeout)

		const start = Date.now()
		let prev = ''
		let prefixOffset = 0
		let prefixChecked = false
		let stopSeen = false
		let lastChange = Date.now()

		while (Date.now() - start < timeout) {
			const raw = (await this.pptr.lastText(this.SEL.response)) ?? ''

			if (!prefixChecked && raw.length > 0) {
				prefixOffset = this._prefixLength(raw)
				prefixChecked = true
			}

			const current = raw.slice(prefixOffset)

			if (current.length > prev.length) {
				yield current.slice(prev.length)
				prev = current
				lastChange = Date.now()
			}

			const hasStop = await this.pptr.exists(this.SEL.stopBtn)
			if (hasStop) stopSeen = true

			if (stopSeen && !hasStop) break

			if (prev.length > 0 && !hasStop && Date.now() - lastChange > this.cfg.stableMs) break

			await this.pptr.sleep(pollInterval)
		}

		const finalRaw = (await this.pptr.lastText(this.SEL.response)) ?? ''
		const final = finalRaw.slice(prefixOffset)
		if (final.length > prev.length) {
			yield final.slice(prev.length)
		}

		this.log.success(`stream selesai (${final.length} karakter)`)
	}

	async _waitDone(timeout) {
		const start = Date.now()

		let stopAppeared = false
		try {
			await this.pptr.waitFor(this.SEL.stopBtn, { visible: true, timeout: 2000 })
			stopAppeared = true
		} catch {}

		const remaining = Math.max(5000, timeout - (Date.now() - start))

		if (stopAppeared) {
			this.log.debug('Menunggu stop button hilang...')
			await this.pptr.waitForHidden(this.SEL.stopBtn, remaining)
		} else {
			this.log.debug('Fallback: menunggu teks stabil...')
			await this.pptr.waitForStableText(this.SEL.response, {
				stable: this.cfg.stableMs,
				timeout: remaining,
			})
		}
	}

	// ─── Text Helpers ────────────────────────────────────────────────────────

	_prefixLength(text) {
		if (!this.cfg.responsePrefix) return 0
		const match = text.match(this.cfg.responsePrefix)
		return match && match.index === 0 ? match[0].length : 0
	}

	_stripPrefix(text) {
		if (!text) return text
		return text.slice(this._prefixLength(text))
	}

	// ─── History ─────────────────────────────────────────────────────────────

	async getLastResponse() {
		return this._stripPrefix(await this.pptr.lastText(this.SEL.response))
	}

	/**
	 * @returns {Promise<Array<{ role: 'user' | 'model', text: string }>>}
	 */
	async getHistory() {
		const userMsgs = await this.pptr.texts(this.SEL.userMsg)
		const modelMsgs = await this.pptr.texts(this.SEL.response)

		const history = []
		const len = Math.max(userMsgs.length, modelMsgs.length)

		for (let i = 0; i < len; i++) {
			if (userMsgs[i]) history.push({ role: 'user', text: userMsgs[i] })
			if (modelMsgs[i]) history.push({ role: 'model', text: modelMsgs[i] })
		}

		return history
	}

	// ─── Navigation ──────────────────────────────────────────────────────────

	async newChat() {
		this.log.info('Membuka chat baru')
		try {
			await this.pptr.click(this.SEL.newChat)
		} catch {
			await this.pptr.goto(this.cfg.url)
		}
		await this._waitReady()
	}

	// ─── Close ───────────────────────────────────────────────────────────────

	async close() {
		await this.pptr.close()
	}
}

module.exports = BaseAI
