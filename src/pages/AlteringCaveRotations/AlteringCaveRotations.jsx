import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import { useInGameClock } from '../../hooks/useInGameClock'
import { getAssetUrl } from '../../utils/assets'
import {
  DAY_OFFSET,
  ALTERING_CAVE_MOVE_SUMMARY,
  IN_GAME_DAYS,
  formatRotationDuration,
  getAlteringCaveRotationState,
  getAlteringCaveMoveWarning,
  getMsUntilAlteringCaveRotation,
} from '../../utils/alteringCave'
import { getLocalPokemonGif, normalizePokemonName, onGifError, translatePokemonName } from '../../utils/pokemon'
import { translateEncounterTerm } from '../../utils/pokemonTermsZh'
import alteringCaveData from '../../data/altering_cave_rotations.json'
import styles from './AlteringCaveRotations.module.css'

function formatInGameTime(clock) {
  return `${String(clock.hours).padStart(2, '0')}:${String(clock.mins).padStart(2, '0')}`
}

function getRarityClass(rarity) {
  if (rarity === 'Very Rare') return styles.rarityVeryRare
  if (rarity === 'Rare') return styles.rarityRare
  if (rarity === 'Uncommon') return styles.rarityUncommon
  return styles.rarityCommon
}

function sortByCommonness(a, b) {
  return b.rate - a.rate || a.name.localeCompare(b.name)
}

function PokemonCard({ pokemon, repelOnly }) {
  const statLabel = repelOnly ? pokemon.repelTrickRarity : `${pokemon.rate}%`
  const statClass = repelOnly ? getRarityClass(pokemon.repelTrickRarity) : styles.rateBadge
  const moveWarning = getAlteringCaveMoveWarning(pokemon.name)

  return (
    <Link to={`/pokemon/${normalizePokemonName(pokemon.name)}/`} className={styles.pokemonCard}>
      {moveWarning && <span className={styles.moveWarning}>{moveWarning}</span>}
      <img
        src={getLocalPokemonGif(pokemon.name)}
        alt={translatePokemonName(pokemon.name)}
        className={styles.pokemonGif}
        onError={onGifError(pokemon.name, false)}
        loading="lazy"
      />
      <span className={styles.pokemonName}>{translatePokemonName(pokemon.name)}</span>
      <span className={styles.levelRange}>Lv.{pokemon.levelRange[0]}–{pokemon.levelRange[1]}</span>
      <span className={`${styles.statBadge} ${statClass}`}>{translateEncounterTerm(statLabel)}</span>
    </Link>
  )
}

function RotationPanel({ cycle, isCurrent, repelOnly, showTimeUntil, timeUntil }) {
  const visiblePokemon = repelOnly
    ? cycle.pokemon.filter((pokemon) => pokemon.repelTrickRarity).sort(sortByCommonness)
    : [...cycle.pokemon].sort(sortByCommonness)

  return (
    <section className={`${styles.rotationPanel} ${isCurrent ? styles.currentPanel : ''}`}>
      <div className={styles.rotationHeader}>
        <div>
          <h2>第 {cycle.cycle} 轮轮换</h2>
          <p>{cycle.repelTrick ? `喷雾剂技巧：Lv.${cycle.repelLevel}` : '暂无喷雾剂技巧路线'}</p>
        </div>
        <div className={styles.rotationStatus}>
          {showTimeUntil && (
            <div className={styles.timeUntil}>
              <span>距该轮换</span>
              <strong>{timeUntil === 0 ? '当前生效' : formatRotationDuration(timeUntil)}</strong>
            </div>
          )}
          {isCurrent && <span className={styles.currentBadge}>当前轮换</span>}
        </div>
      </div>

      {visiblePokemon.length > 0 ? (
        <div className={styles.pokemonGrid}>
          {visiblePokemon.map((pokemon) => (
            <PokemonCard key={pokemon.name} pokemon={pokemon} repelOnly={repelOnly} />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>100% 超音蝠</div>
      )}
    </section>
  )
}

export default function AlteringCaveRotations() {
  const [repelOnly, setRepelOnly] = useState(false)
  const [viewAll, setViewAll] = useState(false)
  const clock = useInGameClock(DAY_OFFSET, IN_GAME_DAYS)
  const rotationState = getAlteringCaveRotationState()

  useDocumentHead({
    title: '变化洞窟轮换｜PokeMMO 刷闪',
    description: '追踪 PokeMMO 变化洞窟轮换、喷雾剂技巧目标、等级条件与轮换倒计时。',
    canonicalPath: '/altering-cave-rotations/',
    breadcrumbs: [
      { name: '首页', url: '/' },
      { name: '变化洞窟轮换', url: '/altering-cave-rotations/' },
    ],
  })

  const activeCycle = useMemo(
    () => alteringCaveData.cycles.find((cycle) => cycle.cycle === rotationState.rotation) || alteringCaveData.cycles[0],
    [rotationState.rotation]
  )
  const displayedCycles = viewAll ? alteringCaveData.cycles : [activeCycle]

  return (
    <div className={styles.page}>
      <h1>变化洞窟轮换</h1>
      <div className={styles.credit}>
        资料鸣谢：
        <a href="https://forums.pokemmo.com/index.php?/topic/144715-altering-cave-with-repel-trick/" target="_blank" rel="noopener noreferrer">
          pikabuuh
        </a>
      </div>
      <img src={getAssetUrl('images/pagebreak.png')} alt="分隔线" className="pagebreak" />

      <section className={styles.clockPanel}>
        <div className={styles.clockTime}>{formatInGameTime(clock)}</div>
        <div className={styles.clockDetails}>
          <span>{clock.day}</span>
          <span className={styles.periodBadge}>{clock.period}</span>
          <span>第 {rotationState.rotation} 轮轮换</span>
        </div>
        <div className={styles.swapTimer}>
          <span>距下次轮换</span>
          <strong>{formatRotationDuration(rotationState.msUntilSwap)}</strong>
        </div>
      </section>

      <div className={styles.controls}>
        <label className={styles.checkboxControl}>
          <input
            type="checkbox"
            checked={repelOnly}
            onChange={(event) => setRepelOnly(event.target.checked)}
          />
          <span>仅看喷雾剂技巧</span>
        </label>
        <button type="button" className={styles.viewAllButton} onClick={() => setViewAll((value) => !value)}>
          {viewAll ? '只看当前轮换' : '查看全部轮换'}
        </button>
      </div>

      <details className={styles.moveSummary}>
        <summary>招式与捕捉注意事项</summary>
        <div className={styles.moveSummaryContent}>
          {ALTERING_CAVE_MOVE_SUMMARY.map((entry) => (
            <div key={entry.pokemon} className={styles.moveSummaryItem}>
              <strong>{translatePokemonName(entry.pokemon)}：</strong>
              <span>{entry.summary}</span>
            </div>
          ))}
        </div>
      </details>

      <div className={styles.rotationList}>
        {displayedCycles.map((cycle) => (
          <RotationPanel
            key={cycle.cycle}
            cycle={cycle}
            isCurrent={cycle.cycle === rotationState.rotation}
            repelOnly={repelOnly}
            showTimeUntil={viewAll}
            timeUntil={getMsUntilAlteringCaveRotation(cycle.cycle, rotationState)}
          />
        ))}
      </div>
    </div>
  )
}
