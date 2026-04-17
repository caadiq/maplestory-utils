import { createContext, useContext, useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useMatch } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import Footer from './Footer'
import { useThemeStore } from '../stores/theme'

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

  if (!menu) return null

  return (
    <div
      className="flex items-center gap-3"
      style={{ color: 'var(--text-muted)' }}
    >
      <span style={{ color: 'var(--text-slash)' }}>/</span>
      <div className="flex items-center gap-2">
        {menu.image?.url && (
          <img src={menu.image.url} alt="" className="w-5 h-5 object-contain" />
        )}
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--text-emphasis)' }}
        >
          {menu.title}
        </span>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const isLight = theme === 'light'

  const handleToggle = () => toggleTheme()

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isLight ? '다크 모드로 전환' : '라이트 모드로 전환'}
      title={isLight ? '다크 모드' : '라이트 모드'}
      className="relative inline-flex h-8 w-14 items-center rounded-full border transition-colors duration-500 hover:border-emerald-500/40"
      style={{
        background: 'var(--toggle-bg)',
        borderColor: 'var(--toggle-border)',
      }}
    >
      <span
        className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-[transform,background] duration-300 ease-out"
        style={{
          transform: isLight ? 'translateX(24px)' : 'translateX(0px)',
          backgroundImage: 'linear-gradient(to bottom right, var(--toggle-thumb-from), var(--toggle-thumb-to))',
          color: 'var(--toggle-thumb-icon)',
        }}
      >
        {isLight ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM15.657 4.343a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 11-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zM6.464 13.536a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 01-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zM15.657 15.657a.75.75 0 01-1.06 0l-1.061-1.06a.75.75 0 011.06-1.061l1.061 1.06a.75.75 0 010 1.061zM6.464 6.464a.75.75 0 01-1.06 0L4.343 5.404a.75.75 0 011.06-1.06l1.061 1.06a.75.75 0 010 1.06zM10 6a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
          </svg>
        )}
      </span>
    </button>
  )
}

export default function Layout() {
  const [fullscreen, setFullscreen] = useState(false)
  const isAdmin = !!useMatch('/admin/*')
  const homeTo = isAdmin ? '/admin' : '/'
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') root.setAttribute('data-theme', 'light')
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
          className="sticky top-0 z-20 border-b backdrop-blur-md shrink-0"
          style={{
            borderColor: 'var(--header-border)',
          }}
        >
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Link to={homeTo} className="group flex items-center gap-2.5">
                <img src="/favicon.ico" alt="" className="w-8 h-8" />
                <span className="text-lg font-bold tracking-tight">
                  메이플스토리 유틸리티
                </span>
              </Link>
              <CurrentMenuTitle />
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className={`flex-1 mx-auto w-full max-w-[1400px] ${
          fullscreen ? 'min-h-0 px-6 py-4' : 'px-6 pt-4 pb-10'
        }`}>
          <Outlet />
        </main>
        {!fullscreen && <Footer />}
      </div>
    </LayoutContext.Provider>
  )
}
