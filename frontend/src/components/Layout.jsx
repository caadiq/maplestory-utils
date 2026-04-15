import { createContext, useContext, useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useMatch } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import Footer from './Footer'

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
    <div className="flex items-center gap-3 text-gray-400">
      <span className="text-white/20">/</span>
      <div className="flex items-center gap-2">
        {menu.image?.url && (
          <img src={menu.image.url} alt="" className="w-5 h-5 object-contain" />
        )}
        <span className="text-sm font-medium text-gray-200">{menu.title}</span>
      </div>
    </div>
  )
}

export default function Layout() {
  const [fullscreen, setFullscreen] = useState(false)
  const isAdmin = !!useMatch('/admin/*')
  const homeTo = isAdmin ? '/admin' : '/'

  return (
    <LayoutContext.Provider value={{ fullscreen, setFullscreen }}>
      <div className={`min-w-[1280px] text-white flex flex-col ${
        fullscreen ? 'h-dvh' : 'min-h-screen'
      }`}>
        <header className="sticky top-0 z-20 border-b border-white/5 bg-gray-950/80 backdrop-blur-md shrink-0">
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
