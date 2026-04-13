import { Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAdminComponent } from '../registry'
import { api } from '../../api/client'

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
      <div className="space-y-4">
        {menu && (
          <div>
            <h2 className="text-lg font-semibold">{menu.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{menu.description}</p>
          </div>
        )}
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
          <div className="text-4xl mb-3 opacity-30">🛠️</div>
          <p className="text-gray-400">이 기능에는 관리 페이지가 없습니다</p>
          <p className="text-xs text-gray-600 mt-2 font-mono">
            features/{slug}/{slug.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('')}Admin.jsx
          </p>
          <Link
            to={`/admin/menus/${menu?.id || ''}`}
            className="inline-block mt-4 text-xs text-emerald-400 hover:text-emerald-300 transition"
          >
            메뉴 정보 편집 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center pt-20">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <Component />
    </Suspense>
  )
}
