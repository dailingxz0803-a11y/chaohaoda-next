import { useEffect, useRef, useState } from 'react'
import type { AIStatus, ChatMessage, Page, ShareResult } from './types'
import { uid } from './lib'
import { makePage } from './templates'
import { describeChanges } from './diff'
import { aiGenerate, downloadHTML, getAIStatus, publishPage } from './api'
import { loadPages, loadPagesAsync, persistPages } from './storage'
import { applyReferenceAssets, hydratePageAssets } from './image'
import { buildAssetTargets, generateAsset } from './assets'
import { renderPageHTML } from './render'
import { Home } from './components/Home'
import { Editor } from './components/Editor'
import { ShareDialog } from './components/ShareDialog'
import { GeneratingOverlay } from './components/GeneratingOverlay'

function aiMessage(text: string): ChatMessage {
  return { id: uid('msg'), role: 'ai', text, at: Date.now() }
}

function userMessage(text: string): ChatMessage {
  return { id: uid('msg'), role: 'user', text, at: Date.now() }
}

export default function App() {
  const [pages, setPages] = useState<Page[]>(loadPages)
  const [page, setPage] = useState<Page | null>(null)
  const [status, setStatus] = useState<AIStatus>({ configured: false, model: 'qwen-plus', provider: 'qwen' })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [changes, setChanges] = useState<string[]>([])
  const [changesTitle, setChangesTitle] = useState('')
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<Page[]>([])
  const [future, setFuture] = useState<Page[]>([])
  const lastCommit = useRef<{ key: string; at: number }>({ key: '', at: 0 })
  const [share, setShare] = useState<ShareResult | null>(null)
  const [sharing, setSharing] = useState(false)
  const [toast, setToast] = useState('')
  const createAbort = useRef<AbortController | null>(null)
  const [assetBusy, setAssetBusy] = useState(false)
  const [assetProgress, setAssetProgress] = useState('')
  const assetToken = useRef(0)

  useEffect(() => {
    getAIStatus()
      .then(setStatus)
      .catch(() => setStatus({ configured: false, model: 'demo', provider: 'qwen' }))
  }, [])

  useEffect(() => {
    let alive = true
    loadPagesAsync()
      .then((saved) => {
        if (!alive) return
        setPages(saved)
        if (saved.length) persistPages(saved)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!page) return
    const timer = window.setTimeout(() => {
      setPages((previous) => {
        const next = [page, ...previous.filter((item) => item.id !== page.id)]
        persistPages(next)
        return next
      })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [page])

  async function generatePageAssets(snapshot: Page, styleNote: string, token: number) {
    const targets = buildAssetTargets(snapshot, styleNote)
    if (!targets.length) return
    setAssetBusy(true)
    setAssetProgress(`0 / ${targets.length}`)
    let done = 0
    let success = 0

    await Promise.all(
      targets.map(async (target) => {
        try {
          const image = await generateAsset(target)
          if (assetToken.current !== token) return
          setPage((current) => {
            if (!current || current.id !== snapshot.id) return current
            const block = current.blocks.find((item) => item.id === target.blockId)
            if (!block) return current
            if (target.itemId) {
              const item = block.items?.find((entry) => entry.id === target.itemId)
              if (!item || (item.cover ?? '') !== target.initialCover) return current
              return {
                ...current,
                blocks: current.blocks.map((entry) =>
                  entry.id === block.id
                    ? {
                        ...entry,
                        items: entry.items?.map((row) =>
                          row.id === target.itemId ? { ...row, cover: image } : row,
                        ),
                      }
                    : entry,
                ),
              }
            }
            if ((block.cover ?? '') !== target.initialCover) return current
            return {
              ...current,
              blocks: current.blocks.map((entry) =>
                entry.id === block.id ? { ...entry, cover: image } : entry,
              ),
            }
          })
          success += 1
        } catch {
          /* 单张失败不影响其他配图 */
        }
        done += 1
        if (assetToken.current === token) setAssetProgress(`${done} / ${targets.length}`)
      }),
    )

    if (assetToken.current !== token) return
    setAssetBusy(false)
    setAssetProgress('')
    setToast(
      success
        ? `已为页面生成 ${success} 张配图`
        : '配图生成失败，可在封面处手动上传或重新生成',
    )
  }

  function cancelAssets() {
    assetToken.current += 1
    setAssetBusy(false)
    setAssetProgress('')
    setToast('已停止生成配图')
  }

  async function create(prompt: string, image: string | null) {
    if (busy) return
    const controller = new AbortController()
    createAbort.current = controller
    setBusy(true)
    setProgress('AI 正在规划结构、文案与配色，通常需要几十秒…')
    setChanges([])
    resetHistory()
    try {
      const result = await aiGenerate({ mode: 'create', prompt, image, signal: controller.signal })
      const nextPage = image ? await applyReferenceAssets(result.page, image).catch(() => result.page) : result.page
      setPage(nextPage)
      if (!result.demo) {
        const assetRun = ++assetToken.current
        void generatePageAssets(nextPage, result.reference?.mood ?? '', assetRun)
      }
      setChanges(describeChanges(null, nextPage))
      setChangesTitle('页面已生成')
      setChat([userMessage(prompt), aiMessage(result.summary)])
      setProgress('')
      if (result.demo) setToast('当前未配置千问，已生成演示结构')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setToast('已取消生成，页面未改变。')
      } else {
        setToast(error instanceof Error ? error.message : '生成失败，请重试。')
      }
    } finally {
      createAbort.current = null
      setBusy(false)
      setProgress('')
    }
  }

  function cancelCreate() {
    createAbort.current?.abort()
  }

  async function edit(prompt: string, selectedId: string | null, image: string | null) {
    if (!page || busy) return
    const snapshot = page
    setBusy(true)
    setProgress('AI 正在理解修改要求并调整页面…')
    try {
      const result = await aiGenerate({ mode: 'edit', prompt, page: snapshot, selectedId, image })
      const diff = describeChanges(snapshot, result.page)
      setChat((previous) => [...previous, userMessage(prompt), aiMessage(result.summary)])
      if (!diff.length) {
        setToast('当前内容已经是这个设置，没有产生新的变化。')
        return
      }
      setPage(result.page)
      pushHistory(snapshot)
      setChanges(diff)
      setChangesTitle(`本次修改了 ${diff.length} 处`)
      setToast(`已应用 ${diff.length} 处修改`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : '修改失败，页面未改变。')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  function resetHistory() {
    setHistory([])
    setFuture([])
    lastCommit.current = { key: '', at: 0 }
  }

  function pushHistory(snapshot: Page) {
    setHistory((previous) => [...previous.slice(-59), snapshot])
    setFuture([])
    lastCommit.current = { key: '', at: 0 }
  }

  function updatePage(next: Page, key?: string) {
    if (!page) return
    if (JSON.stringify(next) === JSON.stringify(page)) return
    const now = Date.now()
    const coalesce = Boolean(key) && lastCommit.current.key === key && now - lastCommit.current.at < 700
    if (!coalesce) {
      setHistory((previous) => [...previous.slice(-59), page])
      setFuture([])
    }
    lastCommit.current = { key: key ?? '', at: now }
    setPage(next)
  }

  function undo() {
    if (busy || !history.length) return
    const previous = history[history.length - 1]
    setHistory((items) => items.slice(0, -1))
    setFuture((items) => [page as Page, ...items].slice(0, 60))
    setPage(previous)
    setChanges([])
    setChangesTitle('')
    setToast('已撤销上一步操作。')
  }

  function redo() {
    if (busy || !future.length) return
    const next = future[0]
    setFuture((items) => items.slice(1))
    setHistory((items) => [...items.slice(-59), page as Page])
    setPage(next)
    setChanges([])
    setChangesTitle('')
    setToast('已重做。')
  }

  async function openTemplate(templateId: string) {
    const page = makePage(templateId)
    const hydrated = await hydratePageAssets(page).catch(() => page)
    setPage(hydrated)
    setChanges([])
    setChangesTitle('')
    setChat([])
    resetHistory()
  }

  function openPage(pageId: string) {
    const found = pages.find((item) => item.id === pageId)
    if (!found) return
    setPage(found)
    setChanges([])
    setChangesTitle('')
    setChat([])
    resetHistory()
  }

  function removePage(pageId: string) {
    const target = pages.find((item) => item.id === pageId)
    if (!target) return
    if (!window.confirm(`删除「${target.name}」？此操作不可恢复。`)) return
    const next = pages.filter((item) => item.id !== pageId)
    setPages(next)
    persistPages(next)
    if (page?.id === pageId) setPage(null)
    setToast('页面已删除')
  }

  function exportPage() {
    if (!page) return
    downloadHTML(renderPageHTML(page), page.name || 'chaohaoda')
    setToast('已导出独立 HTML 文件')
  }

  async function sharePage() {
    if (!page || sharing) return
    setSharing(true)
    try {
      const result = await publishPage(renderPageHTML(page), page.name)
      setShare(result)
    } catch (error) {
      setToast(error instanceof Error ? error.message : '分享失败，请重试。')
    } finally {
      setSharing(false)
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!page) return
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (page) {
    return (
      <>
        <Editor
          page={page}
          configured={status.configured}
          model={status.model}
          busy={busy}
          progress={progress}
          changes={changes}
          changesTitle={changesTitle}
          chat={chat}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          onUpdate={updatePage}
          onEdit={edit}
          onUndo={undo}
          onRedo={redo}
          onBack={() => {
            setPage(null)
            setChanges([])
            setChangesTitle('')
            resetHistory()
          }}
          onExport={exportPage}
          onShare={sharePage}
          assetBusy={assetBusy}
          assetProgress={assetProgress}
          onCancelAssets={cancelAssets}
        />
        {share || sharing ? (
          <ShareDialog
            share={share}
            loading={sharing}
            pageName={page.name}
            onClose={() => {
              setShare(null)
              setSharing(false)
            }}
          />
        ) : null}
        {toast ? <div className="toast">{toast}</div> : null}
      </>
    )
  }

  return (
    <>
      <Home
        pages={pages}
        configured={status.configured}
        model={status.model}
        busy={busy}
        progress={progress}
        onCreate={create}
        onTemplate={openTemplate}
        onOpen={openPage}
        onDelete={removePage}
      />
      {toast ? <div className="toast">{toast}</div> : null}
      {busy ? <GeneratingOverlay mode="create" onCancel={cancelCreate} /> : null}
    </>
  )
}
