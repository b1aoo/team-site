import { useMemo, useState } from 'react'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import tierPokemon from '../../data/tier_pokemon.json'
import { translatePokemonName } from '../../utils/pokemon'
import styles from './PlayerCardGenerator.module.css'

const RARE_TIERS = ['Tier 0', 'Tier 1', 'Tier 2']
const DEFAULT_EXPORT_OPTIONS = {
  totalEncounters: true,
  totalShinies: true,
  averageEncounterPerShiny: true,
  totalEggEncounters: true,
  totalAlphaEncounters: true,
  totalWildOtherEncounters: true,
  totalRareEncounters: true,
  totalFossilEncounters: true,
  includeTimeBreakdown: true,
  averageEncounterPerHour: true,
  topSeen: true,
  topRareSeen: true,
  highestIvShiny: true,
  lowestIvShiny: true,
  highestEncounterShiny: true,
  lowestEncounterShiny: true,
}

const EXPORT_FIELDS = [
  { key: 'totalEncounters', label: '总遭遇数' },
  { key: 'totalShinies', label: '闪光总数' },
  { key: 'averageEncounterPerShiny', label: '每只闪光平均遭遇' },
  { key: 'totalEggEncounters', label: '孵蛋次数' },
  { key: 'totalAlphaEncounters', label: '头目遭遇数' },
  { key: 'totalWildOtherEncounters', label: '其他野生遭遇（非群聚）' },
  { key: 'totalRareEncounters', label: '稀有遭遇数' },
  { key: 'totalFossilEncounters', label: '化石遭遇数' },
  { key: 'includeTimeBreakdown', label: '显示天数／周数' },
  { key: 'averageEncounterPerHour', label: '每小时平均遭遇' },
  { key: 'topSeen', label: '遭遇最多的宝可梦' },
  { key: 'topRareSeen', label: '遭遇最多的稀有宝可梦' },
  { key: 'highestIvShiny', label: '最高个体值闪光' },
  { key: 'lowestIvShiny', label: '最低个体值闪光' },
  { key: 'highestEncounterShiny', label: '最高遇敌数闪光' },
  { key: 'lowestEncounterShiny', label: '最低遇敌数闪光' },
]

const EDITABLE_FIELDS = [
  { key: 'totalEncounters', label: '总遭遇数', type: 'number' },
  { key: 'totalShinies', label: '闪光总数', type: 'number' },
  { key: 'averageEncounterPerShiny', label: '每只闪光平均遭遇', type: 'number' },
  { key: 'totalEggEncounters', label: '孵蛋次数', type: 'number' },
  { key: 'totalAlphaEncounters', label: '头目遭遇数', type: 'number' },
  { key: 'totalWildOtherEncounters', label: '其他野生遭遇', type: 'number' },
  { key: 'totalRareEncounters', label: '稀有遭遇数', type: 'number' },
  { key: 'totalFossilEncounters', label: '化石遭遇数', type: 'number' },
  { key: 'highestIvShiny', label: '最高个体值闪光', type: 'text' },
  { key: 'lowestIvShiny', label: '最低个体值闪光', type: 'text' },
  { key: 'highestEncounterShiny', label: '最高遇敌数闪光', type: 'text' },
  { key: 'lowestEncounterShiny', label: '最低遇敌数闪光', type: 'text' },
]

function normalizeName(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\u2640/g, '-f')
    .replace(/\u2642/g, '-m')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

function formatCardNumber(value) {
  const number = Number(String(value || '').replace(/,/g, ''))
  return Number.isFinite(number) ? number.toLocaleString() : String(value || '-')
}

function formatDuration(value, label) {
  const maximumFractionDigits = Number.isInteger(value) ? 0 : 2
  return `${value.toLocaleString(undefined, { maximumFractionDigits })} ${label}`
}

function getPlayerTimeHours(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits ? Number(digits) : null
}

function getPlayerTimeBreakdown(value, includeTimeBreakdown = true) {
  const hours = getPlayerTimeHours(value)
  if (!hours) return ['-']

  const breakdown = [
    formatDuration(hours, '小时'),
  ]
  if (includeTimeBreakdown) {
    breakdown.push(formatDuration(hours / 24, '天'), formatDuration(hours / 168, '周'))
  }
  return breakdown
}

