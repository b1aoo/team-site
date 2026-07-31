import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../../api/endpoints';
import { usePokemonSprites } from '../../hooks/usePokemonSprites';
import { useDocumentHead } from '../../hooks/useDocumentHead';
import styles from './BountiesPage.module.css';

import MarshMondayPopup from './MarshMondayPopup';
import { translatePokemonName } from '../../utils/pokemonNamesZh';

function formatPokemonName(slugOrList) {
  if (!slugOrList) return '';
  if (Array.isArray(slugOrList)) {
    return slugOrList.map((slug) => formatPokemonName(slug)).join(', ');
  }
  const name = String(slugOrList).trim();
  return name ? translatePokemonName(name) : '';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_NAMES_ZH = Object.freeze({
  January: '一月', February: '二月', March: '三月', April: '四月', May: '五月', June: '六月',
  July: '七月', August: '八月', September: '九月', October: '十月', November: '十一月', December: '十二月',
  Perm: '常驻', Uncategorized: '未分类',
});

function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ''));
}

function formatBountyMonth(value) {
  return MONTH_NAMES_ZH[value] || value || '未分类';
}

function formatBountyTitle(bounty) {
  if (hasChineseText(bounty?.title)) return bounty.title;
  const targets = formatPokemonName(bounty?.pokemon);
  return targets ? `闪光悬赏：${targets}` : '闪光悬赏';
}

function formatBountyDescription(description) {
  if (hasChineseText(description)) return String(description).replace(/<[^>]*>/g, '');
  return description ? '详细条件请向悬赏发布者确认。' : '';
}

function formatBountyReward(reward) {
  return hasChineseText(reward) ? reward : (reward ? '奖励详情请向发布者确认。' : '未注明');
}

function sortMonthCategories(categories) {
  const unique = Array.from(new Set(categories.filter(Boolean)));
  return unique.sort((a, b) => {
    const aIdx = MONTH_NAMES.indexOf(a);
    const bIdx = MONTH_NAMES.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });
}

function toCategoryLabel(value) {
  if (!value) return '';
  const cleaned = String(value).trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned) return '';
  if (cleaned === 'perm') return 'Perm';
  const monthMatch = MONTH_NAMES.find(m => m.toLowerCase() === cleaned);
  if (monthMatch) return monthMatch;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function getIdPrefix(id) {
  if (!id) return '';
  const match = String(id).trim().match(/^([a-z]+)/i);
  return match ? match[1].toLowerCase() : '';
}

function getCategoryFromBounty(bounty) {
  const idPrefix = getIdPrefix(bounty?.id);
  if (idPrefix) {
    const fromId = toCategoryLabel(idPrefix);
    if (fromId) return fromId;
  }
  if (bounty?.perm) return 'Perm';
  return toCategoryLabel(bounty?.month) || 'Uncategorized';
}

function normalizeBountiesPayload(input) {
  const grouped = {};
  const allBounties = Array.isArray(input)
    ? input
    : Object.values(input || {}).flatMap(list => (Array.isArray(list) ? list : []));

  allBounties.filter(Boolean).forEach((bounty) => {
    const category = getCategoryFromBounty(bounty);
    const normalized = { ...bounty };
    if (category === 'Perm') {
      normalized.perm = true;
      normalized.month = '';
    } else {
      normalized.perm = false;
      normalized.month = category;
    }
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(normalized);
  });

  if (!grouped.Perm) grouped.Perm = [];
  return grouped;
}

// Component to render a single pokemon sprite using the custom hook
function PokemonSpriteSingle({ name }) {
  const sprites = usePokemonSprites(name);

  function getGifUrlFromSprites(sprites) {
    if (!sprites) return null;
    if (sprites['generation-v']) {
      const genVSprites = sprites['generation-v'];
      const gif = genVSprites.find(s => s.type === 'gif' && s.url);
      if (gif) return gif.url;
    }
    for (const gen of Object.keys(sprites)) {
      const sprite = sprites[gen].find(s => s.url);
      if (sprite) return sprite.url;
    }
    return null;
  }

  const gifUrl = getGifUrlFromSprites(sprites);
  if (!gifUrl) return null;

  return (
    <img
      className={styles['bounty-pokemon-sprite']}
      src={gifUrl}
      alt={formatPokemonName(name)}
    />
  );
}

function PokemonSprite({ name }) {
  const pokemonNames = Array.isArray(name) ? name : [name];

  if (pokemonNames.length <= 1) {
    return <PokemonSpriteSingle name={pokemonNames[0]} />;
  }

  return (
    <div className={styles['bounty-pokemon-sprite-grid']}>
      {pokemonNames.map((pokemonName) => (
        <PokemonSpriteSingle
          key={pokemonName}
          name={pokemonName}
        />
      ))}
    </div>
  );
}

