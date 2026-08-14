import { useLayoutEffect, useState, useEffect } from 'react'
import { Outlet, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Reorder, useDragControls } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useAuth } from '../../../hooks/useAuth'
import { useLayout } from '../../../components/pc/Layout'

const RESOURCE_ITEMS = [
  { to: '/admin/images', label: '이미지', icon: '🖼' },
  { to: '/admin/challenger-seasons', label: '챌린저스 시즌', icon: '🏆' },
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

/**
 * 드래그로 순서를 바꿀 수 있는 기능 메뉴 항목.
 * 핸들(⠿)로만 드래그를 시작해 NavLink 클릭·⚙ 편집과 충돌하지 않는다.
 */
function MenuNavItem({ menu, onNavigateEdit, onDragDone }) {
  const dragControls = useDragControls()
  const slug = (menu.url || '').replace(/^\/+/, '').split('/')[0]
  return (
    <Reorder.Item
      as="div"
      value={menu}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragDone}
      className="relative"
    >
      <NavLink
        to={slug ? `/admin/${slug}` : `/admin/menus/${menu.id}`}
        className={NAV_BASE}
        style={navStyle}
      >
        {({ isActive }) => (
          <>
            <span
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); dragControls.start(e) }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
              title="드래그하여 순서 변경"
              className="shrink-0 -ml-1 w-4 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ touchAction: 'none', color: isActive ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.45)' }}
            >
              <svg width="10" height="14" viewBox="0 0 12 16" fill="currentColor">
                <circle cx="3" cy="3" r="1.2" />
                <circle cx="9" cy="3" r="1.2" />
                <circle cx="3" cy="8" r="1.2" />
                <circle cx="9" cy="8" r="1.2" />
                <circle cx="3" cy="13" r="1.2" />
                <circle cx="9" cy="13" r="1.2" />
              </svg>
            </span>
            {menu.image?.url
              ? <img src={menu.image.url} alt="" className="w-[22px] h-[22px] object-contain shrink-0" draggable={false} />
              : <span className="w-[22px] text-center shrink-0 text-[15px]">📄</span>}
            <span className="flex-1 min-w-0 truncate">{menu.title}</span>
            <span
              role="button"
              tabIndex={0}
              title="메뉴 정보 편집"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNavigateEdit() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onNavigateEdit() } }}
              className="shrink-0 text-[13px] px-1 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: isActive ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.6)' }}
            >
              ⚙
            </span>
          </>
        )}
      </NavLink>
    </Reorder.Item>
  )
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

  const queryClient = useQueryClient()
  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: ['admin', 'menus'],
    queryFn: () => api('/api/admin/menus').catch(() => []),
    enabled: !!user?.is_admin,
  })

  // 드래그 중 순서는 로컬로 다루고, 놓는 순간 저장한다
  const [orderedMenus, setOrderedMenus] = useState(menus)
  useEffect(() => { setOrderedMenus(menus) }, [menus])

  const reorderMutation = useMutation({
    mutationFn: (ids) => api('/api/admin/menus/reorder', { method: 'POST', body: { ids } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'menus'] })
      queryClient.invalidateQueries({ queryKey: ['menus'] }) // 메인 페이지 목록도 새 순서로
    },
  })
  const handleDragDone = () => {
    setOrderedMenus((current) => {
      reorderMutation.mutate(current.map((m) => m.id))
      return current
    })
  }

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
    // 메뉴를 받기 전에 폴백으로 튀지 않도록 대기
    if (menusLoading) {
      return (
        <div className="flex items-center justify-center pt-20">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      )
    }
    const slug = (menus[0]?.url || '').replace(/^\/+/, '').split('/')[0]
    if (slug) return <Navigate to={`/admin/${slug}`} replace />
    if (menus.length > 0) return <Navigate to={`/admin/menus/${menus[0].id}`} replace />
    return <Navigate to="/admin/images" replace />
  }

  return (
    <div className="flex" style={{ minHeight: 'calc(100dvh - var(--header-h))' }}>
      <nav
        className="w-[248px] shrink-0 px-3 py-4 sticky self-start overflow-y-auto"
        style={{
          background: 'linear-gradient(180deg, var(--mpl-navy-from), #253546)',
          top: 'var(--header-h)',
          height: 'calc(100dvh - var(--header-h))',   // 본문만 스크롤되도록 사이드바는 고정
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
        <Reorder.Group as="div" axis="y" values={orderedMenus} onReorder={setOrderedMenus}>
          {orderedMenus.map((menu) => (
            <MenuNavItem
              key={menu.id}
              menu={menu}
              onNavigateEdit={() => navigate(`/admin/menus/${menu.id}`)}
              onDragDone={handleDragDone}
            />
          ))}
        </Reorder.Group>

        <GroupLabel>자원 관리</GroupLabel>
        {RESOURCE_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={NAV_BASE} style={navStyle}>
            <span className="w-[22px] text-center shrink-0 text-[15px]">{item.icon}</span>
            <span className="flex-1 min-w-0 truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex-1 min-w-0 px-10 py-9" style={{ background: 'var(--mpl-panel)' }}>
        {/* 화면이 넓어져도 본문은 늘어나지 않고 가운데에 머문다 */}
        <div className="mx-auto w-full max-w-[1180px]">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
