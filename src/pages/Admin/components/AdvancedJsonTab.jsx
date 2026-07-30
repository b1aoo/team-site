import { useState, useMemo } from 'react'
import ConfirmDialog from './ConfirmDialog'
import styles from '../Admin.module.css'

const REQUIRED_SHINY_FIELDS = [
  'Pokemon', 'Secret Shiny', 'Egg', 'Alpha',
  'Sold', 'Event', 'Reaction', 'MysteriousBall', 'Safari',
  'Favourite', 'Honey Tree', 'Legendary', 'Reaction Link',
]

function validateDatabaseSchema(data) {
  const errors = []
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push('根对象必须以训练家名称为键。')
    return errors
  }
  for (const [player, playerData] of Object.entries(data)) {
    if (typeof playerData !== 'object' || playerData === null) {
      errors.push(`“${player}”：必须是对象。`)
      continue
    }
    if (typeof playerData.shiny_count !== 'number') {
      errors.push(`“${player}”：缺少或包含无效的 “shiny_count”（必须为数字）。`)
    }
    if (typeof playerData.shinies !== 'object' || playerData.shinies === null) {
      errors.push(`“${player}”：缺少或包含无效的 “shinies”（必须为对象）。`)
      continue
    }
    for (const [id, shiny] of Object.entries(playerData.shinies)) {
      if (typeof shiny !== 'object' || shiny === null) {
        errors.push(`“${player}”的闪光记录 #${id}：必须是对象。`)
        continue
      }
      for (const field of REQUIRED_SHINY_FIELDS) {
        if (!(field in shiny)) {
          errors.push(`“${player}”的闪光记录 #${id}：缺少字段 “${field}”。`)
        }
      }
    }
  }
  return errors
}

function validateStreamersSchema(data) {
  const errors = []
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push('根对象必须以主播名称为键。')
    return errors
  }
  for (const [name, entry] of Object.entries(data)) {
    if (typeof entry !== 'object' || entry === null) {
      errors.push(`“${name}”：必须是对象。`)
      continue
    }
    if (typeof entry.twitch_username !== 'string') {
      errors.push(`“${name}”：缺少或包含无效的 “twitch_username”。`)
    }
  }
  return errors
}

// Simple validation for events DB: root must be object
function validateEventsSchema(data) {
  const errors = []
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push('根对象必须以活动名称为键。')
  }
  return errors
}

// Normalize Pokemon database: fix entry gaps and recalculate shiny_count
function normalizePokemonDatabase(data) {
  const correctedData = JSON.parse(JSON.stringify(data)) // Deep copy
  const corrections = []

  for (const [player, playerData] of Object.entries(correctedData)) {
    if (typeof playerData !== 'object' || playerData === null || !playerData.shinies) {
      continue
    }

    const shinies = playerData.shinies
    const shinyIds = Object.keys(shinies)
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id))
      .sort((a, b) => a - b)

    // Check if there are gaps in the numbering
    const hasGaps = shinyIds.some((id, i) => id !== i + 1)

    if (hasGaps || shinyIds.length !== playerData.shiny_count) {
      // Rebuild shinies with sequential IDs starting from 1
      const newShinies = {}
      shinyIds.forEach((oldId, index) => {
        newShinies[index + 1] = shinies[oldId]
      })

      // Calculate shiny_count excluding sold Pokemon
      const newShinyCount = Object.values(newShinies).filter(s => s.Sold !== 'Yes').length

      correctedData[player].shinies = newShinies
      correctedData[player].shiny_count = newShinyCount

      corrections.push(
        `“${player}”：已修复编号空缺并重新计算 shiny_count（原为 ${playerData.shiny_count}，现为 ${newShinyCount}）`
      )
    }
  }

  return { correctedData, corrections }
}

function computeChangeSummary(oldData, newData, mode) {
  const changes = []
  const oldKeys = new Set(Object.keys(oldData))
  const newKeys = new Set(Object.keys(newData))

  for (const k of newKeys) {
    if (!oldKeys.has(k)) changes.push(
      mode === 'pokemon' ? `+ 已添加训练家“${k}”` :
      mode === 'streamers' ? `+ 已添加主播“${k}”` :
      `+ 已添加活动“${k}”`
    )
  }
  for (const k of oldKeys) {
    if (!newKeys.has(k)) changes.push(
      mode === 'pokemon' ? `- 已移除训练家“${k}”` :
      mode === 'streamers' ? `- 已移除主播“${k}”` :
      `- 已移除活动“${k}”`
    )
  }

  for (const k of newKeys) {
    if (oldKeys.has(k)) {
      if (mode === 'pokemon') {
        const oldCount = Object.keys(oldData[k]?.shinies || {}).length
        const newCount = Object.keys(newData[k]?.shinies || {}).length
        if (oldCount !== newCount) {
          changes.push(`~ “${k}”：闪光记录 ${oldCount} → ${newCount}`)
        } else if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) {
          changes.push(`~ “${k}”：数据已修改`)
        }
      } else if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) {
        changes.push(`~ “${k}”：数据已修改`)
      }
    }
  }

  return changes
}

