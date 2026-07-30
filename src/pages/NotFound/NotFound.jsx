import { Link } from 'react-router-dom'
import { useDocumentHead } from '../../hooks/useDocumentHead'

export default function NotFound() {
  useDocumentHead({
    title: '未找到页面',
    description: '此页面不存在于 Team Synergy 的 PokeMMO 网站中。',
  })
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <h1>404 - 未找到页面</h1>
      <p style={{ color: '#aaa', marginTop: '16px', fontSize: '1.1rem' }}>
        你访问的页面不存在。
      </p>
      <Link
        to="/"
        style={{
          display: 'inline-block',
          marginTop: '24px',
          padding: '12px 30px',
          borderRadius: '25px',
          background: '#5a2ee0',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 'bold',
          fontSize: '1rem',
          transition: 'all 0.3s ease',
        }}
      >
        返回首页
      </Link>
    </div>
  )
}
