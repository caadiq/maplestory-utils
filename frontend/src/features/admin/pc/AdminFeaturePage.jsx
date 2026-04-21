import { Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAdminComponent } from '../../registry'
import { api } from '../../../api/client'

export default function AdminFeaturePage() {
  const { slug } = useParams()
  const Component = getAdminComponent(slug)

  // 메뉴 정보 조회 (없는 기능 안내용)
  const { data: menus = [] } = useQuery({
    queryKey: ['admin', 'menus'],
    queryFn: () => api('/api/admin/menus').catch(() => []),
  })
  const menu = menus.find((m) => (m.url || '').replace(/^\/+/, '').split('/')[0] === slug)

  if (!Component) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto pt-6">
        {menu && (
          <div>
            <h2 className="text-lg font-medium">{menu.title}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>{menu.description}</p>
          </div>
        )}
        <div
          className="rounded-2xl border border-dashed p-12 text-center"
          style={{
            borderColor: 'var(--dashed-border)',
            background: 'var(--skeleton-bg)',
          }}
        >
          <div className="text-4xl mb-3 opacity-30">🛠️</div>
          <p style={{ color: 'var(--text-muted)' }}>이 기능에는 관리 페이지가 없습니다</p>
          <p className="text-xs mt-2 font-mono" style={{ color: 'var(--text-dim)' }}>
            features/{slug}/{slug.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('')}Admin.jsx
          </p>
          <Link
            to={`/admin/menus/${menu?.id || ''}`}
            className="inline-block mt-4 text-xs hover:text-[var(--accent-hover-text)]"
            style={{ color: 'var(--accent)' }}
          >
            메뉴 정보 편집 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <Component />
    </Suspense>
  )
}
