import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { ShareResult } from '../types'

interface ShareDialogProps {
  share: ShareResult | null
  loading: boolean
  pageName: string
  onClose: () => void
}

export function ShareDialog({ share, loading, pageName, onClose }: ShareDialogProps) {
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!share) return
    let alive = true
    setQr('')
    QRCode.toDataURL(share.url, {
      margin: 1,
      width: 320,
      color: { dark: '#0d0f14', light: '#ffffff' },
    })
      .then((url) => {
        if (alive) setQr(url)
      })
      .catch(() => {
        if (alive) setQr('')
      })
    return () => {
      alive = false
    }
  }, [share?.url])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copy() {
    if (!share) return
    try {
      await navigator.clipboard.writeText(share.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const subtitle = loading
    ? '正在生成静态快照，请稍候'
    : share?.public
      ? '扫码即可打开，无需连接同一 Wi-Fi'
      : share?.lan
        ? '手机与电脑连接同一 Wi-Fi 后扫码打开'
        : '当前为本机地址，请通过局域网 IP 打开本应用后再分享'

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="dialog share-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="分享页面"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
          ✕
        </button>
        <h2>{loading ? '正在生成分享' : `分享「${pageName}」`}</h2>
        <p className="dialog-sub">{subtitle}</p>

        {loading ? (
          <div className="qr share-loading" aria-live="polite">
            <span className="share-spinner" />
          </div>
        ) : (
          <>
            <div className="qr" aria-live="polite">
              {qr ? <img src={qr} alt="页面二维码" /> : <span className="share-spinner" />}
            </div>
            <div className="share-url">{share?.url}</div>
            <div className="dialog-actions">
              <button type="button" className="btn-primary" onClick={copy} disabled={!share}>
                {copied ? '已复制' : '复制链接'}
              </button>
              <a
                className="ghost-btn"
                href={share?.url}
                target="_blank"
                rel="noreferrer noopener"
                aria-disabled={!share}
              >
                打开页面 ↗
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
