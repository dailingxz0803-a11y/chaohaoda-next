import { useEffect, useMemo, useState } from 'react'
import type { Page } from '../types'
import { BLOCK_LABELS } from '../types'
import { timeAgo } from '../lib'
import { makePage, TEMPLATE_META } from '../templates'
import { renderPageHTML } from '../render'
import { CREATE_EXAMPLES } from '../prompts'
import { AIBar } from './AIBar'
import { AISettings } from './AISettings'

interface HomeProps {
  pages: Page[]
  configured: boolean
  model: string
  busy: boolean
  progress: string
  onCreate: (prompt: string, image: string | null) => void
  onTemplate: (templateId: string) => void
  onOpen: (pageId: string) => void
  onDelete: (pageId: string) => void
}

const TEMPLATE_TAGS: Record<string, string[]> = {
  event: ['讲师阵容', '课程合集', '直播预约'],
  summit: ['时间线议程', '嘉宾', '往期回顾'],
  launch: ['倒计时', '发布会流程', '主讲人'],
  concert: ['现场预约', '切片合集', '瀑布流'],
  bootcamp: ['每日任务', '直播补课', '单列合集'],
  health: ['专家卡片', '直播课程', '往期'],
  sale: ['秒杀价', '倒计时', '课程列表'],
  talk: ['对谈', '往期节目', '金句'],
}

const TEMPLATE_ORDER = ['sale', 'talk', 'event', 'summit', 'launch', 'concert', 'bootcamp', 'health']
const FEATURED_TEMPLATES = new Set(['sale', 'talk'])
const TEMPLATE_FILTERS = ['全部', '活动', '课程', '品牌'] as const

function TemplateThumb({ templateId }: { templateId: string }) {
  const html = useMemo(() => renderPageHTML(makePage(templateId)), [templateId])
  return (
    <iframe
      className="thumb-frame"
      srcDoc={html}
      title=""
      tabIndex={-1}
      aria-hidden="true"
      loading="lazy"
      sandbox="allow-scripts"
    />
  )
}

