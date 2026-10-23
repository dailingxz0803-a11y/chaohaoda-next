import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { Block, BlockType, ChatMessage, CollectionItem, Page } from '../types'
import { BLOCK_LABELS } from '../types'
import { uid, clamp } from '../lib'
import { EDIT_EXAMPLES } from '../prompts'
import { renderPageHTML } from '../render'
import { generateCover } from '../api'
import { compressImage, fileToImage } from '../image'
import { AIBar } from './AIBar'
import { PhonePreview } from './PhonePreview'
import { PolyvImport } from './PolyvImport'
import type { PolyvItem } from './PolyvImport'

interface EditorProps {
  page: Page
  configured: boolean
  model: string
  busy: boolean
  progress: string
  changes: string[]
  changesTitle: string
  chat: ChatMessage[]
  canUndo: boolean
  canRedo: boolean
  onUpdate: (page: Page, key?: string) => void
  onEdit: (prompt: string, selectedId: string | null, image: string | null) => void
  onUndo: () => void
  onRedo: () => void
  onBack: () => void
  onExport: () => void
  onShare: () => void
  assetBusy: boolean
  assetProgress: string
  onCancelAssets: () => void
}

const BLOCK_GLYPHS: Record<BlockType, string> = {
  hero: '▣',
  text: '▤',
  live: '▶',
  reservation: '◷',
  countdown: '◔',
  collection: '▦',
  speakers: '◉',
  timeline: '⌁',
  stats: '▥',
  quicknav: '▩',
  link: '↗',
}

const PRESETS: { name: string; theme: Page['theme'] }[] = [
  {
    name: '清透蓝',
    theme: { background: '#F3F7FB', surface: '#FFFFFF', text: '#152230', muted: '#5E6E7E', accent: '#1D6FB8', soft: '#E2EDF8' },
  },
  {
    name: '暗夜紫',
    theme: { background: '#0B0710', surface: '#171020', text: '#F7F0FF', muted: '#B4A6C6', accent: '#B57BFF', soft: '#2B1A42' },
  },
  {
    name: '奶油橙',
    theme: { background: '#FBF6EC', surface: '#FFFFFF', text: '#2B2116', muted: '#7C6C58', accent: '#D97706', soft: '#F7E6CC' },
  },
  {
    name: '石墨黑',
    theme: { background: '#0A0C10', surface: '#141821', text: '#EDF1FA', muted: '#94A0B5', accent: '#38BDF8', soft: '#16202E' },
  },
]

const COLOR_LABELS: { key: keyof Page['theme']; label: string }[] = [
  { key: 'background', label: '页面背景' },
  { key: 'surface', label: '卡片底色' },
  { key: 'text', label: '标题文字' },
  { key: 'muted', label: '辅助文字' },
  { key: 'accent', label: '强调色' },
  { key: 'soft', label: '柔和色' },
]

