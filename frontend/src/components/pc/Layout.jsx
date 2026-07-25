import { createContext, useContext, useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useMatch } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import Footer from './Footer'
import LoginDialog from '../common/LoginDialog'
import { useThemeStore } from '../../stores/theme'
import { useAuth } from '../../hooks/useAuth'

const SITE_NAME = '메이플스토리 유틸리티'

const LayoutContext = createContext({ setFullscreen: () => {} })

export function useLayout() {
  return useContext(LayoutContext)
}

function CurrentMenuTitle() {
  const location = useLocation()
  const { data: menus = [] } = useQuery({
    queryKey: ['menus'],
    queryFn: () => api('/api/menus').catch(() => []),
  })

  const path = location.pathname
  const slug = path.replace(/^\/+/, '').split('/')[0]
  const isAdmin = slug === 'admin'
  const menu = (!slug || isAdmin)
    ? null
    : menus.find((m) => (m.url || '').replace(/^\/+/, '').split('/')[0] === slug)

  // 브라우저 탭 제목 동기화
  useEffect(() => {
    if (isAdmin) {
      document.title = `관리자 - ${SITE_NAME}`
    } else if (menu) {
      document.title = `${menu.title} - ${SITE_NAME}`
    } else {
      document.title = SITE_NAME
    }
  }, [isAdmin, menu])

  if (isAdmin) {
    return (
      <div className="flex items-center gap-3">
        <span style={{ color: 'var(--text-slash)' }}>/</span>
        <span className="text-sm font-medium" style={{ color: '#8fd8f5' }}>
          관리자
        </span>
      </div>
    )
  }

  if (!menu) return null

  return (
    <div className="flex items-center gap-3">
      <span style={{ color: 'var(--text-slash)' }}>/</span>
      <div className="flex items-center gap-2">
        {menu.image?.url && (
          <img src={menu.image.url} alt="" className="w-5 h-5 object-contain" />
        )}
        <span className="text-sm font-medium" style={{ color: '#ffffff' }}>
          {menu.title}
        </span>
      </div>
    </div>
  )
}

// 게임 필 버튼 공통 스타일 (헤더용)
const PILL_SKY = {
  background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), 0 2px 5px rgba(31,44,61,.3)',
  color: '#ffffff',
}
const PILL_SLATE = {
  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3), 0 2px 5px rgba(31,44,61,.25)',
  color: '#ffffff',
}

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? '다크 모드로 전환' : '라이트 모드로 전환'}
      title={isLight ? '다크 모드' : '라이트 모드'}
      className="inline-flex items-center justify-center rounded-full w-8 h-8 hover:brightness-110"
      style={PILL_SLATE}
    >
      {isLight ? (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM15.657 4.343a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 11-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zM6.464 13.536a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 01-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zM15.657 15.657a.75.75 0 01-1.06 0l-1.061-1.06a.75.75 0 011.06-1.061l1.061 1.06a.75.75 0 010 1.061zM6.464 6.464a.75.75 0 01-1.06 0L4.343 5.404a.75.75 0 011.06-1.06l1.061 1.06a.75.75 0 010 1.06zM10 6a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  )
}

function LoginButton({ onClick }) {
  const { user } = useAuth()
  const loggedIn = !!user

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={loggedIn ? 'API 키 관리' : 'API 키 로그인'}
      title={loggedIn ? 'API 키 관리' : 'API 키 로그인'}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 h-8 text-xs font-bold hover:brightness-105"
      style={loggedIn ? PILL_SKY : PILL_SLATE}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M15 7C15 5.34 13.66 4 12 4C10.34 4 9 5.34 9 7C9 7.74 9.27 8.42 9.71 8.95L4 14.66V20H9.34L15.05 14.29C15.58 14.73 16.26 15 17 15C18.66 15 20 13.66 20 12M17 8.5C16.72 8.5 16.5 8.28 16.5 8C16.5 7.72 16.72 7.5 17 7.5C17.28 7.5 17.5 7.72 17.5 8C17.5 8.28 17.28 8.5 17 8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {loggedIn ? '로그인됨' : '로그인'}
    </button>
  )
}

function AdminLinkButton() {
  const { user } = useAuth()
  const isAdminRoute = !!useMatch('/admin/*')

  if (!user?.is_admin || isAdminRoute) return null

  return (
    <Link
      to="/admin"
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 h-8 text-xs font-bold hover:brightness-105"
      style={PILL_SLATE}
      title="관리자 페이지"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      관리자
    </Link>
  )
}

function HomeLinkButton() {
  const isAdminRoute = !!useMatch('/admin/*')
  if (!isAdminRoute) return null

  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 h-8 text-xs font-bold hover:brightness-105"
      style={PILL_SLATE}
      title="홈으로"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V10.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      홈으로
    </Link>
  )
}

export default function Layout() {
  const location = useLocation()
  const [fullscreen, setFullscreen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const isAdmin = !!useMatch('/admin/*')
  const homeTo = isAdmin ? '/admin' : '/'
  const theme = useThemeStore((s) => s.theme)

  const isHome = location.pathname === '/'

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [theme])

  return (
    <LayoutContext.Provider value={{ fullscreen, setFullscreen }}>
      <div
        className={`min-w-[1280px] flex flex-col ${
          fullscreen ? 'h-dvh' : 'min-h-screen'
        }`}
        style={{ color: 'var(--text-strong)' }}
      >

        <header
          className="sticky top-0 z-20 shrink-0"
          style={{
            background: 'linear-gradient(180deg, var(--mpl-navy-from), var(--mpl-navy-to))',
            boxShadow: '0 3px 10px rgba(31,44,61,.35)',
          }}
        >
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-3">
              <Link to={homeTo} className="group flex items-center gap-2.5">
                <img src="/favicon.ico" alt="" className="w-8 h-8" />
                <span
                  className="text-lg font-bold tracking-tight"
                  style={{ color: 'var(--mpl-title-yellow)', textShadow: '1px 1px 0 rgba(31,44,61,.6)' }}
                >
                  메이플스토리 유틸리티
                </span>
              </Link>
              <CurrentMenuTitle />
            </div>
            <div className="flex items-center gap-2">
              <LoginButton onClick={() => setLoginOpen(true)} />
              <AdminLinkButton />
              <HomeLinkButton />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
        <main className={`flex-1 mx-auto w-full max-w-[1400px] ${
          fullscreen ? 'min-h-0 px-6 py-4' : 'px-6 pt-4 pb-10'
        }`}>
          {/* 페이지 전환 — fromis_9 에디토리얼 모션 (절제된 페이드업) */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="h-full min-h-0"
          >
            <Outlet />
          </motion.div>
        </main>
        {isHome && <Footer />}
      </div>
    </LayoutContext.Provider>
  )
}