function formatAverageEncounterPerHour(totalEncounters, playerTime) {
  const hours = getPlayerTimeHours(playerTime)
  const encounters = Number(String(totalEncounters || '').replace(/,/g, ''))
  if (!hours || !Number.isFinite(encounters)) return null
  return `${(encounters / hours).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} 次遭遇／小时`
}

function hasManualOverrides(manualValues) {
  return Object.values(manualValues).some(value => String(value || '').trim())
}

function getCardValue(stats, manualValues, key) {
  const manualValue = String(manualValues[key] || '').trim()
  if (manualValue) return manualValue
  if (key === 'highestIvShiny' || key === 'lowestIvShiny' || key === 'highestEncounterShiny' || key === 'lowestEncounterShiny') {
    return formatPokemonMetric(stats[key])
  }
  return stats[key]
}

function getSection(tracker, sectionName) {
  return tracker?.[sectionName] || null
}

function getSectionTotal(tracker, sectionName) {
  return Number(getSection(tracker, sectionName)?.total_encounter || 0)
}

function getAllSections(tracker) {
  if (!tracker || typeof tracker !== 'object') return []
  return Object.entries(tracker).filter(([, section]) => section && typeof section === 'object')
}

function getUniqueHistory(tracker) {
  const seen = new Set()
  const unique = []

  getAllSections(tracker).forEach(([sectionName, section]) => {
    ;(section.history || []).forEach(entry => {
      const key = `${entry.date || 'no-date'}-${entry.species_id || normalizeName(entry.name)}`
      const existing = unique.find(item => item.key === key)
      if (existing) {
        existing.sections.add(sectionName)
        const existingGlobal = Number(existing.global_encounter)
        const entryGlobal = Number(entry.global_encounter)
        if (Number.isFinite(entryGlobal) && (!Number.isFinite(existingGlobal) || entryGlobal > existingGlobal)) {
          existing.global_encounter = entry.global_encounter
        }

        const existingSpecies = Number(existing.species_encounter)
        const entrySpecies = Number(entry.species_encounter)
        if (Number.isFinite(entrySpecies) && (!Number.isFinite(existingSpecies) || entrySpecies > existingSpecies)) {
          existing.species_encounter = entry.species_encounter
        }

        if (!existing.ivs && entry.ivs) existing.ivs = entry.ivs
        if (!existing.nature_name && entry.nature_name) existing.nature_name = entry.nature_name
        if (existing.caught !== true && entry.caught === true) existing.caught = true
        if (existing.secret_shiny !== true && entry.secret_shiny === true) existing.secret_shiny = true
        if (existing.alpha !== true && entry.alpha === true) existing.alpha = true
        return
      }
      if (!seen.has(key)) {
        seen.add(key)
        unique.push({ key, sections: new Set([sectionName]), ...entry })
      }
    })
  })

  return unique
}

