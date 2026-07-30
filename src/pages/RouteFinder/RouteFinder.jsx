import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { API } from '../../api/endpoints'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import { useEncounterPercents } from '../../hooks/useEncounterPercents'
import { getAssetUrl } from '../../utils/assets'
import { getLocalPokemonGif, normalizePokemonName, onGifError, translatePokemonName } from '../../utils/pokemon'
import { translateEncounterTerm, translateLocationName, translateRegionName } from '../../utils/pokemonTermsZh'
import generationData from '../../data/generation.json'
import pokemonData from '../../data/pokemmo_data/pokemon-data.json'
import { allRegions as regionMapData } from '../../data/region_maps'
import styles from './RouteFinder.module.css'

const TARGET_TIERS = new Set([0, 1, 2, 3])
const BEST_ROUTE_TIERS = new Set([0, 1, 2])
const MIN_CATEGORY_TRACKED_ENCOUNTERS = 1000
const REGION_ORDER = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova']
const FISHING_METHODS = new Set(['fishing', 'old rod', 'good rod', 'super rod'])
const SINGLE_METHODS = new Set(['grass', 'water', 'cave', 'dark grass', 'inside', 'shadow', 'dust cloud'])
const STANDARD_SPAWN_RARITIES = new Set(['very common', 'common', 'uncommon', 'rare', 'very rare', 'lure'])
const ENCOUNTER_CATEGORY_MAP = {
  single: 'singles',
  surfing: 'surfing',
  fish: 'fishing',
  horde: 'horde',
  'surfing-horde': 'surfingHorde',
  headbutt: 'headbutt',
  'rock-smash': 'rockSmash',
  'repel-trick': 'repelTrick',
}
const UNROUTED_CATEGORIES = [
  { key: 'singles', label: '单只遭遇' },
  { key: 'surfing', label: '冲浪' },
  { key: 'fishing', label: '垂钓' },
  { key: 'horde', label: '群聚' },
  { key: 'headbutt', label: '头锤树' },
  { key: 'rockSmash', label: '碎岩' },
]
const UNROUTED_CATEGORY_OPTIONS = [
  { value: 'all', label: '全部类别' },
  ...UNROUTED_CATEGORIES.map(category => ({ value: category.key, label: category.label })),
]
const INFO_DROPDOWN_CLOSED_KEY = 'routeFinderInfoClosed'
const SUBMISSION_COOLDOWN_MS = 10 * 60 * 1000
const SUBMISSION_COOLDOWN_KEY = 'routeFinderSubmitCooldownUntil'
const MAX_SCREENSHOT_FILES = 3
const MAX_TOTAL_SCREENSHOT_BYTES = 5 * 1024 * 1024
const MAX_TOTAL_SCREENSHOT_MB = 5
const SHORT_WINDOW_SUBMISSION_LIMIT = 1
const SHORT_WINDOW_SUBMISSION_MINUTES = 10
const DAILY_SUBMISSION_LIMIT = 5
const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script'
const TURNSTILE_CONTAINER_ID = 'route-finder-turnstile'
const TURNSTILE_ACTION = 'route_finder_submit'
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAADBIYe2ydf-7nLPt'

function getRegionOrder(region) {
  const index = REGION_ORDER.indexOf(region)
  return index === -1 ? REGION_ORDER.length : index
}

function normalizeSearch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
}

function getRouteMapKey(region, routeName) {
  return `${normalizeSearch(region)}|${normalizeSearch(routeName)}`
}

function normalizePokemonKey(value) {
  return normalizeSearch(value)
    .replace(/[♀]/g, 'f')
    .replace(/[♂]/g, 'm')
    .replace(/\s+/g, '-')
}

function resolvePokemonSearch(value) {
  const normalized = normalizePokemonKey(value)
  if (!normalized) return ''
  const match = Object.values(pokemonData).find((pokemon) => (
    normalizePokemonKey(pokemon.name) === normalized
    || normalizePokemonKey(translatePokemonName(pokemon.name)) === normalized
  ))
  return normalizePokemonKey(match?.name || value)
}

function formatPercent(encounters, total) {
  if (!total) return '0%'
  const percent = (encounters / total) * 100
  return `${percent.toFixed(percent >= 10 ? 1 : 2)}%`
}

function formatPercentValue(percent) {
  return `${percent.toFixed(percent >= 10 ? 1 : 2)}%`
}

function getTier(pokemon) {
  const key = normalizePokemonKey(pokemon)
  const data = pokemonData[key]
  return Number.isInteger(data?.shiny_tier) ? data.shiny_tier : null
}

function formatEncounterTimeLabel(time) {
  return String(time || '')
    .replace(/SEASON0/g, '夏季')
    .replace(/SEASON1/g, '春季')
    .replace(/SEASON2/g, '秋季')
    .replace(/SEASON3/g, '冬季')
}

function collapseSeasonalTimes(times = []) {
  const originalsByBase = new Map()
  const others = []

  times.forEach((time) => {
    const t = String(time || '')
    const match = t.match(/^(.*)\/SEASON([0-3])$/)
    if (match) {
      const base = match[1]
      const season = match[2]
      const entry = originalsByBase.get(base) || { seasons: new Set(), originals: [] }
      entry.seasons.add(season)
      entry.originals.push(t)
      originalsByBase.set(base, entry)
    } else if (t) {
      others.push(t)
    }
  })

  const result = [...others]
  originalsByBase.forEach((entry, base) => {
    if (entry.seasons.size === 4) {
      result.push(base)
    } else {
      // keep original entries (so they will get season names later)
      result.push(...entry.originals)
    }
  })

  // unique and preserve order
  return [...new Set(result)]
}

function hasRareTierPokemon(pokemon = []) {
  return pokemon.some(mon => BEST_ROUTE_TIERS.has(getTier(mon.name)))
}

function hasTrackableTierPokemon(pokemon = []) {
  return pokemon.some(mon => {
    const tier = getTier(mon.name)
    return Number.isInteger(tier) && tier >= 0 && tier <= 4
  })
}

function isPriorityTarget(mon) {
  return BEST_ROUTE_TIERS.has(getTier(mon.name))
}

function pokemonMatchesSearch(mon, pokemonNeedle, pokemonFamilyKeys = new Set()) {
  if (!pokemonNeedle) return true
  const monKey = normalizePokemonKey(mon.name)
  return monKey.includes(pokemonNeedle) || pokemonFamilyKeys.has(monKey)
}

function getRouteTargetPercent(route, pokemonNeedle) {
  if (!pokemonNeedle) return 0
  return route.pokemon.reduce((highest, mon) => {
    if (!normalizePokemonKey(mon.name).includes(pokemonNeedle)) return highest
    return Math.max(highest, mon.percent)
  }, 0)
}

function getRouteBestPercentTotal(route) {
  return route.pokemon.reduce((total, mon) => (
    BEST_ROUTE_TIERS.has(mon.tier) ? total + mon.percent : total
  ), 0)
}

function hasBestRouteTierPokemon(route) {
  return route.pokemon.some(mon => BEST_ROUTE_TIERS.has(mon.tier))
}

function getVariationEntries(routeData) {
  if (Array.isArray(routeData)) return routeData

  if (Array.isArray(routeData?.variations)) {
    return routeData.variations
  }

  if (routeData?.variations && typeof routeData.variations === 'object') {
    return Object.entries(routeData.variations).map(([variation, data]) => ({
      ...data,
      variation: data?.variation || variation,
    }))
  }

  return [routeData]
}

