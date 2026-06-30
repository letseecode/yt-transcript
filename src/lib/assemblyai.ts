import { AssemblyAI } from 'assemblyai'

export const aai = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
})
