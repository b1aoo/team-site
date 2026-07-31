import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './EventsPage.module.css'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import { slugify } from '../../utils/slugify';
import { formatCommunityEventTitle } from '../../utils/contentZh';

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  const breadcrumbs = [
    { name: '首页', url: '/' },
    { name: '活动', url: '/events' }
  ];

    useDocumentHead({
    title: 'PokeMMO 活动｜Team Synergy 社群活动',
    description: '查看 Team Synergy 的 PokeMMO 社群活动：闪光狩猎竞赛、季节赛、公会挑战与特别活动。',
    canonicalPath: '/events/',
    breadcrumbs: breadcrumbs
  })
  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('https://adminpage.hypersmmo.workers.dev/admin/events')
        if (!res.ok) throw new Error(`活动资料加载失败：${res.status}`)
        const data = await res.json()
        // Sort by startDate descending (latest first)
        data.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
        setEvents(data)
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvents()
  }, [])

  if (isLoading) return <div className="message">正在加载活动…</div>
  if (!events.length) return <div className="message">暂无活动资料。</div>

  const now = new Date()

  const publishedEvents = events.filter(e => e.published != false)
  const ongoingEvents = publishedEvents.filter(
    (e) => new Date(e.startDate) <= now && now <= new Date(e.endDate)
  )
  let upcomingEvents = publishedEvents.filter((e) => new Date(e.startDate) > now)
  upcomingEvents = upcomingEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
  const pastEvents = publishedEvents.filter((e) => new Date(e.endDate) < now)

  const renderEventGrid = (eventsArray) => (
    <div className={styles.grid}>
      {eventsArray.map((event) => (
        <div
          key={event.id}
          className={styles.item}
          onClick={() => navigate(`/event/${slugify(event.title)}/`)}
        >
          <img
            src={event.imageLink || `${import.meta.env.BASE_URL}placeholder.png`}
            alt={formatCommunityEventTitle(event.title)}
            className={styles.img}
            width="200"
            height="120"
            loading="lazy"
          />
          <div className={styles.label}>
            <strong>{formatCommunityEventTitle(event.title)}</strong>
            <div>{new Date(event.startDate).toLocaleString('zh-CN')}</div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <h1 className={styles.eventTitle}>Team Synergy 活动</h1>

      {ongoingEvents.length > 0 && (
        <>
          <h2 className={styles.eventStatus}>进行中</h2>
          {renderEventGrid(ongoingEvents)}
        </>
      )}

      {upcomingEvents.length > 0 && (
        <>
          <h2 className={styles.eventStatus}>即将开始</h2>
          {renderEventGrid(upcomingEvents)}
        </>
      )}

      {pastEvents.length > 0 && (
        <>
          <h2 className={styles.eventStatus}>往期活动</h2>
          {renderEventGrid(pastEvents)}
        </>
      )}
    </div>
  )
}
