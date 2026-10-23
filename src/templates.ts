import type { Block, BlockType, CollectionItem, Page, Theme } from './types'
import { uid } from './lib'

export interface TemplateMeta {
  id: string
  name: string
  tagline: string
  glyph: string
  category: '活动' | '课程' | '品牌'
  theme: Theme
}

const THEMES: Record<string, Theme> = {
  event: { background: '#F3F7FB', surface: '#FFFFFF', text: '#152230', muted: '#5E6E7E', accent: '#1D6FB8', soft: '#E2EDF8' },
  summit: { background: '#070B14', surface: '#0F1725', text: '#EAF4FF', muted: '#93A8C2', accent: '#E0B34C', soft: '#1A2434' },
  launch: { background: '#060B13', surface: '#0F1725', text: '#EAF4FF', muted: '#93A8C2', accent: '#37BDF5', soft: '#13263B' },
  concert: { background: '#0B0710', surface: '#171020', text: '#F7F0FF', muted: '#B4A6C6', accent: '#B57BFF', soft: '#2B1A42' },
  bootcamp: { background: '#FBF6EC', surface: '#FFFFFF', text: '#2B2116', muted: '#7C6C58', accent: '#D97706', soft: '#F7E6CC' },
  health: { background: '#F7F4EC', surface: '#FFFDF7', text: '#2A2A20', muted: '#6E6A5A', accent: '#3F7D5A', soft: '#E4EEDF' },
  sale: { background: '#FFF4EC', surface: '#FFFFFF', text: '#351B12', muted: '#8A6A5B', accent: '#E23A1E', soft: '#FFE2D2' },
  talk: { background: '#0C1724', surface: '#13263A', text: '#F4EFE4', muted: '#9FB0C0', accent: '#E7C58C', soft: '#1B3049' },
}

export const TEMPLATE_META: TemplateMeta[] = [
  { id: 'event', name: '投教课堂', tagline: '讲师阵容 · 课程合集', glyph: '▤', category: '课程', theme: THEMES.event },
  { id: 'summit', name: '行业峰会', tagline: '全天议程 · 嘉宾阵容', glyph: '◎', category: '活动', theme: THEMES.summit },
  { id: 'launch', name: '新品发布会', tagline: '倒计时 · 议程 · 嘉宾', glyph: '✦', category: '品牌', theme: THEMES.launch },
  { id: 'concert', name: '演唱会现场', tagline: '舞台预约 · 精彩切片', glyph: '▷', category: '活动', theme: THEMES.concert },
  { id: 'bootcamp', name: '7 天训练营', tagline: '每日任务 · 直播补课', glyph: '◫', category: '课程', theme: THEMES.bootcamp },
  { id: 'health', name: '中医讲堂', tagline: '专家卡片 · 直播课程', glyph: '❖', category: '课程', theme: THEMES.health },
  { id: 'sale', name: '双11知识盛宴', tagline: '满减 · 秒杀 · 课程列表', glyph: '◈', category: '课程', theme: THEMES.sale },
  { id: 'talk', name: '长谈', tagline: '对谈 · 往期节目 · 金句', glyph: '❝', category: '活动', theme: THEMES.talk },
]

function block(type: BlockType, data: Omit<Block, 'id' | 'type'>): Block {
  return { id: uid('blk'), type, ...data }
}

function item(
  title: string,
  body: string,
  extra: Partial<Omit<CollectionItem, 'id' | 'title'>> = {},
) {
  return { id: uid('item'), title, body, ...extra }
}

export function quicknav(entries: Array<[string, string]>): Block {
  return block('quicknav', {
    title: '',
    items: entries.map(([title, icon]) => item(title, '', { icon })),
  })
}

