
import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import styles from './EventsDetail.module.css'
import BackButton from '../../components/BackButton/BackButton'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import { slugify } from '../../utils/slugify'
import { translatePokemonName } from '../../utils/pokemon'
import { translateLocationName } from '../../utils/pokemonTermsZh'
import { formatCommunityEventText, formatCommunityEventTitle, translateNatureName } from '../../utils/contentZh'

export default function EventsDetail() {
  const { slug } = useParams()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  const breadcrumbs = [
    { name: '首页', url: '/' },
    { name: '活动', url: '/events' },
    { name: formatCommunityEventTitle(event?.title), url: `/event/${slug}` }
  ];

  const eventSchema = event ? {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": formatCommunityEventTitle(event.title),
    "description": formatCommunityEventText(event.description),
    "startDate": event.startDate,
    "endDate": event.endDate,
    "url": `https://b1aoo.github.io/team-site/event/${slug}`,
    "image": event.imageLink || "https://b1aoo.github.io/team-site/images/openGraph.jpg",
    "organizer": {
      "@type": "Organization",
      "name": "Team Synergy",
      "url": "https://b1aoo.github.io/team-site/"
    },
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode"
  } : null;

  useDocumentHead({
    title: event?.title ? `${formatCommunityEventTitle(event.title)}｜PokeMMO 活动` : '正在加载活动…',
    description: event ? formatCommunityEventText(event.description, '参加 Team Synergy 的 PokeMMO 活动：闪光狩猎竞赛、比赛与公会挑战。') : '参加 Team Synergy 的 PokeMMO 活动：闪光狩猎竞赛、比赛与公会挑战。',
    canonicalPath: `/event/${slug}/`,
    url: `https://b1aoo.github.io/team-site/event/${slug}/`,
    ogImage: event?.imageLink || 'https://b1aoo.github.io/team-site/images/openGraph.jpg',
    twitterCard: 'summary_large_image',
    breadcrumbs: breadcrumbs,
    structuredData: eventSchema
  })

  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await fetch('https://adminpage.hypersmmo.workers.dev/admin/events')
        if (!res.ok) throw new Error(`活动资料加载失败：${res.status}`)
        const data = await res.json()
        const found = data.find(e => slugify(e.title) === slug)
        setEvent(found || null)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchEvent()
  }, [slug])

  function formatEventDate(dateString) {
    const date = new Date(dateString)
    const day = date.getDate()
    const daySuffix = (d) => {
      if (d > 3 && d < 21) return 'th'
      switch (d % 10) {
        case 1: return 'st'
        case 2: return 'nd'
        case 3: return 'rd'
        default: return 'th'
      }
    }
    const options = {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }
    return new Intl.DateTimeFormat('zh-CN', options).format(date)
  }

  if (loading) return <div className="message">正在加载活动…</div>
  if (!event) return <div className="message">未找到该活动。</div>


  return (
    <div className={styles.container}>
      <BackButton to="/events/" label="← 返回活动列表" />
      <h1 className={styles.title}>{formatCommunityEventTitle(event.title)}</h1>

      {event.imageLink && (
        <div className={styles.imageWrapper}>
          <img src={event.imageLink} alt={formatCommunityEventTitle(event.title)} className={styles.image} />
        </div>
      )}

      {/* Hide and Seek Event Details */}
      {event.eventType === "hideandseek" ? (
        <>
          {event.hideAndSeekDescription && (
            <div className={styles.listSection}>
              <h3>活动说明</h3>
              <div>
                {event.hideAndSeekDescription.split(/\r?\n/).map((line, idx) => (
                  <span key={idx}>
                  {formatCommunityEventText(line)}
                    <br />
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className={styles.info}>
            {event.startDate && (
              <div className={styles.infoItem}>
                <span>时间：</span>
                <div>{formatEventDate(event.startDate)}</div>
              </div>
            )}
            {event.location && (
              <div className={styles.infoItem}>
                <span>{event.eventType === "hideandseek" ? '集合地点：' : '地点：'}</span>
                <div>{translateLocationName(event.location)}</div>
              </div>
            )}
          </div>
          {event.hideAndSeekRounds?.length > 0 && (
            <div className={styles.listSection}>
              <h3>回合</h3>
              <div className={styles.roundsCardGrid}>
                {event.hideAndSeekRounds.map((round, i) => {
                  let hostImg = null;
                  if (round.host && /^[a-zA-Z0-9 .'-]+$/.test(round.host)) {
                    const imgName = round.host.toLowerCase().replace(/[^a-z0-9]/g, '-');
                    hostImg = `https://img.pokemondb.net/sprites/black-white/anim/normal/${imgName}.gif`;
                  }
                  return (
                    <div key={i} className={styles.roundCard}>
                      <div className={styles.roundPrize}><b>奖品：</b> {formatCommunityEventText(round.prize, '奖品详情请向主办方确认。')}</div>
                      {round.prizeImage && (
                        <div className={styles.roundPrizeImage}>
                          <img
                            src={round.prizeImage}
                            alt="奖品"
                            className={styles.prizeImg}
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                      )}
                      <div className={styles.roundHost}>
                        <b>主办：</b> {round.host}
                        {hostImg && (
                          <img
                            src={hostImg}
                            alt={round.host}
                            className={styles.pokemonImg}
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <div className={styles.roundWinner}><b>获胜者：</b> {round.winner}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {event.hideAndSeekRules && (
            <div className={styles.listSection}>
              <h3>规则</h3>
              <div>
                {event.hideAndSeekRules.split(/\r?\n/).map((line, idx) => (
                  <span key={idx}>
                  {formatCommunityEventText(line)}
                    <br />
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={styles.info}>
            <div className={styles.infoItem}>
              <span>开始：</span>
              <div>{formatEventDate(event.startDate)}</div>
            </div>
            <div className={styles.infoItem}>
              <span>结束：</span>
              <div>{formatEventDate(event.endDate)}</div>
            </div>
            {/* Only show location if not a Group Hunt */}
            {event.eventType !== 'grouphunt' && event.location && (
              <div className={styles.infoItem}>
                <span>地点：</span>
                <div>{translateLocationName(event.location)}</div>
              </div>
            )}
            {event.duration && (
              <div className={styles.infoItem}>
                <span>持续时间：</span>
                <div>{formatCommunityEventText(event.duration)}</div>
              </div>
            )}
            {event.scoring && (
              <div className={styles.infoItem}>
                <span>计分方式：</span>
                <div>{formatCommunityEventText(event.scoring)}</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Nature Bonus */}
      {event.natureBonus?.length > 0 && (
        <div className={styles.listSection}>
          <h3>性格加成</h3>
          <div className={styles.natureColumn}>
            {event.natureBonus.map((n, i) => {
              const bonus = Number(n.bonus)
              return (
                <div key={i} className={styles.natureCard}>
                  <span className={styles.natureName}>{translateNatureName(n.nature)}</span>
                  <span
                    className={styles.natureBonus}
                    style={{
                      color: bonus > 0 ? '#7CFC00' : bonus < 0 ? '#FF6347' : '#e0d7f1',
                    }}
                  >
                    {bonus > 0 ? `+${bonus}` : bonus}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Valid Pokémon */}
      {event.validPokemon?.length > 0 && (
        <div className={styles.listSection}>
          <h3>有效宝可梦</h3>
          <div
            className={`${styles.pokemonColumn} ${event.validPokemon.length === 1 ? styles.singlePokemonColumn : ''}`}
          >
            {event.validPokemon.map((p, i) => {
              const bonus = Number(p.bonus || 0)
              const name = p.pokemon || p.name
              const imgName = name.toLowerCase().replace(/\s/g, '-')
              const imgUrl = `https://img.pokemondb.net/sprites/black-white/anim/normal/${imgName}.gif`
              const shinyImg = `https://img.pokemondb.net/sprites/black-white/anim/shiny/${imgName}.gif`

              return (
                <div key={i} className={styles.pokemonCard}>
                  <div className={styles.pokemonHeader}>
                    <span className={styles.pokemonName}>{translatePokemonName(name)}</span>
                    {bonus !== 0 && (
                      <span
                        className={styles.pokemonBonus}
                        style={{
                          color: bonus > 0 ? '#7CFC00' : bonus < 0 ? '#FF6347' : '#e0d7f1',
                        }}
                      >
                        {bonus > 0 ? `+${bonus}` : bonus}
                      </span>
                    )}
                  </div>
                  <img
                    src={imgUrl}
                    alt={translatePokemonName(name)}
                    className={styles.pokemonImg}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Target Pokémon for Group Hunt */}
        {event.eventType === 'grouphunt' && event.targetPokemon?.length > 0 && (
          <div className={styles.listSection}>
          <h3>目标宝可梦</h3>
            <div
              className={`${styles.pokemonColumn} ${event.targetPokemon.length === 1 ? styles.singlePokemonColumn : ''}`}
            >
              {event.targetPokemon.map((t, i) => {
                const name = t.pokemon
                const imgUrl = `https://img.pokemondb.net/sprites/black-white/anim/shiny/${name.toLowerCase().replace(/\s/g, '-')}.gif`
                return (
                  <div key={i} className={styles.pokemonCard}>
                      <img
                      src={imgUrl}
                      alt={translatePokemonName(name)}
                      className={styles.pokemonImg}
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                    <span className={styles.pokemonName}>{translatePokemonName(name)}</span>
                    {t.location && <span className={styles.pokemonLocation}>地点：{translateLocationName(t.location)}</span>}
                    {t.duration && <span className={styles.pokemonDuration}> {formatCommunityEventText(t.duration)}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}


      {/* Participating Staff */}
      {event.participatingStaff?.length > 0 && (
        <div className={styles.listSection}>
          <h3>参与工作人员</h3>
          <div className={styles.staffColumn}>
            {event.participatingStaff.map((staff, i) => (
              <div key={i} className={styles.staffCard}>
                {staff}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prizes */}
      {(
        (event.firstPlacePrize?.filter(p => p?.trim())?.length ?? 0) > 0 ||
        (event.secondPlacePrize?.filter(p => p?.trim())?.length ?? 0) > 0 ||
        (event.thirdPlacePrize?.filter(p => p?.trim())?.length ?? 0) > 0 ||
        (event.fourthPlacePrize?.filter(p => p?.trim())?.length ?? 0) > 0
      ) && (
        <div className={styles.listSection}>
          <h3>奖品</h3>

          {(event.firstPlacePrize?.filter(p => p?.trim())?.length ?? 0) > 0 && (
            <div className={`${styles.prizeGroup} ${styles.firstPlace}`}>
              <div className={styles.prizeTitle}>🏆 第一名</div>
              {event.firstPlacePrize.filter(p => p?.trim()).map((prize, i) => (
                <div key={`first-${i}`} className={styles.prizeItem}>{formatCommunityEventText(prize, '活动奖品详情请向主办方确认。')}</div>
              ))}
            </div>
          )}

          {(event.secondPlacePrize?.filter(p => p?.trim())?.length ?? 0) > 0 && (
            <div className={`${styles.prizeGroup} ${styles.secondPlace}`}>
              <div className={styles.prizeTitle}>🥈 第二名</div>
              {event.secondPlacePrize.filter(p => p?.trim()).map((prize, i) => (
                <div key={`second-${i}`} className={styles.prizeItem}>{formatCommunityEventText(prize, '活动奖品详情请向主办方确认。')}</div>
              ))}
            </div>
          )}

          {(event.thirdPlacePrize?.filter(p => p?.trim())?.length ?? 0) > 0 && (
            <div className={`${styles.prizeGroup} ${styles.thirdPlace}`}>
              <div className={styles.prizeTitle}>🥉 第三名</div>
              {event.thirdPlacePrize.filter(p => p?.trim()).map((prize, i) => (
                <div key={`third-${i}`} className={styles.prizeItem}>{formatCommunityEventText(prize, '活动奖品详情请向主办方确认。')}</div>
              ))}
            </div>
          )}

          {(event.fourthPlacePrize?.filter(p => p?.trim())?.length ?? 0) > 0 && (
            <div className={`${styles.prizeGroup} ${styles.fourthPlace}`}>
              <div className={styles.prizeTitle}>🏅 第四名</div>
              {event.fourthPlacePrize.filter(p => p?.trim()).map((prize, i) => (
                <div key={`fourth-${i}`} className={styles.prizeItem}>{formatCommunityEventText(prize, '活动奖品详情请向主办方确认。')}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rules for Catch Events */}
      {event.eventType === "catchevent" && (
        <div className={styles.listSection}>
          <h3>规则与报名</h3>
          <ul className={styles.rulesList}>
            <li>按由高到低排序的第 1 至第 3 名，需要提交得分最高的参赛宝可梦。</li>
            <li>第四名需提交得分最低的参赛宝可梦。</li>
            <li>每位玩家只能提交一次。</li>
            <li>每位玩家只能使用一个账号或角色参赛。</li>
            <li>所有参赛宝可梦必须在活动时间内、活动地点内捕获。</li>
            <li>所有参赛宝可梦必须保持未进化状态。</li>
            <li>目标宝可梦的进化形或未进化形均不作为有效参赛对象。</li>
            <li>你必须是该宝可梦的原训练家（OT）。</li>
            <li>若出现同分，以最早的捕获时间决定名次。</li>
            <li>能够进入活动地点的玩家均可参加，无需提前报名。</li>
            <li>通过私聊将参赛宝可梦链接发送给任意参与工作人员；结果公布前请将其保留在队伍中。</li>
          </ul>
        </div>
      )}

      {/* Winners */}
      {(
        (event.firstPlaceWinners?.filter(w => w?.trim())?.length ?? 0) > 0 ||
        (event.secondPlaceWinners?.filter(w => w?.trim())?.length ?? 0) > 0 ||
        (event.thirdPlaceWinners?.filter(w => w?.trim())?.length ?? 0) > 0 ||
        (event.fourthPlaceWinners?.filter(w => w?.trim())?.length ?? 0) > 0
      ) && (
        <div className={styles.listSection}>
          <h3>获胜者</h3>

          {(event.firstPlaceWinners?.filter(w => w?.trim())?.length ?? 0) > 0 && (
            <div className={`${styles.prizeGroup} ${styles.firstPlace}`}>
              <div className={styles.prizeTitle}>🏆 第一名</div>
              {event.firstPlaceWinners.filter(w => w?.trim()).map((winner, i) => (
                <div key={`first-${i}`} className={styles.prizeItem}>{winner}</div>
              ))}
            </div>
          )}

          {(event.secondPlaceWinners?.filter(w => w?.trim())?.length ?? 0) > 0 && (
            <div className={`${styles.prizeGroup} ${styles.secondPlace}`}>
              <div className={styles.prizeTitle}>🥈 第二名</div>
              {event.secondPlaceWinners.filter(w => w?.trim()).map((winner, i) => (
                <div key={`second-${i}`} className={styles.prizeItem}>{winner}</div>
              ))}
            </div>
          )}

          {(event.thirdPlaceWinners?.filter(w => w?.trim())?.length ?? 0) > 0 && (
            <div className={`${styles.prizeGroup} ${styles.thirdPlace}`}>
              <div className={styles.prizeTitle}>🥉 第三名</div>
              {event.thirdPlaceWinners.filter(w => w?.trim()).map((winner, i) => (
                <div key={`third-${i}`} className={styles.prizeItem}>{winner}</div>
              ))}
            </div>
          )}

          {(event.fourthPlaceWinners?.filter(w => w?.trim())?.length ?? 0) > 0 && (
            <div className={`${styles.prizeGroup} ${styles.fourthPlace}`}>
              <div className={styles.prizeTitle}>🏅 第四名</div>
              {event.fourthPlaceWinners.filter(w => w?.trim()).map((winner, i) => (
                <div key={`fourth-${i}`} className={styles.prizeItem}>{winner}</div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
