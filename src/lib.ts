/** 短 id：块、条目、页面通用 */
export function uid(prefix = 'b'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function esc(value: string | undefined | null): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch])
}

/** 只允许 http(s)，防止 javascript: 注入 */
export function safeUrl(value: string | undefined): string {
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 十六进制颜色校验 */
export function isHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

/** 与白/黑混合，用于生成封面渐变 */
export function shade(hex: string, amount: number): string {
  if (!isHex(hex)) return hex
  const num = parseInt(hex.slice(1), 16)
  const target = amount < 0 ? 0 : 255
  const ratio = Math.abs(amount)
  const r = Math.round(((num >> 16) & 0xff) + (target - ((num >> 16) & 0xff)) * ratio)
  const g = Math.round(((num >> 8) & 0xff) + (target - ((num >> 8) & 0xff)) * ratio)
  const b = Math.round((num & 0xff) + (target - (num & 0xff)) * ratio)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

/** 北京时间展示：2026-10-24 19:30 */
export function formatLiveAt(value: string | undefined): string {
  if (!value) return '待设置开播时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
