import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface Bot {
  provider: string
  apiKey: string
  model: string
  prompt: string
}

export async function generateAIReply(bot: Bot, message: string): Promise<string> {
  if (bot.provider === 'openai') {
    const client = new OpenAI({ apiKey: bot.apiKey })
    const response = await client.chat.completions.create({
      model: bot.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: bot.prompt },
        { role: 'user', content: message },
      ],
    })
    return response.choices[0]?.message?.content || ''
  }

  if (bot.provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(bot.apiKey)
    const model = genAI.getGenerativeModel({
      model: bot.model || 'gemini-1.5-flash',
      systemInstruction: bot.prompt,
    })
    const result = await model.generateContent(message)
    return result.response.text()
  }

  throw new Error(`Unknown provider: ${bot.provider}`)
}