export default function BountiesPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
  // Show popup only on Mondays (real life)
  const isMonday = new Date().getDay() === 1;
  const [bounties, setBounties] = useState({ Perm: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('monthly'); // "monthly" or "permanent"

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(API.bounties)
      .then(res => res.json())
      .then(data => {
        const formatted = normalizeBountiesPayload(data);
        setBounties(formatted);
        setLoading(false);
      })
      .catch(() => {
        setError('悬赏数据加载失败');
        setLoading(false);
      });
  }, []);

  const monthCategories = useMemo(
    () => sortMonthCategories(Object.keys(bounties).filter((category) => category !== 'Perm')),
    [bounties]
  );

  useEffect(() => {
    if (!monthCategories.length) return;
    if (!monthCategories.includes(selectedMonth)) {
      const currentMonth = new Date().toLocaleString('default', { month: 'long' });
      setSelectedMonth(monthCategories.includes(currentMonth) ? currentMonth : monthCategories[0]);
    }
  }, [monthCategories, selectedMonth]);

  const selectedMonthIndex = monthCategories.indexOf(selectedMonth);
  const prevMonth = selectedMonthIndex > 0 ? monthCategories[selectedMonthIndex - 1] : null;
  const nextMonth = selectedMonthIndex >= 0 && selectedMonthIndex < monthCategories.length - 1
    ? monthCategories[selectedMonthIndex + 1]
    : null;

  const currentMonthBounties = selectedMonth ? (bounties[selectedMonth] || []) : [];
  const permBounties = (bounties.Perm || []).filter(b => b.perm === true || b.type === 'perm');

  const activeMonthlyBounties = currentMonthBounties.filter(b => !b.claimed);
  const claimedMonthlyBounties = currentMonthBounties.filter(b => b.claimed);

  const activePermBounties = permBounties.filter(b => !b.claimed);
  const claimedPermBounties = permBounties.filter(b => b.claimed);

  // Use first monthly bounty for ogImage
  const firstBountyPokemon = currentMonthBounties.length > 0
    ? (Array.isArray(currentMonthBounties[0].pokemon) ? currentMonthBounties[0].pokemon[0] : currentMonthBounties[0].pokemon)
    : null;
  const firstBountySprites = usePokemonSprites(firstBountyPokemon);
  const ogImage = useMemo(() => {
    if (!firstBountyPokemon || !firstBountySprites) return 'https://b1aoo.github.io/team-site/images/openGraph.jpg';
    if (firstBountySprites['generation-v']) {
      const genVSprites = firstBountySprites['generation-v'];
      const gif = genVSprites.find(s => s.type === 'gif' && s.url);
      if (gif) return gif.url;
    }
    for (const gen of Object.keys(firstBountySprites)) {
      const sprite = firstBountySprites[gen].find(s => s.url);
      if (sprite) return sprite.url;
    }
    return 'https://b1aoo.github.io/team-site/images/openGraph.jpg';
  }, [firstBountyPokemon, firstBountySprites]);

  useDocumentHead({
    title: '悬赏',
    description: '参与 Team Synergy 的月度与常驻悬赏。完成刷闪挑战、赢取奖励，并加入社区竞赛。',
    canonicalPath: '/bounties/',
    ogImage,
    url: 'https://b1aoo.github.io/team-site/bounties/',
    keywords: 'PokeMMO 悬赏, 闪光悬赏, Team Synergy, 月度悬赏, 常驻悬赏, 刷闪挑战, PokeMMO 活动, 社区奖励',
    author: 'Team Synergy PokeMMO 社区',
  });

  return (
    <div className={styles['bounties-page']}>
      <h1>悬赏</h1>

      {/* Toggle Switch */}
      <div className={styles['bounties-switch']}>
        <button
          className={view === 'monthly' ? styles.active : ''}
          onClick={() => setView('monthly')}
        >
          月度悬赏
        </button>
        <button
          className={view === 'permanent' ? styles.active : ''}
          onClick={() => setView('permanent')}
        >
          常驻悬赏
        </button>
      </div>

      {/* Marsh Monday Popup Event - now above bounties section, on both views */}
      {isMonday && <MarshMondayPopup />}
      <div style={{ height: 18 }} />

      {view === 'monthly' && monthCategories.length > 0 && (
        <div className={styles['bounties-header-controls']}>
          {prevMonth ? (
            <button onClick={() => setSelectedMonth(prevMonth)}>&lt; 上个月</button>
          ) : (
            <span />
          )}
          <h2>{formatBountyMonth(selectedMonth)}</h2>
          {nextMonth ? (
            <button onClick={() => setSelectedMonth(nextMonth)}>下个月 &gt;</button>
          ) : (
            <span />
          )}
        </div>
      )}

      {loading && <p>加载中…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Monthly Bounties */}
        {view === 'monthly' && (
        <section className={styles['bounties-section']}>
            <h3>
              {selectedMonth === new Date().toLocaleString('default', { month: 'long' })
                ? '本月悬赏'
                : `${formatBountyMonth(selectedMonth)}悬赏（已不可领取）`}
            </h3>
            {currentMonthBounties.length === 0 ? <p>本月暂无悬赏。</p> : (
              <>
                {activeMonthlyBounties.length > 0 ? (
                  <>
                    <h4>进行中</h4>
                    <ul className={styles['bounty-list']}>
                      {activeMonthlyBounties.map((b, i) => {
                        const primaryPokemon = Array.isArray(b.pokemon) ? b.pokemon[0] : b.pokemon;
                        return (
                          <li
                            className={styles['bounty-card']}
                            key={b.id || formatPokemonName(b.pokemon) + b.host + i}
                          >
                            <Link to={`/pokemon/${primaryPokemon || ''}/`} className={styles['bounty-card-inner']}>
                              <PokemonSprite name={b.pokemon} />
                              <div className={styles['bounty-title']}>{formatBountyTitle(b)}</div>
                              <div className={styles['bounty-host']}>发布者：{b.host}</div>
                              <div className={styles['bounty-reward']}>奖励：{formatBountyReward(b.reward)}</div>
                              <div className={styles['bounty-description']}>{formatBountyDescription(b.description)}</div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : <p>当前没有进行中的悬赏。</p>}

                {claimedMonthlyBounties.length > 0 && (
                  <>
                    <h4>已完成</h4>
                    <ul className={styles['bounty-list']}>
                      {claimedMonthlyBounties.map((b, i) => {
                        const primaryPokemon = Array.isArray(b.pokemon) ? b.pokemon[0] : b.pokemon;
                        return (
                          <li
                            className={`${styles['bounty-card']} ${b.claimed ? styles.claimed : ''}`}
                            key={b.id || formatPokemonName(b.pokemon) + b.host + i}
                          >
                            <Link to={`/pokemon/${primaryPokemon || ''}/`} className={styles['bounty-card-inner']}>
                              <PokemonSprite name={b.pokemon} />
                              <div className={styles['bounty-title']}>{formatBountyTitle(b)}</div>
                              <div className={styles['bounty-host']}>发布者：{b.host}</div>
                              <div className={styles['bounty-reward']}>奖励：{formatBountyReward(b.reward)}</div>
                              <div className={styles['bounty-description']}>{formatBountyDescription(b.description)}</div>
                            </Link>

                            <div className={styles['bounty-claimed']}><em>完成者：{b.claimed}</em></div>
                            <div className={styles['bounty-overlay']}>已完成</div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>
        )}

      {/* Permanent Bounties */}
      {view === 'permanent' && (
        <section className={styles['bounties-section']}>
          <h3>常驻悬赏</h3>
          {permBounties.length === 0 ? (
            <p>暂无常驻悬赏。</p>
          ) : (
            <>
              {activePermBounties.length > 0 ? (
                <>
                  <h4>进行中</h4>
                  <ul className={styles['bounty-list']}>
                    {activePermBounties.map((b, i) => {
                      const primaryPokemon = Array.isArray(b.pokemon) ? b.pokemon[0] : b.pokemon;
                      return (
                        <li
                          className={styles['bounty-card']}
                          key={b.id || formatPokemonName(b.pokemon) + b.host + i}
                        >
                          <Link to={`/pokemon/${primaryPokemon || ''}/`} className={styles['bounty-card-inner']}>
                            <PokemonSprite name={b.pokemon} />
                            <div className={styles['bounty-title']}>{formatBountyTitle(b)}</div>
                            <div className={styles['bounty-host']}>发布者：{b.host}</div>
                            <div className={styles['bounty-reward']}>奖励：{formatBountyReward(b.reward)}</div>
                            <div className={styles['bounty-description']}>{formatBountyDescription(b.description)}</div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p>当前没有进行中的常驻悬赏。</p>
              )}

              {claimedPermBounties.length > 0 && (
                <>
                  <h4>已完成</h4>
                  <ul className={styles['bounty-list']}>
                    {claimedPermBounties.map((b, i) => {
                      const primaryPokemon = Array.isArray(b.pokemon) ? b.pokemon[0] : b.pokemon;
                      return (
                        <li
                          className={`${styles['bounty-card']} ${b.claimed ? styles.claimed : ''}`}
                          key={b.id || formatPokemonName(b.pokemon) + b.host + i}
                        >
                          <Link to={`/pokemon/${primaryPokemon || ''}/`} className={styles['bounty-card-inner']}>
                            <PokemonSprite name={b.pokemon} />
                            <div className={styles['bounty-title']}>{formatBountyTitle(b)}</div>
                            <div className={styles['bounty-host']}>发布者：{b.host}</div>
                            <div className={styles['bounty-reward']}>奖励：{formatBountyReward(b.reward)}</div>
                            <div className={styles['bounty-description']}>{formatBountyDescription(b.description)}</div>
                          </Link>

                          <div className={styles['bounty-claimed']}><em>完成者：{b.claimed}</em></div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
