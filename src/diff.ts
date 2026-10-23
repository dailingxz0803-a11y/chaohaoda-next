import type { Page } from './types'

function short(text: string | undefined, max = 14): string {
  const value = (text ?? '').trim()
  return value.length > max ? `${value.slice(0, max)}…` : value
}

/** 对比两个页面，生成用户能看懂的改动清单 */
export function describeChanges(before: Page | null, after: Page): string[] {
  if (!before) {
    return [`生成了 ${after.blocks.length} 个组件`, `页面标题：${short(after.name, 20)}`]
  }
  const changes: string[] = []
  const beforeMap = new Map(before.blocks.map((b) => [b.id, b]))
  const afterMap = new Map(after.blocks.map((b) => [b.id, b]))

  const added = after.blocks.filter((b) => !beforeMap.has(b.id))
  const removed = before.blocks.filter((b) => !afterMap.has(b.id))

  if (added.length) changes.push(`新增 ${added.length} 个组件：${added.map((b) => short(b.title)).join('、')}`)
  if (removed.length) changes.push(`移除 ${removed.length} 个组件：${removed.map((b) => short(b.title)).join('、')}`)

  const same = (a?: string, b?: string) => (a ?? '') === (b ?? '')
  const liveTypes = new Set(['live', 'reservation', 'countdown'])
  for (const block of after.blocks) {
    const old = beforeMap.get(block.id)
    if (!old) continue
    if (old.title !== block.title) changes.push(`${short(old.title, 10)} → ${short(block.title)}`)
    if (!same(old.body, block.body)) changes.push(`说明文字已更新：${short(block.title, 10)}`)
    if (liveTypes.has(block.type) && !same(old.liveAt, block.liveAt)) changes.push(`开播时间已更新：${short(block.title, 10)}`)
    if (block.type === 'collection' && old.layout !== block.layout) changes.push(`合集排版已调整：${short(block.title, 10)}`)
    if ((old.items?.length ?? 0) !== (block.items?.length ?? 0)) changes.push(`合集条目数：${old.items?.length ?? 0} → ${block.items?.length ?? 0}`)
  }

  const beforeOrder = before.blocks.map((b) => b.id).join(',')
  const afterOrder = after.blocks.map((b) => b.id).join(',')
  if (beforeOrder !== afterOrder && added.length === 0 && removed.length === 0) changes.push('组件顺序已调整')

  const themeKeys: (keyof Page['theme'])[] = ['background', 'surface', 'text', 'muted', 'accent', 'soft']
  if (themeKeys.some((key) => before.theme[key] !== after.theme[key])) changes.push('页面配色已更新')
  if (before.font !== after.font) changes.push(`字体已切换为 ${after.font}`)
  if (before.radius !== after.radius) changes.push(`卡片圆角：${before.radius} → ${after.radius}px`)
  if (before.padding !== after.padding) changes.push(`页面边距：${before.padding} → ${after.padding}px`)
  if (before.gap !== after.gap) changes.push(`组件间距：${before.gap} → ${after.gap}px`)
  if (before.name !== after.name) changes.push(`页面名称：「${after.name}」`)

  return changes.length ? changes : []
}
