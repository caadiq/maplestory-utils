import { createContext, useContext, useState, useEffect } from 'react'
import { Outlet, Link, useMatch } from 'react-router-dom'
import LoginDialog from '../common/LoginDialog'
import { useThemeStore } from '../../stores/theme'
import { useAuth } from '../../hooks/useAuth'

const SITE_NAME = '메이플스토리 유틸리티'

// PC와 동일하게 fullscreen 컨텍스트 제공 (모바일 feature가 useLayout을 써도 안전)
const LayoutContext = createContext({ fullscreen: false, setFullscreen: () => {} })
export function useLayout() {
  return useContext(LayoutContext)
}

export default function MobileLayout() {
  const [fullscreen, setFullscreen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const isHome = !!useMatch('/')
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const isLight = theme === 'light'
  const { user } = useAuth()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') root.setAttribute('data-theme', 'light')
    else root.removeAttribute('data-theme')
  }, [theme])

  return (
    <LayoutContext.Provider value={{ fullscreen, setFullscreen }}>
      <div className="min-h-dvh flex flex-col" style={{ color: 'var(--text-strong)' }}>
        <header
          className="sticky top-0 z-20 border-b shrink-0"
          style={{ borderColor: 'var(--header-border)', background: 'var(--bg-from)' }}
        >
          <div className="flex items-center justify-between px-4 h-14">
            {/* 홈이 아니면 뒤로가기 + 타이틀, 홈이면 로고 */}
            {isHome ? (
              <Link to="/" className="flex items-center gap-2">
                <img src="/favicon.ico" alt="" className="w-7 h-7" />
                <span className="text-base font-bold tracking-tight">{SITE_NAME}</span>
              </Link>
            ) : (
              <Link to="/" className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                홈
              </Link>
            )}

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isLight ? '다크 모드' : '라이트 모드'}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ color: 'var(--text-muted)' }}
              >
                {isLight ? (
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM15.657 4.343a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 11-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zM6.464 13.536a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 01-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zM15.657 15.657a.75.75 0 01-1.06 0l-1.061-1.06a.75.75 0 011.06-1.061l1.061 1.06a.75.75 0 010 1.061zM6.464 6.464a.75.75 0 01-1.06 0L4.343 5.404a.75.75 0 011.06-1.06l1.061 1.06a.75.75 0 010 1.06zM10 6a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                aria-label={user ? '로그인됨' : '로그인'}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ color: user ? 'var(--accent-bright)' : 'var(--text-muted)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M15 7C15 5.34 13.66 4 12 4C10.34 4 9 5.34 9 7C9 7.74 9.27 8.42 9.71 8.95L4 14.66V20H9.34L15.05 14.29C15.58 14.73 16.26 15 17 15C18.66 15 20 13.66 20 12M17 8.5C16.72 8.5 16.5 8.28 16.5 8C16.5 7.72 16.72 7.5 17 7.5C17.28 7.5 17.5 7.72 17.5 8C17.5 8.28 17.28 8.5 17 8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4">
          <Outlet />
        </main>

        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    </LayoutContext.Provider>
  )
}
