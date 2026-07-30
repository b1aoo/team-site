import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import useAdminDB from './hooks/useAdminDatabase'
import useToast from './hooks/useToast'

import TabBar from './components/TabBar'
import AddPokemonTab from './components/AddPokemonTab'
import EditPlayerTab from './components/EditPlayerTab'
import StreamersTab from './components/StreamersTab'
import CurrentMembers from './components/CurrentMembers'
import EventsTab from './components/EventsTab'
import AdminLogTab from './components/AdminLogTab'
import AdvancedJsonTab from './components/AdvancedJsonTab'
import ThemesTab from './components/ThemesTab'
import Toast from './components/Toast'
import BountiesTab from './components/BountiesTab'
import styles from './Admin.module.css'

export default function AdminPanel() {
  const { auth } = useAdmin()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('add')
  const { toast, show: showToast, dismiss: dismissToast } = useToast()

  const db = useAdminDB(auth)
  const events = db.events || []
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!auth) { navigate('/admin'); return }
    if (hasFetched.current) return
    hasFetched.current = true
    db.loadDatabase().catch(err => showToast('加载数据库失败：' + err.message, 'error'))
    db.loadEvents().catch(err => showToast('加载活动失败：' + err.message, 'error'))
    db.loadThemes().catch(err => showToast('加载主题失败：' + err.message, 'error'))
    db.loadBounties?.().catch(err => showToast('加载悬赏失败：' + err.message, 'error'))
  }, [auth])

  function withToast(fn, successMsg) {
    return async (...args) => {
      const result = await fn(...args)
      if (result?.success || result?.id) {
        showToast(successMsg || '已完成！', 'success', db.hasSnapshot ? () => handleUndo() : null)
      } else if (result?.error) {
        showToast(result.error, 'error')
      }
      return result
    }
  }

  async function handleUndo() {
    const ok = await db.undo()
    if (ok) showToast('已撤销操作！', 'success')
    else showToast('Undo failed.', 'error')
  }

  if (db.isLoading) {
    return (
      <div className={styles.panel}>
        <h1>管理后台</h1>
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <span>正在载入数据库…</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <h1>管理后台</h1>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {db.isMutating && (
        <div className={styles.loadingOverlay} style={{ padding: '12px 0' }}>
          <div className={styles.spinner} />
          <span>正在保存…</span>
        </div>
      )}

      {activeTab === 'add' && (
        <AddPokemonTab
          db={db.database}
          playerNames={db.playerNames}
          allPokemonNames={db.allPokemonNames}
          onAdd={withToast(db.addShiny, '已添加宝可梦！')}
          onBulkAdd={async (newDb, added) => {
            // Compose a detailed log message for the admin log
            let action = 'Bulk add:';
            if (Array.isArray(added) && added.length > 0) {
              action += '\n' + added.map(e => `- ${e.player}: ${newDb[e.player]?.shinies[e.id]?.Pokemon || 'Unknown'}`).join('\n');
            }
            const result = await db.updateFullDatabase(newDb, action);
            if (result?.success) showToast('批量添加完成！', 'success');
            else showToast(result?.error || '批量添加失败', 'error');
            return result;
          }}
          isMutating={db.isMutating}
        />
      )}

      {activeTab === 'edit' && (
        <EditPlayerTab
          playerNames={db.playerNames}
          getPlayerShinies={db.getPlayerShinies}
          allPokemonNames={db.allPokemonNames}
          onEditShiny={withToast(db.editShiny, '闪光宝可梦已更新！')}
          onDeleteShiny={withToast(db.deleteShiny, '闪光宝可梦已删除！')}
          onDeletePlayer={withToast(db.deletePlayer, '训练家记录已删除！')}
          onReorderShinies={withToast(db.reorderShinies, 'Shinies reordered!')}
          isMutating={db.isMutating}
        />
      )}

      {activeTab === 'current_members' && <CurrentMembers auth={auth} />}

      {activeTab === 'streamers' && (
        <StreamersTab
          streamersDB={db.streamersDB}
          onAdd={withToast(db.addStreamer, 'Streamer added!')}
          onDelete={withToast(db.deleteStreamer, 'Streamer deleted!')}
          onEdit={withToast(db.editStreamer, 'Streamer updated!')}   // 👈 ADD
          isMutating={db.isMutating}
        />
      )}

      {activeTab === 'events' && (
        <EventsTab
          eventDB={db.eventDB}           
          onCreate={db.addEvent}    
          onEdit={db.updateEvent}  
          onDelete={db.removeEvent}     
          isMutating={db.isMutating}
        />
      )}

      {activeTab === 'themes' && (
        <ThemesTab
          themesDB={db.themesDB}
          onSave={withToast(db.saveTheme, '主题已保存！')}
          onDelete={withToast(db.deleteTheme, '主题已删除！')}
          isMutating={db.isMutating}
        />
      )}
      {activeTab === 'bounties' && (
        <BountiesTab
          bounties={db.bounties || []}
          onAdd={withToast(db.addBounty, 'Bounty added!')}
          onEdit={withToast(db.editBounty, 'Bounty updated!')}
          onDelete={withToast(db.deleteBounty, 'Bounty deleted!')}
          isMutating={db.isMutating}
        />
      )}

      {activeTab === 'log' && <AdminLogTab logData={db.logData} members={db.members} />}

      {activeTab === 'json' && (
        <AdvancedJsonTab
          database={db.database}
          streamersDB={db.streamersDB}
          eventsDB={db.eventDB}
          onUpdateDatabase={withToast(db.updateFullDatabase, 'Database updated!')}
          onUpdateStreamers={withToast(db.updateFullStreamers, 'Streamers updated!')}
          isMutating={db.isMutating}
        />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
