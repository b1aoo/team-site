import { useState } from 'react'
import Autocomplete from './Autocomplete'
import ShinyForm from './ShinyForm'
import BulkAddDialog, { parseBulkAddText } from './BulkAddDialog'
import styles from '../Admin.module.css'

export default function AddPokemonTab({ db, playerNames, allPokemonNames, onAdd, isMutating, onBulkAdd }) {
  const [player, setPlayer] = useState('')
  const [duplicateNotice, setDuplicateNotice] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  function checkDuplicates(pokemonName) {
    if (!player || !pokemonName || !db[player]) return null
    const shinies = db[player].shinies || {}
    const matches = Object.entries(shinies).filter(
      ([, s]) => s.Pokemon.toLowerCase() === pokemonName.toLowerCase()
    )
    if (matches.length > 0) {
      return `“${pokemonName}”已在 ${player} 的记录中出现 ${matches.length} 次。重复记录有效，此提示仅供参考。`
    }
    return null
  }

  async function handleSubmit(shinyData) {
    if (!player.trim()) return
    const notice = checkDuplicates(shinyData.Pokemon)
    setDuplicateNotice(notice)
    // If date_caught is blank, set it to '' (empty string)
    const fixedData = { ...shinyData, date_caught: shinyData.date_caught === '' ? '' : shinyData.date_caught }
    const result = await onAdd(player, fixedData)
    if (result?.success) {
      setDuplicateNotice(null)
    }
    return result
  }

  async function handleBulkAdd(entries) {
    // Batch all new shinies into a single DB update
    const newDb = JSON.parse(JSON.stringify(db));
    const added = [];
    for (const entry of entries) {
      let { player: entryPlayer, ...shinyData } = entry;
      if (!entryPlayer) continue;
      // Find canonical player name (case-insensitive)
      const canonicalName = Object.keys(newDb).find(
        name => name.toLowerCase() === entryPlayer.toLowerCase()
      );
      if (canonicalName) {
        entryPlayer = canonicalName;
      }
      if (!newDb[entryPlayer]) newDb[entryPlayer] = { shiny_count: 0, shinies: {} };
      const existingIds = Object.keys(newDb[entryPlayer].shinies).map(Number);
      const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
      newDb[entryPlayer].shinies[nextId] = { ...shinyData };
      newDb[entryPlayer].shiny_count = (newDb[entryPlayer].shiny_count || 0) + 1;
      added.push({ player: entryPlayer, id: nextId });
    }
    if (onBulkAdd) {
      await onBulkAdd(newDb, added);
    }
    // Optionally, show a confirmation or error summary here
  }

  return (
    <div>
      <label>训练家名称：</label>
      <Autocomplete
        id="addPlayerName"
        value={player}
        onChange={setPlayer}
        getOptions={() => playerNames}
        placeholder="Hyper"
      />

      <button style={{ marginTop: 10, marginBottom: 10 }} onClick={() => setBulkOpen(true)}>
        批量添加
      </button>

      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onBulkAdd={handleBulkAdd}
        playerNames={playerNames}
        allPokemonNames={allPokemonNames}
        db={db}
      />

      {!player.trim() && (
        <p className={styles.hintText}>选择或输入训练家名称以添加一只闪光宝可梦。</p>
      )}

      {player.trim() && (
        <>
          {duplicateNotice && (
            <div className={styles.infoNotice}>{duplicateNotice}</div>
          )}
          <ShinyForm
            onSubmit={handleSubmit}
            submitLabel="添加宝可梦"
            allPokemonNames={allPokemonNames}
            isMutating={isMutating}
          />
        </>
      )}
    </div>
  )
}
