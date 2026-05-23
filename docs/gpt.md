# ChatGPT — Dokumentasi Penggunaan

Automasi [ChatGPT](https://chatgpt.com) menggunakan Puppeteer.  
File: `library/chatgpt.js` — Konfigurasi: `config.js`

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
const ChatGPT = require('./library/chatgpt');

const chatgpt = new ChatGPT();
```

---

## Konfigurasi

Semua nilai ada di `config.js` bagian `chatgpt`:

```js
chatgpt: {
    name: `ChatGPT`,
    url:  `https://chatgpt.com`,
    timeout:      90000,
    pollInterval: 150,
    stableMs:     1000,

    selectors: {
        input:    `div[contenteditable="true"]`,
        sendBtn:  `button[aria-label="Send prompt"]`,
        stopBtn:  `button[aria-label="Stop answering"]`,
        response: `section[data-turn="assistant"]`,
        userMsg:  `section[data-turn="user"]`,
        newChat:  `[data-test-id="create-new-chat-button"]`,
    },
},
```

> Jika ChatGPT mengubah struktur HTML-nya, cukup update bagian `selectors` — tidak perlu menyentuh `library/chatgpt.js`.

---

## `init(launchOptions?)`

Buka browser dan navigasi ke ChatGPT. Harus dipanggil pertama sebelum method lain.

```js
await chatgpt.init();
```

**Override browser** (opsional):

```js
await chatgpt.init({ headless: true });
await chatgpt.init({ userDataDir: './profil-lain' });
```

Mengembalikan `this` sehingga bisa di-chain:

```js
const chatgpt = await new ChatGPT().init();
```

---

## `ask(prompt, options?)`

Kirim prompt dan tunggu jawaban **selesai sepenuhnya**.

```js
const jawaban = await chatgpt.ask('Jelaskan apa itu machine learning');
console.log(jawaban);
```

**Opsi:**

| Opsi | Default | Keterangan |
|---|---|---|
| `timeout` | `90000` | Batas waktu tunggu response (ms) |

**Return:** `Promise<string>`

---

## `stream(prompt, options?)`

Kirim prompt dan terima jawaban **potongan per potongan** secara real-time.

```js
for await (const chunk of chatgpt.stream('Ceritakan sejarah internet')) {
    process.stdout.write(chunk);
}
```

**Opsi:**

| Opsi | Default | Keterangan |
|---|---|---|
| `timeout` | `90000` | Batas waktu total (ms) |
| `pollInterval` | `150` | Seberapa sering DOM dicek (ms) |

---

## `getLastResponse()`

Ambil teks jawaban terakhir yang sudah ada di halaman.

```js
const teks = await chatgpt.getLastResponse();
```

---

## `getHistory()`

Ambil seluruh riwayat percakapan aktif.

```js
const history = await chatgpt.getHistory();
```

**Return:** `Promise<Array<{ role: 'user' | 'model', text: string }>>`

---

## `newChat()`

Mulai percakapan baru (reset konteks).

```js
await chatgpt.newChat();
```

---

## `close()`

Tutup browser.

```js
await chatgpt.close();
```

---

## Contoh Penggunaan

### Satu pertanyaan, satu jawaban

```js
const ChatGPT = require('./library/chatgpt');

(async () => {
    const chatgpt = new ChatGPT();
    await chatgpt.init();

    const jawaban = await chatgpt.ask('Apa itu neural network?');
    console.log(jawaban);

    await chatgpt.close();
})();
```

---

### Stream real-time ke terminal

```js
const ChatGPT = require('./library/chatgpt');

(async () => {
    const chatgpt = new ChatGPT();
    await chatgpt.init();

    process.stdout.write('\n');

    for await (const chunk of chatgpt.stream('Jelaskan cara kerja GPT')) {
        process.stdout.write(chunk);
    }

    process.stdout.write('\n');

    await chatgpt.close();
})();
```

---

### Multi-turn conversation

```js
const ChatGPT = require('./library/chatgpt');

(async () => {
    const chatgpt = new ChatGPT();
    await chatgpt.init();

    await chatgpt.ask('Namaku Budi. Ingat ya!');
    const jawaban = await chatgpt.ask('Siapa namaku?');

    console.log(jawaban);

    await chatgpt.close();
})();
```

---

### Multi-turn lalu reset

```js
const ChatGPT = require('./library/chatgpt');

(async () => {
    const chatgpt = new ChatGPT();
    await chatgpt.init();

    await chatgpt.ask('Sesi pertama: hitung 1+1');
    await chatgpt.ask('Kalikan hasilnya dengan 10');

    await chatgpt.newChat();

    await chatgpt.ask('Sesi kedua: hitung 5+5');

    await chatgpt.close();
})();
```
