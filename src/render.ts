import type { Block, Page } from './types'
import { esc, formatLiveAt, isHex, safeUrl, shade } from './lib'

interface RenderOptions {
  interactive?: boolean
  selectedId?: string | null
}

const FONT_STACKS = {
  sans: `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`,
  serif: `"Songti SC", "Noto Serif SC", "Source Han Serif SC", Georgia, serif`,
  round: `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", ui-rounded, system-ui, sans-serif`,
}

function coverStyle(seed: string, page: Page, index = 0): string {
  const accent = page.theme.accent
  const angle = 120 + ((index * 47 + seed.length * 13) % 70)
  return `background:linear-gradient(${angle}deg, ${accent}, ${shade(accent, -0.42)})`
}

function glyph(title: string): string {
  return esc((title || '直').trim().charAt(0))
}

const NAV_ICONS: Record<string, string> = {
  live: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
  course: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/>',
  expert: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  replay: '<path d="M20 11a8 8 0 1 0-2.3 6.2"/><path d="M20 5v6h-6"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.8-5"/>',
  chart: '<path d="M4 20V10M10 20V5M16 20v-7M22 20H2"/>',
  ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z"/><path d="M10 6v12"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3 9h18v4H3zM12 9v11M12 9c-2-4-5-4-5-2s3 2 5 2Zm0 0c2-4 5-4 5-2s-3 2-5 2Z"/>',
  quote: '<path d="M9 7H5a2 2 0 0 0-2 2v6h6V9m10-2h-4a2 2 0 0 0-2 2v6h6V9"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  link: '<path d="M10 13a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.5 5.8"/><path d="M14 11a4 4 0 0 0-5.7 0L5.5 13.8a4 4 0 0 0 5.7 5.7l1.3-1.3"/>',
}

