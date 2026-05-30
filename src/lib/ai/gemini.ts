import { GoogleGenerativeAI } from '@google/generative-ai'

export function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY ausente no servidor')
  return new GoogleGenerativeAI(apiKey)
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
