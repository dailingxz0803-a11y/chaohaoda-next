import { useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent } from 'react'
import { fileToImage } from '../image'
import { analyzeReference } from '../api'

export interface PromptExample {
  label: string
  prompt: string
}

interface AIBarProps {
  variant: 'hero' | 'editor'
  busy: boolean
  configured: boolean
  model: string
  progress: string
  examples: PromptExample[]
  selectedLabel?: string | null
  onSubmit: (prompt: string, image: string | null) => void
}

function pickBatch(total: number, previous: number[] = []): number[] {
  const pool = Array.from({ length: total }, (_, i) => i).filter((i) => !previous.includes(i))
  const source = pool.length >= 3 ? pool : Array.from({ length: total }, (_, i) => i)
  const picked: number[] = []
  while (picked.length < Math.min(3, source.length)) {
    picked.push(source.splice(Math.floor(Math.random() * source.length), 1)[0])
  }
  return picked
}

function ImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17 4.5-4.5 3.2 3.2 2.6-2.6L20 18" />
    </svg>
  )
}

export function AIBar({
  variant,
  busy,
  configured,
  model,
  progress,
  examples,
  selectedLabel,
  onSubmit,
}: AIBarProps) {
  const [prompt, setPrompt] = useState('')
  const [batch, setBatch] = useState<number[]>(() => pickBatch(examples.length))
  const [image, setImage] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const analysisToken = useRef(0)

  const shown = useMemo(() => batch.map((i) => examples[i]).filter(Boolean), [batch, examples])

  function submit() {
    const value = prompt.trim()
    if (busy) return
    if (busy || analyzing) return
    if (!value && !image) {
      setError('请输入需求，或上传参考图后再生成。')
      inputRef.current?.focus()
      return
    }
    onSubmit(value || '参考这张图的配色与版式，生成并调整页面', image)
  }

  async function attach(file: File | undefined) {
    if (!file) return
    setError('')
    const token = ++analysisToken.current
    try {
      const compressed = await fileToImage(file)
      if (token !== analysisToken.current) return
      setImage(compressed)
      setImageName(file.name)
      setAnalyzing(true)
      inputRef.current?.focus()
      try {
        const { prompt: suggestion } = await analyzeReference(compressed)
        if (token !== analysisToken.current) return
        setPrompt((previous) => {
          if (previous.trim()) return previous
          return variant === 'hero' ? suggestion : `按这张图的风格调整当前页面。${suggestion}`
        })
      } catch (err) {
        if (token !== analysisToken.current) return
        setError(err instanceof Error ? err.message : '参考图已添加，但自动识别失败，可以手动描述。')
      } finally {
        if (token === analysisToken.current) setAnalyzing(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '参考图读取失败。')
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    void attach(event.dataTransfer.files?.[0])
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith('image/'))
      ?.getAsFile()
    if (file) {
      event.preventDefault()
      void attach(file)
    }
  }

  return (
    <div className={`ai-bar ${variant === 'hero' ? 'splash' : 'inline'}`}>
      {variant === 'hero' ? (
        <div className="engine-row">
          <span className={`engine-dot ${configured ? 'on' : 'off'}`} />
          <span>
            {configured ? '千问已连接 · 约 30 秒生成初稿' : '演示模式：未配置千问，生成示例结构'}
          </span>
          <span className="engine-model">{configured ? model : 'demo'}</span>
        </div>
      ) : null}

      <div
        className={`composer${dragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {image ? (
          <div className="ref-attached">
            <img src={image} alt="参考图预览" />
            <div className="ref-meta">
              <strong>参考图已添加</strong>
              <span>
                {analyzing ? '正在识别图片内容，生成提示词…' : `${imageName} · 已识别配色与版式`}
              </span>
            </div>
            <div className="ref-actions">
              <button type="button" className="mini-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
                更换
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  analysisToken.current += 1
                  setAnalyzing(false)
                  setImage(null)
                  setImageName('')
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                移除
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="ref-drop"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="上传参考图，AI 会识别配色与版式"
          >
            <span className="ref-icon">
              <ImageIcon />
            </span>
            <span className="ref-copy">
              <strong>上传参考图，让 AI 照着做</strong>
              <span>拖拽 / 粘贴截图，或点击选择图片（可选，支持 PNG、JPG、WebP）</span>
            </span>
            <span className="ref-cta">选择图片</span>
          </button>
        )}

        <textarea
          ref={inputRef}
          value={prompt}
          maxLength={3000}
          rows={2}
          placeholder={
            image
              ? '参考图已添加：描述想保留的配色、版式或氛围…'
              : variant === 'hero'
                ? '描述你想要的页面… 例如：做一个美妆品牌直播页，突出新品和预约'
                : '跟 AI 说：把标题改短、加一个预约直播、换成浅色…'
          }
          onChange={(event) => setPrompt(event.target.value)}
          onPaste={onPaste}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') submit()
          }}
          aria-label={variant === 'hero' ? '页面需求' : '修改需求'}
        />

        <div className="composer-foot">
          <span className="composer-hint">
            {selectedLabel ? `选中：${selectedLabel}` : '发送需求与页面文字至 千问 · 使用 API 额度'}
          </span>
          <button
            type="button"
            className="btn-primary send"
            onClick={submit}
            disabled={busy || analyzing || (!prompt.trim() && !image)}
          >
            {busy ? 'AI 生成中…' : analyzing ? '识别参考图…' : variant === 'hero' ? '生成页面 →' : '发送修改 ↑'}
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => attach(event.target.files?.[0])}
        />
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="example-head">
        <span>试试这样说</span>
        <button
          type="button"
          className="link-btn"
          onClick={() => setBatch(pickBatch(examples.length, batch))}
          disabled={busy}
        >
          ↻ 换一批
        </button>
      </div>
      <div className="example-chips">
        {shown.map((example) => (
          <button
            key={example.label}
            type="button"
            className="chip"
            disabled={busy}
            title={example.prompt}
            onClick={() => {
              setPrompt(example.prompt)
              inputRef.current?.focus()
            }}
          >
            {example.label}
          </button>
        ))}
      </div>

      {busy && progress ? <p className="progress">{progress}</p> : null}
    </div>
  )
}
