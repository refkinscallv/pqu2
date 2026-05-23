'use strict'

module.exports = {
	pptr: {
		log: true,
		logFile: null, // path file log, null = tidak ditulis ke file
	},

	browser: {
		headless: false,
		executablePath: `C:/Program Files/Google/Chrome/Application/chrome.exe`,
		userDataDir: `C:/Users/satu1/AppData/Local/Google/Chrome/User Data/Default`,
	},

	gemini: {
		name: `Gemini`,
		url: `https://gemini.google.com`,
		responsePrefix: /^Gemini said\s*/,
		timeout: 90000, // batas waktu tunggu response (ms)
		pollInterval: 150, // interval polling saat stream (ms)
		stableMs: 1000, // teks harus diam berapa ms untuk dianggap selesai

		selectors: {
			input: `div[contenteditable="true"]`,
			sendBtn: `button[aria-label="Send message"]`,
			stopBtn: `button[aria-label="Stop response"]`,
			response: `model-response`,
			userMsg: `user-query`,
			newChat: `[data-test-id="new-chat-button"]`,
		},
	},

	chatgpt: {
		name: `ChatGPT`,
		url: `https://chatgpt.com`,
		responsePrefix: /^ChatGPT said:?\s*/,
		timeout: 90000,
		pollInterval: 150,
		stableMs: 1000,

		selectors: {
			input: `div[contenteditable="true"]`,
			sendBtn: `button[aria-label="Send prompt"]`,
			stopBtn: `button[aria-label="Stop answering"]`,
			response: `section[data-turn="assistant"]`,
			userMsg: `section[data-turn="user"]`,
			newChat: `[data-test-id="create-new-chat-button"]`,
		},
	},

	deepai: {
		name: `DeepAI`,
		url: `https://deepai.org/chat`,
		responsePrefix: null,
		timeout: 90000,
		pollInterval: 150,
		stableMs: 1000,

		selectors: {
			input: `textarea#persistentChatbox`,
			sendBtn: `button#chatSubmitButton`,
			stopBtn: `button#chatStopButton`,
			response: `div.outputBox > .markdownContainer > .markdownContainer`,
			userMsg: `div.chatbox-wrapper`,
			newChat: `a#sidebarNewChatBtn`,
		},
	},
}
