'use strict'

const Gemini = require('./library/gemini')
const ChatGPT = require('./library/chatgpt')
const DeepAI = require('./library/deepai')

;(async () => {
	// Ganti dengan class yang ingin digunakan
	// const ai = new Gemini()
	// const ai = new ChatGPT()
	const ai = new DeepAI()

	await ai.init()

	const jawaban = await ai.ask('Halo, siapa kamu?')
	console.log(jawaban)

	await ai.close()
})()

// const config	= require('./config')
// const Pptr		= require('./core/Pptr')
// const pptr		= new Pptr(config.pptr)

// ;(async () => {
// 	await pptr.launch(config.browser)
// 	await pptr.goto('https://deepai.org/chat')
// })()
