import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import { useInGameClock } from '../../hooks/useInGameClock'
import { useOfficialEvents } from '../../hooks/useOfficialEvents'
import { getLocalPokemonGif, normalizePokemonName, onGifError, translatePokemonName } from '../../utils/pokemon'
import {
  translateEggGroupName,
  translateEncounterTerm,
  translateLocationName,
  translateRegionName,
} from '../../utils/pokemonTermsZh'
import pokemonData from '../../data/pokemmo_data/pokemon-data.json'
import generationData from '../../data/generation.json'
import safariData from '../../data/safari_zones.json'
import catchCalculatorConfig from '../../data/catching_calculator_config.json'
import { getCatchRateByName } from '../../hooks/useCatchCalcs'
import styles from './CatchingCalculator.module.css'

const MODE_ROUTE = 'route'
const MODE_POKEMON = 'pokemon'
const MODE_EGG = 'egg'
const MODE_SPECIFIC = 'specific'
const MODE_CATCH_EVENTS = 'catchEvents'

const INFO_DROPDOWN_CLOSED_KEY = 'catchcalculatorInfoClosed'
const METHOD_NORMAL = 'normal'
const METHOD_FISHING = 'fishing'
const METHOD_SURFING = 'surfing'

const PRIORITY_OVERALL = 'overall'
const PRIORITY_CHEAPEST = 'cheapest'
const PRIORITY_FASTEST = 'fastest'
const PRIORITY_HIGHEST = 'highestCatch'

const GENDER_MALE = 'male'
const GENDER_FEMALE = 'female'
const GENDER_IGNORE = 'ignore'
const CATCH_EVENT_REGEX = /\bcatch(?:ing)?\b/i
const CATCH_EVENT_TITLE_BLACKLIST = [
  'Seasonal PVE - Hidden Treasures - Main Thread',
]
const MONTH_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}
const BALLS = Array.isArray(catchCalculatorConfig?.balls)
  ? catchCalculatorConfig.balls.filter((ball) => ball?.enabled !== false)
  : []
const MIN_BEST_OVERALL_CHANCE = Number(catchCalculatorConfig?.thresholds?.minBestOverallChance) || 85
const FALLBACK_BEST_OVERALL_CHANCE = Number(catchCalculatorConfig?.thresholds?.fallbackBestOverallChance) || 70
const MIN_CHEAPEST_CHANCE = Number(catchCalculatorConfig?.thresholds?.minCheapestChance) || 75
const SIMILAR_CATCH_GAP_PERCENT = Number(catchCalculatorConfig?.thresholds?.similarCatchGapPercent) || 3
const TIMER_BALL_MIN_BALL_PERCENT = Number(catchCalculatorConfig?.thresholds?.['timer_ball_min_ball_%']) || 50
const LURE_ENCOUNTER_RATE_PERCENT = 4
const DUSK_BALL_INDOOR_KEYWORDS = Array.isArray(catchCalculatorConfig?.duskBall?.indoorKeywords)
  ? catchCalculatorConfig.duskBall.indoorKeywords
  : []
const DUSK_BALL_INDOOR_LOCATIONS = new Set(
  (Array.isArray(catchCalculatorConfig?.duskBall?.indoorLocations)
    ? catchCalculatorConfig.duskBall.indoorLocations
    : [])
    .map((name) => normalizeKey(name))
)

const APRICORN_BALL_IDS = BALLS.filter((ball) => ball.apricorn).map((ball) => ball.id)
const ROUTE_SUGGESTION_MIN_CHARS = Number(catchCalculatorConfig?.search?.routeSuggestionMinChars) || 2
const POKEMON_SUGGESTION_MIN_CHARS = Number(catchCalculatorConfig?.search?.pokemonSuggestionMinChars) || 2
const MAX_SUGGESTIONS = Number(catchCalculatorConfig?.search?.maxSuggestions) || 15

const POKEMON_VALUES = Object.values(pokemonData)
const POKEMON_NAME_BY_SLUG = POKEMON_VALUES.reduce((acc, pokemon) => {
  acc[normalizePokemonName(pokemon.name)] = pokemon.name
  return acc
}, {})
const POKEMON_ENCOUNTER_FALLBACK_BY_NAME = POKEMON_VALUES.reduce((acc, pokemon) => {
  const encounters = Array.isArray(pokemon?.location_area_encounters) ? pokemon.location_area_encounters : []
  const summary = {
    levels: [],
    encounterTypes: new Set(),
    rarityTypes: new Set(),
    times: new Set(),
  }

  encounters.forEach((encounter) => {
    const minLevel = Number(encounter?.min_level)
    const maxLevel = Number(encounter?.max_level)
    if (Number.isFinite(minLevel)) summary.levels.push(minLevel)
    if (Number.isFinite(maxLevel)) summary.levels.push(maxLevel)

    summary.encounterTypes.add(String(encounter?.type || ''))
    addEncounterRarityAndTimes(summary, encounter)
  })

  acc[pokemon.name] = summary
  return acc
}, {})
const SAFARI_CATCH_DATA_BY_SLUG = Object.values(safariData || {}).reduce((acc, region) => {
  const catchEntries = Object.entries(region?.catchData || {})
  catchEntries.forEach(([name, data]) => {
    const slug = normalizePokemonName(name)
    if (slug && data && typeof data === 'object') {
      acc[slug] = data
    }
  })
  return acc
}, {})
const EGG_GROUP_EXCLUDED_ROUTE_KEYWORDS = ['altering cave']

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[\u2018\u2019']/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
}

