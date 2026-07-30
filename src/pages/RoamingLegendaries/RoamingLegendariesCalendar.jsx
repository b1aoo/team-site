import { Link } from 'react-router-dom'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import roamingLegendariesData from '../../data/roaming_legendaries.json'
import { translatePokemonName } from '../../utils/pokemon'
import styles from './RoamingLegendariesCalendar.module.css'

export default function RoamingLegendariesCalendar() {
  const currentMonth = new Date().getMonth()
  const breadcrumbs = [
    { name: '首页', url: '/' },
    { name: 'PokeMMO 图鉴', url: '/pokedex' },
    { name: '游走传说宝可梦日历', url: '/roaming-legendaries' }
  ]


  useDocumentHead({
    title: '游走传说宝可梦日历－PokeMMO 闪电鸟、急冻鸟、火焰鸟、炎帝、水君与雷公出现时间',
    description: 'PokeMMO 游走传说宝可梦日历：查看闪电鸟、火焰鸟、急冻鸟、炎帝、水君与雷公的月度出现安排，规划你的刷闪行程。',
    canonicalPath: '/roaming-legendaries/',
    breadcrumbs: breadcrumbs
  })

  const getLegenariesForMonth = (monthIndex) => {
    return roamingLegendariesData.legendaries.filter(legendary => 
      legendary.months.includes(monthIndex)
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>游走传说宝可梦日历</h1>
        <p className={styles.subtitle}>
          查看 PokeMMO 每月可遇到的游走传说宝可梦。
        </p>
      </div>

      <div className={styles.backLinkWrapper}>
        <Link to="/" className={styles.backLink}>
          ← 返回首页
        </Link>
      </div>

      <div className={styles.calendarGrid}>
        {roamingLegendariesData.months.map((month, monthIndex) => {
          const legendaries = getLegenariesForMonth(monthIndex)
          const isCurrentMonth = monthIndex === currentMonth
          
          return (
            <div 
              key={month} 
              className={`${styles.monthCard} ${isCurrentMonth ? styles.currentMonth : ''}`}
            >
              <h2 className={styles.monthTitle}>{new Date(2026, monthIndex).toLocaleString('zh-CN', { month: 'long' })}</h2>
              
              <div className={styles.legendariesContainer}>
                {legendaries.map(legendary => (
                  <Link
                    key={legendary.id}
                    to={`/pokemon/${legendary.id.toLowerCase()}/`}
                    className={styles.legendaryEntry}
                  >
                    <img
                      src={`https://img.pokemondb.net/sprites/black-white/anim/shiny/${legendary.id.toLowerCase()}.gif`}
                      alt={translatePokemonName(legendary.name)}
                      className={styles.legendaryGif}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                    <div className={styles.legendaryNameContainer}>
                      <img
                        src={`${import.meta.env.BASE_URL}images/pokemon_gifs/tier_7/${legendary.id}.gif`}
                        alt={translatePokemonName(legendary.name)}
                        className={styles.legendaryNameGif}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                      <span>{translatePokemonName(legendary.name)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
