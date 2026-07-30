import { useNavigate } from 'react-router-dom';
import { useTrophies } from '../../hooks/useTrophies';
import { useDocumentHead } from '../../hooks/useDocumentHead';
import styles from './TrophyBoard.module.css';
import { slugify } from '../../utils/slugify'; // fixed path to your utils

export default function TrophyBoard() {
  const breadcrumbs = [
    { name: '首页', url: '/' },
    { name: '奖杯墙', url: '/trophy-board' }
  ];

  useDocumentHead({
    title: 'PokeMMO 奖杯墙－Team Synergy 成就',
    description: 'Team Synergy 奖杯墙展示 PokeMMO 成就、奖项与成员荣誉。浏览 12 类奖杯、庆祝里程碑并查看冠军战绩。',
    canonicalPath: '/trophy-board/',
    breadcrumbs: breadcrumbs
  });

  const { data, isLoading } = useTrophies();
  const navigate = useNavigate();

  if (isLoading) return <div className="message">加载中…</div>;

  const { trophies } = data;

  return (
    <div>
      <h1>奖杯墙</h1>
      <div className={styles.grid}>
        {Object.entries(trophies).map(([name, imgSrc]) => {
          const slug = slugify(name); // create a clean slug for the URL
          return (
            <div
              key={name}
              className={styles.item}
              onClick={() => navigate(`/trophy/${slug}/`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/trophy/${slug}/`) }}
              role="button"
              tabIndex={0}
            >
              <img
                src={imgSrc}
                alt={name}
                className={styles.img}
                width="110"
                height="110"
                loading="lazy"
              />
              <div className={styles.label}>{name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
