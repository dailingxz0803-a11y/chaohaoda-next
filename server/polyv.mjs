import { createHash } from 'node:crypto'

function conf() {
  return {
    liveAppId: process.env.POLYV_LIVE_APP_ID || '',
    liveAppSecret: process.env.POLYV_LIVE_APP_SECRET || '',
    vodUserId: process.env.POLYV_VOD_USER_ID || process.env.POLYV_USER_ID || '',
    vodSecretKey: process.env.POLYV_VOD_SECRET_KEY || '',
    userId: process.env.POLYV_USER_ID || process.env.POLYV_VOD_USER_ID || '',
  }
}

const LIVE_ENDPOINT = 'https://api.polyv.net/live/v4/channel/basic/list'
const VOD_ENDPOINT = 'https://api.polyv.net/v2/video/search-videos'
const PLAYBACK_ENDPOINT = 'https://api.polyv.net/live/v2/channel/recordFile'
const TOKEN_ENDPOINT = 'https://hls.videocc.net/service/v1/token'

function json(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function sha256Live(params, secret) {
  const keys = Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] != null && key !== 'sign')
    .sort()
  const raw = secret + keys.map((key) => key + params[key]).join('') + secret
  return createHash('sha256').update(raw).digest('hex').toUpperCase()
}

function md5Live(params, secret) {
  const keys = Object.keys(params).filter((key) => params[key] !== '' && params[key] != null && key !== 'sign').sort()
  const raw = secret + keys.map((key) => key + params[key]).join('') + secret
  return createHash('md5').update(raw).digest('hex').toUpperCase()
}

function sha1Vod(params, secret) {
  const keys = Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] != null && key !== 'sign')
    .sort()
  const raw = `${keys.map((key) => `${key}=${params[key]}`).join('&')}${secret}`
  return createHash('sha1').update(raw).digest('hex').toUpperCase()
}

function md5Vod(params, secret) {
  const keys = Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] != null && key !== 'sign')
    .sort()
  const raw = `${secret}${keys.map((key) => `${key}${params[key]}`).join('')}${secret}`
  return createHash('md5').update(raw).digest('hex').toUpperCase()
}

function text(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function url(value) {
  try {
    const parsed = new URL(String(value))
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : ''
  } catch {
    return ''
  }
}

function normalizeLive(row) {
  return {
    kind: 'live',
    id: String(row.channelId || ''),
    channelId: String(row.channelId || ''),
    title: text(row.name, 120) || '未命名直播',
    cover: url(row.splashImg) || url(row.coverImg),
    status: text(row.watchStatusText, 40),
    liveAt: row.startTime ? new Date(Number(row.startTime)).toISOString() : '',
    duration: '',
  }
}

function normalizeVod(row) {
  return {
    kind: 'vod',
    id: String(row.vid || ''),
    vid: String(row.vid || ''),
    title: text(row.basicInfo?.title, 120) || '未命名视频',
    cover: url(row.basicInfo?.coverURL),
    status: '',
    liveAt: '',
    duration: row.basicInfo?.duration ? String(row.basicInfo.duration) : '',
  }
}

export function polyvStatus() {
  return {
    userId: conf().userId,
    live: {
      configured: Boolean(conf().liveAppId && conf().liveAppSecret),
      appId: conf().liveAppId ? `${conf().liveAppId.slice(0, 4)}****` : '',
    },
    vod: {
      configured: Boolean(conf().vodUserId && conf().vodSecretKey),
      userId: conf().vodUserId,
    },
    playsafe: Boolean(conf().vodUserId && conf().vodSecretKey),
  }
}

async function fetchJson(endpoint, params, signal) {
  const response = await fetch(`${endpoint}?${new URLSearchParams(params)}`, {
    signal: signal || AbortSignal.timeout(15000),
    redirect: 'error',
    headers: { Accept: 'application/json' },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`保利威接口返回 HTTP ${response.status}`)
  }
  if (!data || Number(data.code) !== 200) {
    const message = data?.message || data?.msg || ''
    throw new Error(message ? `保利威接口错误：${message}` : '保利威接口未返回有效数据')
  }
  return data
}

async function listLive(page, keyword) {
  if (!conf().liveAppId || !conf().liveAppSecret) {
    throw new Error('直播 API 未配置：需要 POLYV_LIVE_APP_ID 与 POLYV_LIVE_APP_SECRET')
  }
  const params = {
    appId: conf().liveAppId,
    timestamp: String(Date.now()),
    pageNumber: String(page),
    pageSize: '12',
    signatureMethod: 'SHA256',
    orderBy: 'channelCreatedTimeDesc',
  }
  if (keyword) params.name = keyword
  params.sign = sha256Live(params, conf().liveAppSecret)
  const data = await fetchJson(LIVE_ENDPOINT, params)
  const contents = data.data?.contents
  if (!Array.isArray(contents)) throw new Error('直播接口未返回列表，请检查接口权限与 IP 白名单')
  return {
    items: contents.map(normalizeLive).filter((item) => /^\d{1,12}$/.test(item.channelId)),
    page,
    totalPages: Number(data.data?.totalPages) || 0,
    total: Number(data.data?.totalItems) || 0,
  }
}

async function getLiveChannel(channelId) {
  let page = 1
  while (page <= 10) {
    const data = await listLive(page, '')
    const found = data.items.find((item) => item.channelId === channelId)
    if (found) return found
    if (!data.totalPages || page >= data.totalPages) break
    page += 1
  }
  return null
}

async function listVod(page, keyword) {
  if (!conf().vodUserId || !conf().vodSecretKey) {
    throw new Error('点播 API 未配置：需要 POLYV_VOD_USER_ID 与 POLYV_VOD_SECRET_KEY')
  }
  const params = {
    userid: conf().vodUserId,
    ptime: String(Date.now()),
    page: String(page),
    pageSize: '12',
    status: '60',
    filters: 'basicInfo',
    sort: 'creationTimeDesc',
  }
  if (keyword) params.keyword = keyword
  params.sign = sha1Vod(params, conf().vodSecretKey)
  const data = await fetchJson(VOD_ENDPOINT, params)
  const contents = data.data?.contents
  if (!Array.isArray(contents)) throw new Error('点播接口未返回列表，请检查接口权限')
  return {
    items: contents.map(normalizeVod).filter((item) => /^[\w-]{1,100}$/.test(item.vid)),
    page,
    totalPages: Number(data.data?.totalPages) || 0,
    total: Number(data.data?.totalItems) || 0,
  }
}

async function listPlayback(channelId, page) {
  if (!conf().liveAppId || !conf().liveAppSecret) {
    throw new Error('回放列表需要直播 API：POLYV_LIVE_APP_ID 与 POLYV_LIVE_APP_SECRET')
  }
  const params = {
    appId: conf().liveAppId,
    timestamp: String(Date.now()),
    page: String(page),
    pageSize: '20',
    listType: 'playback',
  }
  params.sign = md5Live(params, conf().liveAppSecret)
  const data = await fetchJson(PLAYBACK_ENDPOINT + '/' + encodeURIComponent(channelId) + '/playback/list', params)
  const contents = data.data?.contents || data.data?.list || []
  return {
    items: Array.isArray(contents)
      ? contents.map((row) => ({
          id: String(row.videoId || row.vid || row.playbackId || ''),
          videoId: String(row.videoId || ''),
          vid: String(row.videoPoolId || row.vid || row.videoId || ''),
          title: text(row.title, 120) || '未命名回放',
          cover: url(row.firstImage) || url(row.cover) || '',
          duration: row.duration ? String(row.duration) : '',
          url: url(row.url) || '',
          fileUrl: url(row.fileUrl) || '',
          mp4: url(row.mp4) || '',
          watchUrl: url(row.watchUrl) || '',
          startTime: row.startTime ? new Date(Number(row.startTime)).toISOString() : '',
        }))
      : [],
    page,
    total: Number(data.data?.totalItems) || 0,
  }
}

async function createPlaysafe(vid, viewerId) {
  if (!conf().vodUserId || !conf().vodSecretKey) {
    throw new Error('播放凭证需要点播 API：POLYV_VOD_USER_ID 与 POLYV_VOD_SECRET_KEY')
  }
  const params = {
    userid: conf().vodUserId,
    videoId: vid,
    ts: String(Date.now()),
    viewerId: viewerId.replace(/[^\w-]/g, '').slice(0, 32) || 'viewer',
  }
  params.sign = md5Vod(params, conf().vodSecretKey)
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data || Number(data.code) !== 200) {
    throw new Error(data?.message || '获取播放凭证失败')
  }
  return { token: String(data.data?.token || ''), expires: Number(data.data?.ttl) || 0 }
}