function titleCase(value) {
  return String(value || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getEncounterLocationName(encounter) {
  return translateLocationName(titleCase(String(
    encounter?.location
      || encounter?.location_name_full
      || encounter?.location_name
      || ''
  )))
}

function addEncounterRarityAndTimes(summary, encounter) {
  const legacyRarity = String(encounter?.rarity || '').trim()
  if (legacyRarity) {
    summary.rarityTypes.add(legacyRarity)
  }

  const legacyTime = String(encounter?.time || '').trim()
  if (legacyTime) {
    summary.times.add(legacyTime)
  }

  ;['morning', 'day', 'night'].forEach((period) => {
    const value = String(encounter?.[`rarity_${period}`] || '').trim()
    if (!value) return
    if (normalizeKey(value) === 'none') return

    summary.rarityTypes.add(value)
    summary.times.add(period.toUpperCase())
  })

  if (!summary.times.size) {
    summary.times.add('ALL')
  }
}

function toValidDate(year, month, day) {
  const date = new Date(year, month, day)
  return (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) ? date : null
}

function extractEventDate(title, now) {
  const dayMonthPattern = /\((?:[A-Za-z]+(?:,\s*|\s+))?(\d{1,2})(?:st|nd|rd|th)?(?:,\s*|\s+)([A-Za-z]+)\)/i
  const monthDayPattern = /\((?:[A-Za-z]+(?:,\s*|\s+))?([A-Za-z]+)(?:,\s*|\s+)(\d{1,2})(?:st|nd|rd|th)?\)/i

  let day = null
  let monthName = null
  const dayMonthMatch = String(title || '').match(dayMonthPattern)
  if (dayMonthMatch) {
    day = Number(dayMonthMatch[1])
    monthName = dayMonthMatch[2]
  } else {
    const monthDayMatch = String(title || '').match(monthDayPattern)
    if (monthDayMatch) {
      monthName = monthDayMatch[1]
      day = Number(monthDayMatch[2])
    }
  }

  if (!day || !monthName) return null
  const month = MONTH_INDEX[String(monthName).toLowerCase()]
  if (month === undefined) return null

  let year = now.getFullYear()
  if (now.getMonth() === 11 && month < now.getMonth()) year += 1
  return toValidDate(year, month, day)
}

function extractUtcTime(description) {
  let utcTimeMatch = String(description || '').match(/(\d{1,2}):(\d{2})\s*UTC\b/i)
  if (utcTimeMatch) {
    return { hours: Number(utcTimeMatch[1]), minutes: Number(utcTimeMatch[2]) }
  }

  utcTimeMatch = String(description || '').match(/(\d{1,2})\s*(AM|PM)\s*UTC\b/i)
  if (utcTimeMatch) {
    let hours = Number(utcTimeMatch[1])
    const isPM = utcTimeMatch[2].toUpperCase() === 'PM'
    if (isPM && hours < 12) hours += 12
    if (!isPM && hours === 12) hours = 0
    return { hours, minutes: 0 }
  }

  return null
}

function formatEventLocalStart(eventDate, utcTime) {
  if (!eventDate || !utcTime) return '开始时间待公布'

  const utcDate = new Date(Date.UTC(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate(),
    utcTime.hours,
    utcTime.minutes
  ))

  return new Intl.DateTimeFormat('zh-CN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(utcDate)
}

function isCatchEventEnded(eventDate, utcTime, nowMs = Date.now()) {
  if (!eventDate) return false

  if (utcTime) {
    const eventDateTime = new Date(Date.UTC(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate(),
      utcTime.hours,
      utcTime.minutes
    ))

    return (nowMs - eventDateTime.getTime()) >= (60 * 60 * 1000)
  }

  const dayEnd = new Date(eventDate)
  dayEnd.setHours(23, 59, 59, 999)
  return nowMs > dayEnd.getTime()
}

function extractCatchEventValidEntries(description) {
  if (typeof document === 'undefined') return []

  function parseBonusValue(value) {
    const match = String(value || '').match(/[+-]?\d+(?:\.\d+)?/)
    if (!match) return 0
    const parsed = Number(match[0])
    return Number.isFinite(parsed) ? parsed : 0
  }

  function canonicalFromText(rawValue) {
    const text = String(rawValue || '').replace(/\s+/g, ' ').trim()
    if (!text) return null

    let canonical = getCanonicalPokemonName(text)
    if (canonical) return canonical

    const tokenized = text.split(/[^a-zA-Z0-9'.-]+/).filter(Boolean)
    for (let i = 0; i < tokenized.length; i += 1) {
      canonical = getCanonicalPokemonName(tokenized[i])
      if (canonical) return canonical

      if (i < tokenized.length - 1) {
        canonical = getCanonicalPokemonName(`${tokenized[i]} ${tokenized[i + 1]}`)
        if (canonical) return canonical
      }
    }

    return null
  }

  function canonicalFromImage(row) {
    const images = Array.from(row.querySelectorAll('img'))
    const removableSuffixes = new Set(['f', 'm', 'male', 'female', 'east', 'west', 'shiny', 'normal'])

    for (const image of images) {
      const sources = [image.getAttribute('src') || '', image.getAttribute('alt') || '']

      for (const source of sources) {
        const lastSegment = String(source).split('/').pop() || ''
        const baseName = lastSegment.split('?')[0].replace(/\.[a-z0-9]+$/i, '')
        if (!baseName) continue

        const parts = baseName.toLowerCase().split('-').filter(Boolean)
        let candidate = getCanonicalPokemonName(parts.join(' '))
        if (candidate) return candidate

        while (parts.length > 1 && removableSuffixes.has(parts[parts.length - 1])) {
          parts.pop()
          candidate = getCanonicalPokemonName(parts.join(' '))
          if (candidate) return candidate
        }
      }
    }

    return null
  }

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = String(description || '')
  const tables = Array.from(tempDiv.querySelectorAll('table'))
  const seen = new Set()
  const entries = []

  tables.forEach((table) => {
    const rows = Array.from(table.querySelectorAll('tr'))
    if (!rows.length) return

    const headerRow = rows.find((row) => row.querySelectorAll('th').length > 0)
    const headers = headerRow
      ? Array.from(headerRow.querySelectorAll('th')).map((header) => normalizeKey(header.textContent || ''))
      : []
    const pokemonColFromHeader = headers.findIndex((header) => header.includes('pokemon'))
    const bonusColFromHeader = headers.findIndex((header) => header.includes('bonus'))

    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td'))
      if (!cells.length) return

      let pokemonCol = pokemonColFromHeader
      let pokemonName = null

      if (pokemonCol > -1 && pokemonCol < cells.length) {
        pokemonName = canonicalFromText(cells[pokemonCol]?.textContent)
      }

      if (!pokemonName) {
        for (let index = 0; index < cells.length; index += 1) {
          const candidate = canonicalFromText(cells[index]?.textContent)
          if (candidate) {
            pokemonName = candidate
            pokemonCol = index
            break
          }
        }
      }

      if (!pokemonName) {
        pokemonName = canonicalFromImage(row)
      }

      if (!pokemonName) return

      const key = normalizeKey(pokemonName)
      if (!key || seen.has(key)) return

      let bonusValue = 0
      if (bonusColFromHeader > -1 && bonusColFromHeader < cells.length) {
        bonusValue = parseBonusValue(cells[bonusColFromHeader]?.textContent)
      } else if (pokemonCol > -1 && pokemonCol + 1 < cells.length) {
        bonusValue = parseBonusValue(cells[pokemonCol + 1]?.textContent)
      }

      entries.push({ pokemonName, bonus: bonusValue })

      seen.add(key)
    })
  })

  return entries
}

function extractCatchEventLocation(description) {
  if (typeof document === 'undefined') return ''

  function cleanCandidate(value) {
    let text = String(value || '').replace(/\s+/g, ' ').trim()
    if (!text) return ''

    text = text.replace(/^[:\-\|\s]+/, '').trim()
    text = text.replace(/\(catching is allowed[^)]*\)/ig, '').trim()

    const sectionMarker = /\b(?:date|time|duration|scoring|pokemon accepted as valid entries|nature bonus|nature translation|rules and registration|participating staff)\b/i
    const markerIndex = text.search(sectionMarker)
    if (markerIndex > 0) {
      text = text.slice(0, markerIndex).trim()
    }

    if (text.length > 120) return ''
    if (/^(?:all\s+pok[eé]mon|evolved or unevolved|you must be the ot|in the event of a tie|any player with access|you must link your entry)\b/i.test(text)) {
      return ''
    }

    return text
  }

  function extractFromLabel(text) {
    const source = String(text || '').replace(/\r/g, '')
    if (!source) return ''

    const labeledMatch = source.match(/(?:^|\n)\s*(?:location|route)\s*:\s*([^\n]+)/i)
    if (!labeledMatch?.[1]) return ''

    return cleanCandidate(labeledMatch[1])
  }

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = String(description || '')

  const markerElements = Array.from(tempDiv.querySelectorAll('strong, b, span'))
  for (const marker of markerElements) {
    const markerText = normalizeKey(marker.textContent || '')
    if (markerText !== 'location' && markerText !== 'location:' && markerText !== 'route' && markerText !== 'route:') continue

    const block = marker.closest('p, div, li, td, th')
    const nextBlockText = cleanCandidate(block?.nextElementSibling?.textContent)
    if (nextBlockText) return nextBlockText

    const siblingText = cleanCandidate(marker.nextSibling?.textContent)
    if (siblingText) return siblingText

    const nextElementText = cleanCandidate(marker.nextElementSibling?.textContent)
    if (nextElementText) return nextElementText

    const parent = marker.parentElement
    if (parent) {
      const parentText = extractFromLabel(parent.textContent)
      if (parentText) return parentText
    }
  }

  const plainText = String(tempDiv.textContent || '').replace(/\r/g, '')
  const fromPlainText = extractFromLabel(plainText)
  if (fromPlainText) return fromPlainText

  return ''
}

function isBlacklistedCatchEventTitle(title) {
  const normalizedTitle = normalizeKey(String(title || '').replace(/\([^)]*\)/g, ' '))
  return CATCH_EVENT_TITLE_BLACKLIST.some((entry) => {
    const normalizedEntry = normalizeKey(entry)
    return normalizedTitle.includes(normalizedEntry)
  })
}

function formatPokemonDisplayName(value) {
  return translatePokemonName(String(value || '').replace(/(^|[\s-])([a-z])/g, (match, prefix, char) => `${prefix}${char.toUpperCase()}`))
}

const BALL_NAMES_ZH = Object.freeze({
  'Poke Ball': '精灵球',
  'Great Ball': '超级球',
  'Ultra Ball': '高级球',
  'Master Ball': '大师球',
  'Safari Ball': '狩猎球',
  'Quick Ball': '先机球',
  'Dusk Ball': '黑暗球',
  'Timer Ball': '计时球',
  'Repeat Ball': '重复球',
  'Net Ball': '捕网球',
  'Dive Ball': '潜水球',
  'Nest Ball': '巢穴球',
  'Luxury Ball': '豪华球',
  'Heal Ball': '治愈球',
  'Premier Ball': '纪念球',
  'Fast Ball': '速度球',
  'Level Ball': '等级球',
  'Lure Ball': '诱饵球',
  'Heavy Ball': '沉重球',
  'Love Ball': '甜蜜球',
  'Friend Ball': '友友球',
  'Moon Ball': '月亮球',
})

function translateBallName(name) {
  return BALL_NAMES_ZH[name] || name
}

function formatRouteLabel(route) {
  if (!route) return ''

  const region = translateRegionName(route.region || '')
  const location = translateLocationName(route.displayName || route.name || '')
  return [region, location].filter(Boolean).join('－')
}

function formatPeriod(period) {
  return ({ Morning: '早晨', Day: '白天', Night: '夜晚' })[period] || period
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0.0%'
  return `${value.toFixed(1)}%`
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return '不适用'
  return Math.round(value).toLocaleString()
}

function formatTurns(value) {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(1)
}

function formatTurnSummary(value) {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function getTurnSetupLabel(methodLabel) {
  switch (methodLabel) {
    case '1% HP':
      return '1% HP'

    case '1% HP + Sleep':
      return '1% HP／睡眠'

    case '100% HP':
    case '100% HP (Turn 1)':
      return '满 HP'

    case '100% HP + Sleep':
      return '满 HP／睡眠'

    default:
      return ''
  }
}

function formatRecommendationTurns(turns, methodLabel) {
  const base = formatTurnSummary(turns)
  if (!Number.isFinite(turns) || turns <= 1) return base
  const setupLabel = getTurnSetupLabel(methodLabel)
  return setupLabel ? `${base} (${setupLabel})` : base
}

function formatExpectedTurns(turns) {
  return formatTurnSummary(turns)
}

function getPriorityLabel(priority) {
  switch (priority) {
    case PRIORITY_CHEAPEST:
      return '最低成本'
    case PRIORITY_FASTEST:
      return '最快捕捉'
    case PRIORITY_HIGHEST:
      return '最高捕获率'
    default:
      return '综合最优'
  }
}

function getCanonicalPokemonName(value) {
  const normalized = normalizeKey(value)
  if (!normalized) return null
  return POKEMON_VALUES.find((pokemon) => (
    normalizeKey(pokemon.name) === normalized
    || normalizeKey(translatePokemonName(pokemon.name)) === normalized
  ))?.name || null
}

function getPokemonSearchTargets(value) {
  const normalizedTarget = normalizeKey(getCanonicalPokemonName(value) || value)
  if (!normalizedTarget) return new Set()

  const targets = new Set([normalizedTarget])
  const evolutionGroups = Object.values(generationData || {})

  evolutionGroups.forEach((group) => {
    if (!Array.isArray(group)) return

    group.forEach((chain) => {
      if (!Array.isArray(chain)) return

      const normalizedChain = chain.map((name) => normalizeKey(name))
      const targetIndex = normalizedChain.indexOf(normalizedTarget)
      if (targetIndex === -1) return

      normalizedChain.slice(targetIndex).forEach((name) => {
        if (name) targets.add(name)
      })
    })
  })

  return targets
}

function getSafariCatchData(pokemonName) {
  return SAFARI_CATCH_DATA_BY_SLUG[normalizePokemonName(pokemonName)] || null
}

function buildSafariBallCandidate(ball, safariCatchData) {
  const chance = Number(safariCatchData?.bestOdds)
  const catchRate = Number(safariCatchData?.catchRate)
  if (!Number.isFinite(chance) || chance <= 0 || !Number.isFinite(catchRate)) {
    return createUnavailableCandidate(ball, '该宝可梦暂未收录狩猎地带捕捉数据。')
  }

  const strategyLabel = {
    balls: '只投球',
    ballsOnly: '只投球',
    bait: '先投 1 次诱饵，再投球',
    oneBait: '先投 1 次诱饵，再投球',
    mud: '先投 1 次泥巴，再投球',
    oneMud: '先投 1 次泥巴，再投球',
  }[String(safariCatchData?.bestStrategy || '')] || '已载入狩猎地带策略数据。'

  const expectedThrows = 100 / chance

  return {
    ballId: ball.id,
    ball: translateBallName(ball.name),
    available: true,
    availabilityNote: `${strategyLabel}。最佳狩猎成功率：${formatPercent(chance)}。`,
    multiplier: 1,
    chance,
    expectedThrows,
    expectedCost: Number.POSITIVE_INFINITY,
    turns: expectedThrows,
    expectedTurnsToSuccess: expectedThrows,
    efficiency: chance,
    catchValue: catchRate,
    rawCatchValue: catchRate,
    hpMultiplier: 1,
    hpPercent: 100,
    statusMod: 1,
    methodLabel: strategyLabel,
    catchRate,
    price: null,
  }
}

function createApricornSelection(enabled) {
  return new Set(enabled)
}

const MIN_QUICK_BALL_CHANCE = Number(catchCalculatorConfig?.thresholds?.minQuickBallChance) || 90
const TIMER_TARGET_TURN = Number(catchCalculatorConfig?.assumptions?.timerTargetTurn) || 11
const METHOD_PROFILES = [
  { id: 'normal100', hpPercent: 100, statusMod: 1, turns: 0, label: '满 HP' },
  { id: 'normal1', hpPercent: 1, statusMod: 1, turns: 1, label: '1% HP' },
  { id: 'sleep100', hpPercent: 100, statusMod: 2, turns: 1, label: '满 HP＋睡眠' },
  { id: 'sleep1', hpPercent: 1, statusMod: 2, turns: 2, label: '1% HP＋睡眠' },
]

function toStarLabel(scoreOutOf100) {
  const stars = Math.max(1, Math.min(5, Math.round(scoreOutOf100 / 20)))
  return `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`
}

function getSpeedStat(pokemon) {
  if (pokemon?.stats && !Array.isArray(pokemon.stats)) {
    return Number(pokemon.stats.speed) || 0
  }

  const stats = Array.isArray(pokemon?.stats) ? pokemon.stats : []
  const speed = stats.find((entry) => String(entry?.stat_name).toLowerCase() === 'speed')
  return Number(speed?.base_stat) || 0
}

function getWeightKg(pokemon) {
  const rawKg = Number(pokemon?.weightKg ?? pokemon?.weight_kg)
  if (Number.isFinite(rawKg) && rawKg > 0) {
    return rawKg
  }

  const rawWeight = Number(pokemon?.weight)
  if (Number.isFinite(rawWeight) && rawWeight > 0) {
    // PokeAPI-style weight is in hectograms; preserve decimal kg values if already provided.
    return Number.isInteger(rawWeight) ? (rawWeight / 10) : rawWeight
  }

  return 5
}

function getGenderRatios(pokemon) {
  const rawRate = Number(pokemon?.gender_rate ?? pokemon?.gender_ratio)
  if (!Number.isFinite(rawRate) || rawRate < 0 || rawRate === 255) {
    return { male: 0.5, female: 0.5, genderless: true }
  }

  const femaleRatio = rawRate <= 8
    ? (rawRate / 8)
    : (rawRate / 254)
  const female = Math.max(0, Math.min(1, femaleRatio))
  const male = 1 - female
  return { male, female, genderless: false }
}

function traverseEvolutionChain(node, visit) {
  if (!node || typeof node !== 'object') return
  visit(node)
  const evolvesTo = Array.isArray(node.evolves_to) ? node.evolves_to : []
  evolvesTo.forEach((next) => traverseEvolutionChain(next, visit))
}

function hasMoonStoneEvolution(pokemon) {
  const evolutions = Array.isArray(pokemon?.evolutions) ? pokemon.evolutions : []
  const foundInEvolutions = evolutions.some((evolution) => {
    if (normalizeKey(evolution?.type) !== 'item') return false
    const itemName = normalizeKey(evolution?.item_name)
    return itemName.includes('moon') || Number(evolution?.val) === 5081
  })
  if (foundInEvolutions) return true

  const chainRoot = pokemon?.evolution_chain?.chain
  let found = false

  traverseEvolutionChain(chainRoot, (node) => {
    const details = Array.isArray(node?.evolution_details) ? node.evolution_details : []
    details.forEach((detail) => {
      const itemName = detail?.item?.name
      if (String(itemName || '').toLowerCase() === 'moon-stone') {
        found = true
      }
    })
  })

  return found
}

function hasFriendshipEvolution(pokemon) {
  const evolutions = Array.isArray(pokemon?.evolutions) ? pokemon.evolutions : []
  const foundInEvolutions = evolutions.some((evolution) => {
    const type = normalizeKey(evolution?.type)
    return type.includes('happiness') || type.includes('friendship')
  })
  if (foundInEvolutions) return true

  const chainRoot = pokemon?.evolution_chain?.chain
  let found = false

  traverseEvolutionChain(chainRoot, (node) => {
    const details = Array.isArray(node?.evolution_details) ? node.evolution_details : []
    details.forEach((detail) => {
      if (Number(detail?.min_happiness) > 0) {
        found = true
      }
    })
  })

  return found
}

function isWaterMethod(encounterType) {
  const value = String(encounterType || '').toLowerCase()
  return value.includes('fish') || value.includes('rod') || value.includes('surf') || value.includes('water')
}

function isSafariRoute(routeName) {
  const normalizedRouteName = normalizeKey(routeName)
  return normalizedRouteName.includes('safari') || normalizedRouteName.includes('great marsh')
}

function getEncounterMethodFromType(encounterType) {
  const value = normalizeKey(encounterType)
  if (value.includes('rod') || value.includes('fishing') || value.includes('fish')) return METHOD_FISHING
  if (value === 'water' || value.includes('surf')) return METHOD_SURFING
  return METHOD_NORMAL
}

function isSpecialEncounterType(encounterType) {
  const value = normalizeKey(encounterType)
  return value.includes('shadow')
    || value.includes('dust cloud')
    || value.includes('fossil')
    || value.includes('honey tree')
}

function isBuildingRoute(routeName) {
  const key = normalizeKey(routeName)
  if (DUSK_BALL_INDOOR_LOCATIONS.has(key)) return true
  return DUSK_BALL_INDOOR_KEYWORDS.some((keyword) => key.includes(normalizeKey(keyword)))
}

function getVariationCategory(routeEntry) {
  const variation = normalizeKey(routeEntry?.variation)
  const category = normalizeKey(routeEntry?.encounterCategory)

  if (variation.includes('horde') || category.includes('horde')) return 'horde'
  if (variation.includes('fish') || variation.includes('rod') || category.includes('fish')) return 'fishing'
  if (variation.includes('lure') || category.includes('lure')) return 'lure'
  if (variation.includes('surf') || category.includes('water')) return 'water'
  return 'single'
}

function getRouteMatchKey(regionName, routeName) {
  return `${normalizeKey(regionName)}::${normalizeKey(routeName)}`
}

function findEncounterByRouteName(routeEncounterIndex, routeName, pokemonName) {
  const normalizedRouteName = normalizeKey(routeName)
  if (!normalizedRouteName || !routeEncounterIndex) return null

  for (const [key, pokemonMap] of routeEncounterIndex.entries()) {
    if (!String(key).endsWith(`::${normalizedRouteName}`)) continue
    const encounter = pokemonMap?.get(pokemonName)
    if (encounter) return encounter
  }

  return null
}

function isEggGroupExcludedRoute(routeEntry) {
  const routeText = normalizeKey(`${routeEntry?.region || ''} ${routeEntry?.routeName || ''} ${routeEntry?.displayName || ''}`)
  return EGG_GROUP_EXCLUDED_ROUTE_KEYWORDS.some((keyword) => routeText.includes(normalizeKey(keyword)))
}

function buildRouteEncounterIndex() {
  const routeIndex = new Map()

  Object.values(pokemonData).forEach((pokemon) => {
    const pokemonName = String(pokemon?.name || '')
    if (!pokemonName) return

    const encounters = Array.isArray(pokemon?.location_area_encounters) ? pokemon.location_area_encounters : []
    encounters.forEach((encounter) => {
      const regionName = translateRegionName(titleCase(String(encounter?.region_name || '')))
      const routeName = getEncounterLocationName(encounter)
      if (!regionName || !routeName) return

      const key = getRouteMatchKey(regionName, routeName)
      if (!routeIndex.has(key)) {
        routeIndex.set(key, new Map())
      }

      const pokemonMap = routeIndex.get(key)
      const current = pokemonMap.get(pokemonName) || {
        pokemonName,
        levels: [],
        encounterTypes: new Set(),
        rarityTypes: new Set(),
        times: new Set(),
      }

      const minLevel = Number(encounter?.min_level)
      const maxLevel = Number(encounter?.max_level)
      if (Number.isFinite(minLevel)) current.levels.push(minLevel)
      if (Number.isFinite(maxLevel)) current.levels.push(maxLevel)

      current.encounterTypes.add(String(encounter?.type || ''))
      addEncounterRarityAndTimes(current, encounter)

      pokemonMap.set(pokemonName, current)
    })
  })

  return routeIndex
}

function buildAllRouteUniverse(encounterMethod) {
  const routeMap = new Map()

  POKEMON_VALUES.forEach((pokemon) => {
    const encounters = Array.isArray(pokemon?.location_area_encounters) ? pokemon.location_area_encounters : []
    encounters.forEach((encounter) => {
      const pokemonSlug = normalizePokemonName(pokemon.name)
      const encounterType = String(encounter?.type || '')
      const method = getEncounterMethodFromType(encounterType)
      if (method !== encounterMethod) return
      if (isSpecialEncounterType(encounterType) && pokemonSlug !== 'feebas') return

      const region = translateRegionName(titleCase(String(encounter?.region_name || '').trim()))
      const routeName = getEncounterLocationName(encounter)
      if (!region || !routeName) return

      const key = `${region}::${routeName}`
      if (!routeMap.has(key)) {
        routeMap.set(key, {
          key,
          id: `all|${region}|${routeName}`,
          region,
          routeName,
          displayName: routeName,
          variation: '全部遭遇',
          encounterCategory: method,
          pokemonPercents: new Map(),
        })
      }

      const route = routeMap.get(key)
      const slug = pokemonSlug
      const prev = route.pokemonPercents.get(slug)
      const defaultPercent = 1
      route.pokemonPercents.set(slug, {
        percent: prev ? prev.percent : defaultPercent,
        label: prev ? prev.label : `${defaultPercent.toFixed(1)}%`,
      })
    })
  })

  return Array.from(routeMap.values()).sort((a, b) => {
    const regionCmp = a.region.localeCompare(b.region)
    if (regionCmp !== 0) return regionCmp
    return a.displayName.localeCompare(b.displayName)
  })
}

function estimateEncounterLevel(entry) {
  const levels = Array.isArray(entry?.levels) ? entry.levels.filter(Number.isFinite) : []
  if (!levels.length) return 30
  const total = levels.reduce((sum, value) => sum + value, 0)
  return Math.max(1, Math.round(total / levels.length))
}

function getEncounterContext(routeEntry, pokemonName, routeEncounterIndex, pokemon) {
  const key = getRouteMatchKey(routeEntry.region, routeEntry.routeName)
  const pokemonMap = routeEncounterIndex.get(key)

  const encounter = pokemonMap?.get(pokemonName)
    || findEncounterByRouteName(routeEncounterIndex, routeEntry.routeName, pokemonName)
    || POKEMON_ENCOUNTER_FALLBACK_BY_NAME[pokemonName]

  const variationCategory = getVariationCategory(routeEntry)

  const encounterTypes = Array.from(encounter?.encounterTypes || [])
  const rarityTypes = Array.from(encounter?.rarityTypes || [])
  const times = Array.from(encounter?.times || [])

  const types = Array.isArray(pokemon?.types)
    ? pokemon.types
    : (Array.isArray(pokemonData[pokemonName]?.types) ? pokemonData[pokemonName].types : [])

  return {
    level: estimateEncounterLevel(encounter),
    encounterTypes,
    rarityTypes,
    times,
    variationCategory,
    types,
  }
}

function getSpecificRouteLevel(routeEntry, pokemonName, routeEncounterIndex) {
  if (!routeEntry) return 30

  const normalizedPokemonName = normalizePokemonName(pokemonName)
  if (!normalizedPokemonName || !routeEntry.pokemonPercents.has(normalizedPokemonName)) {
    return 30
  }

  return getEncounterContext(routeEntry, pokemonName, routeEncounterIndex).level
}

function calculateCatchChance(catchRate, ballRate, hpPercent, statusModifier = 1) {
  const hpMultiplier = (300 - (2 * hpPercent)) / 300
  const value = Math.min(255, Math.floor(hpMultiplier * ballRate * catchRate * statusModifier))
  return (value / 255) * 100
}

function calculateCatchChanceDetails(catchRate, ballRate, hpPercent, statusModifier = 1) {
  const hpMultiplier = (300 - (2 * hpPercent)) / 300
  const rawValue = hpMultiplier * ballRate * catchRate * statusModifier
  const value = Math.min(255, Math.floor(rawValue))
  return {
    rawValue,
    value,
    chance: (value / 255) * 100,
    hpMultiplier,
  }
}

function getNestMultiplier(level) {
  if (level <= 16) return 4
  if (level >= 30) return 1.2
  return Math.max(1.2, 4 - ((level - 16) * 0.2))
}

function getRepeatMultiplier(streak) {
  return Math.min(4, 1 + (Math.max(0, streak) * 0.1))
}

function getTimerMultiplier(throwTurn) {
  const turn = Math.max(1, Number(throwTurn) || 1)
  return Math.min(4, 1 + (Math.max(0, turn - 1) * 0.3))
}

function getHeavyMultiplier(weightKg) {
  if (!Number.isFinite(weightKg)) return null
  if (weightKg >= 300) return 4
  if (weightKg >= 200) return 3
  if (weightKg >= 100) return 2
  return 1
}

function createUnavailableCandidate(ball, reason) {
  return {
    ballId: ball.id,
    ball: translateBallName(ball.name),
    available: false,
    availabilityNote: reason,
    multiplier: 1,
    chance: 0,
    catchValue: 0,
    rawCatchValue: 0,
    hpMultiplier: 0,
    statusMod: 0,
    catchRate: 0,
    expectedThrows: Number.POSITIVE_INFINITY,
    expectedCost: Number.POSITIVE_INFINITY,
    turns: 0,
    expectedTurnsToSuccess: Number.POSITIVE_INFINITY,
    efficiency: -Infinity,
    price: ball.price,
  }
}

function getGenderLabel(genderRatios) {
  if (genderRatios.genderless) return 'genderless'
  if (genderRatios.female === 1) return 'female-only'
  if (genderRatios.male === 1) return 'male-only'
  return 'mixed'
}

function getBestOverallCandidate(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return null

  const primaryPool = candidates.filter((candidate) => candidate.chance >= MIN_BEST_OVERALL_CHANCE)
  const fallbackPool = candidates.filter((candidate) => candidate.chance >= FALLBACK_BEST_OVERALL_CHANCE)
  const pool = primaryPool.length
    ? primaryPool
    : (fallbackPool.length ? fallbackPool : candidates)

  return [...pool].sort((a, b) => {
    if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency
    if (b.chance !== a.chance) return b.chance - a.chance
    return a.expectedCost - b.expectedCost
  })[0] || null
}

function isLureEncounterContext(encounterContext) {
  const rarityTypes = Array.isArray(encounterContext?.rarityTypes) ? encounterContext.rarityTypes : []
  const encounterTypes = Array.isArray(encounterContext?.encounterTypes) ? encounterContext.encounterTypes : []
  const hasLureRarity = rarityTypes.some((entry) => normalizeKey(entry) === 'lure')
  const hasLureType = encounterTypes.some((entry) => normalizeKey(entry).includes('lure'))
  return hasLureRarity || hasLureType
}

function getBallCandidate(ball, context) {
  const {
    types,
    level,
    isNight,
    isBuilding,
    isWater,
    speed,
    hasMoon,
    hasFriendship,
    weightKg,
    apricornEnabled,
    ironmanMode,
    timerTargetTurn,
    targetGenderLabel,
  } = context

  if (ball.apricorn && !apricornEnabled.has(ball.id)) {
    return createUnavailableCandidate(ball, '此柑果球未启用。')
  }

  const lowerTypes = types.map((type) => String(type).toLowerCase())
  const timerTurn = Math.max(1, Number(timerTargetTurn) || 11)

  let multiplier = 1
  let available = true
  let availabilityNote = '可用'

  if (context.isSafari && ball.id !== 'safari-ball') {
    return createUnavailableCandidate(ball, '狩猎地带与大湿原只能使用狩猎球。')
  }

  if (context.isSafari && ball.id === 'safari-ball') {
    return buildSafariBallCandidate(ball, context.safariCatchData)
  }

  switch (ball.id) {
    case 'great-ball':
      multiplier = 1.5
      break
    case 'ultra-ball':
      multiplier = 2
      break
    case 'safari-ball':
      if (!context.isSafari) {
        available = false
        availabilityNote = '仅能在狩猎地带使用。'
      } else {
        multiplier = 2.5
      }
      break
    case 'net-ball':
      multiplier = lowerTypes.includes('water') || lowerTypes.includes('bug') ? 3.5 : 1
      availabilityNote = multiplier > 1 ? '属性加成生效。' : '该宝可梦不享受属性加成。'
      break
    case 'nest-ball':
      multiplier = getNestMultiplier(level)
      availabilityNote = `等级加成生效（${multiplier.toFixed(1)} 倍）。`
      break
    case 'dive-ball':
      if (!isWater) {
        available = false
        availabilityNote = '仅适用于垂钓／冲浪遭遇。'
      } else {
        multiplier = 3.5
      }
      break
    case 'repeat-ball':
      multiplier = getRepeatMultiplier(context.repeatStreak || 0)
      availabilityNote = context.repeatStreak > 0
        ? `连锁加成生效（${multiplier.toFixed(1)} 倍）。`
        : '首次捕捉没有连锁加成。'
      break
    case 'timer-ball':
      multiplier = getTimerMultiplier(timerTurn)
      availabilityNote = `回合加成生效（第 ${timerTurn} 次投球为 ${multiplier.toFixed(1)} 倍）。`
      break
    case 'quick-ball':
      multiplier = 5
      availabilityNote = '按首回合投球并享受加成计算。'
      break
    case 'dusk-ball':
      if (!isNight && !isBuilding) {
        available = false
        availabilityNote = '需处于游戏内夜晚、强制夜晚，或室内／洞穴遭遇。'
      } else {
        multiplier = 2.5
        availabilityNote = isNight
          ? '夜晚加成生效。'
          : '室内／洞穴加成生效。'
      }
      break
    case 'luxury-ball':
      multiplier = hasFriendship ? 2 : 1
      availabilityNote = hasFriendship ? '亲密度进化宝可梦加成生效。' : '无亲密度进化加成。'
      break
    case 'level-ball':
      multiplier = level === 30 ? 4 : 1
      availabilityNote = level === 30 ? '野生宝可梦等级与 30 级捕捉方相同。' : '无等级相同加成。'
      break
    case 'lure-ball':
      if (!isWater) {
        available = false
        availabilityNote = '仅在垂钓遭遇时获得加成。'
      } else {
        multiplier = 4
      }
      break
    case 'moon-ball':
      multiplier = hasMoon ? 3.5 : 1
      availabilityNote = hasMoon ? '月之石进化家族加成生效。' : '无月之石进化加成。'
      break
    case 'friend-ball':
      multiplier = hasFriendship ? 2.5 : 1
      availabilityNote = hasFriendship ? '亲密度进化家族加成生效。' : '无亲密度进化加成。'
      break
    case 'heavy-ball': {
      const heavyMultiplier = getHeavyMultiplier(weightKg)
      if (heavyMultiplier == null) {
        available = false
        availabilityNote = '该宝可梦暂未收录体重数据。'
      } else {
        multiplier = heavyMultiplier
        availabilityNote = `体重加成生效（${multiplier.toFixed(1)} 倍）。`
      }
      break
    }
    case 'fast-ball':
      multiplier = speed >= 100 ? 4 : 1
      availabilityNote = speed >= 100 ? '速度加成生效（基础速度 100 以上）。' : '基础速度低于 100，没有速度加成。'
      break
    case 'love-ball':
      if (targetGenderLabel === 'genderless') {
        available = false
        availabilityNote = '甜蜜球对无性别宝可梦无效。'
      } else if (targetGenderLabel === 'male-only' || targetGenderLabel === 'female-only') {
        available = false
        availabilityNote = '单一性别宝可梦无法满足同种异性条件。'
      } else {
        multiplier = 8
        availabilityNote = '同种异性首发时倍率为 8.0（需要较高准备成本）。'
      }
      break
    default:
      multiplier = 1
  }

  if (!available) {
    return createUnavailableCandidate(ball, availabilityNote)
  }

  const quickTurnOneDetails = calculateCatchChanceDetails(context.catchRate, multiplier, 100, 1)
  if (ball.id === 'quick-ball' && quickTurnOneDetails.chance < MIN_QUICK_BALL_CHANCE) {
    return createUnavailableCandidate(ball, `先机球要求首回合捕获率至少为 ${MIN_QUICK_BALL_CHANCE}%（当前为 ${formatPercent(quickTurnOneDetails.chance)}）。`)
  }

  const price = ball.price == null ? NaN : ball.price
  const effectivePrice = Number.isFinite(price) ? price : 500

  const profileScores = METHOD_PROFILES.map((profile) => {
    const profileMultiplier = (ball.id === 'quick-ball' && profile.id !== 'normal100') ? 1 : multiplier
    const details = calculateCatchChanceDetails(context.catchRate, profileMultiplier, profile.hpPercent, profile.statusMod)
    const chance = details.chance
    const expectedThrows = chance > 0 ? 100 / chance : Number.POSITIVE_INFINITY
    let turns = ball.id === 'timer-ball' ? timerTurn : profile.turns
    if (ball.id === 'love-ball') {
      turns += 2
    }
    const expectedTurnsToSuccess = Number.isFinite(expectedThrows) ? expectedThrows * turns : Number.POSITIVE_INFINITY
    const expectedCost = Number.isFinite(expectedThrows) ? expectedThrows * effectivePrice : Number.POSITIVE_INFINITY
    const costFactor = Math.max(1, effectivePrice / 200)
    const score = chance / (turns + costFactor)

    return {
      profile,
      details,
      chance,
      expectedThrows,
      expectedTurnsToSuccess,
      expectedCost,
      turns,
      score,
      statusMod: profile.statusMod,
      hpPercent: profile.hpPercent,
      multiplier: profileMultiplier,
    }
  })

  const bestProfile = profileScores.sort((a, b) => b.score - a.score)[0]
  const catchDetails = bestProfile.details
  const chance = bestProfile.chance
  const expectedThrows = bestProfile.expectedThrows
  const expectedCost = bestProfile.expectedCost
  const turns = bestProfile.turns
  const expectedTurnsToSuccess = bestProfile.expectedTurnsToSuccess

  let conveniencePenalty = ball.id === 'timer-ball' ? 0.55 : 0
  if (ball.id === 'love-ball') conveniencePenalty += 1.15
  const reliabilityWeight = Math.pow(Math.max(0, chance) / 100, 1.3)
  const lowChancePenalty = chance < 50 ? Math.pow(Math.max(0, chance) / 50, 2.2) : 1
  const denominator = Number.isFinite(expectedCost) && Number.isFinite(expectedTurnsToSuccess)
    ? expectedCost + (expectedTurnsToSuccess * (ironmanMode ? 90 : 140))
    : Number.POSITIVE_INFINITY
  const efficiency = Number.isFinite(expectedCost)
    ? ((reliabilityWeight * lowChancePenalty * 100000) / denominator) - conveniencePenalty
    : -Infinity

  return {
    ballId: ball.id,
    ball: translateBallName(ball.name),
    available,
    availabilityNote,
    multiplier,
    chance,
    expectedThrows,
    expectedCost,
    turns,
    expectedTurnsToSuccess,
    efficiency,
    catchValue: catchDetails.value,
    rawCatchValue: catchDetails.rawValue,
    hpMultiplier: catchDetails.hpMultiplier,
    hpPercent: bestProfile.hpPercent,
    statusMod: bestProfile.statusMod,
    methodLabel: bestProfile.profile.label,
    catchRate: context.catchRate,
    price: Number.isFinite(price) ? price : null,
  }
}

function pickBestLongTermRepeat(candidates) {
  const repeat = candidates.find((candidate) => candidate.ballId === 'repeat-ball')
  if (!repeat) return null

  return repeat
}

function getRepeatThreshold(context, baselineBestEfficiency) {
  for (let streak = 1; streak <= 30; streak += 1) {
    const repeatCandidate = getBallCandidate(
      BALLS.find((ball) => ball.id === 'repeat-ball'),
      { ...context, repeatStreak: streak }
    )
    if (!repeatCandidate || !repeatCandidate.available) continue
    if (repeatCandidate.efficiency >= baselineBestEfficiency) {
      return streak
    }
  }
  return null
}

function buildPokemonRecommendation(pokemonName, routeEntry, options, routeEncounterIndex, period) {
  const pokemon = pokemonData[pokemonName]
  if (!pokemon) return null

  const isSafari = options.forceSafari || isSafariRoute(routeEntry.routeName)
  const safariCatchData = isSafari ? getSafariCatchData(pokemonName) : null
  const catchRate = isSafari
    ? Number(safariCatchData?.catchRate)
    : (options.alphaMode ? 10 : getCatchRateByName(pokemonName))
  if (!Number.isFinite(catchRate)) return null
  
  const encounterContext = getEncounterContext(routeEntry, pokemonName, routeEncounterIndex)
  const isLureEncounter = isLureEncounterContext(encounterContext)
  const level = Number.isFinite(options.customLevel) ? options.customLevel : encounterContext.level
  const speed = getSpeedStat(pokemon)
  const weightKg = getWeightKg(pokemon)
  const hasMoon = hasMoonStoneEvolution(pokemon)
  const hasFriendship = hasFriendshipEvolution(pokemon)
  const genderRatios = getGenderRatios(pokemon)
  const isNight = Boolean(options.forceNight)
  const types = pokemon?.types || []
  const isGhost = types.some((type) => String(type).toLowerCase() === 'ghost')
  const isWater = encounterContext.variationCategory === 'fishing'
    || encounterContext.variationCategory === 'water'
    || encounterContext.encounterTypes.some((entry) => isWaterMethod(entry))
  const isBuilding = options.forceIndoor || isBuildingRoute(routeEntry.routeName)
  const finalIsWater = options.forceWater || isWater
  const calcContext = {
    catchRate,
    level,
    types,
    speed,
    weightKg,
    hasMoon,
    hasFriendship,
    isNight,
    isBuilding,
    isWater: finalIsWater,
    isSafari,
    safariCatchData,
    apricornEnabled: options.ironmanMode ? new Set() : options.apricornEnabled,
    repeatStreak: 0,
    ironmanMode: options.ironmanMode,
    timerTargetTurn: TIMER_TARGET_TURN,
    targetGenderLabel: getGenderLabel(genderRatios),
  }

  const candidates = BALLS.map((ball) => getBallCandidate(ball, calcContext))

  const baseAvailable = candidates.filter((candidate) => candidate.available)
  const shouldSuppressTimerBall = baseAvailable.some((candidate) => {
    if (candidate.ballId === 'timer-ball') return false
    return candidate.chance >= TIMER_BALL_MIN_BALL_PERCENT
  })

  const available = shouldSuppressTimerBall
    ? baseAvailable.filter((candidate) => candidate.ballId !== 'timer-ball')
    : baseAvailable
  if (!available.length) {
    return {
      pokemonName,
      routeName: routeEntry.displayName,
      level,
      encounterPercent: routeEntry.pokemonPercents.get(normalizePokemonName(pokemonName))?.percent || 0,
      types,
      isGhost,
      bestOverall: null,
      cheapest: null,
      fastest: null,
      highestCatch: null,
      selected: null,
      longTerm: null,
      repeatThreshold: null,
      analysis: candidates,
      avgCost: Number.POSITIVE_INFINITY,
      avgTurns: 0,
      avgChance: 0,
      explanation: '当前筛选条件下没有可用的精灵球。',
      genderRatios,
      eggGroups: pokemon.egg_groups || [],
      catchRate,
      isLureEncounter,
      scoreEncounterPercent: isLureEncounter ? LURE_ENCOUNTER_RATE_PERCENT : 0,
    }
  }

  const cheapestPool = available.filter((candidate) => candidate.chance >= MIN_CHEAPEST_CHANCE)
  const nonTimerCheapestPool = cheapestPool.filter((candidate) => candidate.ballId !== 'timer-ball')
  const timerCheapestPool = cheapestPool.filter((candidate) => candidate.ballId === 'timer-ball')
  const cheapest = [...(nonTimerCheapestPool.length ? nonTimerCheapestPool : timerCheapestPool)]
    .sort((a, b) => a.expectedCost - b.expectedCost)[0] || null
  const fastest = [...available].sort((a, b) => a.expectedTurnsToSuccess - b.expectedTurnsToSuccess || b.chance - a.chance)[0]
  const highestCatch = [...available].sort((a, b) => b.chance - a.chance || a.expectedCost - b.expectedCost)[0]

  const bestOverall = getBestOverallCandidate(available) || highestCatch

  let selected = bestOverall
  if (options.priority === PRIORITY_CHEAPEST && cheapest) selected = cheapest
  if (options.priority === PRIORITY_FASTEST) selected = fastest
  if (options.priority === PRIORITY_HIGHEST) selected = highestCatch

  const repeatBall = pickBestLongTermRepeat(available)
  const repeatThreshold = getRepeatThreshold(calcContext, bestOverall.efficiency)

  const explanation = selected === bestOverall
    ? `在当前条件下，${translateBallName(selected.ball)}的综合性价比最高。`
    : `按“${getPriorityLabel(options.priority)}”优先级，推荐使用${translateBallName(selected.ball)}。`

  return {
    pokemonName,
    routeName: routeEntry.displayName,
    level,
    encounterPercent: routeEntry.pokemonPercents.get(normalizePokemonName(pokemonName))?.percent || 0,
    bestOverall,
    cheapest,
    fastest,
    highestCatch,
    selected,
    longTerm: repeatBall,
    repeatThreshold,
    analysis: candidates.sort((a, b) => b.chance - a.chance || a.expectedCost - b.expectedCost),
    avgCost: selected.expectedCost,
    avgTurns: selected.expectedTurnsToSuccess,
    avgChance: selected.chance,
    explanation,
    genderRatios,
    eggGroups: pokemon.egg_groups || [],
    types,
    isGhost,
    catchRate,
    isLureEncounter,
    scoreEncounterPercent: isLureEncounter ? LURE_ENCOUNTER_RATE_PERCENT : 0,
  }
}

function routeScore(parts) {
  return getRouteScoreBreakdown(parts).baseScore
}

function getRouteScoreBreakdown(parts) {
  const avgChance = Number(parts?.avgChance) || 0
  const avgTurns = Number(parts?.avgTurns) || 0
  const avgCost = Number(parts?.avgCost) || 0
  const avgEncounterPercent = Number(parts?.avgEncounterPercent) || 0

  const chanceScore = Math.min(100, avgChance)
  const turnsScore = Math.max(0, 100 - (avgTurns - 1) * 22)
  const costScore = Math.max(0, 100 - (avgCost / 25))
  const encounterScore = Math.min(100, avgEncounterPercent * 2.5)
  const encounterIncluded = avgEncounterPercent > 0

  const costContribution = costScore * 0.34
  const chanceContribution = chanceScore * 0.28
  const turnsContribution = turnsScore * 0.2
  const encounterContribution = encounterIncluded ? encounterScore * 0.18 : 0
  const weightedSum = costContribution + chanceContribution + turnsContribution + encounterContribution
  const activeWeight = encounterIncluded ? 1 : 0.82
  const baseScore = activeWeight > 0 ? Math.min(100, weightedSum / activeWeight) : 0

  return {
    avgChance,
    avgTurns,
    avgCost,
    avgEncounterPercent,
    encounterIncluded,
    costScore,
    chanceScore,
    turnsScore,
    encounterScore,
    costContribution,
    chanceContribution,
    turnsContribution,
    encounterContribution,
    baseScore,
  }
}

function getGenderWeight(genderRatios, genderPriority) {
  if (genderPriority === GENDER_IGNORE || genderRatios.genderless) return 1
  if (genderPriority === GENDER_FEMALE) return 0.5 + genderRatios.female
  return 0.5 + genderRatios.male
}

function buildRouteRanking({
  routes,
  options,
  routeEncounterIndex,
  period,
  mode,
  pokemonTarget,
  eggGroupTarget,
}) {
  const pokemonTargets = getPokemonSearchTargets(pokemonTarget)
  const normalizedEggGroupTarget = normalizeKey(eggGroupTarget)

  const ranked = routes.map((routeEntry) => {
    if (mode === MODE_EGG && isEggGroupExcludedRoute(routeEntry)) {
      return {
        routeEntry,
        recommendations: [],
        score: -1,
        summary: null,
      }
    }

    const routePokemonNames = Array.from(routeEntry.pokemonPercents.keys())
      .map((key) => POKEMON_NAME_BY_SLUG[key])
      .filter(Boolean)

    const recommendations = routePokemonNames
      .map((pokemonName) => buildPokemonRecommendation(pokemonName, routeEntry, options, routeEncounterIndex, period))
      .filter(Boolean)
      .filter((result) => {
        if (mode === MODE_POKEMON) {
          return pokemonTargets.has(normalizeKey(result.pokemonName))
        }
        if (mode === MODE_EGG) {
          return (result.eggGroups || []).some((group) => normalizeKey(group) === normalizedEggGroupTarget)
        }
        return true
      })

    if (!recommendations.length) {
      return {
        routeEntry,
        recommendations: [],
        score: -1,
        summary: null,
      }
    }

    const totalWeight = recommendations.reduce((sum, rec) => sum + Math.max(0.01, rec.encounterPercent), 0)
    const weighted = recommendations.reduce((acc, rec) => {
      const w = Math.max(0.01, rec.encounterPercent) / totalWeight
      const genderWeight = mode === MODE_EGG ? getGenderWeight(rec.genderRatios, options.genderPriority) : 1
      acc.avgCost += rec.avgCost * w
      acc.avgTurns += rec.avgTurns * w
      acc.avgChance += rec.avgChance * w
      acc.avgEncounterPercent += (Number(rec.scoreEncounterPercent) || 0) * w
      acc.genderWeight += genderWeight * w
      return acc
    }, {
      avgCost: 0,
      avgTurns: 0,
      avgChance: 0,
      avgEncounterPercent: 0,
      genderWeight: 1,
    })

    const scoreBreakdown = getRouteScoreBreakdown(weighted)
    let score = scoreBreakdown.baseScore
    let genderMultiplier = 1
    if (mode === MODE_EGG) {
      genderMultiplier = weighted.genderWeight
      score *= genderMultiplier
      score = Math.min(100, score)
    }

    return {
      routeEntry,
      recommendations,
      score,
      summary: weighted,
      scoreBreakdown: {
        ...scoreBreakdown,
        genderMultiplier,
        finalScore: score,
      },
    }
  })

  return ranked
    .filter((entry) => entry.recommendations.length > 0)
    .sort((a, b) => {
      if (mode === MODE_EGG) {
        const chanceGap = Math.abs((b.summary?.avgChance || 0) - (a.summary?.avgChance || 0))
        if (chanceGap <= SIMILAR_CATCH_GAP_PERCENT) {
          const recommendationGap = b.recommendations.length - a.recommendations.length
          if (recommendationGap !== 0) return recommendationGap
        }
      }

      if (b.score !== a.score) return b.score - a.score

      const avgChanceGap = (b.summary?.avgChance || 0) - (a.summary?.avgChance || 0)
      if (avgChanceGap !== 0) return avgChanceGap

      return b.recommendations.length - a.recommendations.length
    })
}

  const handleInfoDropdownToggle = (event) => {
    const isOpen = event.currentTarget.open
    setIsInfoDropdownOpen(isOpen)

    if (typeof window === 'undefined') return
    if (isOpen) {
      window.localStorage.removeItem(INFO_DROPDOWN_CLOSED_KEY)
    } else {
      window.localStorage.setItem(INFO_DROPDOWN_CLOSED_KEY, 'true')
    }
  }

function buildSpecificPokemonSelection({
  routes,
  pokemonName,
  selectedRouteId,
  options,
  routeEncounterIndex,
  period,
  customLevel,
  alphaMode,
}) {
  const routePool = selectedRouteId
    ? routes.filter((route) => route.id === selectedRouteId)
    : routes.filter((route) => route.pokemonPercents.has(normalizePokemonName(pokemonName)))

  if (!routePool.length) return null

  const rankedRoutes = routePool
    .map((routeEntry) => {
      const syntheticRoute = {
        ...routeEntry,
        id: `custom-single-analysis-${routeEntry.id}`,
        pokemonPercents: new Map([[normalizePokemonName(pokemonName), { percent: 100 }]]),
      }

      const recommendation = buildPokemonRecommendation(pokemonName, syntheticRoute, {
        ...options,
        customLevel,
        alphaMode,
      }, routeEncounterIndex, period)

      if (!recommendation?.selected) return null

      return {
        routeEntry,
        result: recommendation,
        score: routeScore({
          avgCost: recommendation.avgCost,
          avgTurns: recommendation.avgTurns,
          avgChance: recommendation.avgChance,
          avgEncounterPercent: recommendation.scoreEncounterPercent || 0,
        }),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.result.avgChance - a.result.avgChance)

  if (!rankedRoutes.length) return null

  return {
    ...rankedRoutes[0],
    routeWasAutoSelected: !selectedRouteId,
  }
}

function getDisplayPercentLabel(routeEntry, pokemonName) {
  const slug = normalizePokemonName(pokemonName)
  const info = routeEntry.pokemonPercents.get(slug)
  if (!info) return '0.0%'
  return formatPercent(info.percent)
}

function buildComparisonRows(result, priority) {
  return [
    { key: PRIORITY_OVERALL, label: '综合最优', value: result.bestOverall ? `${translateBallName(result.bestOverall.ball)}（${formatPercent(result.bestOverall.chance)}）` : '不适用' },
    { key: PRIORITY_CHEAPEST, label: '最低成本', value: result.cheapest ? `${translateBallName(result.cheapest.ball)}（${formatMoney(result.cheapest.expectedCost)}）` : '不适用' },
    { key: PRIORITY_FASTEST, label: '最快捕捉', value: result.fastest ? `${translateBallName(result.fastest.ball)}（${formatExpectedTurns(result.fastest.expectedTurnsToSuccess)} 回合）` : '不适用' },
    { key: PRIORITY_HIGHEST, label: '最高捕获率', value: result.highestCatch ? `${translateBallName(result.highestCatch.ball)}（${formatPercent(result.highestCatch.chance)}）` : '不适用' },
  ].filter((entry) => entry.key !== priority)
}

function formatCatchEventTitle(eventDate) {
  const dateLabel = eventDate
    ? new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(eventDate)
    : ''
  return `官方捕捉活动${dateLabel ? `（${dateLabel}）` : ''}`
}

export default function CatchingCalculator() {
  const { period } = useInGameClock()
  const { data: officialEventsData, isLoading: isOfficialEventsLoading } = useOfficialEvents()

  const [isInfoDropdownOpen, setIsInfoDropdownOpen] = useState(() => getInitialInfoDropdownOpen())
  const [mode, setMode] = useState(MODE_ROUTE)
  const [selectedRoute, setSelectedRoute] = useState('')
  const [routeEncounterMethod, setRouteEncounterMethod] = useState(METHOD_NORMAL)
  const [routeSearch, setRouteSearch] = useState('')
  const [pokemonSearch, setPokemonSearch] = useState('')
  const [eggGroupSearch, setEggGroupSearch] = useState('')
  const [specificPokemonSearch, setSpecificPokemonSearch] = useState('')
  const [specificRouteSearch, setSpecificRouteSearch] = useState('')
  const [specificRouteId, setSpecificRouteId] = useState('')
  const [specificLevel, setSpecificLevel] = useState(30)
  const [specificAlpha, setSpecificAlpha] = useState(false)
  const [activeBreakdownKey, setActiveBreakdownKey] = useState('')
  const [showMoreCount, setShowMoreCount] = useState(1)
  const [enabledCatchEventLink, setEnabledCatchEventLink] = useState('')

  const [apricornEnabled, setApricornEnabled] = useState(() => new Set())
  const [ironmanMode, setIronmanMode] = useState(false)
  const [forceNight, setForceNight] = useState(false)
  const [forceDayTimeOverride, setForceDayTimeOverride] = useState(false)
  const [priority, setPriority] = useState(PRIORITY_OVERALL)
  const [genderPriority, setGenderPriority] = useState(GENDER_MALE)

  const effectiveForceNight = forceNight || (period === 'Night' && !forceDayTimeOverride)

  const enableAllApricornBalls = () => setApricornEnabled(createApricornSelection(APRICORN_BALL_IDS))
  const disableAllApricornBalls = () => setApricornEnabled(createApricornSelection([]))

  useDocumentHead({
    title: '捕捉计算器｜PokeMMO',
    description: '按地点、宝可梦或蛋组计算 PokeMMO 中兼顾成功率、时间与成本的捕捉方案。',
    canonicalPath: '/catching-calculator/',
  })
  function getInitialInfoDropdownOpen() {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(INFO_DROPDOWN_CLOSED_KEY) !== 'true'
}
  const routeEncounterIndex = useMemo(() => buildRouteEncounterIndex(), [])

  const allRoutes = useMemo(() => buildAllRouteUniverse(routeEncounterMethod), [routeEncounterMethod])

  const officialCatchEvents = useMemo(() => {
    const now = new Date()
    const nowMs = Date.now()
    const rows = Array.isArray(officialEventsData) ? officialEventsData : []

    return rows
      .map((item, index) => {
        if (!CATCH_EVENT_REGEX.test(item?.description || '')) return null
        if (isBlacklistedCatchEventTitle(item?.title || '')) return null
        const eventDate = extractEventDate(item?.title, now)
        const utcTime = extractUtcTime(item?.description)

        return {
          id: item?.link || `${item?.title || 'event'}-${index}`,
          title: formatCatchEventTitle(eventDate),
          link: item?.link || '',
          location: extractCatchEventLocation(item?.description || ''),
          eventDate,
          utcTime,
          localStartLabel: formatEventLocalStart(eventDate, utcTime),
          validEntries: extractCatchEventValidEntries(item?.description || ''),
        }
      })
      .filter((event) => event && !isCatchEventEnded(event.eventDate, event.utcTime, nowMs))
      .sort((a, b) => {
        const aStamp = a.eventDate ? a.eventDate.getTime() : Number.MAX_SAFE_INTEGER
        const bStamp = b.eventDate ? b.eventDate.getTime() : Number.MAX_SAFE_INTEGER
        if (aStamp !== bStamp) return aStamp - bStamp
        return a.title.localeCompare(b.title)
      })
  }, [officialEventsData])

  const enabledOfficialCatchEvent = useMemo(
    () => officialCatchEvents.find((event) => event.id === enabledCatchEventLink) || null,
    [officialCatchEvents, enabledCatchEventLink]
  )

  const catchEventEntries = useMemo(() => {
    const validRows = Array.isArray(enabledOfficialCatchEvent?.validEntries)
      ? enabledOfficialCatchEvent.validEntries
      : []

    return validRows
      .map((entry, index) => ({
        id: `${normalizeKey(entry?.pokemonName || `entry-${index}`)}-${index}`,
        pokemonName: String(entry?.pokemonName || '').trim(),
        bonus: Number(entry?.bonus) || 0,
      }))
      .filter((entry) => entry.pokemonName)
  }, [enabledOfficialCatchEvent])

  const pokemonNames = useMemo(
    () => POKEMON_VALUES
      .map((pokemon) => pokemon.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    []
  )

  const eggGroups = useMemo(() => {
    const set = new Set()
    POKEMON_VALUES.forEach((pokemon) => {
      const groups = Array.isArray(pokemon.egg_groups) ? pokemon.egg_groups : []
      groups.forEach((group) => set.add(titleCase(group)))
    })

    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [])

  const options = useMemo(() => ({
    apricornEnabled,
    priority,
    genderPriority,
    ironmanMode,
    forceNight: effectiveForceNight,
  }), [
    apricornEnabled,
    priority,
    genderPriority,
    ironmanMode,
    effectiveForceNight,
  ])

  useEffect(() => {
    if (specificAlpha && priority !== PRIORITY_HIGHEST) {
      setPriority(PRIORITY_HIGHEST)
    }
  }, [specificAlpha, priority])

  useEffect(() => {
    if (period !== 'Night' && forceDayTimeOverride) {
      setForceDayTimeOverride(false)
    }
  }, [period, forceDayTimeOverride])

  useEffect(() => {
    if (!specificRouteId) return

    const selectedSpecificRoute = allRoutes.find((route) => route.id === specificRouteId)
    const canonicalName = getCanonicalPokemonName(specificPokemonSearch)

    setSpecificLevel(getSpecificRouteLevel(selectedSpecificRoute, canonicalName, routeEncounterIndex))
  }, [specificRouteId, specificPokemonSearch, allRoutes, routeEncounterIndex])

  const customPokemonSelection = useMemo(() => {
    const canonicalName = getCanonicalPokemonName(specificPokemonSearch)
    if (!canonicalName) return null

    return buildSpecificPokemonSelection({
      routes: allRoutes,
      pokemonName: canonicalName,
      selectedRouteId: specificRouteId,
      options,
      routeEncounterIndex,
      period,
      customLevel: Math.max(1, Number(specificLevel) || 1),
      alphaMode: specificAlpha,
    })
  }, [specificPokemonSearch, specificRouteId, specificLevel, specificAlpha, allRoutes, options, routeEncounterIndex, period])

  const customPokemonResult = customPokemonSelection?.result || null
  const customPokemonRouteEntry = customPokemonSelection?.routeEntry || null

  const selectedRouteEntry = useMemo(
    () => allRoutes.find((route) => route.id === selectedRoute) || null,
    [allRoutes, selectedRoute]
  )

  const routeOptions = useMemo(
    () => allRoutes
      .map((route) => ({
        id: route.id,
        label: formatRouteLabel(route),
        searchText: `${route.region || ''} ${route.displayName || ''} ${formatRouteLabel(route)}`,
        routeName: route.displayName,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [allRoutes]
  )

  const filteredRouteOptions = useMemo(() => {
    const query = normalizeKey(routeSearch)
    if (query.length < ROUTE_SUGGESTION_MIN_CHARS) return []
    return routeOptions
      .filter((option) => normalizeKey(option.searchText).includes(query))
      .slice(0, MAX_SUGGESTIONS)
  }, [routeOptions, routeSearch])

  const filteredSpecificRouteOptions = useMemo(() => {
    const query = normalizeKey(specificRouteSearch)
    if (query.length < ROUTE_SUGGESTION_MIN_CHARS) return []
    return routeOptions
      .filter((option) => normalizeKey(option.searchText).includes(query))
      .slice(0, MAX_SUGGESTIONS)
  }, [routeOptions, specificRouteSearch])

  const filteredPokemonOptions = useMemo(() => {
    const query = normalizeKey(pokemonSearch)
    if (query.length < POKEMON_SUGGESTION_MIN_CHARS) return []
    return pokemonNames
      .filter((name) => normalizeKey(name).includes(query) || normalizeKey(translatePokemonName(name)).includes(query))
      .slice(0, MAX_SUGGESTIONS)
  }, [pokemonNames, pokemonSearch])

  const filteredSpecificPokemonOptions = useMemo(() => {
    const query = normalizeKey(specificPokemonSearch)
    if (query.length < POKEMON_SUGGESTION_MIN_CHARS) return []
    return pokemonNames
      .filter((name) => normalizeKey(name).includes(query) || normalizeKey(translatePokemonName(name)).includes(query))
      .slice(0, MAX_SUGGESTIONS)
  }, [pokemonNames, specificPokemonSearch])

  const specificRouteEntry = useMemo(
    () => allRoutes.find((route) => route.id === specificRouteId) || null,
    [allRoutes, specificRouteId]
  )

  useEffect(() => {
    if (!selectedRouteEntry) return
    const label = formatRouteLabel(selectedRouteEntry)
    setRouteSearch(label)
  }, [selectedRouteEntry?.id])

  function handleRoutePick(value) {
    setRouteSearch(value)
    const exact = routeOptions.find((option) => normalizeKey(option.label) === normalizeKey(value))
    if (exact) {
      setSelectedRoute(exact.id)
    } else {
      setSelectedRoute('')
    }
  }

  function handleSpecificRoutePick(value) {
    setSpecificRouteSearch(value)
    const exact = routeOptions.find((option) => normalizeKey(option.label) === normalizeKey(value))
    if (exact) {
      setSpecificRouteId(exact.id)
    } else {
      setSpecificRouteId('')
    }
  }

  function handleForceDuskToggle(nextChecked) {
    if (nextChecked) {
      setForceNight(true)
      setForceDayTimeOverride(false)
      return
    }

    setForceNight(false)
    setForceDayTimeOverride(period === 'Night')
  }

  const routeRecommendations = useMemo(() => {
    if (!selectedRouteEntry) return []

    const pokemonList = Array.from(selectedRouteEntry.pokemonPercents.keys())
      .map((slug) => POKEMON_NAME_BY_SLUG[slug])
      .filter(Boolean)
      .map((pokemonName) => buildPokemonRecommendation(pokemonName, selectedRouteEntry, options, routeEncounterIndex, period))
      .filter(Boolean)
      .sort((a, b) => b.encounterPercent - a.encounterPercent)

    return pokemonList
  }, [selectedRouteEntry, options, routeEncounterIndex, period])

  const rankedRoutes = useMemo(() => {
    if (mode === MODE_ROUTE || mode === MODE_SPECIFIC) return []
    if (mode === MODE_POKEMON && !pokemonSearch.trim()) return []
    if (mode === MODE_EGG && !eggGroupSearch.trim()) return []

    const ranked = buildRouteRanking({
      routes: allRoutes,
      options,
      routeEncounterIndex,
      period,
      mode,
      pokemonTarget: pokemonSearch,
      eggGroupTarget: eggGroupSearch,
    })

    return ranked
  }, [mode, pokemonSearch, eggGroupSearch, allRoutes, options, routeEncounterIndex, period])

  const catchEventRecommendations = useMemo(() => {
    if (!catchEventEntries.length) return []

    return catchEventEntries.map((entry) => {
      const canonicalName = getCanonicalPokemonName(entry.pokemonName)
      if (!canonicalName) {
        return {
          ...entry,
          canonicalName: null,
          result: null,
        }
      }

      const syntheticRoute = {
        id: `event-entry-${normalizePokemonName(canonicalName)}`,
        region: '捕捉活动',
        routeName: enabledOfficialCatchEvent?.location || enabledOfficialCatchEvent?.title || '活动地点',
        displayName: enabledOfficialCatchEvent?.location || enabledOfficialCatchEvent?.title || '捕捉活动',
        variation: '活动参赛条目',
        encounterCategory: METHOD_NORMAL,
        pokemonPercents: new Map([[normalizePokemonName(canonicalName), { percent: 100, label: '100.0%' }]]),
      }

      const result = buildPokemonRecommendation(canonicalName, syntheticRoute, options, routeEncounterIndex, period)

      return {
        ...entry,
        canonicalName,
        result,
      }
    })
  }, [catchEventEntries, enabledOfficialCatchEvent, options, routeEncounterIndex, period])

  const visibleRankedRoutes = rankedRoutes.slice(0, showMoreCount)
  const activeRouteBreakdown = useMemo(() => {
    if (!activeBreakdownKey) return null
    return routeRecommendations.find((entry) => `${selectedRouteEntry?.id || ''}|${entry.pokemonName}` === activeBreakdownKey) || null
  }, [activeBreakdownKey, routeRecommendations, selectedRouteEntry?.id])
  const activeRankedRouteBreakdown = useMemo(() => {
    if (!activeBreakdownKey) return null

    for (const entry of rankedRoutes) {
      const match = entry.recommendations.find((result) => `${entry.routeEntry.id}|${result.pokemonName}` === activeBreakdownKey)
      if (match) {
        return {
          ...match,
          routeEntry: entry.routeEntry,
        }
      }
    }

    return null
  }, [activeBreakdownKey, rankedRoutes])
  const selectedPriorityLabel = getPriorityLabel(priority)

  return (
    <div className={styles.page}>
      <h1 className="page-title">捕捉计算器</h1>

      <details className={styles.infoDropdown} open={isInfoDropdownOpen} onToggle={handleInfoDropdownToggle}>
        <summary>测试版说明</summary>
        <p>
          本工具以捕获率、精灵球成本和所需回合数综合计算推荐用球。它仍在持续校验中；若你发现明显错误的捕获率或计算结果，请通过 Discord 联系 oHypers。
        </p>
        <p>
          在计算模型完全定稿前，请将结果作为实战决策的参考；它仍能帮助你更快比较不同捕捉方案。
        </p>
        </details>

      <section className={styles.controlsCard}>
        <div className={styles.modeTabs} role="tablist" aria-label="搜索模式">
          <button
            type="button"
            className={`${styles.modeTab} ${mode === MODE_ROUTE ? styles.modeTabActive : ''}`}
            onClick={() => {
              setMode(MODE_ROUTE)
              setShowMoreCount(1)
            }}
          >
            地点搜索
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === MODE_POKEMON ? styles.modeTabActive : ''}`}
            onClick={() => {
              setMode(MODE_POKEMON)
              setShowMoreCount(1)
            }}
          >
            宝可梦搜索
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === MODE_EGG ? styles.modeTabActive : ''}`}
            onClick={() => {
              setMode(MODE_EGG)
              setShowMoreCount(1)
            }}
          >
            蛋组搜索
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === MODE_SPECIFIC ? styles.modeTabActive : ''}`}
            onClick={() => {
              setMode(MODE_SPECIFIC)
              setShowMoreCount(1)
            }}
          >
            指定宝可梦
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === MODE_CATCH_EVENTS ? styles.modeTabActive : ''}`}
            onClick={() => {
              setMode(MODE_CATCH_EVENTS)
              setShowMoreCount(1)
            }}
          >
            捕捉活动
          </button>
        </div>

        <div className={styles.controlGrid}>
          {mode === MODE_ROUTE && (
            <label className={styles.controlField}>
              <span>地点</span>
              <input
                type="text"
                list="catch-calc-route-list"
                value={routeSearch}
                onChange={(event) => handleRoutePick(event.target.value)}
                placeholder="搜索地点（如 24号道路、常青森林）"
              />
              <datalist id="catch-calc-route-list">
                {filteredRouteOptions.map((route) => (
                  <option key={route.id} value={route.label} />
                ))}
              </datalist>
            </label>
          )}

          {mode === MODE_ROUTE && (
            <label className={styles.controlField}>
              <span>遭遇方式</span>
              <select value={routeEncounterMethod} onChange={(event) => setRouteEncounterMethod(event.target.value)}>
                <option value={METHOD_NORMAL}>普通遭遇</option>
                <option value={METHOD_FISHING}>垂钓</option>
                <option value={METHOD_SURFING}>冲浪</option>
              </select>
            </label>
          )}

          {mode === MODE_POKEMON && (
            <label className={styles.controlField}>
              <span>宝可梦</span>
              <input
                type="text"
                list="catch-calc-pokemon-list-main"
                value={pokemonSearch}
                onChange={(event) => {
                  setPokemonSearch(event.target.value)
                  setShowMoreCount(1)
                }}
                placeholder="搜索宝可梦（可输入中文或英文）"
              />
              <datalist id="catch-calc-pokemon-list-main">
                {filteredPokemonOptions.map((name) => (
                  <option key={name} value={name} label={formatPokemonDisplayName(name)} />
                ))}
              </datalist>
            </label>
          )}

          {mode === MODE_EGG && (
            <label className={styles.controlField}>
              <span>蛋组</span>
              <select
                value={eggGroupSearch}
                onChange={(event) => {
                  setEggGroupSearch(event.target.value)
                  setShowMoreCount(1)
                }}
              >
                <option value="">选择蛋组</option>
                {eggGroups.map((group) => (
                  <option key={group} value={group}>{translateEggGroupName(group)}</option>
                ))}
              </select>
            </label>
          )}

          {mode === MODE_SPECIFIC && (
            <>
              <label className={styles.controlField}>
                <span>宝可梦</span>
                <input
                  type="text"
                  list="catch-calc-pokemon-list-specific"
                  value={specificPokemonSearch}
                  onChange={(event) => setSpecificPokemonSearch(event.target.value)}
                  placeholder="输入宝可梦名称（中文或英文）"
                />
                <datalist id="catch-calc-pokemon-list-specific">
                  {filteredSpecificPokemonOptions.map((name) => (
                    <option key={name} value={name} label={formatPokemonDisplayName(name)} />
                  ))}
                </datalist>
              </label>

              <label className={styles.controlField}>
                <span>捕捉地点</span>
                <input
                  type="text"
                  list="catch-calc-specific-route-list"
                  value={specificRouteSearch}
                  onChange={(event) => handleSpecificRoutePick(event.target.value)}
                  placeholder="可选：输入并选择地点"
                />
                <datalist id="catch-calc-specific-route-list">
                  {filteredSpecificRouteOptions.map((route) => (
                    <option key={`specific-${route.id}`} value={route.label} />
                  ))}
                </datalist>
              </label>

              <label className={styles.controlField}>
                <span>宝可梦等级</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={specificLevel}
                  onChange={(event) => setSpecificLevel(Number(event.target.value) || 1)}
                />
              </label>

              <label className={styles.controlField}>
                <span>个体类型</span>
                <select value={specificAlpha ? 'alpha' : 'normal'} onChange={(event) => setSpecificAlpha(event.target.value === 'alpha')}>
                  <option value="normal">普通</option>
                  <option value="alpha">头目（捕获率 10）</option>
                </select>
              </label>
            </>
          )}

          {mode === MODE_EGG && (
            <label className={styles.controlField}>
              <span>性别优先</span>
              <select
                value={genderPriority}
                onChange={(event) => {
                  setGenderPriority(event.target.value)
                  setShowMoreCount(1)
                }}
              >
                <option value={GENDER_MALE}>优先雄性</option>
                <option value={GENDER_FEMALE}>优先雌性</option>
                <option value={GENDER_IGNORE}>不考虑性别</option>
              </select>
            </label>
          )}

          <label className={styles.controlField}>
            <span>推荐优先级</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value={PRIORITY_OVERALL}>综合最优</option>
              <option value={PRIORITY_CHEAPEST}>最低成本</option>
              <option value={PRIORITY_FASTEST}>最快捕捉</option>
              <option value={PRIORITY_HIGHEST}>最高捕获率</option>
            </select>
          </label>
        </div>

        {mode === MODE_SPECIFIC && (
          <p className={styles.controlGridNote}>
            留空“捕捉地点”将自动选择最适合该宝可梦的地点。
          </p>
        )}

        {mode === MODE_ROUTE && (
          <p className={styles.controlGridNote}>
            请从建议列表中选择一个地点以载入计算结果。
          </p>
        )}

        <div className={styles.toggleGrid}>
          <label><input type="checkbox" checked={ironmanMode} onChange={(e) => setIronmanMode(e.target.checked)} /> 铁人模式（成本优先，禁用柑果球）</label>
          <label><input type="checkbox" checked={effectiveForceNight} onChange={(e) => handleForceDuskToggle(e.target.checked)} /> 强制启用黑暗球夜晚加成</label>
          <details className={styles.apricornDropdown}>
            <summary className={styles.apricornDropdownSummary}>
              柑果球
              <span className={styles.apricornDropdownCount}>
                已启用 {apricornEnabled.size}/{APRICORN_BALL_IDS.length}
              </span>
            </summary>
            <div className={styles.apricornDropdownPanel}>
              <div className={styles.apricornDropdownHeader}>
                <p className={styles.apricornDropdownHint}>
                  选择允许计算器纳入比较的柑果球。
                </p>
                <div className={styles.apricornButtonRow}>
                  <button type="button" onClick={enableAllApricornBalls} disabled={ironmanMode} className={styles.apricornActionButton}>
                    全部启用
                  </button>
                  <button type="button" onClick={disableAllApricornBalls} disabled={ironmanMode} className={styles.apricornActionButton}>
                    全部禁用
                  </button>
                </div>
              </div>
              <div className={styles.apricornBallList}>
                {APRICORN_BALL_IDS.map((ballId) => {
                  const ballMeta = BALLS.find((ball) => ball.id === ballId)
                  const checked = apricornEnabled.has(ballId)
                  return (
                    <label key={ballId} className={styles.apricornBallItem}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={ironmanMode}
                        onChange={(e) => {
                          const next = new Set(apricornEnabled)
                          if (e.target.checked) next.add(ballId)
                          else next.delete(ballId)
                          setApricornEnabled(next)
                        }}
                      />
                      <span>启用 {translateBallName(ballMeta?.name)}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </details>
        </div>

        <p className={styles.helperText}>
          当前游戏内时段：<strong>{formatPeriod(period)}</strong>。先机球仅在首回合捕获率达到 90% 以上时纳入推荐；计时球只会作为最后选择。夜晚会自动启用黑暗球加成，取消勾选则按白天计算。
        </p>
      </section>

      {mode === MODE_ROUTE && selectedRouteEntry && (
        <section className={styles.resultsSection}>
          <h2>{formatRouteLabel(selectedRouteEntry)}</h2>
          <p className={styles.routeMeta}>推荐会综合单次成功捕捉的预期成本、预期耗时与捕获率。</p>

          {activeRouteBreakdown && (
            <article className={styles.breakdownOverlay}>
              <div className={styles.breakdownOverlayHeader}>
                <h3>{formatPokemonDisplayName(activeRouteBreakdown.pokemonName)}：精灵球明细</h3>
                <button type="button" className={styles.closeBreakdownButton} onClick={() => setActiveBreakdownKey('')}>关闭</button>
              </div>
              <p className={styles.routeMeta}>
                捕获公式：捕获率 = (min(255, floor(((300 - 2 × HP%) / 300) × 球种倍率 × 捕获度 × 状态倍率)) / 255) × 100
              </p>
              <p className={styles.routeMeta}>
                每种球都会测试四种条件（满 HP、1% HP、满 HP＋睡眠、1% HP＋睡眠），并采用其中最佳结果进行推荐。{formatPokemonDisplayName(activeRouteBreakdown.pokemonName)}的捕获度为 {activeRouteBreakdown.catchRate}。
              </p>

              <div className={styles.largeTableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>精灵球</th>
                      <th>倍率</th>
                      <th>捕获值</th>
                      <th>捕获率</th>
                      <th>HP（%）</th>
                      <th>状态</th>
                      <th>预期投球数</th>
                      <th>预期回合</th>
                      <th>单价</th>
                      <th>预期成本</th>
                      <th>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRouteBreakdown.analysis.map((entry) => (
                      <tr key={`overlay-${activeRouteBreakdown.pokemonName}-${entry.ballId}`} className={!entry.available ? styles.unavailableRow : ''}>
                        <td>{translateBallName(entry.ball)}</td>
                        <td>×{entry.multiplier.toFixed(1)}</td>
                        <td>{entry.catchValue}</td>
                        <td>{formatPercent(entry.chance)}</td>
                        <td>{entry.hpPercent}</td>
                        <td>×{entry.statusMod.toFixed(1)}</td>
                        <td>{formatTurns(entry.expectedThrows)}</td>
                        <td>{formatTurns(entry.expectedTurnsToSuccess)}</td>
                        <td>{entry.price == null ? '不适用' : formatMoney(entry.price)}</td>
                        <td>{formatMoney(entry.expectedCost)}</td>
                        <td>{entry.available ? entry.availabilityNote : `不可用：${entry.availabilityNote}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          <div className={styles.pokemonGrid}>
            {routeRecommendations.map((result) => (
              <article key={`${selectedRouteEntry.id}-${result.pokemonName}`} className={styles.pokemonCard}>
                <Link to={`/pokemon/${normalizePokemonName(result.pokemonName)}/`} className={styles.pokemonHeader}>
                  <img
                    src={getLocalPokemonGif(result.pokemonName)}
                    alt={formatPokemonDisplayName(result.pokemonName)}
                    onError={onGifError(result.pokemonName, false)}
                    loading="lazy"
                  />
                  <div>
                    <h3>{formatPokemonDisplayName(result.pokemonName)}</h3>
                    <p>估算等级：{result.level}</p>
                    <p>捕获度：{result.catchRate}</p>
                  </div>
                </Link>

                {result.selected ? (
                  <>
                    <section className={styles.featuredRecommendation}>
                      <div className={styles.featuredRecommendationHeader}>
                    <strong className={styles.featuredRecommendationTitle}>
                    <span className={styles.featuredRecommendationPriority}>
                      {selectedPriorityLabel}：
                    </span>
                    <span className={styles.featuredRecommendationMethod}>
                      {result.selected.methodLabel}
                    </span>
                  </strong>
                       <strong className={styles.featuredRecommendationChoice}>
                          <div>{translateBallName(result.selected.ball)}</div>
                          <span>{formatPercent(result.selected.chance)}</span>
                        </strong>
                      </div>
                      {result.isGhost && (
                        <div className={styles.soakNote}>
                          ⚠️ 使用<strong>点到为止</strong>前，需要先使用<strong>浸水</strong>。
                        </div>
                      )}
                      <div className={styles.featuredRecommendationStats}>
                        <div>
                          <span>预期成本</span>
                          <strong>{formatMoney(result.selected.expectedCost)}</strong>
                        </div>
                        <div>
                          <span>预期回合</span>
                          <strong>{formatExpectedTurns(result.selected.expectedTurnsToSuccess)}</strong>
                        </div>
                      </div>
                    </section>
                    {buildComparisonRows(result, priority).map((entry) => (
                      <div key={`${result.pokemonName}-${entry.key}`} className={styles.recommendationLine}>
                        <span>{entry.label}</span>
                        <strong>{entry.value}</strong>
                      </div>
                    ))}
                    <p className={styles.explanation}>{result.explanation}</p>
                    {result.longTerm && (
                      <p className={styles.longTerm}>
                        长期方案：{translateBallName(result.longTerm.ball)}
                        {result.repeatThreshold ? `（连续捕捉同种宝可梦 ${result.repeatThreshold} 次后成为性价比最优）。` : '。'}
                      </p>
                    )}
                    <button
                      type="button"
                      className={styles.showBreakdownButton}
                      onClick={() => setActiveBreakdownKey(`${selectedRouteEntry.id}|${result.pokemonName}`)}
                    >
                      查看完整精灵球明细
                    </button>
                  </>
                ) : (
                  <p className={styles.explanation}>当前筛选条件下无法计算出捕捉方案。</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {mode === MODE_ROUTE && !selectedRouteEntry && (
        <section className={styles.resultsSection}>
          <h2>地点搜索</h2>
          <p className={styles.routeMeta}>输入地点并点击建议项，即可查看推荐。当前遭遇方式：{({ [METHOD_NORMAL]: '普通遭遇', [METHOD_FISHING]: '垂钓', [METHOD_SURFING]: '冲浪' })[routeEncounterMethod]}。</p>
        </section>
      )}

      {(mode === MODE_POKEMON || mode === MODE_EGG) && (
        <section className={styles.resultsSection}>
          <h2>{mode === MODE_POKEMON ? '最佳地点' : '蛋组地点排行'}</h2>

          {activeRankedRouteBreakdown && (
            <article className={styles.breakdownOverlay}>
              <div className={styles.breakdownOverlayHeader}>
                <h3>{formatPokemonDisplayName(activeRankedRouteBreakdown.pokemonName)}：精灵球明细</h3>
                <button type="button" className={styles.closeBreakdownButton} onClick={() => setActiveBreakdownKey('')}>关闭</button>
              </div>
              <p className={styles.routeMeta}>
                地点：{formatRouteLabel(activeRankedRouteBreakdown.routeEntry)}
              </p>
              <p className={styles.routeMeta}>
                捕获公式：捕获率 = (min(255, floor(((300 - 2 × HP%) / 300) × 球种倍率 × 捕获度 × 状态倍率)) / 255) × 100
              </p>
              <p className={styles.routeMeta}>
                每种球都会测试四种条件（满 HP、1% HP、满 HP＋睡眠、1% HP＋睡眠），并采用其中最佳结果进行推荐。{formatPokemonDisplayName(activeRankedRouteBreakdown.pokemonName)}的捕获度为 {activeRankedRouteBreakdown.catchRate}。
              </p>

              <div className={styles.largeTableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>精灵球</th>
                      <th>倍率</th>
                      <th>捕获值</th>
                      <th>捕获率</th>
                      <th>HP（%）</th>
                      <th>状态</th>
                      <th>预期投球数</th>
                      <th>预期回合</th>
                      <th>单价</th>
                      <th>预期成本</th>
                      <th>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRankedRouteBreakdown.analysis.map((entry) => (
                      <tr key={`overlay-${activeRankedRouteBreakdown.routeEntry.id}-${activeRankedRouteBreakdown.pokemonName}-${entry.ballId}`} className={!entry.available ? styles.unavailableRow : ''}>
                        <td>{translateBallName(entry.ball)}</td>
                        <td>×{entry.multiplier.toFixed(1)}</td>
                        <td>{entry.catchValue}</td>
                        <td>{formatPercent(entry.chance)}</td>
                        <td>{entry.hpPercent}</td>
                        <td>×{entry.statusMod.toFixed(1)}</td>
                        <td>{formatTurns(entry.expectedThrows)}</td>
                        <td>{formatTurns(entry.expectedTurnsToSuccess)}</td>
                        <td>{entry.price == null ? '不适用' : formatMoney(entry.price)}</td>
                        <td>{formatMoney(entry.expectedCost)}</td>
                        <td>{entry.available ? entry.availabilityNote : `不可用：${entry.availabilityNote}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {rankedRoutes.length === 0 ? (
            <p className={styles.routeMeta}>当前搜索条件下未找到地点。</p>
          ) : (
            <div className={styles.routeRankList}>
              {visibleRankedRoutes.map((entry, index) => {
                const topRec = entry.recommendations[0]
                const starLabel = toStarLabel(entry.score)
                const breakdown = entry.scoreBreakdown || getRouteScoreBreakdown(entry.summary)
                return (
                  <article key={entry.routeEntry.id} className={styles.routeRankCard}>
                    <div className={styles.routeRankHeader}>
                      <h3>{index + 1}. {formatRouteLabel(entry.routeEntry)}</h3>
                      <div className={styles.routeScoreTooltip}>
                        <span className={styles.routeRankStars} tabIndex={0} aria-label={`地点评分 ${starLabel}。悬停查看评分细节。`}>
                          {starLabel}
                        </span>
                        <div className={styles.routeScoreTooltipPanel} role="tooltip">
                          <p><strong>地点评分：</strong>{entry.score.toFixed(1)}/100（{starLabel}）</p>
                          <p>
                            <strong>公式：</strong>{' '}
                            {breakdown.encounterIncluded
                              ? '34% 成本 + 28% 捕获率 + 20% 回合 + 18% 遭遇率（引虫香水固定为 4%）。'
                              : '仅计入成本、捕获率与回合数（非引虫香水不计遭遇率）。'}
                          </p>
                          <p>成本：{breakdown.costScore.toFixed(1)} × 34% = {breakdown.costContribution.toFixed(1)}</p>
                          <p>捕获率：{breakdown.chanceScore.toFixed(1)} × 28% = {breakdown.chanceContribution.toFixed(1)}</p>
                          <p>回合：{breakdown.turnsScore.toFixed(1)} × 20% = {breakdown.turnsContribution.toFixed(1)}</p>
                          {breakdown.encounterIncluded && (
                            <p>遭遇率（引虫香水固定为 4%）：{breakdown.encounterScore.toFixed(1)} × 18% = {breakdown.encounterContribution.toFixed(1)}</p>
                          )}
                          {breakdown.genderMultiplier > 1 && (
                            <p>蛋组性别加成：基础评分 ×{breakdown.genderMultiplier.toFixed(2)}。</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.routeSummaryGrid}>
                      <p>综合效率：<strong>{entry.score.toFixed(1)}/100</strong></p>
                      <p>预期成本：<strong>{formatMoney(entry.summary?.avgCost || 0)}</strong></p>
                      <p>平均回合：<strong>{formatTurns(entry.summary?.avgTurns || 0)}</strong></p>
                      <p>平均捕获率：<strong>{formatPercent(entry.summary?.avgChance || 0)}</strong></p>
                    </div>

                    {topRec?.selected && (
                      <p className={styles.routeMeta}>
                        方案示例：{formatPokemonDisplayName(topRec.pokemonName)}使用 {translateBallName(topRec.selected.ball)}（{formatPercent(topRec.selected.chance)}）。
                      </p>
                    )}

                    <details className={styles.breakdown}>
                      <summary>查看此地点已分析的宝可梦</summary>
                      <ul className={styles.inlineList}>
                        {entry.recommendations.map((result) => (
                          <li key={`${entry.routeEntry.id}-${result.pokemonName}`}>
                            {formatPokemonDisplayName(result.pokemonName)}：{translateBallName(result.selected?.ball || '无推荐')} · {formatMoney(result.selected?.expectedCost || 0)} · {formatExpectedTurns(result.selected?.expectedTurnsToSuccess || 0)} 回合
                            {result.analysis?.length > 0 && (
                              <button
                                type="button"
                                className={styles.showBreakdownButton}
                                onClick={() => setActiveBreakdownKey(`${entry.routeEntry.id}|${result.pokemonName}`)}
                              >
                                查看完整精灵球明细
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </article>
                )
              })}

              {showMoreCount < rankedRoutes.length && (
                <button type="button" className={styles.showMoreButton} onClick={() => setShowMoreCount((count) => count + 5)}>
                  显示更多地点
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {mode === MODE_SPECIFIC && (
        <section className={styles.resultsSection}>
          <h2>指定宝可梦</h2>
          <p className={styles.routeMeta}>选择宝可梦、可选地点、等级与头目状态，直接计算推荐方案。头目模式会将捕获度固定为 10。</p>

          {customPokemonResult?.selected ? (
            <article className={styles.pokemonCard}>
              <div className={styles.pokemonHeader}>
                <img
                  src={getLocalPokemonGif(customPokemonResult.pokemonName)}
                  alt={formatPokemonDisplayName(customPokemonResult.pokemonName)}
                  onError={onGifError(customPokemonResult.pokemonName, false)}
                  loading="lazy"
                />
                <div>
                  <h3>{formatPokemonDisplayName(customPokemonResult.pokemonName)}</h3>
                  <p>地点：{customPokemonRouteEntry ? formatRouteLabel(customPokemonRouteEntry) : '不适用'}</p>
                  {customPokemonSelection?.routeWasAutoSelected && (
                    <p>未指定地点，已自动选择最匹配的地点。</p>
                  )}
                  <p>{selectedPriorityLabel}：{translateBallName(customPokemonResult.selected.ball)}（{formatPercent(customPokemonResult.selected.chance)}）</p>
                  <p>捕获率：{formatPercent(customPokemonResult.selected.chance)}</p>
                  <p>捕获度：{customPokemonResult.catchRate}</p>
                </div>
              </div>

              <section className={styles.featuredRecommendation}>
                <div className={styles.featuredRecommendationHeader}>
                  <span className={styles.featuredRecommendationLabel}>{selectedPriorityLabel}：</span>
                  <strong className={styles.featuredRecommendationChoice}>{translateBallName(customPokemonResult.selected.ball)} <span>{formatPercent(customPokemonResult.selected.chance)}</span></strong>
                </div>
                <div className={styles.featuredRecommendationStats}>
                  <div>
                    <span>预期成本</span>
                    <strong>{formatMoney(customPokemonResult.selected.expectedCost)}</strong>
                  </div>
                  <div>
                    <span>预期回合</span>
                    <strong>{formatExpectedTurns(customPokemonResult.selected.expectedTurnsToSuccess)}</strong>
                  </div>
                </div>
              </section>
              {buildComparisonRows(customPokemonResult, priority).map((entry) => (
                <div key={`specific-${entry.key}`} className={styles.recommendationLine}>
                  <span>{entry.label}</span>
                  <strong>{entry.value}</strong>
                </div>
              ))}

              <details className={styles.breakdown}>
                <summary>查看精灵球明细</summary>
                <p className={styles.routeMeta}>
                  捕获公式：捕获率 = (min(255, floor(((300 - 2 × HP%) / 300) × 球种倍率 × 捕获度 × 状态倍率)) / 255) × 100
                </p>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>精灵球</th>
                        <th>倍率</th>
                        <th>捕获值</th>
                        <th>捕获率</th>
                        <th>回合</th>
                        <th>单价</th>
                        <th>预期成本</th>
                        <th>公式参数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customPokemonResult.analysis.map((entry) => (
                        <tr key={`custom-${customPokemonResult.pokemonName}-${entry.ballId}`} className={!entry.available ? styles.unavailableRow : ''}>
                          <td>{translateBallName(entry.ball)}</td>
                          <td>×{entry.multiplier.toFixed(1)}</td>
                          <td>{entry.catchValue}</td>
                          <td>{formatPercent(entry.chance)}</td>
                          <td>{formatTurns(entry.turns)}</td>
                          <td>{entry.price == null ? '不适用' : formatMoney(entry.price)}</td>
                          <td>{formatMoney(entry.expectedCost)}</td>
                          <td>{entry.available ? `HP%：${entry.hpPercent}｜捕获度：${entry.catchRate}｜状态倍率：${entry.statusMod}` : `不可用：${entry.availabilityNote}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </article>
          ) : (
            <p className={styles.routeMeta}>请选择有效的宝可梦以进行指定分析；地点为可选项。</p>
          )}
        </section>
      )}

      {mode === MODE_CATCH_EVENTS && (
        <section className={styles.resultsSection}>
          <h2>捕捉活动</h2>
          <p className={styles.routeMeta}>
            从官方活动日历选择 PvE 捕捉活动。这里只列出进行中或即将开始的活动，合格条目直接读取自活动表格。
          </p>

          {isOfficialEventsLoading && (
            <p className={styles.routeMeta}>正在载入官方活动日历中的捕捉活动…</p>
          )}

          {!isOfficialEventsLoading && officialCatchEvents.length === 0 && (
            <p className={styles.routeMeta}>官方活动日历目前没有可用的 PvE 捕捉活动。</p>
          )}

          {officialCatchEvents.length > 0 && (
            <div className={styles.catchEventList}>
              {officialCatchEvents.map((event) => {
                const isEnabled = enabledCatchEventLink === event.id
                return (
                  <article
                    key={event.id}
                    className={`${styles.catchEventCard} ${isEnabled ? styles.catchEventCardActive : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEnabledCatchEventLink(event.id)}
                    onKeyDown={(eventKey) => {
                      if (eventKey.key === 'Enter' || eventKey.key === ' ') {
                        eventKey.preventDefault()
                        setEnabledCatchEventLink(event.id)
                      }
                    }}
                  >
                    <div>
                      <h3>{event.title}</h3>
                      <p>{event.localStartLabel}</p>
                      {event.link && (
                        <a href={event.link} target="_blank" rel="noopener noreferrer" className={styles.catchEventLink}>
                          查看论坛活动
                        </a>
                      )}
                    </div>
                    <p className={styles.routeMeta}>{isEnabled ? '已选择' : '点击选择活动'}</p>
                  </article>
                )
              })}
            </div>
          )}

          {enabledOfficialCatchEvent && (
            <article className={styles.catchEventResultsCard}>
              <h3>{enabledOfficialCatchEvent.title}</h3>
              <p className={styles.routeMeta}>地点：{translateLocationName(enabledOfficialCatchEvent.location || '未知')}</p>

              {catchEventRecommendations.length === 0 ? (
                <p className={styles.routeMeta}>该活动表格中未找到合格条目。</p>
              ) : (
                <div className={styles.catchEventTableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>图像</th>
                        <th>宝可梦</th>
                        <th>加分</th>
                        <th>推荐球种</th>
                        <th>最高捕获率</th>
                        <th>回合</th>
                        <th>条件</th>
                        <th>预期成本</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catchEventRecommendations.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <img
                              src={getLocalPokemonGif(entry.canonicalName || entry.pokemonName)}
                              alt={formatPokemonDisplayName(entry.pokemonName)}
                              onError={onGifError(entry.canonicalName || entry.pokemonName, false)}
                              loading="lazy"
                              className={styles.catchEventPokemonGif}
                            />
                          </td>
                          <td>{formatPokemonDisplayName(entry.pokemonName)}</td>
                              <td className={entry.bonus > 0 ? styles.positiveBonus : ''}>{entry.bonus}</td>
                          <td>{entry.result?.selected ? translateBallName(entry.result.selected.ball) : '不可用'}</td>
                          <td>{entry.result?.selected ? formatPercent(entry.result.selected.chance) : '不适用'}</td>
                          <td>{entry.result?.selected ? formatTurnSummary(entry.result.selected.turns) : '不适用'}</td>
                          <td>{entry.result?.selected?.methodLabel || '不适用'}</td>
                          <td>{entry.result?.selected ? formatMoney(entry.result.selected.expectedCost) : '不适用'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          )}
        </section>
      )}
    </div>
  )
}
