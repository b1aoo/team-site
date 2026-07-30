import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import RoamingLegendaries from '../../components/RoamingLegendaries/RoamingLegendaries'
import { getAssetUrl } from '../../utils/assets'
import styles from './Home.module.css'
import { useInGameClock } from '../../hooks/useInGameClock'
const IN_GAME_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_OFFSET = 5;

function InGameClockDisplay() {
  const state = useInGameClock(DAY_OFFSET, IN_GAME_DAYS);

  const timeStr = `${String(state.hours).padStart(2,'0')}:${String(state.mins).padStart(2,'0')}`;
  const realMins = state.realMinsLeft;
  const countdownStr = realMins >= 60
    ? `${Math.floor(realMins / 60)}h ${realMins % 60}m`
    : `${realMins}m`;
  
  return (
    <div className={styles.clockContainer}>
      <div className={styles.clockMain}>
        <div className={styles.clockTime}>{timeStr}</div>
        <div className={styles.clockDetails}>
          <span className={styles.clockDay}>{state.day}</span>
          <span className={styles.clockDay}>{state.season}</span>
          <span className={`${styles.clockPeriod} ${styles[`period${state.period}`]}`}>{state.period}</span>
          <span className={styles.clockCountdown}>距离下个时段还有 {countdownStr}</span>
        </div>
      </div>
      <div className={styles.clockButtonRow}>
        <Link to="/time-display/" className={styles.clockButton}>
          查看游戏内时间表
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  useDocumentHead({
    title: 'Team Synergy - PokeMMO 闪光狩猎社区',
    description: 'Team Synergy 是 PokeMMO 闪光狩猎社区。浏览 140 多位玩家的闪光收藏，用图鉴追踪进度，观看 Twitch 直播并参与竞赛。',
    canonicalPath: '/',
    robots: 'index, follow, max-image-preview:large',
  })

  return (
    <div className={styles.container}>
      <h1 className="seo-optimized">
        Team Synergy：PokeMMO 闪光狩猎社区
      </h1>
      
      <p className="seo-intro">
        PokeMMO 闪光狩猎的一站式据点：浏览 140 多位玩家的收藏，查阅详尽图鉴，观看 Twitch 直播，并参与各类竞赛。
      </p>

      <img src={getAssetUrl('images/pagebreak.png')} alt="分隔线" className="pagebreak" />

      <RoamingLegendaries />

      <InGameClockDisplay />

      <img src={getAssetUrl('images/pagebreak.png')} alt="分隔线" className="pagebreak" />

      <section className={styles.featuresSection}>
        <h2>欢迎来到 Team Synergy</h2>
        <img
          src={getAssetUrl('images/teamsyn.gif')}
          alt="Team Synergy"
          className={styles.teamSynGif}
        />
        <p>
          Team Synergy 是一个专注于刷闪的 PokeMMO 社区。我们一起狩猎、举办有趣的活动，并分享对 PokeMMO 的热爱！
        </p>
        <p>
          借助主播、竞赛活动和不断完善的社区网站，Team Synergy 将来自世界各地的玩家聚在一起，共同享受 PokeMMO。无论你是休闲刷闪，还是追求名次的闪光猎人，这里都有你的位置！
        </p>
        <p>
          Team Synergy 是充满活力的 PokeMMO 闪光狩猎社区。加入数千名玩家，一起记录闪光收藏、参加活动、共同刷闪。
        </p>

        <div className={styles.featuresGrid}>
          <Link to="/shiny-showcase/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/reuniclus.gif" alt="Reuniclus" />
            </div>
            <h3>闪光收藏展示</h3>
            <p>浏览 140 多位成员的闪光收藏，并查看排名</p>
          </Link>

          <Link to="/pokedex/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/pikachu.gif" alt="Pikachu" />
            </div>
            <h3>宝可梦图鉴</h3>
            <p>查询刷闪地点、头目宝可梦与详尽的宝可梦资料</p>
          </Link>

          <Link to="/streamers/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/rotom.gif" alt="Rotom" />
            </div>
            <h3>主播</h3>
            <p>观看 Team Synergy 成员的 Twitch 直播</p>
          </Link>

          <Link to="/resources/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/porygon.gif" alt="Porygon" />
            </div>
            <h3>资料库</h3>
            <p>查阅实用的 PokeMMO 攻略与资料</p>
          </Link>

          <Link to="/safari-zones/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/riolu.gif" alt="Riolu" />
            </div>
            <h3>狩猎地带</h3>
            <p>查看各地区狩猎地带的详细资料</p>
          </Link>

          <Link to="/roaming-legendaries/" className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <img src="https://img.pokemondb.net/sprites/black-white/anim/shiny/suicune.gif" alt="Suicune" />
            </div>
            <h3>游走传说宝可梦</h3>
            <p>追踪游走传说宝可梦的出现周期</p>
          </Link>
        </div>
      </section>
      <img src={getAssetUrl('images/pagebreak.png')} alt="分隔线" className="pagebreak" />

      <section className={styles.applySection}>
        <h2>如何申请加入</h2>
        <p>
          想加入 Team Synergy 吗？我们始终欢迎投入、友善的 PokeMMO 玩家。申请方式如下：
        </p>
        <h3>申请条件</h3>
        <ul>
          <li><strong>年龄：</strong>18 岁以上</li>
          <li><strong>完成全部 5 个地区的主线</strong></li>
          <li><strong>游戏时长至少 500 小时</strong></li>
          <li><strong>至少拥有 3 只闪光宝可梦</strong></li>
        </ul>
        <h3>申请步骤</h3>
        <ol>
          <li>加入我们的 <a href="https://discord.gg/2BEUq6fWAj" target="_blank" rel="noopener noreferrer">Discord 服务器</a></li>
          <li>查看 #applications 频道，确认当前是否开放申请</li>
          <li>填写申请表</li>
          <li>管理团队会审核你的申请</li>
        </ol>
        <p>
          如果你符合以上条件，也热爱 PokeMMO，我们期待你的申请！
        </p>
      </section>

      <img src={getAssetUrl('images/pagebreak.png')} alt="Page Break" className="pagebreak" />

      <section className={styles.changelogSection}>
        <h2>Changelog</h2>
        <div className={styles.changelog}>
          <div className={styles.changelogEntry}>
            <h3>April 20, 2026</h3>
            <ul>
              <li><strong>Route Finder</strong> - Added a new tool for finding PokeMMO routes and location details</li>
              <li><strong>Region Maps</strong> - Added interactive region maps for browsing routes, spawns, and points of interest</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>February 23, 2026</h3>
            <ul>
              <li><strong>Shiny Odds Page</strong> - New Coping method that lets you track how lucky or unlucky you are in your current hunt</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>February 17, 2026</h3>
            <ul>
              <li><strong>Safari Zone</strong> - Added page for detailed Safari Zone Information for all 4 regions *Mitchell*</li>
              <li>Removed About Page and merged into new Home/Index screen</li>
              <li>Merged relative tabs to clear tab space</li>
              <li><strong>Resource Page!</strong> - Added new Resource Page for PokeMMO guides and information</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>February 14, 2026</h3>
            <ul>
              <li><strong>Statistics Page Now Shows Partial Data</strong> - No longer requires all data types at once</li>
              <li>If you have 50% encounter data, you'll see General Statistics, Encounter Analysis, and Tier Distribution</li>
              <li>If you have 50% location data, you'll see Region Distribution</li>
              <li>If you have 50% hunting method data, you'll see Hunting Methods</li>
              <li>Shiny Wars pokemon are now clickable links to their PokeDex pages</li>
              <li>About page styling made consistent with the rest of the site</li>
              <li><strong>Pokédex Filter Panel Redesigned</strong> - Improved layout matching reference design with Moves, Essentials, and Base Stats sections</li>
              <li>Alpha Filter - Added ability to filter Pokémon by Alpha status</li>
              <li>Egg Group Selection - Now allows selecting up to 2 egg groups with "Any" or "Both" matching options</li>
              <li>Ability to see Alpha variants only</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>February 13, 2026</h3>
            <ul>
              <li><strong>Shiny Data Merge System Added</strong> - New NPM scripts for syncing ShinyBoard API data</li>
              <li>Configurable field merging (IVs, nature, location, encounter method, date caught, encounter count, nickname, variant)</li>
              <li>Grabs information using the API, Users must match the evolutions and names for Pokemon to match correctly.</li>
              <li>Fixed info box display on hover - shows pokemon that are not included</li>
              <li>Pokemon variant forms like frillish-f and gastrodon-east now merge correctly</li>
              <li>Player statistics threshold increased to 65% data completeness for leaderboards</li>
              <li>Added click-away functionality to Player Leaderboards dropdown</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>February 12, 2026</h3>
            <ul>
              <li>New Rare Pokemon section in location search</li>
              <li>Fixed sprite rendering issues</li>
              <li>Mobile layouts no longer overlapping (finally)</li>
              <li>"Special" Pokemon forms (Tornadus, Thundurus, Landorus) now working</li>
              <li>Fixed Meloetta and Keldeo forms</li>
              <li>Wormadam display fixed</li>
              <li>Mobile responsiveness improvements across the board</li>
              <li>Added About page</li>
              <li>Added EV Yields to Pokemon Pages</li>
              <li>Fixed Pokemon Pages displaying incorrectly on Mobile Devices</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>February 11, 2026</h3>
            <ul>
              <li>Rewrote sprite system with better JSON data</li>
              <li>Added form and gender selector</li>
              <li>Pokedex now matches SHOTM style</li>
              <li>Fixed Pokemon GIF scaling issues</li>
              <li>Added Quick Ball to the catch calculator</li>
              <li>Mobile filter menu is now collapsible</li>
              <li>Stat bars look way better</li>
              <li>Pokemon time display with seasons</li>
              <li>Evolution lines and ability tooltips added</li>
              <li>Branch evolutions actually work now</li>
              <li>Click location cards to filter the Pokedex</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>February 10, 2026</h3>
            <ul>
              <li>Dropped the Pokemon Detail Pages!</li>
              <li>Search by location and encounters</li>
              <li>Type effectiveness and stat search tools</li>
              <li>Full Pokedex redesign with way better filtering</li>
              <li>Legendaries and special encounters now tracked</li>
              <li>Genderless Pokemon handling fixed</li>
              <li>Female-only Pokemon now showing up correctly</li>
              <li>Gender ratios and ordering added</li>
              <li>Fossil Pokemon tracking</li>
              <li>Pokedex pages added to sitemap</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>February 9, 2026</h3>
            <ul>
              <li>Trophy Pages are here</li>
              <li>Shiny Wars 2025 page with all the results of the 2025 OSW</li>
              <li>Secret shiny glow effect on hover</li>
              <li>New Streamers page for the team</li>
              <li>Embedded links everywhere for easy navigation</li>
              <li>Custom info boxes for events and achievements</li>
              <li>Fixed deployment crashes</li>
              <li>Sold/fled Pokemon now show on SHOTM, but do not add points</li>
              <li>Mobile live preview working again</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>February 8, 2026</h3>
            <ul>
              <li>Events system</li>
              <li>Switched to Puppeteer for prerendering</li>
              <li>Faster prerendering overall</li>
              <li>Event type settings added for different event type creation (obviously)</li>
            </ul>
          </div>
          <div className={styles.changelogEntry}>
            <h3>February 6-7, 2026</h3>
            <ul>
              <li>Streamers page now using Twitch directly</li>
              <li>Fixed admin streamers tab issues</li>
              <li>Counter Generator button styling fixed</li>
              <li>Admin tabs now wrap on mobile</li>
              <li>Reduced crazy hover scales on mobile</li>
              <li>Better touch interactions overall</li>
              <li>InfoBox positioning fixed on mobile</li>
            </ul>
          </div>
        </div>
        <div className={styles.metadata}>
          <p><strong>Last Updated:</strong> April 20, 2026</p>
          <p><strong>Contact:</strong> oHypers on Discord</p>
        </div>
      </section>
    </div>
  )
}
