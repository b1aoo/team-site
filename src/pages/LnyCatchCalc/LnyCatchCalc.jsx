import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useDocumentHead } from "../../hooks/useDocumentHead";
import useCatchCalcs, { getCatchRateByName } from "../../hooks/useCatchCalcs";
import lnyPokemon from "../../data/lny_pokemon.json";
import styles from "./LnyCatchCalc.module.css";
import { onGifError, translatePokemonName } from "../../utils/pokemon";
import { translateMoveName } from '../../utils/pokemonTermsZh'
import { API } from "../../api/endpoints";
import pokemonData from "../../data/pokemmo_data/pokemon-data.json";
import { getPokemonDataByName } from "../../utils/getPokemonDataByName";
import { extractLevelUpMoves } from "../../utils/extractLevelUpMoves";
import { getLevelUpMoveset } from "../../utils/levelup-moves";

const LnyCatchCalc = () => {
  const [useLevelBall, setUseLevelBall] = useState(false);
  const { getTopBalls } = useCatchCalcs();
  useDocumentHead({
    title: '农历新年捕捉计算器',
    description:
      '快速计算 PokeMMO 农历新年活动宝可梦的捕捉率与闪光概率，并推荐节省时间和金钱的球种。',
    canonicalPath: "/LnyCatchCalc/",
    ogImage: 'https://b1aoo.github.io/team-site/images/openGraph.jpg',
  });

  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  const filteredPokemon = lnyPokemon.filter((poke) =>
    poke.name.toLowerCase().includes(search.toLowerCase())
  );

  const suggestions =
    search.length > 0
      ? lnyPokemon
          .filter((poke) => poke.name.toLowerCase().startsWith(search.toLowerCase()))
          .slice(0, 8)
      : [];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>农历新年宝可梦捕捉计算器</h1>

      {/* Apricorn guide info box */}
      <div className={styles.infoBox}>
        <p className={styles.infoBoxTitle}>农历新年群聚的球种指引</p>
        <p className={styles.infoBoxMuted}>
          <span className={styles.infoBoxHighlight}>速度球：</span>肯泰罗、大嘴雀、太阳伊布<br />
          <span className={styles.infoBoxHighlight}>友友球：</span>卷卷耳、皮卡丘、利欧路<br />
          <span className={styles.infoBoxHighlight}>月亮球：</span>尼多兰、食梦梦<br />
          催眠且满 HP 时捕捉率为 94.11% — 更低 HP 可达 100%。<br />
          捕捉利欧路时，友友球比高级球便宜；捕获后即可让它进化为路卡利欧！
        </p>
        <p className={styles.infoBoxMuted} style={{ marginTop: '0.5rem' }}>
          等级球能有效捕捉较难捕捉的宝可梦，但成本较高；使用 Lv.30 的宝可梦时效果最佳。勾选后将其纳入计算。
        </p>
        <div className={styles.levelBallRow}>
          <label className={styles.levelBallLabel}>
            <input
              type="checkbox"
              checked={useLevelBall}
              onChange={e => setUseLevelBall(e.target.checked)}
            />
            使用等级球
          </label>
        </div>
        <p className={styles.infoBoxThanks}>感谢 Alisae 提供资料！</p>
      </div>

      <div className={styles.tooltipNote2}>
        <strong>最优方案：</strong>综合捕捉率、所需回合（0–2）与球种成本计算；效果相近时优先选择更便宜的球。
      </div>
      <div className={styles.tooltipNote2}>
        <strong>黑暗球：</strong>仅在游戏内夜晚显示；若当前不是夜晚，则不会出现在可选方案中。
      </div>

      {/* Search */}
      <div className={styles.searchWrapper}>
        <input
          type="text"
          placeholder="搜索宝可梦…"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          className={styles.searchBar}
          aria-label="搜索宝可梦"
          ref={inputRef}
          autoComplete="off"
        />
        {showSuggestions &&
          suggestions.length > 0 &&
          !(suggestions.length === 1 && suggestions[0].name.toLowerCase() === search.toLowerCase()) && (
            <ul className={styles.suggestionList}>
              {suggestions.map((poke) => (
                <li
                  key={poke.name}
                  className={`${styles.suggestionItem} ${poke.name.toLowerCase() === search.toLowerCase() ? styles.suggestionItemActive : ''}`}
                  onClick={() => {
                    setSearch(poke.name);
                    setShowSuggestions(false);
                    inputRef.current && inputRef.current.blur();
                  }}
                >
                  {translatePokemonName(poke.name)}
                </li>
              ))}
            </ul>
          )}
      </div>

      {/* Cards */}
      <div className={styles.flexWrap}>
        {filteredPokemon.length === 0 ? (
          <div className={styles.empty}>未找到宝可梦。</div>
        ) : (
          filteredPokemon.map((poke) => {
            const catchRate = getCatchRateByName(poke.name);
            const pokeData = getPokemonDataByName(poke.name, pokemonData);
            const normalizeName = name => name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-+|-+$/g, '');
            const key = normalizeName(poke.name);
            let types = [];
            if (pokeData?.types) {
              if (Array.isArray(pokeData.types)) {
                types = pokeData.types;
              } else if (typeof pokeData.types === "object") {
                types = Object.values(pokeData.types);
              }
            }

            const [best, second] = getTopBalls(
              catchRate ?? 0,
              30,
              types,
              useLevelBall
            );

            const levelUpMoves = pokeData ? extractLevelUpMoves(pokeData.moves) : [];
            const moveset = getLevelUpMoveset({ level_up_moves: levelUpMoves }, 30);

            return (
              <Link
                key={poke.name}
                to={`/pokemon/${encodeURIComponent(poke.name.toLowerCase())}/`}
                state={{ from: 'LnyCatchCalc' }}
                className={styles.card}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <img
                  src={API.pokemonSprite(poke.name)}
                  alt={translatePokemonName(poke.name)}
                  onError={onGifError(poke.name)}
                  className={styles.pokemon}
                  width="50"
                  height="50"
                  loading="lazy"
                />
                <div className={styles.pokemonName}>{translatePokemonName(poke.name)}</div>
                <div className={styles.catchRate}>
                  基础捕获度：<b>{catchRate !== null && catchRate !== undefined ? catchRate : "?"}</b>
                </div>
                <div className={styles.ballInfo}>
                  <div className={styles.best}>
                    最优：<b>{best?.ball ?? "-"}</b>{" "}
                    {best?.catchChance !== undefined && !isNaN(best.catchChance) ? `(${best.catchChance.toFixed(1)}%)` : ""}
                    <span className={styles.ballDetails}>
                      {best?.hpLabel ?? ""}{best?.statusLabel ? `, ${best.statusLabel}` : ""}
                    </span>
                  </div>
                  <div className={styles.second}>
                    次优：<b>{second?.ball ?? "-"}</b>{" "}
                    {second?.catchChance !== undefined && !isNaN(second.catchChance) ? `(${second.catchChance.toFixed(1)}%)` : ""}
                    <span className={styles.ballDetails}>
                      {second?.hpLabel ?? ""}{second?.statusLabel ? `, ${second.statusLabel}` : ""}
                    </span>
                  </div>
                </div>

                {/* Level 30 Moveset */}
                <div className={styles.movesetSection}>
                  <div className={styles.movesetTitle}>Lv.30 招式表</div>
                  <ul className={styles.moveList}>
                    {moveset.length === 0 ? (
                      <li className={styles.noMoves}>暂无资料</li>
                    ) : (
                      moveset.map(m => (
                        <li key={m.move + m.level} className={styles.moveItem}>
                          <span className={styles.moveName}>{translateMoveName(m.move)}</span>
                          <span className={styles.moveLevel}>Lv{m.level}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LnyCatchCalc;
