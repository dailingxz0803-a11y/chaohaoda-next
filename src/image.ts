/** 把文件读成 data URL，并在客户端压缩，避免上传/存储过大 */
export async function fileToImage(file: File, max = 1280, quality = 0.85): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。')
  if (file.size > 8 * 1024 * 1024) throw new Error('图片不能超过 8MB。')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败。'))
    reader.readAsDataURL(file)
  })
  return compressImage(dataUrl, max, quality)
}

/** 等比缩放并转成 JPEG，用于参考图和 AI 封面 */
export async function compressImage(dataUrl: string, max = 1280, quality = 0.85): Promise<string> {
  if (!dataUrl.startsWith('data:image/')) return dataUrl
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('图片解析失败。'))
    element.src = dataUrl
  })
  const scale = Math.min(1, max / Math.max(image.width, image.height))
  if (scale === 1 && dataUrl.startsWith('data:image/jpeg')) return dataUrl
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return dataUrl
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/** 把模板里的本地素材路径转成 data URL，导出/分享时保持自包含 */
export async function hydratePageAssets(page: import('./types').Page): Promise<import('./types').Page> {
  const cache = new Map<string, string>()

  async function toDataUrl(path: string): Promise<string> {
    if (!path.startsWith('/media/')) return path
    if (cache.has(path)) return cache.get(path) as string
    try {
      const response = await fetch(path)
      if (!response.ok) return path
      const blob = await response.blob()
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => resolve(path)
        reader.readAsDataURL(blob)
      })
      cache.set(path, dataUrl)
      return dataUrl
    } catch {
      return path
    }
  }

  const blocks = await Promise.all(
    page.blocks.map(async (block) => ({
      ...block,
      cover: block.cover ? await toDataUrl(block.cover) : block.cover,
      items: block.items
        ? await Promise.all(
            block.items.map(async (item) => ({
              ...item,
              cover: item.cover ? await toDataUrl(item.cover) : item.cover,
            })),
          )
        : block.items,
    })),
  )
  const backgroundImage = page.backgroundImage ? await toDataUrl(page.backgroundImage) : page.backgroundImage
  return { ...page, backgroundImage, blocks }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解析失败。'))
    image.src = src
  })
}

async function cropTo(src: string, width: number, height: number, focusX: number, focusY: number): Promise<string> {
  const image = await loadImage(src)
  const scale = Math.max(width / image.width, height / image.height)
  const sw = width / scale
  const sh = height / scale
  const sx = Math.max(0, (image.width - sw) * focusX)
  const sy = Math.max(0, (image.height - sh) * focusY)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return src
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', 0.86)
}

/** 把参考图裁成头图与卡片封面，填进生成页面的空封面里 */
export async function applyReferenceAssets(page: import('./types').Page, image: string): Promise<import('./types').Page> {
  const [hero, cardA, cardB, cardC] = await Promise.all([
    cropTo(image, 1200, 675, 0.5, 0.4),
    cropTo(image, 800, 500, 0.2, 0.5),
    cropTo(image, 800, 500, 0.5, 0.5),
    cropTo(image, 800, 500, 0.8, 0.5),
  ])
  const cards = [cardA, cardB, cardC]
  let cardIndex = 0

  const blocks = page.blocks.map((block) => {
    if (block.type === 'hero') {
      return { ...block, cover: hero }
    }
    if (block.type === 'collection' && block.items) {
      return {
        ...block,
        items: block.items.map((item) => {
          if (item.cover) return item
          const cover = cards[cardIndex % cards.length]
          cardIndex += 1
          return { ...item, cover }
        }),
      }
    }
    return block
  })

  return { ...page, blocks }
}
