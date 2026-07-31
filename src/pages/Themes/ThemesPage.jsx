import React, { useState, useEffect } from 'react';
import { useDocumentHead } from '../../hooks/useDocumentHead';
import { Link } from 'react-router-dom';
import styles from './ThemesPage.module.css';
import { formatThemeDescription } from '../../utils/contentZh';

const tabList = [
  { key: 'Themes', label: '主题' }, { key: 'Encounter Counters', label: '遇敌计数器' },
  { key: 'Pokemon Textures', label: '宝可梦贴图' }, { key: 'Other', label: '其他' },
];

export default function ThemesPage() {
  useDocumentHead({
    title: '主题与资源', description: '浏览并下载 PokeMMO 主题、遇敌计数器主题及 Team Synergy 社群资源。',
    canonicalPath: '/themes/'
  });
  const [activeTab, setActiveTab] = useState('Themes');
  const [themeData, setThemeData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Store author filter globally for all tabs
  const [authorFilter, setAuthorFilter] = useState('All');

  const WORKER_THEME_ENDPOINT = 'https://adminpage.hypersmmo.workers.dev/admin/themes';

  useEffect(() => {
    async function fetchThemeData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(WORKER_THEME_ENDPOINT);
        if (!res.ok) throw new Error(`主题资料加载失败：${res.status}`);
        const data = await res.json();
        setThemeData(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchThemeData();
  }, []);

  function slugify(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }


  // Get unique authors for the current tab (must be above conditional returns)
  const authors = React.useMemo(() => {
    const items = Object.values(themeData[activeTab] || {});
    const authorSet = new Set();
    items.forEach(item => {
      if (item.author) authorSet.add(item.author);
    });
    let authorList = Array.from(authorSet).sort();
    // Always include the selected author if not present
    if (authorFilter !== 'All' && authorFilter && !authorList.includes(authorFilter)) {
      authorList = [authorFilter, ...authorList];
    }
    return ['All', ...authorList];
  }, [themeData, activeTab, authorFilter]);

  const renderCardGrid = (itemsObj) => {
    let items = Object.values(itemsObj || {});
    if (authorFilter !== 'All') {
      items = items.filter((item) =>
        item.author && item.author.toLowerCase().includes(authorFilter.toLowerCase())
      );
    }
    if (items.length === 0) return <div className={styles.empty}>暂无资源。</div>;

    return (
      <div className={styles.grid}>
        {items.map((item, idx) => (
          <Link
            to={`/themes/${slugify(item.name)}/`}
            className={styles.item}
            key={item.name + idx}
          >
            <img
              src={item.previewImage || `${import.meta.env.BASE_URL}placeholder.png`}
              alt={item.name}
              className={styles.img}
              width="160"
              height="160"
              loading="lazy"
            />
            <div className={styles.label}>
              <span className={styles.itemName}>{item.name}</span>
              <div className={styles.itemDesc}>{formatThemeDescription(item)}</div>
              <div className={styles.itemAuthor}>作者：{item.author}</div>
            </div>
          </Link>
        ))}
      </div>
    );
  };


  if (loading) return <div className="message">正在加载主题…</div>;
  if (error) return <div className="message">主题加载失败：{error}</div>;



  return (
    <div className={styles.themesPage}>
      <h1>PokeMMO 主题与资源</h1>
      <p>
        浏览精选的 PokeMMO 主题、遇敌计数器主题、宝可梦贴图及更多资源！<br />
        用这些社群资源丰富你的游戏体验。
      </p>

      <div className={styles.tabs}>
        {tabList.map((tab) => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? styles.activeTab : styles.tab}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.filterRow}>
        <label htmlFor="authorFilter" className={styles.authorFilterLabel}>按作者筛选：</label>
        <select
          id="authorFilter"
          className={styles.authorFilterSelect}
          value={authorFilter}
          onChange={e => setAuthorFilter(e.target.value)}
        >
          {authors.map(author => (
            <option key={author} value={author}>{author === 'All' ? '全部作者' : author}</option>
          ))}
        </select>
      </div>

      <div className={styles.tabContent}>
        {renderCardGrid(themeData[activeTab])}
      </div>
    </div>
  );
}
