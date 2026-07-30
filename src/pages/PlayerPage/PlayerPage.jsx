import { useEffect, useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useDatabase } from '../../hooks/useDatabase'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import { useTrophies } from '../../hooks/useTrophies'
import { useStreamers } from '../../hooks/useStreamers'
import ShinyItem from '../../components/ShinyItem/ShinyItem'
import TrophyShelf from '../../components/TrophyShelf/TrophyShelf'
import StatisticsSection from '../../components/StatisticsSection/StatisticsSection'
import BackButton from '../../components/BackButton/BackButton'
import styles from './PlayerPage.module.css'
import { getLocalPokemonGif } from '../../utils/pokemon'
import { getPlayerRanks } from '../../utils/playerStatistics'


export default function PlayerPage() {
    // Redirect to correct case-sensitive URL if needed
  const { playerName } = useParams()
  const location = useLocation()
  const { data, isLoading } = useDatabase()
  const { data: trophiesData } = useTrophies()
  const { data: streamersData } = useStreamers()

  const { realKey, playerData } = useMemo(() => {
    if (!data || !playerName) return { realKey: null, playerData: null }
    const key = Object.keys(data).find(
      k => k.toLowerCase() === playerName.toLowerCase()
    )
    return { realKey: key || null, playerData: key ? data[key] : null }
  }, [data, playerName])

  if (realKey && playerName && realKey !== playerName) {
    window.location.replace(`${import.meta.env.BASE_URL}player/${realKey}/`);
    return null;
  }




  // --- Page-specific body class ---
  useEffect(() => {
    document.body.classList.add('player-page-active')
    return () => document.body.classList.remove('player-page-active')
  }, [])

  const breadcrumbs = realKey ? [
    { name: '首页', url: '/' }, { name: '闪光收藏展示', url: '/' },
    { name: realKey, url: `/player/${playerName}` }
  ] : null;

  // --- Safe defaults ---
  const safeRealKey = realKey || playerName

  const safeShinies = Object.entries(playerData?.shinies || {})

  const safeFavourites = safeShinies.filter(
    ([, s]) => s.Favourite?.toLowerCase() === 'yes'
  )

  const safeNormalShinies = safeShinies.filter(
    ([, s]) => s.Favourite?.toLowerCase() !== 'yes'
  )
  const playerRanks = useMemo(() => {
    if (!data || !safeRealKey) return null
    return getPlayerRanks(data, safeRealKey)
  }, [data, safeRealKey])

  const firstFavouriteShiny = safeFavourites[0]?.[1]
  const firstNormalShiny = safeShinies[0]?.[1]

  const ogImage =
    (firstFavouriteShiny && getLocalPokemonGif(firstFavouriteShiny.Pokemon)) ||
    (firstNormalShiny && getLocalPokemonGif(firstNormalShiny.Pokemon)) ||
    'https://b1aoo.github.io/team-site/images/openGraph.jpg'

  const ogUrl = `https://b1aoo.github.io/team-site/player/${playerName?.toLowerCase()}/?v=2`

  useDocumentHead({
    title: realKey ? `${realKey}的闪光收藏｜Team Synergy` : '玩家闪光收藏｜Team Synergy',
    description: realKey
      ? `查看 Team Synergy 成员 ${realKey} 的 PokeMMO 闪光宝可梦收藏与统计。`
      : '查看 Team Synergy 玩家闪光宝可梦收藏。',
    canonicalPath: `/player/${playerName?.toLowerCase()}/`,
    breadcrumbs: breadcrumbs,
    ogImage,
    url: ogUrl,
  })

  // --- Back button logic ---
  const fromPage = location.state?.from
  const backTo = fromPage === 'shotm' ? '/shotm' : fromPage === 'shiny-war-2025' ? '/shiny-war-2025' : fromPage === 'pokemon' ? -1 : '/shiny-showcase'
  const backLabel = fromPage === 'shotm' ? '← 返回本月闪光' : fromPage === 'shiny-war-2025' ? '← 返回闪光大战 2025' : fromPage === 'pokemon' ? '← 返回宝可梦' : '← 返回收藏展示'

  // --- Find streamer info ---
    const streamerInfo = useMemo(() => {
      if (!streamersData || !safeRealKey) return null
      const lowerKey = safeRealKey.toLowerCase()
      const allStreamers = [...streamersData.live, ...streamersData.offline]
      return allStreamers.find(
        s => s.pokeName?.toLowerCase() === lowerKey
      ) || null
    }, [streamersData, safeRealKey])

  const isLive = useMemo(() => {
    if (!streamersData || !safeRealKey) return false
    const lowerKey = safeRealKey.toLowerCase()
    return streamersData.live.some(
      s => s.pokeName?.toLowerCase() === lowerKey
    )
  }, [streamersData, safeRealKey])


  // --- Calculate average encounters per shiny ---
  const encountersData = useMemo(() => {
    if (!playerData || safeShinies.length === 0) return null

    const shiniesWithEncounters = safeShinies.filter(
      ([, s]) => typeof s.encounter_count === 'number' && s.encounter_count > 0
    )

    const countWithEncounters = shiniesWithEncounters.length
    const totalShinies = safeShinies.length
    const percentageWithEncounters = (countWithEncounters / totalShinies) * 100

    // Only show if 50% or more have encounter data
    if (percentageWithEncounters < 50) return null

    const totalEncounters = shiniesWithEncounters.reduce(
      (sum, [, s]) => sum + s.encounter_count,
      0
    )

    const averageEncounters = Math.round(totalEncounters / countWithEncounters)

    return {
      average: averageEncounters,
      count: countWithEncounters,
      total: totalShinies,
      percentage: Math.round(percentageWithEncounters),
    }
  }, [playerData, safeShinies])

  // --- Check if should show statistics section and which parts ---
  const { showStatisticsSection, sectionFlags } = useMemo(() => {
    if (!playerData || safeShinies.length === 0) return { showStatisticsSection: false, sectionFlags: {} }

    // Check encounter data: need 50% or more with encounter_count > 0
    const shiniesWithEncounters = safeShinies.filter(
      ([, s]) => typeof s.encounter_count === 'number' && s.encounter_count > 0
    )
    const encounterPercentage = (shiniesWithEncounters.length / safeShinies.length) * 100

    // Check location data: need 50% or more with location
    const shiniesWithLocation = safeShinies.filter(
      ([, s]) => s.location && typeof s.location === 'string' && s.location.trim() !== ''
    )
    const locationPercentage = (shiniesWithLocation.length / safeShinies.length) * 100

    // Check method data: need 50% or more with encounter_method
    const shiniesWithMethod = safeShinies.filter(
      ([, s]) => s.encounter_method && typeof s.encounter_method === 'string' && s.encounter_method.trim() !== ''
    )
    const methodPercentage = (shiniesWithMethod.length / safeShinies.length) * 100

    const flags = {
      showEncounterSections: encounterPercentage >= 50,
      showLocationSections: locationPercentage >= 50,
      showMethodSections: methodPercentage >= 50,
    }

    // Show statistics if any of the sections can be displayed
    const canShow = flags.showEncounterSections || flags.showLocationSections || flags.showMethodSections

    return { showStatisticsSection: canShow, sectionFlags: flags }
  }, [playerData, safeShinies])

  const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'b1aoo.github.io'

  // --- Loading / not found ---
  if (isLoading) return <div className="message">加载中…</div>

  if (!playerData) {
    return (
      <h2 style={{ color: 'white', textAlign: 'center' }}>
        未找到玩家 “{playerName}”
      </h2>
    )
  }

  // --- Twitch section ---
  const renderTwitchSection = () => {
    if (!streamerInfo) return null

    // LIVE EMBED
    if (isLive) {
      return (
        <div className={styles.twitchSection}>
          <h2>🔴 Twitch 正在直播</h2>

          <div className={styles.twitchWrapper}>
            <iframe
              src={`https://player.twitch.tv/?channel=${streamerInfo.twitch_username.toLowerCase()}&parent=${parentDomain}`}
              allowFullScreen
              loading="lazy"
              className={styles.twitchIframe}
            />
          </div>
        </div>


      )
    }

    // OFFLINE CARD
    return (
      <div className={styles.streamerSection}>
        <h2>📺 主播</h2>

        <a
          href={`https://www.twitch.tv/${streamerInfo.twitch_username.toLowerCase()}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.streamerCardLink}
        >
          <div className={styles.streamerCard}>
            <img
              src={streamerInfo.profile_image_url}
              alt={streamerInfo.twitch_username}
              className={styles.streamerProfile}
            />
            <p className={styles.streamerName}>
              {streamerInfo.twitch_username}
            </p>
          </div>
        </a>
      </div>
    )
  }

  // --- Render ---
  return (
    <div className={styles.playerPage}>
      <BackButton to={backTo} label={backLabel} />
      
      <h1>{safeRealKey} 的闪光收藏 ✨</h1>
      <p>闪光总数：{playerData.shiny_count ?? 0}</p>

      {safeFavourites.length > 0 && (
        <div className={styles.favouriteList}>
          <h2 className={styles.favouritesHeader}>我的收藏</h2>
          <div className={styles.favouriteGrid}>
            {safeFavourites.map(([id, s]) => (
              <div key={id} className={styles.bigShinyWrapper}>
                <ShinyItem shiny={s} userName={safeRealKey} localizeDates={false} mobileInteractive={true} />
              </div>
            ))}
          </div>
        </div>
      )}

      {safeNormalShinies.length > 0 && (
        <div className={styles.shinyList}>
          {safeNormalShinies.map(([id, s]) => (
            <ShinyItem key={id} shiny={s} userName={safeRealKey} localizeDates={false} mobileInteractive={true} />
          ))}
        </div>
      )}

      {playerRanks && (
        <div className={styles.rankSection}>
          <h2>📊 排行</h2>

          <ul>
            {[
              { key: 'luckiest', label: '欧皇玩家' }, { key: 'unluckiest', label: '非酋玩家' },
              { key: 'mostEncounters', label: '遇敌次数最多' }, { key: 'highestDryStreak', label: '最长无闪记录' },
              { key: 'lowestEncounter', label: '最少遇敌出闪' }, { key: 'mostRares', label: '稀有闪光最多' },
              { key: 'mostPhases', label: '阶段闪光最多' }, { key: 'mostInWeek', label: '单周闪光最多' },
              { key: 'mostSingleEncounters', label: '单遇次数最多' }, { key: 'most5xHordes', label: '5 只群聚闪光最多' },
              { key: 'mostFishing', label: '钓鱼闪光最多' }, { key: 'mostFossils', label: '化石闪光最多' },
              { key: 'mostSwarm', label: '群聚闪光最多' }, { key: 'mostHeadbutt', label: '头锤树闪光最多' },
              { key: 'mostSafariCatches', label: '狩猎地带捕获最多' }, { key: 'mostSafariFlees', label: '狩猎地带逃跑最多' },
              { key: 'mostBountiesClaimed', label: '悬赏领取最多' }, { key: 'contributors', label: '社群贡献者' },
              { key: 'mostTeamDexEntries', label: '公会图鉴独有条目最多' }, { key: 'newLivingDexEntries', label: '独有活体图鉴条目' },
              { key: 'highestWildIvShiny', label: '野生闪光个体值最高' },
            ].map(({ key, label }) => {
              const rank = playerRanks[key]
              if (!rank) return null

              let rankClass = styles.rankItem

              if (rank === 1) rankClass = `${styles.rankItem} ${styles.rank1}`
              else if (rank === 2) rankClass = `${styles.rankItem} ${styles.rank2}`
              else if (rank === 3) rankClass = `${styles.rankItem} ${styles.rank3}`

              return (
                <li key={key} className={rankClass}>
                  <span className={styles.rankLabel}>{label}</span>
                  <span className={styles.rankValue}>#{rank}</span>
                </li>
              )
            })}


          </ul>
        </div>
      )}
      {showStatisticsSection && <StatisticsSection playerData={playerData} playerName={safeRealKey} sectionFlags={sectionFlags} />}
      
      {renderTwitchSection()}
      



      {trophiesData && (
        <TrophyShelf
          playerName={safeRealKey}
          trophies={trophiesData.trophies}
          trophyAssignments={trophiesData.trophyAssignments}
        />
      )}
    </div>
  )
}