export function Home({
  pages,
  configured,
  model,
  busy,
  progress,
  onCreate,
  onTemplate,
  onOpen,
  onDelete,
}: HomeProps) {
  const [filter, setFilter] = useState<(typeof TEMPLATE_FILTERS)[number]>('全部')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [preview, setPreview] = useState<(typeof TEMPLATE_META)[number] | null>(null)
  const orderedTemplates = [...TEMPLATE_META].sort(
    (a, b) => TEMPLATE_ORDER.indexOf(a.id) - TEMPLATE_ORDER.indexOf(b.id),
  )
  const visibleTemplates = orderedTemplates.filter(
    (template) => filter === '全部' || template.category === filter,
  )
  const previewPage = useMemo(() => (preview ? makePage(preview.id) : null), [preview?.id])
  const previewHtml = useMemo(() => (previewPage ? renderPageHTML(previewPage) : ''), [previewPage])
  const previewBlocks = useMemo(
    () => (previewPage ? [...new Set(previewPage.blocks.map((block) => BLOCK_LABELS[block.type]))] : []),
    [previewPage],
  )

  useEffect(() => {
    if (!preview) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPreview(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [preview])

  return (
    <div className="home">
      <header className="home-nav-shell">
        <div className="home-nav">
        <a className="brand" href="/" aria-label="抄好搭首页">
          <span className="brand-mark" aria-hidden="true">
            ▶
          </span>
          <strong>抄好搭</strong>
        </a>
        <nav className="nav-links" aria-label="首页导航">
          <a href="#templates">模板</a>
          <a href="#pages">我的页面</a>
          <a href="#composer">开始创作</a>
        </nav>
        <div className="nav-actions">
          <button
            type="button"
            className={`status-pill ${configured ? 'on' : 'off'}`}
            onClick={() => setSettingsOpen(true)}
            title="模型设置"
          >
            <i />
            {configured ? model : '演示模式'}
          </button>
          <a className="btn-ink small" href="#composer">
            开始创作 <span aria-hidden="true">↗</span>
          </a>
        </div>
        </div>
      </header>

      <main className="home-main">
        <section className="hero">
          <div className="hero-head">
            <p className="kicker">
              <span className="kicker-dot" />
              内容聚合页工作台
            </p>
            <h1>
              好内容，
              <br />
              <em>值得一个好页面</em>
            </h1>
            <p className="hero-sub">
              从一句话开始，AI 负责结构、文案与配色；你只需要补充真实的直播、视频和讲师信息。
            </p>
          </div>

          <div className="hero-composer">
            <div id="composer">
              <AIBar
                variant="hero"
                busy={busy}
                configured={configured}
                model={model}
                progress={progress}
                examples={CREATE_EXAMPLES}
                onSubmit={onCreate}
              />
            </div>

            <div className="hero-foot">
              <div className="hero-tags" aria-hidden="true">
                <span>讲师阵容</span>
                <span>时间线议程</span>
                <span>直播预约</span>
                <span>视频合集</span>
              </div>
            </div>

          </div>
        </section>

        <section className="template-section" id="templates">
          <div className="template-head">
            <div className="template-heading">
              <h2>模板</h2>
              <span>{visibleTemplates.length} / {TEMPLATE_META.length}</span>
            </div>
            <div className="template-filters" role="tablist" aria-label="按场景筛选模板">
              {TEMPLATE_FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={filter === item ? 'active' : ''}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="template-grid">
            {visibleTemplates.map((template, index) => {
              const featured = filter === '全部' && FEATURED_TEMPLATES.has(template.id)
              return (
                <article
                  className={`template-card${featured ? ' is-featured' : ''}`}
                  key={template.id}
                  style={{ animationDelay: `${index * 55}ms` }}
                >
                  <button
                    type="button"
                    className="template-preview"
                    onClick={() => setPreview(template)}
                    aria-label={`预览「${template.name}」模板`}
                  >
                    <TemplateThumb templateId={template.id} />
                    <span className="template-overlay">
                      预览模板 <i aria-hidden="true">↗</i>
                    </span>
                  </button>
                  <div className="template-info">
                    <div className="template-meta">
                      <span className="template-index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="template-category">{template.category}</span>
                    </div>
                    <div className="template-title">
                      <strong>{template.name}</strong>
                      <span>{template.tagline}</span>
                    </div>
                    <div className="template-bottom">
                      <div className="template-tags">
                        {(TEMPLATE_TAGS[template.id] ?? []).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      <span className="template-open">预览 <i aria-hidden="true">↗</i></span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="pages-section" id="pages">
          <div className="section-head">
            <div>
              <h2>我的页面</h2>
              <p>保存在当前浏览器，随时回来继续改。</p>
            </div>
            <span className="section-count">{pages.length ? `${pages.length} 个` : '还没有页面'}</span>
          </div>

          {pages.length ? (
            <div className="page-list">
              {pages.map((page, index) => (
                <article className="page-row" key={page.id}>
                  <span className="page-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="page-info">
                    <h3>{page.name || '未命名页面'}</h3>
                    <p>
                      {page.blocks.length} 个组件 · {timeAgo(page.updatedAt)}
                    </p>
                  </div>
                  <div className="page-actions">
                    <button type="button" className="btn-line" onClick={() => onOpen(page.id)}>
                      继续编辑
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label={`删除 ${page.name}`}
                      onClick={() => onDelete(page.id)}
                    >
                      ✕
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              还没有页面。从上面选一套模板，或者直接对 AI 说一句需求。
            </div>
          )}
        </section>

        <footer className="home-foot">
          <span>抄好搭 · AI 内容聚合页工作台</span>
          <span>页面保存在本机；分享链接在同一 Wi-Fi 下可访问。</span>
        </footer>
      </main>

      {preview ? (
        <div className="tpl-modal" role="dialog" aria-modal="true" aria-label={`预览「${preview.name}」`} onClick={() => setPreview(null)}>
          <div className="tpl-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="tpl-modal-info">
              <div className="tpl-modal-head">
                <span>{preview.category}</span>
                <button type="button" className="dialog-close" onClick={() => setPreview(null)} aria-label="关闭">
                  ✕
                </button>
              </div>
              <h2>{preview.name}</h2>
              <p className="tpl-modal-tagline">{preview.tagline}</p>
              <div className="tpl-modal-tags">
                {(TEMPLATE_TAGS[preview.id] ?? []).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="tpl-modal-blocks">
                <span>包含组件</span>
                <p>{previewBlocks.join(' · ')}</p>
              </div>
              <div className="tpl-modal-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => onTemplate(preview.id)}
                >
                  使用此模板
                </button>
                <button type="button" className="btn-line" onClick={() => setPreview(null)}>
                  只看一下
                </button>
              </div>
            </div>
            <div className="tpl-modal-stage">
              <div className="tpl-phone">
                <iframe
                  className="tpl-frame"
                  title={`${preview.name} 预览`}
                  srcDoc={previewHtml}
                  sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? <AISettings onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  )
}
