import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import styles from '../Admin.module.css'

export default function StreamersTab({ streamersDB, onAdd, onDelete, isMutating, onEdit }) {
  const [pokeName, setPokeName] = useState('')
  const [twitchName, setTwitchName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [editing, setEditing] = useState(null) // { oldName, pokeName, twitchName }
  function startEdit(name, data) {
    setEditing({ oldName: name, pokeName: name, twitchName: data.twitch_username || '' })
  }

  function cancelEdit() {
    setEditing(null)
  }

  async function handleEditSave() {
    if (!editing.pokeName.trim() || !editing.twitchName.trim()) return
    if (onEdit) {
      const result = await onEdit(editing.oldName, editing.pokeName, editing.twitchName)
      if (result?.success) setEditing(null)
      return result
    }
  }

  async function handleAdd() {
    if (!pokeName.trim() || !twitchName.trim()) return
    const result = await onAdd(pokeName, twitchName)
    if (result?.success) {
      setPokeName('')
      setTwitchName('')
    }
    return result
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return
    const result = await onDelete(confirmDelete)
    setConfirmDelete(null)
    return result
  }

  const streamerEntries = Object.entries(streamersDB).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div>
      <h3>添加主播</h3>
      <label>PokeMMO 名称：</label>
      <input
        type="text"
        value={pokeName}
        onChange={e => setPokeName(e.target.value)}
        placeholder="MiroMMO"
      />
      <label>Twitch 名称：</label>
      <input
        type="text"
        value={twitchName}
        onChange={e => setTwitchName(e.target.value)}
        placeholder="MiroMMO"
      />
      <button onClick={handleAdd} disabled={isMutating || !pokeName.trim() || !twitchName.trim()}>
        {isMutating ? '保存中…' : '添加主播'}
      </button>

      <h3>现有主播（{streamerEntries.length}）</h3>
      {streamerEntries.length === 0 ? (
        <p className={styles.hintText}>数据库中没有主播。</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.shinyTable}>
            <thead>
              <tr>
                <th>PokeMMO 名称</th>
                <th>Twitch 名称</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {streamerEntries.map(([name, data]) => (
                editing && editing.oldName === name ? (
                  <tr key={name}>
                    <td>
                      <input
                        type="text"
                        value={editing.pokeName}
                        onChange={e => setEditing({ ...editing, pokeName: e.target.value })}
                        disabled={isMutating}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editing.twitchName}
                        onChange={e => setEditing({ ...editing, twitchName: e.target.value })}
                        disabled={isMutating}
                      />
                    </td>
                    <td>
                      <button onClick={handleEditSave} disabled={isMutating || !editing.pokeName.trim() || !editing.twitchName.trim()}>
                        保存
                      </button>
                      <button onClick={cancelEdit} disabled={isMutating}>
                        取消
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{data.twitch_username}</td>
                    <td>
                      <button className={styles.editBtn} onClick={() => startEdit(name, data)} disabled={isMutating}>
                        编辑
                      </button>
                      <button className={styles.deleteBtn} onClick={() => setConfirmDelete(name)} disabled={isMutating}>
                        删除
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="删除主播"
          message={`确定要删除主播“${confirmDelete}”吗？`}
          confirmLabel="删除"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