function navIcon(key?: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAV_ICONS[key || 'link'] || NAV_ICONS.link}</svg>`
}


function formatMetricNumber(value?: string): string {
  const num = Number(String(value ?? '').replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(num) || num <= 0) return ''
  if (num < 10000) return String(Math.round(num))
  return (num / 10000).toFixed(1).replace(/\.0$/, '') + '万'
}

function formatDurationText(value?: string): string {
  if (!value) return ''
  const raw = String(value).trim()
  let hours = 0
  let minutes = 0
  let seconds = 0
  if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(raw)) {
    const parts = raw.split(':').map(Number)
    if (parts.length === 3) [hours, minutes, seconds] = parts
    else [minutes, seconds] = parts
  } else {
    const total = Number(raw)
    if (!Number.isFinite(total) || total <= 0) return raw
    hours = Math.floor(total / 3600)
    minutes = Math.floor((total % 3600) / 60)
    seconds = Math.floor(total % 60)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

function formatPublishedText(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diff = Date.now() - date.getTime()
  if (diff >= 0 && diff < 3600000) return Math.max(1, Math.floor(diff / 60000)) + ' 分钟前'
  if (diff >= 0 && diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
  const now = new Date()
  const label = (date.getMonth() + 1) + '月' + date.getDate() + '日'
  return date.getFullYear() === now.getFullYear() ? label : date.getFullYear() + '年' + label
}

function displayTags(tags?: string[]): string[] {
  return (tags ?? [])
    .map((tag) => String(tag).trim().slice(0, 6))
    .filter(Boolean)
    .slice(0, 2)
}

function mediaHTML(block: Block, page: Page, badge: string, index = 0, watchUrl = ''): string {
  return `<div class="media" style="${coverStyle(block.id, page, index)}">
    ${watchUrl ? `<a class="media-hit" href="${esc(watchUrl)}" data-watch="${esc(watchUrl)}" aria-label="打开观看页"></a>` : ''}
    ${block.cover ? `<img class="media-img" src="${esc(block.cover)}" alt="">` : ''}
    <span class="media-badge"${badge ? '' : ' hidden'}>${esc(badge)}</span>
    ${block.cover ? '' : `<span class="media-glyph" aria-hidden="true">${glyph(block.title)}</span>`}
    ${watchUrl ? `<span class="play" aria-hidden="true" data-watch="${esc(watchUrl)}"><i></i></span>` : ''}
  </div>`
}

function cta(text: string, url?: string): string {
  const href = safeUrl(url)
  if (!href) return `<span class="cta">${esc(text)}</span>`
  return `<a class="cta" href="${esc(href)}" data-watch="${esc(href)}" target="_blank" rel="noreferrer noopener">${esc(text)}</a>`
}

function blockHTML(block: Block, page: Page, options: RenderOptions, index: number): string {
  const selected = options.selectedId === block.id ? ' sel' : ''
  const head = `<section class="blk type-${block.type}${selected}" data-block="${esc(block.id)}">`
  const close = '</section>'
  const tags = (block.tags ?? []).filter(Boolean)

  switch (block.type) {
    case 'hero': {
      const layout = block.heroLayout || 'cover'
      const heroBackground = block.cover
        ? `background-image:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.6)),url(${block.cover});background-size:cover;background-position:center`
        : coverStyle(block.id, page, index)
      const mediaStyle = block.cover
        ? `background-image:url(${block.cover});background-size:cover;background-position:center`
        : coverStyle(block.id, page, index)
      const bodyContent = `
        ${block.eyebrow ? `<span class="eyebrow">${esc(block.eyebrow)}</span>` : ''}
        <h1>${esc(block.title)}</h1>
        ${block.body ? `<p>${esc(block.body)}</p>` : ''}
        ${tags.length ? `<div class="tags">${tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}`

      if (layout === 'split') {
        return `${head}<div class="hero-split">
          <div class="hero-split-media" style="${mediaStyle}"></div>
          <div class="hero-split-body">${bodyContent}</div>
        </div>${close}`
      }
      if (layout === 'brief') {
        return `${head}<div class="hero-brief">
          <span class="hero-rule" aria-hidden="true"></span>
          ${bodyContent}
        </div>${close}`
      }
      if (layout === 'stage') {
        return `${head}<div class="hero stage" style="${heroBackground}">
          <div class="hero-stage-inner">${bodyContent}</div>
        </div>${close}`
      }
      return `${head}<div class="hero cover" style="${heroBackground}">${bodyContent}</div>${close}`
    }
    case 'live':
    case 'reservation':
    case 'countdown': {
      const badge = block.showBadge === false
        ? ''
        : block.type === 'live'
          ? '直播频道'
          : block.type === 'reservation'
            ? '预约直播'
            : '倒计时'
      const button = block.ctaLabel || (block.type === 'live' ? '观看直播' : '预约直播')
      const time = formatLiveAt(block.liveAt)
      const viewerText = block.showViewers === false ? '' : formatMetricNumber(block.viewers)
      const publishedText =
        block.showPublishedAt === false ? '' : formatPublishedText(block.publishedAt)
      const liveTags = block.showTags === false ? [] : displayTags(block.tags)
      const title = encodeURIComponent(block.title)
      const watchUrl = block.channelId
        ? `/watch?type=live&channelId=${encodeURIComponent(block.channelId)}&title=${title}`
        : block.type === 'reservation' && block.vid
          ? `/watch?type=vod&vid=${encodeURIComponent(block.vid)}&title=${title}`
          : block.type === 'reservation' && block.url
            ? /^\/watch\?/.test(block.url)
              ? block.url
              : `/watch?type=file&url=${encodeURIComponent(block.url)}&title=${title}`
            : ''
      const countdown =
        block.type === 'countdown'
          ? block.liveAt
            ? `<span class="count-label">${esc(block.countdownLabel || '距开播')}</span><div class="count" data-live-at="${esc(block.liveAt)}">计算中…</div>`
            : `<div class="count is-empty">待设置开播时间</div>`
          : ''
      const showCta = !(block.type === 'countdown' && !block.url)
      return `${head}<div class="card live-card">
        ${block.type === 'countdown' && !block.cover ? '' : mediaHTML(block, page, badge, index, watchUrl)}
        <div class="card-body">
          <h2>${esc(block.title)}</h2>
          ${block.body ? `<p>${esc(block.body)}</p>` : ''}
          ${countdown}
          <div class="meta">
            ${viewerText ? `<span class="viewers"><i></i>${esc(viewerText)}人正在观看</span>` : ''}
            ${block.speaker ? `<span>${esc(block.speaker)}</span>` : ''}
            ${block.liveAt && !publishedText ? `<span>${esc(time)}</span>` : ''}
            ${publishedText ? `<span>发布于 ${esc(publishedText)}</span>` : ''}
          </div>
          ${liveTags.length ? `<div class="live-tags">${liveTags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}
          ${showCta ? cta(button, watchUrl || block.url) : ''}
        </div>
      </div>${close}`
    }
    case 'stats': {
      const rows = block.items ?? []
      return `${head}<div class="card stats-card">
        ${
          block.title
            ? `<div class="section-head">
                <div>
                  <h2>${esc(block.title)}</h2>
                  ${block.body ? `<p>${esc(block.body)}</p>` : ''}
                </div>
              </div>`
            : ''
        }
        <div class="stats-row">
          ${rows
            .map(
              (row) => `<div class="stat">
                <strong>${esc(row.title)}</strong>
                <span>${esc(row.subtitle || row.body || '')}</span>
              </div>`,
            )
            .join('')}
        </div>
      </div>${close}`
    }
    case 'collection': {
      const items = block.items ?? []
      const layout = block.layout ?? 'double'
      const showPlays = block.showPlays !== false
      const showDuration = block.showDuration !== false
      const showPublishedAt = block.showPublishedAt !== false
      const showTags = block.showTags !== false
      return `${head}<div class="card collection">
        <div class="collection-head">
          <h2>${esc(block.title)}</h2>
          <span>${items.length} 条内容</span>
        </div>
        ${block.body ? `<p class="collection-body">${esc(block.body)}</p>` : ''}
        <div class="items ${layout}">
          ${items
            .map((item, i) => {
              const watchHref = item.vid
                ? `/watch?type=vod&vid=${encodeURIComponent(item.vid)}&title=${encodeURIComponent(item.title)}`
                : item.url
                  ? `/watch?type=file&url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title)}`
                  : ''
              const saleHref = item.url || watchHref
              const playsText = showPlays ? formatMetricNumber(item.plays) : ''
              const publishedText = showPublishedAt ? formatPublishedText(item.publishedAt) : ''
              const durationText = showDuration ? formatDurationText(item.duration) : ''
              const tagList = showTags ? displayTags(item.tags) : []
              const itemMeta =
                playsText || publishedText
                  ? `<div class="item-meta">${playsText ? `<span>${esc(playsText)}次播放</span>` : ''}${publishedText ? `<span>${esc(publishedText)}</span>` : ''}</div>`
                  : ''
              const itemTags = tagList.length
                ? `<div class="item-tags">${tagList.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>`
                : ''
              if (layout === 'sale') {
                const action = saleHref
                  ? `<a class="sale-cta" href="${esc(saleHref)}"${item.vid ? ` data-watch="${esc(saleHref)}"` : ''} target="_blank" rel="noreferrer noopener">${esc(item.cta || '抢')}</a>`
                  : `<span class="sale-cta">${esc(item.cta || '抢')}</span>`
                return `<article class="sale-item">
                  <div class="sale-cover" style="${coverStyle(item.id, page, index + i + 1)}">
                    ${item.cover ? `<img class="item-img" src="${esc(item.cover)}" alt="">` : ''}
                    ${item.badge ? `<span class="sale-badge">${esc(item.badge)}</span>` : ''}
                  </div>
                  <div class="sale-body">
                    <h3>${esc(item.title)}</h3>
                    ${item.body ? `<p>${esc(item.body)}</p>` : ''}
                    ${itemMeta}
                    ${itemTags}
                    <div class="sale-foot">
                      <div class="sale-price">
                        ${item.price ? `<b><em>¥</em>${esc(item.price)}</b>` : ''}
                        ${item.originalPrice ? `<s>日常价 ¥${esc(item.originalPrice)}</s>` : ''}
                      </div>
                      ${action}
                    </div>
                  </div>
                </article>`
              }
              const inner = `<div class="item-cover" style="${coverStyle(item.id, page, index + i + 1)}">
                  ${item.cover ? `<img class="item-img" src="${esc(item.cover)}" alt="">` : ''}
                  <span class="play small" aria-hidden="true"${watchHref ? ` data-watch="${esc(watchHref)}"` : ''}><i></i></span>
                  ${durationText ? `<span class="duration">${esc(durationText)}</span>` : ''}
                </div>
                <div class="item-body">
                  <h3>${esc(item.title)}</h3>
                  ${item.body ? `<p>${esc(item.body)}</p>` : ''}
                  ${itemMeta}
                  ${itemTags}
                  ${
                    item.price
                      ? `<div class="item-price"><b>¥${esc(item.price)}</b>${item.originalPrice ? `<s>¥${esc(item.originalPrice)}</s>` : ''}</div>`
                      : ''
                  }
                </div>`
              if (!watchHref) return `<article class="item">${inner}</article>`
              return `<a class="item item-link" href="${esc(watchHref)}" data-watch="${esc(watchHref)}">${inner}</a>`
            })
            .join('')}
        </div>
      </div>${close}`
    }
    case 'speakers': {
      const people = block.items ?? []
      const layout = block.layout === 'single' ? 'single' : 'double'
      return `${head}<div class="card speakers-card">
        <div class="section-head">
          <div>
            <h2>${esc(block.title)}</h2>
            ${block.body ? `<p>${esc(block.body)}</p>` : ''}
          </div>
          <span>${people.length} 位</span>
        </div>
        <div class="speaker-grid ${layout}">
          ${people
            .map(
              (person, i) => `<article class="speaker">
                <div class="speaker-avatar" style="${coverStyle(person.id, page, index + i)}">
                  ${person.cover ? `<img src="${esc(person.cover)}" alt="">` : esc((person.title || '讲').charAt(0))}
                </div>
                <div class="speaker-info">
                  <strong>${esc(person.title)}</strong>
                  ${person.subtitle ? `<em>${esc(person.subtitle)}</em>` : ''}
                  ${person.body ? `<p>${esc(person.body)}</p>` : ''}
                </div>
              </article>`,
            )
            .join('')}
        </div>
      </div>${close}`
    }
    case 'timeline': {
      const nodes = block.items ?? []
      return `${head}<div class="card timeline-card">
        <div class="section-head">
          <div>
            <h2>${esc(block.title)}</h2>
            ${block.body ? `<p>${esc(block.body)}</p>` : ''}
          </div>
          <span>${nodes.length} 个环节</span>
        </div>
        <div class="tl-list">
          ${nodes
            .map((node) => {
              const watchHref = node.vid
                ? `/watch?type=vod&vid=${encodeURIComponent(node.vid)}&title=${encodeURIComponent(node.title)}`
                : node.url
                  ? `/watch?type=file&url=${encodeURIComponent(node.url)}&title=${encodeURIComponent(node.title)}`
                  : ''
              const videoChip = watchHref
                ? `<a class="tl-video" href="${esc(watchHref)}" data-watch="${esc(watchHref)}"><span class="tl-play">▶</span> 观看视频</a>`
                : `<span class="tl-video is-empty">视频待补充</span>`
              return `<div class="tl-item">
                <span class="tl-time">${esc(node.time || '待定')}</span>
                <span class="tl-rail"><i class="tl-dot"></i></span>
                <div class="tl-body">
                  <h3>${esc(node.title)}</h3>
                  ${node.body ? `<p>${esc(node.body)}</p>` : ''}
                  ${videoChip}
                </div>
              </div>`
            })
            .join('')}
        </div>
      </div>${close}`
    }
    case 'quicknav': {
      const entries = block.items ?? []
      const style = block.navStyle ?? 'grid'
      const wrap = (entry: (typeof entries)[number], className: string, inner: string) => {
        const href = safeUrl(entry.url)
        return href
          ? `<a class="${className}" href="${esc(href)}" target="_blank" rel="noreferrer noopener">${inner}</a>`
          : `<div class="${className}">${inner}</div>`
      }

      if (style === 'pills') {
        return `${head}<div class="quicknav-pills">
          ${entries
            .map((entry) =>
              wrap(
                entry,
                'nav-pill',
                `<span class="nav-pill-icon">${navIcon(entry.icon)}</span><strong>${esc(entry.title)}</strong>`,
              ),
            )
            .join('')}
        </div>${close}`
      }

      if (style === 'bento') {
        const [feature, ...rest] = entries
        if (!feature) return `${head}${close}`
        const featureStyle = feature.cover
          ? `background-image:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.66)),url(${esc(feature.cover)});background-size:cover;background-position:center`
          : coverStyle(feature.id, page, index)
        const featureInner = `<span class="nav-feature-icon">${navIcon(feature.icon)}</span>
          <strong>${esc(feature.title)}</strong>
          ${feature.subtitle ? `<small>${esc(feature.subtitle)}</small>` : ''}`
        const featureHref = safeUrl(feature.url)
        const featureTag = featureHref
          ? `<a class="nav-feature" style="${featureStyle}" href="${esc(featureHref)}" target="_blank" rel="noreferrer noopener">${featureInner}</a>`
          : `<div class="nav-feature" style="${featureStyle}">${featureInner}</div>`
        return `${head}<div class="quicknav-bento">
          ${featureTag}
          ${rest
            .map((entry, i) =>
              wrap(
                entry,
                `nav-bento-item${i === 0 ? ' is-wide' : ''}`,
                `<span class="nav-icon">${navIcon(entry.icon)}</span><strong>${esc(entry.title)}</strong>`,
              ),
            )
            .join('')}
        </div>${close}`
      }

      return `${head}<div class="quicknav">
        <div class="quicknav-grid">
          ${entries
            .map((entry) => {
              const tile = `<span class="nav-icon">${navIcon(entry.icon)}</span>
                <strong>${esc(entry.title)}</strong>
                ${entry.subtitle ? `<small>${esc(entry.subtitle)}</small>` : ''}`
              return wrap(entry, 'nav-item', tile)
            })
            .join('')}
        </div>
      </div>${close}`
    }
    case 'link': {
      const href = safeUrl(block.url)
      const inner = `<div>
          <h3>${esc(block.title)}</h3>
          ${block.body ? `<p>${esc(block.body)}</p>` : ''}
          ${href ? `<span class="url">${esc(new URL(href).host)}</span>` : `<span class="url is-empty">待补充链接</span>`}
        </div>
        <span class="arrow" aria-hidden="true">↗</span>`
      return `${head}${href ? `<a class="card link-card" href="${esc(href)}" target="_blank" rel="noreferrer noopener">${inner}</a>` : `<div class="card link-card">${inner}</div>`}${close}`
    }
    case 'text': {
      return `${head}<div class="card text-card">
        <h2>${esc(block.title)}</h2>
        ${block.body ? `<p>${esc(block.body).replace(/\n/g, '<br>')}</p>` : ''}
      </div>${close}`
    }
    default:
      return ''
  }
}

export function renderPageHTML(page: Page, options: RenderOptions = {}): string {
  const t = page.theme
  const radius = Math.max(0, Math.min(32, page.radius))
  const padding = Math.max(8, Math.min(40, page.padding))
  const gap = Math.max(8, Math.min(48, page.gap))
  const font = FONT_STACKS[page.font] ?? FONT_STACKS.sans
  const accent = isHex(t.accent) ? t.accent : '#7c5cff'
  const bodyClass = options.interactive ? 'preview' : 'export'
  const backgroundOpacity = Math.min(0.6, Math.max(0, Number(page.backgroundOpacity ?? 0.12)))
  const backgroundLayer = page.backgroundImage
    ? `<div class="page-bg" style="background-image:url(${esc(page.backgroundImage)});opacity:${backgroundOpacity}"></div>`
    : ''
  const hasCountdown = page.blocks.some((b) => b.type === 'countdown')

  const css = `
    :root{--bg:${esc(t.background)};--surface:${esc(t.surface)};--text:${esc(t.text)};--muted:${esc(t.muted)};--accent:${accent};--soft:${esc(t.soft)};--r:${radius}px;--pad:${padding}px;--gap:${gap}px}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{background:var(--bg);color:var(--text);font-family:${font};-webkit-font-smoothing:antialiased}
    .page-bg{position:fixed;inset:0;z-index:0;background-size:cover;background-position:center;background-repeat:no-repeat;pointer-events:none}
    main{position:relative;z-index:1;max-width:480px;margin:0 auto;padding:var(--pad);display:flex;flex-direction:column;gap:var(--gap);min-height:100vh}
    .blk{position:relative}
    .blk.sel{outline:2px solid #8b5cf6;outline-offset:3px;border-radius:calc(var(--r) + 3px)}
    .hero{border-radius:var(--r);padding:26px 22px 24px;color:#fff;position:relative;overflow:hidden;box-shadow:0 16px 36px -28px rgba(0,0,0,.45)}
    .hero:after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 15% 0%,rgba(255,255,255,.16),transparent 55%),linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,.55));pointer-events:none}
    .hero>*{position:relative;z-index:1}
    .hero.stage{display:flex;align-items:center;justify-content:center;text-align:center;min-height:340px}
    .hero-stage-inner{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;max-width:100%}
    .hero.stage h1{margin-top:16px}
    .hero.stage .tags{justify-content:center}
    .hero-split{background:var(--surface);border:1px solid rgba(127,127,127,.16);border-radius:var(--r);overflow:hidden;color:var(--text);box-shadow:0 14px 34px -28px rgba(0,0,0,.45)}
    .hero-split-media{position:relative;aspect-ratio:16/9;background-size:cover;background-position:center}
    .hero-split-body{padding:18px 16px 20px}
    .hero-split .eyebrow{display:inline-block;font-size:10.5px;letter-spacing:.1em;color:var(--accent);font-weight:700}
    .hero-split h1{font-size:24px;line-height:1.25;letter-spacing:-.02em;margin:10px 0 8px;font-weight:800}
    .hero-split p{margin:0;font-size:13px;line-height:1.7;color:var(--muted)}
    .hero-split .tags span{font-size:10.5px;padding:4px 9px;border-radius:999px;background:color-mix(in srgb, var(--soft) 70%, transparent);color:var(--text);border:1px solid rgba(127,127,127,.16)}
    .hero-brief{position:relative;background:color-mix(in srgb, var(--surface) 78%, var(--soft));border:1px solid rgba(127,127,127,.14);border-radius:var(--r);padding:28px 22px;color:var(--text)}
    .hero-brief .hero-rule{display:block;width:38px;height:3px;border-radius:2px;background:var(--accent);margin-bottom:18px}
    .hero-brief .eyebrow{font-size:10.5px;letter-spacing:.12em;color:var(--accent);font-weight:700;text-transform:uppercase}
    .hero-brief h1{font-size:28px;line-height:1.2;letter-spacing:-.02em;margin:12px 0 10px;font-weight:800;color:var(--text)}
    .hero-brief p{margin:0;font-size:13px;line-height:1.7;color:var(--muted)}
    .hero-brief .tags span{font-size:10.5px;padding:4px 9px;border-radius:999px;border:1px solid rgba(127,127,127,.18);color:var(--muted);background:transparent}
    .hero .eyebrow{display:inline-block;font-size:11px;letter-spacing:.12em;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);backdrop-filter:blur(6px)}
    .hero h1{font-size:29px;line-height:1.18;letter-spacing:-.02em;margin:14px 0 10px;font-weight:800}
    .hero p{margin:0;font-size:14px;line-height:1.7;color:rgba(255,255,255,.9)}
    .tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
    .tags span{font-size:11px;padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28)}
    .viewers{display:inline-flex;align-items:center;gap:5px;color:#2f8f5b;font-weight:650}
    .viewers i{width:5px;height:5px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px rgba(47,143,91,.16)}
    .live-tags{display:flex;flex-wrap:wrap;gap:5px;margin:2px 0 12px}
    .live-tags span{font-size:10px;padding:3px 8px;border-radius:999px;background:rgba(127,127,127,.12);color:var(--muted)}
    .item-meta{display:flex;flex-wrap:wrap;gap:3px 9px;margin-top:5px;font-size:10px;line-height:1.5;color:var(--muted)}
    .item-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
    .item-tags span{font-size:9px;padding:2px 6px;border-radius:999px;background:rgba(127,127,127,.12);color:var(--muted)}
    .card{background:var(--surface);border:1px solid rgba(127,127,127,.16);border-radius:var(--r);overflow:hidden;box-shadow:0 14px 34px -28px rgba(0,0,0,.55)}
    .media{position:relative;aspect-ratio:16/9;display:grid;place-items:center;overflow:hidden}
    .media-hit{position:absolute;inset:0;z-index:1;display:block}
    .media:before{content:"";position:absolute;inset:0;background:radial-gradient(80% 90% at 70% 10%,rgba(255,255,255,.24),transparent 60%)}
    .media-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .item-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .media-badge{position:absolute;left:12px;top:12px;z-index:2;font-size:10px;letter-spacing:.08em;padding:4px 9px;border-radius:999px;background:rgba(0,0,0,.45);color:#fff;backdrop-filter:blur(4px)}
    .media-glyph{position:absolute;right:8px;bottom:-14px;font-size:92px;font-weight:800;color:rgba(255,255,255,.16);line-height:1;user-select:none}
    .play{width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.92);display:grid;place-items:center;z-index:2;box-shadow:0 8px 20px rgba(0,0,0,.28)}
    .play i{width:0;height:0;border-style:solid;border-width:8px 0 8px 13px;border-color:transparent transparent transparent #2b2140;margin-left:3px}
    .play.small{width:34px;height:34px}
    .play.small i{border-width:6px 0 6px 10px}
    .card-body{padding:16px}
    .card h2{font-size:18px;line-height:1.4;margin:0 0 6px;font-weight:750;letter-spacing:-.01em}
    .card p{margin:0;font-size:13.5px;line-height:1.72;color:var(--muted)}
    .meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin:12px 0;font-size:11.5px;color:var(--muted)}
    .cta{display:flex;align-items:center;justify-content:center;height:42px;border-radius:calc(var(--r) * .7);background:var(--accent);color:#fff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:.02em}
    .count{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:10px 0 4px;color:var(--accent);font-variant-numeric:tabular-nums}
    .count-label{display:block;margin-top:10px;font-size:10px;letter-spacing:.12em;color:var(--muted)}
    .count.is-empty{font-size:13px;font-weight:500;color:var(--muted)}
    .collection-head{display:flex;align-items:baseline;justify-content:space-between;padding:16px 16px 0;gap:10px}
    .collection-head h2{margin:0}
    .collection-head span{font-size:11px;color:var(--muted);white-space:nowrap}
    .collection-body{padding:6px 16px 0}
    .items{display:grid;gap:10px;padding:14px 16px 16px}
    .items.double{grid-template-columns:1fr 1fr}
    .items.single{grid-template-columns:1fr}
    .items.masonry{grid-template-columns:1fr 1fr}
    .items.triple{grid-template-columns:repeat(3,1fr);gap:8px}
    .items.triple .item-body{padding:8px 8px 10px}
    .items.triple .item h3{font-size:11px;line-height:1.4}
    .items.triple .item p{font-size:9.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .items.triple .play.small{width:24px;height:24px}
    .items.triple .duration{font-size:8.5px;padding:1px 4px}
    .items.triple .item-meta{font-size:9px;gap:2px 6px}
    .items.triple .item-tags{display:none}
    .items.masonry .item:nth-child(2n){margin-top:18px}
    .item-link{display:block;color:inherit;text-decoration:none}
    .item-link:hover{transform:translateY(-1px);transition:transform .15s}
    .item{background:color-mix(in srgb, var(--surface) 82%, var(--soft));border:1px solid rgba(127,127,127,.12);border-radius:calc(var(--r) * .78);overflow:hidden}
    .item-cover{position:relative;aspect-ratio:16/10;display:grid;place-items:center}
    .duration{position:absolute;right:8px;bottom:8px;font-size:10px;padding:2px 6px;border-radius:5px;background:rgba(0,0,0,.55);color:#fff}
    .item-body{padding:10px 11px 12px}
    .item h3{font-size:13px;line-height:1.45;margin:0;font-weight:650}
    .item p{font-size:11px;line-height:1.6;margin:4px 0 0;color:var(--muted)}
    .item-price{display:flex;align-items:baseline;gap:5px;margin-top:6px}
    .item-price b{font-size:15px;color:var(--accent);font-weight:800}
    .item-price s{font-size:10px;color:var(--muted)}
    .items.sale{display:flex;flex-direction:column;gap:10px;padding:14px 16px 16px}
    .sale-item{display:flex;gap:12px;padding:10px;background:color-mix(in srgb, var(--surface) 86%, var(--soft));border:1px solid rgba(127,127,127,.12);border-radius:calc(var(--r) * .78);transition:transform .18s ease}
    .sale-item:hover{transform:translateY(-2px)}
    .sale-cover{position:relative;width:96px;height:96px;flex:none;border-radius:10px;overflow:hidden;display:grid;place-items:center}
    .sale-cover img{width:100%;height:100%;object-fit:cover}
    .sale-badge{position:absolute;left:4px;top:4px;font-size:9px;padding:2px 5px;border-radius:4px;background:var(--accent);color:#fff;font-weight:600}
    .sale-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:6px}
    .sale-body h3{font-size:14px;line-height:1.4;margin:0;font-weight:700;letter-spacing:-.01em}
    .sale-body p{font-size:11px;line-height:1.55;margin:0;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .sale-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px}
    .sale-price{display:flex;align-items:baseline;gap:5px}
    .sale-price b{font-size:17px;color:var(--accent);font-weight:800;letter-spacing:-.01em}
    .sale-price b em{font-style:normal;font-size:11px;margin-right:1px}
    .sale-price s{font-size:9.5px;color:var(--muted)}
    .sale-cta{display:inline-flex;align-items:center;justify-content:center;min-width:46px;height:28px;padding:0 12px;border-radius:999px;background:var(--accent);color:#fff;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap}
    .stats-card{padding:16px}
    .stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:0}
    .stat{text-align:center;padding:6px 8px;border-right:1px solid rgba(127,127,127,.14)}
    .stat:last-child{border-right:0}
    .stat strong{display:block;font-size:26px;line-height:1.1;font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
    .stat span{display:block;margin-top:4px;font-size:10.5px;color:var(--muted)}
    .text-card{padding:18px 16px}
    .text-card h2{margin-bottom:8px}
    .quicknav{padding:12px 8px;background:var(--surface);border:1px solid rgba(127,127,127,.16);border-radius:var(--r);box-shadow:0 14px 34px -28px rgba(0,0,0,.55)}
    .quicknav-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(66px,1fr));gap:6px}
    .nav-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:4px 2px;color:var(--text);text-decoration:none;border-radius:10px}
    .nav-item:active{background:rgba(127,127,127,.08)}
    .nav-icon{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;color:var(--accent);background:color-mix(in srgb, var(--accent) 12%, var(--surface));border:1px solid color-mix(in srgb, var(--accent) 16%, transparent)}
    .nav-icon svg{width:22px;height:22px}
    .nav-item strong{font-size:11.5px;line-height:1.3;font-weight:600;text-align:center}
    .nav-item small{font-size:9px;line-height:1.3;color:var(--muted);text-align:center;margin-top:-3px}
    .quicknav-pills{display:flex;gap:8px;overflow-x:auto;padding:2px 0;scrollbar-width:none}
    .quicknav-pills::-webkit-scrollbar{display:none}
    .nav-pill{display:inline-flex;align-items:center;gap:6px;flex:none;padding:9px 13px;border-radius:999px;background:var(--surface);border:1px solid rgba(127,127,127,.16);color:var(--text);text-decoration:none;white-space:nowrap;box-shadow:0 10px 24px -24px rgba(0,0,0,.45)}
    .nav-pill-icon{display:grid;place-items:center;width:20px;height:20px;color:var(--accent)}
    .nav-pill-icon svg{width:16px;height:16px}
    .nav-pill strong{font-size:11.5px;font-weight:600}
    .quicknav-bento{display:grid;grid-template-columns:1.35fr 1fr 1fr;grid-template-rows:repeat(2,76px);gap:8px}
    .nav-feature{grid-row:span 2;position:relative;overflow:hidden;border-radius:var(--r);padding:14px;display:flex;flex-direction:column;justify-content:flex-end;gap:5px;color:#fff;text-decoration:none;box-shadow:0 18px 38px -30px rgba(0,0,0,.7)}
    .nav-feature::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(0,0,0,.28))}
    .nav-feature-icon{position:relative;z-index:1;width:32px;height:32px;border-radius:11px;display:grid;place-items:center;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.25);color:#fff;margin-bottom:auto}
    .nav-feature-icon svg{width:18px;height:18px}
    .nav-feature strong{position:relative;z-index:1;font-size:15px;line-height:1.25;font-weight:700}
    .nav-feature small{position:relative;z-index:1;font-size:10px;color:rgba(255,255,255,.78)}
    .nav-bento-item{display:flex;flex-direction:column;justify-content:space-between;gap:6px;padding:11px;border-radius:calc(var(--r) * .8);background:var(--surface);border:1px solid rgba(127,127,127,.14);color:var(--text);text-decoration:none;min-width:0}
    .nav-bento-item.is-wide{grid-column:2/4;flex-direction:row;align-items:center;justify-content:flex-start;gap:8px}
    .nav-bento-item .nav-icon{width:30px;height:30px;border-radius:10px}
    .nav-bento-item .nav-icon svg{width:17px;height:17px}
    .nav-bento-item strong{font-size:11.5px;line-height:1.3;font-weight:600}
    .speakers-card,.timeline-card{padding:16px}
    .section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
    .section-head h2{margin:0 0 4px}
    .section-head p{margin:0;font-size:12px;line-height:1.65;color:var(--muted)}
    .section-head>span{font-size:11px;color:var(--muted);white-space:nowrap;flex:none}
    .speaker-grid{display:grid;gap:9px}
    .speaker-grid.double{grid-template-columns:1fr 1fr}
    .speaker-grid.single{grid-template-columns:1fr}
    .speaker{display:flex;gap:10px;padding:11px;border-radius:calc(var(--r) * .7);background:color-mix(in srgb, var(--surface) 84%, var(--soft));border:1px solid rgba(127,127,127,.12)}
    .speaker-grid.double .speaker{flex-direction:column;align-items:flex-start;gap:7px}
    .speaker-avatar{width:46px;height:46px;flex:none;border-radius:50%;overflow:hidden;display:grid;place-items:center;color:#fff;font-size:15px;font-weight:700;box-shadow:0 6px 16px -10px rgba(0,0,0,.5)}
    .speaker-grid.double .speaker-avatar{width:40px;height:40px;font-size:14px}
    .speaker-avatar img{width:100%;height:100%;object-fit:cover}
    .speaker-info{min-width:0}
    .speaker-info strong{display:block;font-size:13.5px;line-height:1.4}
    .speaker-info em{display:block;font-style:normal;font-size:10.5px;color:var(--muted);margin-top:1px}
    .speaker-info p{margin:4px 0 0;font-size:11px;line-height:1.6;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .speaker-grid.double .speaker-info p{-webkit-line-clamp:2}
    .tl-list{margin-top:4px}
    .tl-item{display:grid;grid-template-columns:44px 16px 1fr;gap:8px;padding-bottom:16px}
    .tl-item:last-child{padding-bottom:0}
    .tl-time{font-size:11.5px;font-weight:700;color:var(--accent);padding-top:2px;font-variant-numeric:tabular-nums}
    .tl-rail{position:relative;display:flex;justify-content:center}
    .tl-rail:before{content:"";position:absolute;top:9px;bottom:-10px;width:2px;background:rgba(127,127,127,.18)}
    .tl-item:last-child .tl-rail:before{display:none}
    .tl-dot{width:9px;height:9px;border-radius:50%;background:var(--accent);margin-top:5px;position:relative;z-index:1;box-shadow:0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent)}
    .tl-body h3{font-size:13.5px;line-height:1.5;margin:0;font-weight:650}
    .tl-body p{margin:3px 0 0;font-size:11.5px;line-height:1.65;color:var(--muted)}
    .tl-video{display:inline-flex;align-items:center;gap:5px;margin-top:7px;padding:5px 9px;border-radius:7px;background:color-mix(in srgb, var(--soft) 70%, transparent);color:var(--text);font-size:10.5px;text-decoration:none;border:1px solid rgba(127,127,127,.14)}
    .tl-video.is-empty{color:var(--muted);border-style:dashed}
    .tl-play{font-size:8px;color:var(--accent)}
    .link-card{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px;text-decoration:none;color:inherit}
    .link-card h3{font-size:15px;margin:0 0 4px;font-weight:700}
    .link-card p{font-size:12px}
    .link-card .url{font-size:11px;color:var(--accent);word-break:break-all}
    .link-card .url.is-empty{color:var(--muted)}
    .link-card .arrow{font-size:18px;color:var(--accent)}
    footer{padding:26px 4px 34px;text-align:center;font-size:10.5px;line-height:1.8;color:var(--muted)}
    .preview .blk{cursor:pointer}
    .preview .blk:hover{outline:2px dashed rgba(139,92,246,.55);outline-offset:3px;border-radius:calc(var(--r) + 3px)}
    .preview a,.preview .cta{pointer-events:none}
    @media (max-width:360px){.items.double{grid-template-columns:1fr}}
  `

  const blocks = page.blocks.map((block, i) => blockHTML(block, page, options, i)).join('\n')

  const countdownScript = hasCountdown
    ? `<script>(function(){var nodes=document.querySelectorAll('[data-live-at]');function tick(){for(var i=0;i<nodes.length;i++){var el=nodes[i];var t=new Date(el.getAttribute('data-live-at')).getTime();if(!t)continue;var d=t-Date.now();if(d<=0){el.textContent='直播即将开始';continue}var day=Math.floor(d/86400000),hour=Math.floor(d/3600000)%24,min=Math.floor(d/60000)%60;el.textContent=(day>0?day+' 天 ':'')+hour+' 小时 '+min+' 分'}}tick();setInterval(tick,30000)})()</script>`
    : ''

  const pickScript = options.interactive
    ? `<script>
document.addEventListener('click',function(e){
  var watch=e.target.closest('[data-watch]');
  if(watch){e.preventDefault();var url=watch.getAttribute('data-watch');try{parent.postMessage({source:'chaohaoda-preview',type:'watch',url:url},'*')}catch(err){}return}
  var el=e.target.closest('[data-block]');
  if(!el)return;
  e.preventDefault();
  document.querySelectorAll('.blk.sel').forEach(function(n){n.classList.remove('sel')});
  el.classList.add('sel');
  try{parent.postMessage({source:'chaohaoda-preview',blockId:el.getAttribute('data-block')},'*')}catch(err){}
});
window.addEventListener('message',function(e){
  var data=e.data||{};
  if(data.type!=='select')return;
  document.querySelectorAll('.blk.sel').forEach(function(n){n.classList.remove('sel')});
  var target=document.querySelector('[data-block="'+String(data.id).replace(/"/g,'')+'"]');
  if(target){target.classList.add('sel');if(data.scroll!==false){try{target.scrollIntoView({behavior:'smooth',block:'nearest'})}catch(err){target.scrollIntoView()}}}
});
</script>`
    : ''

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.name || '抄好搭页面')}</title>
<style>${css}</style>
</head>
<body class="${bodyClass}">
${backgroundLayer}
<main>
${blocks}
<footer>本页由「抄好搭」AI 生成 · 具体安排以主办方最终信息为准</footer>
</main>
${countdownScript}
${pickScript}
</body>
</html>`
}
