import type { Page } from './types'
import { generateCover } from './api'
import { compressImage } from './image'

export interface AssetTarget {
  kind: 'hero' | 'cover'
  blockId: string
  itemId?: string
  title: string
  initialCover: string
  prompt: string
}

/**
 * 从页面内容里推断需要哪些配图：主视觉、直播封面、合集封面，总共最多三张。
 * 参考图的整体气质会作为风格提示，但画面内容按当前页面文案重新生成。
 */
export function buildAssetTargets(page: Page, styleNote = ''): AssetTarget[] {
  const hero = page.blocks.find((block) => block.type === 'hero')
  const style = `整体气质：${styleNote || page.name}。主色 ${page.theme.accent}。干净、现代、有质感，真实摄影感；画面中不要出现任何文字、水印、logo 或品牌标识。`
  const targets: AssetTarget[] = []

  if (hero) {
    targets.push({
      kind: 'hero',
      blockId: hero.id,
      title: hero.title,
      initialCover: hero.cover ?? '',
      prompt: `为移动端内容页「${page.name}」生成一张主视觉背景图。主题：${hero.title}。${hero.body ?? ''}。构图大气，主体明确，横向，画面右侧或上方留出标题空间。${style}`,
    })
  }

  const mediaBlocks = page.blocks.filter((block) =>
    ['live', 'reservation', 'countdown'].includes(block.type),
  )
  for (const block of mediaBlocks) {
    targets.push({
      kind: 'cover',
      blockId: block.id,
      title: block.title,
      initialCover: block.cover ?? '',
      prompt: `为「${page.name}」中的直播「${block.title}」生成一张封面图。${block.body ?? ''}。横向构图，主体明确，能体现直播内容。${style}`,
    })
  }

  const collectionItems = page.blocks
    .filter((block) => block.type === 'collection')
    .flatMap((block) => (block.items ?? []).slice(0, 2).map((item) => ({ block, item })))

  for (const { block, item } of collectionItems) {
    targets.push({
      kind: 'cover',
      blockId: block.id,
      itemId: item.id,
      title: item.title,
      initialCover: item.cover ?? '',
      prompt: `为「${page.name}」中的视频「${item.title}」生成一张封面图。${item.body ?? ''}。方形构图，主体明确，适合小尺寸卡片。${style}`,
    })
  }

  return targets.slice(0, 3)
}

export async function generateAsset(target: AssetTarget): Promise<string> {
  const { image } = await generateCover(target.prompt)
  return compressImage(image, 1024, 0.84)
}
