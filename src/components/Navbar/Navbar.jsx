import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getAssetUrl } from '../../utils/assets'
import styles from './Navbar.module.css'

const NAV_ITEMS = [
  { to: '/', label: '首页' },
    {
    label: 'Synergy 公会',
    submenu: [
      { to: '/shiny-showcase/', label: '闪光收藏展示' },
      { to: '/shotm/', label: '本月闪光' },
      { to: '/team-statistics/', label: '公会统计' },
      { to: '/streamers/', label: '主播' },
      { to: '/trophy-board/', label: '荣誉墙' },
      { to: '/bounties/', label: '悬赏' },
      { to: '/events/', label: '活动' },
      { to: '/dex-helper/', label: '图鉴助手' },
      { to: '/official-shiny-wars-planner/', label: '官方闪光大战规划器' },
      { to: '/shiny-war-2025/', label: '2025 闪光大战' },
    ]
  },
  { to: '/pokedex/', label: '宝可梦图鉴' },
  { to: '/safari-zones/', label: '狩猎地带' },
  { to: '/altering-cave-rotations/', label: '变化洞窟' },
  { to: '/region-maps/', label: '地区地图' },
  { to: '/official-event-calendar/', label: '官方活动日历' },
  { to: '/catching-calculator/', label: '捕捉计算器' },
  {
    label: '工具',
    submenu: [
      { to: '/counter-generator/', label: '计数器生成器' },
      { to: '/egg-move-calculator/', label: '遗传招式计算器' },
      { to: '/player-card-generator/', label: '玩家卡片生成器' },
      { to: '/random-pokemon-generator/', label: '随机宝可梦生成器' },
      { to: '/shiny-odds/', label: '闪光概率' },
      { to: '/sprite-recolour/', label: '精灵图改色' },
      { to: '/particle-viewer/', label: '粒子效果预览' },
    ]
  },
  { to: '/themes/', label: '主题' },
  { to: '/resources/', label: '资料库' },
]


export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)

  const handleLinkClick = () => {
    setMenuOpen(false)
  }

  return (
    <nav className={styles.nav}>
      {/* Hamburger button for mobile */}
      <button
        className={styles.hamburger}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="切换菜单"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Desktop navigation */}
      <ul className={styles.list}>
        {NAV_ITEMS.map(item => (
          <li 
            key={item.label}
            className={item.submenu ? styles.dropdownContainer : ''}
            onMouseEnter={() => item.submenu && setOpenDropdown(item.label)}
            onMouseLeave={() => setOpenDropdown(null)}
          >
            {item.submenu ? (
              <>
                <button
                  type="button"
                  className={`${styles.link} ${styles.dropdownToggle}`}
                  onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                  aria-expanded={openDropdown === item.label}
                  aria-haspopup="menu"
                >
                  {item.label}
                  <span className={styles.dropdownArrow}>▼</span>
                </button>
                <ul className={`${styles.dropdown} ${openDropdown === item.label ? styles.dropdownOpen : ''}`}>
                  {item.submenu.map(subitem => (
                    <li key={subitem.to}>
                      <NavLink
                        to={subitem.to}
                        className={({ isActive }) =>
                          `${styles.dropdownLink} ${isActive ? styles.dropdownActive : ''}`
                        }
                        onClick={() => setOpenDropdown(null)}
                      >
                        {subitem.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `${styles.link} ${isActive ? styles.active : ''}`
                }
              >
                {item.label}
              </NavLink>
            )}
          </li>
        ))}
      </ul>

      {/* Discord icon for desktop */}
      <a
        href="https://discord.gg/2BEUq6fWAj"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.discordLink}
      >
        <img src={getAssetUrl('images/discord.png')} alt="Discord" width="42" height="42" />
      </a>

      {/* Mobile menu overlay */}
      <div
        className={`${styles.overlay} ${menuOpen ? styles.overlayOpen : ''}`}
        onClick={() => setMenuOpen(false)}
      />
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}>
        {NAV_ITEMS.map(item => (
          <div key={item.label}>
            {item.submenu ? (
              <>
                <button
                  className={`${styles.mobileDropdownToggle} ${openDropdown === item.label ? styles.mobileDropdownOpen : ''}`}
                  onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                >
                  {item.label}
                  <span className={styles.mobileDropdownArrow}>▼</span>
                </button>
                <div className={`${styles.mobileDropdown} ${openDropdown === item.label ? styles.mobileDropdownVisible : ''}`}>
                  {item.submenu.map(subitem => (
                    <NavLink
                      key={subitem.to}
                      to={subitem.to}
                      className={({ isActive }) =>
                        `${styles.mobileDropdownLink} ${isActive ? styles.mobileActive : ''}`
                      }
                      onClick={handleLinkClick}
                    >
                      {subitem.label}
                    </NavLink>
                  ))}
                </div>
              </>
            ) : (
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `${styles.mobileLink} ${isActive ? styles.mobileActive : ''}`
                }
                onClick={handleLinkClick}
              >
                {item.label}
              </NavLink>
            )}
          </div>
        ))}
        <a
          href="https://discord.gg/2BEUq6fWAj"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.mobileDiscord}
          onClick={handleLinkClick}
        >
          <img src={getAssetUrl('images/discord.png')} alt="Discord" width="32" height="32" />
          加入 Discord
        </a>
      </div>
    </nav>
  )
}