export function makePage(templateId: string): Page {
  const meta = TEMPLATE_META.find((template) => template.id === templateId) ?? TEMPLATE_META[0]
  const base: Page = {
    id: uid('page'),
    name: meta.name,
    template: meta.id,
    theme: { ...meta.theme },
    font: 'sans',
    radius: 18,
    padding: 16,
    gap: 14,
    blocks: [],
    updatedAt: Date.now(),
  }

  switch (meta.id) {
    case 'summit':
      return {
        ...base,
        name: '2026 增长峰会',
        backgroundImage: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80',
        backgroundOpacity: 0.24,
        font: 'serif',
        radius: 14,
        blocks: [
          block('hero', {
            heroLayout: 'brief',
            cover: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80',
            eyebrow: '2026 行业峰会',
            title: '增长的下一种可能',
            body: '6 位一线操盘手，用一天时间拆解产品、内容与增长的真实方法。',
            tags: ['主论坛', '工作坊', '圆桌'],
          }),
          block('timeline', {
            title: '大会议程',
            body: '全天 5 个环节，每个环节结束后更新回放。',
            items: [
              item('开幕演讲 · 行业一年回顾', '过去一年最重要的三个变化。', { time: '09:30', url: '/media/demo-bunny.mp4' }),
              item('主题对谈 · 产品与增长', '从需求验证到规模化。', { time: '10:10', url: '/media/demo-flower.mp4' }),
              item('圆桌 · AI 如何改变内容生产', '工具、流程与团队协作。', { time: '11:00' }),
              item('实战工作坊 · 增长实验设计', '现场拆解一个真实实验。', { time: '13:30' }),
              item('闭幕演讲 · 明年的三个机会', '给团队的行动清单。', { time: '15:00' }),
            ],
          }),
          block('speakers', {
            title: '演讲嘉宾',
            body: '来自平台、品牌与投资机构的实践者。',
            layout: 'double',
            items: [
              item('张珂', '增长平台创始人', { subtitle: '增长平台创始人', body: '服务过 200+ 消费品牌，专注增长实验与组织效率。', cover: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
              item('李沐', '产品负责人', { subtitle: '产品负责人', body: '从 0 到 1 搭建过三款内容产品，擅长需求验证。', cover: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
              item('王砚', '投资人', { subtitle: '早期投资人', body: '关注内容与 AI 应用，投过 20 余家早期公司。', cover: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
              item('赵清', '内容研究员', { subtitle: '内容研究员', body: '研究内容生产流程与创作者生态。', cover: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
            ],
          }),
          block('collection', {
            title: '往期回顾',
            body: '峰会现场回放，按场次整理。',
            layout: 'double',
            items: [
              item('2025 增长峰会 · 主论坛', '全天主论坛回放。', { duration: '3:20:00', cover: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80' }),
              item('圆桌 · 内容与增长', '四位嘉宾的现场讨论。', { duration: '48:20', cover: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80' }),
              item('工作坊 · 实验设计', '现场练习与点评。', { duration: '1:12:00' }),
            ],
          }),
          block('link', { title: '报名通道', body: '线下席位有限，报名后收到确认短信（待配置）。', url: '' }),
        ],
      }
    case 'launch':
      return {
        ...base,
        name: '轻量旗舰 · 新品发布会',
        backgroundImage: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
        backgroundOpacity: 0.2,
        font: 'sans',
        blocks: [
          block('hero', {
            cover: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
            eyebrow: '新品首发',
            title: '轻量旗舰 · 新品发布会',
            body: '10 月 28 日 20:00，下一代移动影像与续航体验。',
            tags: ['直播', '新品', '影像'],
          }),
          block('countdown', {
            title: '距发布会开始',
            body: '预约后可在开播前收到提醒（演示环境不下发通知）。',
            liveAt: '2026-10-28T20:00',
          }),
          block('timeline', {
            title: '发布会流程',
            body: '每个环节结束后可单独回看。',
            items: [
              item('开场 · 为什么做轻量旗舰', '产品负责人开场。', { time: '20:00', url: '/media/demo-flower.mp4' }),
              item('影像 · 新一代计算摄影', '实拍样张与现场演示。', { time: '20:10', url: '/media/demo-bunny.mp4' }),
              item('续航 · 一天半的真实体验', '续航测试与充电方案。', { time: '20:40' }),
              item('售价与开售', '版本、价格与首销权益。', { time: '21:00' }),
            ],
          }),
          block('speakers', {
            title: '主讲人',
            body: '产品与研发团队现场讲解。',
            layout: 'double',
            items: [
              item('陈屿', '产品负责人', { subtitle: '产品负责人', body: '负责旗舰产品线规划与定义。', cover: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
              item('林深', '影像研发', { subtitle: '影像研发负责人', body: '主导计算摄影与镜头模组。', cover: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
              item('周遥', '电池与续航', { subtitle: '硬件研发', body: '负责电池与快充方案。', cover: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
            ],
          }),
          block('collection', {
            title: '往期发布会',
            body: '看看上一代产品是怎么发布的。',
            layout: 'single',
            items: [
              item('上一代旗舰发布会', '影像与续航的第一次升级。', { duration: '42:10', cover: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80' }),
              item('设计幕后', '从草图到量产。', { duration: '08:26', cover: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80' }),
              item('用户实测合集', '真实场景下的续航表现。', { duration: '12:04' }),
            ],
          }),
        ],
      }
    case 'concert':
      return {
        ...base,
        name: '2026 苏州演唱会',
        backgroundImage: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80',
        backgroundOpacity: 0.26,
        blocks: [
          block('hero', {
            cover: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80',
            eyebrow: '现场直播',
            title: '2026 苏州演唱会',
            body: '10 月 24 日 19:30，苏州奥体中心，现场直击。',
            tags: ['现场', '高清', '沉浸式'],
          }),
          block('reservation', {
            title: '开演提醒',
            body: '开场前一小时开放入场，预约后可直接进入直播间。',
            speaker: '主舞台',
            liveAt: '2026-10-24T19:30',
          }),
          block('collection', {
            title: '精彩切片',
            body: '演出结束后持续更新，可回看。',
            layout: 'masonry',
            items: [
              item('开场曲《星辰大海》', '全场大合唱的开场。', { duration: '04:32', cover: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80' }),
              item('安可《夜航》', '返场第一首。', { duration: '05:10', cover: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80' }),
              item('后台花絮', '演出前的最后一次彩排。', { duration: '03:18' }),
              item('观众合唱', '把现场交给观众。', { duration: '06:02' }),
            ],
          }),
          block('text', { title: '观演须知', body: '直播支持手机与电脑观看；回放保留 7 天。请勿录制传播。' }),
          block('link', { title: '加入演出提醒群', body: '开播前会在群内提醒（待补充群链接）。', url: '' }),
        ],
      }
    case 'bootcamp':
      return {
        ...base,
        name: '7 天训练营',
        backgroundImage: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
        backgroundOpacity: 0.2,
        blocks: [
          block('quicknav', {
            title: '',
            navStyle: 'pills',
            items: [
              item('今日任务', '', { icon: 'check' }),
              item('课表', '', { icon: 'calendar' }),
              item('榜单', '', { icon: 'chart' }),
              item('补课', '', { icon: 'replay' }),
            ],
          }),
          block('hero', {
            heroLayout: 'brief',
            cover: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
            eyebrow: '7 天训练营',
            title: '7 天，把方法练成习惯',
            body: '每天 20 分钟任务 + 晚间直播答疑，按自己的节奏完成。',
            tags: ['每日任务', '直播补课', '可回看'],
          }),
          block('text', { title: '怎么学', body: '每天先看任务卡，再完成练习；晚上 20:00 有直播补课，错过可看回放。' }),
          block('collection', {
            title: '每日任务',
            body: '按天解锁，完成后可继续下一天。',
            layout: 'single',
            items: [
              item('Day 1 · 找到你的起点', '用 10 分钟写下一个真实目标。', { duration: '06:20', cover: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80' }),
              item('Day 2 · 拆解关键动作', '把目标拆成三个可执行动作。', { duration: '08:15', cover: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80' }),
              item('Day 3 · 第一次复盘', '记录一次练习，找到卡点。', { duration: '07:40' }),
              item('Day 4 · 稳定节奏', '把练习放进固定时间段。', { duration: '09:05' }),
            ],
          }),
          block('live', {
            title: '今晚直播补课',
            body: '助教带着做一遍今天的任务，现场答疑。',
            speaker: '训练营助教',
            liveAt: '2026-10-24T20:00',
          }),
          block('reservation', {
            title: '结营直播',
            body: '第 7 天晚上，一起复盘这一周。',
            liveAt: '2026-10-30T20:00',
          }),
        ],
      }
    case 'health':
      return {
        ...base,
        name: '中医讲堂 · 秋季调养',
        backgroundImage: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
        backgroundOpacity: 0.18,
        font: 'serif',
        blocks: [
          block('hero', {
            heroLayout: 'brief',
            cover: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
            eyebrow: '中医讲堂',
            title: '秋季怎么调养，专家讲清楚',
            body: '从饮食、作息到常见误区，用三次直播课建立自己的调养框架。',
            tags: ['公开课', '直播', '可回看'],
          }),
          block('speakers', {
            title: '主讲专家',
            body: '两位临床经验丰富的中医师。',
            layout: 'single',
            items: [
              item('周明远', '主任中医师', { subtitle: '主任中医师 · 30 年临床', body: '擅长脾胃调理与四季养生，长期从事中医科普。', cover: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
              item('许知秋', '中医内科医生', { subtitle: '中医内科医生', body: '关注女性与中老年群体的日常调养。', cover: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
            ],
          }),
          block('text', {
            title: '这堂课讲什么',
            body: '第一讲：秋季常见问题与饮食原则；第二讲：作息与运动；第三讲：常见误区答疑。',
          }),
          block('live', {
            title: '第一讲 · 秋季饮食原则',
            body: '专家直播讲解，课后留 15 分钟答疑。',
            speaker: '周明远',
            liveAt: '2026-10-26T19:30',
          }),
          block('collection', {
            title: '往期课程',
            body: '按主题整理，可单独回看。',
            layout: 'single',
            items: [
              item('四季调养总论', '建立整体框架。', { duration: '32:10', cover: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80' }),
              item('脾胃与饮食', '常见问题的饮食调整。', { duration: '28:40', cover: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80' }),
              item('睡眠与作息', '从作息看身体状态。', { duration: '25:15' }),
            ],
          }),
        ],
      }
    case 'sale':
      return {
        ...base,
        name: '双11知识盛宴',
        backgroundImage: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
        backgroundOpacity: 0.2,
        radius: 20,
        blocks: [
          block('quicknav', {
            title: '',
            navStyle: 'bento',
            items: [
              item('限时秒杀', '', { icon: 'ticket', cover: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80' }),
              item('全部课程', '', { icon: 'course' }),
              item('领券中心', '', { icon: 'gift' }),
              item('热销榜', '', { icon: 'chart' }),
            ],
          }),
          block('hero', {
            cover: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
            eyebrow: '知识付费 · 年度知识盛宴',
            title: '全场满减，年度超值购',
            body: '10 月 21 日 - 11 月 13 日，好课 5 折起，每日 0 点限量秒杀。',
            tags: ['满 300 减 50', '每日秒杀', '新课首发'],
          }),
          block('stats', {
            title: '',
            items: [
              item('10', '', { subtitle: '我的积分' }),
              item('1 天', '', { subtitle: '已连续签到' }),
              item('5 折', '', { subtitle: '今日秒杀' }),
            ],
          }),
          block('countdown', {
            title: '双11秒杀日历',
            body: '每日 0 点更新，5 折好课限量开抢。',
            liveAt: '2026-11-11T00:00:00+08:00',
            countdownLabel: '距双11开抢',
          }),
          block('collection', {
            title: '今日秒杀',
            body: '每天 0 点更新，售完即止。',
            layout: 'sale',
            items: [
              item('关系沟通课 · 30 讲', '这一次，让好人赢得漂亮。', {
                price: '149',
                originalPrice: '299',
                cta: '抢',
                badge: '秒杀价',
                cover: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80&h=400&crop=faces',
              }),
              item('心理学通识 · 年度日更', '系统学一遍心理学。', {
                price: '149',
                originalPrice: '299',
                cta: '抢',
                badge: '秒杀价',
                cover: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80&h=400&crop=faces',
              }),
              item('博弈论思维 · 50 讲', '会识局、能破局、善布局。', {
                price: '84',
                originalPrice: '169',
                cta: '抢',
                badge: '秒杀价',
                cover: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80&h=400&crop=faces',
              }),
              item('职场沟通 · 30 讲', '只要这么谈，做事都不难。', {
                price: '49',
                originalPrice: '99',
                cta: '抢',
                badge: '秒杀价',
                cover: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80&h=400&crop=faces',
              }),
            ],
          }),
          block('text', {
            title: '更多好课陆续上线',
            body: '活动期间每天 0 点更新秒杀清单；已经购买过的课程，可以在「我的」里继续学习。',
          }),
        ],
      }
    case 'talk':
      return {
        ...base,
        name: '长谈 · 知识对谈',
        backgroundImage: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1200&q=80',
        backgroundOpacity: 0.26,
        font: 'serif',
        radius: 16,
        blocks: [
          block('hero', {
            heroLayout: 'brief',
            cover: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1200&q=80',
            eyebrow: '长谈 · 第 71 期',
            title: '以一灯传诸灯，终至万灯皆明',
            body: '李杰 × 脱不花：当我们重新连接',
            tags: ['长谈', '对谈', '知识'],
          }),
          block('live', {
            title: '当我们重新连接',
            body: '第 71 期 · 已有 8.0 万人看过',
            cover: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=1200&q=80',
            url: '/watch?type=file&url=%2Fmedia%2Fdemo-bunny.mp4&title=%E5%BD%93%E6%88%91%E4%BB%AC%E9%87%8D%E6%96%B0%E8%BF%9E%E6%8E%A5',
            ctaLabel: '观看本期',
            speaker: '李杰 × 脱不花',
          }),
          block('collection', {
            title: '往期节目',
            body: '每一次对谈，都是一次重新连接。',
            layout: 'triple',
            items: [
              item('第 70 期 · 只此一个我', '吴士宏 × 脱不花：在不确定里安放自己。', {
                duration: '58:20',
                cover: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80&h=400&crop=faces',
              }),
              item('第 69 期 · 师父教我品美食', '李作民 × 脱不花：一顿饭里的学问。', {
                duration: '52:10',
                cover: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80&h=400&crop=faces',
              }),
              item('第 68 期 · 坚决捍卫不改变', '毛尖 × 方希：把时间花在值得的事上。', {
                duration: '49:40',
                cover: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80&h=400&crop=faces',
              }),
            ],
          }),
          block('text', {
            title: '关于长谈',
            body: '一档关于选择、判断与长期主义的对谈节目。每期邀请一位朋友，把一个问题聊透。',
          }),
        ],
      }
    default:
      return {
        ...base,
        name: '投资者教育课堂',
        backgroundImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
        backgroundOpacity: 0.18,
        blocks: [
          block('hero', {
            heroLayout: 'brief',
            cover: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
            eyebrow: '投资者教育',
            title: '读懂风险，再认识投资',
            body: '从风险等级到基金基础，用 4 节短课建立自己的判断框架。',
            tags: ['入门', '风险认知', '长期视角'],
          }),
          block('speakers', {
            title: '讲师阵容',
            body: '三位一线投教讲师，覆盖研究、配置与风险。',
            layout: 'double',
            items: [
              item('林知远', '首席投教讲师', { subtitle: '首席投教讲师', body: '十年公募基金研究，擅长把复杂产品讲简单。', cover: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
              item('周岚', '基金研究员', { subtitle: '基金研究员', body: '专注资产配置与组合波动。', cover: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
              item('陈默', '风险管理顾问', { subtitle: '风险管理顾问', body: '负责投资者适当性与风险测评。', cover: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80&h=400&crop=faces' }),
            ],
          }),
          block('live', {
            title: '本期直播｜认识你的风险承受能力',
            body: '讲师结合真实问卷，讲清风险测评怎么看、怎么用。',
            speaker: '林知远 · 投教讲师',
            liveAt: '2026-10-24T19:30',
            viewers: '12800',
            tags: ['公开课', '可回看'],
          }),
          block('collection', {
            title: '课程合集',
            body: '按顺序看，每节 10 分钟。',
            layout: 'single',
            items: [
              item('风险等级怎么看', '五个等级分别对应什么。', { duration: '12:40', cover: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80', plays: '12345', publishedAt: '2026-10-18', tags: ['入门', '风险'] }),
              item('基金基础 5 讲', '从净值到费率。', { duration: '15:20', cover: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80' }),
              item('长期投资的三个习惯', '少看盘，多复盘。', { duration: '09:50', cover: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80' }),
            ],
          }),
          block('reservation', {
            title: '下期直播预约',
            body: '每周四晚 19:30，提前预约不错过。',
            liveAt: '2026-10-31T19:30',
          }),
        ],
      }
  }
}

export function blankPage(): Page {
  return makePage('event')
}

/** 离线/未配置 AI 时的本地生成：按关键词挑模板并替换标题 */
export function demoGenerate(prompt: string): Page {
  const text = prompt.toLowerCase()
  let template = 'event'
  if (/峰会|论坛|大会/.test(text)) template = 'summit'
  else if (/演唱会|音乐|演出|livehouse|乐队/.test(text)) template = 'concert'
  else if (/发布|新品|科技|产品|手机/.test(text)) template = 'launch'
  else if (/训练营|打卡|学习|7 天|七天/.test(text)) template = 'bootcamp'
  else if (/中医|养生|健康/.test(text)) template = 'health'
  else if (/双11|双十一|秒杀|大促|购课|知识盛宴/.test(text)) template = 'sale'
  else if (/长谈|对谈|播客|访谈/.test(text)) template = 'talk'
  const page = makePage(template)
  page.id = uid('page')
  page.name = prompt.trim().slice(0, 24) || page.name
  page.updatedAt = Date.now()
  return page
}
