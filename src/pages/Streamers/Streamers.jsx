import { Link } from 'react-router-dom'
import { useStreamers } from '../../hooks/useStreamers'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import styles from './Streamers.module.css'
import { hasChineseText } from '../../utils/contentZh'

function formatStreamTitle(title) {
  return hasChineseText(title) ? title : '正在直播 PokeMMO'
}

export default function Streamers() {
  const breadcrumbs = [
    { name: '首页', url: '/' },
    { name: '主播', url: '/streamers' }
  ];

  useDocumentHead({
    title: 'PokeMMO 主播－在 Twitch 观看 Team Synergy 直播',
    description: '在 Twitch 观看 Team Synergy 成员直播 PokeMMO。关注活跃主播，发现刷闪、对战与遭遇内容，并加入 PokeMMO 直播社区。',
    canonicalPath: '/streamers/',
    breadcrumbs: breadcrumbs
  })
  const { data, isLoading, error } = useStreamers()

  if (isLoading) {
    return (
      <div>
        <h1>
          Team Synergy 主播
          <Link to="/admin" className="invisible-link">!</Link>
        </h1>
        <p style={{ textAlign: 'center', fontSize: '1.2rem', color: '#aaa' }}>加载中…</p>
      </div>
    )
  }

  if (error) {
  console.error("主播资料加载失败：", error)
  return <div className="message">主播数据加载失败：{error.message}</div>
}


  const { live, offline } = data

  return (
    <div>
      <h1>
        Team Synergy 主播
        <Link to="/admin" className="invisible-link">!</Link>
      </h1>

      {live.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>正在直播</h2>
          <div className={styles.wrapper}>
            {live.map(stream => (
              <a
                key={stream.pokeName}
                href={`https://www.twitch.tv/${stream.twitch_username.toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.cardLink}
              >
                <div className={`${styles.card} ${styles.live}`}>
                  <img
                    src={stream.profile_image_url} // use merged JSON profile_image_url
                    alt={`${stream.twitch_username} 的直播缩略图`}
                    width="256"
                    height="144"
                    loading="lazy"
                  />
                  <p className={styles.playerName}>{stream.pokeName}</p>
                  <p className={styles.streamTitle}>{formatStreamTitle(stream.last_stream_title)}</p>
                  <p className={styles.viewerCount}>{stream.last_viewer_count} 位观众</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>离线主播</h2>
        <div className={styles.wrapper}>
          {offline.map(user => (
            <a
              key={user.pokeName}
              href={`https://www.twitch.tv/${user.twitch_username.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.cardLink}
            >
              <div className={styles.card}>
                <img
                  src={user.profile_image_url}
                  alt={`${user.twitch_username} 的头像`}
                  className={styles.offlineProfile}
                  width="120"
                  height="120"
                  loading="lazy"
                />
                <p className={styles.playerName}>{user.pokeName}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
