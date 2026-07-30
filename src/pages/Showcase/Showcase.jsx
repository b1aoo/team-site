import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDatabase } from '../../hooks/useDatabase'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import { useStreamers } from '../../hooks/useStreamers'
import PlayerCard from '../../components/PlayerCard/PlayerCard'
import SearchBar from '../../components/SearchBar/SearchBar'
import PlayerStatsDropdown from '../../components/PlayerStatsDropdown/PlayerStatsDropdown'
import { getAssetUrl } from '../../utils/assets'
import { getStatisticsWinners } from '../../utils/playerStatistics'
import { API } from '../../api/endpoints'
import styles from './Showcase.module.css'

const INITIAL_COUNT = 5
const BATCH_SIZE = 5

export default function Showcase() {
  useDocumentHead({
    title: 'Team Synergy－PokeMMO 闪光狩猎公会与社区',
    description: 'Team Synergy 是 PokeMMO 闪光狩猎社区。浏览 140 多位玩家的闪光收藏、用图鉴追踪完成度、观看 Twitch 直播并参与活动。',
    canonicalPath: '/',
    robots: 'index, follow, max-image-preview:large',
  })
  const { data, isLoading, error } = useDatabase()
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT)
  const sentinelRef = useRef(null)
  const { data: streamers } = useQuery({
    queryKey: ['streamersList'],
    queryFn: () => fetch(API.streamers).then(r => {
      if (!r.ok) throw new Error(`Failed to load streamers: ${r.status}`)
      return r.json()
    }),
  })
  const { data: twitchData } = useStreamers()

  const combinedStreamers = useMemo(() => {
    const result = { ...(streamers || {}) }
    if (twitchData) {
      for (const s of [...twitchData.live, ...twitchData.offline]) {
        if (!result[s.twitch_username]) {
          result[s.twitch_username] = s
        }
      }
    }
    return result
  }, [streamers, twitchData])

  const sortedPlayers = useMemo(() => {
    if (!data) return []
    return Object.entries(data)
      .sort((a, b) => b[1].shiny_count - a[1].shiny_count)
  }, [data])

  const filteredPlayers = useMemo(() => {
    if (!search) return sortedPlayers
    const lower = search.toLowerCase()
    return sortedPlayers.filter(([name]) => name.toLowerCase().includes(lower))
  }, [sortedPlayers, search])

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(INITIAL_COUNT)
  }, [search])

  // Create rank map for O(1) lookup instead of O(n) findIndex on every render
  const rankMap = useMemo(() => {
    const map = new Map()
    sortedPlayers.forEach(([player], index) => {
      map.set(player, index)
    })
    return map
  }, [sortedPlayers])

  // Calculate statistics winners
  const winners = useMemo(() => {
    return getStatisticsWinners(data)
  }, [data])

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + BATCH_SIZE, filteredPlayers.length))
  }, [filteredPlayers.length])

  // IntersectionObserver to load more as user scrolls
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore()
      },
      { rootMargin: '400px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  if (isLoading) return <div className="message">加载中…</div>
  if (error) return <div className="message">数据加载失败</div>

  const playersToShow = filteredPlayers.slice(0, visibleCount)
  const hasMore = visibleCount < filteredPlayers.length

  return (
    <div>
      <h1 className="seo-optimized">
        Team Synergy：PokeMMO 闪光狩猎社区
      </h1>
      <p className="seo-intro">
        追踪 PokeMMO 闪光宝可梦、参加活动、查阅详尽图鉴中的刷闪地点与头目宝可梦信息，并浏览 {filteredPlayers.length} 位成员的收藏。
      </p>

      <img src={getAssetUrl('images/pagebreak.png')} alt="分隔线" className="pagebreak" />

      <div className={styles.videoContainer}>
        <h2>
          <a href="https://www.youtube.com/watch?v=ngejc1FMWqg" target="_blank" rel="noopener noreferrer">
            观看我们的闪光收藏展示视频！
          </a>
        </h2>
        <a href="https://www.youtube.com/watch?v=ngejc1FMWqg" target="_blank" rel="noopener noreferrer">
          <img
            src={getAssetUrl('images/shinyshowcase.png')}
            alt="闪光收藏展示视频"
            className={styles.showcaseVideo}
            width="300"
            height="169"
            loading="eager"
            decoding="async"
          />
        </a>
      </div>

      <SearchBar value={search} onChange={setSearch} />

      <PlayerStatsDropdown winners={winners} data={data} />

      <div className={styles.showcase}>
        {playersToShow.map(([player, playerData]) => (
          <PlayerCard
            key={player}
            player={player}
            data={playerData}
            rank={rankMap.get(player)}
            streamers={combinedStreamers}
            mobileInteractive={true}
          />
        ))}
      </div>

      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
    </div>
  )
}
