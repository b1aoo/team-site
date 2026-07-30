import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDatabase } from '../../hooks/useDatabase'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import { useStreamers } from '../../hooks/useStreamers'
import PlayerCard from '../../components/PlayerCard/PlayerCard'
import SearchBar from '../../components/SearchBar/SearchBar'
import { getAssetUrl } from '../../utils/assets'
import { API } from '../../api/endpoints'
import styles from './ShinyShowcase.module.css'

const INITIAL_COUNT = 5
const BATCH_SIZE = 5
const SHINY_FILTERS = [
  { label: '孵化', key: 'Egg' },
  { label: '头目', key: 'Alpha' },
  { label: '狩猎地带', key: 'Safari' },
  { label: '化石', key: 'Fossil' },
  { label: '群聚', key: 'Swarm' },
  { label: '钓鱼', key: 'Fishing' },
  { label: '头锤树', key: 'Headbutt' },
  { label: '反应闪', key: 'Reaction' },
  { label: '神秘球', key: 'MysteriousBall' },
  { label: '甜甜蜜树', key: 'Honey Tree' },
  { label: '隐藏闪光', key: 'Secret Shiny' },
  { label: '活动', key: 'Event' },
]

function isTruthyFlag(value) {
  if (value == null) return false
  const normalized = String(value).trim().toLowerCase()
  return normalized === 'yes' || normalized === 'yws' || normalized === 'y' || normalized === 'true' || normalized === '1'
}

function hasReaction(shiny) {
  if (!shiny) return false
  return isTruthyFlag(shiny.Reaction) && Boolean(String(shiny['Reaction Link'] || '').trim())
}

export default function ShinyShowcase() {
  useDocumentHead({
    title: '闪光收藏展示－Team Synergy PokeMMO 社区',
    description: '浏览 Team Synergy 140 多位成员的闪光收藏。使用图鉴追踪完成度、观看 Twitch 直播，并参与社区活动。',
    canonicalPath: '/shiny-showcase/',
    robots: 'index, follow, max-image-preview:large',
  })
  const { data, isLoading, error } = useDatabase()
  const [search, setSearch] = useState('')
  const [activeShinyFilters, setActiveShinyFilters] = useState([])
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
    // Lowercase all keys for case-insensitive comparison
    const result = {}
    if (streamers) {
      Object.entries(streamers).forEach(([key, value]) => {
        result[key.toLowerCase()] = value
      })
    }
    if (twitchData) {
      for (const s of [...twitchData.live, ...twitchData.offline]) {
        const key = s.twitch_username?.toLowerCase()
        if (key && !result[key]) {
          result[key] = s
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

  const playersWithFilteredShinies = useMemo(() => {
    if (!activeShinyFilters.length) return filteredPlayers

    return filteredPlayers.map(([player, playerData]) => {
      const shinies = Object.entries(playerData?.shinies || {})
      const filteredShinies = Object.fromEntries(
        shinies.filter(([, shiny]) => {
          return activeShinyFilters.some(filterKey => {
            if (filterKey === 'Reaction') return hasReaction(shiny)
            return isTruthyFlag(shiny?.[filterKey])
          })
        })
      )
      const matchingShinyCount = Object.keys(filteredShinies).length

      if (!matchingShinyCount) return null

      return [
        player,
        {
          ...playerData,
          shinies: filteredShinies,
          shiny_count: matchingShinyCount,
        },
      ]
    }).filter(Boolean)
  }, [filteredPlayers, activeShinyFilters])

  const toggleShinyFilter = useCallback((filterKey) => {
    setActiveShinyFilters((prev) => (
      prev.includes(filterKey)
        ? prev.filter((key) => key !== filterKey)
        : [...prev, filterKey]
    ))
  }, [])

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(INITIAL_COUNT)
  }, [search, activeShinyFilters])

  // Create rank map for O(1) lookup instead of O(n) findIndex on every render
  const rankMap = useMemo(() => {
    const map = new Map()
    sortedPlayers.forEach(([player], index) => {
      map.set(player, index)
    })
    return map
  }, [sortedPlayers])

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + BATCH_SIZE, playersWithFilteredShinies.length))
  }, [playersWithFilteredShinies.length])

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

  const playersToShow = playersWithFilteredShinies.slice(0, visibleCount)
  const hasMore = visibleCount < playersWithFilteredShinies.length

  return (
    <div>
      <h1 className="seo-optimized">
        闪光收藏展示－Team Synergy PokeMMO 收藏
      </h1>
      <p className="seo-intro">
        浏览 {playersWithFilteredShinies.length} 位 Team Synergy 成员的闪光收藏。使用图鉴追踪完成度，查找刷闪地点，并欣赏社区中的珍稀闪光宝可梦。
      </p>

      <img src={getAssetUrl('images/pagebreak.png')} alt="分隔线" className="pagebreak" />

      <div className={styles.videoContainer}>
        <h2>
          <a href="https://www.youtube.com/watch?v=G5zh-xZs-eg" target="_blank" rel="noopener noreferrer">
            观看我们的闪光收藏展示视频！
          </a>
        </h2>
        <a href="https://www.youtube.com/watch?v=G5zh-xZs-eg" target="_blank" rel="noopener noreferrer">
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
      <div className={styles.shinyFilters}>
        {SHINY_FILTERS.map((filter) => {
          const isActive = activeShinyFilters.includes(filter.key)
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => toggleShinyFilter(filter.key)}
              className={`${styles.filterChip} ${isActive ? styles.filterChipActive : ''}`}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

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