export default function AdvancedJsonTab({
  database,
  streamersDB,
  eventsDB,
  onUpdateDatabase,
  onUpdateStreamers,
  onUpdateEvents,
  isMutating,
}) {
  const [mode, setMode] = useState('pokemon')
  const [editingJson, setEditingJson] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [validationErrors, setValidationErrors] = useState([])
  const [changeSummary, setChangeSummary] = useState([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [parsedData, setParsedData] = useState(null)

  const currentData = useMemo(() => {
    if (mode === 'pokemon') return database
    if (mode === 'streamers') return streamersDB
    if (mode === 'events') return eventsDB
    return {}
  }, [mode, database, streamersDB, eventsDB])

  const previewText = useMemo(() => JSON.stringify(currentData, null, 2), [currentData])

  function openEditor() {
    setEditingJson(previewText)
    setIsEditing(true)
    setValidationErrors([])
    setChangeSummary([])
  }

  function handleValidateAndSave() {
    let parsed
    try {
      parsed = JSON.parse(editingJson)
    } catch (err) {
      setValidationErrors([`JSON 无效：${err.message}`])
      return
    }

    // Normalize Pokemon database to fix gaps and recalculate counts
    let corrections = []
    if (mode === 'pokemon') {
      const { correctedData, corrections: normalizeCorrections } = normalizePokemonDatabase(parsed)
      parsed = correctedData
      corrections = normalizeCorrections
    }

    const errors =
      mode === 'pokemon' ? validateDatabaseSchema(parsed) :
      mode === 'streamers' ? validateStreamersSchema(parsed) :
      validateEventsSchema(parsed)

    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors([])
    let summary = computeChangeSummary(currentData, parsed, mode)
    
    // Add corrections to summary if any were made
    if (corrections.length > 0) {
      summary = [
        ...corrections.map(c => `已自动修正：${c}`),
        ...summary
      ]
    }

    setChangeSummary(summary)
    setParsedData(parsed)
    setShowConfirm(true)
  }

  async function handleConfirmSave() {
    if (!parsedData) return
    let result
    if (mode === 'pokemon') {
      result = await onUpdateDatabase(parsedData, `手动 JSON 编辑（宝可梦）`)
    } else if (mode === 'streamers') {
      result = await onUpdateStreamers(parsedData, `手动 JSON 编辑（主播）`)
    } else if (mode === 'events') {
      result = await onUpdateEvents(parsedData, `手动 JSON 编辑（活动）`)
    }

    if (result?.success) {
      setIsEditing(false)
      setShowConfirm(false)
      setParsedData(null)
      setChangeSummary([])
    }
    return result
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ margin: 0 }}>数据源：</label>
        <select
          value={mode}
          onChange={e => { setMode(e.target.value); setIsEditing(false) }}
          style={{ width: 'auto' }}
        >
          <option value="pokemon">宝可梦数据库</option>
          <option value="streamers">主播数据库</option>
          <option value="events">活动数据库</option>
        </select>
      </div>

      {!isEditing ? (
        <>
          <pre className={styles.preview} onClick={openEditor} style={{ cursor: 'pointer' }}>
            {previewText}
          </pre>
          <p className={styles.hintText}>点击上方 JSON 以打开编辑器。</p>
        </>
      ) : (
        <>
          <textarea
            className={styles.jsonEditor}
            value={editingJson}
            onChange={e => { setEditingJson(e.target.value); setValidationErrors([]) }}
            spellCheck={false}
          />

          {validationErrors.length > 0 && (
            <div className={styles.validationErrors}>
              <strong>校验错误：</strong>
              <ul>
                {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          <div className={styles.modalButtons} style={{ marginTop: 12 }}>
            <button onClick={handleValidateAndSave} disabled={isMutating}>
              {isMutating ? '保存中…' : '校验并保存'}
            </button>
            <button onClick={() => setIsEditing(false)}>取消</button>
          </div>
        </>
      )}

      {showConfirm && (
        <ConfirmDialog
          title="确认更新 JSON"
          message={
            changeSummary.length === 0
              ? '未检测到结构性变更，仍要保存吗？'
              : `检测到 ${changeSummary.length} 项变更：\n\n${changeSummary.join('\n')}`
          }
          confirmLabel="保存修改"
          onConfirm={handleConfirmSave}
          onCancel={() => { setShowConfirm(false); setParsedData(null) }}
        />
      )}
    </div>
  )
}
