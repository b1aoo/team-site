import { useState } from 'react'
import Autocomplete from './Autocomplete'
import styles from '../Admin.module.css'

const FLAG_FIELDS = [
  { key: 'Egg', label: '孵化' },
  { key: 'Secret Shiny', label: '秘密闪光' },
  { key: 'Safari', label: '狩猎地带' },
  { key: 'Alpha', label: '头目' },
  { key: 'Event', label: '活动' },
  { key: 'MysteriousBall', label: '神秘球' },
  { key: 'Honey Tree', label: '甜甜蜜树' },
  { key: 'Fossil', label: '化石' },
  { key: 'Swarm', label: '群聚' },
  { key: 'Fishing', label: '垂钓' },
  { key: 'Headbutt', label: '头锤树' },
]


export default function BulkAddReview({ entries, playerNames, allPokemonNames, onChange, onConfirm, onCancel, db }) {
    // Helper to check if a shiny already exists for this player and Pokémon
    function isDuplicate(entry) {
      if (!db || !entry.player || !entry.Pokemon) return false;
      const playerData = db[entry.player];
      if (!playerData || !playerData.shinies) return false;
      return Object.values(playerData.shinies).some(
        s => s.Pokemon && s.Pokemon.toLowerCase() === entry.Pokemon.toLowerCase()
      );
    }
    function handleRemove(idx) {
      const updated = pending.filter((_, i) => i !== idx);
      setPending(updated);
      onChange && onChange(updated);
    }
  // entries: [{ player, Pokemon, ...flags }]
  const [pending, setPending] = useState(entries)
  const [useCurrentMonth, setUseCurrentMonth] = useState(false)

  function handleFieldChange(idx, field, value) {
    const updated = pending.map((e, i) => i === idx ? { ...e, [field]: value } : e)
    setPending(updated)
    onChange && onChange(updated)
  }

  function handleFlagChange(idx, flag, value) {
    // Store as 'Yes'/'No' for compatibility
    handleFieldChange(idx, flag, value ? 'Yes' : 'No')
  }

  function handleConfirm() {
    let result = pending
    if (useCurrentMonth) {
      const now = new Date()
      const monthNames = [
        'January','February','March','April','May','June','July','August','September','October','November','December'
      ]
      const year = String(now.getFullYear())
      const month = monthNames[now.getMonth()]
      result = result.map(e => ({ ...e, Year: year, Month: month }))
    }
    // Only add entries with both player and Pokemon
    result = result.filter(e => e.player && e.Pokemon)
    onConfirm(result)
  }

  return (
    <div className={styles.dialogOverlay}>
      <div className={styles.dialogBox + ' ' + styles.bulkReviewFullWidth} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <h3>确认批量添加</h3>
        <div className={styles.bulkReviewHeader}>
          训练家／宝可梦／标记
          <label style={{ float: 'right', fontWeight: 'normal', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={useCurrentMonth}
              onChange={e => setUseCurrentMonth(e.target.checked)}
              style={{ marginRight: 4 }}
            />
            当前月份
          </label>
        </div>
        <div className={styles.bulkReviewList}>
          {pending.map((entry, idx) => (
            <div key={idx} className={styles.bulkReviewGridRow}>
              <div>
                <Autocomplete
                  id={`player-${idx}`}
                  value={entry.player}
                  onChange={val => handleFieldChange(idx, 'player', val)}
                  getOptions={() => playerNames}
                  placeholder="训练家"
                />
              </div>
              <div>
                <Autocomplete
                  id={`poke-${idx}`}
                  value={entry.Pokemon}
                  onChange={val => handleFieldChange(idx, 'Pokemon', val)}
                  getOptions={() => allPokemonNames}
                  placeholder="宝可梦"
                />
              </div>
              {FLAG_FIELDS.map(f => (
                <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, justifyContent: 'center', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={entry[f.key] === 'Yes'}
                    onChange={e => handleFlagChange(idx, f.key, e.target.checked)}
                  />
                  {f.label}
                </label>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button
                  type="button"
                  style={{
                    marginLeft: 0,
                    color: 'red',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: '#a259c4',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '4px 18px',
                  }}
                  onClick={() => handleRemove(idx)}
                  title="移除此条目"
                >
                  移除
                </button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={handleConfirm}>确认并添加</button>
          <button onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  )
}
