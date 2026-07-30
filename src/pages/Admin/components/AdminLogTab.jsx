import styles from '../Admin.module.css'

export default function AdminLogTab({ logData, members }) {
  const sortedLog = [...logData].sort((a, b) => new Date(b.time) - new Date(a.time));

  // Leaderboard calculation
  const leaderboard = {};
  for (const entry of logData) {
    if (entry.admin) {
      leaderboard[entry.admin] = (leaderboard[entry.admin] || 0) + 1;
    }
  }

  // Get all admin names (from members prop, fallback to logData)
  const allAdmins = members && members.length
    ? members.map(m => m.name)
    : Array.from(new Set(logData.map(e => e.admin).filter(Boolean)));

  // Build leaderboard array including 0s
  const leaderboardArr = allAdmins
    .map(name => [name, leaderboard[name] || 0])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (sortedLog.length === 0) {
    return <p className={styles.hintText}>未找到日志记录。</p>;
  }

  return (
    <div>
      <h3>管理日志（{sortedLog.length} 条）</h3>
      <pre className={styles.logPreview}>
        {sortedLog.map(entry => {
          const date = new Date(entry.time);
          const formattedTime = date.toLocaleString(undefined, {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          });
          return `管理员：${entry.admin}\n操作：\n${entry.action}\n时间：${formattedTime}\n-------------------------\n`;
        }).join('')}
      </pre>
      <h3>排行榜</h3>
      <table style={{ marginBottom: 24, width: '100%', maxWidth: 400 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>管理员</th>
            <th style={{ textAlign: 'right' }}>变更数</th>
          </tr>
        </thead>
        <tbody>
          {leaderboardArr.map(([admin, count]) => (
            <tr key={admin}>
              <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{admin}</td>
              <td style={{ textAlign: 'right' }}>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
