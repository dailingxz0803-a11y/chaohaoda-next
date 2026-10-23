import { useState } from 'react'

interface AISettingsProps {
  onClose: () => void
}

export function AISettings({ onClose }: AISettingsProps) {
  const [provider, setProvider] = useState<'deepseek' | 'qwen'>('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('deepseek-chat')
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function choose(next: 'deepseek' | 'qwen') {
    setProvider(next)
    setError('')
    if (next === 'deepseek') {
      setModel('deepseek-chat')
      setBaseUrl('https://api.deepseek.com')
    } else {
      setModel('qwen-plus')
      setBaseUrl('https://dashscope.aliyuncs.com/compatible-mode/v1')
    }
  }

  async function save() {
    if (!apiKey.trim()) {
      setError('请填写 API Key。')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: apiKey.trim(), model: model.trim(), baseUrl: baseUrl.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '保存失败')
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试。')
      setBusy(false)
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog ai-settings" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
          ✕
        </button>
        <h2>模型设置</h2>
        <p className="dialog-sub">填入 API Key 后，生成和修改页面会使用这个模型。Key 只保存在本机。</p>

        <div className="segmented ai-provider">
          <button type="button" className={provider === 'deepseek' ? 'active' : ''} onClick={() => choose('deepseek')}>
            DeepSeek
          </button>
          <button type="button" className={provider === 'qwen' ? 'active' : ''} onClick={() => choose('qwen')}>
            千问
          </button>
        </div>

        <label className="field">
          <span>API Key</span>
          <input
            type="password"
            value={apiKey}
            placeholder={provider === 'deepseek' ? 'sk-…' : 'sk-…'}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>模型</span>
          <input value={model} onChange={(event) => setModel(event.target.value)} />
        </label>
        <label className="field">
          <span>Base URL</span>
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </label>
        {error ? <p className="form-error">{error}</p> : null}

        <div className="dialog-actions ai-actions">
          <button type="button" className="btn-primary" disabled={busy} onClick={save}>
            {busy ? '保存中…' : '保存并启用'}
          </button>
        </div>
        <p className="ai-hint">DeepSeek 只负责文本生成；AI 配图仍需要千问 Key。</p>
      </div>
    </div>
  )
}
