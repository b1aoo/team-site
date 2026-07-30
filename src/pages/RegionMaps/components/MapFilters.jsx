import styles from '../RegionMaps.module.css'
import { translateEncounterTerm, translateRegionName, translateTypeName } from '../../../utils/pokemonTermsZh'

export default function MapFilters({
  filters,
  onChangeFilters,
  availableTypes,
  availableRarities,
  shinyTierOptions,
  regionName,
  debugMode,
  onChangeDebugMode,
}) {
  return (
    <section className={styles.panelCard}>
      <h2 className={styles.panelTitle}>筛选</h2>
      <p className={styles.panelSubtle}>正在显示 {translateRegionName(regionName)} 的数据</p>

      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={filters.showSpawns}
          onChange={(event) => onChangeFilters({ showSpawns: event.target.checked })}
        />
        显示宝可梦出现筛选
      </label>

      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={filters.showMarkers}
          onChange={(event) => onChangeFilters({ showMarkers: event.target.checked })}
        />
        显示城市／地标标记
      </label>

      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={filters.showPaths}
          onChange={(event) => onChangeFilters({ showPaths: event.target.checked })}
        />
        显示建议路线
      </label>

      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={debugMode}
          onChange={(event) => onChangeDebugMode(event.target.checked)}
        />
        调试模式（坐标选择）
      </label>

      <div className={styles.controlBlock}>
        <label className={styles.controlLabel} htmlFor="pokemon-name-filter">宝可梦名称</label>
        <input
          id="pokemon-name-filter"
          className={styles.textInput}
          placeholder="如：皮卡丘"
          value={filters.pokemonSearch}
          onChange={(event) => onChangeFilters({ pokemonSearch: event.target.value })}
        />
      </div>

      <div className={styles.controlBlock}>
        <p className={styles.controlLabel}>属性</p>
        <div className={styles.chipGrid}>
          {availableTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={`${styles.chip} ${filters.types.has(type) ? styles.chipActive : ''}`}
              onClick={() => onChangeFilters({ typeToggle: type })}
            >
              {translateTypeName(type)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.controlBlock}>
        <p className={styles.controlLabel}>出现率</p>
        <div className={styles.chipGrid}>
          {availableRarities.map((rarity) => (
            <button
              key={rarity}
              type="button"
              className={`${styles.chip} ${filters.rarities.has(rarity) ? styles.chipActive : ''}`}
              onClick={() => onChangeFilters({ rarityToggle: rarity })}
            >
              {translateEncounterTerm(rarity)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.controlBlock}>
        <p className={styles.controlLabel}>闪光阶级</p>
        <div className={styles.chipGrid}>
          {shinyTierOptions.map((tier) => (
            <button
              key={tier}
              type="button"
              className={`${styles.chip} ${filters.shinyTiers.has(tier) ? styles.chipActive : ''}`}
              onClick={() => onChangeFilters({ shinyTierToggle: tier })}
            >
              阶级 {tier}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
