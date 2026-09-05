import OpenAI from 'openai'
import { aiKeys } from '@/lib/config'
import type { AIInput } from '../types'

export async function generate(input: AIInput): Promise<string> {
  const apiKey = input.bot.apiKey || aiKeys.openai
  if (!apiKey) throw new Error('No OpenAI API key configured (set OPENAI_API_KEY or store one on the bot)')

  const client = new OpenAI({ apiKey })

  const response = await client.chat.completions.create({
    model: input.bot.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: input.bot.prompt },
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content }) as const),
      { role: 'user', content: input.message },
    ],
  })

  return response.choices[0]?.message?.content?.trim() || ''
}
