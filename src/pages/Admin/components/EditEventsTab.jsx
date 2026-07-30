import { useState } from 'react'
import Autocomplete from './Autocomplete'
import EventForm from './EventForm' // We'll create this similar to ShinyForm
import ConfirmDialog from './ConfirmDialog'
import styles from '../Admin.module.css'

export default function EditEventsTab({
  eventsList,       // Array of all events
  onEditEvent,      // Function to save event edits
  onDeleteEvent,    // Function to delete an event
  isMutating,
}) {
  const [selectedEventId, setSelectedEventId] = useState('')
  const [editingData, setEditingData] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selectedEvent = eventsList.find(e => e.id === selectedEventId)

  function handleEdit() {
    setEditingData({ ...selectedEvent })
  }

  function handleCancelEdit() {
    setEditingData(null)
  }

  async function handleSaveEdit(eventData) {
    const result = await onEditEvent(selectedEventId, eventData)
    if (result?.success) {
      setEditingData(null)
    }
    return result
  }

  async function handleConfirmDelete() {
    const result = await onDeleteEvent(selectedEventId)
    if (result?.success) {
      setSelectedEventId('')
      setConfirmDelete(false)
    }
    return result
  }

  return (
    <div>
      <label>选择活动：</label>
      <Autocomplete
        id="editEventSelect"
        value={selectedEventId}
        onChange={val => {
          setSelectedEventId(val)
          setEditingData(null)
        }}
        getOptions={() => eventsList.map(e => ({ value: e.id, label: e.title }))}
        placeholder="搜索活动…"
      />

      {!selectedEventId && (
        <p className={styles.hintText}>选择一个活动以编辑其详情。</p>
      )}

      {selectedEventId && !selectedEvent && (
        <p className={styles.hintText}>未找到活动。</p>
      )}

      {selectedEvent && !editingData && (
        <div style={{ marginTop: 16 }}>
          <h3>{selectedEvent.title}</h3>
          <button
            className={styles.primaryBtn}
            onClick={handleEdit}
          >
            编辑活动
          </button>
          <button
            className={styles.dangerBtn}
            style={{ marginLeft: 10 }}
            onClick={() => setConfirmDelete(true)}
          >
            删除活动
          </button>
        </div>
      )}

      {editingData && (
        <div className={styles.editSection}>
          <h3>正在编辑活动：{editingData.title}</h3>
          <EventForm
            initialData={editingData}
            onSubmit={handleSaveEdit}
            submitLabel="保存修改"
            isMutating={isMutating}
          />
          <button
            onClick={handleCancelEdit}
            style={{ backgroundColor: '#555', marginTop: 10 }}
          >
            取消编辑
          </button>
        </div>
      )}

      {confirmDelete && selectedEvent && (
        <ConfirmDialog
          title="删除活动"
          message={`确定要永久删除“${selectedEvent.title}”吗？此操作无法撤销。`}
          confirmLabel="删除活动"
          typeToConfirm={selectedEvent.title}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
