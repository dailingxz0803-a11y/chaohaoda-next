export type BlockType =
  | 'hero'
  | 'text'
  | 'live'
  | 'reservation'
  | 'countdown'
  | 'collection'
  | 'speakers'
  | 'timeline'
  | 'stats'
  | 'quicknav'
  | 'link'

export interface CollectionItem {
  id: string
  title: string
  body?: string
  duration?: string
  subtitle?: string
  time?: string
  cover?: string
  vid?: string
  url?: string
  playsafe?: string
  price?: string
  originalPrice?: string
  cta?: string
  badge?: string
  plays?: string
  publishedAt?: string
  tags?: string[]
  icon?: string
}

export interface Block {
  id: string
  type: BlockType
  title: string
  body?: string
  eyebrow?: string
  tags?: string[]
  speaker?: string
  liveAt?: string
  url?: string
  cover?: string
  heroLayout?: 'cover' | 'stage' | 'split' | 'brief'
  channelId?: string
  vid?: string
  playsafe?: string
  layout?: 'single' | 'double' | 'masonry' | 'sale' | 'triple'
  navStyle?: 'grid' | 'pills' | 'bento'
  countdownLabel?: string
  ctaLabel?: string
  viewers?: string
  publishedAt?: string
  showViewers?: boolean
  showPlays?: boolean
  showDuration?: boolean
  showPublishedAt?: boolean
  showTags?: boolean
  showBadge?: boolean
  sourceType?: 'live' | 'vod' | 'file' | 'none'
  items?: CollectionItem[]
}

export interface Theme {
  background: string
  surface: string
  text: string
  muted: string
  accent: string
  soft: string
}

export type FontKey = 'sans' | 'serif' | 'round'

export interface Page {
  id: string
  name: string
  template: string
  theme: Theme
  font: FontKey
  radius: number
  padding: number
  gap: number
  backgroundImage?: string
  backgroundOpacity?: number
  blocks: Block[]
  updatedAt: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  at: number
}

export interface AiResponse {
  page: Page
  summary: string
  demo: boolean
  model: string
  reference?: {
    mood?: string
    palette?: Record<string, string>
    layout?: {
      hero?: string
      sections?: { type: string; columns?: number }[]
      cardStyle?: string
    }
  } | null
}

export interface AIStatus {
  configured: boolean
  model: string
  provider: string
}

export interface ShareResult {
  id: string
  url: string
  lan?: boolean
  public?: boolean
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: '主视觉',
  text: '文案',
  live: '直播',
  reservation: '预约直播',
  countdown: '倒计时直播',
  collection: '视频合集',
  speakers: '讲师阵容',
  timeline: '时间线',
  stats: '数据条',
  quicknav: '金刚位',
  link: '链接',
}
