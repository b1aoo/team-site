import styles from '../RegionMaps.module.css'
import { getLocalPokemonGif, onGifError, translatePokemonName } from '../../../utils/pokemon'
import { translateEncounterTerm, translateLocationName, translateTypeName } from '../../../utils/pokemonTermsZh'
import { getSpawnRarityValues } from './mapHelpers'
import { chineseOrFallback } from '../../../utils/contentZh'

const SPAWN_CATEGORIES = [
  {
    key: 'hordes',
    label: '群聚',
    matches: ({ encounterTypes }) => encounterTypes.has('horde'),
  },
  {
    key: 'lure',
    label: '引虫香水',
    matches: ({ encounterTypes }) => encounterTypes.has('lure'),
  },
  {
    key: 'headbutt',
    label: '头锤树',
    matches: ({ methods }) => methods.has('headbutt'),
  },
  {
    key: 'single',
    label: '单只遭遇',
    matches: ({ encounterTypes, methods }) =>
      ['very common', 'common', 'uncommon', 'rare', 'very rare'].some((type) => encounterTypes.has(type))
        && !['fishing', 'old rod', 'good rod', 'super rod'].some((method) => methods.has(method)),
  },
  {
    key: 'fishing',
    label: '垂钓',
    matches: ({ encounterTypes, methods }) =>
      encounterTypes.has('fishing')
        || ['fishing', 'old rod', 'good rod', 'super rod'].some((method) => methods.has(method)),
  },
  {
    key: 'special',
    label: '特殊遭遇',
    matches: ({ encounterTypes }) => encounterTypes.has('special'),
  },
]

function normalizeEncounterValue(value) {
  return String(value || '').trim().toLowerCase()
}

const TIME_LABELS = ['Morning', 'Day', 'Night']
const TIME_LABELS_ZH = { Morning: '早晨', Day: '白天', Night: '夜晚' }
const SEASON_LABELS = {
  SEASON0: '夏季',
  SEASON1: '春季',
  SEASON2: '秋季',
  SEASON3: '冬季',
}

function getSpawnAvailabilityTags(spawn) {
  if (!Array.isArray(spawn.encounters) || spawn.encounters.length === 0) {
    return []
  }

  const timeParts = new Set()
  const seasonParts = new Set()

  spawn.encounters.forEach((encounter) => {
    String(encounter.time || '')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        if (part.toUpperCase() === 'ALL') return
        if (SEASON_LABELS[part]) {
          seasonParts.add(SEASON_LABELS[part])
          return
        }
        if (TIME_LABELS.includes(part)) {
          timeParts.add(part)
        }
      })
  })

  const tags = []
  if (timeParts.size > 0 && timeParts.size < TIME_LABELS.length) {
    tags.push(TIME_LABELS.filter((label) => timeParts.has(label)).map((label) => TIME_LABELS_ZH[label]).join('/'))
  }

  const seasonValues = Object.values(SEASON_LABELS)
  if (seasonParts.size > 0 && seasonParts.size < seasonValues.length) {
    tags.push(seasonValues.filter((label) => seasonParts.has(label)).join('/'))
  }

  return tags
}

function getSpawnCategory(spawn) {
  const encounterTypes = new Set(getSpawnRarityValues(spawn).map(normalizeEncounterValue))
  const methods = new Set((spawn.encounters || []).map((encounter) => normalizeEncounterValue(encounter.method)))
  const matchContext = { encounterTypes, methods }

  return SPAWN_CATEGORIES.find((category) => category.matches(matchContext))?.key || 'other'
}

function groupSpawnsByCategory(spawns) {
  const groups = new Map(SPAWN_CATEGORIES.map((category) => [category.key, []]))
  groups.set('other', [])

  spawns.forEach((spawn) => {
    groups.get(getSpawnCategory(spawn)).push(spawn)
  })

  return [
    ...SPAWN_CATEGORIES.map((category) => ({ ...category, spawns: groups.get(category.key) })),
    { key: 'other', label: '其他', spawns: groups.get('other') },
  ].filter((category) => category.spawns.length > 0)
}

