import { useEffect, useMemo, useRef } from 'react'
import type { Page } from '../types'
import { renderPageHTML } from '../render'

interface PhonePreviewProps {
  page: Page
  selectedId: string | null
  onSelect: (blockId: string) => void
  onWatch?: (url: string) => void
  title?: string
}

export function PhonePreview({ page, selectedId, onSelect, onWatch, title = '手机预览' }: PhonePreviewProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  // 只随页面内容重载，选中态通过 postMessage 切换，避免预览被重置滚动位置
  const html = useMemo(() => renderPageHTML(page, { interactive: true }), [page])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { source?: string; blockId?: string; type?: string; url?: string } | null
      if (!data || data.source !== 'chaohaoda-preview') return
      if (data.type === 'watch' && typeof data.url === 'string') {
        onWatch?.(data.url)
        return
      }
      if (typeof data.blockId === 'string') onSelect(data.blockId)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onSelect, onWatch])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const send = () => {
      frame.contentWindow?.postMessage({ type: 'select', id: selectedId }, '*')
    }
    frame.addEventListener('load', send)
    send()
    return () => frame.removeEventListener('load', send)
  }, [selectedId, html])

  return (
    <iframe
      ref={frameRef}
      className="phone-screen"
      title={title}
      srcDoc={html}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
    />
  )
}
