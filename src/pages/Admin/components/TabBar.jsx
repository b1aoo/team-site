import styles from '../Admin.module.css'

const TABS = [
  { key: 'add', label: '添加宝可梦', shortLabel: '添加' },
  { key: 'edit', label: '编辑训练家', shortLabel: '编辑' },
  { key: 'current_members', label: '当前成员', shortLabel: '成员' },
  { key: 'streamers', label: '主播' },
  { key: 'events', label: '活动' },
  { key: 'bounties', label: '悬赏', shortLabel: '悬赏' },
  { key: 'themes', label: '主题' },
  { key: 'log', label: '管理日志', shortLabel: '日志' },
  { key: 'json', label: '高级（JSON）', shortLabel: '高级' },
]

export default function TabBar({ activeTab, onTabChange }) {
  return (
    <div className={styles.tabBar}>
      {TABS.map(tab => (
        <button
          key={tab.key}
          className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
          onClick={() => onTabChange(tab.key)}
        >
          <span className={styles.tabLabelFull}>{tab.label}</span>
          <span className={styles.tabLabelShort}>{tab.shortLabel || tab.label}</span>
        </button>
      ))}
    </div>
  )
}
