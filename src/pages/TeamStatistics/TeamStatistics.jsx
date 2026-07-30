import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { API } from '../../api/endpoints'
import { useDatabase } from '../../hooks/useDatabase'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import { useTierData } from '../../hooks/useTierData'
import { getAssetUrl } from '../../utils/assets'
import { calculateShinyPoints } from '../../utils/points'
import { translatePokemonName } from '../../utils/pokemonNamesZh'
import {
  getStatisticsLeaderboards,
  getMostCommonPokemon,
  MINIMUM_STATS_REQUIREMENTS,
} from '../../utils/playerStatistics'
import styles from './TeamStatistics.module.css'

function formatPlayerName(name, data) {
  return Object.keys(data || {}).find((k) => k.toLowerCase() === String(name).toLowerCase()) || name
}

function formatPokemonName(name) {
  if (!name) return '暂无'
  return translatePokemonName(String(name))
}

const PLAYER_LEADERBOARD_SECTIONS = [
  {
    key: 'luckiest',
    title: '欧皇玩家', subtitle: '这手气，建议立刻买彩票。', value: (entry) => `平均 ${entry.averageEncounter.toFixed(0)} 次遇敌`,
  },
  {
    key: 'unluckiest',
    title: '非酋玩家', subtitle: '总得有人把概率补回来。', value: (entry) => `平均 ${entry.averageEncounter.toFixed(0)} 次遇敌`,
  },
  {
    key: 'mostEncounters',
    title: '遇敌次数最多', subtitle: '你还好吗？', value: (entry) => `${entry.totalEncounters.toLocaleString()} 次遇敌`,
  },
  {
    key: 'highestDryStreak',
    title: '最长无闪记录', subtitle: '这些时光都献给了这一只。', value: (entry) => `${entry.maxEncounter.toLocaleString()} 次遇敌`, extra: (entry) => `宝可梦：${formatPokemonName(entry.maxEncounterPokemon)}`,
  },
  {
    key: 'leastEncounter',
    title: '最少遇敌出闪', subtitle: '天选之人。', value: (entry) => `${entry.minEncounter.toLocaleString()} 次遇敌`, extra: (entry) => `宝可梦：${formatPokemonName(entry.minEncounterPokemon)}`,
  },
  {
    key: 'mostRares',
    title: '稀有闪光最多', subtitle: '第 0–2 阶与头目闪光最多。', value: (entry) => `${entry.rareCount} 只稀有闪光`, extra: (entry) => entry.rarePokemons?.length ? `宝可梦：${entry.rarePokemons.map(formatPokemonName).join('、')}` : null,
  },
  {
    key: 'mostPhases',
    title: '阶段闪光最多', subtitle: '你知道也可以换地方吧？', value: (entry) => `${entry.phasesCount} 只闪光`, extra: (entry) => `${entry.topRoute || '暂无'}`,
  },
  {
    key: 'mostInWeek',
    title: '单周闪光最多', subtitle: '本周欧气爆棚。', value: (entry) => `${entry.mostInWeekCount} 只闪光`, extra: (entry) => entry.mostInWeekPokemons?.length ? `宝可梦：${entry.mostInWeekPokemons.map(formatPokemonName).join('、')}` : null,
  },
  {
    key: 'mostSingleEncounters',
    title: '单遇次数最多', subtitle: '左、右、左、右。', value: (entry) => `${entry.singleEncounterCount} 次单遇`,
  },
  {
    key: 'most5xHordes',
    title: '5 只群聚闪光最多', subtitle: '甜甜香气大师。', value: (entry) => `${entry.horde5xCount} 只闪光`,
  },
  {
    key: 'mostFishingShinies',
    title: '钓鱼闪光最多', subtitle: '鱼饵已备好！', value: (entry) => `${entry.fishingCount} 只闪光`,
  },
  {
    key: 'mostFossilShinies',
    title: '化石闪光最多', subtitle: '认证博物馆供货商。', value: (entry) => `${entry.fossilCount} 只闪光`,
  },
  {
    key: 'mostSwarmShinies',
    title: '群聚闪光最多', subtitle: '群聚爱好者。', value: (entry) => `${entry.swarmCount} 只闪光`,
  },
  {    
    key: 'mostHeadbuttShinies',
    title: '头锤树闪光最多', subtitle: '树上也能出奇迹。', value: (entry) => `${entry.headbuttCount} 只闪光`,
  },
  {
    key: 'mostSafariCatches',
    title: '狩猎地带捕获最多', subtitle: '命中注定！', value: (entry) => `${entry.safariCatchCount} 次捕获`,
  },
  {
    key: 'mostSafariFlees',
    title: '狩猎地带逃跑最多', subtitle: '终究是错付了。', value: (entry) => `${entry.safariFleeCount} 次逃跑`,
  },
  {
    key: 'mostBountiesClaimed',
    title: '悬赏领取最多', subtitle: '该结账啦！', value: (entry) => `${entry.bountyClaimCount} 次领取`,
  },
  {
    key: 'contributors',
    title: '社群贡献者', subtitle: '举办活动与悬赏最多（不含未收录的活动）。', value: (entry) => `${entry.contributorCount} 次主办`,
  },
  {
    key: 'mostTeamDexEntrys',
    title: '公会图鉴独有条目最多', subtitle: '仅统计该玩家独有的进化家族条目。', value: (entry) => `${entry.teamDexEntryCount} 条图鉴记录`,
    extra: (entry) => entry.teamDexPokemon?.length
      ? `宝可梦：${entry.teamDexPokemon.map(formatPokemonName).join('、')}`
      : null,
  },
  {
    key: 'newLivingDexEntry',
    title: '独有活体图鉴条目', subtitle: '仅由一位玩家拥有的独特闪光种类最多。', value: (entry) => `${entry.newLivingDexEntryCount} 条记录`,
    extra: (entry) => entry.newLivingDexEntries?.length
      ? `宝可梦：${entry.newLivingDexEntries.map(formatPokemonName).join('、')}`
      : null,
  },
  {
    key: 'highestWildIvShiny',
    title: '野生闪光个体值最高', subtitle: '野外遇敌获得的总个体值最高闪光（不含孵化）。', value: (entry) => `个体值：${entry.highestWildIvTotal}`,
    extra: (entry) => entry.highestWildIvPokemon
      ? `宝可梦：${formatPokemonName(entry.highestWildIvPokemon)}${entry.highestWildIvSpread ? `（${entry.highestWildIvSpread}）` : ''}`
      : null,
  },
]

