import { useLayoutEffect } from 'react'
import { Outlet, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useAuth } from '../../../hooks/useAuth'
import { useLayout } from '../../../components/pc/Layout'

const RESOURCE_ITEMS = [
  { to: '/admin/images', label: '이미지', icon: '🖼' },
  { to: '/admin/challenger-seasons', label: '챌린저스 시즌', icon: '🏆' },
  { to: '/admin/genesis-pass', label: '제네시스 패스', icon: '🎫' },
]

const NAV_BASE = 'group flex items-center gap-2.5 pl-3 pr-2.5 py-2.5 rounded-lg text-[14px] transition'

function navStyle({ isActive }) {
  return isActive
    ? {
        background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
        color: '#ffffff',
        fontWeight: 700,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35)',
      }
    : { color: '#cfdae4' }
}

/** 사이드바 그룹 제목 */
function GroupLabel({ children, action }) {
  return (
    <div className="flex items-center justify-between px-3 pt-4 pb-2 first:pt-1">
      <span className="text-[13px] font-bold tracking-wide" style={{ color: '#8ba0b5' }}>{children}</span>
      {action}
    </div>
  )
}

export default function AdminLayout() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { setWide } = useLayout()
  useLayoutEffect(() => {
    setWide(true)
    return () => setWide(false)
  }, [setWide])

  const { data: menus = [] } = useQuery({
    queryKey: ['admin', 'menus'],
    queryFn: () => api('/api/admin/menus').catch(() => []),
    enabled: !!user?.is_admin,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!user?.is_admin) return <Navigate to="/" replace />

  // 대시보드 없이 첫 기능으로 바로 들어간다 (사이드바가 이동을 담당)
  if (pathname === '/admin' || pathname === '/admin/') {
    const slug = (menus[0]?.url || '').replace(/^\/+/, '').split('/')[0]
    if (slug) return <Navigate to={`/admin/${slug}`} replace />
    if (menus.length > 0) return <Navigate to={`/admin/menus/${menus[0].id}`} replace />
    return <Navigate to="/admin/images" replace />
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      <nav
        className="w-[248px] shrink-0 px-3 py-4 sticky top-[60px] self-start overflow-y-auto"
        style={{
          background: 'linear-gradient(180deg, var(--mpl-navy-from), #253546)',
          height: 'calc(100vh - 60px)',   // 본문만 스크롤되도록 사이드바는 고정
        }}
      >
        <GroupLabel
          action={(
            <button
              type="button"
              onClick={() => navigate('/admin/menus/new')}
              className="text-[13px] font-bold px-1.5 py-0.5 rounded hover:brightness-110"
              style={{ color: '#8fd0ff' }}
            >
              + 추가
            </button>
          )}
        >
          기능 관리
        </GroupLabel>
        {menus.map((menu) => {
          const slug = (menu.url || '').replace(/^\/+/, '').split('/')[0]
          return (
            <NavLink
              key={menu.id}
              to={slug ? `/admin/${slug}` : `/admin/menus/${menu.id}`}
              className={NAV_BASE}
              style={navStyle}
            >
              {({ isActive }) => (
                <>
                  {menu.image?.url
                    ? <img src={menu.image.url} alt="" className="w-[22px] h-[22px] object-contain shrink-0" draggable={false} />
                    : <span className="w-[22px] text-center shrink-0 text-[15px]">📄</span>}
                  <span className="flex-1 min-w-0 truncate">{menu.title}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    title="메뉴 정보 편집"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/admin/menus/${menu.id}`) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); navigate(`/admin/menus/${menu.id}`) } }}
                    className="shrink-0 text-[13px] px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: isActive ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.6)' }}
                  >
                    ⚙
                  </span>
                </>
              )}
            </NavLink>
          )
        })}

        <GroupLabel>자원 관리</GroupLabel>
        {RESOURCE_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={NAV_BASE} style={navStyle}>
            <span className="w-[22px] text-center shrink-0 text-[15px]">{item.icon}</span>
            <span className="flex-1 min-w-0 truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex-1 min-w-0 px-7 py-6" style={{ background: 'var(--mpl-panel)' }}>
        <Outlet />
      </div>
    </div>
  )
}
