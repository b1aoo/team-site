import { useState } from 'react'
import { API } from '../../../api/endpoints'
import { onGifError, translatePokemonName } from '../../../utils/pokemon'
import styles from '../Admin.module.css'

export default function ShinyTable({ shinies, onEdit, onDelete, onReorder }) {
  const entries = Object.entries(shinies).sort(([a], [b]) => parseInt(b) - parseInt(a))

  const [draggedId, setDraggedId] = useState(null)
  const [draggedOverId, setDraggedOverId] = useState(null)

  if (entries.length === 0) {
    return <p className={styles.hintText}>该训练家尚未收录闪光宝可梦。</p>
  }

  const handleDragStart = (id) => {
    setDraggedId(id)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (id) => {
    if (draggedId !== id) {
      setDraggedOverId(id)
    }
  }

  const handleDragLeave = () => {
    setDraggedOverId(null)
  }

  const handleDrop = (e, targetId) => {
    e.preventDefault()
    setDraggedOverId(null)

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      return
    }

    // Create new order by swapping or reordering IDs
    const idList = entries.map(([id]) => id)
    const draggedIndex = idList.indexOf(draggedId)
    const targetIndex = idList.indexOf(targetId)

    // Remove dragged item and insert at new position
    const newOrder = [...idList]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedId)

    // Call onReorder with the new order
    if (onReorder) {
      onReorder(newOrder)
    }

    setDraggedId(null)
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.shinyTable}>
        <thead>
          <tr>
            <th>#</th>
            <th>图像</th>
            <th>宝可梦</th>
            <th>月份</th>
            <th>年份</th>
            <th>特征</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([id, shiny]) => {
            const traits = []
            if (shiny['Secret Shiny'] === 'Yes') traits.push({ label: '秘密闪光', cls: 'traitSecret' })
            if (shiny.Alpha === 'Yes') traits.push({ label: '头目', cls: 'traitAlpha' })
            if (shiny.Egg === 'Yes') traits.push({ label: '孵化', cls: 'traitEgg' })
            if (shiny.Safari === 'Yes') traits.push({ label: '狩猎地带', cls: 'traitSafari' })
            if (shiny['Honey Tree'] === 'Yes') traits.push({ label: '甜甜蜜树', cls: 'traitHoney' })
            if (shiny.Fossil === 'Yes') traits.push({ label: '化石', cls: 'traitFossil' })
            if (shiny.Fishing === 'Yes') traits.push({ label: '垂钓', cls: 'traitFishing' })
            if (shiny.Swarm === 'Yes') traits.push({ label: '群聚', cls: 'traitSwarm' })
            if (shiny.Headbutt === 'Yes') traits.push({ label: '头锤树', cls: 'traitHeadbutt' })
            if (shiny.Sold === 'Yes') traits.push({ label: '已售出', cls: 'traitSold' })
            if (shiny.Event === 'Yes') traits.push({ label: '活动', cls: 'traitEvent' })
            if (shiny.Favourite === 'Yes') traits.push({ label: '收藏', cls: 'traitFav' })
            if (shiny.Legendary === 'Yes') traits.push({ label: '传说', cls: 'traitLegend' })
            if (shiny.MysteriousBall === 'Yes') traits.push({ label: '神秘球', cls: 'traitMystery' })
            if (shiny.Reaction === 'Yes') traits.push({ label: '反应', cls: 'traitReaction' })

            const spriteName = shiny.Pokemon.toLowerCase().replace(/[^a-z0-9-]/g, '')

            return (
              <tr
                key={id}
                draggable
                onDragStart={() => handleDragStart(id)}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, id)}
                className={`${shiny.Sold === 'Yes' ? styles.soldRow : ''} ${draggedId === id ? styles.dragging : ''} ${draggedOverId === id ? styles.dragOver : ''}`}
                style={{
                  opacity: draggedId === id ? 0.5 : 1,
                  cursor: 'grab',
                }}
              >
                <td>{id}</td>
                <td>
                  <img
                    src={API.pokemonSprite(spriteName)}
                    alt={translatePokemonName(shiny.Pokemon)}
                    className={styles.spriteImg}
                    width="80"
                    height="80"
                    loading="lazy"
                    onError={onGifError(spriteName)}
                  />
                </td>
                <td>{translatePokemonName(shiny.Pokemon)}</td>
                <td>{shiny.Month || '-'}</td>
                <td>{shiny.Year || '-'}</td>
                <td>
                  <div className={styles.traitBadges}>
                    {traits.map(t => (
                      <span key={t.label} className={`${styles.traitBadge} ${styles[t.cls]}`}>{t.label}</span>
                    ))}
                    {traits.length === 0 && <span className={styles.traitNone}>-</span>}
                  </div>
                </td>
                <td>
                  <div className={styles.actionBtns}>
                    <button className={styles.editBtn} onClick={() => onEdit(id, shiny)}>编辑</button>
                    <button className={styles.deleteBtn} onClick={() => onDelete(id, shiny)}>删除</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
