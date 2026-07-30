import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import './DexHelper.css';
import generationData from '../../data/generation.json';
import dexHelperData from '../../data/dex_helper.json';
import pokemonData from '../../data/pokemmo_data/pokemon-data.json';
import { getLocalPokemonGif, onGifError, normalizePokemonName, translatePokemonName } from '../../utils/pokemon';
import { useDatabase } from '../../hooks/useDatabase';
import { useDocumentHead } from '../../hooks/useDocumentHead';
import { API } from '../../api/endpoints';

const FILTERED_POKEMON = [
  'mew', 'mewtwo', `phione`, `manaphy`, `victini`, 'articuno', 'zapdos', 'moltres', 'suicune', 'entei', 'raikou', 'giratina-origin',
  'heatran', 'dialga', 'palkia', 'cresselia', 'shaymin-land', 'darkrai', 'arceus', 'cobalion', 'reshiram',
  'zekrom', 'kyurem', 'genesect', 'lugia', 'ho-oh', 'celebi', 'regirock', 'regice', 'registeel', 'latias',
  'latios', 'kyogre', 'groudon', 'rayquaza', 'jirachi', 'deoxys-normal', 'deoxys-attack', 'deoxys-defense',
  'deoxys-speed', 'tornadus-incarnate', 'tornadus-therian', 'thundurus-incarnate', 'thundurus-therian',
  'landorus-incarnate', 'landorus-therian', 'kyurem-normal', 'kyurem-black', 'kyurem-white', 'keldeo-ordinary',
  'keldeo-resolute', 'meloetta-aria', 'meloetta-pirouette', 'genesect-normal', 'genesect-shock', 'genesect-burn',
  'genesect-chill',
];
const FILTERED_POKEMON_SET = new Set(FILTERED_POKEMON.map((name) => normalizePokemonName(String(name))));
const CATEGORY_ORDER = ['Horde', 'Singles', 'Eggs'];
const CATEGORY_LABELS = { Horde: '群怪', Singles: '单遇', Eggs: '孵蛋' };


const CATEGORY_OVERRIDE_FILTERS = {
  Horde: [`Hippopotas`, `Spoink`,`Miltank`, `Tauros`, `Illumise`, `Sunkern`],
  Singles: ["carnivine", "kecleon", "lileep", "castform", "burmy", "skorupi", "shedinja"],
  Eggs: ["kangaskhan"],
};
const CATEGORY_OVERRIDE_SETS = {
  Horde: new Set(CATEGORY_OVERRIDE_FILTERS.Horde.map((name) => normalizePokemonName(String(name)))),
  Singles: new Set(CATEGORY_OVERRIDE_FILTERS.Singles.map((name) => normalizePokemonName(String(name)))),
  Eggs: new Set(CATEGORY_OVERRIDE_FILTERS.Eggs.map((name) => normalizePokemonName(String(name)))),
};

function getCurrentMonthYear() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    monthName: now.toLocaleString('default', { month: 'long' }).toLowerCase(),
  };
}

function getCategoryFromShinyTier(shinyTier) {
  const tier = Number(shinyTier);
  if (!Number.isFinite(tier)) return null;

  if (tier >= 0 && tier <= 1) return 'Eggs';
  if (tier >= 2 && tier <= 4) return 'Singles';
  if (tier === 5) return 'Horde';

  return null;
}

function getCategoryOverride(lineIds) {
  if (lineIds.some((lineId) => CATEGORY_OVERRIDE_SETS.Horde.has(lineId))) return 'Horde';
  if (lineIds.some((lineId) => CATEGORY_OVERRIDE_SETS.Singles.has(lineId))) return 'Singles';
  if (lineIds.some((lineId) => CATEGORY_OVERRIDE_SETS.Eggs.has(lineId))) return 'Eggs';
  return null;
}

function formatPokemonDisplayName(name) {
  if (!name && name !== 0) return '';
  if (Array.isArray(name)) {
    return name.map((item) => formatPokemonDisplayName(item)).join(', ');
  }
  return translatePokemonName(String(name));
}