function getDisplayName(routeName, variationData) {
  const baseRouteName = String(variationData?.route || routeName || '').trim()
  const variation = String(variationData?.variation || '').trim()

  if (!variation) return baseRouteName

  const variationSuffix = ` - ${variation}`
  if (baseRouteName.endsWith(variationSuffix)) return baseRouteName

  return `${baseRouteName}${variationSuffix}`
}

function buildEvolutionFamilyLookup() {
  const lookup = new Map()

  Object.values(generationData).forEach((generationFamilies) => {
    generationFamilies.forEach((family) => {
      const normalizedFamily = family.map(member => normalizePokemonKey(member))
      normalizedFamily.forEach((member) => {
        lookup.set(member, normalizedFamily)
      })
    })
  })

  return lookup
}

function sortRoutesByRegionThenName(a, b) {
  const regionDiff = getRegionOrder(a.region) - getRegionOrder(b.region)
  if (regionDiff !== 0) return regionDiff
  return a.displayName.localeCompare(b.displayName)
}

function getInitialCooldownRemaining() {
  if (typeof window === 'undefined') return 0

  const storedValue = Number(window.localStorage.getItem(SUBMISSION_COOLDOWN_KEY) || 0)
  if (!storedValue) return 0

  return Math.max(0, storedValue - Date.now())
}

function getInitialInfoDropdownOpen() {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(INFO_DROPDOWN_CLOSED_KEY) !== 'true'
}