function getLastShinyHistory(tracker) {
  const lastShinyHistory = getSection(tracker, 'Last Shiny')?.history
  if (!Array.isArray(lastShinyHistory)) return []

  const seen = new Set()
  return lastShinyHistory.filter(entry => {
    const key = `${entry.date || 'no-date'}-${entry.species_id || normalizeName(entry.name)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getMostSeen(tracker) {
  const speciesMap = new Map()

  getAllSections(tracker).forEach(([, section]) => {
    ;(section.data || []).forEach(row => {
      const name = row.name || `Species ${row.species_id}`
      const key = row.species_id ? `id-${row.species_id}` : normalizeName(name)
      const encounter = Number(row.total_encounter ?? row.encounter ?? 0)
      const previous = speciesMap.get(key)

      if (!previous || encounter > previous.encounter) {
        speciesMap.set(key, {
          key,
          name,
          encounter,
          speciesId: row.species_id,
          tier: null,
        })
      }
    })
  })

  return Array.from(speciesMap.values())
    .sort((a, b) => b.encounter - a.encounter)
}

function buildRareSet() {
  const rareSet = new Set()
  RARE_TIERS.forEach(tier => {
    ;(tierPokemon[tier] || []).forEach(name => rareSet.add(normalizeName(name)))
  })
  return rareSet
}

function getTierLookup() {
  const lookup = new Map()
  Object.entries(tierPokemon).forEach(([tier, names]) => {
    names.forEach(name => lookup.set(normalizeName(name), tier))
  })
  return lookup
}

function parseIvTotal(ivs) {
  if (!ivs || typeof ivs !== 'string') return null
  const values = ivs.split('/').map(value => Number(value.trim()))
  if (values.length !== 6 || values.some(value => Number.isNaN(value))) return null
  return values.reduce((sum, value) => sum + value, 0)
}

function formatPokemonMetric(entry, fallback = '-') {
  if (!entry) return fallback
  return `${translatePokemonName(entry.name)}（${formatNumber(entry.value)}）`
}

function getIvSpread(stats, key) {
  return stats[key]?.ivs || ''
}

function drawFitText(ctx, text, x, y, maxWidth, minSize, maxSize, weight = 700) {
  let size = maxSize
  ctx.font = `${weight} ${size}px Arial`
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 1
    ctx.font = `${weight} ${size}px Arial`
  }
  ctx.fillText(text, x, y)
}

function analyzeTracker(tracker) {
  const sections = getAllSections(tracker)
  const uniqueHistory = getLastShinyHistory(tracker)
  const rareSet = buildRareSet()
  const tierLookup = getTierLookup()
  const rareSeen = new Map()

  sections.forEach(([, section]) => {
    ;(section.data || []).forEach(row => {
      const encounters = Number(row.total_encounter ?? row.encounter ?? 0)
      const normalized = normalizeName(row.name)
      if (encounters > 0 && rareSet.has(normalized)) {
        rareSeen.set(normalized, {
          name: row.name,
          tier: tierLookup.get(normalized) || 'Rare',
          encounters: Math.max(encounters, rareSeen.get(normalized)?.encounters || 0),
        })
      }
    })
  })

  const mostSeen = getMostSeen(tracker).map(row => ({
    ...row,
    tier: tierLookup.get(normalizeName(row.name)),
  }))

  const shinyIvEntries = uniqueHistory
    .map(entry => ({
      name: entry.name || `Species ${entry.species_id}`,
      value: parseIvTotal(entry.ivs),
      ivs: entry.ivs,
    }))
    .filter(entry => entry.value !== null)
    .sort((a, b) => b.value - a.value)

  const encounterShinyEntries = uniqueHistory
    .map(entry => ({
      name: entry.name || `Species ${entry.species_id}`,
      value: Number(entry.global_encounter),
    }))
    .filter(entry => Number.isFinite(entry.value))
    .sort((a, b) => b.value - a.value)

  const sectionTotals = sections.map(([name, section]) => Number(section.total_encounter || 0))
  const totalEncounters = Math.max(0, ...sectionTotals)
  const totalShinies = uniqueHistory.length
  const averageEncounterPerShiny = totalShinies > 0 ? Math.round(totalEncounters / totalShinies) : 0

  return {
    totalEggEncounters: getSectionTotal(tracker, 'Egg'),
    totalAlphaEncounters: getSectionTotal(tracker, 'Alpha'),
    totalWildOtherEncounters: getSectionTotal(tracker, 'Wild Other'),
    totalFossilEncounters: getSectionTotal(tracker, 'Fossil'),
    totalShinies,
    totalEncounters,
    averageEncounterPerShiny,
    totalRaresSeen: rareSeen.size,
    totalRareEncounters: Array.from(rareSeen.values()).reduce((sum, pokemon) => sum + pokemon.encounters, 0),
    rareSeen: Array.from(rareSeen.values()).sort((a, b) => b.encounters - a.encounters || a.name.localeCompare(b.name)),
    mostSeen,
    highestIvShiny: shinyIvEntries[0] || null,
    lowestIvShiny: shinyIvEntries.at(-1) || null,
    highestEncounterShiny: encounterShinyEntries[0] || null,
    lowestEncounterShiny: encounterShinyEntries.at(-1) || null,
    trackerTypes: sections.map(([name, section]) => ({
      name,
      total: Number(section.total_encounter || 0),
      current: Number(section.encounter || 0),
    })),
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null)
      return
    }
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function drawContainImage(ctx, img, x, y, width, height) {
  const sourceRatio = img.width / img.height
  const targetRatio = width / height
  let drawWidth = width
  let drawHeight = height
  let drawX = x
  let drawY = y

  if (sourceRatio > targetRatio) {
    drawHeight = width / sourceRatio
    drawY = y + (height - drawHeight) / 2
  } else {
    drawWidth = height * sourceRatio
    drawX = x + (width - drawWidth) / 2
  }

  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
}

async function downloadPlayerCard({ playerName, playerTime, imagePreview, stats, exportOptions, hasManualEdits }) {
  const displayName = playerName.trim()
  const hasPlayerTime = String(playerTime || '').replace(/\D/g, '').length > 0
  const averageEncounterPerHour = formatAverageEncounterPerHour(stats.totalEncounters, playerTime)
  const statRows = [
    ['totalEncounters', '总遭遇数', formatCardNumber(stats.totalEncounters)],
    ['totalShinies', '闪光总数', formatCardNumber(stats.totalShinies)],
    ['averageEncounterPerShiny', '平均遇敌／闪光', formatCardNumber(stats.averageEncounterPerShiny)],
    ['totalEggEncounters', '孵蛋次数', formatCardNumber(stats.totalEggEncounters)],
    ['totalAlphaEncounters', '头目遭遇数', formatCardNumber(stats.totalAlphaEncounters)],
    ['totalWildOtherEncounters', '其他野生遭遇', formatCardNumber(stats.totalWildOtherEncounters)],
    ['totalRareEncounters', '稀有遭遇数', formatCardNumber(stats.totalRareEncounters)],
    ['totalFossilEncounters', '化石遭遇数', formatCardNumber(stats.totalFossilEncounters)],
  ].filter(([key]) => exportOptions[key])

  const detailRows = [
    ['highestIvShiny', '最高个体值闪光', stats.highestIvShiny, stats.highestIvShinyIvs],
    ['lowestIvShiny', '最低个体值闪光', stats.lowestIvShiny, stats.lowestIvShinyIvs],
    ['highestEncounterShiny', '最高遇敌数闪光', stats.highestEncounterShiny, ''],
    ['lowestEncounterShiny', '最低遇敌数闪光', stats.lowestEncounterShiny, ''],
  ].filter(([key]) => exportOptions[key])

  const hasTopSeen = exportOptions.topSeen
  const hasTopRareSeen = exportOptions.topRareSeen
  const hasAnyList = hasTopSeen || hasTopRareSeen
  const statCardHeight = 104
  const statGap = 18
  const detailCardHeight = 72
  const detailGap = 12
  const statGridRows = Math.ceil(statRows.length / 2)
  const detailGridRows = Math.ceil(detailRows.length / 2)
  const statBottom = statRows.length
    ? 158 + statGridRows * statCardHeight + Math.max(0, statGridRows - 1) * statGap
    : 158
  const detailStartY = detailRows.length ? statBottom + 22 : statBottom
  const detailBottom = detailRows.length
    ? detailStartY + detailGridRows * detailCardHeight + Math.max(0, detailGridRows - 1) * detailGap
    : statBottom
  const listStartY = hasAnyList ? Math.max(548, detailBottom + 38) : 0
  const listBottom = hasAnyList ? listStartY + 36 + 5 * 24 : 0
  const canvasHeight = Math.max(675, listBottom, detailBottom, 548) + 48
  const leftPanelHeight = Math.max(390, canvasHeight - 206)

  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  const uploadedImage = await loadImage(imagePreview)

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#141927')
  gradient.addColorStop(0.5, '#263046')
  gradient.addColorStop(1, '#111827')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = 'rgba(52, 211, 153, 0.18)'
  ctx.fillRect(0, 0, 1200, 10)
  ctx.fillStyle = 'rgba(251, 191, 36, 0.9)'
  ctx.fillRect(0, 10, 1200, 4)

  if (displayName) {
    ctx.fillStyle = '#f8fafc'
    ctx.font = '700 54px Arial'
    ctx.fillText(displayName, 48, 82)
  }
  ctx.font = '600 23px Arial'
  ctx.fillStyle = '#fbbf24'
  ctx.fillText('训练家卡片', 52, 120)

  drawRoundedRect(ctx, 48, 158, 310, leftPanelHeight, 18)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)'
  ctx.fill()

  if (uploadedImage) {
    ctx.save()
    drawRoundedRect(ctx, 68, 178, 270, 300, 14)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.42)'
    ctx.fill()
    ctx.clip()
    drawContainImage(ctx, uploadedImage, 68, 178, 270, 300)
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgba(148, 163, 184, 0.18)'
    drawRoundedRect(ctx, 68, 178, 270, 300, 14)
    ctx.fill()
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '700 26px Arial'
    ctx.fillText('未上传图片', 148, 334)
  }

  if (hasPlayerTime) {
    ctx.fillStyle = '#fbbf24'
    ctx.font = '700 18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('游戏时长', 203, 512)
    getPlayerTimeBreakdown(playerTime, exportOptions.includeTimeBreakdown).forEach((line, index) => {
      ctx.fillStyle = index === 0 ? '#f8fafc' : '#cbd5e1'
      drawFitText(ctx, line, 203, 546 + index * 32, 270, 18, index === 0 ? 30 : 22)
    })
    if (exportOptions.averageEncounterPerHour && averageEncounterPerHour) {
      ctx.fillStyle = '#fbbf24'
      ctx.font = '700 18px Arial'
      const y = exportOptions.includeTimeBreakdown ? 644 : 586
      ctx.fillText('每小时平均遭遇', 203, y)
      ctx.fillStyle = '#f8fafc'
      drawFitText(ctx, averageEncounterPerHour, 203, y + 30, 270, 16, 22)
    }
    ctx.textAlign = 'left'
  }

  statRows.forEach(([, label, value], index) => {
    const x = 408 + (index % 2) * 360
    const y = 158 + Math.floor(index / 2) * (statCardHeight + statGap)
    drawRoundedRect(ctx, x, y, 310, statCardHeight, 12)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)'
    ctx.fill()
    ctx.fillStyle = '#fbbf24'
    ctx.font = '600 22px Arial'
    ctx.fillText(label, x + 24, y + 36)
    ctx.fillStyle = '#f8fafc'
    drawFitText(ctx, value, x + 24, y + 82, 260, 27, 38)
  })

  detailRows.forEach(([, label, value, subvalue], index) => {
    const x = 408 + (index % 2) * 360
    const y = detailStartY + Math.floor(index / 2) * (detailCardHeight + detailGap)
    drawRoundedRect(ctx, x, y, 310, detailCardHeight, 10)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.58)'
    ctx.fill()
    ctx.fillStyle = '#fbbf24'
    ctx.font = '600 17px Arial'
    ctx.fillText(label, x + 18, y + 20)
    ctx.fillStyle = '#f8fafc'
    drawFitText(ctx, value, x + 18, y + 42, 270, 14, 19)
    if (subvalue) {
      ctx.fillStyle = '#cbd5e1'
      drawFitText(ctx, subvalue, x + 18, y + 62, 270, 12, 15, 600)
    }
  })

  if (hasTopSeen || hasTopRareSeen) {
    const listColumns = hasTopSeen && hasTopRareSeen ? 2 : 1
    const listWidth = listColumns === 2 ? 320 : 690

    function drawTopList(title, items, x, y) {
      ctx.fillStyle = '#fbbf24'
      ctx.font = '700 25px Arial'
      ctx.fillText(title, x, y)
      ctx.font = '700 18px Arial'
      items.slice(0, 5).forEach((pokemon, index) => {
        const rowY = y + 32 + index * 24
        ctx.fillStyle = '#e2e8f0'
        drawFitText(ctx, `${index + 1}. ${translatePokemonName(pokemon.name)}`, x, rowY, listWidth - 112, 13, 18)
        ctx.fillStyle = '#fbbf24'
        ctx.textAlign = 'right'
        ctx.fillText(formatNumber(pokemon.encounter ?? pokemon.encounters), x + listWidth, rowY)
        ctx.textAlign = 'left'
      })
    }

    if (hasTopSeen) {
      drawTopList('遭遇最多的宝可梦', stats.mostSeen, 408, listStartY)
    }
    if (hasTopRareSeen) {
      drawTopList(
        '遭遇最多的稀有宝可梦',
        stats.rareSeen.map(pokemon => ({ ...pokemon, encounter: pokemon.encounters })),
        hasTopSeen ? 790 : 408,
        listStartY
      )
    }
  }

  if (hasManualEdits) {
    const markerX = 68
    const markerY = canvas.height - 88
    drawRoundedRect(ctx, markerX, markerY, 42, 34, 8)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.42)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.86)'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(markerX + 14, markerY + 23)
    ctx.lineTo(markerX + 27, markerY + 10)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(markerX + 12, markerY + 25)
    ctx.lineTo(markerX + 20, markerY + 25)
    ctx.stroke()
  }

  const link = document.createElement('a')
  link.download = `${normalizeName(playerName || 'pokemmo-player')}-player-card.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export default function PlayerCardGenerator() {
  const [playerName, setPlayerName] = useState('')
  const [playerTime, setPlayerTime] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [tracker, setTracker] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [exportOptions, setExportOptions] = useState(DEFAULT_EXPORT_OPTIONS)
  const [manualValues, setManualValues] = useState({})

  useDocumentHead({
    title: 'PokeMMO 训练家卡片生成器',
    description: '上传 PokeMMO 遭遇计数器 JSON，生成可下载的训练家卡片，展示遭遇总数、闪光记录、稀有遭遇与常见宝可梦。',
    canonicalPath: '/player-card-generator/',
    breadcrumbs: [
      { name: '首页', url: '/' },
      { name: '工具', url: '/tools' },
      { name: '训练家卡片生成器', url: '/player-card-generator' },
    ],
  })

  const stats = useMemo(() => (tracker ? analyzeTracker(tracker) : null), [tracker])
  const cardStats = useMemo(() => {
    if (!stats) return null
    return {
      ...stats,
      totalEncounters: getCardValue(stats, manualValues, 'totalEncounters'),
      totalShinies: getCardValue(stats, manualValues, 'totalShinies'),
      averageEncounterPerShiny: getCardValue(stats, manualValues, 'averageEncounterPerShiny'),
      totalEggEncounters: getCardValue(stats, manualValues, 'totalEggEncounters'),
      totalAlphaEncounters: getCardValue(stats, manualValues, 'totalAlphaEncounters'),
      totalWildOtherEncounters: getCardValue(stats, manualValues, 'totalWildOtherEncounters'),
      totalRareEncounters: getCardValue(stats, manualValues, 'totalRareEncounters'),
      totalFossilEncounters: getCardValue(stats, manualValues, 'totalFossilEncounters'),
      highestIvShiny: getCardValue(stats, manualValues, 'highestIvShiny'),
      lowestIvShiny: getCardValue(stats, manualValues, 'lowestIvShiny'),
      highestIvShinyIvs: getIvSpread(stats, 'highestIvShiny'),
      lowestIvShinyIvs: getIvSpread(stats, 'lowestIvShiny'),
      highestEncounterShiny: getCardValue(stats, manualValues, 'highestEncounterShiny'),
      lowestEncounterShiny: getCardValue(stats, manualValues, 'lowestEncounterShiny'),
    }
  }, [manualValues, stats])
  const hasManualEdits = hasManualOverrides(manualValues)

  async function handleJsonUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setFileName(file.name)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      setTracker(parsed)
    } catch {
      setTracker(null)
      setError('无法将该文件读取为计数器 JSON。')
    }
  }

  function handleImageUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImagePreview(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  async function handleDownload() {
    if (!cardStats) return
    setIsDownloading(true)
    setError('')
    try {
      await downloadPlayerCard({
        playerName,
        playerTime,
        imagePreview,
        stats: cardStats,
        exportOptions,
        hasManualEdits,
      })
    } catch {
      setError('无法生成训练家卡片图片。')
    } finally {
      setIsDownloading(false)
    }
  }

  function handleExportOptionChange(key) {
    setExportOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleManualValueChange(key, value) {
    setManualValues(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>训练家卡片生成器</h1>
        <p>上传遭遇计数器 JSON，填写你的 PokeMMO 名称并添加训练家图片，即可导出精美卡片。</p>
      </header>

      <details className={styles.helpPanel} open>
        <summary>如何使用本页面</summary>
        <div className={styles.helpContent}>
          <article>
            <h2>如何获取遭遇计数器数据</h2>
            <p>
              在游戏设置中进入“实用工具”，点击“导出可修改资源”，然后勾选 Encounter（遭遇计数器）并导出 JSON。
              Tracker. Open the PokeMMO folder, go to Dump &gt; Resources &gt; Dump.zip. Extract the
              encounter_tracker.json from the Dump.zip, then upload it to Tracker JSON.
            </p>
          </article>

          <article>
            <h2>如何获取训练家图片？</h2>
            <p>你可以截取游戏内训练家卡片中的角色，或上传任意想使用的图片。</p>
          </article>

          <article>
            <h2>如何下载卡片？</h2>
            <p>点击下载按钮即可。</p>
          </article>
        </div>
      </details>

      <section className={styles.controls} aria-label="训练家卡片输入项">
        <label className={styles.field}>
          <span>训练家名称</span>
          <input
            type="text"
            value={playerName}
            onChange={event => setPlayerName(event.target.value)}
            placeholder="你的训练家名称"
          />
        </label>

        <label className={styles.field}>
          <span>游戏时长</span>
          <input
            type="text"
            value={playerTime}
            onChange={event => setPlayerTime(event.target.value)}
            placeholder="如：1,234 小时"
          />
        </label>

        <label className={styles.fileField}>
          <span>计数器 JSON</span>
          <input type="file" accept="application/json,.json" onChange={handleJsonUpload} />
        </label>

        <label className={styles.fileField}>
          <span>训练家卡片图片</span>
          <input type="file" accept="image/*" onChange={handleImageUpload} />
        </label>
      </section>

      {error && <div className={styles.error}>{error}</div>}
      {fileName && !error && <div className={styles.fileStatus}>Loaded {fileName}</div>}

      {stats && cardStats ? (
        <>
          <section className={styles.summaryGrid} aria-label="训练家计数器摘要">
            <StatCard label="总遭遇数" value={cardStats.totalEncounters} />
            <StatCard label="计数器闪光总数" value={cardStats.totalShinies} />
            <StatCard label="每只闪光平均遭遇" value={cardStats.averageEncounterPerShiny} />
            <StatCard label="孵蛋次数" value={cardStats.totalEggEncounters} />
            <StatCard label="头目遭遇数" value={cardStats.totalAlphaEncounters} />
            <StatCard label="其他野生遭遇（非群聚）" value={cardStats.totalWildOtherEncounters} />
            <StatCard label="稀有遭遇数" value={cardStats.totalRareEncounters} />
            <StatCard label="化石遭遇数" value={cardStats.totalFossilEncounters} />
            <StatCard label="最高个体值闪光" value={cardStats.highestIvShiny} detail={cardStats.highestIvShinyIvs} textValue />
            <StatCard label="最低个体值闪光" value={cardStats.lowestIvShiny} detail={cardStats.lowestIvShinyIvs} textValue />
            <StatCard label="最高遇敌数闪光" value={cardStats.highestEncounterShiny} textValue />
            <StatCard label="最低遇敌数闪光" value={cardStats.lowestEncounterShiny} textValue />
          </section>

          <section className={styles.checklist} aria-label="训练家卡片 PNG 选项">
            <h2>PNG 包含内容</h2>
            <div className={styles.checklistGrid}>
              {EXPORT_FIELDS.map(field => (
                <label key={field.key}>
                  <input
                    type="checkbox"
                    checked={exportOptions[field.key]}
                    onChange={() => handleExportOptionChange(field.key)}
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className={styles.manualEditor} aria-label="手动编辑训练家卡片数值">
            <h2>手动编辑</h2>
            {hasManualEdits && <span className={styles.editedBadge}>PNG 上会显示已编辑标记</span>}
            <div className={styles.manualGrid}>
              {EDITABLE_FIELDS.map(field => (
                <label key={field.key} className={styles.field}>
                  <span>{field.label}</span>
                  <input
                    type="text"
                    value={manualValues[field.key] || ''}
                    onChange={event => handleManualValueChange(field.key, event.target.value)}
                    inputMode={field.type === 'number' ? 'numeric' : undefined}
                    placeholder={String(getCardValue(stats, {}, field.key) || '-')}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className={styles.cardPreviewSection}>
            <div className={styles.playerCard}>
              <div className={styles.trainerPanel}>
                <div className={styles.photoStack}>
                  <div className={styles.imageFrame}>
                    {imagePreview ? (
                      <img src={imagePreview} alt="" />
                    ) : (
                      <span>未上传图片</span>
                    )}
                  </div>
                  <div className={styles.playerTime}>
                    {getPlayerTimeBreakdown(playerTime, exportOptions.includeTimeBreakdown).map(line => (
                      <span key={line}>{line}</span>
                    ))}
                    {exportOptions.averageEncounterPerHour && formatAverageEncounterPerHour(cardStats.totalEncounters, playerTime) && (
                      <span>{formatAverageEncounterPerHour(cardStats.totalEncounters, playerTime)}</span>
                    )}
                  </div>
                </div>
                <div>
                  <h2>{playerName || 'PokeMMO 训练家'}</h2>
                  <p>遭遇计数卡片</p>
                </div>
              </div>

              <div className={styles.previewStats}>
                <StatCard label="遭遇数" value={cardStats.totalEncounters} compact />
                <StatCard label="闪光数" value={cardStats.totalShinies} compact />
                <StatCard label="稀有遭遇" value={cardStats.totalRareEncounters} compact />
              </div>
            </div>

            <button className={styles.downloadButton} onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? '生成中…' : '下载训练家卡片 PNG'}
            </button>
          </section>

          <section className={styles.tables}>
            <div className={styles.tablePanel}>
              <h2>遭遇最多的宝可梦</h2>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>宝可梦</th>
                      <th>阶级</th>
                      <th>遭遇数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.mostSeen.map(pokemon => (
                      <tr key={pokemon.key}>
                        <td>{translatePokemonName(pokemon.name)}</td>
                        <td>{pokemon.tier ? pokemon.tier.replace('Tier', '阶级') : '-'}</td>
                        <td>{formatNumber(pokemon.encounter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.tablePanel}>
              <h2>已遭遇的稀有宝可梦</h2>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>宝可梦</th>
                      <th>阶级</th>
                      <th>遭遇数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rareSeen.map(pokemon => (
                      <tr key={`${pokemon.tier}-${pokemon.name}`}>
                        <td>{translatePokemonName(pokemon.name)}</td>
                        <td>{pokemon.tier?.replace('Tier', '阶级')}</td>
                        <td>{formatNumber(pokemon.encounters)}</td>
                      </tr>
                    ))}
                    {stats.rareSeen.length === 0 && (
                      <tr>
                        <td colSpan="3">上传的计数器中未找到阶级 0、1 或 2 的宝可梦。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className={styles.emptyState}>
          <h2>上传计数器 JSON 以开始</h2>
          <p>页面会在你的浏览器中读取文件，并根据计数器分区计算训练家总数据。</p>
        </section>
      )}
    </div>
  )
}

function StatCard({ label, value, detail = '', compact = false, textValue = false }) {
  return (
    <div className={`${styles.statCard} ${compact ? styles.compactStat : ''}`}>
      <span>{label}</span>
      <strong className={textValue ? styles.textStatValue : ''}>{textValue ? value : formatCardNumber(value)}</strong>
      {detail ? <small className={styles.statDetail}>{detail}</small> : null}
    </div>
  )
}