export function Editor({
  page,
  configured,
  model,
  busy,
  progress,
  changes,
  changesTitle,
  chat,
  canUndo,
  canRedo,
  onUpdate,
  onEdit,
  onUndo,
  onRedo,
  onBack,
  onExport,
  onShare,
  assetBusy,
  assetProgress,
  onCancelAssets,
}: EditorProps) {
  const [tab, setTab] = useState<'content' | 'style' | 'chat'>('content')
  const [selectedId, setSelectedId] = useState<string | null>(page.blocks[0]?.id ?? null)
  const [guideOpen, setGuideOpen] = useState(() => {
    try {
      return localStorage.getItem('chaohaoda:guide') !== '1'
    } catch {
      return true
    }
  })
  const scrollOnSelect = useRef(false)

  useEffect(() => {
    if (!scrollOnSelect.current) return
    scrollOnSelect.current = false
    const form = document.querySelector('.block-form')
    form?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedId])

  function dismissGuide() {
    setGuideOpen(false)
    try {
      localStorage.setItem('chaohaoda:guide', '1')
    } catch {
      /* 本地存储不可用时只关闭本次 */
    }
  }

  function selectFromPreview(id: string) {
    scrollOnSelect.current = true
    setSelectedId(id)
  }

  const [addOpen, setAddOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit')
  const [coverBusyKey, setCoverBusyKey] = useState<string | null>(null)
  const [polyvOpen, setPolyvOpen] = useState(false)
  const [watchUrl, setWatchUrl] = useState<string | null>(null)
  const [coverError, setCoverError] = useState('')

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (watchUrl) setWatchUrl(null)
      else if (fullscreen) setFullscreen(false)
      else if (polyvOpen) setPolyvOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [watchUrl, fullscreen, polyvOpen])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== location.origin) return
      if (event.data?.type === 'watch:close') setWatchUrl(null)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const selected = page.blocks.find((block) => block.id === selectedId) ?? null
  const liveTypes = ['live', 'reservation', 'countdown']
  const polyvLiveHint =
    selected && liveTypes.includes(selected.type)
      ? '将填入当前选中的直播组件'
      : page.blocks.some((block) => liveTypes.includes(block.type))
        ? '将填入页面中的直播组件，并自动定位'
        : '页面还没有直播组件，选择后会新增一个'
  const polyvVodHint =
    selected?.type === 'collection'
      ? '将追加到当前选中的视频合集'
      : page.blocks.some((block) => block.type === 'collection')
        ? '将追加到页面中的视频合集，并自动定位'
        : '页面还没有视频合集，选择后会新增一个'
  const fullHtml = useMemo(() => renderPageHTML(page), [page])

  function patch(patchValue: Partial<Page>, key?: string) {
    onUpdate({ ...page, ...patchValue, updatedAt: Date.now() }, key)
  }

  function updateBlock(id: string, patchValue: Partial<Block>, key?: string) {
    patch(
      { blocks: page.blocks.map((block) => (block.id === id ? { ...block, ...patchValue } : block)) },
      key ?? `block:${id}:${Object.keys(patchValue).join(',')}`,
    )
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = page.blocks.findIndex((block) => block.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= page.blocks.length) return
    const blocks = [...page.blocks]
    ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
    patch({ blocks })
  }

  function addBlock(type: BlockType) {
    const base: Block = {
      id: uid('blk'),
      type,
      title:
        type === 'hero'
          ? '新主视觉'
          : type === 'text'
            ? '新文案'
            : type === 'collection'
              ? '内容合集'
              : type === 'link'
                ? '相关链接'
                : type === 'speakers'
                  ? '讲师阵容'
                  : type === 'timeline'
                    ? '活动流程'
                    : '直播安排',
      body: type === 'text' || type === 'hero' ? '在这里补充说明文字。' : '',
    }
    if (type === 'collection') {
      base.layout = 'double'
      base.items = [
        { id: uid('item'), title: '第一条内容', body: '', duration: '00:00' },
        { id: uid('item'), title: '第二条内容', body: '', duration: '00:00' },
      ]
    }
    if (type === 'speakers') {
      base.layout = 'double'
      base.items = [
        { id: uid('item'), title: '讲师姓名', subtitle: '头衔 / 机构', body: '一句话介绍这位讲师。' },
        { id: uid('item'), title: '讲师姓名', subtitle: '头衔 / 机构', body: '一句话介绍这位讲师。' },
      ]
    }
    if (type === 'stats') {
      base.items = [
        { id: uid('item'), title: '10', subtitle: '我的积分' },
        { id: uid('item'), title: '1 天', subtitle: '已连续签到' },
        { id: uid('item'), title: '5 折', subtitle: '今日秒杀' },
      ]
    }
    if (type === 'quicknav') {
      base.items = [
        { id: uid('item'), title: '直播', icon: 'live', url: '' },
        { id: uid('item'), title: '课程', icon: 'course', url: '' },
        { id: uid('item'), title: '专家', icon: 'expert', url: '' },
        { id: uid('item'), title: '回放', icon: 'replay', url: '' },
      ]
    }
    if (type === 'timeline') {
      base.items = [
        { id: uid('item'), title: '环节名称', time: '19:30', body: '这个环节讲什么。' },
        { id: uid('item'), title: '环节名称', time: '20:10', body: '这个环节讲什么。' },
      ]
    }
    if (type === 'live' || type === 'reservation' || type === 'countdown') base.liveAt = ''
    if (type === 'hero') base.tags = []
    const index = page.blocks.findIndex((block) => block.id === selectedId)
    const blocks = [...page.blocks]
    blocks.splice(index >= 0 ? index + 1 : blocks.length, 0, base)
    patch({ blocks })
    setSelectedId(base.id)
    setAddOpen(false)
  }

  function duplicateBlock(block: Block) {
    const copy: Block = {
      ...block,
      id: uid('blk'),
      title: `${block.title}（副本）`,
      items: block.items?.map((item) => ({ ...item, id: uid('item') })),
    }
    const index = page.blocks.findIndex((item) => item.id === block.id)
    const blocks = [...page.blocks]
    blocks.splice(index + 1, 0, copy)
    patch({ blocks })
    setSelectedId(copy.id)
  }

  function removeBlock(block: Block) {
    const blocks = page.blocks.filter((item) => item.id !== block.id)
    patch({ blocks })
    if (selectedId === block.id) setSelectedId(blocks[0]?.id ?? null)
  }

  function insertBlock(block: Block) {
    const index = page.blocks.findIndex((item) => item.id === selectedId)
    const blocks = [...page.blocks]
    blocks.splice(index >= 0 ? index + 1 : blocks.length, 0, block)
    patch({ blocks })
    setSelectedId(block.id)
  }

  function secondsToClock(value: string): string {
    const seconds = Number(value)
    if (!Number.isFinite(seconds) || seconds <= 0) return ''
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  function pickLive(item: PolyvItem) {
    const liveTypes = ['live', 'reservation', 'countdown']
    const target =
      selected && liveTypes.includes(selected.type)
        ? selected
        : page.blocks.find((block) => liveTypes.includes(block.type))
    if (target) {
      updateBlock(target.id, {
        title: item.title || target.title,
        body: item.status || target.body,
        channelId: item.channelId || target.channelId,
        cover: item.cover || target.cover,
        liveAt: item.liveAt ? item.liveAt.slice(0, 16) : target.liveAt,
      })
      setSelectedId(target.id)
    } else {
      insertBlock({
        id: uid('blk'),
        type: 'live',
        title: item.title,
        body: item.status || '保利威直播频道',
        channelId: item.channelId,
        cover: item.cover,
        liveAt: item.liveAt ? item.liveAt.slice(0, 16) : '',
      })
    }
    setPolyvOpen(false)
  }

  function pickVod(item: PolyvItem) {
    const nextItem = {
      id: uid('item'),
      title: item.title,
      body: '',
      duration: secondsToClock(item.duration),
      vid: item.vid,
      cover: item.cover,
    }
    const target =
      selected?.type === 'collection'
        ? selected
        : page.blocks.find((block) => block.type === 'collection')
    if (target) {
      updateBlock(target.id, { items: [...(target.items ?? []), nextItem] })
      setSelectedId(target.id)
    } else {
      insertBlock({
        id: uid('blk'),
        type: 'collection',
        title: '保利威视频',
        body: '从保利威点播库导入，点击条目进入观看页。',
        layout: 'double',
        items: [nextItem],
      })
    }
    setPolyvOpen(false)
  }

  async function makeCover(block: Block, itemId?: string) {
    const item = itemId ? block.items?.find((entry) => entry.id === itemId) : null
    const title = item?.title ?? block.title
    const key = itemId ?? block.id
    setCoverBusyKey(key)
    setCoverError('')
    try {
      const { image } = await generateCover(
        `主题：${page.name}；标题：${title || '页面封面'}；主色：${page.theme.accent}；风格：与页面一致，干净、有质感、适合移动端`,
      )
      const compressed = await compressImage(image, 1024, 0.82)
      if (itemId) {
        updateBlock(block.id, {
          items: block.items?.map((entry) => (entry.id === itemId ? { ...entry, cover: compressed } : entry)),
        })
      } else {
        updateBlock(block.id, { cover: compressed })
      }
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : '封面生成失败，请重试。')
    } finally {
      setCoverBusyKey(null)
    }
  }

  return (
    <div className="editor">
      <header className="editor-top">
        <button
          type="button"
          className="back-btn"
          onClick={onBack}
          title="返回工作台（页面已自动保存）"
        >
          <span className="back-arrow" aria-hidden="true">
            ←
          </span>
          <span className="back-text">工作台</span>
        </button>
        <span className="topbar-divider" aria-hidden="true" />
        <input
          className="page-name"
          value={page.name}
          maxLength={40}
          onChange={(e) => patch({ name: e.target.value }, 'name')}
          aria-label="页面名称"
        />
        <span className="save-state" title="页面自动保存在当前浏览器">
          <i />
          已保存到本机
        </span>
        <div className="editor-actions">
          <button
            type="button"
            className="ghost-btn mobile-toggle"
            onClick={() => setMobilePane(mobilePane === 'edit' ? 'preview' : 'edit')}
            title="切换编辑与预览"
          >
            {mobilePane === 'edit' ? '看预览' : '去编辑'}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={onUndo}
            disabled={busy || !canUndo}
            title="撤销（⌘Z）"
          >
            撤销
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={onRedo}
            disabled={busy || !canRedo}
            title="重做（⇧⌘Z）"
          >
            重做
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setPolyvOpen(true)}
            disabled={busy}
            title="从保利威选择直播频道或点播视频"
          >
            从保利威导入
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={onExport}
            disabled={busy}
            title="下载独立 HTML，可离线打开"
          >
            导出 HTML
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onShare}
            disabled={busy}
            title="生成页面二维码与分享链接"
          >
            <span className="share-label-full">分享与二维码</span>
            <span className="share-label-short">分享</span>
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </header>

      {guideOpen ? (
        <div className="flow-guide">
          <span className="flow-guide-title">三步完成</span>
          <ol>
            <li>
              <b>1</b>左侧改文字和素材
            </li>
            <li>
              <b>2</b>点中间的组件快速定位
            </li>
            <li>
              <b>3</b>右上角导出或分享
            </li>
          </ol>
          <button
            type="button"
            className="flow-guide-close"
            onClick={dismissGuide}
            aria-label="关闭引导"
          >
            ✕
          </button>
        </div>
      ) : null}

      {assetBusy ? (
        <div className="asset-banner">
          <span className="asset-spinner" aria-hidden="true" />
          <span>
            正在为页面生成配图 <b>{assetProgress}</b>
          </span>
          <small>可以继续编辑，完成后自动填入封面</small>
          <button type="button" onClick={onCancelAssets}>
            停止
          </button>
        </div>
      ) : null}

      <div className={`editor-body ${mobilePane === 'preview' ? 'show-preview' : ''}`}>
        <aside className="panel">
          <AIBar
            variant="editor"
            busy={busy}
            configured={configured}
            model={model}
            progress={progress}
            examples={EDIT_EXAMPLES}
            selectedLabel={selected?.title ?? null}
            onSubmit={(prompt, image) => onEdit(prompt, selectedId, image)}
          />

          {changes.length ? (
            <div className="changes">
              <div className="changes-head">
                <strong>{changesTitle || `本次修改了 ${changes.length} 处`}</strong>
                {canUndo ? (
                  <button type="button" className="link-btn" onClick={onUndo} disabled={busy}>
                    撤销
                  </button>
                ) : null}
              </div>
              <ul>
                {changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="tabs" role="tablist" data-active={tab === 'content' ? 0 : tab === 'style' ? 1 : 2}>
            <span className="tab-indicator" aria-hidden="true" />
            <button type="button" className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')} role="tab" aria-selected={tab === 'content'}>
              组件
            </button>
            <button type="button" className={tab === 'style' ? 'active' : ''} onClick={() => setTab('style')} role="tab" aria-selected={tab === 'style'}>
              风格
            </button>
            <button type="button" className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')} role="tab" aria-selected={tab === 'chat'}>
              对话
            </button>
          </div>

          <div className="tab-body">
            {tab === 'content' ? (
              <>
                <div className="block-head">
                  <h3>页面组件</h3>
                  <span>{page.blocks.length} 个</span>
                </div>
                <div className="block-list">
                  {page.blocks.map((block) => (
                    <div
                      key={block.id}
                      className={`block-row ${selectedId === block.id ? 'active' : ''}`}
                      onClick={() => setSelectedId(block.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedId(block.id)
                      }}
                    >
                      <span className="block-glyph">{BLOCK_GLYPHS[block.type]}</span>
                      <div className="block-meta">
                        <strong>{block.title || BLOCK_LABELS[block.type]}</strong>
                        <small>
                          {BLOCK_LABELS[block.type]}
                          {block.type === 'collection' ? ` · ${block.items?.length ?? 0} 条` : ''}
                        </small>
                      </div>
                      <div className="block-tools" onClick={(e) => e.stopPropagation()}>
                        <button type="button" aria-label="上移" onClick={() => moveBlock(block.id, -1)}>
                          ↑
                        </button>
                        <button type="button" aria-label="下移" onClick={() => moveBlock(block.id, 1)}>
                          ↓
                        </button>
                        <button type="button" aria-label="复制" onClick={() => duplicateBlock(block)}>
                          ⧉
                        </button>
                        <button type="button" aria-label="删除" className="danger" onClick={() => removeBlock(block)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" className="add-toggle" onClick={() => setAddOpen(!addOpen)}>
                  {addOpen ? '收起' : '＋ 添加组件'}
                </button>
                {addOpen ? (
                  <div className="add-grid">
                    {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
                      <button key={type} type="button" onClick={() => addBlock(type)}>
                        <span>{BLOCK_GLYPHS[type]}</span>
                        {BLOCK_LABELS[type]}
                      </button>
                    ))}
                  </div>
                ) : null}

                {selected ? (
                  <BlockForm
                    block={selected}
                    onChange={(patchValue) => updateBlock(selected.id, patchValue)}
                    onDuplicate={() => duplicateBlock(selected)}
                    onRemove={() => removeBlock(selected)}
                    onMakeCover={makeCover}
                    coverBusyKey={coverBusyKey}
                    coverError={coverError}
                  />
                ) : (
                  <p className="hint">点击页面组件开始编辑，或在右侧预览里点击任意区块。</p>
                )}
              </>
            ) : null}

            {tab === 'style' ? (
              <StylePanel
                page={page}
                onChange={(patchValue) => patch(patchValue, 'style:' + Object.keys(patchValue).join(','))}
              />
            ) : null}

            {tab === 'chat' ? <ChatPanel chat={chat} /> : null}
          </div>
        </aside>

        <section className="stage">
          <div className="stage-bar">
            <span>iPhone 17 Pro · 402 × 874</span>
            <div>
              <button type="button" className="link-btn" onClick={() => setFullscreen(true)}>
                全屏预览 ↗
              </button>
            </div>
          </div>
          <div className="phone-wrap">
            <div className="phone">
              <div className="phone-status" aria-hidden="true">
                <span className="phone-time">9:41</span>
                <span className="phone-island" />
                <span className="phone-icons">
                  <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
                    <rect x="0" y="7" width="3" height="4" rx="1" />
                    <rect x="4.5" y="5" width="3" height="6" rx="1" />
                    <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
                    <rect x="13.5" y="0" width="3" height="11" rx="1" />
                  </svg>
                  <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M1 3.4a10 10 0 0 1 14 0" />
                    <path d="M3.6 6a6.4 6.4 0 0 1 8.8 0" />
                    <circle cx="8" cy="9.2" r="1" fill="currentColor" stroke="none" />
                  </svg>
                  <svg width="25" height="12" viewBox="0 0 25 12" fill="none" stroke="currentColor">
                    <rect x="0.5" y="0.5" width="21" height="11" rx="3" opacity="0.45" />
                    <rect x="2" y="2" width="17" height="8" rx="1.5" fill="currentColor" stroke="none" />
                    <path d="M23 4v4a2 2 0 0 0 0-4Z" fill="currentColor" stroke="none" opacity="0.45" />
                  </svg>
                </span>
              </div>
              <PhonePreview
                page={page}
                selectedId={selectedId}
                onSelect={selectFromPreview}
                onWatch={setWatchUrl}
              />
              <span className="phone-home" aria-hidden="true" />
            </div>
          </div>
          <p className="stage-hint">点击预览中的任意区块，可直接定位到左侧编辑。</p>
        </section>
      </div>

      {watchUrl ? (
        <div className="watch-modal">
          <iframe className="watch-frame" src={watchUrl} allow="autoplay; fullscreen; encrypted-media" title="观看页" />
        </div>
      ) : null}

      {fullscreen ? (
        <div className="fullscreen">
          <div className="fullscreen-bar">
            <strong>{page.name}</strong>
            <button type="button" className="ghost-btn" onClick={() => setFullscreen(false)}>
              关闭预览
            </button>
          </div>
          <iframe className="fullscreen-frame" title="全屏预览" srcDoc={fullHtml} sandbox="allow-scripts" />
        </div>
      ) : null}

      {polyvOpen ? (
        <PolyvImport
          onClose={() => setPolyvOpen(false)}
          onPickLive={pickLive}
          onPickVod={pickVod}
          liveHint={polyvLiveHint}
          vodHint={polyvVodHint}
        />
      ) : null}
      {configured ? null : <span className="demo-flag">演示模式</span>}
    </div>
  )
}

interface BlockFormProps {
  block: Block
  onChange: (patch: Partial<Block>) => void
  onDuplicate: () => void
  onRemove: () => void
  onMakeCover: (block: Block, itemId?: string) => void
  coverBusyKey: string | null
  coverError: string
}

function BlockForm({ block, onChange, onDuplicate, onRemove, onMakeCover, coverBusyKey, coverError }: BlockFormProps) {
  const withItems =
    block.type === 'collection' ||
    block.type === 'speakers' ||
    block.type === 'timeline' ||
    block.type === 'stats' ||
    block.type === 'quicknav'
  const isSpeakers = block.type === 'speakers'
  const isTimeline = block.type === 'timeline'
  const isStats = block.type === 'stats'
  const isQuickNav = block.type === 'quicknav'
  const isCollection = block.type === 'collection'
  const hasLive = block.type === 'live' || block.type === 'reservation' || block.type === 'countdown'
  const hasUrl = block.type === 'live' || block.type === 'link'
  const reservationSource = block.sourceType ?? (block.channelId ? 'live' : block.vid ? 'vod' : block.url ? 'file' : 'none')

  function updateItem(id: string, patchValue: Partial<CollectionItem>) {
    onChange({ items: (block.items ?? []).map((item) => (item.id === id ? { ...item, ...patchValue } : item)) })
  }

  function addItem() {
    onChange({
      items: [
        ...(block.items ?? []),
        isSpeakers
          ? { id: uid('item'), title: '新讲师', subtitle: '头衔 / 机构', body: '' }
          : isTimeline
            ? { id: uid('item'), title: '新环节', time: '19:30', body: '' }
            : isStats
              ? { id: uid('item'), title: '10', subtitle: '说明' }
              : isQuickNav
                ? { id: uid('item'), title: '新栏目', icon: 'link', url: '' }
              : { id: uid('item'), title: '新视频', body: '', duration: '00:00' },
      ],
    })
  }

  function removeItem(id: string) {
    onChange({ items: (block.items ?? []).filter((item) => item.id !== id) })
  }

  function moveItem(id: string, direction: -1 | 1) {
    const items = [...(block.items ?? [])]
    const index = items.findIndex((item) => item.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    onChange({ items })
  }

  const uploadRef = useRef<HTMLInputElement>(null)
  const uploadTarget = useRef<string | null>(null)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')

  function pickCover(itemId?: string) {
    uploadTarget.current = itemId ?? null
    uploadRef.current?.click()
  }

  async function applyCover(file: File, itemId?: string) {
    const key = itemId ?? block.id
    setUploadingKey(key)
    setUploadError('')
    try {
      const data = await fileToImage(file, 1280, 0.85)
      if (itemId) {
        onChange({
          items: (block.items ?? []).map((entry) =>
            entry.id === itemId ? { ...entry, cover: data } : entry,
          ),
        })
      } else {
        onChange({ cover: data })
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '图片上传失败，请重试。')
    } finally {
      setUploadingKey(null)
    }
  }

  async function onUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const target = uploadTarget.current
    event.target.value = ''
    if (!file) return
    await applyCover(file, target ?? undefined)
  }

  return (
    <div className="block-form">
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="is-hidden"
        onChange={onUploadFile}
      />
      <div className="form-head">
        <h3>编辑「{block.title || BLOCK_LABELS[block.type]}」</h3>
        <div>
          <button type="button" className="link-btn" onClick={onDuplicate}>
            复制
          </button>
          <button type="button" className="link-btn danger" onClick={onRemove}>
            删除
          </button>
        </div>
      </div>

      {block.channelId ? (
        <p className="polyv-hint">
          保利威频道 <code>{block.channelId}</code>
          <a
            href={`/watch?type=live&channelId=${encodeURIComponent(block.channelId)}&title=${encodeURIComponent(block.title)}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            打开观看页 ↗
          </a>
        </p>
      ) : null}

      <label className="field">
        <span>{block.type === 'hero' ? '主标题' : '标题'}</span>
        <input value={block.title} maxLength={60} onChange={(e) => onChange({ title: e.target.value })} />
      </label>

      {block.type === 'hero' ? (
        <label className="field">
          <span>上方短标题</span>
          <input value={block.eyebrow ?? ''} maxLength={40} onChange={(e) => onChange({ eyebrow: e.target.value })} />
        </label>
      ) : null}

      {['hero', 'live', 'reservation', 'countdown'].includes(block.type) ? (
        <div className="cover-field">
          <span>{block.type === 'hero' ? '封面图' : '直播封面'}</span>
          <div
            className="cover-preview"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const file = event.dataTransfer.files?.[0]
              if (file) void applyCover(file)
            }}
          >
            {block.cover ? <img src={block.cover} alt="封面预览" /> : <span className="cover-empty">渐变占位</span>}
            {coverBusyKey === block.id ? (
              <span className="cover-loading">
                <span className="cover-spinner" aria-hidden="true" />
                <b>AI 正在生成封面</b>
                <small>约 15–30 秒</small>
              </span>
            ) : null}
            {uploadingKey === block.id ? (
              <span className="cover-loading mini">
                <span className="cover-spinner" aria-hidden="true" />
                <b>正在处理图片</b>
              </span>
            ) : null}
          </div>
          <div className="cover-actions">
            <button
              type="button"
              className="mini-btn"
              disabled={coverBusyKey === block.id || uploadingKey === block.id}
              onClick={() => pickCover()}
            >
              上传图片
            </button>
            <button
              type="button"
              className="mini-btn"
              disabled={coverBusyKey === block.id || uploadingKey === block.id}
              onClick={() => onMakeCover(block)}
            >
              {coverBusyKey === block.id ? '生成中…' : block.cover ? 'AI 重生成' : 'AI 生成'}
            </button>
            {block.cover ? (
              <button type="button" className="link-btn" onClick={() => onChange({ cover: '' })}>
                移除
              </button>
            ) : null}
            {coverBusyKey === block.id ? (
              <span className="cover-status">
                <i /> AI 正在生成，请稍候…
              </span>
            ) : null}
          </div>
          {uploadError ? <p className="form-error">{uploadError}</p> : null}
        </div>
      ) : null}

      <label className="field">
        <span>说明文字</span>
        <textarea value={block.body ?? ''} rows={3} maxLength={600} onChange={(e) => onChange({ body: e.target.value })} />
      </label>

      {block.type === 'hero' ? (
        <label className="field">
          <span>标签（逗号分隔）</span>
          <input
            value={(block.tags ?? []).join('，')}
            onChange={(e) =>
              onChange({
                tags: e.target.value
                  .split(/[，,]/)
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .slice(0, 6),
              })
            }
          />
        </label>
      ) : null}

      {hasLive ? (
        <>
          <label className="field">
            <span>主讲 / 主播</span>
            <input value={block.speaker ?? ''} maxLength={60} onChange={(e) => onChange({ speaker: e.target.value })} />
          </label>
          {block.type === 'reservation' ? (
            <>
              <label className="field">
                <span>内容来源</span>
                <select
                  value={reservationSource}
                  onChange={(event) => {
                    const next = event.target.value
                    if (next === 'live') onChange({ sourceType: 'live', channelId: block.channelId ?? '', vid: '', url: '' })
                    else if (next === 'vod') onChange({ sourceType: 'vod', vid: block.vid ?? '', channelId: '', url: '' })
                    else if (next === 'file') onChange({ sourceType: 'file', url: block.url ?? '', channelId: '', vid: '' })
                    else onChange({ sourceType: 'none', channelId: '', vid: '', url: '' })
                  }}
                >
                  <option value="none">不跳转，仅展示</option>
                  <option value="live">直播频道</option>
                  <option value="vod">保利威点播</option>
                  <option value="file">视频链接</option>
                </select>
              </label>
              {reservationSource === 'live' ? (
                <label className="field">
                  <span>直播频道号</span>
                  <input
                    value={block.channelId ?? ''}
                    placeholder="例如 8659097"
                    onChange={(ev) => onChange({ channelId: ev.target.value.replace(/\D/g, '').slice(0, 12) })}
                  />
                  <small className="field-hint">填写后，点击封面上的播放按钮会进入直播观看页。</small>
                </label>
              ) : null}
              {reservationSource === 'vod' ? (
                <label className="field">
                  <span>点播 VID</span>
                  <input
                    value={block.vid ?? ''}
                    placeholder="从保利威点播导入后自动填写"
                    onChange={(ev) => onChange({ vid: ev.target.value.trim().slice(0, 100) })}
                  />
                  <small className="field-hint">填写后，点击播放按钮会进入点播观看页。</small>
                </label>
              ) : null}
              {reservationSource === 'file' ? (
                <label className="field">
                  <span>视频链接</span>
                  <input
                    value={block.url ?? ''}
                    placeholder="https://…mp4 或 /media/demo.mp4"
                    onChange={(ev) => onChange({ url: ev.target.value.trim() })}
                  />
                  <small className="field-hint">支持 MP4 直链；点击播放按钮会进入视频观看页。</small>
                </label>
              ) : null}
            </>
          ) : (
            <label className="field">
              <span>直播频道（可选）</span>
              <input
                value={block.channelId ?? ''}
                placeholder="从保利威导入后自动填写"
                onChange={(ev) => onChange({ channelId: ev.target.value.replace(/\D/g, '').slice(0, 12) })}
              />
              <small className="field-hint">一般不需要手动填写；从保利威导入直播时会自动带过来。</small>
            </label>
          )}
          <label className="check-row">
            <input
              type="checkbox"
              checked={block.showBadge !== false}
              onChange={(event) => onChange({ showBadge: event.target.checked })}
            />
            <span>显示左上角标签</span>
          </label>
          <label className="field">
            <span>开播 / 目标时间</span>
            <input
              type="datetime-local"
              value={block.liveAt ?? ''}
              onChange={(e) => onChange({ liveAt: e.target.value })}
            />
          </label>
          <label className="field">
            <span>按钮文案</span>
            <input
              value={block.ctaLabel ?? ''}
              placeholder={block.type === 'countdown' ? '留空则只显示倒计时' : '观看直播 / 立即预约'}
              maxLength={20}
              onChange={(e) => onChange({ ctaLabel: e.target.value })}
            />
          </label>
          {block.type === 'countdown' ? (
            <label className="field">
              <span>倒计时文案</span>
              <input
                value={block.countdownLabel ?? ''}
                placeholder="距开播 / 距结束 / 距双11开抢"
                maxLength={20}
                onChange={(e) => onChange({ countdownLabel: e.target.value })}
              />
            </label>
          ) : null}
          <div className="metric-config">
            <span className="metric-title">互动数据</span>
            <div className="metric-grid">
              <label className="field">
                <span>在看人数</span>
                <input
                  inputMode="numeric"
                  value={block.viewers ?? ''}
                  placeholder="例如 12800"
                  maxLength={12}
                  onChange={(e) => onChange({ viewers: e.target.value.replace(/[^\d]/g, '') })}
                />
              </label>
              <label className="field">
                <span>发布时间</span>
                <input
                  type="date"
                  value={(block.publishedAt ?? '').slice(0, 10)}
                  onChange={(e) => onChange({ publishedAt: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>内容标签（最多 2 个，每个 6 字）</span>
              <input
                value={(block.tags ?? []).slice(0, 2).join('，')}
                placeholder="例如 公开课，可回看"
                onChange={(e) =>
                  onChange({
                    tags: e.target.value
                      .split(/[，,]/)
                      .map((tag) => tag.trim().slice(0, 6))
                      .filter(Boolean)
                      .slice(0, 2),
                  })
                }
              />
            </label>
            <div className="metric-toggles">
              <label>
                <input
                  type="checkbox"
                  checked={block.showViewers !== false}
                  onChange={(e) => onChange({ showViewers: e.target.checked })}
                />
                显示在看人数
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={block.showPublishedAt !== false}
                  onChange={(e) => onChange({ showPublishedAt: e.target.checked })}
                />
                显示发布时间
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={block.showTags !== false}
                  onChange={(e) => onChange({ showTags: e.target.checked })}
                />
                显示内容标签
              </label>
            </div>
          </div>
        </>
      ) : null}

      {hasUrl ? (
        <label className="field">
          <span>直播 / 链接地址（http/https）</span>
          <input
            type="url"
            value={block.url ?? ''}
            placeholder="留空则显示为待补充"
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </label>
      ) : null}

      {withItems ? (
        <>
          {isQuickNav ? (
            <label className="field">
              <span>金刚位样式</span>
              <select
                value={block.navStyle ?? 'grid'}
                onChange={(e) => onChange({ navStyle: e.target.value as Block['navStyle'] })}
              >
                <option value="grid">图标网格</option>
                <option value="pills">横向胶囊</option>
                <option value="bento">大小卡混合</option>
              </select>
            </label>
          ) : null}
          <label className={isStats || isQuickNav ? 'field is-hidden' : 'field'}>
            <span>{isTimeline ? '排版（时间线不使用）' : isSpeakers ? '讲师排布' : '合集排版'}</span>
            <select value={block.layout ?? 'double'} disabled={isTimeline} onChange={(e) => onChange({ layout: e.target.value as Block['layout'] })}>
              <option value="single">单列图文</option>
              <option value="double">双列卡片</option>
              <option value="masonry">瀑布流</option>
              <option value="sale">促销列表（价格 + 抢购）</option>
              <option value="triple">三列小卡</option>
            </select>
          </label>
          {isCollection ? (
            <div className="metric-config">
              <span className="metric-title">互动数据</span>
              <div className="metric-toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={block.showPlays !== false}
                    onChange={(e) => onChange({ showPlays: e.target.checked })}
                  />
                  显示播放量
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={block.showDuration !== false}
                    onChange={(e) => onChange({ showDuration: e.target.checked })}
                  />
                  显示视频时长
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={block.showPublishedAt !== false}
                    onChange={(e) => onChange({ showPublishedAt: e.target.checked })}
                  />
                  显示发布时间
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={block.showTags !== false}
                    onChange={(e) => onChange({ showTags: e.target.checked })}
                  />
                  显示内容标签
                </label>
              </div>
            </div>
          ) : null}
          <div className="items-editor">
            <div className="form-head">
              <h3>{isSpeakers ? '讲师' : isTimeline ? '流程环节' : isStats ? '数据项' : isQuickNav ? '栏目' : '合集内容'} · {block.items?.length ?? 0}</h3>
              <button type="button" className="link-btn" onClick={addItem}>
                {isSpeakers ? '＋ 添加讲师' : isTimeline ? '＋ 添加环节' : isStats ? '＋ 添加数据' : isQuickNav ? '＋ 添加栏目' : '＋ 添加视频'}
              </button>
            </div>
            {coverError ? <p className="form-error">{coverError}</p> : null}
            {(block.items ?? []).map((item) => (
              <div className="item-editor" key={item.id}>
                <div className="item-editor-head">
                  <input value={item.title} maxLength={80} placeholder={isSpeakers ? '讲师姓名' : isTimeline ? '环节名称' : isStats ? '数值，如 10' : isQuickNav ? '栏目名称' : '视频标题'} onChange={(e) => updateItem(item.id, { title: e.target.value })} />
                  <div className="item-tools">
                    <button type="button" onClick={() => moveItem(item.id, -1)} aria-label="上移">
                      ↑
                    </button>
                    <button type="button" onClick={() => moveItem(item.id, 1)} aria-label="下移">
                      ↓
                    </button>
                    <button type="button" className="danger" onClick={() => removeItem(item.id)} aria-label="删除">
                      ✕
                    </button>
                  </div>
                </div>
                {isQuickNav ? (
                  <div className="quicknav-fields">
                    <select
                      value={item.icon ?? 'link'}
                      onChange={(e) => updateItem(item.id, { icon: e.target.value })}
                      aria-label="栏目图标"
                    >
                      <option value="live">直播</option>
                      <option value="course">课程</option>
                      <option value="expert">专家</option>
                      <option value="calendar">日历</option>
                      <option value="replay">回放</option>
                      <option value="check">任务</option>
                      <option value="chart">榜单</option>
                      <option value="ticket">领券</option>
                      <option value="gift">礼品</option>
                      <option value="quote">金句</option>
                      <option value="bell">提醒</option>
                      <option value="link">链接</option>
                    </select>
                    <input
                      value={item.url ?? ''}
                      placeholder="跳转链接（可选）"
                      maxLength={500}
                      onChange={(e) => updateItem(item.id, { url: e.target.value.trim() })}
                    />
                  </div>
                ) : null}
                {isSpeakers || isStats ? (
                  <input
                    className="item-subtitle-input"
                    value={item.subtitle ?? ''}
                    placeholder={isStats ? '说明，如 我的积分' : '头衔 / 机构'}
                    maxLength={60}
                    onChange={(e) => updateItem(item.id, { subtitle: e.target.value })}
                  />
                ) : null}
                <div className={isTimeline || isStats || isQuickNav ? 'item-cover-row is-hidden' : 'item-cover-row'}>
                  <span
                    className="item-cover-thumb"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      const file = event.dataTransfer.files?.[0]
                      if (file) void applyCover(file, item.id)
                    }}
                  >
                    {item.cover ? <img src={item.cover} alt="条目封面" /> : null}
                    {coverBusyKey === item.id ? (
                      <span className="cover-loading mini">
                        <span className="cover-spinner" aria-hidden="true" />
                      </span>
                    ) : null}
                    {uploadingKey === item.id ? (
                      <span className="cover-loading mini">
                        <span className="cover-spinner" aria-hidden="true" />
                      </span>
                    ) : null}
                  </span>
                  {item.vid ? (
                    <code className="polyv-vid" title={item.vid}>
                      保利威视频
                    </code>
                  ) : null}
                  <button
                    type="button"
                    className="mini-btn"
                    disabled={coverBusyKey === item.id || uploadingKey === item.id}
                    onClick={() => pickCover(item.id)}
                  >
                    上传{isSpeakers ? '头像' : '封面'}
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    disabled={coverBusyKey === item.id || uploadingKey === item.id}
                    onClick={() => onMakeCover(block, item.id)}
                  >
                    {coverBusyKey === item.id ? '生成中…' : item.cover ? 'AI 重生成' : isSpeakers ? 'AI 头像' : 'AI 封面'}
                  </button>
                  {item.cover ? (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => updateItem(item.id, { cover: '' })}
                    >
                      移除
                    </button>
                  ) : null}
                  {coverBusyKey === item.id ? (
                    <span className="cover-status">
                      <i /> AI 生成中
                    </span>
                  ) : null}
                </div>
                {uploadError ? <p className="form-error">{uploadError}</p> : null}
                {isStats || isQuickNav ? null : (
                  <>
                    <div className="item-editor-body">
                      <input
                        className="duration-input"
                        value={isTimeline ? item.time ?? '' : item.duration ?? ''}
                        placeholder={isTimeline ? '时间' : '时长'}
                        maxLength={20}
                        onChange={(e) =>
                          updateItem(item.id, isTimeline ? { time: e.target.value } : { duration: e.target.value })
                        }
                      />
                      <input
                        value={item.body ?? ''}
                        placeholder={isTimeline ? '环节说明' : '一句说明（可选）'}
                        maxLength={300}
                        onChange={(e) => updateItem(item.id, { body: e.target.value })}
                      />
                    </div>
                    {isCollection ? (
                      <>
                        <div className="item-price-row">
                          <input
                            value={item.price ?? ''}
                            placeholder="秒杀价（数字）"
                            maxLength={12}
                            onChange={(e) => updateItem(item.id, { price: e.target.value })}
                          />
                          <input
                            value={item.originalPrice ?? ''}
                            placeholder="原价（数字）"
                            maxLength={12}
                            onChange={(e) => updateItem(item.id, { originalPrice: e.target.value })}
                          />
                        </div>
                        <div className="item-price-row">
                          <input
                            value={item.badge ?? ''}
                            placeholder="标签，如 秒杀价"
                            maxLength={12}
                            onChange={(e) => updateItem(item.id, { badge: e.target.value })}
                          />
                          <input
                            value={item.cta ?? ''}
                            placeholder="按钮文案，如 抢"
                            maxLength={12}
                            onChange={(e) => updateItem(item.id, { cta: e.target.value })}
                          />
                        </div>
                      </>
                    ) : null}
                    {isCollection ? (
                      <>
                        <div className="item-price-row">
                          <input
                            inputMode="numeric"
                            value={item.plays ?? ''}
                            placeholder="播放量（数字）"
                            maxLength={12}
                            onChange={(e) =>
                              updateItem(item.id, { plays: e.target.value.replace(/[^\d]/g, '') })
                            }
                          />
                          <input
                            type="date"
                            value={(item.publishedAt ?? '').slice(0, 10)}
                            onChange={(e) => updateItem(item.id, { publishedAt: e.target.value })}
                          />
                        </div>
                        <input
                          className="item-subtitle-input"
                          value={(item.tags ?? []).slice(0, 2).join('，')}
                          placeholder="内容标签，最多 2 个，用逗号分隔"
                          onChange={(e) =>
                            updateItem(item.id, {
                              tags: e.target.value
                                .split(/[，,]/)
                                .map((tag) => tag.trim().slice(0, 6))
                                .filter(Boolean)
                                .slice(0, 2),
                            })
                          }
                        />
                      </>
                    ) : null}
                    {isSpeakers || isStats || isQuickNav ? null : item.vid ? (
                      <div className="video-source-linked">
                        <div>
                          <strong>已关联保利威视频</strong>
                          <small>从保利威导入时自动关联，不需要填写编号。</small>
                        </div>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => updateItem(item.id, { vid: '' })}
                        >
                          解除
                        </button>
                      </div>
                    ) : (
                      <div className="item-vid-row">
                        <input
                          value={item.url ?? ''}
                          placeholder="MP4 视频链接（可选）"
                          maxLength={500}
                          onChange={(ev) => updateItem(item.id, { url: ev.target.value.trim() })}
                        />
                        <small>没有关联保利威视频时，可以粘贴一个公开的 MP4 链接。</small>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

interface StylePanelProps {
  page: Page
  onChange: (patch: Partial<Page>) => void
}

function StylePanel({ page, onChange }: StylePanelProps) {
  const bgInput = useRef<HTMLInputElement>(null)
  const [bgBusy, setBgBusy] = useState(false)
  const [bgError, setBgError] = useState('')

  async function onBackgroundFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBgBusy(true)
    setBgError('')
    try {
      const data = await fileToImage(file, 1600, 0.82)
      onChange({ backgroundImage: data, backgroundOpacity: page.backgroundOpacity ?? 0.12 })
    } catch (error) {
      setBgError(error instanceof Error ? error.message : '背景图上传失败。')
    } finally {
      setBgBusy(false)
    }
  }

  return (
    <div className="style-panel">
      <div className="form-head">
        <h3>配色与文字</h3>
      </div>
      <div className="preset-row">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="preset"
            onClick={() => onChange({ theme: { ...preset.theme } })}
          >
            <span className="preset-dots">
              <i style={{ background: preset.theme.background }} />
              <i style={{ background: preset.theme.accent }} />
              <i style={{ background: preset.theme.soft }} />
            </span>
            {preset.name}
          </button>
        ))}
      </div>

      <div className="bg-field">
        <div className="bg-field-head">
          <h3>页面背景</h3>
          {page.backgroundImage ? (
            <button type="button" className="link-btn" onClick={() => onChange({ backgroundImage: '' })}>
              移除
            </button>
          ) : null}
        </div>
        <div
          className={`bg-preview${page.backgroundImage ? '' : ' is-empty'}`}
          style={page.backgroundImage ? { backgroundImage: `url(${page.backgroundImage})` } : undefined}
        >
          {page.backgroundImage ? null : <span>没有背景图</span>}
        </div>
        <div className="bg-actions">
          <button
            type="button"
            className="mini-btn"
            disabled={bgBusy}
            onClick={() => bgInput.current?.click()}
          >
            {bgBusy ? '处理中…' : '上传背景图'}
          </button>
          <input
            ref={bgInput}
            type="file"
            accept="image/*"
            className="is-hidden"
            onChange={onBackgroundFile}
          />
        </div>
        {page.backgroundImage ? (
          <Slider
            label="背景强度"
            value={Math.round((page.backgroundOpacity ?? 0.12) * 100)}
            min={0}
            max={40}
            unit="%"
            onChange={(value) => onChange({ backgroundOpacity: value / 100 })}
          />
        ) : null}
        {bgError ? <p className="form-error">{bgError}</p> : null}
      </div>

      {COLOR_LABELS.map(({ key, label }) => (
        <label className="color-row" key={key}>
          <input
            type="color"
            value={page.theme[key]}
            onChange={(e) => onChange({ theme: { ...page.theme, [key]: e.target.value } })}
            aria-label={label}
          />
          <span>{label}</span>
          <code>{page.theme[key]}</code>
        </label>
      ))}

      <div className="form-head">
        <h3>字体与间距</h3>
      </div>
      <div className="segmented">
        {(['sans', 'serif', 'round'] as const).map((font) => (
          <button
            key={font}
            type="button"
            className={page.font === font ? 'active' : ''}
            onClick={() => onChange({ font })}
          >
            {font === 'sans' ? '无衬线' : font === 'serif' ? '衬线' : '圆体'}
          </button>
        ))}
      </div>

      <Slider label="卡片圆角" value={page.radius} min={0} max={32} unit="px" onChange={(radius) => onChange({ radius })} />
      <Slider label="页面边距" value={page.padding} min={8} max={40} unit="px" onChange={(padding) => onChange({ padding })} />
      <Slider label="组件间距" value={page.gap} min={8} max={48} unit="px" onChange={(gap) => onChange({ gap })} />
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (value: number) => void
}) {
  return (
    <label className="slider">
      <span>
        {label}
        <b>
          {value}
          {unit}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
      />
    </label>
  )
}

function ChatPanel({ chat }: { chat: ChatMessage[] }) {
  if (!chat.length) {
    return (
      <div className="chat-panel">
        <p className="hint">
          对话会记录每一次 AI 生成与修改。你可以直接说「把主标题改短」「加一个预约直播」「换成浅色」。
        </p>
      </div>
    )
  }
  return (
    <div className="chat-panel">
      {chat.map((message) => (
        <div key={message.id} className={`chat-message ${message.role}`}>
          <span className="chat-role">{message.role === 'user' ? '你' : 'AI'}</span>
          <p>{message.text}</p>
        </div>
      ))}
    </div>
  )
}
