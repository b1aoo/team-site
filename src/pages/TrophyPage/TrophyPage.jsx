import { useParams, Link } from 'react-router-dom';
import { useTrophies } from '../../hooks/useTrophies';
import { useDocumentHead } from '../../hooks/useDocumentHead';
import { useDatabase } from '../../hooks/useDatabase';
import BackButton from '../../components/BackButton/BackButton';
import styles from './TrophyPage.module.css';
import { slugify } from '../../utils/slugify';

export default function TrophyPage() {
  const { trophySlug } = useParams() || {}; // safe default
  const { data: trophiesData, isLoading: loadingTrophies } = useTrophies();
  const { data: shinyData, isLoading: loadingDB } = useDatabase();
  const DOMAIN = 'https://b1aoo.github.io/team-site';

  const trophies = trophiesData?.trophies || {};
  const trophyAssignments = trophiesData?.trophyAssignments || {};

  // Only attempt to find trophyKey if trophySlug is defined
  const trophyKey =
    trophySlug && Object.keys(trophies).find(name => slugify(name) === trophySlug.toLowerCase()) || null;

  const trophyImg = trophyKey ? `${DOMAIN}${trophies[trophyKey]}` : `${DOMAIN}/images/openGraph.jpg`;
  const ogUrl = `${DOMAIN}/trophy/${trophySlug || ''}/`;

  const breadcrumbs = trophyKey ? [
    { name: '首页', url: '/' },
    { name: '奖杯墙', url: '/trophy-board' },
    { name: trophyKey, url: `/trophy/${trophySlug}` }
  ] : [
    { name: '首页', url: '/' },
    { name: '奖杯墙', url: '/trophy-board' }
  ];

  useDocumentHead({
    title: trophyKey ? `${trophyKey} 奖杯－Team Synergy PokeMMO 奖项` : trophySlug || '奖杯',
    description: trophyKey
      ? `查看哪些 Team Synergy 成员在 PokeMMO 中获得了“${trophyKey}”奖杯，了解里程碑成就与竞赛荣誉。`
      : `查看 Team Synergy 的 PokeMMO 奖杯详情。`,
    canonicalPath: ogUrl,
    ogImage: trophyImg,
    url: ogUrl,
    breadcrumbs: breadcrumbs
  });

  if (loadingTrophies || loadingDB) return <div className="message">加载中…</div>;

  if (!trophyKey) {
    return (
      <h2 style={{ color: 'white', textAlign: 'center' }}>
        未找到奖杯“{trophySlug}”
      </h2>
    );
  }

  const players = (trophyAssignments[trophyKey] || []).filter(player =>
    Object.keys(shinyData || {}).some(dbKey => dbKey.toLowerCase() === player.toLowerCase())
  );

  return (
    <div className={styles.trophyPage}>
      <BackButton to="/trophy-board/" label="&larr; 返回奖杯墙" />
      <div className={styles.header}>
        <img
          src={trophyImg}
          alt={trophyKey}
          className={styles.largeTrophy}
          width="220"
          height="220"
        />
        <h1>{trophyKey}</h1>
      </div>
      <h2 className={styles.playersHeading}>获得此奖杯的训练家：</h2>
      <ul className={styles.playersList}>
        {players.map(player => (
          <li key={player}>
            {trophySlug === 'official-shiny-wars-2025' ? (
              <Link to={`/shiny-war-2025/#${player}`} className={styles.playerLink}>
                {player}
              </Link>
            ) : (
              <Link to={`/player/${player.toLowerCase()}/`} className={styles.playerLink}>
                {player}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
