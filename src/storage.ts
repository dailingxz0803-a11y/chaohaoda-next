import type { Page } from './types'

const PAGES_KEY = 'chaohaoda-next:pages'
const CURRENT_KEY = 'chaohaoda-next:current'
const DB_NAME = 'chaohaoda-next'
const DB_STORE = 'state'
const DB_PAGES_KEY = 'pages'

let dbPromise: Promise<IDBDatabase> | null = null

function isPage(value: unknown): value is Page {
  if (!value || typeof value !== 'object') return false
  const page = value as Page
  return typeof page.id === 'string' && typeof page.name === 'string' && Array.isArray(page.blocks) && !!page.theme
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
  })
  return dbPromise
}

async function readDB(): Promise<Page[] | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const request = tx.objectStore(DB_STORE).get(DB_PAGES_KEY)
    request.onsuccess = () => {
      const value = request.result
      resolve(Array.isArray(value) ? value.filter(isPage) : null)
    }
    request.onerror = () => reject(request.error)
  })
}

async function writeDB(pages: Page[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(pages, DB_PAGES_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 去掉体积很大的本地图片，只作为 localStorage 兜底 */
function stripLargeMedia(pages: Page[]): Page[] {
  const isInline = (value?: string) => typeof value === 'string' && value.startsWith('data:image/')
  return pages.map((page) => ({
    ...page,
    backgroundImage: isInline(page.backgroundImage) ? '' : page.backgroundImage,
    blocks: page.blocks.map((block) => ({
      ...block,
      cover: isInline(block.cover) ? '' : block.cover,
      items: block.items?.map((item) => ({
        ...item,
        cover: isInline(item.cover) ? '' : item.cover,
      })),
    })),
  }))
}

export function loadPages(): Page[] {
  try {
    const raw = localStorage.getItem(PAGES_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isPage) : []
  } catch {
    return []
  }
}

/** 优先从 IndexedDB 读取完整页面（含本地图片），失败再退回 localStorage */
export async function loadPagesAsync(): Promise<Page[]> {
  try {
    const saved = await readDB()
    if (saved !== null) return saved
  } catch {
    /* fall through */
  }
  return loadPages()
}

export function persistPages(pages: Page[]): void {
  const next = pages.slice(0, 30)
  void writeDB(next).catch(() => {
    /* IndexedDB 不可用时继续用 localStorage */
  })
  try {
    localStorage.setItem(PAGES_KEY, JSON.stringify(next))
  } catch {
    try {
      localStorage.setItem(PAGES_KEY, JSON.stringify(stripLargeMedia(next)))
    } catch {
      /* 容量不足时忽略 */
    }
  }
}

export function loadCurrentId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY)
  } catch {
    return null
  }
}

export function saveCurrentId(id: string | null): void {
  try {
    if (id) localStorage.setItem(CURRENT_KEY, id)
    else localStorage.removeItem(CURRENT_KEY)
  } catch {
    /* 忽略 */
  }
}
