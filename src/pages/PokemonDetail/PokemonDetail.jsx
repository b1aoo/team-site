import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useRef,useMemo, useState, useEffect } from 'react'
import { usePokemonDetails } from '../../hooks/usePokemonDetails'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import { useDatabase } from '../../hooks/useDatabase'
import { usePokemonOrder } from '../../hooks/usePokemonOrder'
import { usePokemonSprites } from '../../hooks/usePokemonSprites'
import { usePokemonForms } from '../../hooks/usePokemonForms'
import BackButton from '../../components/BackButton/BackButton'
import SearchBar from '../../components/SearchBar/SearchBar'
import styles from './PokemonDetail.module.css'
import abilitiesData from '../../data/pokemmo_data/abilities-data.json'
import safariData from '../../data/safari_zones.json'
import { translatePokemonName } from '../../utils/pokemon'
import { getAssetUrl } from '../../utils/assets'
import {
  translateAbilityName,
  translateEggGroupName,
  translateEncounterTerm,
  translateLocationName,
  translateMoveName,
  translateRegionName,
  translateTypeName,
} from '../../utils/pokemonTermsZh'

const TYPE_COLORS = {
  NORMAL: '#A8A878',
  FIRE: '#F08030',
  WATER: '#6890F0',
  ELECTRIC: '#F8D030',
  GRASS: '#78C850',
  ICE: '#98D8D8',
  FIGHTING : '#C03028',
  POISON: '#A040A0',
  GROUND: '#E0C068',
  FLYING: '#A890F0',
  PSYCHIC: '#F85888',
  BUG: '#A8B820',
  ROCK: '#B8A038',
  GHOST: '#705898',
  DRAGON: '#7038F8',
  DARK: '#705848',
  STEEL: '#B8B8D0',
  FAIRY: '#EE99AC',
}

const TIER_COLORS = {
  0: '#ffd700',
  1: '#c084fc',
  2: '#60a5fa',
  3: '#4ade80',
  4: '#2dd4bf',
  5: '#fb923c',
  6: '#94a3b8',
  7: '#cbd5e1',
}

// Type effectiveness chart - what types are weak to/resistant to
const TYPE_EFFECTIVENESS = {
  normal:   { weak: ['fighting'], resists: [], immune: ['ghost'] },
  fire:     { weak: ['water','ground','rock'], resists: ['fire','grass','ice','bug','steel'], immune: [] },
  water:    { weak: ['electric','grass'], resists: ['steel','fire','water','ice'], immune: [] },
  electric: { weak: ['ground'], resists: ['flying','steel','electric'], immune: [] },
  grass:    { weak: ['fire','ice','poison','flying','bug'], resists: ['ground','water','grass','electric'], immune: [] },
  ice:      { weak: ['fire','fighting','rock','steel'], resists: ['ice'], immune: [] },
  fighting: { weak: ['flying','psychic'], resists: ['bug','rock','dark'], immune: [] },
  poison:   { weak: ['ground','psychic'], resists: ['fighting','poison','bug','grass'], immune: [] },
  ground:   { weak: ['water','grass','ice'], resists: ['poison','rock'], immune: ['electric'] },
  flying:   { weak: ['electric','ice','rock'], resists: ['fighting','bug','grass'], immune: ['ground'] },
  psychic:  { weak: ['bug','ghost','dark'], resists: ['fighting','psychic'], immune: [] },
  bug:      { weak: ['fire','flying','rock'], resists: ['ground','grass','fighting'], immune: [] },
  rock:     { weak: ['water','grass','fighting','ground','steel'], resists: ['normal','flying','poison','fire'], immune: [] },
  ghost:    { weak: ['ghost','dark'], resists: ['poison','bug'], immune: ['normal','fighting'] },
  dragon:   { weak: ['ice','dragon'], resists: ['fire','water','grass','electric'], immune: [] },
  dark:     { weak: ['fighting','bug'], resists: ['ghost','dark'], immune: ['psychic'] },
  steel:    { weak: ['fire','water','ground'], resists: ['normal','flying','rock','bug','steel','grass','psychic','ice','dragon'], immune: ['poison'] },
}


/**
 * Get human-readable label for move learning method
 * @param {string} method - The learning method name (level-up, egg, machine, tutor, etc.)
 * @param {number} level - The level at which the move is learned (for level-up)
 * @returns {string} Human-readable description
 */
