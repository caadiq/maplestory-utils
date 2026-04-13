import { createContext, useContext, useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import Footer from './Footer'

const LayoutContext = createContext({ setFullscreen: () => {} })

export function useLayout() {
  return useContext(LayoutContext)
}

export default function Layout() {
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <LayoutContext.Provider value={{ fullscreen, setFullscreen }}>
      <div className={`min-w-[1280px] bg-gradient-to-br from-gray-950 via-gray-950 to-slate-900 text-white flex flex-col ${
        fullscreen ? 'h-dvh' : 'min-h-screen'
      }`}>
        <header className="sticky top-0 z-20 border-b border-white/5 bg-gray-950/80 backdrop-blur-md shrink-0">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
            <Link to="/" className="group flex items-center gap-2.5">
              <img src="/favicon.ico" alt="" className="w-8 h-8" />
              <span className="text-lg font-bold tracking-tight">
                메이플스토리 유틸리티
              </span>
            </Link>
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
