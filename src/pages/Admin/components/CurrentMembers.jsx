import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAdminDB from '../hooks/useAdminDatabase';
import styles from './CurrentMembers.module.css';

export default function CurrentMembers({ auth }) {
  const navigate = useNavigate();
  const db = useAdminDB(auth);

  const [editingPlayer, setEditingPlayer] = useState(null);
  const [newPlayer, setNewPlayer] = useState({ name: '' });
  const [showMembers, setShowMembers] = useState(false);
  const [search, setSearch] = useState("");

  // ------------------ Helpers ------------------
  const normalize = n => n?.toString().trim().replace(/\s+/g, ' ').toLowerCase();

  // ------------------ Load Members ------------------
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        await db.loadMembers();
        if (db.loadDatabase) await db.loadDatabase();
      } catch (err) {
        console.error("Failed to load members or database:", err);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, []);

  // ------------------ Computed Values ------------------
  const shinyOwners = useMemo(() => {
    return Object.entries(db.database || {})
      .filter(([_, player]) => player.shinies && Object.keys(player.shinies).length > 0)
      .map(([name]) => name);
  }, [db.database]);

  const memberNames = useMemo(() => db.members.map(m => m.name), [db.members]);
  const memberNamesNorm = useMemo(() => new Set(memberNames.map(normalize)), [memberNames]);
  const databaseNames = useMemo(() => Object.keys(db.database || {}), [db.database]);
  const databaseNamesNorm = useMemo(() => new Set(databaseNames.map(normalize)), [databaseNames]);

  const notInTeam = useMemo(() => shinyOwners.filter(owner => !memberNamesNorm.has(normalize(owner))), [shinyOwners, memberNamesNorm]);
  const notInDatabase = useMemo(() => memberNames.filter(name => !databaseNamesNorm.has(normalize(name))), [memberNames, databaseNamesNorm]);

  const filteredMembers = useMemo(() => {
    const normalizedSearch = normalize(search);
    return db.members
      .filter(player => normalize(player.name).includes(normalizedSearch))
      .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
  }, [db.members, search]);

  // ------------------ Handlers ------------------
  const handleEdit = player => setEditingPlayer(player);
  const handleDelete = playerId => db.deleteMember(playerId);
  const handleSaveEdit = updatedPlayer => {
    db.updateMember(updatedPlayer);
    setEditingPlayer(null);
  };

  const handleAdd = async () => {
    if (!newPlayer.name.trim()) return;

    if (!auth || (!auth.username && !auth.name)) {
      console.error("Auth is missing! Cannot add member.");
      return;
    }

    try {
      const success = await db.addMember(newPlayer);
      if (!success) console.error("Failed to add member.");
      setNewPlayer({ name: '' });
    } catch (err) {
      console.error("Failed to add member:", err);
    }
  };

  // ------------------ Render ------------------
  return (
    <div className={styles.panel}>
      <h1>当前成员</h1>

      <button onClick={() => setShowMembers(v => !v)} style={{ marginBottom: 8 }}>
        {showMembers ? '隐藏成员' : '显示成员'}
      </button>

      {showMembers && (
        <>
          {db.isMembersLoading ? (
            <div>正在载入成员…</div>
          ) : (
            <>
              <input
                type="text"
                placeholder="搜索成员…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ marginBottom: 12, width: '100%', maxWidth: 300 }}
              />

              <ul>
                {filteredMembers.map((player, idx) => (
                  <li key={player.id}>
                    {editingPlayer && editingPlayer.id === player.id ? (
                      <div>
                        <input
                          value={editingPlayer.name}
                          onChange={e =>
                            setEditingPlayer({ ...editingPlayer, name: e.target.value })
                          }
                          placeholder="名称"
                        />
                        <input
                          value={editingPlayer.details || ''}
                          onChange={e =>
                            setEditingPlayer({ ...editingPlayer, details: e.target.value })
                          }
                          placeholder="详情"
                        />
                        <button onClick={() => handleSaveEdit(editingPlayer)}>保存</button>
                        <button onClick={() => setEditingPlayer(null)}>取消</button>
                      </div>
                    ) : (
                      <div>
                        <span>{idx + 1}: {player.name}{player.details ? ` - ${player.details}` : ''}</span>
                        <button onClick={() => handleEdit(player)}>编辑</button>
                        <button onClick={() => handleDelete(player.id)}>删除</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <div style={{ marginTop: 24 }}>
        <h2>添加新训练家</h2>
        <input
          placeholder="名称"
          value={newPlayer.name}
          onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })}
        />
        <button onClick={handleAdd}>添加</button>
      </div>

      {notInTeam.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2>不在公会中</h2>
          <ul>
            {notInTeam.map(owner => <li key={owner}>{owner}</li>)}
          </ul>
        </div>
      )}

      {notInDatabase.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2>不在数据库中</h2>
          <ul>
            {notInDatabase.map(name => <li key={name}>{name}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
