# Gemini — Dokumentasi Penggunaan

Automasi [Google Gemini](https://gemini.google.com) menggunakan Puppeteer.  
File: `library/gemini.js` — Konfigurasi: `config.js`

---

## Daftar Isi

- [Setup](#setup)
- [Konfigurasi](#konfigurasi)
- [init(launchOptions?)](#initlaunchoptions)
- [ask(prompt, options?)](#askprompt-options)
- [stream(prompt, options?)](#streamprompt-options)
- [getLastResponse()](#getlastresponse)
- [getHistory()](#gethistory)
- [newChat()](#newchat)
- [close()](#close)
- [Contoh Penggunaan](#contoh-penggunaan)

---

## Setup

```js
const Gemini = require('./library/gemini');

const gemini = new Gemini();
```

Tidak ada argumen di constructor — semua konfigurasi diambil dari `config.js`.

---

## Konfigurasi

Semua nilai yang bisa diubah ada di `config.js`:

```js
// config.js
module.exports = {

    pptr: {
        log:     true,    // aktifkan/matikan log di terminal
        logFile: null,    // tulis log ke file, contoh: 'run.log'
    },

    browser: {
        headless:       false,
        executablePath: `C:/Program Files/Google/Chrome/Application/chrome.exe`,
        userDataDir:    `C:/Users/nama/AppData/Local/Google/Chrome/User Data/Default`,
    },

    gemini: {
        url:          `https://gemini.google.com`,
        timeout:      90000,  // batas waktu tunggu response (ms)
        pollInterval: 150,    // interval polling stream (ms)
        stableMs:     1000,   // teks harus diam berapa ms agar dianggap selesai

        selectors: {
            input:    `div[contenteditable="true"]`,
            sendBtn:  `button[aria-label="Send message"]`,
            stopBtn:  `button[aria-label="Stop response"]`,
            response: `model-response`,
            userMsg:  `user-query`,
            newChat:  `[data-test-id="new-chat-button"]`,
        },
    },

};
```

> Jika Gemini mengubah struktur HTML-nya, cukup update bagian `selectors` — tidak perlu menyentuh `library/gemini.js`.

---

## `init(launchOptions?)`

Buka browser dan navigasi ke Gemini. Harus dipanggil pertama sebelum method lain.

```js
await gemini.init();
```

**Override browser** (opsional — merge dengan `config.browser`):

```js
await gemini.init({ headless: true });
await gemini.init({ userDataDir: './profil-lain' });
```

Mengembalikan `this` sehingga bisa di-chain:

```js
const gemini = await new Gemini().init();
```

---

## `ask(prompt, options?)`

Kirim prompt dan tunggu jawaban **selesai sepenuhnya** sebelum dikembalikan.

```js
const jawaban = await gemini.ask('Jelaskan apa itu machine learning');
console.log(jawaban);
```

**Opsi:**

| Opsi | Default (`config.js`) | Keterangan |
|---|---|---|
| `timeout` | `90000` | Batas waktu tunggu response (ms) |

```js
const jawaban = await gemini.ask('Prompt panjang...', { timeout: 120000 });
```

**Return:** `Promise<string>` — teks jawaban lengkap.

---

## `stream(prompt, options?)`

Kirim prompt dan terima jawaban **potongan per potongan** secara real-time via AsyncGenerator.  
Setiap iterasi `yield` hanya bagian teks yang **baru muncul** (delta), bukan seluruh teks ulang.

```js
for await (const chunk of gemini.stream('Ceritakan sejarah internet')) {
    process.stdout.write(chunk);
}
```

**Opsi:**

| Opsi | Default (`config.js`) | Keterangan |
|---|---|---|
| `timeout` | `90000` | Batas waktu total (ms) |
| `pollInterval` | `150` | Seberapa sering DOM dicek (ms) |

```js
for await (const chunk of gemini.stream('Prompt...', { pollInterval: 100 })) {
    process.stdout.write(chunk);
}
```

**Cara kerja deteksi selesai:**
1. **Primer** — tunggu tombol Stop menghilang dari halaman
2. **Fallback** — jika Stop tidak terdeteksi, tunggu teks tidak berubah selama `stableMs`

---

## `getLastResponse()`

Ambil teks jawaban terakhir yang sudah ada di halaman, tanpa mengirim prompt baru.

```js
const teks = await gemini.getLastResponse();
```

Berguna setelah `ask()` atau `stream()` untuk mengambil ulang teks yang sama.

---

## `getHistory()`

Ambil seluruh riwayat percakapan aktif sebagai array berurutan.

```js
const history = await gemini.getHistory();
```

**Return:** `Promise<Array<{ role: 'user' | 'model', text: string }>>`

```js
// Contoh hasil:
[
  { role: 'user',  text: 'Halo, siapa kamu?' },
  { role: 'model', text: 'Halo! Saya adalah Gemini...' },
  { role: 'user',  text: 'Apa yang bisa kamu bantu?' },
  { role: 'model', text: 'Saya bisa membantu dengan...' },
]
```

---

## `newChat()`

Mulai percakapan baru (reset konteks). Otomatis klik tombol "New Chat" atau navigasi ulang ke halaman utama jika tombol tidak ditemukan.

```js
await gemini.newChat();
```

Setelah `newChat()`, riwayat percakapan sebelumnya tidak lagi tersedia di `getHistory()`.

---

## `close()`

Tutup browser. Selalu panggil di akhir setelah selesai.

```js
await gemini.close();
```

---

## Contoh Penggunaan

### Satu pertanyaan, satu jawaban

```js
const Gemini = require('./library/gemini');

(async () => {
    const gemini = new Gemini();
    await gemini.init();

    const jawaban = await gemini.ask('Apa itu neural network?');
    console.log(jawaban);

    await gemini.close();
})();
```

---

### Stream real-time ke terminal

```js
const Gemini = require('./library/gemini');

(async () => {
    const gemini = new Gemini();
    await gemini.init();

    process.stdout.write('\n');

    for await (const chunk of gemini.stream('Jelaskan cara kerja GPT')) {
        process.stdout.write(chunk);
    }

    process.stdout.write('\n');

    await gemini.close();
})();
```

---

### Multi-turn conversation

```js
const Gemini = require('./library/gemini');

(async () => {
    const gemini = new Gemini();
    await gemini.init();

    await gemini.ask('Namaku Budi. Ingat ya!');
    const jawaban = await gemini.ask('Siapa namaku?');

    console.log(jawaban); // "Namamu adalah Budi."

    // Ambil seluruh riwayat
    const history = await gemini.getHistory();
    console.log(history);

    await gemini.close();
})();
```

---

### Multi-turn lalu reset

```js
const Gemini = require('./library/gemini');

(async () => {
    const gemini = new Gemini();
    await gemini.init();

    await gemini.ask('Sesi pertama: hitung 1+1');
    await gemini.ask('Kalikan hasilnya dengan 10');

    // Reset percakapan
    await gemini.newChat();

    // Konteks sesi sebelumnya sudah hilang
    await gemini.ask('Sesi kedua: hitung 5+5');

    await gemini.close();
})();
```

---

### Simpan hasil ke file

```js
const Gemini = require('./library/gemini');
const fs = require('fs');

(async () => {
    const gemini = new Gemini();
    await gemini.init();

    const jawaban = await gemini.ask('Buat artikel singkat tentang AI');

    fs.writeFileSync('output.txt', jawaban, 'utf8');
    console.log('Tersimpan ke output.txt');

    await gemini.close();
})();
```

---

### Stream dan kumpulkan teks lengkap

```js
const Gemini = require('./library/gemini');

(async () => {
    const gemini = new Gemini();
    await gemini.init();

    let hasil = '';

    for await (const chunk of gemini.stream('Buat puisi tentang laut')) {
        process.stdout.write(chunk);  // tampil real-time
        hasil += chunk;               // kumpulkan juga
    }

    console.log('\n\nTotal karakter:', hasil.length);

    await gemini.close();
})();
```

---

### Dengan log ke file

```js
// config.js — aktifkan logFile
pptr: {
    log:     true,
    logFile: 'gemini.log',   // semua log ditulis ke sini
},
```

```js
const Gemini = require('./library/gemini');

(async () => {
    const gemini = new Gemini();
    await gemini.init();

    await gemini.ask('Tes logging ke file');

    await gemini.close();
    // → semua log tersimpan di gemini.log
})();
```