function formatEncounterSummary(spawn) {
  if (!Array.isArray(spawn.encounters) || spawn.encounters.length === 0) {
    return getSpawnRarityValues(spawn).join(', ')
  }

  const methods = Array.from(new Set(spawn.encounters.map((encounter) => encounter.method).filter(Boolean)))
  const levels = spawn.encounters
    .filter((encounter) => Number.isFinite(encounter.minLevel) && Number.isFinite(encounter.maxLevel))
    .map((encounter) => encounter.minLevel === encounter.maxLevel
      ? `${encounter.minLevel}`
      : `${encounter.minLevel}-${encounter.maxLevel}`)

  const levelSummary = levels.length > 0 ? `等级 ${Array.from(new Set(levels)).join(', ')}` : null
  const methodSummary = methods.length > 0 ? methods.map(translateEncounterTerm).join(', ') : null
  const raritySummary = getSpawnRarityValues(spawn).map(translateEncounterTerm).join(', ')

  return [methodSummary, levelSummary, raritySummary].filter(Boolean).join(' - ')
}

function SpawnRow({ spawn }) {
  const availabilityTags = getSpawnAvailabilityTags(spawn)

  return (
    <li className={styles.spawnRow}>
      <span className={styles.spawnSpriteWrap} title={translatePokemonName(spawn.name)}>
        <img
          className={styles.spawnSprite}
          src={getLocalPokemonGif(spawn.name)}
          alt={translatePokemonName(spawn.name)}
          loading="lazy"
          onError={onGifError(spawn.name)}
        />
      </span>
      <span className={styles.spawnName}>
        {translatePokemonName(spawn.name)}
        {availabilityTags.map((tag) => (
          <span key={tag} className={styles.spawnAvailabilityTag}>{tag}</span>
        ))}
      </span>
      <span className={styles.spawnMeta}>
        {(spawn.types || []).map(translateTypeName).join('／')} · {formatEncounterSummary(spawn)}
      </span>
    </li>
  )
}

function MatchingRouteList({ matchingAreas, selectedAreaId, onSelectArea }) {
  const routeLabel = '个地点'

  return (
    <section className={styles.matchingRoutesSection}>
      <h3 className={styles.sectionHeading}>已选地点总数</h3>
      <p className={styles.panelSubtle}>{matchingAreas.length} {routeLabel}符合当前筛选条件。</p>
      {matchingAreas.length > 0 ? (
        <div className={styles.routeChipGrid}>
          {matchingAreas.map((area) => (
            <button
              key={area.id}
              type="button"
              className={`${styles.routeChip} ${selectedAreaId === area.id ? styles.routeChipActive : ''}`}
              onClick={() => onSelectArea(area.id)}
            >
              {translateLocationName(area.name)}
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.panelSubtle}>没有地点符合当前筛选条件。</p>
      )}
    </section>
  )
}

export default function RouteDetailsPanel({
  selectedArea,
  filteredSpawns,
  matchingAreas = [],
  onSelectArea,
}) {
  if (!selectedArea) {
    return (
      <section className={styles.panelCard}>
        <h2 className={styles.panelTitle}>地点详情</h2>
        <p className={styles.panelSubtle}>在地图上选择一个区域以查看遭遇、备注和资料。</p>
        <MatchingRouteList
          matchingAreas={matchingAreas}
          selectedAreaId={selectedArea?.id}
          onSelectArea={onSelectArea}
        />
      </section>
    )
  }

  const spawnCategories = groupSpawnsByCategory(filteredSpawns)

  return (
    <section className={styles.panelCard}>
      <h2 className={styles.panelTitle}>{translateLocationName(selectedArea.name)}</h2>
      <p className={styles.areaKind}>{translateEncounterTerm(selectedArea.kind)}</p>
      <p className={styles.panelSubtle}>
        {chineseOrFallback(selectedArea.notes, selectedArea.notes ? '特殊出现条件与注意事项请以游戏内实际情况为准。' : '暂无特别备注。')}
      </p>

      <h3 className={styles.sectionHeading}>宝可梦出现池</h3>
      {filteredSpawns.length > 0 ? (
        <div className={styles.spawnCategoryList}>
          {spawnCategories.map((category) => (
            <section key={category.key} className={styles.spawnCategory}>
              <h4 className={styles.spawnCategoryTitle}>{category.label}</h4>
              <ul className={styles.spawnList}>
                {category.spawns.map((spawn) => (
                  <SpawnRow
                    key={`${selectedArea.id}-${category.key}-${spawn.name}`}
                    spawn={spawn}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className={styles.panelSubtle}>没有宝可梦符合当前筛选条件。</p>
      )}

      <MatchingRouteList
        matchingAreas={matchingAreas}
        selectedAreaId={selectedArea.id}
        onSelectArea={onSelectArea}
      />
    </section>
  )
}