export async function handlePolyvRequest(req, res, url) {
  if (!url.pathname.startsWith('/api/polyv/')) return false
  if (req.method !== 'GET' && req.method !== 'POST') {
    json(res, 405, { error: '不支持此请求方式' })
    return true
  }

  try {
    if (url.pathname === '/api/polyv/status') {
      json(res, 200, polyvStatus())
      return true
    }

    if (url.pathname === '/api/polyv/list') {
      const kind = url.searchParams.get('kind')
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
      const keyword = text(url.searchParams.get('keyword') || '', 60)
      if (kind === 'live') {
        json(res, 200, await listLive(page, keyword))
      } else if (kind === 'vod') {
        json(res, 200, await listVod(page, keyword))
      } else {
        json(res, 400, { error: '请选择直播或点播' })
      }
      return true
    }

    if (url.pathname === '/api/polyv/channel') {
      const channelId = text(url.searchParams.get('channelId') || '', 20)
      if (!/^\d{1,12}$/.test(channelId)) {
        json(res, 400, { error: '频道号无效' })
        return true
      }
      const item = await getLiveChannel(channelId)
      if (!item) {
        json(res, 404, { error: '没有找到这个频道' })
        return true
      }
      json(res, 200, item)
      return true
    }

    if (url.pathname === '/api/polyv/playback') {
      const channelId = text(url.searchParams.get('channelId') || '', 20)
      if (!/^\d{1,12}$/.test(channelId)) {
        json(res, 400, { error: '频道号无效' })
        return true
      }
      json(res, 200, await listPlayback(channelId, 1))
      return true
    }

    if (url.pathname === '/api/polyv/playsafe' && req.method === 'POST') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      const vid = text(body.vid, 100)
      const viewerId = text(body.viewerId, 40) || `viewer-${Date.now()}`
      if (!/^[\w-]{1,100}$/.test(vid)) {
        json(res, 400, { error: '视频 ID 无效' })
        return true
      }
      json(res, 200, await createPlaysafe(vid, viewerId))
      return true
    }

    json(res, 404, { error: '接口不存在' })
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : '保利威接口调用失败'
    console.error('[polyv]', message)
    json(res, 502, { error: message })
    return true
  }
}
