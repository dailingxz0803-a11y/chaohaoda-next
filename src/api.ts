import type { AIStatus, AiResponse, Page, ShareResult } from './types'

async function parse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试。')
  return data
}

export async function getAIStatus(): Promise<AIStatus> {
  return parse<AIStatus>(await fetch('/api/status', { cache: 'no-store' }))
}

export async function analyzeReference(image: string): Promise<{ prompt: string }> {
  return parse<{ prompt: string }>(
    await fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    }),
  )
}

export async function aiGenerate(input: {
  mode: 'create' | 'edit'
  prompt: string
  page?: Page
  selectedId?: string | null
  image?: string | null
  signal?: AbortSignal
}): Promise<AiResponse> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: input.signal,
  })
  return parse<AiResponse>(response)
}

export async function publishPage(html: string, name: string): Promise<ShareResult> {
  return parse<ShareResult>(
    await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, name }),
    }),
  )
}

export function downloadHTML(html: string, name: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name || 'chaohaoda'}.html`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function generateCover(prompt: string): Promise<{ image: string; model: string }> {
  const response = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  return parse<{ image: string; model: string }>(response)
}