function bountyPokemonList(bounty) {
  if (!bounty) return [];
  const raw = bounty.pokemon;
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (!raw && raw !== 0) return [];
  return String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBounties(rawData, month, year, monthName) {
  const active = [];

  const addBounty = (bounty, sourceKey = '') => {
    const pokemonList = bountyPokemonList(bounty);
    if (!bounty || pokemonList.length === 0) return;

    const singleBounty = { ...bounty, pokemon: pokemonList.length === 1 ? pokemonList[0] : pokemonList };

    const bountyType = String(bounty.type || sourceKey || '').toLowerCase();
    const isPermanent =
      bounty.perm === true ||
      bountyType.includes('perm');
    const bountyMonth = String(bounty.month || sourceKey || '').toLowerCase();
    const bountyYear = Number(bounty.year || year);
    const isCurrentMonth = bountyMonth === monthName || Number(bounty.month) === month;
    const isCurrentYear = !bounty.year || bountyYear === year;
    const isClaimed = Boolean(bounty.claimed);

    if (isClaimed) return;

    const normalized = { ...singleBounty };
    if (isPermanent) {
      active.push({ ...normalized, bountyType: 'permanent' });
      return;
    }

    if (isCurrentMonth && isCurrentYear) {
      active.push({ ...normalized, bountyType: 'monthly' });
    }
  };

  if (Array.isArray(rawData)) {
    rawData.forEach((bounty) => addBounty(bounty));
    return { active };
  }

  if (rawData && typeof rawData === 'object') {
    Object.entries(rawData).forEach(([key, value]) => {
      if (!Array.isArray(value)) return;
      value.forEach((bounty) => addBounty(bounty, key));
    });
  }

  return { active };
}

export default function DexHelper() {
  useDocumentHead({
    title: '图鉴助手－缺失闪光图鉴追踪器',
    description: '追踪 Team Synergy 闪光图鉴中仍缺少的初始形态宝可梦。查看群怪、单遇与孵蛋目标，关注有效悬赏并使用图鉴助手中的刷闪备注。',
    canonicalPath: '/dex-helper/',
    robots: 'index, follow, max-image-preview:large',
    breadcrumbs: [
      { name: '首页', url: '/' },
      { name: '图鉴助手', url: '/dex-helper/' },
    ],
    keywords: 'PokeMMO Dex Helper, shiny dex tracker, missing Pokemon list, Team Synergy, shiny hunt targets, PokeMMO bounties, evolution line tracker, horde singles egg hunts',
  });

  const { month, year, monthName } = getCurrentMonthYear();
  const {
    data: database,
    isLoading: dbLoading,
    error: dbError,
    refetch: refetchDatabase,
  } = useDatabase();

  const {
    data: bountyData,
    isLoading: bountiesLoading,
    error: bountiesError,
  } = useQuery({
    queryKey: ['dex-helper-bounties', month, year],
    queryFn: async () => {
      const response = await fetch(`${API.bounties}?month=${month}&year=${year}`);
      if (!response.ok) throw new Error(`Failed to load bounties: ${response.status}`);
      return response.json();
    },
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      refetchDatabase();
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [refetchDatabase]);

  const dexEvolutionBases = useMemo(() => {
    const seenBases = new Set();
    const baseEntries = [];
    const descriptionByPokemon = new Map(
      Object.entries(dexHelperData || {}).map(([name, info]) => [
        normalizePokemonName(String(name)),
        info?.description || '',
      ]),
    );

    Object.values(generationData).forEach((generationLines) => {
      generationLines.forEach((line) => {
        if (!Array.isArray(line) || line.length === 0) return;

        const baseName = String(line[0]);
        const baseId = normalizePokemonName(baseName);
        if (!baseId || seenBases.has(baseId)) return;

        const lineIds = line.map((member) => normalizePokemonName(String(member))).filter(Boolean);

        let shinyTier = null;
        for (const lineId of lineIds) {
          const tier = pokemonData?.[lineId]?.shiny_tier;
          if (tier === 0 || Number(tier)) {
            shinyTier = Number(tier);
            break;
          }
        }

        const category = getCategoryOverride(lineIds) || getCategoryFromShinyTier(shinyTier);
        if (!category) return;

        let description = descriptionByPokemon.get(baseId) || '';
        if (!description) {
          for (const lineId of lineIds) {
            const lineDescription = descriptionByPokemon.get(lineId);
            if (lineDescription) {
              description = lineDescription;
              break;
            }
          }
        }

        seenBases.add(baseId);
        baseEntries.push({
          id: baseId,
          name: baseName,
          lineIds,
          category,
          description,
        });
      });
    });

    return baseEntries.filter((entry) => {
      if (FILTERED_POKEMON_SET.has(entry.id)) return false;
      return !entry.lineIds.some((lineId) => FILTERED_POKEMON_SET.has(lineId));
    });
  }, []);

  const ownedPokemonSet = useMemo(() => {
    const owned = new Set();
    if (!database) return owned;

    Object.values(database).forEach((playerData) => {
      Object.values(playerData?.shinies || {}).forEach((entry) => {
        if (!entry?.Pokemon) return;
        if (String(entry.Sold || '').toLowerCase() === 'yes') return;
        owned.add(normalizePokemonName(entry.Pokemon));
      });
    });

    return owned;
  }, [database]);

  const { active } = useMemo(
    () => normalizeBounties(bountyData, month, year, monthName),
    [bountyData, month, monthName, year],
  );

  const bountyByPokemon = useMemo(() => {
    const lookup = new Map();
    active.forEach((bounty) => {
      const pokemonNames = Array.isArray(bounty.pokemon) ? bounty.pokemon : [bounty.pokemon];
      pokemonNames.forEach((pokemon) => {
        const key = normalizePokemonName(pokemon || '');
        if (!key || lookup.has(key)) return;
        lookup.set(key, bounty);
      });
    });
    return lookup;
  }, [active]);

  const missingPokemon = useMemo(
    () => dexEvolutionBases.filter((pokemon) => !pokemon.lineIds.some((lineId) => ownedPokemonSet.has(lineId))),
    [dexEvolutionBases, ownedPokemonSet],
  );

  const missingByCategory = useMemo(() => {
    const grouped = { Horde: [], Singles: [], Eggs: [] };
    missingPokemon.forEach((pokemon) => {
      if (!grouped[pokemon.category]) return;
      grouped[pokemon.category].push(pokemon);
    });
    return grouped;
  }, [missingPokemon]);

  if (dbLoading || bountiesLoading) {
    return <p className="dexStatus">正在加载图鉴助手…</p>;
  }

  if (dbError || bountiesError) {
    return <p className="dexStatus dexStatusError">图鉴助手数据加载失败。</p>;
  }

  return (
    <div className="dexContainer">
      <div className="dexHeader">
        <h1 className="dexTitle">图鉴助手</h1>
        <p className="dexSummary">
          缺失：{missingPokemon.length} / {dexEvolutionBases.length} 个进化家族
        </p>
      </div>

      <p className="dexDescription">
        这里列出的是每个进化家族的初始形态；获得该进化链中的任意一只即可补全图鉴。将鼠标悬停在跳动图标上，可查看与该宝可梦相关的有效悬赏。
      </p>

      {missingPokemon.length === 0 ? (
        <p className="dexStatus">公会目前已拥有此图鉴列表中的全部宝可梦。</p>
      ) : (
        <div className="dexSections">
          {CATEGORY_ORDER.filter((category) => missingByCategory[category]?.length > 0).map((category) => (
            <section key={category} className="categorySection">
              <h2 className="categoryTitle">{CATEGORY_LABELS[category] || category}</h2>
              <div className="categoryCards">
                {missingByCategory[category].map((pokemon) => {
                  let bounty = null;
                  let bountySourcePokemon = '';
                  for (const lineId of pokemon.lineIds) {
                    const lineBounty = bountyByPokemon.get(lineId);
                    if (!lineBounty) continue;
                    bounty = lineBounty;
                    bountySourcePokemon = lineBounty.pokemon || lineId;
                    break;
                  }

                  return (
                    <article key={pokemon.id} className="dexCard">
                      <div className="pokemonGifWrapper">
                        <Link to={`/pokemon/${encodeURIComponent(pokemon.id)}/`} className="pokemonLink">
                          <img
                            src={getLocalPokemonGif(pokemon.name)}
                            alt={pokemon.name}
                            onError={onGifError(pokemon.name)}
                            className="pokemonGif"
                            loading="lazy"
                          />
                        </Link>

                        {bounty && (
                          <div className="bountyMarker" tabIndex={0} aria-label={`${formatPokemonDisplayName(pokemon.name)} 的悬赏`}>
                            <span className="bountyIcon" aria-hidden="true">B</span>
                            <div className="bountyTooltip" role="tooltip">
                              <p><strong>标题：</strong> {bounty.title || formatPokemonDisplayName(bounty.pokemon) || '未命名'}</p>
                              <p><strong>悬赏目标：</strong> <strong>{formatPokemonDisplayName(bountySourcePokemon)}</strong></p>
                              <p>
                                <strong>说明：</strong>{' '}
                                {bounty.description || '暂无说明'}
                              </p>
                              <p><strong>类型：</strong> {bounty.bountyType === 'monthly' ? '月度' : '永久'}</p>
                              <p><strong>奖励：</strong> {bounty.reward || '未注明'}</p>
                              <p><strong>主办人：</strong> {bounty.host || '未知'}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pokemonInfo">
                        <h2 className="pokemonName">{formatPokemonDisplayName(pokemon.name)}</h2>
                        {pokemon.description && (
                          <p className="pokemonDescription">{pokemon.description}</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
