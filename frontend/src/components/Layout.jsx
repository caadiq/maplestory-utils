import { Outlet, Link } from 'react-router-dom'
import Footer from './Footer'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-950 to-slate-900 text-white flex flex-col">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-gray-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="group flex items-center gap-2.5">
            <img src="/favicon.ico" alt="" className="w-8 h-8" />
            <span className="text-lg font-bold tracking-tight">
              메이플스토리 유틸리티
            </span>
          </Link>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