function formatCooldown(msRemaining) {
  const totalSeconds = Math.ceil(msRemaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function getTotalFileBytes(files) {
  return files.reduce((total, file) => total + (file?.size || 0), 0)
}

function mergeScreenshotFiles(existingFiles, nextFiles) {
  const seen = new Set()

  return [...existingFiles, ...nextFiles].filter((file) => {
    const key = `${file.name}-${file.lastModified}-${file.size}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function flattenRoutes(encounterPercents = {}) {
  return Object.entries(encounterPercents || {}).flatMap(([region, routes]) =>
    Object.entries(routes || {}).flatMap(([routeName, routeData]) => getVariationEntries(routeData).map((variationData, variationIndex) => {
      const variation = String(variationData?.variation || '').trim()
      const baseRouteName = String(variationData?.route || routeName || '').trim()
      const displayName = getDisplayName(routeName, variationData)
      const total = Number(variationData?.total) || 0
      const pokemon = (variationData?.data || [])
        .map(entry => {
          const encounters = Number(entry.encounters) || 0
          const tier = getTier(entry.pokemon)
          return {
            name: entry.pokemon,
            encounters,
            percent: total ? (encounters / total) * 100 : 0,
            percentLabel: formatPercent(encounters, total),
            tier,
          }
        })
        .sort((a, b) => b.encounters - a.encounters)
      const rarePercent = pokemon.reduce((totalRarePercent, mon) => (
        BEST_ROUTE_TIERS.has(mon.tier) ? totalRarePercent + mon.percent : totalRarePercent
      ), 0)

      return {
        id: `${region}-${routeName}-${variation || variationIndex}`,
        region,
        routeName: baseRouteName,
        displayName,
        variation,
        encounterCategory: variationData?.encounterCategory || '',
        credit: variationData?.credit || '',
        total,
        rarePercent,
        rarePercentLabel: formatPercentValue(rarePercent),
        pokemon,
        routeSearch: normalizeSearch(`${region} ${routeName} ${displayName} ${variation}`),
      }
    }))
  )
}

function getAreaRouteCandidates(area) {
  return [
    area?.encounterMatch?.normalizedLocation,
    area?.sourceLocation,
    area?.name,
  ].filter(Boolean)
}

function getSpawnFields(spawn) {
  const encounters = Array.isArray(spawn?.encounters) ? spawn.encounters : []
  const methods = new Set([
    ...(Array.isArray(spawn?.methods) ? spawn.methods : []),
    ...encounters.map(encounter => encounter.method),
  ].filter(Boolean).map(value => normalizeSearch(value)))
  const rarities = new Set([
    ...(Array.isArray(spawn?.rarities) ? spawn.rarities : []),
    ...encounters.map(encounter => encounter.rarity),
    spawn?.rarity,
  ].filter(Boolean).map(value => normalizeSearch(value)))

  return { encounters, methods, rarities }
}

function getSpawnCategoryKeys(spawn) {
  const categories = new Set()
  const { encounters, methods, rarities } = getSpawnFields(spawn)
  const encounterRows = encounters.length > 0
    ? encounters
    : [...methods].flatMap(method => [...rarities].map(rarity => ({ method, rarity })))

  encounterRows.forEach((encounter) => {
    const method = normalizeSearch(encounter.method)
    const rarity = normalizeSearch(encounter.rarity || spawn?.rarity)

    if (rarity === 'horde') {
      categories.add(method === 'water' ? 'surfingHorde' : 'horde')
    }
    if (FISHING_METHODS.has(method)) categories.add('fishing')
    if (method === 'headbutt') categories.add('headbutt')
    if (method === 'rocks' || method === 'rock smash') categories.add('rockSmash')
    if (method === 'water' && STANDARD_SPAWN_RARITIES.has(rarity)) categories.add('surfing')
    if (method !== 'water' && SINGLE_METHODS.has(method) && STANDARD_SPAWN_RARITIES.has(rarity)) categories.add('singles')
  })

  return [...categories]
}

function formatSpawnMeta(spawn, categoryKey) {
  const { encounters } = getSpawnFields(spawn)
  const relevantEncounters = encounters.filter((encounter) => {
    const method = normalizeSearch(encounter.method)
    const rarity = normalizeSearch(encounter.rarity)

    if (categoryKey === 'horde') return rarity === 'horde' && method !== 'water'
    if (categoryKey === 'surfingHorde') return rarity === 'horde' && method === 'water'
    if (categoryKey === 'fishing') return FISHING_METHODS.has(method)
    if (categoryKey === 'headbutt') return method === 'headbutt'
    if (categoryKey === 'rockSmash') return method === 'rocks' || method === 'rock smash'
    if (categoryKey === 'surfing') return method === 'water' && STANDARD_SPAWN_RARITIES.has(rarity)
    if (categoryKey === 'singles') {
      return SINGLE_METHODS.has(method) && method !== 'water' && STANDARD_SPAWN_RARITIES.has(rarity)
    }

    return false
  })
  const sourceEncounters = relevantEncounters.length > 0 ? relevantEncounters : encounters
  const methods = [...new Set(sourceEncounters.map(encounter => encounter.method).filter(Boolean))]
  const rarities = [...new Set(sourceEncounters.map(encounter => encounter.rarity).filter(Boolean))]
  const times = [...new Set(sourceEncounters.map(encounter => encounter.time).filter(Boolean).filter(time => time !== 'ALL'))]
  const levels = sourceEncounters
    .filter(encounter => Number.isFinite(encounter.minLevel) && Number.isFinite(encounter.maxLevel))
    .map(encounter => encounter.minLevel === encounter.maxLevel
      ? `${encounter.minLevel}`
      : `${encounter.minLevel}-${encounter.maxLevel}`)

  return {
    methods,
    rarities,
    times,
    levels: [...new Set(levels)],
  }
}

function mergeSpawnMeta(existingMeta, nextMeta) {
  return {
    methods: [...new Set([...(existingMeta?.methods || []), ...nextMeta.methods])],
    rarities: [...new Set([...(existingMeta?.rarities || []), ...nextMeta.rarities])],
    times: [...new Set([...(existingMeta?.times || []), ...nextMeta.times])],
    levels: [...new Set([...(existingMeta?.levels || []), ...nextMeta.levels])],
  }
}

function addRouteSpawn(route, spawn) {
  getSpawnCategoryKeys(spawn).forEach((categoryKey) => {
    route.expectedCategories.add(categoryKey)

    if (!route.pokemonByCategory.has(categoryKey)) {
      route.pokemonByCategory.set(categoryKey, new Map())
    }

    const categoryPokemon = route.pokemonByCategory.get(categoryKey)
    const existingPokemon = categoryPokemon.get(spawn.name)
    const nextMeta = formatSpawnMeta(spawn, categoryKey)
    categoryPokemon.set(spawn.name, {
      name: spawn.name,
      meta: mergeSpawnMeta(existingPokemon?.meta, nextMeta),
    })
  })
}

function buildExpectedRouteCoverage() {
  const routeLookup = new Map()

  regionMapData.forEach((region) => {
    ;(region.maps || []).forEach((map) => {
      ;(map.areas || []).forEach((area) => {
        if (!Array.isArray(area.spawns) || area.spawns.length === 0) return

        const candidates = getAreaRouteCandidates(area)
        if (candidates.length === 0) return

        const primaryRouteName = candidates[0]
        const key = getRouteMapKey(region.name, primaryRouteName)
        const route = routeLookup.get(key) || {
          id: `${region.id || region.name}-${normalizeSearch(primaryRouteName)}`,
          region: region.name,
          routeName: area.name || primaryRouteName,
          displayName: area.name || primaryRouteName,
          routeSearch: normalizeSearch(`${region.name} ${area.name || ''} ${candidates.join(' ')}`),
          mapNames: new Set(),
          kinds: new Set(),
          expectedCategories: new Set(),
          pokemonByCategory: new Map(),
          candidateKeys: new Set(),
        }

        route.routeName = area.name || route.routeName
        route.displayName = route.routeName
        route.mapNames.add(map.name)
        route.kinds.add(area.kind)
        candidates.forEach(candidate => route.candidateKeys.add(getRouteMapKey(region.name, candidate)))
        area.spawns.forEach(spawn => addRouteSpawn(route, spawn))
        routeLookup.set(key, route)
      })
    })
  })

  return [...routeLookup.values()]
    .map(route => ({
      ...route,
      mapNames: [...route.mapNames].filter(Boolean),
      kinds: [...route.kinds].filter(Boolean),
      pokemonByCategory: new Map([...route.pokemonByCategory.entries()].map(([categoryKey, pokemon]) => [
        categoryKey,
        [...pokemon.values()].sort((a, b) => {
          const priorityDiff = Number(isPriorityTarget(b)) - Number(isPriorityTarget(a))
          if (priorityDiff !== 0) return priorityDiff
          const tierA = getTier(a.name)
          const tierB = getTier(b.name)
          if (isPriorityTarget(a) && isPriorityTarget(b) && tierA !== tierB) return tierA - tierB
          return a.name.localeCompare(b.name)
        }),
      ])),
      candidateKeys: [...route.candidateKeys],
    }))
    .map(route => {
      const expectedCategories = UNROUTED_CATEGORIES.filter((category) => {
        if (!route.expectedCategories.has(category.key)) return false
        const pokemon = route.pokemonByCategory.get(category.key) || []
        if (category.key === 'horde' || category.key === 'surfingHorde') {
          return pokemon.length > 1 && hasTrackableTierPokemon(pokemon)
        }
        if (['fishing', 'headbutt', 'rockSmash'].includes(category.key)) {
          return hasTrackableTierPokemon(pokemon)
        }
        return true
      })

      return {
        ...route,
        expectedCategories,
        hasRareTarget: expectedCategories.some(category => hasRareTierPokemon(route.pokemonByCategory.get(category.key) || [])),
      }
    })
    .filter(route => route.expectedCategories.length > 0)
}

function getTrackedRouteCategories(route) {
  const explicitCategory = ENCOUNTER_CATEGORY_MAP[route.encounterCategory]
  if (explicitCategory) {
    return new Set([explicitCategory])
  }

  const variation = normalizeSearch(route.variation)
  const categories = new Set()
  const isNoLure = variation.includes('no lure')

  if (!variation || isNoLure || variation.includes('day') || variation.includes('night') || variation.includes('morning')) {
    categories.add('singles')
  }

  if (variation.includes('surf') || variation.includes('water')) {
    categories.add(variation.includes('horde') ? 'surfingHorde' : 'surfing')
  }

  if (!isNoLure && variation.includes('lure') && !variation.includes('fishing') && !variation.includes('rod')) {
    categories.add('singles')
  }

  if (variation.includes('fishing') || variation.includes('rod')) {
    categories.add('fishing')
  }

  if (variation.includes('horde')) {
    categories.add(variation.includes('surf') || variation.includes('water') ? 'surfingHorde' : 'horde')
  }

  if (variation.includes('headbutt')) {
    categories.add('headbutt')
  }

  if (variation.includes('rock smash')) {
    categories.add('rockSmash')
  }

  return categories
}

function buildTrackedCoverage(routes) {
  const coverage = new Map()

  routes.forEach((route) => {
    const key = getRouteMapKey(route.region, route.routeName)
    const categories = coverage.get(key) || new Map()
    getTrackedRouteCategories(route).forEach((category) => {
      categories.set(category, (categories.get(category) || 0) + route.total)
    })
    coverage.set(key, categories)
  })

  return coverage
}

function getUnroutedRoutes(expectedRoutes, trackedCoverage) {
  return expectedRoutes
    .map((route) => {
      const trackedCategoryTotals = new Map()
      route.candidateKeys.forEach((key) => {
        const categories = trackedCoverage.get(key)
        if (categories) {
          categories.forEach((encounters, category) => {
            trackedCategoryTotals.set(category, (trackedCategoryTotals.get(category) || 0) + encounters)
          })
        }
      })

      const missingCategories = route.expectedCategories.filter(category => (
        (trackedCategoryTotals.get(category.key) || 0) < MIN_CATEGORY_TRACKED_ENCOUNTERS
      ))
      return {
        ...route,
        trackedCategoryTotals,
        missingCategories,
      }
    })
    .filter(route => route.missingCategories.length > 0)
    .sort(sortRoutesByRegionThenName)
}

function getTopContributors(routes) {
  const contributors = new Map()

  routes.forEach((route) => {
    const names = String(route.credit || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)

    names.forEach((name) => {
      const previous = contributors.get(name) || { name, routes: 0, encounters: 0 }
      contributors.set(name, {
        ...previous,
        routes: previous.routes + 1,
        encounters: previous.encounters + route.total,
      })
    })
  })

  return Array.from(contributors.values())
    .sort((a, b) => b.routes - a.routes || b.encounters - a.encounters || a.name.localeCompare(b.name))
}

function TopContributorsDropdown({ contributors }) {
  const totalRoutes = contributors.reduce((sum, contributor) => sum + contributor.routes, 0)

  return (
    <details className={styles.topContributors}>
      <summary className={styles.topContributorsSummary}>
        <span>贡献者排行</span>
        <small>{totalRoutes.toLocaleString()} 条地点记录</small>
      </summary>
      <ol className={styles.topContributorsList}>
        {contributors.map((contributor, index) => (
          <li key={contributor.name} className={styles.topContributorRow}>
            <span className={styles.contributorRank}>#{index + 1}</span>
            <span className={styles.contributorName}>{contributor.name}</span>
            <span className={styles.contributorStats}>
              {contributor.routes.toLocaleString()} 条地点
            </span>
          </li>
        ))}
      </ol>
    </details>
  )
}

function PokemonPill({ mon, role }) {
  const tierLabel = mon.tier !== null ? `闪光阶级 ${mon.tier}` : null

  return (
    <Link to={`/pokemon/${normalizePokemonName(mon.name)}/`} className={`${styles.monPill} ${role === 'target' ? styles.targetPill : styles.phasePill}`}>
      <img
        src={getLocalPokemonGif(mon.name)}
        alt={translatePokemonName(mon.name)}
        className={styles.monSprite}
        onError={onGifError(mon.name)}
        loading="lazy"
      />
      <span className={styles.monName}>{translatePokemonName(mon.name)}</span>
      <span className={styles.monPercent}>{mon.percentLabel}</span>
      <span className={styles.monEncounters}>{mon.encounters.toLocaleString()} 次遭遇</span>
      {tierLabel && <span className={styles.tierBadge}>{tierLabel}</span>}
    </Link>
  )
}

function RouteCard({ route, pokemonFilter, pokemonFamilyKeys, sortMode }) {
  const pokemonNeedle = resolvePokemonSearch(pokemonFilter)
  const displayTargetTiers = (sortMode === 'best' || sortMode === 'worst') ? BEST_ROUTE_TIERS : TARGET_TIERS
  const targetPokemon = route.pokemon.filter(mon => {
    const monKey = normalizePokemonKey(mon.name)
    const isSearchedPokemon = pokemonNeedle && (
      monKey.includes(pokemonNeedle)
      || pokemonFamilyKeys.has(monKey)
    )
    return isSearchedPokemon || displayTargetTiers.has(mon.tier)
  })
  const targetNames = new Set(targetPokemon.map(mon => normalizePokemonKey(mon.name)))
  const phasePokemon = route.pokemon.filter(mon => !targetNames.has(normalizePokemonKey(mon.name)))
  const targetHeading = (sortMode === 'best' || sortMode === 'worst') ? '阶级 0–2 目标' : '目标宝可梦'

  return (
    <article className={styles.routeCard}>
      <header className={styles.routeHeader}>
        <div>
          <p className={styles.regionLabel}>{translateRegionName(route.region)}</p>
          <h2>{translateLocationName(route.displayName)}</h2>
        </div>
        <div className={styles.routeMeta}>
          <span>已记录遭遇：{route.total.toLocaleString()}</span>
          <span>稀有总占比：{route.rarePercentLabel}</span>
          {route.credit && <span>记录者：{route.credit}</span>}
        </div>
      </header>

      {targetPokemon.length > 0 && (
        <section className={styles.monSection}>
          <h3>{targetHeading}</h3>
          <div className={styles.monGrid}>
            {targetPokemon.map((mon, index) => (
              <PokemonPill key={`${route.id}-target-${mon.name}-${index}`} mon={mon} role="target" />
            ))}
          </div>
        </section>
      )}

      <section className={styles.monSection}>
        <h3>{targetPokemon.length > 0 ? '陪跑宝可梦' : '宝可梦出现率'}</h3>
        <div className={styles.monGrid}>
          {phasePokemon.map((mon, index) => (
            <PokemonPill key={`${route.id}-phase-${mon.name}-${index}`} mon={mon} role="phase" />
          ))}
        </div>
      </section>
    </article>
  )
}

function UnroutedChecklist({ route, pokemonNeedle, pokemonFamilyKeys }) {
  return (
    <article className={styles.unroutedCard}>
      <header className={styles.unroutedHeader}>
        <div>
          <p className={styles.regionLabel}>{translateRegionName(route.region)}</p>
          <h2>{translateLocationName(route.routeName)}</h2>
        </div>
        <div className={styles.routeMeta}>
          {route.kinds.map(kind => <span key={kind}>{kind}</span>)}
          {route.mapNames.map(mapName => <span key={mapName}>{mapName}</span>)}
        </div>
      </header>
      <ul className={styles.checklistGrid}>
        {route.expectedCategories.map(category => {
          const trackedTotal = route.trackedCategoryTotals.get(category.key) || 0
          const isComplete = trackedTotal >= MIN_CATEGORY_TRACKED_ENCOUNTERS
          return (
            <li key={category.key} className={`${styles.checklistItem} ${isComplete ? styles.checklistComplete : styles.checklistMissing}`}>
              <span className={styles.checkIcon} aria-hidden="true">{isComplete ? '✓' : '×'}</span>
              <span>{category.label}</span>
              <strong>{isComplete ? '已完成' : `${trackedTotal.toLocaleString()}/${MIN_CATEGORY_TRACKED_ENCOUNTERS.toLocaleString()}`}</strong>
            </li>
          )
        })}
      </ul>
      <div className={styles.unroutedSpawnSections}>
        {route.expectedCategories.map((category) => {
          const pokemon = (route.pokemonByCategory.get(category.key) || [])
            .filter(mon => pokemonMatchesSearch(mon, pokemonNeedle, pokemonFamilyKeys))
          if (pokemon.length === 0) return null

          return (
            <section key={`${route.id}-${category.key}-pokemon`} className={styles.unroutedSpawnSection}>
              <h3>{category.label}</h3>
              <div className={styles.unroutedPokemonGrid}>
                {pokemon.map((mon) => (
                  <Link
                    key={`${route.id}-${category.key}-${mon.name}`}
                    to={`/pokemon/${normalizePokemonName(mon.name)}/`}
                    className={`${styles.unroutedPokemon} ${isPriorityTarget(mon) ? styles.unroutedPokemonPriority : ''}`}
                  >
                    <img
                      src={getLocalPokemonGif(mon.name)}
                      alt={translatePokemonName(mon.name)}
                      onError={onGifError(mon.name)}
                      loading="lazy"
                    />
                    <span>{translatePokemonName(mon.name)}</span>
                    <small>
                      {[
                        mon.meta.rarities.map(translateEncounterTerm).join(', '),
                        mon.meta.methods.map(translateEncounterTerm).join(', '),
                        mon.meta.levels.length > 0 ? `等级 ${mon.meta.levels.join(', ')}` : '',
                        collapseSeasonalTimes(mon.meta.times).map(formatEncounterTimeLabel).join(', '),
                      ].filter(Boolean).join(' - ')}
                    </small>
                    {isPriorityTarget(mon) && <strong className={styles.priorityBadge}>阶级 {getTier(mon.name)}</strong>}
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </article>
  )
}

export default function RouteFinder() {
  const { data: encounterPercents = {} } = useEncounterPercents()
  const [activeTab, setActiveTab] = useState('tracked')
  const [pokemonFilter, setPokemonFilter] = useState('')
  const [routeFilter, setRouteFilter] = useState('')
  const [sortMode, setSortMode] = useState('default')
  const [unroutedRegionFilter, setUnroutedRegionFilter] = useState('all')
  const [unroutedCategoryFilter, setUnroutedCategoryFilter] = useState('all')
  const [unroutedRaresOnly, setUnroutedRaresOnly] = useState(true)
  const [isInfoDropdownOpen, setIsInfoDropdownOpen] = useState(() => getInitialInfoDropdownOpen())
  const [openUnroutedRegions, setOpenUnroutedRegions] = useState(() => new Set())
  const [isSubmitFormOpen, setIsSubmitFormOpen] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [screenshotFiles, setScreenshotFiles] = useState([])
  const [cooldownRemaining, setCooldownRemaining] = useState(() => getInitialCooldownRemaining())
  const [isTurnstileReady, setIsTurnstileReady] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileError, setTurnstileError] = useState('')
  const [turnstileWidgetId, setTurnstileWidgetId] = useState(null)
  const screenshotInputRef = useRef(null)
  const unroutedFilterSignatureRef = useRef(null)
  const [submitForm, setSubmitForm] = useState({
    region: REGION_ORDER[0],
    route: '',
    variation: '',
    credit: '',
    discord: '',
    encounterData: '',
    notes: '',
  })

  useDocumentHead({
    title: '地点查找器｜PokeMMO',
    description: '按宝可梦或地点查询社区记录的 PokeMMO 遭遇率。',
    canonicalPath: '/route-finder/',
    breadcrumbs: [
      { name: '首页', url: '/' },
      { name: '地点查找器', url: '/route-finder' },
    ],
  })

  const routes = useMemo(() => flattenRoutes(encounterPercents), [encounterPercents])
  const expectedRouteCoverage = useMemo(() => buildExpectedRouteCoverage(), [])
  const trackedCoverage = useMemo(() => buildTrackedCoverage(routes), [routes])
  const unroutedRoutes = useMemo(
    () => getUnroutedRoutes(expectedRouteCoverage, trackedCoverage),
    [expectedRouteCoverage, trackedCoverage]
  )
  const evolutionFamilyLookup = useMemo(() => buildEvolutionFamilyLookup(), [])
  const topContributors = useMemo(() => getTopContributors(routes), [routes])
  const pokemonOptions = useMemo(() => {
    const names = new Set()
    routes.forEach(route => route.pokemon.forEach(mon => names.add(mon.name)))
    expectedRouteCoverage.forEach((route) => {
      route.pokemonByCategory.forEach(pokemon => pokemon.forEach(mon => names.add(mon.name)))
    })
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [expectedRouteCoverage, routes])
  const routeOptions = useMemo(() => (
    [...new Set([
      ...routes.flatMap(route => [route.routeName, route.displayName]),
      ...expectedRouteCoverage.map(route => route.routeName),
    ])].sort((a, b) => a.localeCompare(b))
  ), [expectedRouteCoverage, routes])

  const pokemonNeedle = resolvePokemonSearch(pokemonFilter)
  const routeNeedle = normalizeSearch(routeFilter)
  const shouldGroupByRegion = !pokemonNeedle && sortMode === 'default'
  const pokemonFamilyKeys = useMemo(() => {
    if (!pokemonNeedle) return new Set()

    const directFamily = evolutionFamilyLookup.get(pokemonNeedle)
    if (directFamily) return new Set(directFamily)

    const matchedFamilies = new Set()
    evolutionFamilyLookup.forEach((family, member) => {
      if (member.includes(pokemonNeedle)) {
        family.forEach(relative => matchedFamilies.add(relative))
      }
    })

    return matchedFamilies
  }, [evolutionFamilyLookup, pokemonNeedle])

  const pokemonHasData = !pokemonNeedle || routes.some(route =>
    route.pokemon.some(mon => {
      const monKey = normalizePokemonKey(mon.name)
      return monKey.includes(pokemonNeedle) || pokemonFamilyKeys.has(monKey)
    })
  )
  const routeHasData = !routeNeedle || routes.some(route => route.routeSearch.includes(routeNeedle))

  useEffect(() => {
    if (!cooldownRemaining) return undefined

    const intervalId = window.setInterval(() => {
      const remaining = getInitialCooldownRemaining()
      setCooldownRemaining(remaining)

      if (!remaining) {
        window.localStorage.removeItem(SUBMISSION_COOLDOWN_KEY)
      }
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [cooldownRemaining])

  useEffect(() => {
    if (typeof window === 'undefined' || !TURNSTILE_SITE_KEY) return undefined

    if (window.turnstile) {
      setIsTurnstileReady(true)
      return undefined
    }

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID)
    if (existingScript) {
      const handleLoad = () => setIsTurnstileReady(true)
      existingScript.addEventListener('load', handleLoad)
      return () => existingScript.removeEventListener('load', handleLoad)
    }

    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => setIsTurnstileReady(true)
    document.head.appendChild(script)

    return undefined
  }, [])

  useEffect(() => {
    if (!isSubmitFormOpen) {
      if (window.turnstile && turnstileWidgetId !== null) {
        window.turnstile.remove(turnstileWidgetId)
      }
      setTurnstileWidgetId(null)
      setTurnstileToken('')
      setTurnstileError('')
      return
    }

    if (!TURNSTILE_SITE_KEY) {
      setTurnstileError('验证码尚未配置，请稍后再试。')
      return
    }

    if (!isTurnstileReady || turnstileWidgetId !== null || !window.turnstile) return

    const container = document.getElementById(TURNSTILE_CONTAINER_ID)
    if (!container) return

    const widgetId = window.turnstile.render(`#${TURNSTILE_CONTAINER_ID}`, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: 'auto',
      size: 'flexible',
      action: TURNSTILE_ACTION,
      callback: (token) => {
        setTurnstileToken(token)
        setTurnstileError('')
      },
      'error-callback': () => {
        setTurnstileToken('')
        setTurnstileError('验证码校验失败，请重试。')
      },
      'expired-callback': () => {
        setTurnstileToken('')
        setTurnstileError('验证码已过期，请重新完成验证。')
      },
      'timeout-callback': () => {
        setTurnstileToken('')
        setTurnstileError('验证码超时，请重新完成验证。')
      },
    })

    setTurnstileWidgetId(widgetId)
  }, [isSubmitFormOpen, isTurnstileReady, turnstileWidgetId])

  const filteredRoutes = routes
    .filter(route => {
      const routeMatches = !routeNeedle
        || route.routeSearch.includes(routeNeedle)
        || normalizeSearch(translateLocationName(route.routeName)).includes(routeNeedle)
      const pokemonMatches = !pokemonNeedle || route.pokemon.some(mon => {
        const monKey = normalizePokemonKey(mon.name)
        return monKey.includes(pokemonNeedle) || pokemonFamilyKeys.has(monKey)
      })
      const sortMatches = (sortMode !== 'best' && sortMode !== 'worst') || hasBestRouteTierPokemon(route)
      return routeMatches && pokemonMatches && sortMatches
    })
    .sort((a, b) => {
      if (sortMode === 'best') {
        const bestDiff = getRouteBestPercentTotal(b) - getRouteBestPercentTotal(a)
        if (bestDiff !== 0) return bestDiff
        return sortRoutesByRegionThenName(a, b)
      }

      if (sortMode === 'worst') {
        const worstDiff = getRouteBestPercentTotal(a) - getRouteBestPercentTotal(b)
        if (worstDiff !== 0) return worstDiff
        return sortRoutesByRegionThenName(a, b)
      }

      if (sortMode === 'encounters-desc') {
        const encounterDiff = b.total - a.total
        if (encounterDiff !== 0) return encounterDiff
        return sortRoutesByRegionThenName(a, b)
      }

      if (sortMode === 'encounters-asc') {
        const encounterDiff = a.total - b.total
        if (encounterDiff !== 0) return encounterDiff
        return sortRoutesByRegionThenName(a, b)
      }

      if (!pokemonNeedle) return sortRoutesByRegionThenName(a, b)

      const targetDiff = getRouteTargetPercent(b, pokemonNeedle) - getRouteTargetPercent(a, pokemonNeedle)
      if (targetDiff !== 0) return targetDiff
      return sortRoutesByRegionThenName(a, b)
    })
  const filteredTotalEncounters = filteredRoutes.reduce((sum, route) => sum + route.total, 0)
  const routesByRegion = useMemo(() => {
    if (!shouldGroupByRegion) return []

    const groupedRoutes = new Map()
    filteredRoutes.forEach((route) => {
      const existingRoutes = groupedRoutes.get(route.region) || []
      existingRoutes.push(route)
      groupedRoutes.set(route.region, existingRoutes)
    })

    return [...groupedRoutes.entries()]
      .sort(([regionA], [regionB]) => getRegionOrder(regionA) - getRegionOrder(regionB))
  }, [filteredRoutes, shouldGroupByRegion])
  const filteredUnroutedRoutes = useMemo(() => {
    return unroutedRoutes.map((route) => {
      if (routeNeedle && !route.routeSearch.includes(routeNeedle) && !normalizeSearch(translateLocationName(route.routeName)).includes(routeNeedle)) return false
      if (unroutedRegionFilter !== 'all' && route.region !== unroutedRegionFilter) return false

      const expectedCategories = route.expectedCategories.filter((category) => {
        if (unroutedCategoryFilter !== 'all' && category.key !== unroutedCategoryFilter) return false
        const pokemon = route.pokemonByCategory.get(category.key) || []
        if (unroutedRaresOnly && !hasRareTierPokemon(pokemon)) return false
        if (pokemonNeedle && !pokemon.some(mon => pokemonMatchesSearch(mon, pokemonNeedle, pokemonFamilyKeys))) return false
        return true
      })
      const expectedCategoryKeys = new Set(expectedCategories.map(category => category.key))
      const missingCategories = route.missingCategories.filter(category => expectedCategoryKeys.has(category.key))

      if (missingCategories.length === 0) return false

      return {
        ...route,
        expectedCategories,
        missingCategories,
      }
    }).filter(Boolean)
  }, [pokemonFamilyKeys, pokemonNeedle, routeNeedle, unroutedCategoryFilter, unroutedRaresOnly, unroutedRegionFilter, unroutedRoutes])
  const missingChecklistTotal = filteredUnroutedRoutes.reduce((total, route) => total + route.missingCategories.length, 0)
  const unroutedRoutesByRegion = useMemo(() => {
    const groupedRoutes = new Map()
    filteredUnroutedRoutes.forEach((route) => {
      const regionRoutes = groupedRoutes.get(route.region) || []
      regionRoutes.push(route)
      groupedRoutes.set(route.region, regionRoutes)
    })

    return [...groupedRoutes.entries()]
      .sort(([regionA], [regionB]) => getRegionOrder(regionA) - getRegionOrder(regionB))
  }, [filteredUnroutedRoutes])
  const unroutedFilterSignature = [
    pokemonFilter,
    routeFilter,
    unroutedRegionFilter,
    unroutedCategoryFilter,
    unroutedRaresOnly ? 'rare' : 'all',
  ].join('|')

  useEffect(() => {
    if (activeTab !== 'unrouted') return

    if (unroutedFilterSignatureRef.current === null) {
      unroutedFilterSignatureRef.current = unroutedFilterSignature
      return
    }

    if (unroutedFilterSignatureRef.current === unroutedFilterSignature) return

    unroutedFilterSignatureRef.current = unroutedFilterSignature
    setOpenUnroutedRegions(new Set(unroutedRoutesByRegion.map(([region]) => region)))
  }, [activeTab, unroutedFilterSignature, unroutedRoutesByRegion])

  let emptyText = ''
  if (pokemonNeedle && !pokemonHasData) {
    emptyText = `很遗憾，${pokemonFilter.trim()}目前没有已记录的数据。若你愿意协助记录并提交数据，请通过 Discord 联系 Hyper（ohypers）。`
  } else if (routeNeedle && !routeHasData) {
    emptyText = `很遗憾，${routeFilter.trim()}目前没有已记录的数据。若你愿意协助记录并提交数据，请通过 Discord 联系 Hyper（ohypers）。`
  } else if ((pokemonNeedle || routeNeedle) && filteredRoutes.length === 0) {
    emptyText = '没有已记录的地点同时符合这两个筛选条件。'
  }

  const handleSubmitFormChange = (field) => (event) => {
    setSubmitForm((current) => ({
      ...current,
      [field]: event.target.value,
    }))
  }

  const clearScreenshotInput = () => {
    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = ''
    }
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

  const handleUnroutedRegionToggle = (region, isOpen) => {
    setOpenUnroutedRegions((currentRegions) => {
      const nextRegions = new Set(currentRegions)
      if (isOpen) {
        nextRegions.add(region)
      } else {
        nextRegions.delete(region)
      }
      return nextRegions
    })
  }

  const closeSubmitForm = () => {
    setIsSubmitFormOpen(false)
    setSubmitError('')
    setSubmitSuccess('')
    setIsSubmitting(false)
    setScreenshotFiles([])
    clearScreenshotInput()
  }

  const openSubmitForm = () => {
    setIsSubmitFormOpen(true)
    setSubmitError('')
    setSubmitSuccess('')
    setScreenshotFiles([])
    clearScreenshotInput()
  }

  const handleScreenshotChange = (event) => {
    const selectedFiles = Array.from(event.target.files || [])
    const mergedFiles = mergeScreenshotFiles(screenshotFiles, selectedFiles)

    if (mergedFiles.length > MAX_SCREENSHOT_FILES) {
      setSubmitError(`每次最多可上传 ${MAX_SCREENSHOT_FILES} 张截图。`)
      clearScreenshotInput()
      return
    }

    if (getTotalFileBytes(mergedFiles) > MAX_TOTAL_SCREENSHOT_BYTES) {
      setSubmitError(`截图总大小不能超过 ${MAX_TOTAL_SCREENSHOT_MB} MB。`)
      clearScreenshotInput()
      return
    }

    setScreenshotFiles(mergedFiles)
    setSubmitError('')
  }

  const resetTurnstile = () => {
    if (window.turnstile && turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId)
    }
    setTurnstileToken('')
    setTurnstileError('')
  }

  const handleSubmitData = async (event) => {
    event.preventDefault()

    if (cooldownRemaining > 0) {
      setSubmitError(`请等待 ${formatCooldown(cooldownRemaining)} 后再提交。`)
      return
    }

    const trimmedRoute = submitForm.route.trim()
    const trimmedCredit = submitForm.credit.trim()
    if (!trimmedRoute || !trimmedCredit) {
      setSubmitError('提交前请至少填写地点与署名。')
      return
    }

    if (!TURNSTILE_SITE_KEY) {
      setSubmitError('验证码尚未配置，请稍后再试。')
      return
    }

    if (!turnstileToken) {
      setSubmitError(turnstileError || '提交前请完成验证码校验。')
      return
    }

    if (screenshotFiles.length === 0) {
      setSubmitError('提交前请至少附上一张截图。')
      return
    }

    if (screenshotFiles.length > MAX_SCREENSHOT_FILES) {
      setSubmitError(`每次最多可上传 ${MAX_SCREENSHOT_FILES} 张截图。`)
      return
    }

    if (getTotalFileBytes(screenshotFiles) > MAX_TOTAL_SCREENSHOT_BYTES) {
      setSubmitError(`截图总大小不能超过 ${MAX_TOTAL_SCREENSHOT_MB} MB。`)
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    setSubmitSuccess('')

    const payload = new FormData()
    payload.append('region', submitForm.region)
    payload.append('route', trimmedRoute)
    payload.append('variation', submitForm.variation.trim())
    payload.append('credit', trimmedCredit)
    payload.append('discord', submitForm.discord.trim())
    payload.append('encounter_data', submitForm.encounterData.trim())
    payload.append('notes', submitForm.notes.trim())
    payload.append('cf-turnstile-response', turnstileToken)

    screenshotFiles.forEach((file) => {
      payload.append('attachment', file)
    })

    try {
      const response = await fetch(API.routeFinderSubmission, {
        method: 'POST',
        body: payload,
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) {
        throw new Error(result.error || '暂时无法发送表单。')
      }

      const nextCooldownUntil = Date.now() + SUBMISSION_COOLDOWN_MS
      window.localStorage.setItem(SUBMISSION_COOLDOWN_KEY, String(nextCooldownUntil))
      setCooldownRemaining(SUBMISSION_COOLDOWN_MS)
      setSubmitSuccess(`数据已成功提交。请等待 ${formatCooldown(SUBMISSION_COOLDOWN_MS)} 后再提交下一份。`)
      setSubmitForm({
        region: REGION_ORDER[0],
        route: '',
        variation: '',
        credit: '',
        discord: '',
        encounterData: '',
        notes: '',
      })
      setScreenshotFiles([])
      clearScreenshotInput()
      resetTurnstile()
    } catch (error) {
      setSubmitError(error.message || '暂时无法发送表单。')
      resetTurnstile()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className="page-title">地点查找器</h1>
      <img src={getAssetUrl('images/pagebreak.png')} alt="" className="pagebreak" />

      <div className={styles.topControls}>
        <TopContributorsDropdown contributors={topContributors} />
        <button type="button" className={styles.submitButton} onClick={openSubmitForm}>
          提交你的数据
        </button>
      </div>

      <details className={styles.infoDropdown} open={isInfoDropdownOpen} onToggle={handleInfoDropdownToggle}>
        <summary>页面说明／了解更多</summary>
        <p>
          本页面仍在持续建设中，目前收录的数据有限。目标是尽可能记录更多地点、更多遭遇样本。如果你准备长期在某个地点刷闪，欢迎开启一次计数行程并记录遭遇数据。
        </p>
        <p>
          本页面用于帮助你为心仪的闪光宝可梦挑选地点。所有信息均由志愿者手工记录，并非官方数据；季节、时段等因素可能造成偏差，请将数值作为参考。
        </p>
        <p>
          如愿协助本项目，请通过 Discord 联系 ohypers。
        </p>
      </details>

      <div className={styles.tabList} role="tablist" aria-label="地点查找器分页">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tracked'}
          className={`${styles.tabButton} ${activeTab === 'tracked' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('tracked')}
        >
          已记录
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'unrouted'}
          className={`${styles.tabButton} ${activeTab === 'unrouted' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('unrouted')}
        >
          待记录
        </button>
      </div>

      {activeTab === 'unrouted' && (
        <p className={styles.unroutedIntro}>
          想参与协作吗？这里列出了仍缺少记录的地点。部分特殊地点（如变化洞窟、狩猎地带）需要单独处理，请以实际游戏内容为准。
        </p>
      )}

      <section className={styles.searchPanel} aria-label="地点查找筛选">
        {(activeTab === 'tracked' || activeTab === 'unrouted') && (
          <label>
            <span>宝可梦</span>
            <input
              type="search"
              value={pokemonFilter}
              onChange={event => setPokemonFilter(event.target.value)}
              placeholder="搜索宝可梦…"
              list="route-finder-pokemon"
            />
          </label>
        )}
        <label>
          <span>地点</span>
          <input
            type="search"
            value={routeFilter}
            onChange={event => setRouteFilter(event.target.value)}
            placeholder="搜索地点…"
            list="route-finder-routes"
          />
        </label>
        {activeTab === 'tracked' && (
          <label>
            <span>排序</span>
            <select value={sortMode} onChange={event => setSortMode(event.target.value)}>
              <option value="default">{pokemonNeedle ? '最匹配该宝可梦' : '按地区排列'}</option>
              <option value="best">最佳地点（阶级 0–2 占比）</option>
              <option value="worst">最差地点（阶级 0–2 占比）</option>
              <option value="encounters-desc">已记录遭遇数：从高到低</option>
              <option value="encounters-asc">已记录遭遇数：从低到高</option>
            </select>
          </label>
        )}
        <datalist id="route-finder-pokemon">
          {pokemonOptions.map(name => <option value={name} label={translatePokemonName(name)} key={name} />)}
        </datalist>
        <datalist id="route-finder-routes">
          {routeOptions.map(name => <option value={name} label={translateLocationName(name)} key={name} />)}
        </datalist>
      </section>

      {activeTab === 'unrouted' && (
        <section className={styles.unroutedFilterPanel} aria-label="待记录地点筛选">
          <label>
            <span>地区</span>
            <select value={unroutedRegionFilter} onChange={event => setUnroutedRegionFilter(event.target.value)}>
              <option value="all">全部地区</option>
              {REGION_ORDER.map(region => <option key={region} value={region}>{translateRegionName(region)}</option>)}
            </select>
          </label>
          <label>
            <span>缺少的类别</span>
            <select value={unroutedCategoryFilter} onChange={event => setUnroutedCategoryFilter(event.target.value)}>
              {UNROUTED_CATEGORY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className={styles.checkboxFilter}>
            <input
              type="checkbox"
              checked={unroutedRaresOnly}
              onChange={event => setUnroutedRaresOnly(event.target.checked)}
            />
            <span>仅显示含阶级 0–2 目标的地点</span>
          </label>
        </section>
      )}

      {activeTab === 'tracked' && pokemonNeedle && pokemonHasData && (
        <section className={styles.activeTarget}>
          <span>目标宝可梦</span>
          <strong>{translatePokemonName(pokemonFilter.trim())}</strong>
        </section>
      )}

      {activeTab === 'tracked' ? (
        <>
          <p className={styles.resultCount}>
            已记录 {filteredRoutes.length.toLocaleString()} 个地点
            <span>合计 {filteredTotalEncounters.toLocaleString()} 次遭遇</span>
          </p>

          {emptyText ? (
            <p className={styles.emptyState}>{emptyText}</p>
          ) : (
            <div className={styles.routeList}>
              {!shouldGroupByRegion ? (
                filteredRoutes.map(route => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    pokemonFilter={pokemonFilter}
                    pokemonFamilyKeys={pokemonFamilyKeys}
                    sortMode={sortMode}
                  />
                ))
              ) : (
                routesByRegion.map(([region, regionRoutes]) => (
                  <section key={region} aria-label={`${translateRegionName(region)}地点`}>
                    <h2>{translateRegionName(region)}</h2>
                    {regionRoutes.map(route => (
                      <RouteCard
                        key={route.id}
                        route={route}
                        pokemonFilter={pokemonFilter}
                        pokemonFamilyKeys={pokemonFamilyKeys}
                        sortMode={sortMode}
                      />
                    ))}
                  </section>
                ))
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <p className={styles.resultCount}>
            {filteredUnroutedRoutes.length.toLocaleString()} 个地点尚未完成
            <span>缺少 {missingChecklistTotal.toLocaleString()} 项记录</span>
          </p>

          {filteredUnroutedRoutes.length === 0 ? (
            <p className={styles.emptyState}>所有匹配地点的可用遭遇类别均已有记录。</p>
          ) : (
            <div className={styles.routeList}>
              {unroutedRoutesByRegion.map(([region, regionRoutes]) => (
                <details
                  key={region}
                  className={styles.unroutedRegionGroup}
                  open={openUnroutedRegions.has(region)}
                  onToggle={event => handleUnroutedRegionToggle(region, event.currentTarget.open)}
                >
                  <summary>
                    <span>{translateRegionName(region)}</span>
                    <strong>{regionRoutes.length.toLocaleString()} 个地点</strong>
                  </summary>
                  <div className={styles.unroutedRegionList}>
                    {regionRoutes.map(route => (
                      <UnroutedChecklist
                        key={route.id}
                        route={route}
                        pokemonNeedle={pokemonNeedle}
                        pokemonFamilyKeys={pokemonFamilyKeys}
                      />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}

      {isSubmitFormOpen && (
        <div className={styles.submitModalBackdrop} role="presentation" onClick={closeSubmitForm}>
          <section
            className={styles.submitModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="route-finder-submit-title"
            onClick={event => event.stopPropagation()}
          >
            <div className={styles.submitModalHeader}>
              <div>
                <p className={styles.submitEyebrow}>社区数据投稿</p>
                <h2 id="route-finder-submit-title">提交地点数据供审核</h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeSubmitForm}
                aria-label="关闭投稿表单"
              >
                x
              </button>
            </div>

            <p className={styles.submitDescription}>
              如果你想向网站提交遭遇数据，请填写本表。数据会先经过审核，确认无误后才会收录。感谢每一位愿意协助记录的训练家！若方便，建议直接在 Discord 私信 oHypers，以便核对数据与提交标准；当然也可以使用此表单投稿。
            </p>

            <form className={styles.submitForm} onSubmit={handleSubmitData}>
              <label>
                <span>地区</span>
                <select value={submitForm.region} onChange={handleSubmitFormChange('region')}>
                  {REGION_ORDER.map(region => <option key={region} value={region}>{translateRegionName(region)}</option>)}
                </select>
              </label>

              <label>
                <span>地点</span>
                <input
                  type="text"
                  value={submitForm.route}
                  onChange={handleSubmitFormChange('route')}
                  placeholder="如：1号道路"
                  required
                />
              </label>

              <label>
                <span>变体／条件</span>
                <input
                  type="text"
                  value={submitForm.variation}
                  onChange={handleSubmitFormChange('variation')}
                  placeholder="如：引虫香水、群聚、时段等"
                />
              </label>

              <label>
                <span>署名</span>
                <input
                  type="text"
                  value={submitForm.credit}
                  onChange={handleSubmitFormChange('credit')}
                  placeholder="你的名字／游戏 ID"
                  required
                />
              </label>

              <label>
                <span>你的 Discord</span>
                <input
                  type="text"
                  value={submitForm.discord}
                  onChange={handleSubmitFormChange('discord')}
                  placeholder="如愿意被联系，请填写"
                />
              </label>

              <label className={styles.fullWidthField}>
                <span>遭遇数据</span>
                <textarea
                  value={submitForm.encounterData}
                  onChange={handleSubmitFormChange('encounterData')}
                  placeholder={`皮卡丘 - 120\n波波 - 80\n小拉达 - 40`}
                  rows={7}
                />
              </label>

              <label className={styles.fullWidthField}>
                <span>上传截图</span>
                <input
                  ref={screenshotInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={handleScreenshotChange}
                />
                <small className={styles.fieldHint}>
                  请附上 1 至 {MAX_SCREENSHOT_FILES} 张遭遇计数行程截图，所有文件总计不超过 {MAX_TOTAL_SCREENSHOT_MB} MB。
                </small>
                {screenshotFiles.length > 0 && (
                  <div className={styles.fileList}>
                    {screenshotFiles.map(file => (
                      <span key={`${file.name}-${file.lastModified}`} className={styles.fileName}>{file.name}</span>
                    ))}
                  </div>
                )}
              </label>

              <label className={styles.fullWidthField}>
                <span>补充说明</span>
                <textarea
                  value={submitForm.notes}
                  onChange={handleSubmitFormChange('notes')}
                  placeholder="如认为数据可能有误，或审核者需要注意特别条件，请在此说明。例如不同游戏时段出现率差异很大，或曾有群聚、头目等活动可能影响数据。"
                  rows={4}
                />
              </label>

              <div className={styles.fullWidthField}>
            <div className={styles.submitLimits} aria-label="投稿限制">
              <strong>投稿限制</strong>
              <p>每次最多上传 {MAX_SCREENSHOT_FILES} 张截图，所有文件总计不超过 {MAX_TOTAL_SCREENSHOT_MB} MB。</p>
              <p>每 {SHORT_WINDOW_SUBMISSION_MINUTES} 分钟可提交 {SHORT_WINDOW_SUBMISSION_LIMIT} 次，每日最多 {DAILY_SUBMISSION_LIMIT} 次。这是为了避免垃圾投稿；如需提交更多数据，请通过 Discord 联系 ohypers。</p>
            </div>
            </div>

              <div className={styles.fullWidthField}>
                <span className={styles.turnstileLabel}>验证码校验</span>
                <div id={TURNSTILE_CONTAINER_ID} className={styles.turnstileWrap} />
              </div>

              

              {submitError && <p className={styles.submitError}>{submitError}</p>}
              {submitSuccess && <p className={styles.submitSuccess}>{submitSuccess}</p>}
              {turnstileError && <p className={styles.submitError}>{turnstileError}</p>}
              {cooldownRemaining > 0 && (
                <p className={styles.submitCooldown}>
                  投稿冷却中：剩余 {formatCooldown(cooldownRemaining)}。
                </p>
              )}
              

              <div className={styles.submitActions}>
                <button type="button" className={styles.secondaryButton} onClick={closeSubmitForm}>
                  取消
                </button>
                <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                  {isSubmitting ? '发送中…' : cooldownRemaining > 0 ? `等待 ${formatCooldown(cooldownRemaining)}` : '提交数据'}
                </button>
              </div>
              
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