const ALL_TIME_TAB = {
  key: 'allTimePoints',
  title: '历史总积分榜', subtitle: '按总积分排列的全部玩家',
}

const MOST_COMMON_POKEMON_TAB = {
  key: 'mostCommonPokemon',
  title: '最常见的宝可梦', subtitle: '捕获数量最多的 25 种闪光宝可梦',
}

export default function TeamStatistics() {
  const [activeIndexTab, setActiveIndexTab] = useState(ALL_TIME_TAB.key)
  const [searchQuery, setSearchQuery] = useState('')

  const breadcrumbs = [
    { name: '首页', url: '/' }, { name: '公会统计', url: '/team-statistics' }
  ]

  useDocumentHead({
    title: '公会统计｜PokeMMO 排行榜', description: '查看 Team Synergy 玩家统计、各类前三排行榜、可搜索统计索引与常见闪光宝可梦。',
    canonicalPath: '/team-statistics/',
    breadcrumbs,
  })

  const { data, isLoading, error } = useDatabase()
  const { tierPoints, tierLookup } = useTierData()

  const { data: bountiesData = [] } = useQuery({
    queryKey: ['bounties'],
    queryFn: async () => {
      try {
        const res = await fetch(API.bounties)
        if (!res.ok) return []
        return res.json()
      } catch {
        return []
      }
    },
    staleTime: 10 * 60 * 1000,
  })

  const { data: eventsData = [] } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      try {
        const res = await fetch(API.events)
        if (!res.ok) return []
        return res.json()
      } catch {
        return []
      }
    },
    staleTime: 10 * 60 * 1000,
  })

  const externalStatsData = useMemo(
    () => ({ bounties: bountiesData, events: eventsData }),
    [bountiesData, eventsData]
  )

  const playerLeaderboards = useMemo(
    () => getStatisticsLeaderboards(data, 3, externalStatsData),
    [data, externalStatsData]
  )


  const indexedLeaderboards = useMemo(() => {
    const totalPlayers = Object.keys(data || {}).length
    if (!totalPlayers) return null
    return getStatisticsLeaderboards(data, totalPlayers, externalStatsData)
  }, [data, externalStatsData])

  const commonPokemon = useMemo(
    () => getMostCommonPokemon(data, 25),
    [data]
  )

  const allTimeLeaderboard = useMemo(() => {
    if (!data) return []

    const allTime = {}
    Object.entries(data).forEach(([player, playerData]) => {

      allTime[player] = Object.values(playerData.shinies || {}).reduce(
        (acc, shiny) => acc + calculateShinyPoints(shiny, tierPoints, tierLookup),
        0
      )
    })

    return Object.entries(allTime)
      .sort((a, b) => b[1] - a[1])
      .filter(([, points]) => points > 0)
      .map(([player, points], index) => ({
        rank: index + 1,
        name: player,
        value: `${points.toLocaleString()} 分`,
        extra: null,
        isPlayer: true,
      }))
  }, [data, tierPoints, tierLookup])

  const indexTabs = useMemo(
    () => [ALL_TIME_TAB, ...PLAYER_LEADERBOARD_SECTIONS, MOST_COMMON_POKEMON_TAB],
    []
  )

  const activeCategory = useMemo(
    () => indexTabs.find((tab) => tab.key === activeIndexTab) || indexTabs[0],
    [activeIndexTab, indexTabs]
  )

  const activeIndexEntries = useMemo(() => {
    if (activeCategory.key === ALL_TIME_TAB.key) {
      return allTimeLeaderboard
    }

    if (activeCategory.key === MOST_COMMON_POKEMON_TAB.key) {
      return commonPokemon.map((entry, index) => ({
        rank: index + 1,
        name: formatPokemonName(entry.pokemon),
        value: `${entry.count.toLocaleString()} 次捕获`,
        extra: null,
        isPlayer: false,
      }))
    }

    const entries = indexedLeaderboards?.[activeCategory.key] || []
    return entries.map((entry, index) => ({
      rank: index + 1,
      name: entry.name,
      value: activeCategory.value(entry),
      extra: activeCategory.extra?.(entry) || null,
      isPlayer: true,
    }))
  }, [activeCategory, allTimeLeaderboard, commonPokemon, indexedLeaderboards])

  const filteredIndexEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return activeIndexEntries
      .map((entry) => ({
        ...entry,
        canonical: entry.isPlayer ? formatPlayerName(entry.name, data) : entry.name,
      }))
      .filter((entry) => !query || entry.canonical.toLowerCase().includes(query))
  }, [activeIndexEntries, data, searchQuery])

  const searchPlaceholder = activeCategory.key === MOST_COMMON_POKEMON_TAB.key
    ? '搜索宝可梦…' : '搜索用户名…'

  if (isLoading) return <div className="message">加载中…</div>
  if (error) return <div className="message">公会统计加载失败</div>

  return (
    <div className={styles.page}>
      <h1>公会统计</h1>
      <img src={getAssetUrl('images/pagebreak.png')} alt="分隔线" className="pagebreak" />

      <section className={styles.section}>
        <h2>玩家排行榜（前 3 名）</h2>
        <p className={styles.requirements}>
          需要遇敌数据的榜单，仅展示总遇敌至少 {MINIMUM_STATS_REQUIREMENTS.totalEncounters.toLocaleString()} 次、数据完整度至少 {MINIMUM_STATS_REQUIREMENTS.dataCompleteness}%、且拥有 {MINIMUM_STATS_REQUIREMENTS.shinyCount}+ 只闪光的玩家。如符合条件却未上榜，请在 ShinyBoard.net 更新数据；详情可私信 Hyper。
        </p>
        <div className={styles.grid}>
          {PLAYER_LEADERBOARD_SECTIONS.map((section) => (
            <article key={section.key} className={styles.card}>
              <h3>{section.title}</h3>
              <p className={styles.subtitle}>{section.subtitle}</p>
              <ol className={styles.list}>
                {(playerLeaderboards?.[section.key] || []).map((entry, index) => {
                  const canonical = formatPlayerName(entry.name, data)
                  return (
                    <li key={`${section.key}-${canonical}`}>
                      <div className={styles.rowTop}>
                        <span className={styles.rank}>#{index + 1}</span>
                        <Link to={`/player/${canonical}/`} className={styles.playerLink}>
                          {canonical}
                        </Link>
                        <span className={styles.value}>{section.value(entry)}</span>
                      </div>
                      {section.extra?.(entry) && (
                        <div className={styles.extra}>{section.extra(entry)}</div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>统计索引</h2>
        <div className={styles.tabs} role="tablist" aria-label="全部统计索引类别">
          {indexTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeIndexTab === tab.key}
              className={`${styles.tabButton} ${activeIndexTab === tab.key ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveIndexTab(tab.key)}
            >
              {tab.title}
            </button>
          ))}
        </div>
        <div className={styles.searchRow}>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className={styles.searchInput}
            aria-label={searchPlaceholder}
          />
        </div>
        <article key={activeCategory.key} className={styles.card}>
          <h3>{activeCategory.title}</h3>
          <p className={styles.subtitle}>{activeCategory.subtitle}</p>
          <ol key={`${activeCategory.key}-list`} className={styles.list}>
            {filteredIndexEntries.map((entry) => (
              <li key={`${activeCategory.key}-${entry.rank}-${entry.canonical}`}>
                <div className={styles.rowTop}>
                  <span className={styles.rank}>#{entry.rank}</span>
                  {entry.isPlayer ? (
                    <Link to={`/player/${entry.canonical}/`} className={styles.playerLink}>
                      {entry.canonical}
                    </Link>
                  ) : (
                    <span>{entry.canonical}</span>
                  )}
                  <span className={styles.value}>{entry.value}</span>
                </div>
                {entry.extra && <div className={styles.extra}>{entry.extra}</div>}
              </li>
            ))}
          </ol>
          {!filteredIndexEntries.length && (
            <p className={styles.empty}>没有符合搜索条件的条目。</p>
          )}
        </article>
      </section>
    </div>
  )
}
