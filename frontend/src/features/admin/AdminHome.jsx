import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'

function MenuCard({ menu }) {
  const navigate = useNavigate()
  // 메뉴 url에서 slug 추출 (/boss-crystal → boss-crystal)
  const slug = (menu.url || '').replace(/^\/+/, '').split('/')[0]
  const adminPath = slug ? `/admin/${slug}` : `/admin/menus/${menu.id}`

  const handleEditClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/admin/menus/${menu.id}`)
  }

  return (
    <Link
      to={adminPath}
      className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900/80 to-gray-900/40 p-5 hover:border-emerald-500/30 hover:from-emerald-500/5 hover:to-cyan-500/5 transition-all duration-300"
    >
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-emerald-500/0 group-hover:bg-emerald-500/10 blur-2xl transition-all duration-500" />

      {/* 톱니바퀴 - 메뉴 정보 편집 */}
      <button
        onClick={handleEditClick}
        className="absolute top-3 right-3 w-8 h-8 rounded-lg border border-white/5 hover:border-white/20 hover:bg-white/5 text-gray-500 hover:text-gray-300 flex items-center justify-center text-sm transition opacity-0 group-hover:opacity-100 z-10"
        title="메뉴 정보 편집"
        aria-label="메뉴 정보 편집"
      >
        ⚙
      </button>

      <div className="relative flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/5 flex items-center justify-center overflow-hidden group-hover:scale-110 group-hover:border-emerald-500/30 transition-all duration-300">
          <img src={menu.image?.url || '/default.png'} alt={menu.title} className="w-9 h-9 object-contain" />
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <h3 className="font-semibold text-white group-hover:text-emerald-300 transition truncate">{menu.title}</h3>
          <p className="text-sm text-gray-400 mt-1 leading-relaxed truncate">{menu.description}</p>
          <p className="text-xs text-gray-600 mt-1 font-mono truncate">{menu.url}</p>
        </div>
      </div>
    </Link>
  )
}

function AddCard({ to, icon, label }) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-500/40 bg-white/[0.02] hover:bg-emerald-500/5 p-5 min-h-[112px] transition-all"
    >
      <div className="w-10 h-10 rounded-full border border-white/10 group-hover:border-emerald-500/40 flex items-center justify-center text-gray-500 group-hover:text-emerald-400 transition">
        {icon}
      </div>
      <span className="text-sm text-gray-500 group-hover:text-emerald-300 transition">{label}</span>
    </Link>
  )
}

export default function AdminHome() {
  const { handleLogout } = useOutletContext() || {}
  const { data: menus = [], isLoading: loading } = useQuery({
    queryKey: ['admin', 'menus'],
    queryFn: () => api('/api/admin/menus').catch(() => []),
  })

  return (
    <div className="space-y-8">
      {/* 메뉴 섹션 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">기능 관리</h2>
            <p className="text-sm text-gray-500 mt-0.5">메뉴 항목을 추가하거나 관리합니다</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/[0.02] animate-pulse" />
            ))
          ) : (
            <>
              {menus.map((menu) => (
                <MenuCard key={menu.id} menu={menu} />
              ))}
              <AddCard to="/admin/menus/new" icon="+" label="메뉴 항목 추가" />
            </>
          )}
        </div>
      </section>

      {/* 자원 관리 섹션 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">자원 관리</h2>
          <p className="text-sm text-gray-500 mt-0.5">공용 이미지 등 사이트 자원을 관리합니다</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/admin/images"
            className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900/80 to-gray-900/40 p-5 hover:border-cyan-500/30 hover:from-cyan-500/5 hover:to-blue-500/5 transition-all duration-300"
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-cyan-500/0 group-hover:bg-cyan-500/10 blur-2xl transition-all duration-500" />
            <div className="relative flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/5 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:border-cyan-500/30 transition-all duration-300">
                🖼️
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold group-hover:text-cyan-300 transition">이미지 관리</h3>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">공용 이미지 업로드 및 관리</p>
              </div>
              <div className="text-gray-700 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all duration-300">
                →
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* 로그아웃 */}
      {handleLogout && (
        <div className="pt-4 text-center">
          <button
            onClick={handleLogout}
            className="text-xs text-gray-600 hover:text-red-400 transition"
          >
            관리자 로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
