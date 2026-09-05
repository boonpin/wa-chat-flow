import { GoogleGenerativeAI } from '@google/generative-ai'
import { aiKeys } from '@/lib/config'
import type { AIInput } from '../types'

export async function generate(input: AIInput): Promise<string> {
  const apiKey = input.bot.apiKey || aiKeys.gemini
  if (!apiKey) throw new Error('No Gemini API key configured (set GEMINI_API_KEY or store one on the bot)')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: input.bot.model || 'gemini-1.5-flash',
    systemInstruction: input.bot.prompt,
  })

  // Gemini requires the history to start with a user turn and alternate.
  const history = trimToUserStart(input.history).map((turn) => ({
    role: turn.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: turn.content }],
  }))

  const chat = model.startChat({ history })
  const result = await chat.sendMessage(input.message)
  return result.response.text().trim()
}

function trimToUserStart<T extends { role: 'user' | 'assistant' }>(turns: T[]): T[] {
  const firstUser = turns.findIndex((t) => t.role === 'user')
  return firstUser === -1 ? [] : turns.slice(firstUser)
}
