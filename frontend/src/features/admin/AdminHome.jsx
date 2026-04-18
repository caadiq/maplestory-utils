import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'

function MenuCard({ menu }) {
  const navigate = useNavigate()
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
      className="group relative rounded-2xl border p-5 transition-transform duration-300 hover:scale-[1.02] border-[var(--card-border)]"
      style={{
        backgroundImage: 'linear-gradient(to bottom right, var(--card-bg-from), var(--card-bg-to))',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <button
        onClick={handleEditClick}
        className="absolute top-3 right-3 w-8 h-8 rounded-lg border flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 border-[var(--btn-border)] bg-[var(--btn-bg)] hover:bg-[var(--btn-bg-hover)]"
        style={{ color: 'var(--text-dim)' }}
        title="메뉴 정보 편집"
        aria-label="메뉴 정보 편집"
      >
        ⚙
      </button>

      <div className="relative flex items-start gap-4">
        <div
          className="shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden border-[var(--icon-box-border)]"
          style={{ backgroundImage: 'linear-gradient(to bottom right, var(--icon-box-from), var(--icon-box-to))' }}
        >
          <img src={menu.image?.url || '/default.png'} alt={menu.title} className="w-9 h-9 object-contain" />
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <h3 className="font-medium truncate">{menu.title}</h3>
          <p
            className="text-sm mt-1 leading-relaxed line-clamp-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {menu.description}
          </p>
        </div>
      </div>
    </Link>
  )
}

function AddCard({ to, icon, label }) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 min-h-[112px] transition-transform duration-300 hover:scale-[1.02] border-[var(--dashed-border)]"
      style={{ background: 'var(--skeleton-bg)' }}
    >
      <div
        className="w-10 h-10 rounded-full border flex items-center justify-center border-[var(--dashed-border)]"
        style={{ color: 'var(--text-dim)' }}
      >
        {icon}
      </div>
      <span className="text-sm" style={{ color: 'var(--text-dim)' }}>{label}</span>
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
    <div className="space-y-8 max-w-5xl mx-auto pt-6">
      {/* 메뉴 섹션 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">기능 관리</h2>
            <p
              className="text-sm mt-0.5"
              style={{ color: 'var(--text-dim)' }}
            >
              메뉴 항목을 추가하거나 관리합니다
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-2xl animate-pulse"
                style={{ background: 'var(--skeleton-bg)' }}
              />
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
          <h2 className="text-lg font-medium">자원 관리</h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: 'var(--text-dim)' }}
          >
            공용 이미지 등 사이트 자원을 관리합니다
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/admin/images"
            className="group relative rounded-2xl border p-5 transition-transform duration-300 hover:scale-[1.02] border-[var(--card-border)]"
            style={{
              backgroundImage: 'linear-gradient(to bottom right, var(--card-bg-from), var(--card-bg-to))',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="relative flex items-start gap-4">
              <div
                className="shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center text-2xl border-[var(--icon-box-border)]"
                style={{ backgroundImage: 'linear-gradient(to bottom right, var(--icon-box-from), var(--icon-box-to))' }}
              >
                🖼️
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium">이미지 관리</h3>
                <p
                  className="text-sm mt-1 leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  공용 이미지 업로드 및 관리
                </p>
              </div>
              <div style={{ color: 'var(--text-dim)' }}>→</div>
            </div>
          </Link>
        </div>
      </section>

      {/* 로그아웃 */}
      {handleLogout && (
        <div className="pt-4 text-center">
          <button
            onClick={handleLogout}
            className="text-xs transition-colors hover:text-red-500"
            style={{ color: 'var(--text-dim)' }}
          >
            관리자 로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