function getMoveLearningMethod(method, level) {
  if (!method) return '未知'
  
  const methodMap = {
    'level-up': level ? `等级 ${level}` : '升级习得',
    'egg': '遗传招式',
    'machine': 'TM/HM',
    'tutor': '招式教学',
    'reminder': '招式回忆',
    'form-change': '形态变化',
  }
  
  return methodMap[method] || method.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Get the sort priority for a learning method
 * Lower number = displayed first
 */
function getMethodPriority(method) {
  const priorityMap = {
    'level-up': 1,
    'machine': 2,
    'tutor': 3,
    'egg': 4,
    'reminder': 5,
    'form-change': 6,
  }
  return priorityMap[method] || 999
}

/**
 * Group moves by their learning method and return in priority order
 */
function groupMovesByMethod(moves) {
  const grouped = {
    'level-up': [],
    'machine': [],
    'tutor': [],
    'egg': [],
    'other': [],
  }
  
  moves.forEach(move => {
    const primaryMethod = move.methods?.[0]
    const method = primaryMethod?.method || 'other'
    
    if (grouped[method] !== undefined) {
      grouped[method].push(move)
    } else {
      grouped.other.push(move)
    }
  })
  
  // Sort level-up moves by level
  grouped['level-up'].sort((a, b) => {
    const levelA = a.methods?.[0]?.level || 0
    const levelB = b.methods?.[0]?.level || 0
    return levelA - levelB
  })
  
  return grouped
}

function getStatColor(value) {
  const safeValue = Number.isFinite(value) ? value : 0
  const clamped = Math.max(0, Math.min(200, safeValue))
  const hue = (clamped / 200) * 120
  return `hsl(${hue}, 70%, 45%)`
}

function getEggGroupColor(group) {
  if (!group) return '#ffffff'
  const normalized = group.toLowerCase().replace(/[^a-z0-9]/g, '')
  const groupMap = {
    monster: TYPE_COLORS.dragon,
    plant: TYPE_COLORS.grass,
    grass: TYPE_COLORS.grass,
    bug: TYPE_COLORS.bug,
    water1: TYPE_COLORS.water,
    water2: TYPE_COLORS.water,
    water3: TYPE_COLORS.water,
    water: TYPE_COLORS.water,
    flying: TYPE_COLORS.flying,
    fairy: TYPE_COLORS.fairy,
    dragon: TYPE_COLORS.dragon,
    mineral: TYPE_COLORS.rock,
    amorphous: TYPE_COLORS.ghost,
    field: TYPE_COLORS.normal,
    ditto: TYPE_COLORS.normal,
    humanlike: TYPE_COLORS.psychic,
    humanoid: TYPE_COLORS.psychic,
  }
  if (normalized.startsWith('water')) {
    return TYPE_COLORS.water
  }
  return groupMap[normalized] || TYPE_COLORS[normalized] || '#ffffff'
}

function formatEncounterTime(time) {
  if (!time) return ''
  return time
    .replace(/SEASON0/g, '夏季')
    .replace(/SEASON1/g, '春季')
    .replace(/SEASON2/g, '秋季')
    .replace(/SEASON3/g, '冬季')
    .replace(/Summer/gi, '夏季')
    .replace(/Spring/gi, '春季')
    .replace(/Autumn|Fall/gi, '秋季')
    .replace(/Winter/gi, '冬季')
    .replace(/Any/gi, '不限')
}

function getGenderDistribution(genderRate, eggGroups = []) {
  const numericRate = Number(genderRate)
  const isGenderless = Number.isFinite(numericRate)
    && numericRate >= 255
    && eggGroups.some(group => String(group || '').toLowerCase() === 'genderless')

  if (!Number.isFinite(numericRate) || numericRate < 0 || isGenderless) {
    return {
      isGenderless: true,
      malePercent: 0,
      femalePercent: 0
    }
  }

  const clampedFemaleThreshold = Math.max(0, Math.min(255, Math.floor(numericRate)))
  const femalePercentRaw = (clampedFemaleThreshold / 255) * 100
  const malePercentRaw = ((255 - clampedFemaleThreshold) / 255) * 100

  // The game ratio uses a threshold out of 255; show percentages floored to 1 decimal.
  const toFlooredOneDecimal = (value) => Math.floor(value * 10) / 10

  return {
    isGenderless: false,
    malePercent: toFlooredOneDecimal(malePercentRaw),
    femalePercent: toFlooredOneDecimal(femalePercentRaw)
  }
}

function normalizeHordePercent(rarityValue, location = {}) {
  const text = String(rarityValue || '').trim()
  if (!text) return text

  const isHorde = location.is_horde_3x || location.is_horde_5x
  if (!isHorde) return text

  const match = text.match(/^(\d+(?:\.\d+)?)%$/)
  if (!match) return text

  const value = Number(match[1])
  if (!Number.isFinite(value)) return text
  if (value > 5) return text

  const normalized = (value / 5) * 100
  const normalizedText = Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(1).replace(/\.0$/, '')

  return `${normalizedText}%`
}

/**
 * Calculate combined type effectiveness for Pokemon with one or more types
 * Handles stacking weaknesses (2x + 2x = 4x), canceling resistances, and immunities
 * @param {Array<string>} types - Array of Pokemon types (e.g., ['fire', 'flying'])
 * @returns {Object} Organized effectiveness data with weak, resist, and immune arrays
 */
function calculateCombinedTypeEffectiveness(types) {
  if (!types || types.length === 0) {
    return {
      fourxWeak: [],
      twoXWeak: [],
      neutral: [],
      halfDmg: [],
      quarterDmg: [],
      immune: []
    }
  }

  const result = {
    fourxWeak: [],
    twoXWeak: [],
    neutral: [],
    halfDmg: [],
    quarterDmg: [],
    immune: []
  }

  Object.keys(TYPE_EFFECTIVENESS).forEach(attackType => {
    let multiplier = 1

    types.forEach(defenseType => {
      const typeData = TYPE_EFFECTIVENESS[defenseType.toLowerCase()]
      if (!typeData) return

      if (typeData.immune.includes(attackType)) {
        multiplier *= 0
      } else if (typeData.weak.includes(attackType)) {
        multiplier *= 2
      } else if (typeData.resists.includes(attackType)) {
        multiplier *= 0.5
      }
    })

    // Categorize final multiplier
    if (multiplier === 0) {
      result.immune.push(attackType)
    } else if (multiplier === 4) {
      result.fourxWeak.push(attackType)
    } else if (multiplier === 2) {
      result.twoXWeak.push(attackType)
    } else if (multiplier === 0.5) {
      result.halfDmg.push(attackType)
    } else if (multiplier === 0.25) {
      result.quarterDmg.push(attackType)
    } else {
      result.neutral.push(attackType)
    }
  })

  return result
}

/**
 * Get ability data from abilities-data.json
 * Converts ability name to slug format for lookup (e.g., "Flash Fire" -> "flash-fire")
 */
function getAbilityInfo(abilityName) {
  if (!abilityName) return null
  const slugName = abilityName.toLowerCase().replace(/\s+/g, '-')
  return abilitiesData[slugName] || null
}

/**
 * Format evolution details into a readable string
 */
function formatEvolutionDetails(details) {
  if (!details || details.length === 0) return '未知'
  
  const detail = details[0]
  
  // Special case for level-up with location requirement
  if (detail.trigger?.name === 'level-up' && detail.location?.name) {
    return '在对应岩石附近升级'
  }
  
  const parts = []
  
  if (detail.trigger?.name) {
    const triggerMap = {
      'level-up': '升级',
      'use-item': '使用道具',
      'trade': '交换',
      'shedding': '蜕壳',
      'spin': '旋转',
      'tower-of-darkness': '在恶之塔修行',
      'tower-of-waters': '在水之塔修行'
    }
    parts.push(triggerMap[detail.trigger.name] || detail.trigger.name)
  }
  
  if (detail.min_level) {
    parts.push(`达到 Lv.${detail.min_level}`)
  }
  
  if (detail.item?.name) {
    parts.push(`使用 ${detail.item.name.replace(/-/g, ' ')}`)
  }
  
  if (detail.held_item?.name) {
    parts.push(`携带 ${detail.held_item.name.replace(/-/g, ' ')}`)
  }
  
  if (detail.known_move) {
    parts.push(`习得 ${translateMoveName(detail.known_move)}`)
  }
  
  if (detail.min_happiness) {
    parts.push(`亲密度达到 ${detail.min_happiness}`)
  }
  
  if (detail.min_affection) {
    parts.push(`友好度达到 ${detail.min_affection}`)
  }
  
  if (detail.time_of_day && detail.time_of_day.length > 0) {
    const timeMap = { day: '白天', night: '夜晚', dusk: '黄昏' }
    parts.push(`在${timeMap[detail.time_of_day] || detail.time_of_day}`)
  }
  
  return parts.length > 0 ? parts.join(' ') : '未知'
}



// Pokemon with advanced branching evolutions
const BRANCHING_EVOLUTION_POKEMON = ['eevee', 'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon', 'tyrogue', 'hitmonlee', 'hitmonchan', 'hitmontop']

/**
 * Check if a Pokemon has branching evolutions
 */
function hasBranchingEvolutions(pokemonName) {
  return BRANCHING_EVOLUTION_POKEMON.includes(pokemonName?.toLowerCase())
}

/**
 * Count the number of evolutions in a linear chain
 */
function countLinearEvolutions(chainLink) {
  const buildChainArray = (link, arr = []) => {
    if (!link) return arr
    arr.push(link)
    if (link.evolves_to && link.evolves_to.length > 0) {
      return buildChainArray(link.evolves_to[0], arr)
    }
    return arr
  }
  return buildChainArray(chainLink).length
}

/**
 * Render simple linear evolution chain with basic branching support
 */
function renderEvolutionChainLinear(chainLink, navigate, currentPokemonName, hoveredEvolution, setHoveredEvolution) {
  if (!chainLink) return null
  
  // Build the chain array
  const buildChainArray = (link, arr = []) => {
    if (!link) return arr
    arr.push(link)
    if (link.evolves_to && link.evolves_to.length > 0) {
      return buildChainArray(link.evolves_to[0], arr)
    }
    return arr
  }
  
  const chainArray = buildChainArray(chainLink)
  
  // Find the index where branching occurs (if any)
  const branchingIndex = chainArray.findIndex(link => link.evolves_to && link.evolves_to.length > 1)
  
  return (
    <>
      {chainArray.map((link, index) => {
        // Stop rendering after we've shown the branching point
        if (branchingIndex !== -1 && index > branchingIndex) {
          return null
        }
        
        const hasSimpleBranch = link.evolves_to && link.evolves_to.length > 1
        const isCurrent = link.species?.name === currentPokemonName?.toLowerCase()
        const evolutionId = `linear-${index}-${link.species?.name}`
        
        return (
          <div key={link.species?.name} className={styles.linearEvolutionRow}>
            <button
              onClick={() => navigate(`/pokemon/${link.species.name}/`, { state: { fromPokemon: true } })}
              className={`${styles.chainPokemon} ${isCurrent ? styles.chainPokemonCurrent : ''}`}
              style={{ minWidth: '140px', padding: '0.75rem 1rem', fontSize: '0.9rem' }}
              title={`查看${translatePokemonName(link.species.name)}`}
              onMouseEnter={() => link.evolution_details && link.evolution_details.length > 0 && setHoveredEvolution(evolutionId)}
              onMouseLeave={() => setHoveredEvolution(null)}
            >
              <span className={styles.chainPokemonName}>
                {translatePokemonName(link.species.name)}
              </span>
              {link.evolution_details && link.evolution_details.length > 0 && (
                <span className={styles.chainCondition} style={{ maxWidth: '140px', fontSize: '0.7rem' }}>
                  {formatEvolutionDetails(link.evolution_details)}
                </span>
              )}
              {hoveredEvolution === evolutionId && link.evolution_details && link.evolution_details.length > 0 && (
                <div className={styles.evolutionTooltip}>
                  {formatEvolutionDetails(link.evolution_details)}
                </div>
              )}
            </button>
            
            {hasSimpleBranch ? (
              <>
                <span className={styles.evolutionArrow}>→</span>
                <div className={styles.simpleBranchedEvolutions}>
                  {link.evolves_to.map((branch) => {
                    const branchIsCurrent = branch.species?.name === currentPokemonName?.toLowerCase()
                    const branchEvolutionId = `linear-branch-${index}-${branch.species?.name}`
                    return (
                      <button
                        key={branch.species?.name}
                        onClick={() => navigate(`/pokemon/${branch.species.name}/`, { state: { fromPokemon: true } })}
                        className={`${styles.chainPokemon} ${branchIsCurrent ? styles.chainPokemonCurrent : ''}`}
                        style={{ minWidth: '140px', padding: '0.75rem 1rem', fontSize: '0.9rem' }}
                        title={`查看${translatePokemonName(branch.species.name)}`}
                        onMouseEnter={() => branch.evolution_details && branch.evolution_details.length > 0 && setHoveredEvolution(branchEvolutionId)}
                        onMouseLeave={() => setHoveredEvolution(null)}
                      >
                        <span className={styles.chainPokemonName}>
                          {translatePokemonName(branch.species.name)}
                        </span>
                        {branch.evolution_details && branch.evolution_details.length > 0 && (
                          <span className={styles.chainCondition} style={{ maxWidth: '140px', fontSize: '0.7rem' }}>
                            {formatEvolutionDetails(branch.evolution_details)}
                          </span>
                        )}
                        {hoveredEvolution === branchEvolutionId && branch.evolution_details && branch.evolution_details.length > 0 && (
                          <div className={styles.evolutionTooltip}>
                            {formatEvolutionDetails(branch.evolution_details)}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : index < branchingIndex || (branchingIndex === -1 && index < chainArray.length - 1) ? (
              <span className={styles.evolutionArrow}>→</span>
            ) : null}
          </div>
        )
      })}
    </>
  )
}

/**
 * Recursively render evolution chain horizontally with branching support
 */
function renderEvolutionChainHorizontal(chainLink, navigate, currentPokemonName, hoveredEvolution, setHoveredEvolution) {
  if (!chainLink) return null
  
  // Build the chain array following the first evolution path
  const buildChainArray = (link, arr = []) => {
    if (!link) return arr
    arr.push(link)
    if (link.evolves_to && link.evolves_to.length > 0) {
      return buildChainArray(link.evolves_to[0], arr)
    }
    return arr
  }
  
  const chainArray = buildChainArray(chainLink)
  
  // Find the index where branching occurs
  const branchingIndex = chainArray.findIndex(link => link.evolves_to && link.evolves_to.length > 1)
  
  return (
    <>
      {chainArray.map((link, index) => {
        // Stop rendering after we've shown the branching point
        if (branchingIndex !== -1 && index > branchingIndex) {
          return null
        }
        
        const isCurrent = link.species?.name === currentPokemonName?.toLowerCase()
        const hasBranches = link.evolves_to && link.evolves_to.length > 1
        const evolutionId = `horizontal-${index}-${link.species?.name}`
        
        return (
          <div key={link.species?.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
            <button
              onClick={() => navigate(`/pokemon/${link.species.name}/`, { state: { fromPokemon: true } })}
              className={`${styles.chainPokemon} ${isCurrent ? styles.chainPokemonCurrent : ''}`}
              style={{ minWidth: '140px', padding: '0.75rem 1rem', fontSize: '0.9rem' }}
              title={`查看${translatePokemonName(link.species.name)}`}
              onMouseEnter={() => link.evolution_details && link.evolution_details.length > 0 && setHoveredEvolution(evolutionId)}
              onMouseLeave={() => setHoveredEvolution(null)}
            >
              <span className={styles.chainPokemonName}>
                {translatePokemonName(link.species.name)}
              </span>
              {link.evolution_details && link.evolution_details.length > 0 && (
                <span className={styles.chainCondition} style={{ maxWidth: '140px', fontSize: '0.7rem' }}>
                  {formatEvolutionDetails(link.evolution_details)}
                </span>
              )}
              {hoveredEvolution === evolutionId && link.evolution_details && link.evolution_details.length > 0 && (
                <div className={styles.evolutionTooltip}>
                  {formatEvolutionDetails(link.evolution_details)}
                </div>
              )}
            </button>
            
            {hasBranches ? (
              <>
                <span className={styles.evolutionArrow}>→</span>
                <div className={styles.branchedEvolutions}>
                  {link.evolves_to.map((branch) => {
                    const branchIsCurrent = branch.species?.name === currentPokemonName?.toLowerCase()
                    const branchEvolutionId = `horizontal-branch-${index}-${branch.species?.name}`
                    return (
                      <button
                        key={branch.species?.name}
                        onClick={() => navigate(`/pokemon/${branch.species.name}/`, { state: { fromPokemon: true } })}
                        className={`${styles.chainPokemon} ${branchIsCurrent ? styles.chainPokemonCurrent : ''}`}
                        style={{ minWidth: '140px', padding: '0.75rem 1rem', fontSize: '0.9rem' }}
                        title={`查看${translatePokemonName(branch.species.name)}`}
                        onMouseEnter={() => branch.evolution_details && branch.evolution_details.length > 0 && setHoveredEvolution(branchEvolutionId)}
                        onMouseLeave={() => setHoveredEvolution(null)}
                      >
                        <span className={styles.chainPokemonName}>
                          {translatePokemonName(branch.species.name)}
                        </span>
                        {branch.evolution_details && branch.evolution_details.length > 0 && (
                          <span className={styles.chainCondition} style={{ maxWidth: '140px', fontSize: '0.7rem' }}>
                            {formatEvolutionDetails(branch.evolution_details)}
                          </span>
                        )}
                        {hoveredEvolution === branchEvolutionId && branch.evolution_details && branch.evolution_details.length > 0 && (
                          <div className={styles.evolutionTooltip}>
                            {formatEvolutionDetails(branch.evolution_details)}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : index < chainArray.length - 1 && branchingIndex === -1 ? (
              <span className={styles.evolutionArrow}>→</span>
            ) : null}
          </div>
        )
      })}
    </>
  )
}

/**
 * Calculate catch rate percentage for a given ball and HP condition
 * Gen 5 Formula: A = ((3 × MaxHP - 2 × CurrentHP) / (3 × MaxHP)) × BallRate × CatchRate × Status
 * @param {number} catchRate - Base catch rate (0-255)
 * @param {number} ballRate - Ball multiplier (e.g., 1.0 for Pokéball, 2.0 for Ultra Ball)
 * @param {number} hpPercent - Current HP as percentage (0-100)
 * @param {number} statusModifier - Status modifier (1.0 for no status, 1.5 for poison/burn/paralysis, 2.0 for sleep/freeze)
 * @returns {number} Catch percentage (0-100)
 */
function calculateCatchChance(catchRate, ballRate, hpPercent, statusModifier = 1.0) {
  // Convert HP percentage to multiplier
  // At 100% HP: (3M - 2M) / 3M = 1/3
  // At 1% HP: (3M - 2×0.01M) / 3M ≈ 0.993
  const hpMultiplier = (300 - (2 * hpPercent)) / 300
  
  // Calculate capture value (capped at 255)
  let captureValue = Math.floor(hpMultiplier * ballRate * catchRate * statusModifier)
  captureValue = Math.min(255, captureValue)
  
  // Convert to percentage
  return (captureValue / 255) * 100
}

/**
 * Calculate the best catch method considering catch rate, turns needed, and ball cost
 * Ball costs relative to Pokéball: Pokéball=1, Great=1.5, Ultra=2, Dusk=2.5
 * Turns needed: 100%HP=0, 1%HP=1, Sleep100%=1, Sleep1%=2
 */
function calculateBestCatchMethod(catchRate) {
  const ballCosts = {
    'Pokéball': 1,
    'Great Ball': 1.5,
    'Ultra Ball': 2,
    'Quick Ball': 2.25,
    'Dusk Ball': 2.5,
  }
  
  const methods = [
    { ball: 'Pokéball', ballRate: 1.0, hp: 100, turns: 0, statusMod: 1.0 },
    { ball: 'Pokéball', ballRate: 1.0, hp: 1, turns: 1, statusMod: 1.0 },
    { ball: 'Pokéball', ballRate: 1.0, hp: 100, turns: 1, statusMod: 2.0 },
    { ball: 'Pokéball', ballRate: 1.0, hp: 1, turns: 2, statusMod: 2.0 },
    
    { ball: 'Great Ball', ballRate: 1.5, hp: 100, turns: 0, statusMod: 1.0 },
    { ball: 'Great Ball', ballRate: 1.5, hp: 1, turns: 1, statusMod: 1.0 },
    { ball: 'Great Ball', ballRate: 1.5, hp: 100, turns: 1, statusMod: 2.0 },
    { ball: 'Great Ball', ballRate: 1.5, hp: 1, turns: 2, statusMod: 2.0 },
    
    { ball: 'Ultra Ball', ballRate: 2.0, hp: 100, turns: 0, statusMod: 1.0 },
    { ball: 'Ultra Ball', ballRate: 2.0, hp: 1, turns: 1, statusMod: 1.0 },
    { ball: 'Ultra Ball', ballRate: 2.0, hp: 100, turns: 1, statusMod: 2.0 },
    { ball: 'Ultra Ball', ballRate: 2.0, hp: 1, turns: 2, statusMod: 2.0 },
    
    { ball: 'Quick Ball', ballRate: 5.0, hp: 100, turns: 0, statusMod: 1.0 },
    { ball: 'Quick Ball', ballRate: 1.0, hp: 1, turns: 1, statusMod: 1.0 },
    { ball: 'Quick Ball', ballRate: 1.0, hp: 100, turns: 1, statusMod: 2.0 },
    { ball: 'Quick Ball', ballRate: 1.0, hp: 1, turns: 2, statusMod: 2.0 },
    
    { ball: 'Dusk Ball', ballRate: 2.5, hp: 100, turns: 0, statusMod: 1.0 },
    { ball: 'Dusk Ball', ballRate: 2.5, hp: 1, turns: 1, statusMod: 1.0 },
    { ball: 'Dusk Ball', ballRate: 2.5, hp: 100, turns: 1, statusMod: 2.0 },
    { ball: 'Dusk Ball', ballRate: 2.5, hp: 1, turns: 2, statusMod: 2.0 },
  ]
  
  let bestMethod = null
  let secondBestMethod = null
  let bestScore = -Infinity
  let secondBestScore = -Infinity
  
  methods.forEach(method => {
    const catchChance = calculateCatchChance(catchRate, method.ballRate, method.hp, method.statusMod)
    const costFactor = ballCosts[method.ball]
    
    // Score: catch rate / (turns + cost factor)
    // Higher catch rate is better, fewer turns is better, lower cost is better
    const score = catchChance / (method.turns + costFactor)
    
    if (score > bestScore) {
      // Shift best to second best
      secondBestScore = bestScore
      secondBestMethod = bestMethod
      
      // New best
      bestScore = score
      bestMethod = {
        ...method,
        catchChance,
        score,
        hpLabel: method.hp === 100 ? '100% HP' : '1% HP',
        statusLabel: method.statusMod === 2.0 ? 'Sleep' : 'Normal'
      }
    } else if (score > secondBestScore) {
      secondBestScore = score
      secondBestMethod = {
        ...method,
        catchChance,
        score,
        hpLabel: method.hp === 100 ? '100% HP' : '1% HP',
        statusLabel: method.statusMod === 2.0 ? 'Sleep' : 'Normal'
      }
    }
  })
  
  return { bestMethod, secondBestMethod }
}

function translateBallName(ball) {
  return {
    'Pokéball': '精灵球',
    'Great Ball': '超级球',
    'Ultra Ball': '高级球',
    'Quick Ball': '先机球',
    'Dusk Ball': '黑暗球',
    'Timer Ball': '计时球',
    'Safari Ball': '狩猎球',
  }[ball] || ball
}

export default function PokemonDetail() {
  const { pokemonName } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: pokemon, isLoading, error } = usePokemonDetails(pokemonName)
  const { data: databaseData } = useDatabase()
  const { allPokemon, getNextPokemon, getPreviousPokemon } = usePokemonOrder()
  const spritesByGeneration = usePokemonSprites(pokemonName)
  const availableForms = usePokemonForms(pokemonName)
  const [selectedGeneration, setSelectedGeneration] = useState('generation-v')
  const [currentSpriteIndex, setCurrentSpriteIndex] = useState(0)
  const [selectedForm, setSelectedForm] = useState(null)
  const [selectedGender, setSelectedGender] = useState('male')
  const [loadedSpriteUrl, setLoadedSpriteUrl] = useState('')
  const [showBack, setShowBack] = useState(false)
  const [wildLevel, setWildLevel] = useState('')
  const [routeSearch, setRouteSearch] = useState('')
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [showRoutesSuggestions, setShowRoutesSuggestions] = useState(false)
  const [particleAnimationKey, setParticleAnimationKey] = useState(0)
  const [audioRef] = useState(new Audio())
  const [hoveredAbility, setHoveredAbility] = useState(null)
  const [hoveredEvolution, setHoveredEvolution] = useState(null)
  const [pokemonSearch, setPokemonSearch] = useState('')
  const pokemonSuggestions = useMemo(
    () => allPokemon.map(n => n.charAt(0).toUpperCase() + n.slice(1)),
    [allPokemon]
  )
  const [maxWildLevel, setMaxWildLevel] = useState(0)
  const [branchCount, setBranchCount] = useState(0)
  const evolutionContainerRef = useRef(null)
  const spriteAliasMap = useMemo(() => ({
    wormadam: 'wormadam-plant',
    'gastrodon-west': 'gastrodon',
    'shellos-west': 'shellos',
    shaymin: 'shaymin-land'
  }), [])
  const spriteName = spriteAliasMap[pokemonName?.toLowerCase()] || pokemonName

  // Calculate branch count from evolution chain (only for branching Pokemon)
  useEffect(() => {
    if (!hasBranchingEvolutions(pokemon?.name)) {
      setBranchCount(0)
      return
    }
    
    if (!pokemon?.evolution_chain?.chain) {
      setBranchCount(0)
      return
    }
    
    // Find the branching point
    const findBranchingLink = (link) => {
      if (!link) return null
      if (link.evolves_to && link.evolves_to.length > 1) return link
      if (link.evolves_to && link.evolves_to.length > 0) {
        return findBranchingLink(link.evolves_to[0])
      }
      return null
    }
    
    const branchingLink = findBranchingLink(pokemon.evolution_chain.chain)
    const maxBranches = branchingLink?.evolves_to?.length || 0
    setBranchCount(maxBranches)
  }, [pokemon?.evolution_chain, pokemon?.name])

  // Calculate and resize evolution cards to fit in container without overflow (only for branching Pokemon)
  useEffect(() => {
    if (!hasBranchingEvolutions(pokemon?.name) || !evolutionContainerRef.current || branchCount === 0) return
    
    // Skip height calculation on mobile - let content flow naturally
    if (window.innerWidth <= 480) return
    
    const container = evolutionContainerRef.current
    const evolutionSection = container.parentElement
    
    if (!evolutionSection) return
    
    // Get the actual available height by measuring the section minus the title
    const sectionHeight = evolutionSection.clientHeight
    const cardTitleElement = evolutionSection.querySelector(`.${styles.cardTitle}`)
    const cardTitleHeight = cardTitleElement ? cardTitleElement.clientHeight : 50 // fallback to 50px if not found
    
    // Calculate the gap between title and container
    const sectionPadding = 16 // infoCard padding (1rem)
    const titleBottomGap = 12 // gap between title and container
    
    // Available height = section height - title - section padding - gap
    const availableHeight = sectionHeight - cardTitleHeight - sectionPadding * 2 - titleBottomGap
    
    // Gap between evolution cards
    const gapBetweenCards = 6 // 0.375rem gap in CSS = 6px
    
    // Total gap space (gaps = branchCount - 1)
    const totalGapSpace = gapBetweenCards * Math.max(0, branchCount - 1)
    
    // Container internal padding
    const containerPaddingVertical = 12 // 0.75rem = 12px top and bottom
    
    // Height per card
    const cardHeight = Math.floor((availableHeight - containerPaddingVertical * 2 - totalGapSpace) / branchCount)
    
    // Set CSS variable - use max-height to prevent overflow
    container.style.setProperty('--evolution-card-height', `${Math.max(cardHeight, 35)}px`);
  }, [branchCount, pokemon?.evolution_chain]);
  
  // Reset sprite index and form when pokemon changes
  useEffect(() => {
    setCurrentSpriteIndex(0)
    setSelectedForm(pokemonName)
    setSelectedGeneration('generation-v')
    setSelectedGender('male')
    setShowBack(false)
  }, [pokemonName])

  // Redirect to canonical form URL if needed
  useEffect(() => {
    if (!pokemon || !pokemonName) return

    const aliasMap = {
      shaymin: 'shaymin-land',
      meloetta: 'meloetta-aria',
      keldeo: 'keldeo-ordinary',
      tornadus: 'tornadus-incarnate',
      thundurus: 'thundurus-incarnate',
      landorus: 'landorus-incarnate',
      wormadam: 'wormadam-plant',
      deoxys: 'deoxys-normal'
    }

    const pokemonLower = pokemonName.toLowerCase()
    if (aliasMap[pokemonLower]) {
      const canonicalForm = aliasMap[pokemonLower]
      navigate(`/pokemon/${canonicalForm}/`, { replace: true, state: { fromPokemon: true } })
    }
  }, [pokemon, pokemonName, navigate])
  
  // Reset sprite index when generation changes
  useEffect(() => {
    setCurrentSpriteIndex(0)
    setSelectedGender('male')
    setShowBack(false)
  }, [selectedGeneration])
  
  useEffect(() => {
    setLoadedSpriteUrl('')
  }, [pokemonName, currentSpriteIndex])

  // Trigger shiny particle animation twice on page load
  useEffect(() => {
    // Reset to 0 to ensure particle unmounts completely
    setParticleAnimationKey(0)
    
    // Small delay to ensure React processes the unmount
    const resetTimer = setTimeout(() => {
      // First animation plays immediately
      setParticleAnimationKey(1)
      
      // Second animation after first completes (1000ms + 100ms buffer)
      const secondTimer = setTimeout(() => {
        setParticleAnimationKey(2)
      }, 1150)
      
      return () => clearTimeout(secondTimer)
    }, 10)
    
    return () => {
      clearTimeout(resetTimer)
    }
  }, [pokemonName])

  // Calculate max wild level from locations
  useEffect(() => {
    if (!pokemon?.locations || pokemon.locations.length === 0) {
      setMaxWildLevel(0)
      return
    }
    
    const maxLevel = Math.max(...pokemon.locations.map(loc => loc.max_level || 0))
    setMaxWildLevel(maxLevel)
  }, [pokemon?.locations])

  // Get owners of this pokemon from the database
  const owners = useMemo(() => {
    if (!databaseData || !pokemonName) return {}
    
    const ownerMap = {}
    const pokemonLower = pokemonName.toLowerCase()
    
    Object.entries(databaseData).forEach(([playerName, playerData]) => {
      Object.values(playerData.shinies || {}).forEach(shinyEntry => {
        if (shinyEntry.Pokemon.toLowerCase() === pokemonLower) {
          // Don't count sold pokemon
          if (shinyEntry.Sold?.toLowerCase() !== 'yes') {
            if (!ownerMap[playerName]) {
              ownerMap[playerName] = 0
            }
            ownerMap[playerName]++
          }
        }
      })
    })
    
    return ownerMap
  }, [databaseData, pokemonName])

  // Get animated shiny sprite for OG image (from JSON data)
  const animatedShinyGif = useMemo(() => {
    const allGenerations = Object.keys(spritesByGeneration).sort()
    if (allGenerations.length > 0) {
      const firstGen = spritesByGeneration[allGenerations[0]]
      if (firstGen && firstGen.length > 0 && firstGen[0]?.url) {
        return firstGen[0].url
      }
    }
    return 'https://b1aoo.github.io/team-site/images/openGraph.jpg'
  }, [spritesByGeneration])

  const safariLocations = useMemo(() => {
    if (!pokemonName) return []
    const results = []
  const REGION_LABELS = { kanto: '关都', johto: '城都', hoenn: '丰缘', sinnoh: '神奥' }
    const lookupName = pokemonName.toLowerCase()
    Object.entries(safariData).forEach(([region, data]) => {
      if (!data) return
      const regionLabel = REGION_LABELS[region] || region
      if (data.universalPokemon) {
        const match = data.universalPokemon.find(p => p.name.toLowerCase() === lookupName)
        if (match) {
          results.push({ region: regionLabel, area: '全区域', encounterType: match.encounterType })
        }
      } else if (data.areas) {
        data.areas.forEach(area => {
          const match = (area.pokemon || []).find(p => p.name.toLowerCase() === lookupName)
          if (match) {
            results.push({ region: regionLabel, area: area.name, encounterType: match.encounterType })
          }
        })
      }
    })
    return results
  }, [pokemonName])

const formatEggGroupName = (group) => translateEggGroupName(group)

const formatTypes = (types) =>
  types?.map(translateTypeName).join(' / ') || '未知'

const formatEggGroups = (eggs) =>
  eggs?.length ? eggs.map(formatEggGroupName).join(' / ') : '未知'

const buildDescription = (pokemon) => {
  if (!pokemon) return '查看 PokeMMO 闪光图鉴中的宝可梦资料。'

  const name = translatePokemonName(pokemon.displayName)
  const types = formatTypes(pokemon.types)
  const eggGroups = formatEggGroups(pokemon.eggGroups)

  return `${name}的 PokeMMO 图鉴资料：属性为${types}，蛋组为${eggGroups}。查看出没地点、刷闪信息与稀有度分层。`
}

const breadcrumbs = pokemon ? [
  { name: '首页', url: '/' },
  { name: 'PokeMMO 宝可梦图鉴', url: '/pokedex' },
  { name: translatePokemonName(pokemon.displayName), url: `/pokemon/${pokemonName?.toLowerCase()}/` }
] : [
  { name: '首页', url: '/' },
  { name: 'PokeMMO 宝可梦图鉴', url: '/pokedex' }
]

useDocumentHead({
  title: pokemon
    ? `${translatePokemonName(pokemon.displayName)}｜PokeMMO 刷闪与出没地点`
    : '宝可梦详情｜PokeMMO 闪光图鉴',

  description: buildDescription(pokemon),

  canonicalPath: `/pokemon/${pokemonName?.toLowerCase()}/`,

  url: `https://b1aoo.github.io/team-site/pokemon/${pokemonName?.toLowerCase()}/`,

  ogImage: animatedShinyGif,

  twitterCard: "summary_large_image",

  twitterTitle: pokemon
    ? `${translatePokemonName(pokemon.displayName)}｜PokeMMO 刷闪与出没地点`
    : '宝可梦详情｜PokeMMO 闪光图鉴',

  twitterDescription: buildDescription(pokemon),

  twitterImage: animatedShinyGif,

  breadcrumbs: breadcrumbs
});




  if (isLoading) {
    return (
      <div className={styles.container}>
        <BackButton to={location.state?.fromPokemon ? '/pokedex' : '/pokedex'} />
        <div className={styles.loadingMessage}>正在加载宝可梦资料…</div>
      </div>
    )
  }

  if (error) {
    const errorMessage = '暂时无法加载宝可梦资料。'
    
    return (
      <div className={styles.container}>
        <BackButton to={location.state?.fromPokemon ? '/pokedex/' : '/pokedex/'} />
        <div className={styles.errorMessage}>
          <h2>⚠️ 无法加载宝可梦</h2>
          <p className={styles.errorDescription}>
            {errorMessage}
          </p>
          <div className={styles.suggestions}>
            <p><strong>你可以尝试：</strong></p>
            <ul>
              <li>确认宝可梦名称和链接拼写正确。</li>
              <li>使用小写英文标识并以连字符分隔，例如 “mr-mime”。</li>
              <li>在<button onClick={() => navigate('/pokedex/')} className={styles.linkButton} style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', textDecoration: 'underline' }}>宝可梦图鉴</button>中重新搜索。</li>
              <li>若问题持续出现，请稍后再试。</li>
            </ul>
          </div>
          <button onClick={() => navigate('/pokedex/')} className={styles.linkButton}>
            返回宝可梦图鉴
          </button>
        </div>
      </div>
    )
  }

  if (!pokemon) return null

  const primaryType = pokemon.types[0]
  const typeColor = TYPE_COLORS[primaryType] || '#777'
  
  // Get available generations and determine active generation
  const availableGenerations = Object.keys(spritesByGeneration).sort()
  // Use selectedGeneration if available, otherwise prefer generation-v, fallback to first available
  let activeGeneration = selectedGeneration
  if (!availableGenerations.includes(activeGeneration)) {
    activeGeneration = availableGenerations.includes('generation-v') 
      ? 'generation-v'
      : availableGenerations[0]
  }
  
  const currentGenerationSprites = spritesByGeneration[activeGeneration] || []
  
  // Filter sprites by gender
  const filteredSprites = currentGenerationSprites.filter(sprite => {
    if (selectedGender === 'female') {
      return sprite.label.includes('(Female)')
    }
    return !sprite.label.includes('(Female)')
  })
  
  // Check if female variants are available in current generation
  const hasFemaleVariants = currentGenerationSprites.some(sprite => sprite.label.includes('(Female)'))
  
  // Reset sprite index if it's out of bounds after filtering
  const validSpriteIndex = Math.min(currentSpriteIndex, filteredSprites.length - 1) 
  
  // Get next/previous pokemon for navigation
  const nextPokemon = getNextPokemon(pokemonName)
  const prevPokemon = getPreviousPokemon(pokemonName)
  const currentSprite = (filteredSprites.length > 0 && filteredSprites[validSpriteIndex])
    ? filteredSprites[validSpriteIndex]
    : { url: pokemon.sprite, label: pokemon.displayName, type: 'png', backUrl: pokemon.sprite }
  const currentSpriteUrl = showBack ? (currentSprite?.backUrl || currentSprite?.url) : currentSprite?.url
  const isSpriteLoaded = loadedSpriteUrl === currentSpriteUrl
  const genderDistribution = getGenderDistribution(pokemon.genderRate, pokemon.eggGroups)
  
  const handlePrevious = () => {
    if (prevPokemon) {
      navigate(`/pokemon/${prevPokemon}/`, { state: { fromPokemon: true } })
    }
  }
  
  const handleNext = () => {
    if (nextPokemon) {
      navigate(`/pokemon/${nextPokemon}/`, { state: { fromPokemon: true } })
    }
  }

  const playCry = () => {
    if (pokemon.cries && (pokemon.cries.latest || pokemon.cries.legacy)) {
      const cryUrl = pokemon.cries.latest || pokemon.cries.legacy
      audioRef.src = cryUrl
      audioRef.volume = 0.25
      audioRef.play().catch(err => console.error('Error playing cry:', err))
    }
  }

  const wildLevelValue = Number.parseInt(wildLevel, 10)
  const hasWildLevel = Number.isFinite(wildLevelValue) && wildLevelValue > 0

  const fromPage = location.state?.from
  const backTo = fromPage === 'shotm' ? '/shotm/' : fromPage === 'LnyCatchCalc' ? '/LnyCatchCalc/' : fromPage === 'shiny-war-2025/' ? '/shiny-war-2025/' : fromPage === 'pokemon/' ? -1 : '/pokedex/'
  const backLabel = fromPage === 'shotm' ? '← 返回本月闪光' : fromPage === 'LnyCatchCalc' ? '← 返回农历新年捕捉计算器' : fromPage === 'shiny-war-2025' ? '← 返回闪光大战 2025' : fromPage === 'pokemon' ? '← 返回宝可梦' : '← 返回收藏展示'

  return (
    <article className={styles.container}>
      <BackButton to={backTo} label={backLabel} />

      <div className={styles.pokemonSearchBar}>
        <SearchBar
          value={pokemonSearch}
          onChange={setPokemonSearch}
          placeholder="搜索宝可梦…"
          suggestions={pokemonSuggestions}
          onSuggestionSelect={(suggestion) => {
            setPokemonSearch('')
            navigate(`/pokemon/${suggestion.toLowerCase()}/`, { state: { from: 'pokemon' } })
          }}
        />
      </div>

      <header className={styles.header}>
        <button
          className={styles.navArrow}
          onClick={handlePrevious}
          disabled={!prevPokemon}
          title="上一只宝可梦"
          aria-label="上一只宝可梦"
        >
          ❮
        </button>
        <div className={styles.titleContainer}>
          <h1 className={styles.title}>{translatePokemonName(pokemon.displayName)}</h1>
          <span className={styles.pokemonId}>#{String(pokemon.id).padStart(3, '0')}</span>
          {(pokemon.isLegendary || pokemon.isMythical) && !pokemon.obtainable && (
            <div className={styles.unobtainableLabel}>暂不可获得</div>
          )}
        </div>
        <button
          className={styles.navArrow}
          onClick={handleNext}
          disabled={!nextPokemon}
          title="下一只宝可梦"
          aria-label="下一只宝可梦"
        >
          ❯
        </button>
      </header>

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>
        {/* Image Section */}
        <section className={styles.imageSection}>
          <div className={styles.imageContainer}>
            <div className={styles.imageWrapper}>
              {filteredSprites.length > 0 ? (
                <picture>
                  {currentSprite.type === 'gif' ? (
                    <source srcSet={currentSpriteUrl} type="image/gif" />
                  ) : (
                    <source srcSet={currentSpriteUrl} type="image/png" />
                  )}
                  <img
                    key={currentSpriteUrl}
                    src={currentSpriteUrl}
                    alt={`${translatePokemonName(pokemon.displayName)}－${currentSprite.label}`}
                    className={`${styles.pokemonImage} ${isSpriteLoaded ? styles.pokemonImageLoaded : styles.pokemonImageLoading}`}
                    onLoad={() => setLoadedSpriteUrl(currentSpriteUrl)}
                    loading="lazy"
                  />
                </picture>
              ) : (
                <picture>
                  <source srcSet={pokemon.sprite} type="image/png" />
                  <img
                    key={currentSpriteUrl}
                    src={pokemon.sprite}
                    alt={translatePokemonName(pokemon.displayName)}
                    className={`${styles.pokemonImage} ${isSpriteLoaded ? styles.pokemonImageLoaded : styles.pokemonImageLoading}`}
                    onLoad={() => setLoadedSpriteUrl(currentSpriteUrl)}
                    loading="lazy"
                  />
                </picture>
              )}
              {pokemon.cries && (pokemon.cries.latest || pokemon.cries.legacy) && (
                <button
                  onClick={playCry}
                  className={styles.volumeButton}
                  title="播放宝可梦叫声"
                  aria-label={`播放${translatePokemonName(pokemon.displayName)}的叫声`}
                >
                  🔊
                </button>
              )}
              {currentSprite?.backUrl && currentSprite.backUrl !== currentSprite?.url && (
                <button
                  onClick={() => setShowBack(!showBack)}
                  className={styles.reverseButton}
                  title={showBack ? '显示正面图像' : '显示背面图像'}
                  aria-label={showBack ? '显示正面图像' : '显示背面图像'}
                >
                  🔄
                </button>
              )}
              {particleAnimationKey > 0 && (
                <img
                  key={`particle-${particleAnimationKey}`}
                  src={`${getAssetUrl('images/shiny_particle.gif')}?t=${particleAnimationKey}`}
                  alt="闪光粒子特效"
                  className={styles.shinyParticle}
                  aria-hidden="true"
                />
              )}
            </div>
            {availableForms.length > 1 && (
              <div className={styles.formSelector}>
                <label className={styles.formSelectorLabel}>可选形态：</label>
                <div className={styles.formOptions}>
                  {availableForms.map((form) => (
                    <button
                      key={form.name}
                      className={`${styles.formButton} ${selectedForm === form.name ? styles.formButtonActive : ''}`}
                      onClick={() => {
                        setSelectedForm(form.name)
                        setCurrentSpriteIndex(0)
                        navigate(`/pokemon/${form.name}/`, { state: { fromPokemon: true } })
                      }}
                      title={form.label}
                    >
                      {form.displayLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(availableGenerations.length > 1 || filteredSprites.length > 1) && (
              <div className={styles.spriteNavigationContainer}>
                {availableGenerations.length > 1 && (
                  <div className={styles.generationSelector}>
                    <label className={styles.generationLabel}>世代：</label>
                    <select 
                      value={activeGeneration} 
                      onChange={(e) => setSelectedGeneration(e.target.value)}
                      className={styles.generationSelect}
                    >
                      {availableGenerations.map((gen) => (
                        <option key={gen} value={gen}>
                          {`第 ${gen.replace('generation-', '').toUpperCase()} 世代`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {hasFemaleVariants && availableGenerations.includes('generation-v') && (
                  <div className={styles.genderSelector}>
                    <label className={styles.genderLabel}>性别：</label>
                    <div className={styles.genderButtons}>
                      <button
                        className={`${styles.genderButton} ${selectedGender === 'male' ? styles.genderButtonActive : ''}`}
                        onClick={() => setSelectedGender('male')}
                        title="雄性形态"
                      >
                        ♂ 雄性
                      </button>
                      <button
                        className={`${styles.genderButton} ${selectedGender === 'female' ? styles.genderButtonActive : ''}`}
                        onClick={() => setSelectedGender('female')}
                        title="雌性形态"
                      >
                        ♀ 雌性
                      </button>
                    </div>
                  </div>
                )}
                
                {filteredSprites.length > 1 && (
                  <div className={styles.spriteNavigation}>
                    <button
                      className={styles.spriteButton}
                      onClick={() => setCurrentSpriteIndex((prev) => (prev === 0 ? filteredSprites.length - 1 : prev - 1))}
                      title="上一张图像"
                      aria-label="上一张图像"
                    >
                      ❮
                    </button>
                    <span className={styles.spriteLabel}>
                      {filteredSprites[validSpriteIndex]?.label} ({validSpriteIndex + 1}/{filteredSprites.length})
                    </span>
                    <button
                      className={styles.spriteButton}
                      onClick={() => setCurrentSpriteIndex((prev) => (prev === filteredSprites.length - 1 ? 0 : prev + 1))}
                      title="下一张图像"
                      aria-label="下一张图像"
                    >
                      ❯
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Basic Info */}
          <div className={styles.basicInfo}>
            <div className={styles.infoRow}>
              <span className={styles.label}>身高</span>
              <span className={styles.value}>{pokemon.height.toFixed(2)}m</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>体重</span>
              <span className={styles.value}>{pokemon.weight.toFixed(2)}kg</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>世代</span>
              <span className={styles.value}>
                {`第 ${pokemon.generation.replace('generation-', '').toUpperCase()} 世代`}
              </span>
            </div>
            {/* Gender Ratio */}
            {pokemon.genderRate !== undefined && (
              <div className={styles.basicInfoGenderSection}>
                <span className={styles.basicInfoGenderLabel}>性别比例</span>
                {genderDistribution.isGenderless ? (
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem' }}>无性别</div>
                ) : (
                  <div className={styles.basicInfoGender}>
                    <div className={styles.basicInfoGenderRow}>
                      <span className={styles.basicInfoGenderLabel2}>♂ 雄性</span>
                      <div className={styles.basicInfoGenderBar}>
                        <div 
                          className={styles.basicInfoGenderFill} 
                          style={{
                            width: `${genderDistribution.malePercent}%`,
                            backgroundColor: '#667eea'
                          }}
                        />
                      </div>
                      <span className={styles.basicInfoGenderPercent}>{genderDistribution.malePercent.toFixed(1)}%</span>
                    </div>
                    <div className={styles.basicInfoGenderRow}>
                      <span className={styles.basicInfoGenderLabel2}>♀ 雌性</span>
                      <div className={styles.basicInfoGenderBar}>
                        <div 
                          className={styles.basicInfoGenderFill} 
                          style={{
                            width: `${genderDistribution.femalePercent}%`,
                            backgroundColor: '#f085b3'
                          }}
                        />
                      </div>
                      <span className={styles.basicInfoGenderPercent}>{genderDistribution.femalePercent.toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* EV Yields */}
            {pokemon.evYields && pokemon.evYields.length > 0 && (
              <div className={styles.basicInfoEVSection}>
                <span className={styles.basicInfoEVLabel}>努力值</span>
                <div className={styles.basicInfoEVs}>
                  {pokemon.evYields.map((ev, index) => (
                    <div key={index} className={styles.basicInfoEVRow}>
                      <span className={styles.basicInfoEVStat}>{ev.stat}</span>
                      <span className={styles.basicInfoEVValue}>+{ev.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Evolution Line */}
          {pokemon.evolution_chain?.chain && (
            <div className={`${styles.infoCard} ${styles.evolutionSection}`}>
              <h2 className={styles.cardTitle}>进化链</h2>
              <div 
                className={`${styles.evolutionLineContainerHorizontal} ${hasBranchingEvolutions(pokemon?.name) ? styles.evolutionLineContainerBranching : styles.evolutionLineContainerLinear} ${!hasBranchingEvolutions(pokemon?.name) && countLinearEvolutions(pokemon.evolution_chain.chain) <= 2 ? styles.evolutionSmall : ''}`} 
                ref={hasBranchingEvolutions(pokemon?.name) ? evolutionContainerRef : null}
              >
                {hasBranchingEvolutions(pokemon?.name) 
                  ? renderEvolutionChainHorizontal(pokemon.evolution_chain.chain, navigate, pokemon.name, hoveredEvolution, setHoveredEvolution)
                  : renderEvolutionChainLinear(pokemon.evolution_chain.chain, navigate, pokemon.name, hoveredEvolution, setHoveredEvolution)
                }
              </div>
            </div>
          )}
        </section>

        {/* Details Section */}
        <section className={styles.detailsSection}>
          {/* Types */}
          <div className={styles.infoCard}>
            <h2 className={styles.cardTitle}>属性</h2>
            <div className={styles.typeContainer}>
              {pokemon.types.map(type => (
                <span
                  key={type}
                  className={styles.type}
                  style={{ backgroundColor: TYPE_COLORS[type] }}
                >
                  {translateTypeName(type)}
                </span>
              ))}
            </div>
          </div>

          {/* Abilities */}

        <div className={styles.infoCard}> <h2 className={styles.cardTitle}>特性</h2>

        <div className={styles.abilityContainer}>

        {/* Normal Abilities */}
        {pokemon.abilities?.normal?.length > 0 && (
          <div>
            <h3 className={styles.abilitySubtitle}>普通特性</h3>

            <ul className={styles.abilityList}>
              {pokemon.abilities.normal.map((ability, index) => {
                const abilityName = ability || ''
                const abilityInfo = getAbilityInfo(abilityName)

                const displayName = translateAbilityName(abilityName)

                return (
                  <li
                    key={`normal-${abilityName}-${index}`}
                    className={styles.abilityItem}
                    onMouseEnter={() => setHoveredAbility(abilityName)}
                    onMouseLeave={() => setHoveredAbility(null)}
                  >
                    {displayName}

                    {hoveredAbility === abilityName && abilityInfo && (
                      <div className={styles.abilityTooltip}>
                        {abilityInfo.effect ? '特性说明暂未收录中文版本。' : ''}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Hidden Ability */}
        {pokemon.abilities?.hidden?.length > 0 && (
          <div>
            <h3 className={styles.abilitySubtitle}>隐藏特性</h3>

            <ul className={styles.abilityList}>
              {pokemon.abilities.hidden.map((ability, index) => {
                const abilityName = ability || ''
                const abilityInfo = getAbilityInfo(abilityName)

                const displayName = translateAbilityName(abilityName)

                return (
                  <li
                    key={`hidden-${abilityName}-${index}`}
                    className={`${styles.hiddenAbility} ${styles.abilityItem}`}
                    onMouseEnter={() => setHoveredAbility(abilityName)}
                    onMouseLeave={() => setHoveredAbility(null)}
                  >
                    {displayName} ✨

                    {hoveredAbility === abilityName && abilityInfo && (
                      <div className={styles.abilityTooltip}>
                        {abilityInfo.effect ? '特性说明暂未收录中文版本。' : ''}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        </div> </div>

          {/* Stats */}
          <div className={styles.infoCard}>
            <h2 className={styles.cardTitle}>种族值</h2>
            <div className={styles.statsContainer}>
              {[
                { label: 'HP', value: pokemon.stats.hp },
                { label: 'ATK', value: pokemon.stats.attack },
                { label: 'DEF', value: pokemon.stats.defense },
                { label: 'SP.ATK', value: pokemon.stats.spAtk },
                { label: 'SP.DEF', value: pokemon.stats.spDef },
                { label: 'SPD', value: pokemon.stats.speed },
              ].map(stat => {
                const statColor = getStatColor(stat.value)

                return (
                  <div key={stat.label} className={styles.statRow}>
                    <span className={styles.statLabel} style={{ color: statColor }}>{stat.label}</span>
                    <div className={styles.statBarContainer}>
                      <div
                        className={styles.statBar}
                        style={{
                          width: `${(stat.value / 200) * 100}%`,
                          backgroundColor: statColor,
                          color: statColor,
                        }}
                      />
                    </div>
                    <span className={styles.statValue} style={{ color: statColor }}>{stat.value}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Type Effectiveness */}
          <div className={styles.infoCard}>
            <h2 className={styles.cardTitle}>属性相性</h2>
            {(() => {
              const combined = calculateCombinedTypeEffectiveness(pokemon.types)
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {combined.fourxWeak.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>4 倍弱点：</span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {combined.fourxWeak.map(type => (
                          <span key={type} style={{ padding: '0.4rem 0.8rem', background: 'rgba(239, 68, 68, 0.3)', border: '2px solid rgba(239, 68, 68, 0.7)', borderRadius: '6px', fontSize: '0.9rem', fontWeight: '600', color: '#fca5a5', textTransform: 'capitalize' }}>
                            {translateTypeName(type)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {combined.twoXWeak.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>弱点：</span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {combined.twoXWeak.map(type => (
                          <span key={type} style={{ padding: '0.4rem 0.8rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '6px', fontSize: '0.9rem', color: '#fca5a5', textTransform: 'capitalize' }}>
                            {translateTypeName(type)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {combined.halfDmg.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>抗性（伤害减半）：</span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {combined.halfDmg.map(type => (
                          <span key={type} style={{ padding: '0.4rem 0.8rem', background: 'rgba(74, 222, 128, 0.2)', border: '1px solid rgba(74, 222, 128, 0.5)', borderRadius: '6px', fontSize: '0.9rem', color: '#86efac', textTransform: 'capitalize' }}>
                            {translateTypeName(type)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {combined.quarterDmg.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>强抗性（伤害为 1/4）：</span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {combined.quarterDmg.map(type => (
                          <span key={type} style={{ padding: '0.4rem 0.8rem', background: 'rgba(74, 222, 128, 0.3)', border: '2px solid rgba(74, 222, 128, 0.7)', borderRadius: '6px', fontSize: '0.9rem', fontWeight: '600', color: '#86efac', textTransform: 'capitalize' }}>
                            {translateTypeName(type)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {combined.immune.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>免疫：</span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {combined.immune.map(type => (
                          <span key={type} style={{ padding: '0.4rem 0.8rem', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.5)', borderRadius: '6px', fontSize: '0.9rem', color: '#d8b4fe', textTransform: 'capitalize' }}>
                            {translateTypeName(type)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Breeding & Catch Info */}
          <div className={styles.infoCard}>
            <h2 className={styles.cardTitle}>孵化与捕捉信息</h2>
            <div className={styles.additionalInfo}>
              <div className={styles.infoGroup}>
                <span className={styles.label}>蛋组</span>
                {pokemon.eggGroups.length > 0 ? (
                  <div className={styles.eggGroupList}>
                    {pokemon.eggGroups.map((group) => {
                      const groupColor = getEggGroupColor(group)
                      return (
                        <span
                          key={group}
                          className={styles.eggGroupTag}
                          style={{ '--egg-color': groupColor }}
                        >
                          {formatEggGroupName(group)}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <span className={styles.eggGroupNone}>无</span>
                )}
              </div>

              <div className={styles.infoGroup}>
                <span className={styles.label}>经验成长</span>
                <span className={styles.value}>{({ slow: '慢', medium: '中等', fast: '快', 'medium-slow': '中慢', erratic: '不定形', fluctuating: '波动' })[pokemon.growthRate] || '未知'}</span>
              </div>
              <div className={styles.infoGroup}>
                <span className={styles.label}>闪光分层</span>
                <span className={styles.value} style={{ color: TIER_COLORS[pokemon.shinyTier] ?? '#94a3b8' }}>第 {pokemon.shinyTier} 阶</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Owners */}
      {Object.keys(owners).length > 0 && (
        <section className={styles.ownersSection}>
          <h2 className={styles.cardTitle}>收藏者</h2>
          <div className={styles.ownersList}>
            {Object.entries(owners)
              .sort(([, a], [, b]) => b - a) // Sort by count descending
              .map(([playerName, count]) => (
                <button
                  key={playerName}
                  className={styles.ownerCard}
                  onClick={() => navigate(`/player/${playerName}/`, { state: { from: 'pokemon' } })}
                >
                  <p className={styles.ownerName}>{playerName}</p>
                  <p className={styles.ownerCount}>
                    已捕获 {count} 只
                  </p>
                </button>
              ))}
          </div>
        </section>
      )}

      {/* Catch Rate Calculator */}
      <section className={styles.catchRateCalculatorSection}>
        <h2 className={styles.cardTitle}>捕捉率计算器</h2>
        <div className={styles.calculatorContainer}>
          <div className={styles.catchRateInfo}>
            <span className={styles.label}>基础捕获度</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
              <span className={styles.value}>{pokemon.catchRate}/255</span>
              <div className={styles.catchBar}>
                <div 
                  className={styles.catchBarFill}
                  style={{ 
                    width: `${(pokemon.catchRate / 255) * 100}%`,
                    background: pokemon.catchRate > 200 ? '#4ade80' : pokemon.catchRate > 100 ? '#60a5fa' : pokemon.catchRate > 50 ? '#fb923c' : '#ef4444'
                  }}
                />
              </div>
              <span className={styles.catchDifficulty} style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                {pokemon.catchRate > 200 ? '非常容易捕捉' : pokemon.catchRate > 100 ? '容易捕捉' : pokemon.catchRate > 50 ? '普通难度' : '难以捕捉'}
              </span>
            </div>
          </div>
          <div className={styles.catchRateTooltip} style={{ position: 'static', marginTop: '1.5rem' }}>
            <div className={styles.tooltipTitle}>不同球种与 HP 下的捕捉率</div>
            {maxWildLevel > 0 && (
              <div className={styles.tooltipLevelInfo}>
                野生最高等级：<strong>{maxWildLevel}</strong>
              </div>
            )}
            <div className={styles.tooltipContent}>
              <div className={styles.tooltipTable}>
                <div className={styles.tooltipRow}>
                  <div className={styles.tooltipHeader}>球种</div>
                  <div className={styles.tooltipHeader}>满 HP</div>
                  <div className={styles.tooltipHeader}>1% HP</div>
                  <div className={styles.tooltipHeader}>催眠 + 满 HP</div>
                  <div className={styles.tooltipHeader}>催眠 + 1% HP</div>
                </div>
                {(() => {
                  const pokeBall100 = calculateCatchChance(pokemon.catchRate, 1.0, 100).toFixed(1)
                  const pokeBall1 = calculateCatchChance(pokemon.catchRate, 1.0, 1).toFixed(1)
                  const pokeBallSleep100 = calculateCatchChance(pokemon.catchRate, 1.0, 100, 2.0).toFixed(1)
                  const pokeBallSleep1 = calculateCatchChance(pokemon.catchRate, 1.0, 1, 2.0).toFixed(1)
                  return (
                    <div className={styles.tooltipRow}>
                      <div>精灵球</div>
                      <div className={pokeBall100 === "100.0" ? styles.highlightedCell : ""}>{pokeBall100}%</div>
                      <div className={pokeBall1 === "100.0" ? styles.highlightedCell : ""}>{pokeBall1}%</div>
                      <div className={pokeBallSleep100 === "100.0" ? styles.highlightedCell : ""}>{pokeBallSleep100}%</div>
                      <div className={pokeBallSleep1 === "100.0" ? styles.highlightedCell : ""}>{pokeBallSleep1}%</div>
                    </div>
                  )
                })()}
                {(() => {
                  const greatBall100 = calculateCatchChance(pokemon.catchRate, 1.5, 100).toFixed(1)
                  const greatBall1 = calculateCatchChance(pokemon.catchRate, 1.5, 1).toFixed(1)
                  const greatBallSleep100 = calculateCatchChance(pokemon.catchRate, 1.5, 100, 2.0).toFixed(1)
                  const greatBallSleep1 = calculateCatchChance(pokemon.catchRate, 1.5, 1, 2.0).toFixed(1)
                  return (
                    <div className={styles.tooltipRow}>
                      <div>超级球</div>
                      <div className={greatBall100 === "100.0" ? styles.highlightedCell : ""}>{greatBall100}%</div>
                      <div className={greatBall1 === "100.0" ? styles.highlightedCell : ""}>{greatBall1}%</div>
                      <div className={greatBallSleep100 === "100.0" ? styles.highlightedCell : ""}>{greatBallSleep100}%</div>
                      <div className={greatBallSleep1 === "100.0" ? styles.highlightedCell : ""}>{greatBallSleep1}%</div>
                    </div>
                  )
                })()}
                {(() => {
                  const ultraBall100 = calculateCatchChance(pokemon.catchRate, 2.0, 100).toFixed(1)
                  const ultraBall1 = calculateCatchChance(pokemon.catchRate, 2.0, 1).toFixed(1)
                  const ultraBallSleep100 = calculateCatchChance(pokemon.catchRate, 2.0, 100, 2.0).toFixed(1)
                  const ultraBallSleep1 = calculateCatchChance(pokemon.catchRate, 2.0, 1, 2.0).toFixed(1)
                  return (
                    <div className={styles.tooltipRow}>
                      <div>高级球</div>
                      <div className={ultraBall100 === "100.0" ? styles.highlightedCell : ""}>{ultraBall100}%</div>
                      <div className={ultraBall1 === "100.0" ? styles.highlightedCell : ""}>{ultraBall1}%</div>
                      <div className={ultraBallSleep100 === "100.0" ? styles.highlightedCell : ""}>{ultraBallSleep100}%</div>
                      <div className={ultraBallSleep1 === "100.0" ? styles.highlightedCell : ""}>{ultraBallSleep1}%</div>
                    </div>
                  )
                })()}
                {(() => {
                  const quickBall100 = calculateCatchChance(pokemon.catchRate, 5.0, 100).toFixed(1)
                  const quickBall1 = calculateCatchChance(pokemon.catchRate, 1.0, 1).toFixed(1)
                  const quickBallSleep100 = calculateCatchChance(pokemon.catchRate, 1.0, 100, 2.0).toFixed(1)
                  const quickBallSleep1 = calculateCatchChance(pokemon.catchRate, 1.0, 1, 2.0).toFixed(1)
                  return (
                    <div className={styles.tooltipRow}>
                      <div>先机球<span className={styles.tooltipNote}>（第 1 回合）</span></div>
                      <div className={quickBall100 === "100.0" ? styles.highlightedCell : ""}>{quickBall100}%</div>
                      <div className={quickBall1 === "100.0" ? styles.highlightedCell : ""}>{quickBall1}%</div>
                      <div className={quickBallSleep100 === "100.0" ? styles.highlightedCell : ""}>{quickBallSleep100}%</div>
                      <div className={quickBallSleep1 === "100.0" ? styles.highlightedCell : ""}>{quickBallSleep1}%</div>
                    </div>
                  )
                })()}
                {(() => {
                  const duskBall100 = calculateCatchChance(pokemon.catchRate, 2.5, 100).toFixed(1)
                  const duskBall1 = calculateCatchChance(pokemon.catchRate, 2.5, 1).toFixed(1)
                  const duskBallSleep100 = calculateCatchChance(pokemon.catchRate, 2.5, 100, 2.0).toFixed(1)
                  const duskBallSleep1 = calculateCatchChance(pokemon.catchRate, 2.5, 1, 2.0).toFixed(1)
                  return (
                    <div className={styles.tooltipRow}>
                      <div>黑暗球<span className={styles.tooltipNote}>（夜晚）</span></div>
                      <div className={duskBall100 === "100.0" ? styles.highlightedCell : ""}>{duskBall100}%</div>
                      <div className={duskBall1 === "100.0" ? styles.highlightedCell : ""}>{duskBall1}%</div>
                      <div className={duskBallSleep100 === "100.0" ? styles.highlightedCell : ""}>{duskBallSleep100}%</div>
                      <div className={duskBallSleep1 === "100.0" ? styles.highlightedCell : ""}>{duskBallSleep1}%</div>
                    </div>
                  )
                })()}
                {(() => {
                  const timerBall100 = calculateCatchChance(pokemon.catchRate, 4.0, 100).toFixed(1)
                  const timerBall1 = calculateCatchChance(pokemon.catchRate, 4.0, 1).toFixed(1)
                  const timerBallSleep100 = calculateCatchChance(pokemon.catchRate, 4.0, 100, 2.0).toFixed(1)
                  const timerBallSleep1 = calculateCatchChance(pokemon.catchRate, 4.0, 1, 2.0).toFixed(1)
                  return (
                    <div className={styles.tooltipRow}>
                      <div>计时球<span className={styles.tooltipNote}>（第 11 回合起）</span></div>
                      <div className={timerBall100 === "100.0" ? styles.highlightedCell : ""}>{timerBall100}%</div>
                      <div className={timerBall1 === "100.0" ? styles.highlightedCell : ""}>{timerBall1}%</div>
                      <div className={timerBallSleep100 === "100.0" ? styles.highlightedCell : ""}>{timerBallSleep100}%</div>
                      <div className={timerBallSleep1 === "100.0" ? styles.highlightedCell : ""}>{timerBallSleep1}%</div>
                    </div>
                  )
                })()}
                {(() => {
                  const safariPercent = calculateCatchChance(pokemon.catchRate, 1.5, 100).toFixed(1)
                  const isSafari100 = safariPercent === "100.0"
                  return (
                    <div className={`${styles.tooltipRow} ${isSafari100 ? styles.safariRow : ""}`}>
                      <div>狩猎球<span className={styles.tooltipNote}>（仅满 HP）</span></div>
                      <div className={isSafari100 ? styles.highlightedCell : ""}>{safariPercent}%</div>
                      <div className={styles.safariPercent}>—</div>
                      <div className={styles.safariPercent}>—</div>
                      <div className={styles.safariPercent}>—</div>
                    </div>
                  )
                })()}
                {(() => {
                  const { bestMethod, secondBestMethod } = calculateBestCatchMethod(pokemon.catchRate)
                  return (
                    <>
                      <div className={`${styles.tooltipRow} ${styles.bestMethodRow}`}>
                        <div><strong>✓ 最优</strong></div>
                        <div><strong>{translateBallName(bestMethod.ball)}</strong></div>
                        <div>
                          {bestMethod.hp === 100 ? '满 HP' : '1% HP'}
                          {bestMethod.statusMod === 2.0 ? ' + 催眠' : ''}
                        </div>
                        <div><strong>{bestMethod.catchChance.toFixed(1)}%</strong></div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                          {bestMethod.turns} 回合
                        </div>
                      </div>
                      <div className={`${styles.tooltipRow} ${styles.secondBestMethodRow}`}>
                        <div><strong>次优</strong></div>
                        <div><strong>{translateBallName(secondBestMethod.ball)}</strong></div>
                        <div>
                          {secondBestMethod.hp === 100 ? '满 HP' : '1% HP'}
                          {secondBestMethod.statusMod === 2.0 ? ' + 催眠' : ''}
                        </div>
                        <div><strong>{secondBestMethod.catchChance.toFixed(1)}%</strong></div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                          {secondBestMethod.turns} 回合
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
              <div className={styles.tooltipNote2}>
                公式：A = [(3×最大 HP - 2×当前 HP) / (3×最大 HP)] × 球种修正 × 捕获度 × 状态修正
              </div>
              <div className={styles.tooltipNote2} style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(102, 126, 234, 0.2)', paddingTop: '0.5rem' }}>
                <strong>最优方案：</strong>综合捕捉率、所需回合（0–2）与球种成本计算；效果相近时优先选择较便宜的球。
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Locations */}
{((pokemon?.locations && pokemon.locations.length > 0) || safariLocations.length > 0) && (() => {
// Define rarity order
const rarityOrder = {
'Horde': 0,
'Very Common': 1,
'Common': 2,
'Uncommon': 3,
'Fishing': 4,
'Rare': 5,
'Very Rare': 6,
'Lure': 7,
'Unknown': 999
}

// Get the highest priority rarity from the three time periods
const getHighestRarity = (location) => {
const rarities = [
location.rarity_morning,
location.rarity_day,
location.rarity_night
].filter(Boolean)

if (rarities.length === 0) {
  return 'Unknown'
}

return rarities.reduce((highest, current) => {
  const highestOrder = rarityOrder[highest] ?? 999
  const currentOrder = rarityOrder[current] ?? 999

  return currentOrder < highestOrder ? current : highest
}, rarities[0])

}

// Get encounter icon based on rarity and location type
const getEncounterIcon = (location) => {
const rarities = [
location.rarity_morning,
location.rarity_day,
location.rarity_night
]

// Horde icons take priority
if (location.is_horde_5x) {
  return '/5xhorde.png'
}

if (location.is_horde_3x) {
  return '/3xhorde.png'
}

// Check for lure
if (rarities.includes('Lure')) {
  return 'images/lure.png'
}

// Check habitat for fishing rods
const habitat = location.type || ''

if (habitat.includes('Super Rod')) {
  return 'images/super_rod.png'
}

if (habitat.includes('Good Rod')) {
  return 'images/good_rod.png'
}

if (habitat.includes('Old Rod')) {
  return 'images/old_rod.png'
}

if (habitat.includes('Fishing')) {
  return 'images/super_rod.png'
}

return null


}

// Sort locations
// Priority:
// 1. 5x Horde
// 2. 3x Horde
// 3. Normal encounters sorted by rarity
const sortedLocations = [...(pokemon?.locations || [])].sort((a, b) => {
// Horde priority
const getHordePriority = (location) => {
if (location.is_horde_5x) return 0
if (location.is_horde_3x) return 1
return 2
}


const hordePriorityA = getHordePriority(a)
const hordePriorityB = getHordePriority(b)

if (hordePriorityA !== hordePriorityB) {
  return hordePriorityA - hordePriorityB
}

// If both are the same horde type, sort by rarity
const rarityA = rarityOrder[getHighestRarity(a)] ?? 999
const rarityB = rarityOrder[getHighestRarity(b)] ?? 999

return rarityA - rarityB


})

return ( <section className={styles.infoCard}> <h2 className={styles.cardTitle}>出没地点</h2>


  <div className={styles.locationsContainer}>

    {/* Regular Locations */}
    {sortedLocations.map((location, index) => {
      const encounterIcon = getEncounterIcon(location)

      return (
        <button
          key={index}
          className={styles.locationCard}
          onClick={() =>
            navigate(
              `/pokedex/?location=${encodeURIComponent(
                `${location.location_name_full} - ${location.region_name}`
              )}`
            )
          }
          title={`查看${translatePokemonName(pokemon.displayName)}在${location.location_name_full}的出没资料`}
        >
          <div className={styles.locationHeader}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <h3 className={styles.locationName}>
                {translateLocationName(location.location_name_full)}
              </h3>

              {encounterIcon && (
                <img
                  style={{
                    width: '24px',
                    height: '24px',
                    marginLeft: 'auto'
                  }}
                  src={getAssetUrl(encounterIcon)}
                  alt="遇敌类型"
                  onError={(event) => {
                    event.currentTarget.onerror = null
                    event.currentTarget.src = getAssetUrl('images/horde.png')
                  }}
                />
              )}
            </div>

            <span className={styles.locationRegion}>
              {translateRegionName(location.region_name)}
            </span>
          </div>

          <div className={styles.locationDetails}>

            {/* Level */}
            <span className={styles.locationDetail}>
              <strong>等级：</strong>{' '}
              {location.min_level === location.max_level
                ? location.min_level
                : `${location.min_level}-${location.max_level}`}
            </span>

            {/* Season */}
            <span className={styles.locationDetail}>
              <strong>季节：</strong>{' '}
              {formatEncounterTime(location.season || '不限')}
            </span>

           {/* Morning Rarity */}
              {location.rarity_morning &&
              location.rarity_morning !== '--' &&
              location.rarity_morning !== 'Unknown' && (
              <span className={styles.locationDetail}>
              <strong>早晨：</strong>{' '}
              {normalizeHordePercent(location.rarity_morning, location)}
              </span>
              )}

              {/* Day Rarity */}
              {location.rarity_day &&
              location.rarity_day !== '--' &&
              location.rarity_day !== 'Unknown' && (
              <span className={styles.locationDetail}>
              <strong>白天：</strong>{' '}
              {normalizeHordePercent(location.rarity_day, location)}
              </span>
              )}

              {/* Night Rarity */}
              {location.rarity_night &&
              location.rarity_night !== '--' &&
              location.rarity_night !== 'Unknown' && (
              <span className={styles.locationDetail}>
              <strong>夜晚：</strong>{' '}
              {normalizeHordePercent(location.rarity_night, location)}
              </span>
              )}

            {/* Horde Information */}
            {(location.is_horde_3x || location.is_horde_5x) && (
              <span className={styles.locationDetail}>
                <strong>群聚：</strong>{' '}
                {location.is_horde_5x
                  ? '5 只群聚'
                  : '3 只群聚'}
              </span>
            )}

            {/* Habitat */}
            {location.type && (
              <span className={styles.locationDetail}>
                <strong>遇敌方式：</strong>{' '}
                {translateEncounterTerm(location.type)}
              </span>
            )}

          </div>
        </button>
      )
    })}

    {/* Safari Zone Locations */}
    {safariLocations.map((safariLoc, index) => (
      <button
        key={`safari-${index}`}
        className={`${styles.locationCard} ${styles.safariLocationCard}`}
        onClick={() =>
          navigate('/safari-zones/', {
            state: {
              region: safariLoc.region.toLowerCase(),
              area: safariLoc.area
            }
          })
        }
        title={`${safariLoc.region}狩猎地带`}
      >
        <div className={styles.locationHeader}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <h3 className={styles.locationName}>
              狩猎地带
            </h3>
          </div>

          <span
            className={`${styles.locationRegion} ${styles.safariRegionBadge}`}
          >
            {safariLoc.region}
          </span>
        </div>

        <div className={styles.locationDetails}>
          <span className={styles.locationDetail}>
            <strong>区域：</strong>{' '}
            {safariLoc.area}
          </span>

          <span className={styles.locationDetail}>
            <strong>遇敌方式：</strong>{' '}
            {translateEncounterTerm(safariLoc.encounterType)}
          </span>
        </div>
      </button>
    ))}

  </div>
</section>
)
})()}


      {/* Moves */}
      <section className={styles.infoCard} key={`moves-${pokemonName}`}>
        <h2 className={styles.cardTitle}>可习得招式</h2>
        {pokemon.moves && pokemon.moves.length > 0 ? (
          (() => {
            const groupedMoves = groupMovesByMethod(pokemon.moves)
            const methodLabels = {
              'level-up': '升级习得招式',
              'machine': '招式学习器 / 秘传学习器',
              'tutor': '招式教学招式',
              'egg': '遗传招式',
            }
            
            return (
              <div className={styles.moveSection}>
                {['level-up', 'machine', 'tutor', 'egg'].map(method => {
                  const moves = groupedMoves[method]
                  if (moves.length === 0) return null

                  const highlightedMoveKeys = method === 'level-up' && hasWildLevel
                    ? new Set(
                      moves
                        .map((move, index) => ({
                          move,
                          index,
                          level: move.methods?.[0]?.level
                        }))
                        .filter(({ level }) => Number.isFinite(level) && level <= wildLevelValue)
                        .slice(-4)
                        .map(({ move, index }) => `${move.name}-${move.methods?.[0]?.method || 'unknown'}-${move.methods?.[0]?.level || 0}-${index}`)
                    )
                    : new Set()
                  
                  return (
                    <div key={`${pokemonName}-${method}`} className={styles.moveGroup}>
                      <div className={styles.moveGroupHeader}>
                        <h3 className={styles.moveGroupTitle}>{methodLabels[method]}</h3>
                        {method === 'level-up' && (
                          <label className={styles.levelFilter} htmlFor="wild-level-input">
                            <span className={styles.levelFilterLabel}>野生宝可梦等级</span>
                            <input
                              id="wild-level-input"
                              className={styles.levelFilterInput}
                              type="number"
                              min="1"
                              inputMode="numeric"
                              placeholder="例如 22"
                              value={wildLevel}
                              onChange={(e) => setWildLevel(e.target.value)}
                            />
                          </label>
                        )}
                      </div>
                      <div className={styles.movesGrid}>
                        {moves.map((move, moveIndex) => {
                          const primaryMethod = move.methods?.[0]
                          const methodLabel = getMoveLearningMethod(primaryMethod?.method, primaryMethod?.level)
                          const moveKey = `${move.name}-${primaryMethod?.method || 'unknown'}-${primaryMethod?.level || 0}-${moveIndex}`
                          return (
                            <div
                              key={moveKey}
                              className={`${styles.moveTag} ${highlightedMoveKeys.has(moveKey) ? styles.moveTagHighlight : ''}`}
                              title={methodLabel}
                            >
                              <div>{translateMoveName(move.name)}</div>
                              <div className={styles.moveMethod}>{methodLabel}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {groupedMoves.other.length > 0 && (
                  <div className={styles.moveGroup} key={`${pokemonName}-other`}>
                    <h3 className={styles.moveGroupTitle}>其他招式</h3>
                    <div className={styles.movesGrid}>
                      {groupedMoves.other.map((move, moveIndex) => {
                        const primaryMethod = move.methods?.[0]
                        const methodLabel = getMoveLearningMethod(primaryMethod?.method, primaryMethod?.level)
                        const moveKey = `${move.name}-${primaryMethod?.method || 'unknown'}-${primaryMethod?.level || 0}-${moveIndex}`
                        return (
                          <div key={moveKey} className={styles.moveTag} title={methodLabel}>
                            <div>{translateMoveName(move.name)}</div>
                            <div className={styles.moveMethod}>{methodLabel}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })()
        ) : (
          <p className={styles.noMovesMessage}>暂无可用招式资料</p>
        )}
      </section>

      {/* Name Translations */}
      {pokemon.nameTranslations && Object.keys(pokemon.nameTranslations).length > 0 && (
        <section className={styles.infoSection}>
          <h2 className={styles.cardTitle}>名称对照</h2>
          <div className={styles.translationsGrid}>
            {Object.entries(pokemon.nameTranslations).map(([code, data]) => {
              const languageNames = {
                'ja-Hrkt': '日语（平假名）',
                'roomaji': '罗马字',
                'ko': '한국어',
                'zh-Hant': '繁體中文',
                'fr': '法语',
                'de': '德语',
                'es': '西班牙语',
                'it': '意大利语',
                'en': '英语',
                'ja': '日语'
              }
              return (
                <div key={code} className={styles.translationItem}>
                  <span className={styles.translationCode}>{languageNames[code] || code}</span>
                  <span className={styles.translationName}>{data.name}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

    </article>
  )
}
