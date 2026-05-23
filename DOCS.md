# Pptr — Puppeteer Helper Class

Helper class berbasis `puppeteer-extra` + `puppeteer-extra-plugin-stealth` untuk menyederhanakan scraping dan browser automation.

---

## Daftar Isi

- [Setup & Inisialisasi](#setup--inisialisasi)
- [Logger](#logger)
- [Launch & Close](#launch--close)
- [Navigation](#navigation)
- [Waiting](#waiting)
- [Interaction](#interaction)
- [Querying](#querying)
- [Evaluation & Inject](#evaluation--inject)
- [Screenshot & PDF](#screenshot--pdf)
- [Network](#network)
- [Cookies & Storage](#cookies--storage)
- [Dialog & Popup](#dialog--popup)
- [Frame (iframe)](#frame-iframe)
- [Tab Management](#tab-management)
- [Device & Browser](#device--browser)
- [Scraping Utilities](#scraping-utilities)
- [Contoh Lengkap](#contoh-lengkap)

---

## Setup & Inisialisasi

```js
const Pptr = require('./Pptr');

// Default: logging aktif, tidak tulis ke file
const pptr = new Pptr();

// Log dimatikan
const pptr = new Pptr({ log: false });

// Log ditulis juga ke file
const pptr = new Pptr({ logFile: 'run.log' });
```

**Properti publik:**

| Properti | Keterangan |
|---|---|
| `pptr.browser` | Instance `Browser` Puppeteer |
| `pptr.page` | Instance `Page` aktif saat ini |
| `pptr.log` | Instance `Logger` bawaan |

Stealth plugin **otomatis aktif** — browser tidak terdeteksi sebagai bot.

---

## Logger

Logger bawaan tersedia di `pptr.log` dan bisa juga dipakai sendiri.

```js
pptr.log.info('Memulai proses...');
pptr.log.success('Data berhasil disimpan');
pptr.log.warn('Elemen tidak ditemukan, skip');
pptr.log.error('Gagal login');
pptr.log.debug('sleep 800ms');
pptr.log.net('← 200 https://api.example.com/data');
```

**Output format:**
```
[2026-05-23 10:15:32.412] [INFO]    Memulai proses...
[2026-05-23 10:15:33.001] [OK]      Data berhasil disimpan
[2026-05-23 10:15:33.120] [WARN]    Elemen tidak ditemukan, skip
[2026-05-23 10:15:33.250] [ERROR]   Gagal login
[2026-05-23 10:15:33.300] [DEBUG]   sleep 800ms
[2026-05-23 10:15:33.450] [NET]     ← 200 https://api.example.com/data
```

Semua method utama (goto, click, type, dll.) sudah otomatis mencetak log.

**Menggunakan Logger sendiri:**
```js
const { Logger } = require('./Pptr');

const log = new Logger({ enabled: true, logFile: 'app.log' });
log.info('Berjalan...');
```

---

## Launch & Close

### `new Pptr(options?)`

| Opsi | Default | Keterangan |
|---|---|---|
| `log` | `true` | Aktifkan/matikan logging |
| `logFile` | `null` | Path file log (opsional) |

---

### `launch(options?)`

Membuka browser dan membuat tab pertama.

```js
await pptr.launch();

// Tampilkan jendela browser
await pptr.launch({ headless: false });

// Pakai Chrome yang sudah terinstall + profil user
await pptr.launch({
    headless: false,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: 'C:/Users/nama/AppData/Local/Google/Chrome/User Data/Default',
});
```

**Default yang sudah diterapkan:**

| Setting | Nilai |
|---|---|
| `headless` | `true` |
| `defaultViewport` | `1366 × 768` |
| Args | `--no-sandbox`, `--disable-blink-features=AutomationControlled`, dll. |

Semua opsi `puppeteer.launch()` bisa dipakai dan akan di-merge dengan default.

---

### `close()`

Menutup browser.

```js
await pptr.close();
```

---

## Navigation

### `goto(url, options?)`

Navigasi ke URL. Default menunggu `domcontentloaded`.

```js
await pptr.goto('https://example.com');
await pptr.goto('https://example.com', { waitUntil: 'networkidle2' });
```

---

### `reload(options?)`

Refresh halaman saat ini.

```js
await pptr.reload();
```

---

### `back()` / `forward()`

Navigasi riwayat browser.

```js
await pptr.back();
await pptr.forward();
```

---

### `url()` / `title()`

Mengembalikan URL dan judul halaman aktif. Bukan async.

```js
console.log(pptr.url());
console.log(await pptr.title());
```

---

## Waiting

### `waitFor(selector, options?)`

Menunggu elemen muncul dan terlihat.

```js
await pptr.waitFor('#submit-btn');
await pptr.waitFor('.modal', { visible: true, timeout: 5000 });
```

---

### `waitForHidden(selector, timeout?)`

Menunggu elemen menghilang.

```js
await pptr.waitForHidden('.loading-spinner');
```

---

### `waitForNav(options?)`

Menunggu navigasi halaman selesai.

```js
// Dipakai bersamaan dengan aksi yang memicu navigasi
await Promise.all([
    pptr.waitForNav({ waitUntil: 'networkidle0' }),
    pptr.click('#btn-submit'),
]);
```

---

### `waitForUrl(urlOrPredicate, timeout?)`

Menunggu URL halaman mengandung string tertentu.

```js
await pptr.waitForUrl('/dashboard');
await pptr.waitForUrl('success', 15000);
```

---

### `waitForFunction(fn, options?, ...args)`

Menunggu sampai fungsi JavaScript mengembalikan nilai truthy.

```js
await pptr.waitForFunction(() => document.querySelectorAll('.item').length > 5);

// Dengan argumen
await pptr.waitForFunction(
    (min) => document.querySelectorAll('.item').length >= min,
    { timeout: 10000 },
    10
);
```

---

### `waitForRequest(urlPattern, timeout?)` `[NET]`

Menunggu sampai request keluar ke URL yang cocok. Mengembalikan objek `Request`.

```js
const req = await pptr.waitForRequest('/api/login');
console.log(req.method(), req.postData());
```

---

### `waitForResponse(urlPattern, timeout?)` `[NET]`

Menunggu sampai response dari URL yang cocok diterima. Mengembalikan objek `Response`.

```js
const res = await pptr.waitForResponse('/api/data');
console.log(res.status());
const body = await res.text();
```

---

### `waitForResponseJson(urlPattern, timeout?)` `[NET]`

Menunggu response JSON dan langsung mengembalikan data ter-parse.

```js
const data = await pptr.waitForResponseJson('/api/user');
console.log(data.name, data.role);
```

---

### `waitForCount(selector, count, timeout?)`

Menunggu hingga jumlah elemen yang cocok dengan selector mencapai minimal `count`. Dipakai **sebelum** `waitForStableText` agar tidak membaca response lama.

```js
const prev = await pptr.count('model-response');
await pptr.click('#btn-send');
await pptr.waitForCount('model-response', prev + 1); // tunggu response baru muncul
```

---

### `waitForStableText(selector, options?)`

Menunggu teks pada **elemen terakhir** yang cocok berhenti berubah selama `stable` ms berturut-turut. Mengembalikan teks final.

Dirancang untuk AI chat / streaming response di mana teks terus berubah selama proses generate.

```js
const teks = await pptr.waitForStableText('model-response');

// Custom timing
const teks = await pptr.waitForStableText('model-response', {
    stable:       1000,  // teks harus tidak berubah 1 detik → dianggap selesai
    timeout:      60000, // batas maksimum menunggu
    pollInterval: 200,   // seberapa sering dicek (ms)
});
```

| Opsi | Default | Keterangan |
|---|---|---|
| `stable` | `1000` | Durasi ms teks harus sama terus-menerus |
| `timeout` | `60000` | Batas total waktu tunggu |
| `pollInterval` | `200` | Interval pengecekan |

**Pola lengkap untuk AI chat:**
```js
const prev = await pptr.count('model-response');

await pptr.paste('#input', 'Pertanyaan saya...');
await pptr.click('#btn-send');

await pptr.waitForCount('model-response', prev + 1); // tunggu elemen baru
const jawaban = await pptr.waitForStableText('model-response', { stable: 1000 }); // tunggu selesai
console.log(jawaban);
```

---

### `sleep(ms)`

Jeda eksekusi sejumlah milidetik.

```js
await pptr.sleep(2000);
```

---

### `sleepRandom(min?, max?)`

Jeda acak. Berguna meniru ketukan manusia (menghindari deteksi bot).

```js
await pptr.sleepRandom();            // 500–1500 ms
await pptr.sleepRandom(1000, 3000);  // 1–3 detik
```

---

## Interaction

### `click(selector, options?)`

Klik elemen. Otomatis menunggu elemen terlihat.

```js
await pptr.click('#btn-login');
await pptr.click('#item', { button: 'right' });   // klik kanan
await pptr.click('#item', { clickCount: 2 });     // double klik
```

---

### `rightClick(selector)`

Shorthand klik kanan.

```js
await pptr.rightClick('.menu-item');
```

---

### `doubleClick(selector)`

Shorthand double klik.

```js
await pptr.doubleClick('.file-icon');
```

---

### `clickAt(x, y)`

Klik pada koordinat piksel absolut di halaman.

```js
await pptr.clickAt(400, 300);
```

---

### `clickText(text, tag?)`

Klik elemen berdasarkan teks yang ditampilkan (XPath).

```js
await pptr.clickText('Masuk');
await pptr.clickText('Simpan', 'button');
```

---

### `type(selector, text, options?)`

Mengetik teks ke input/textarea, meniru ketukan keyboard per karakter.

```js
await pptr.type('#username', 'john_doe');
await pptr.type('#search', 'keyword', { clear: false, delay: 100 });
```

| Opsi | Default | Keterangan |
|---|---|---|
| `clear` | `true` | Hapus isi field sebelum mengetik |
| `delay` | `50` | Jeda antar karakter (ms) |

---

### `paste(selector, text)`

Mengisi nilai input secara instan tanpa simulasi ketukan. Memicu event `input` dan `change` — cocok untuk React/Vue.

```js
await pptr.paste('#search', 'kata kunci pencarian');
```

---

### `clear(selector)`

Menghapus isi input.

```js
await pptr.clear('#input-nama');
```

---

### `select(selector, value)`

Memilih opsi `<select>`. Mendukung single dan multiple value.

```js
await pptr.select('#kota', 'jakarta');
await pptr.select('#hobi', ['olahraga', 'membaca']);
```

---

### `check(selector, state?)`

Mencentang atau menghilangkan centang checkbox/radio. Tidak klik ulang jika state sudah sesuai.

```js
await pptr.check('#setuju');           // centang
await pptr.check('#setuju', false);    // hapus centang
```

---

### `focus(selector)`

Fokuskan kursor ke elemen.

```js
await pptr.focus('#input-email');
```

---

### `hover(selector)`

Arahkan kursor ke elemen (trigger event `mouseover`).

```js
await pptr.hover('#menu-utama');
```

---

### `press(key)`

Tekan satu tombol keyboard.

```js
await pptr.press('Enter');
await pptr.press('Tab');
await pptr.press('Escape');
await pptr.press('ArrowDown');
```

---

### `keyDown(key)` / `keyUp(key)`

Tahan dan lepaskan tombol keyboard. Dipakai untuk kombinasi manual.

```js
await pptr.keyDown('Shift');
await pptr.click('#item-3');   // shift+click untuk multi-select
await pptr.keyUp('Shift');
```

---

### `combo(...keys)`

Kombinasi tombol keyboard. Tahan semua kecuali yang terakhir, lalu lepaskan.

```js
await pptr.combo('Control', 'a');   // Ctrl+A (select all)
await pptr.combo('Control', 'c');   // Ctrl+C (copy)
await pptr.combo('Control', 'v');   // Ctrl+V (paste)
await pptr.combo('Control', 'z');   // Ctrl+Z (undo)
```

---

### `uploadFile(selector, ...filePaths)`

Upload satu atau lebih file ke `<input type="file">`.

```js
await pptr.uploadFile('input[type="file"]', './dokumen.pdf');

// Multiple files
await pptr.uploadFile('input[type="file"]', './foto1.jpg', './foto2.jpg');
```

---

### `dragAndDrop(sourceSelector, targetSelector)`

Drag elemen dari sumber ke target.

```js
await pptr.dragAndDrop('#item-1', '#dropzone');
```

---

### `mouseMove(x, y)`

Gerakkan kursor mouse ke koordinat.

```js
await pptr.mouseMove(200, 400);
```

---

### `tap(selector)`

Tap elemen (touch event). Untuk mode emulasi mobile.

```js
await pptr.emulate('iPhone 15');
await pptr.tap('#btn-submit');
```

---

### `scrollTo(selector)`

Scroll halaman ke elemen tertentu (smooth, ke tengah viewport).

```js
await pptr.scrollTo('#section-footer');
```

---

### `scrollBy(x?, y?)`

Scroll halaman secara relatif.

```js
await pptr.scrollBy(0, 500);   // turun 500px
await pptr.scrollBy(0, -300);  // naik 300px
```

---

### `scrollToBottom()`

Scroll ke paling bawah halaman.

```js
await pptr.scrollToBottom();
```

---

## Querying

### `$(selector)` / `$$(selector)`

Mengembalikan satu / semua `ElementHandle`.

```js
const btn = await pptr.$('#submit');
const items = await pptr.$$('.product-card');
```

---

### `exists(selector)`

Mengecek apakah elemen ada. Mengembalikan `boolean`.

```js
if (await pptr.exists('.cookie-banner')) {
    await pptr.click('.cookie-banner .btn-accept');
}
```

---

### `count(selector)`

Menghitung jumlah elemen yang cocok dengan selector.

```js
const total = await pptr.count('.result-item');
console.log(`Ditemukan ${total} hasil`);
```

---

### `lastText(selector)`

Mengambil `textContent` dari **elemen terakhir** yang cocok (bukan yang pertama). Berguna ketika ada banyak elemen dengan selector yang sama dan yang dibutuhkan adalah yang paling baru.

```js
// Jika ada 3 elemen .chat-bubble, ambil teks bubble terakhir
const teksAkhir = await pptr.lastText('.chat-bubble');
const responseAkhir = await pptr.lastText('model-response');
```

---

### `text(selector)`

Mengambil `textContent` satu elemen (sudah di-trim).

```js
const harga = await pptr.text('.harga-produk');
```

---

### `texts(selector)`

Mengambil `textContent` semua elemen yang cocok. Mengembalikan `string[]`.

```js
const judul = await pptr.texts('.artikel h2');
// ['Judul 1', 'Judul 2', ...]
```

---

### `attr(selector, attribute)` / `attrs(selector, attribute)`

Mengambil nilai atribut dari satu / semua elemen.

```js
const href   = await pptr.attr('a.btn', 'href');
const semua  = await pptr.attrs('img', 'src');
```

---

### `value(selector)`

Mengambil `.value` dari input/textarea/select.

```js
const val = await pptr.value('#search-input');
```

---

### `html(selector?)` / `outerHtml(selector)`

Mengambil HTML konten di dalam / termasuk elemen itu sendiri. Tanpa selector → HTML seluruh halaman.

```js
const inner = await pptr.html('.konten');
const outer = await pptr.outerHtml('.card');
const full  = await pptr.html();     // seluruh halaman
```

---

### `boundingBox(selector)`

Mengambil posisi dan ukuran elemen: `{ x, y, width, height }`.

```js
const box = await pptr.boundingBox('#modal');
console.log(box.x, box.y, box.width, box.height);
```

---

## Evaluation & Inject

### `evaluate(fn, ...args)`

Jalankan fungsi JavaScript di konteks browser.

```js
const scrollY = await pptr.evaluate(() => window.scrollY);
const sum     = await pptr.evaluate((a, b) => a + b, 10, 20);
```

---

### `evalOnSelector(selector, fn, ...args)`

Jalankan fungsi pada satu elemen tertentu.

```js
const teks  = await pptr.evalOnSelector('h1', el => el.textContent.trim());
const aktif = await pptr.evalOnSelector('#box', (el, cls) => el.classList.contains(cls), 'active');
```

---

### `injectScript(urlOrContent)`

Sisipkan script JS ke halaman dari URL atau string kode.

```js
await pptr.injectScript('https://cdn.example.com/lib.js');
await pptr.injectScript('window.__injected = true;');
```

---

### `injectStyle(urlOrContent)`

Sisipkan CSS ke halaman dari URL atau string kode.

```js
await pptr.injectStyle('https://cdn.example.com/style.css');
await pptr.injectStyle('body { background: red !important; }');
```

---

## Screenshot & PDF

### `screenshot(filePath, options?)`

Screenshot seluruh halaman (full page).

```js
await pptr.screenshot('halaman.png');
await pptr.screenshot('viewport.png', { fullPage: false });
await pptr.screenshot('foto.jpg', { type: 'jpeg', quality: 90 });
```

---

### `screenshotElement(selector, filePath)`

Screenshot hanya satu elemen.

```js
await pptr.screenshotElement('#grafik', 'grafik.png');
```

---

### `pdf(filePath, options?)`

Simpan halaman sebagai PDF (hanya bisa saat `headless: true`).

```js
await pptr.pdf('laporan.pdf');
await pptr.pdf('invoice.pdf', {
    format: 'Letter',
    printBackground: true,
    margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
});
```

---

## Network

### `setHeaders(options)`

Set User-Agent dan/atau HTTP header tambahan.

```js
await pptr.setHeaders({
    userAgent: 'Mozilla/5.0 ...',
    headers: { 'Authorization': 'Bearer token123' },
});
```

---

### `intercept(urlPattern, handler)`

Mencegat request yang URL-nya cocok dan menjalankan handler. Request lain diteruskan normal.

```js
// Mock response
await pptr.intercept('/api/user', (req) => {
    req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nama: 'Mock User' }),
    });
});

// Batalkan request
await pptr.intercept('analytics.js', (req) => req.abort());
```

---

### `blockResources(types?)`

Blokir resource tertentu agar tidak diunduh. Mempercepat loading saat scraping.

```js
await pptr.blockResources();                            // image, stylesheet, font, media
await pptr.blockResources(['image', 'media']);
```

**Tipe tersedia:** `document`, `stylesheet`, `image`, `media`, `font`, `script`, `xhr`, `fetch`, `websocket`, `other`

---

### `waitForRequest(urlPattern, timeout?)`

Menunggu request keluar ke URL yang cocok. Mengembalikan objek `Request`.

```js
const req = await pptr.waitForRequest('/api/submit');
console.log(req.postData());
```

---

### `waitForResponse(urlPattern, timeout?)`

Menunggu response dari URL yang cocok. Mengembalikan objek `Response`.

```js
const res = await pptr.waitForResponse('/api/data');
const body = await res.text();
```

---

### `waitForResponseJson(urlPattern, timeout?)`

Menunggu response JSON dari URL yang cocok. Langsung mengembalikan data ter-parse.

```js
const user = await pptr.waitForResponseJson('/api/profile');
console.log(user.name, user.email);
```

---

### `captureResponse(urlPattern, triggerFn)`

Jalankan aksi dan tangkap response pertama yang URL-nya cocok.

Mengembalikan `{ status, headers, body, json() }`.

```js
const result = await pptr.captureResponse('/api/login', async () => {
    await pptr.click('#btn-submit');
});

console.log(result.status);          // 200
console.log(result.body);            // raw string
console.log(result.json());          // parsed object
console.log(result.headers);         // { 'content-type': 'application/json', ... }
```

---

### `onRequest(handler)`

Listener read-only untuk setiap request yang keluar. Tidak memerlukan request interception.

```js
pptr.onRequest((req) => {
    console.log(`→ ${req.method()} ${req.url()}`);
});
```

---

### `onResponse(handler)`

Listener read-only untuk setiap response yang masuk.

```js
pptr.onResponse(async (res) => {
    if (res.url().includes('/api/')) {
        const body = await res.text();
        console.log(`← ${res.status()} ${res.url()}`, body);
    }
});
```

---

### `startNetworkLog()`

Mulai merekam semua request dan response ke `pptr._networkLog`. Setiap entri juga dicetak via `pptr.log.net`.

```js
pptr.startNetworkLog();
await pptr.goto('https://example.com');

const log = pptr.getNetworkLog();
// log = [
//   { type: 'request',  method: 'GET', url: '...', headers: {}, postData: null },
//   { type: 'response', status: 200,   url: '...', headers: {}, body: '...' },
//   ...
// ]
```

---

### `getNetworkLog()`

Mengambil semua entri yang sudah direkam sejak `startNetworkLog()` dipanggil.

```js
const log = pptr.getNetworkLog();
const apiCalls = log.filter(e => e.url.includes('/api/'));
```

---

### `captureConsole()`

Forward semua output `console` browser ke `pptr.log`. Juga menangkap `pageerror`.

```js
pptr.captureConsole();
await pptr.goto('https://example.com');
// → [DEBUG]   [browser:log] Hello from browser
// → [ERROR]   [browser:error] TypeError: x is not defined
// → [ERROR]   [browser:pageerror] ReferenceError: ...
```

---

### `onConsole(handler)`

Custom handler untuk console browser.

```js
pptr.onConsole(({ type, text }) => {
    if (type === 'error') myLogger.error(text);
});
```

---

## Cookies & Storage

### `getCookies()` / `setCookies(cookies)` / `clearCookies()`

Baca, tulis, dan hapus cookies halaman.

```js
const cookies = await pptr.getCookies();

await pptr.setCookies([
    { name: 'session', value: 'abc123', domain: 'example.com' },
]);

await pptr.clearCookies();
```

---

### `saveCookiesToFile(filePath)` / `loadCookiesFromFile(filePath)`

Simpan dan muat cookie dari file JSON — berguna untuk menjaga sesi antar run.

```js
await pptr.saveCookiesToFile('session.json');
await pptr.loadCookiesFromFile('session.json');
```

---

### `getLocalStorage(key)` / `setLocalStorage(key, value)`

Baca dan tulis `localStorage`.

```js
const token = await pptr.getLocalStorage('auth_token');
await pptr.setLocalStorage('auth_token', 'my-token');
```

---

### `getSessionStorage(key)` / `setSessionStorage(key, value)`

Baca dan tulis `sessionStorage`.

```js
const step = await pptr.getSessionStorage('onboarding_step');
await pptr.setSessionStorage('onboarding_step', '3');
```

---

### `clearStorage()`

Bersihkan `localStorage`, `sessionStorage`, dan semua cookies sekaligus.

```js
await pptr.clearStorage();
```

---

## Dialog & Popup

### `autoAcceptDialogs()`

Otomatis tekan OK pada semua `alert`, `confirm`, dan `prompt`.

```js
await pptr.autoAcceptDialogs();
await pptr.click('#btn-hapus'); // dialog "Yakin?" → otomatis OK
```

---

### `autoDismissDialogs()`

Otomatis tekan Cancel pada semua dialog.

```js
await pptr.autoDismissDialogs();
```

---

### `onDialog(handler)`

Custom handler untuk dialog — memberi kontrol penuh.

```js
pptr.onDialog(async (dialog) => {
    console.log(dialog.type(), dialog.message());
    if (dialog.message().includes('hapus')) {
        await dialog.accept();
    } else {
        await dialog.dismiss();
    }
});
```

---

## Frame (iframe)

### `getFrame(nameOrUrl)`

Mencari frame berdasarkan atribut `name` atau bagian URL frame.

```js
const frame = await pptr.getFrame('payment-frame');
await frame.$eval('#card-number', el => el.value);
```

---

### `waitForFrame(nameOrUrl, timeout?)`

Menunggu frame muncul (untuk iframe yang dimuat secara async).

```js
const frame = await pptr.waitForFrame('recaptcha.net', 15000);
await frame.click('.checkbox');
```

---

## Tab Management

### `newTab(url?)`

Buka tab baru. Tab baru otomatis menjadi `pptr.page` aktif.

```js
await pptr.newTab();
await pptr.newTab('https://google.com');
```

---

### `tabs()`

Ambil semua tab yang terbuka. Mengembalikan `Page[]`.

```js
const semuaTab = await pptr.tabs();
console.log(`${semuaTab.length} tab terbuka`);
```

---

### `switchTab(index)`

Pindah ke tab berdasarkan index (mulai `0`). Otomatis bawa tab ke depan.

```js
await pptr.switchTab(0);
await pptr.switchTab(2);
```

---

### `closeTab(page?)`

Tutup tab. Tanpa argumen = tutup tab aktif.

```js
await pptr.closeTab();

const tabs = await pptr.tabs();
await pptr.closeTab(tabs[1]);
```

---

## Device & Browser

### `emulate(deviceName)`

Emulasi perangkat mobile/tablet dari daftar `KnownDevices` Puppeteer.

```js
await pptr.emulate('iPhone 15');
await pptr.emulate('iPad');
await pptr.emulate('Galaxy S9+');
```

---

### `setViewport(width?, height?)`

Ubah ukuran viewport.

```js
await pptr.setViewport(1920, 1080);
await pptr.setViewport(375, 812);
```

---

### `setGeolocation(latitude, longitude, accuracy?)`

Set lokasi GPS palsu. Otomatis grant permission `geolocation`.

```js
await pptr.goto('https://maps.example.com');
await pptr.setGeolocation(-6.2088, 106.8456);   // Jakarta
await pptr.setGeolocation(51.5074, -0.1278, 50); // London, akurasi 50m
```

---

### `grantPermissions(permissions, origin?)`

Izinkan permission browser tertentu.

```js
await pptr.grantPermissions(['geolocation', 'notifications']);
await pptr.grantPermissions(['camera'], 'https://meet.example.com');
```

**Permission yang tersedia:** `geolocation`, `notifications`, `camera`, `microphone`, `clipboard-read`, `clipboard-write`, dll.

---

### `getMetrics()`

Ambil metrik performa halaman (Chromium DevTools Metrics).

```js
const metrics = await pptr.getMetrics();
console.log(metrics.JSHeapUsedSize, metrics.Nodes);
```

---

### `getPerformanceTiming()`

Ambil data `window.performance.timing` — berguna mengukur kecepatan load halaman.

```js
const timing = await pptr.getPerformanceTiming();
const loadTime = timing.loadEventEnd - timing.navigationStart;
console.log(`Load time: ${loadTime}ms`);
```

---

## Scraping Utilities

### `scrapeTable(selector)`

Konversi `<table>` menjadi array of objects. Baris pertama dijadikan header/key.

```js
const data = await pptr.scrapeTable('#tabel-data');
// [{ Nama: 'A', Harga: '10000' }, { Nama: 'B', Harga: '25000' }]
```

---

### `scrapeLinks(selector?)`

Ambil semua link. Mengembalikan `[{ text, href }]`.

```js
const links = await pptr.scrapeLinks();
const navLinks = await pptr.scrapeLinks('.nav a');
```

---

### `scrapeImages(selector?)`

Ambil semua gambar. Mengembalikan `[{ src, alt }]`.

```js
const images = await pptr.scrapeImages();
const thumbs = await pptr.scrapeImages('.thumbnail img');
```

---

### `scrapeMeta()`

Ambil data meta tag halaman: title, description, og:title, og:image, canonical.

```js
const meta = await pptr.scrapeMeta();
// {
//   title: 'Halaman Utama',
//   description: 'Deskripsi halaman',
//   ogTitle: 'OG Title',
//   ogImage: 'https://example.com/img.jpg',
//   canonical: 'https://example.com/halaman',
// }
```

---

### `scrapeStructured(selector, fields)`

Scraping terstruktur: ambil banyak elemen dan ekstrak field tertentu dari setiap elemen.

Setiap `field` berisi:
- `selector` *(opsional)*: child selector di dalam container
- `attr` *(opsional)*: atribut yang dibaca (tanpa ini → `textContent`)

```js
const produk = await pptr.scrapeStructured('.product-card', {
    nama:  { selector: 'h2' },
    harga: { selector: '.price' },
    img:   { selector: 'img', attr: 'src' },
    link:  { attr: 'href' },
    badge: { selector: '.badge' },
});

// [
//   { nama: 'Produk A', harga: 'Rp 10.000', img: '...', link: '...', badge: 'Baru' },
//   { nama: 'Produk B', harga: 'Rp 25.000', img: '...', link: '...', badge: null },
// ]
```

---

## Contoh Lengkap

### Login dan simpan sesi

```js
const Pptr = require('./Pptr');

(async () => {
    const pptr = new Pptr({ logFile: 'run.log' });
    await pptr.launch({ headless: false });

    // Coba muat cookie lama
    await pptr.loadCookiesFromFile('session.json');
    await pptr.goto('https://example.com/dashboard');

    if (!await pptr.exists('.user-menu')) {
        // Belum login, lakukan login
        await pptr.goto('https://example.com/login');
        await pptr.type('#email', 'user@email.com');
        await pptr.type('#password', 'rahasia123');
        await pptr.click('#btn-login');
        await pptr.waitForUrl('/dashboard');
        await pptr.saveCookiesToFile('session.json');
    }

    pptr.log.success('Sudah login: ' + pptr.url());
    await pptr.close();
})();
```

---

### Scraping tabel dengan pagination

```js
const Pptr = require('./Pptr');

(async () => {
    const pptr = new Pptr();
    await pptr.launch();
    await pptr.blockResources(['image', 'stylesheet', 'font']);
    await pptr.goto('https://example.com/data');

    const semua = [];
    let halaman = 1;

    while (true) {
        await pptr.waitFor('#tabel-data');
        const baris = await pptr.scrapeTable('#tabel-data');
        semua.push(...baris);
        pptr.log.info(`Halaman ${halaman}: ${baris.length} baris (total: ${semua.length})`);

        const adaNext = await pptr.exists('.btn-next:not([disabled])');
        if (!adaNext) break;

        await pptr.click('.btn-next');
        await pptr.sleepRandom(800, 1500);
        halaman++;
    }

    pptr.log.success(`Selesai. Total: ${semua.length} baris`);
    await pptr.close();
})();
```

---

### Tangkap response API saat submit form

```js
const Pptr = require('./Pptr');

(async () => {
    const pptr = new Pptr();
    await pptr.launch({ headless: false });
    await pptr.goto('https://example.com/form');

    await pptr.type('#nama', 'Budi Santoso');
    await pptr.select('#kota', 'bandung');
    await pptr.check('#setuju');

    const result = await pptr.captureResponse('/api/submit', async () => {
        await pptr.click('#btn-kirim');
    });

    pptr.log.info(`Status: ${result.status}`);
    pptr.log.info(`Body: ${result.body}`);
    const json = result.json();
    console.log('ID baru:', json.id);

    await pptr.close();
})();
```

---

### Monitor seluruh traffic network

```js
const Pptr = require('./Pptr');
const fs = require('fs');

(async () => {
    const pptr = new Pptr();
    await pptr.launch();

    pptr.startNetworkLog();
    pptr.captureConsole();

    await pptr.goto('https://example.com');
    await pptr.sleepRandom(2000, 3000);

    const log = pptr.getNetworkLog();
    const apiCalls = log.filter(e => e.type === 'response' && e.url.includes('/api/'));

    pptr.log.info(`Total network entries: ${log.length}`);
    pptr.log.info(`API calls: ${apiCalls.length}`);

    fs.writeFileSync('network.json', JSON.stringify(log, null, 2));
    await pptr.close();
})();
```

---

### Scraping terstruktur dengan scrapeStructured

```js
const Pptr = require('./Pptr');

(async () => {
    const pptr = new Pptr();
    await pptr.launch();
    await pptr.goto('https://example.com/produk');

    const produk = await pptr.scrapeStructured('.product-card', {
        nama:     { selector: 'h2' },
        harga:    { selector: '.price' },
        diskon:   { selector: '.discount' },
        gambar:   { selector: 'img', attr: 'src' },
        link:     { attr: 'href' },
        terjual:  { selector: '.sold-count' },
    });

    console.log(produk);
    await pptr.close();
})();
```

---

### Emulasi mobile + geolokasi

```js
const Pptr = require('./Pptr');

(async () => {
    const pptr = new Pptr();
    await pptr.launch({ headless: false });

    await pptr.emulate('iPhone 15');
    await pptr.goto('https://maps.example.com');

    await pptr.setGeolocation(-6.2088, 106.8456); // Jakarta
    await pptr.tap('#btn-cari-lokasi');
    await pptr.waitFor('.hasil-lokasi');

    await pptr.screenshot('mobile-maps.png');
    await pptr.close();
})();
```

---

### Keyboard combo dan drag & drop

```js
const Pptr = require('./Pptr');

(async () => {
    const pptr = new Pptr();
    await pptr.launch({ headless: false });
    await pptr.goto('https://example.com/editor');

    await pptr.click('#editor');
    await pptr.combo('Control', 'a');   // select all
    await pptr.combo('Control', 'c');   // copy
    await pptr.click('#editor-2');
    await pptr.combo('Control', 'v');   // paste

    // Drag & drop item
    await pptr.dragAndDrop('#card-1', '#column-done');

    await pptr.screenshot('editor.png');
    await pptr.close();
})();
```
