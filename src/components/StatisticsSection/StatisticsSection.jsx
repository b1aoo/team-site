import { useState, useMemo } from 'react'
import styles from './StatisticsSection.module.css'
import GraphZoomModal from './GraphZoomModal'
import ZoomableChart from './ZoomableChart'
import HoverTooltip from './HoverTooltip'
import tierPokemonData from '../../data/tier_pokemon.json'
import { getLocalPokemonGif, onGifError, translatePokemonName } from '../../utils/pokemon'
import { translateEncounterTerm, translateRegionName } from '../../utils/pokemonTermsZh'

export default function StatisticsSection({ playerData, playerName, sectionFlags = {} }) {
  const [statsExpanded, setStatsExpanded] = useState(false)
  const [statsClosing, setStatsClosing] = useState(false)
  const [zoomModalOpen, setZoomModalOpen] = useState(false)
  const [zoomModalContent, setZoomModalContent] = useState(null)
  const [zoomModalTitle, setZoomModalTitle] = useState('')

  const {
    showEncounterSections = true,
    showLocationSections = true,
    showMethodSections = true,
  } = sectionFlags

  const stats = useMemo(() => {
    if (!playerData || !playerData.shinies || Object.keys(playerData.shinies).length === 0) {
      return null
    }

    const shinies = Object.values(playerData.shinies)

    const shiniesWithEncounters = shinies.filter(
      s => typeof s.encounter_count === 'number' && s.encounter_count > 0
    )

    const totalEncounters = shiniesWithEncounters.reduce(
      (sum, s) => sum + (s.encounter_count || 0),
      0
    )
    const avgEncounters =
      shiniesWithEncounters.length > 0
        ? Math.round(totalEncounters / shiniesWithEncounters.length)
        : 0

    const maxEncounterPokemon =
      shiniesWithEncounters.length > 0
        ? shiniesWithEncounters.reduce((max, s) =>
            (s.encounter_count || 0) > (max.encounter_count || 0) ? s : max
          )
        : null

    const minEncounterPokemon =
      shiniesWithEncounters.length > 0
        ? shiniesWithEncounters.reduce((min, s) =>

            (s.encounter_count || 0) > 0 && (s.encounter_count || Number.MAX_VALUE) < (min.encounter_count || Number.MAX_VALUE)
              ? s
              : min
          )
        : null


    const methodCounts = {}
    shinies.forEach(s => {
      const method = s.encounter_method || 'Unknown'
      if (!methodCounts[method]) {
        methodCounts[method] = {
          count: 0,
          totalEncounters: 0,
          avgEncounters: 0
        }
      }
      methodCounts[method].count += 1
      methodCounts[method].totalEncounters += s.encounter_count || 0
    })

    Object.keys(methodCounts).forEach(method => {
      methodCounts[method].avgEncounters = 
        methodCounts[method].count > 0
          ? Math.round(methodCounts[method].totalEncounters / methodCounts[method].count)
          : 0
    })


    const validRegions = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova']
    const regionCounts = {}
    validRegions.forEach(region => {
      regionCounts[region] = 0
    })

    shinies.forEach(s => {
      if (s.location && typeof s.location === 'string') {
        const firstWord = s.location.split('-')[0].trim()
        if (validRegions.includes(firstWord)) {
          regionCounts[firstWord]++
        }
      }
    })

    const topRegion = Object.entries(regionCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])[0] || null


    const tierCounts = {}
    Object.keys(tierPokemonData).forEach(tier => {
      tierCounts[tier] = 0
    })

    shinies.forEach(s => {
      const pokemonName = s.Pokemon?.toLowerCase() || ''
      for (const [tier, pokemonList] of Object.entries(tierPokemonData)) {
        if (pokemonList.includes(pokemonName)) {
          tierCounts[tier]++
          break
        }
      }
    })

    return {
      totalShinies: shinies.length,
      shinyCount: shiniesWithEncounters.length,
      totalEncounters,
      avgEncounters,
      maxEncounterPokemon,
      minEncounterPokemon,
      methodCounts,
      regionCounts,
      topRegion,
      tierCounts,
      shiniesWithEncounters,
      allShinies: shinies,
      missingPokemon: shinies.filter(s => !s.encounter_count || s.encounter_count === 0),
    }
  }, [playerData])

  if (!stats) return null

  const toggleStats = () => {
    if (statsExpanded) {

      setStatsClosing(true)
      setTimeout(() => {
        setStatsExpanded(false)
        setStatsClosing(false)
      }, 300)
    } else {
      setStatsExpanded(true)
      setStatsClosing(false)
    }
  }


  const NestedCategory = ({ title, icon, children }) => (
    <div className={styles.nestedCategory}>
      <div className={styles.categoryHeader}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.title}>{title}</span>
        <span className={`${styles.arrow} ${statsExpanded ? styles.expanded : ''}`}>
          ▼
        </span>
      </div>
      <div className={styles.categoryContent}>
        {children}
      </div>
    </div>
  )


  const StatCard = ({ label, value, subtext }) => (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {subtext && <div className={styles.statSubtext}>{subtext}</div>}
    </div>
  )

  const BarChart = ({ data, maxValue, title, pokemonData = null }) => {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    const chartHeight = isMobile ? 350 : 280
    const barWidth = Math.max(40, Math.min(80, 600 / entries.length))
    const padding = 60
    const pokemonSize = 50

    // Helper to find pokemon name from label (nickname or pokemon name)
    const getPokemonNameFromLabel = (label) => {
      if (!pokemonData) return label
      const pokemon = pokemonData.find(p => p.nickname === label || p.Pokemon === label)
      return pokemon ? pokemon.Pokemon : label
    }

    return (
      <div className={styles.chartContainer}>
        <h4 className={styles.chartTitle}>{title}</h4>
        <svg
          viewBox={`0 0 ${entries.length * barWidth + padding * 2} ${chartHeight + padding * 2.5 + pokemonSize + 30}`}
          className={styles.chart}
        >

          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = chartHeight * (1 - ratio) + padding
            return (
              <line
                key={`grid-${i}`}
                x1={padding}
                y1={y}
                x2={entries.length * barWidth + padding}
                y2={y}
                stroke="#333"
                strokeWidth="1"
                opacity="0.3"
              />
            )
          })}


          {entries.map(([label, value], i) => {
            const barHeight = (value / maxValue) * chartHeight
            const x = padding + i * barWidth + barWidth * 0.1
            const y = chartHeight - barHeight + padding
            const pokemonName = getPokemonNameFromLabel(label)
            const gifUrl = pokemonData ? getLocalPokemonGif(pokemonName) : null
            const truncatedLabel = label.length > 20 ? label.substring(0, 17) + '...' : label
            return (
              <g key={`bar-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth * 0.8}
                  height={barHeight}
                  fill="#9b59b6"
                  rx="4"
                  opacity="0.9"
                />
                <text
                  x={x + barWidth * 0.4}
                  y={y - 8}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#d2b4de"
                  fontWeight="bold"
                >
                  {value}
                </text>

                {gifUrl && (
                  <foreignObject
                    x={x + barWidth * 0.1}
                    y={chartHeight + padding + 15}
                    width={barWidth * 0.8}
                    height={pokemonSize}
                    style={{ overflow: 'visible' }}
                  >
                    <img
                      src={gifUrl}
                      alt={label}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        imageRendering: 'pixelated',
                      }}
                      onError={onGifError(pokemonName, true)}
                    />
                  </foreignObject>
                )}
                {!gifUrl && (
                  <g transform={`translate(${x + barWidth * 0.4}, ${chartHeight + padding + 15})`}>
                    <text
                      x="0"
                      y="0"
                      textAnchor="start"
                      fontSize="12"
                      fill="#fff"
                      className={styles.chartLabel}
                      style={{ whiteSpace: 'nowrap' }}
                      transform="rotate(45)"
                    >
                      {truncatedLabel}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          <line x1={padding} y1={padding} x2={padding} y2={chartHeight + padding} stroke="#fff" strokeWidth="2" />
          <line x1={padding} y1={chartHeight + padding} x2={entries.length * barWidth + padding} y2={chartHeight + padding} stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
    )
  }


  const PieChart = ({ data, title, customColors }) => {
    const entries = Object.entries(data)
    const total = entries.reduce((sum, [, v]) => sum + v, 0)
    const defaultColors = [
      '#ffd700',
      '#c084fc',
      '#60a5fa',
      '#4ade80',
      '#2dd4bf',
      '#fb923c',
      '#94a3b8',
      '#cbd5e1',
    ]
    const colors = customColors || defaultColors
    const centerX = 150
    const centerY = 150
    const radius = 120

    let currentAngle = -Math.PI / 2

    const slices = entries.map(([label, value], i) => {
      const sliceAngle = (value / total) * Math.PI * 2
      const startAngle = currentAngle
      const endAngle = currentAngle + sliceAngle

      const x1 = centerX + radius * Math.cos(startAngle)
      const y1 = centerY + radius * Math.sin(startAngle)
      const x2 = centerX + radius * Math.cos(endAngle)
      const y2 = centerY + radius * Math.sin(endAngle)

      const largeArc = sliceAngle > Math.PI ? 1 : 0
      const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

      const labelAngle = startAngle + sliceAngle / 2
      const labelX = centerX + (radius * 0.65) * Math.cos(labelAngle)
      const labelY = centerY + (radius * 0.65) * Math.sin(labelAngle)

      currentAngle = endAngle

      return { label, value, path, labelX, labelY, color: colors[i % colors.length], percentage: ((value / total) * 100).toFixed(1) }
    })

    return (
      <div className={styles.chartContainer}>
        <h4 className={styles.chartTitle}>{title}</h4>
        <div className={styles.pieChartWrapper}>
          <svg viewBox="0 0 320 320" className={styles.pieChart}>
            {slices.map((slice, i) => (
              <g key={`slice-${i}`}>
                <path d={slice.path} fill={slice.color} opacity="0.9" />
                {slice.percentage > 5 && (
                  <text
                    x={slice.labelX}
                    y={slice.labelY}
                    textAnchor="middle"
                    dy="0.3em"
                    fontSize="12"
                    fill="#000"
                    fontWeight="bold"
                  >
                    {slice.percentage}%
                  </text>
                )}
              </g>
            ))}
          </svg>
          <div className={styles.pieLegend}>
            {slices.map((slice, i) => (
              <div key={`legend-${i}`} className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: slice.color }} />
                <span className={styles.legendLabel}>
                  {slice.label}: {slice.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const EnterpriseDistributionPie = ({ shinies, maxEncounters }) => {
    const buckets = [
      { range: '0-25%', min: 0, max: maxEncounters * 0.25, pokemon: [] },
      { range: '25-50%', min: maxEncounters * 0.25, max: maxEncounters * 0.5, pokemon: [] },
      { range: '50-75%', min: maxEncounters * 0.5, max: maxEncounters * 0.75, pokemon: [] },
      { range: '75-100%', min: maxEncounters * 0.75, max: maxEncounters, pokemon: [] },
    ]

    shinies.forEach(s => {
      const encounters = s.encounter_count || 0
      for (const bucket of buckets) {
        if (encounters >= bucket.min && encounters <= bucket.max) {
          bucket.pokemon.push(s)
          break
        }
      }
    })

    const data = {}
    const colors = ['#ffd700', '#c084fc', '#60a5fa', '#fb923c']
    
    buckets.forEach((bucket, i) => {
      const count = bucket.pokemon.length
      if (count > 0) {
        const minEnc = Math.round(bucket.min).toLocaleString()
        const maxEnc = Math.round(bucket.max).toLocaleString()
        data[`${bucket.range} (${minEnc}-${maxEnc})`] = count
      }
    })

    const entries = Object.entries(data)
    const total = entries.reduce((sum, [, v]) => sum + v, 0)
    
    const centerX = 150
    const centerY = 150
    const radius = 120

    let currentAngle = -Math.PI / 2

    const slices = entries.map(([label, value], i) => {
      const sliceAngle = (value / total) * Math.PI * 2
      const startAngle = currentAngle
      const endAngle = currentAngle + sliceAngle

      const x1 = centerX + radius * Math.cos(startAngle)
      const y1 = centerY + radius * Math.sin(startAngle)
      const x2 = centerX + radius * Math.cos(endAngle)
      const y2 = centerY + radius * Math.sin(endAngle)

      const largeArc = sliceAngle > Math.PI ? 1 : 0
      const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

      const labelAngle = startAngle + sliceAngle / 2
      const labelX = centerX + (radius * 0.65) * Math.cos(labelAngle)
      const labelY = centerY + (radius * 0.65) * Math.sin(labelAngle)

      currentAngle = endAngle

      return { label, value, path, labelX, labelY, color: colors[i % colors.length], percentage: ((value / total) * 100).toFixed(1) }
    })

    return (
      <div className={styles.pieChartWrapper}>
        <svg viewBox="0 0 320 320" className={styles.pieChart}>
          {slices.map((slice, i) => (
            <g key={`slice-${i}`}>
              <path d={slice.path} fill={slice.color} opacity="0.9" />
              {slice.percentage > 5 && (
                <text
                  x={slice.labelX}
                  y={slice.labelY}
                  textAnchor="middle"
                  dy="0.3em"
                  fontSize="12"
                  fill="#000"
                  fontWeight="bold"
                >
                  {slice.percentage}%
                </text>
              )}
            </g>
          ))}
        </svg>
        <div className={styles.pieLegend}>
          {slices.map((slice, i) => (
            <div key={`legend-${i}`} className={styles.legendItem}>
              <div className={styles.legendColor} style={{ backgroundColor: slice.color }} />
              <span className={styles.legendLabel}>
                {slice.label}: {slice.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const LineChart = ({ data, title }) => {
    const points = data.map((pokemon, i) => ({
      label: pokemon.nickname || pokemon.Pokemon || `Pokémon ${i + 1}`,
      pokemonName: pokemon.Pokemon,
      value: pokemon.encounter_count || 0,
      index: i,
    }))

    if (points.length === 0) return null

    const maxValue = Math.max(...points.map(p => p.value), 1)
    const chartHeight = 200
    const pokemonSize = 60
    const padding = 80
    const bottomSpacing = pokemonSize + 40
    const width = Math.max(800, points.length * 50)

    const xStep = (width - padding * 2) / (points.length - 1 || 1)
    const yScale = chartHeight / maxValue

    // Build path
    let pathD = ''
    points.forEach((point, i) => {
      const x = padding + i * xStep
      const y = chartHeight - point.value * yScale + padding
      pathD += `${i === 0 ? 'M' : 'L'} ${x} ${y} `
    })

    return (
      <div className={styles.chartContainer}>
        <h4 className={styles.chartTitle}>{title}</h4>
        <div className={styles.lineChartWrapper}>
          <svg viewBox={`0 0 ${width} ${chartHeight + padding * 2 + bottomSpacing}`} className={styles.lineChart}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = chartHeight * (1 - ratio) + padding
              return (
                <line
                  key={`grid-${i}`}
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="#333"
                  strokeWidth="1"
                  opacity="0.3"
                />
              )
            })}

            <path d={pathD} stroke="#9b59b6" strokeWidth="2" fill="none" />

            {points.map((point, i) => {
              const x = padding + i * xStep
              const y = chartHeight - point.value * yScale + padding
              const gifUrl = getLocalPokemonGif(point.pokemonName)
              
              return (
                <g key={`point-${i}`}>
                  <circle cx={x} cy={y} r="4" fill="#d2b4de" opacity="0.9" />
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#d2b4de"
                    fontWeight="bold"
                  >
                    {point.value.toLocaleString()}
                  </text>
                  <foreignObject
                    x={x - pokemonSize / 2}
                    y={chartHeight + padding + 20}
                    width={pokemonSize}
                    height={pokemonSize}
                    style={{ overflow: 'visible' }}
                  >
                    <img
                      src={gifUrl}
                      alt={point.label}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        imageRendering: 'pixelated',
                      }}
                      onError={onGifError(point.pokemonName, true)}
                    />
                  </foreignObject>
                </g>
              )
            })}

            <line x1={padding} y1={padding} x2={padding} y2={chartHeight + padding} stroke="#fff" strokeWidth="2" />
            <line x1={padding} y1={chartHeight + padding} x2={width - padding} y2={chartHeight + padding} stroke="#fff" strokeWidth="2" />
          </svg>
        </div>
      </div>
    )
  }

  const EncounterDataTable = ({ data }) => {
    const sortedData = [...data].sort((a, b) => b.encounter_count - a.encounter_count)
    return (
      <div className={styles.encounterTable}>
        <div className={styles.tableHeader}>
          <div className={styles.tableHeaderCell}>宝可梦</div>
          <div className={styles.tableHeaderCell}>遇敌次数</div>
        </div>
        {sortedData.map((pokemon, i) => (
          <div key={i} className={styles.tableRow}>
            <div className={styles.tableCell}>{pokemon.nickname || translatePokemonName(pokemon.Pokemon)}</div>
            <div className={styles.tableCell}>{pokemon.encounter_count?.toLocaleString() || 0}</div>
          </div>
        ))}
      </div>
    )
  }

  // --- Zoom Modal Handler ---
  const openZoomModal = (content, title) => {
    setZoomModalContent(content)
    setZoomModalTitle(title)
    setZoomModalOpen(true)
  }

  return (
      <div className={styles.statisticsSection}>
      <h2 className={styles.mainTitle}>📊 闪光统计</h2>

      {/* Missing Pokémon Info - above dropdown */}
      {stats.missingPokemon.length > 0 && (
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
          <HoverTooltip
            content={
              <div style={{ maxWidth: 350 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  以下宝可梦缺少统计所需资料：
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', fontSize: 14 }}>
                  {stats.missingPokemon.map((p, idx) => {
                    const missingFields = [];
                    if (!p.encounter_count || p.encounter_count === 0) missingFields.push('encounter');
                    if (!p.location) missingFields.push('location');
                     if (!p.type && !p.types) missingFields.push('method');
                    return (
                      <div key={idx} style={{ marginBottom: 2 }}>
                        • {translatePokemonName(p.Pokemon)}
                        {missingFields.length > 0 && (
                          <span style={{ color: '#ffb6b6', fontSize: 13, marginLeft: 4 }}>
                            （{missingFields.map(field => ({ encounter: '遇敌次数', location: '地点', method: '遇敌方式' })[field]).join('、')}）
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            }
          >
            <span style={{ color: '#ffa8a8', fontWeight: 600, cursor: 'pointer', borderBottom: '1px dotted #ef4444' }}>
              有 {stats.missingPokemon.length} 只宝可梦需要补充遇敌资料，才能显示完整统计。
            </span>
          </HoverTooltip>
        </div>
      )}

      {/* Main Statistics Dropdown */}
      <div className={styles.mainStatsDropdown}>
        <button
          className={styles.mainStatsButton}
          onClick={toggleStats}
        >
          <span className={styles.icon}>📈</span>
          <span className={styles.title}>统计面板</span>
          <span className={`${styles.arrow} ${statsExpanded ? styles.expanded : ''}`}>
            ▼
          </span>
        </button>
        {statsExpanded && (
          <div className={`${styles.mainStatsContent} ${statsClosing ? styles.closing : ''}`}>
          <div style={{ marginBottom: '1rem'}}>
            <a href="https://www.shinyboard.net/" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline', fontWeight: 'bold' }}>
              遇敌数据由 Shinyboard API 提供
            </a>
          </div>
            {showEncounterSections && (
            <NestedCategory
              title={`综合统计（${stats.shinyCount}/${stats.totalShinies}）`}
              icon="📊"
            >
              <div className={styles.statsGrid}>
                <StatCard label="总遇敌次数" value={stats.totalEncounters.toLocaleString()} />
                <StatCard 
                  label="每只闪光平均遇敌"
                  value={stats.avgEncounters.toLocaleString()} 
                  subtext={`已记录 ${stats.shinyCount}/${stats.totalShinies} 只`}
                />
                <StatCard
                  label="遇敌次数最多"
                  value={stats.maxEncounterPokemon?.Pokemon ? translatePokemonName(stats.maxEncounterPokemon.Pokemon) : '暂无'}
                  subtext={`${stats.maxEncounterPokemon?.encounter_count.toLocaleString() || 0} 次遇敌`}
                />
                <StatCard
                  label="遇敌次数最少"
                  value={stats.minEncounterPokemon?.Pokemon ? translatePokemonName(stats.minEncounterPokemon.Pokemon) : '暂无'}
                  subtext={`${stats.minEncounterPokemon?.encounter_count.toLocaleString() || 0} 次遇敌`}
                />
                {showLocationSections && (
                  <StatCard
                    label="闪光最多地区"
                    value={translateRegionName(stats.topRegion?.[0]) || '暂无'}
                    subtext={`${stats.topRegion?.[1] || 0} 只闪光`}
                  />
                )}
              </div>
            </NestedCategory>
            )}

            {/* Hunting Methods Category */}
            {showMethodSections && (
            <NestedCategory title="刷闪方式" icon="🎣">
              <div className={styles.methodsTable}>
                <div className={styles.methodsHeader}>
                  <div className={styles.methodsHeaderCell}>方式</div>
                  <div className={styles.methodsHeaderCell}>数量</div>
                  <div className={styles.methodsHeaderCell}>占比</div>
                  <div className={styles.methodsHeaderCell}>总遇敌</div>
                  <div className={styles.methodsHeaderCell}>平均遇敌 / 闪光</div>
                </div>
                {Object.entries(stats.methodCounts)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([method, data]) => (
                    <div key={method} className={styles.methodsRow}>
                      <div className={styles.methodsCell}>{translateEncounterTerm(method)}</div>
                      <div className={styles.methodsCell}>{data.count}</div>
                      <div className={styles.methodsCell}>{((data.count / stats.totalShinies) * 100).toFixed(1)}%</div>
                      <div className={styles.methodsCell}>{data.totalEncounters.toLocaleString()}</div>
                      <div className={styles.methodsCell}>{data.avgEncounters.toLocaleString()}</div>
                    </div>
                  ))}
              </div>
            </NestedCategory>
            )}

            {/* Region Stats Category */}
            {showLocationSections && (
            <NestedCategory title="地区分布" icon="🗺️">
              <PieChart data={Object.fromEntries(Object.entries(stats.regionCounts).map(([region, count]) => [translateRegionName(region), count]))} title="各地区闪光数" />
            </NestedCategory>
            )}

            {/* Encounter Charts Category */}
            {showEncounterSections && stats.shiniesWithEncounters.length > 0 && (
              <NestedCategory
                title={`遇敌分析（${stats.shinyCount} 只宝可梦）`}
                icon="📉"
              >
                <div className={styles.encounterGraphsDesktop}>
                  <div 
                    onClick={() => openZoomModal(
                      <ZoomableChart>
                        <BarChart
                          data={stats.shiniesWithEncounters.reduce((acc, s) => {
                            acc[s.nickname || s.Pokemon] = s.encounter_count
                            return acc
                          }, {})}
                          maxValue={Math.max(...stats.shiniesWithEncounters.map(s => s.encounter_count))}
                          title="每只宝可梦的遇敌次数"
                          pokemonData={stats.shiniesWithEncounters}
                        />
                      </ZoomableChart>,
                      '每只宝可梦的遇敌次数'
                    )}
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    <BarChart
                      data={stats.shiniesWithEncounters.reduce((acc, s) => {
                        acc[s.nickname || s.Pokemon] = s.encounter_count
                        return acc
                      }, {})}
                      maxValue={Math.max(...stats.shiniesWithEncounters.map(s => s.encounter_count))}
                      title="每只宝可梦的遇敌次数"
                      pokemonData={stats.shiniesWithEncounters}
                    />
                    <div className={styles.zoomIndicator}>
                      👆 点击放大
                    </div>
                  </div>

                  <div 
                    onClick={() => openZoomModal(
                      <ZoomableChart>
                        <LineChart data={stats.shiniesWithEncounters} title="遇敌进度" />
                      </ZoomableChart>,
                      '遇敌进度'
                    )}
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    <LineChart data={stats.shiniesWithEncounters} title="遇敌进度" />
                    <div className={styles.zoomIndicator}>
                      👆 点击放大
                    </div>
                  </div>
                </div>

                <div className={styles.encounterTableMobile}>
                  <div className={styles.graphsButtonContainer}>
                    <button 
                      className={styles.graphsZoomButton}
                      onClick={() => openZoomModal(
                        <ZoomableChart>
                          <BarChart
                            data={stats.shiniesWithEncounters.reduce((acc, s) => {
                              acc[s.nickname || s.Pokemon] = s.encounter_count
                              return acc
                            }, {})}
                            maxValue={Math.max(...stats.shiniesWithEncounters.map(s => s.encounter_count))}
                            title="每只宝可梦的遇敌次数"
                            pokemonData={stats.shiniesWithEncounters}
                          />
                        </ZoomableChart>,
                        '每只宝可梦的遇敌次数'
                      )}
                    >
                      📊 柱状图
                    </button>
                    <button 
                      className={styles.graphsZoomButton}
                      onClick={() => openZoomModal(
                        <ZoomableChart>
                          <LineChart data={stats.shiniesWithEncounters} title="遇敌进度" />
                        </ZoomableChart>,
                        '遇敌进度'
                      )}
                    >
                      📈 折线图
                    </button>
                  </div>
                  <EncounterDataTable data={stats.shiniesWithEncounters} />
                </div>

                {/* Encounter Distribution with Ranges */}
                {stats.maxEncounterPokemon && (
                  <div className={styles.chartContainer}>
                    <h4 className={styles.chartTitle}>遇敌次数分布（从低到高）</h4>
                    <EnterpriseDistributionPie 
                      shinies={stats.shiniesWithEncounters}
                      maxEncounters={stats.maxEncounterPokemon.encounter_count}
                    />
                  </div>
                )}
              </NestedCategory>
            )}

            {/* Tier Distribution Category */}
            {showEncounterSections && Object.values(stats.tierCounts).some(count => count > 0) && (
              <NestedCategory
                title="分层分布"
                icon="⭐"
              >
                <PieChart
                  data={stats.tierCounts}
                  title="各分层宝可梦数量"
                  customColors={['#ffd700', '#c084fc', '#60a5fa', '#4ade80', '#2dd4bf', '#fb923c', '#94a3b8', '#cbd5e1']}
                />
              </NestedCategory>
            )}
          </div>
        )}
      </div>

      <GraphZoomModal
        isOpen={zoomModalOpen}
        onClose={() => setZoomModalOpen(false)}
        title={zoomModalTitle}
      >
        {zoomModalContent}
      </GraphZoomModal>
    </div>
  )
}
