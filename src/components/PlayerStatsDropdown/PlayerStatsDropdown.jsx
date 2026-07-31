import { useState, useRef, useEffect } from 'react'
import styles from './PlayerStatsDropdown.module.css'
import { translatePokemonName } from '../../utils/pokemon'
import { translateLocationName } from '../../utils/pokemonTermsZh'

export default function PlayerStatsDropdown({ winners, data }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  if (!winners) return null

  useEffect(() => {
    const handleClickAway = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('click', handleClickAway)
      return () => document.removeEventListener('click', handleClickAway)
    }
  }, [isOpen])

  const stats = [
    {
      title: '最欧皇训练家',
      subtitle: '平均每只闪光的遇敌次数最低',
      player: winners.luckiest,
      value: `平均 ${winners.luckiest.averageEncounter.toFixed(0)} 次遭遇`,
    },
    {
      title: '最非酋训练家',
      subtitle: '平均每只闪光的遇敌次数最高',
      player: winners.unluckiest,
      value: `平均 ${winners.unluckiest.averageEncounter.toFixed(0)} 次遭遇`,
    },
    {
      title: '最长未闪纪录',
      subtitle: '单只闪光所需遭遇次数最高',
      player: winners.highestDryStreak,
      value: `${winners.highestDryStreak.maxEncounter.toLocaleString()} 次遭遇`,
      pokemon: winners.highestDryStreak.maxEncounterPokemon,
    },
    {
      title: '最快出闪纪录',
      subtitle: '单只闪光所需遭遇次数最低',
      player: winners.leastEncounter,
      value: `${winners.leastEncounter.minEncounter.toLocaleString()} 次遭遇`,
      pokemon: winners.leastEncounter.minEncounterPokemon,
    },
    {
      title: '稀有闪光最多',
      subtitle: '第 0、1、2 级闪光数量最多',
      player: winners.mostRares,
      value: `${winners.mostRares.rareCount} 只稀有闪光`,
      pokemons: winners.mostRares.rarePokemons,
    },
    {
      title: '同地点相位最多',
      subtitle: '在同一地点获得的闪光数量最多',
      player: winners.mostPhases,
      value: `${winners.mostPhases.phasesCount} 只闪光`,
      route: winners.mostPhases.topRoute,
    },
    {
      title: '单周闪光最多',
      subtitle: '连续 7 天内获得的闪光数量最多',
      player: winners.mostInWeek,
      value: `${winners.mostInWeek.mostInWeekCount} 只闪光`,
      pokemons: winners.mostInWeek.mostInWeekPokemons,
    },
  ]

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.button}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="展开或收起玩家统计"
      >
        玩家排行榜 {isOpen ? '▼' : '►'}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {stats.map((stat, index) => (
            <div key={index} className={styles.statItem}>
              <div className={styles.title}>{stat.title}</div>
              <div className={styles.subtitle}>{stat.subtitle}</div>
              <div className={styles.content}>
                <div className={styles.playerName}>{stat.player.name}</div>
                <div className={styles.value}>{stat.value}</div>
                {stat.pokemon && (
                  <div className={styles.pokemon}>
                    宝可梦：<strong>{translatePokemonName(stat.pokemon)}</strong>
                  </div>
                )}
                {stat.pokemons && stat.pokemons.length > 0 && (
                  <div className={styles.pokemons}>
                    宝可梦：<strong>{stat.pokemons.map(translatePokemonName).join('、')}</strong>
                  </div>
                )}
                {stat.route && (
                  <div className={styles.route}>
                    最多地点：<strong>{translateLocationName(stat.route)}</strong>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
