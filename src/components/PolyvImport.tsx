import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

interface PolyvStatus {
  userId: string
  live: { configured: boolean; appId: string }
  vod: { configured: boolean; userId: string }
  playsafe: boolean
}

export interface PolyvItem {
  kind: 'live' | 'vod'
  id: string
  channelId?: string
  vid?: string
  title: string
  cover: string
  status: string
  liveAt: string
  duration: string
}

interface PolyvImportProps {
  onClose: () => void
  onPickLive: (item: PolyvItem) => void
  onPickVod: (item: PolyvItem) => void
  liveHint?: string
  vodHint?: string
}

function formatDuration(value: string): string {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function PolyvImport({ onClose, onPickLive, onPickVod, liveHint, vodHint }: PolyvImportProps) {
  const [tab, setTab] = useState<'live' | 'vod'>('live')
  const [status, setStatus] = useState<PolyvStatus | null>(null)
  const [items, setItems] = useState<PolyvItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ liveAppId: '', liveAppSecret: '', vodSecretKey: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    fetch('/api/polyv/status', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: PolyvStatus) => setStatus(data))
      .catch(() => setStatus(null))
  }, [])

  const configured = tab === 'live' ? status?.live.configured : status?.vod.configured

  useEffect(() => {
    if (!status) return
    if (!configured) {
      setItems([])
      setError('')
      return
    }
    let alive = true
    setLoading(true)
    setError('')
    const timer = window.setTimeout(() => {
      fetch(`/api/polyv/list?kind=${tab}&page=${page}&keyword=${encodeURIComponent(keyword)}`, {
        cache: 'no-store',
      })
        .then(async (response) => {
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || '获取列表失败')
          if (!alive) return
          setItems(data.items ?? [])
          setTotalPages(data.totalPages ?? 0)
          setTotal(data.total ?? 0)
        })
        .catch((err: Error) => {
          if (alive) setError(err.message)
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    }, 250)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [status, configured, tab, page, keyword])



  async function saveKeys(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setSaveError('')
    try {
      const response = await fetch('/api/polyv/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '保存密钥失败')
      setStatus(data as PolyvStatus)
      setShowForm(false)
      setForm({ liveAppId: '', liveAppSecret: '', vodSecretKey: '' })
      setPage(1)
      setError('')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存密钥失败')
    } finally {
      setSaving(false)
    }
  }

  function switchTab(next: 'live' | 'vod') {
    setTab(next)
    setPage(1)
    setKeyword('')
    setItems([])
    setError('')
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog polyv-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
          ✕
        </button>
        <h2>从保利威选择内容</h2>
        <p className="dialog-sub">
          点播账号 <code>{status?.userId || '未配置'}</code>
          {status?.live.configured ? ' · 直播已配置' : ' · 直播未配置'}
        </p>
        <p className="polyv-target">
          {tab === 'live' ? liveHint || '选择后会填入当前直播组件' : vodHint || '选择后会追加到当前视频合集'}
        </p>

        <div className="polyv-config-actions">
          <button type="button" className="link-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? '收起密钥配置' : '配置密钥'}
          </button>
        </div>

        {showForm ? (
          <form className="polyv-form" onSubmit={saveKeys}>
            <p className="polyv-form-note">
              仅写入本机服务端 <code>.env.local</code>，不会发送到浏览器以外，也不会出现在导出页。
            </p>
            <label>
              <span>直播接口 ID（AppID）</span>
              <input
                value={form.liveAppId}
                placeholder="直播后台 → 开发设置"
                onChange={(event) => setForm({ ...form, liveAppId: event.target.value })}
              />
            </label>
            <label>
              <span>直播接口密钥（AppSecret）</span>
              <input
                type="password"
                value={form.liveAppSecret}
                placeholder="与 AppID 同时填写"
                onChange={(event) => setForm({ ...form, liveAppSecret: event.target.value })}
              />
            </label>
            <label>
              <span>点播接口密钥（SecretKey）</span>
              <input
                type="password"
                value={form.vodSecretKey}
                placeholder="点播后台 → API 接口"
                onChange={(event) => setForm({ ...form, vodSecretKey: event.target.value })}
              />
            </label>
            {saveError ? <p className="form-error">{saveError}</p> : null}
            <div className="polyv-form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? '保存中…' : '保存并连接'}
              </button>
              <button type="button" className="link-btn" onClick={() => setShowForm(false)}>
                取消
              </button>
            </div>
          </form>
        ) : null}

        <div className="polyv-tabs">
          <button type="button" className={tab === 'live' ? 'active' : ''} onClick={() => switchTab('live')}>
            直播频道
          </button>
          <button type="button" className={tab === 'vod' ? 'active' : ''} onClick={() => switchTab('vod')}>
            点播视频
          </button>
        </div>

        <div className="polyv-search">
          <label className="polyv-search-field">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.2 4.2" />
            </svg>
            <input
              value={keyword}
              placeholder={tab === 'live' ? '搜索直播名称' : '搜索视频名称'}
              aria-label="搜索保利威内容"
              onChange={(event) => {
                setKeyword(event.target.value)
                setPage(1)
              }}
            />
            {keyword ? (
              <button
                type="button"
                className="polyv-search-clear"
                aria-label="清空搜索"
                onClick={() => {
                  setKeyword('')
                  setPage(1)
                }}
              >
                ✕
              </button>
            ) : null}
          </label>
          <span className="polyv-search-count">{loading ? '加载中…' : `${total} 条`}</span>
        </div>

        {status && !configured ? (
          <div className="polyv-config">
            <strong>{tab === 'live' ? '直播接口未配置' : '点播接口未配置'}</strong>
            <p>
              {tab === 'live'
                ? '需要在服务端配置 POLYV_LIVE_APP_ID 与 POLYV_LIVE_APP_SECRET。'
                : `已配置点播账号 ${status.vod.userId}，还缺少 POLYV_VOD_SECRET_KEY。`}
            </p>
            <code>.env.local</code>
          </div>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        <div className="polyv-list">
          {items.map((item) => (
            <article className="polyv-item" key={item.id}>
              <div className="polyv-cover">
                {item.cover ? <img src={item.cover} alt="" referrerPolicy="no-referrer" /> : <span>保利威</span>}
              </div>
              <div className="polyv-meta">
                <strong>{item.title}</strong>
                <small>
                  {item.kind === 'live'
                    ? item.status || '直播频道'
                    : item.duration
                      ? `时长 ${formatDuration(item.duration)}`
                      : '点播视频'}
                  {item.kind === 'live' && item.liveAt ? ` · ${item.liveAt.slice(0, 16).replace('T', ' ')}` : ''}
                </small>
              </div>
              <button
                type="button"
                className="mini-btn"
                onClick={() => (item.kind === 'live' ? onPickLive(item) : onPickVod(item))}
              >
                选择
              </button>
            </article>
          ))}
          {!items.length && !loading && !error && configured ? <p className="polyv-empty">没有找到内容。</p> : null}
        </div>

        <div className="polyv-pager">
          <button type="button" className="link-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← 上一页
          </button>
          <span>
            {page} / {Math.max(1, totalPages)}
          </span>
          <button
            type="button"
            className="link-btn"
            disabled={totalPages === 0 || page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            下一页 →
          </button>
        </div>
      </div>
    </div>
  )
}
