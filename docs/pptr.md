# Pptr — Dokumentasi Penggunaan

Wrapper Puppeteer (dengan `puppeteer-extra` + Stealth) yang menyediakan API ringkas untuk
navigasi, interaksi, scraping, jaringan, dan **perilaku mirip manusia (human-like behavior)**.

File: `core/Pptr.js`

---

## Daftar Isi

- [Setup](#setup)
- [Launch & Navigasi](#launch--navigasi)
- [Menunggu (Waiting)](#menunggu-waiting)
- [Interaksi Standar](#interaksi-standar)
- [Human-like Behavior](#human-like-behavior)
  - [humanMoveTo(x, y, options?)](#humanmovetox-y-options)
  - [humanMoveToTarget(selector, options?)](#humanmovetotargetselector-options)
  - [humanClick(selector, options?)](#humanclickselector-options)
  - [humanHover(selector, options?)](#humanhoverselector-options)
  - [humanType(selector, text, options?)](#humantypeselector-text-options)
  - [humanScroll(distance?, options?)](#humanscrolldistance-options)
  - [humanIdle(min?, max?)](#humanidlemin-max)
  - [humanWander(times?)](#humanwandertimes)
  - [openDevTools()](#opendevtools)
- [Querying & Scraping](#querying--scraping)
- [Jaringan (Network)](#jaringan-network)
- [Cookies & Storage](#cookies--storage)
- [Tab & Frame](#tab--frame)
- [close()](#close)
- [Contoh Lengkap](#contoh-lengkap)

---

## Setup

```js
const Pptr = require('./core/Pptr');

const pptr = new Pptr({ log: true, logFile: null });
await pptr.launch({ headless: false });
```

**Opsi constructor:**

| Opsi | Default | Keterangan |
|---|---|---|
| `log` | `true` | Aktif/matikan log terminal |
| `logFile` | `null` | Tulis log ke file, contoh `'run.log'` |

---

## Launch & Navigasi

```js
await pptr.launch({ headless: false });   // merge dengan default args (stealth, window-size, dll)

await pptr.goto('https://example.com');
await pptr.reload();
await pptr.back();
await pptr.forward();

pptr.url();          // URL aktif
await pptr.title();  // judul halaman
```

> Untuk membuka **DevTools**, launch dengan `headless: false`. Bisa juga `devtools: true`
> agar DevTools langsung terbuka saat browser dibuka. Lihat [openDevTools()](#opendevtools).

---

## Menunggu (Waiting)

```js
await pptr.waitFor('#el');                       // tunggu elemen muncul (visible)
await pptr.waitForHidden('.loading');            // tunggu elemen hilang
await pptr.waitForNav();                          // tunggu navigasi selesai
await pptr.waitForCount('.item', 5);              // tunggu jumlah elemen >= 5

// waitForUrl mendukung string ATAU predikat fungsi:
await pptr.waitForUrl('/dashboard');
await pptr.waitForUrl((url) => url.endsWith('/done'));

// Tunggu teks elemen terakhir berhenti berubah (mis. streaming AI selesai)
const teks = await pptr.waitForStableText('.message', { stable: 1000 });
```

---

## Interaksi Standar

Metode "instan" (tanpa simulasi manusia) — cepat dan andal untuk automasi biasa:

```js
await pptr.click('#btn');
await pptr.type('#input', 'halo', { delay: 50 });
await pptr.paste('#input', 'teks panjang');        // set value instan (input/textarea/contenteditable)
await pptr.clear('#input');
await pptr.select('#dropdown', 'value');
await pptr.check('#agree', true);
await pptr.hover('.menu');
await pptr.clickText('Login');                      // klik elemen berdasarkan teks (aman thd kutip)
await pptr.scrollTo('#footer');
await pptr.scrollToBottom();
```

---

## Human-like Behavior

Sekumpulan metode yang **meniru perilaku manusia**: gerak kursor melengkung (kurva Bézier),
ritme ketik variatif, scroll bertahap, dan jeda berpikir. Berguna untuk menghindari deteksi bot
dan untuk skenario yang membutuhkan interaksi realistis.

> Posisi kursor virtual dilacak internal (`this._mouse`), sehingga setiap gerakan berlanjut
> mulus dari posisi sebelumnya — bukan teleport ke titik baru.

### `humanMoveTo(x, y, options?)`

Gerakkan kursor ke koordinat `(x, y)` mengikuti **kurva Bézier kubik** dengan jitter kecil
dan easing (melambat di awal & akhir).

```js
await pptr.humanMoveTo(640, 400);
await pptr.humanMoveTo(200, 150, { steps: 30, jitter: 2 });
```

| Opsi | Default | Keterangan |
|---|---|---|
| `steps` | auto (berdasar jarak) | Jumlah langkah pergerakan |
| `jitter` | `1.2` | Besar getaran acak per langkah (px) |

### `humanMoveToTarget(selector, options?)`

Scroll ke elemen, lalu gerakkan kursor ke **titik acak di dalam** bounding box elemen.

```js
await pptr.humanMoveToTarget('#submit');
await pptr.humanMoveToTarget('.card', { padding: 0.3 });
```

| Opsi | Default | Keterangan |
|---|---|---|
| `padding` | `0.25` | Rasio area tepi yang dihindari (0–0.5) |
| `steps`, `jitter` | — | Diteruskan ke `humanMoveTo` |

### `humanClick(selector, options?)`

Bergerak ke target secara manusiawi, jeda singkat, lalu tekan-lepas tombol mouse dengan delay.

```js
await pptr.humanClick('#login');
```

### `humanHover(selector, options?)`

Gerak melengkung ke elemen lalu diam sejenak (150–400ms).

```js
await pptr.humanHover('.dropdown-trigger');
```

### `humanType(selector, text, options?)`

Klik field secara manusiawi lalu mengetik dengan **ritme variatif**: delay acak per karakter,
jeda lebih panjang setelah tanda baca/spasi, dan (opsional) salah-ketik-lalu-hapus.

```js
await pptr.humanType('#email', 'user@mail.com');
await pptr.humanType('#bio', 'Halo dunia.', { clear: true, mistakes: 0.05 });
```

| Opsi | Default | Keterangan |
|---|---|---|
| `clear` | `false` | Kosongkan field dulu (Ctrl+A → Backspace) |
| `mistakes` | `0` | Probabilitas salah ketik per karakter (0–1) |

### `humanScroll(distance?, options?)`

Scroll bertahap memakai `mouse.wheel` dalam langkah-langkah kecil + jeda — meniru roda mouse.
Nilai negatif untuk scroll ke atas.

```js
await pptr.humanScroll(800);     // scroll ke bawah 800px bertahap
await pptr.humanScroll(-400);    // scroll ke atas
```

### `humanIdle(min?, max?)`

Jeda "berpikir" acak.

```js
await pptr.humanIdle();          // 400–1500ms
await pptr.humanIdle(1000, 3000);
```

### `humanWander(times?)`

Gerakkan kursor ke beberapa titik acak di viewport (tanpa klik) — meniru gerakan tak sengaja.

```js
await pptr.humanWander(3);
```

### `openDevTools()`

Buka jendela DevTools (best-effort, lewat CDP).

```js
await pptr.openDevTools();
```

- **Andal** bila browser dilaunch headful: `launch({ headless: false })`, idealnya
  `launch({ headless: false, devtools: true })`.
- Saat headless, panggilan **diabaikan** dengan peringatan dan mengembalikan `false`.
- Mengembalikan `true` bila DevTools berhasil/sudah terbuka.

---

## Querying & Scraping

```js
await pptr.exists('#el');                 // boolean
await pptr.count('.item');                // jumlah elemen
await pptr.text('#title');                // textContent
await pptr.texts('.item');                // array textContent
await pptr.lastText('.msg');              // teks elemen terakhir
await pptr.attr('a', 'href');
await pptr.value('#input');
await pptr.html('#el');                   // innerHTML (atau seluruh page jika tanpa selector)

await pptr.scrapeTable('table');          // array of objek (header → sel)
await pptr.scrapeLinks();                 // [{ text, href }]
await pptr.scrapeImages();                // [{ src, alt }]
await pptr.scrapeMeta();                  // { title, description, ogTitle, ... }

// Scrape daftar terstruktur
const data = await pptr.scrapeStructured('.product', {
  nama:  { selector: '.name' },
  harga: { selector: '.price' },
  link:  { selector: 'a', attr: 'href' },
});
```

---

## Jaringan (Network)

Request interception kini **aman dari pemasangan ganda** (guard internal):

```js
await pptr.blockResources(['image', 'font']);     // blokir resource tertentu
await pptr.intercept('/api/track', (req) => req.abort());

const res = await pptr.waitForResponse('/api/data');
const json = await pptr.waitForResponseJson('/api/data');

// Trigger aksi + tangkap response pertama yang cocok
const { status, json } = await pptr.captureResponse('/api/login', () => pptr.click('#login'));

pptr.startNetworkLog();                            // rekam semua request/response
const log = pptr.getNetworkLog();

pptr.captureConsole();                             // teruskan console browser ke logger
```

---

## Cookies & Storage

```js
await pptr.saveCookiesToFile('cookies.json');
await pptr.loadCookiesFromFile('cookies.json');
await pptr.clearCookies();

await pptr.setLocalStorage('token', 'abc');
await pptr.getLocalStorage('token');
await pptr.clearStorage();                         // localStorage + sessionStorage + cookies
```

---

## Tab & Frame

```js
await pptr.newTab('https://example.com');
await pptr.switchTab(0);
await pptr.closeTab();

const frame = await pptr.waitForFrame('iframe-name');
```

---

## `close()`

Tutup browser. Selalu panggil di akhir.

```js
await pptr.close();
```

---

## Contoh Lengkap

### Login dengan perilaku manusiawi

```js
const Pptr = require('./core/Pptr');

(async () => {
    const pptr = new Pptr({ log: true });
    await pptr.launch({ headless: false });

    await pptr.goto('https://example.com/login');

    await pptr.humanIdle(800, 1600);
    await pptr.humanType('#email', 'user@mail.com');
    await pptr.humanType('#password', 'rahasia123');

    await pptr.humanHover('#login');
    await pptr.humanClick('#login');

    await pptr.waitForUrl('/dashboard');
    console.log('Login berhasil:', pptr.url());

    await pptr.close();
})();
```

### Scroll & baca konten ala manusia

```js
const Pptr = require('./core/Pptr');

(async () => {
    const pptr = new Pptr();
    await pptr.launch({ headless: false });
    await pptr.goto('https://example.com/articles');

    await pptr.openDevTools();   // buka DevTools untuk inspeksi (headful)

    for (let i = 0; i < 5; i++) {
        await pptr.humanScroll(600);
        await pptr.humanIdle(600, 1400);
    }

    const judul = await pptr.texts('h2.title');
    console.log(judul);

    await pptr.close();
})();
```

### Scraping terstruktur

```js
const Pptr = require('./core/Pptr');

(async () => {
    const pptr = new Pptr();
    await pptr.launch({ headless: true });
    await pptr.goto('https://example.com/shop');

    const produk = await pptr.scrapeStructured('.product-card', {
        nama:  { selector: '.title' },
        harga: { selector: '.price' },
        img:   { selector: 'img', attr: 'src' },
    });

    console.log(produk);
    await pptr.close();
})();
```
