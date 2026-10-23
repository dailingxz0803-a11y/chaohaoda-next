import { useEffect, useState } from 'react'

interface GeneratingOverlayProps {
  mode: 'create' | 'edit'
  onCancel?: () => void
}

const CREATE_STEPS = ['理解你的需求', '规划页面结构', '撰写文案', '搭配配色与字体', '生成手机预览']
const EDIT_STEPS = ['理解修改要求', '定位要改的组件', '重写文案与样式', '重新渲染预览']

export function GeneratingOverlay({ mode, onCancel }: GeneratingOverlayProps) {
  const steps = mode === 'create' ? CREATE_STEPS : EDIT_STEPS
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const active = Math.min(steps.length - 1, Math.floor(elapsed / (mode === 'create' ? 6 : 5)))
  const progress = Math.min(94, 6 + elapsed * (mode === 'create' ? 3.6 : 4.2))

  return (
    <div className="gen-overlay" role="status" aria-live="polite">
      <div className="gen-panel">
        <div className="gen-orb" aria-hidden="true">
          <span className="gen-orb-core">✦</span>
        </div>

        <h2>{mode === 'create' ? 'AI 正在搭建你的页面' : 'AI 正在修改页面'}</h2>
        <p className="gen-sub">
          {mode === 'create'
            ? '正在把一句需求变成可编辑的 H5 页面，通常需要 20–40 秒。'
            : '正在按你的要求调整内容，原页面在完成前保持不变。'}
        </p>

        <div className="gen-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="gen-elapsed">已用时 {elapsed} 秒 · 请不要关闭页面</div>

        <ol className="gen-steps">
          {steps.map((step, index) => (
            <li
              key={step}
              className={index < active ? 'done' : index === active ? 'active' : ''}
            >
              <span className="gen-dot">{index < active ? '✓' : index + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <div className="gen-preview" aria-hidden="true">
          <div className="gen-phone">
            <div className="gen-skeleton tall" />
            <div className="gen-skeleton" />
            <div className="gen-skeleton short" />
            <div className="gen-skeleton" />
            <div className="gen-skeleton short" />
          </div>
          <div className="gen-lines">
            <span />
            <span />
            <span />
          </div>
        </div>

        {onCancel ? (
          <button type="button" className="gen-cancel" onClick={onCancel}>
            取消生成
          </button>
        ) : null}
      </div>
    </div>
  )
}
