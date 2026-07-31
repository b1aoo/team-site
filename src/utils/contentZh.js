const THEME_CATEGORY_NAMES_ZH = Object.freeze({
  Themes: '主题',
  'Encounter Counters': '遇敌计数器',
  'Pokemon Textures': '宝可梦贴图',
  Other: '其他资源',
})

export function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ''))
}

export function chineseOrFallback(value, fallback) {
  return hasChineseText(value) ? value : fallback
}

const NATURE_NAMES_ZH = Object.freeze({
  Lonely: '孤独', Brave: '勇敢', Adamant: '固执', Naughty: '顽皮', Bold: '大胆', Relaxed: '悠闲',
  Impish: '淘气', Lax: '乐天', Timid: '胆小', Hasty: '急躁', Jolly: '爽朗', Naive: '天真',
  Modest: '内敛', Mild: '慢吞吞', Quiet: '冷静', Rash: '马虎', Calm: '沉着', Gentle: '温和',
  Sassy: '自大', Careful: '慎重', Hardy: '勤奋', Docile: '坦率', Serious: '认真', Bashful: '害羞', Quirky: '浮躁',
})

export function translateNatureName(nature) {
  return NATURE_NAMES_ZH[nature] || nature || '未指定'
}

export function formatCommunityEventTitle(title) {
  return chineseOrFallback(title, 'Team Synergy 社区活动')
}

export function formatCommunityEventText(value, fallback = '详细信息请向活动主办方确认。') {
  return chineseOrFallback(value, value ? fallback : '')
}

export function translateThemeCategory(category) {
  return THEME_CATEGORY_NAMES_ZH[category] || category || '其他资源'
}

// 主题资料由站外管理端维护。已有中文文案原样保留；英文旧资料统一显示为
// 中文说明，避免页面在新增条目时重新出现未本地化的段落。
export function formatThemeDescription(theme) {
  const description = String(theme?.description || '').trim()
  if (hasChineseText(description)) return description

  return `这是由 ${theme?.author || '社区作者'} 制作的 PokeMMO${translateThemeCategory(theme?.category)}资源。请通过下方链接查看预览、下载方式与作者说明。`
}
