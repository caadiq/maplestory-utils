import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

export default function Home() {
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/menus')
      .then(setMenus)
      .catch(() => setMenus([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center pt-12 pb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          MapleStory Utility
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-br from-white via-white to-gray-500 bg-clip-text text-transparent">
          메이플스토리 유틸리티
        </h1>
        <p className="text-gray-400 mt-4 text-base">
          메이플스토리 플레이를 위한 유용한 도구 모음
        </p>
      </section>

      {/* 메뉴 그리드 */}
      <section>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : menus.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-gray-900/40 p-16 text-center">
            <div className="text-5xl mb-4 opacity-50">🍁</div>
            <p className="text-gray-400">아직 등록된 기능이 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menus.map((menu) => (
              <Link
                key={menu.id}
                to={menu.url}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900/80 to-gray-900/40 p-6 hover:border-emerald-500/30 transition-all duration-300"
              >
                <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-emerald-500/0 group-hover:bg-emerald-500/10 blur-3xl transition-all duration-500" />
                <div className="relative space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/5 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:border-emerald-500/30 transition-all duration-300">
                    {menu.image_url ? (
                      <img src={menu.image_url} alt={menu.title} className="w-7 h-7 object-contain" />
                    ) : (
                      menu.icon || '📋'
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold group-hover:text-emerald-300 transition">{menu.title}</h2>
                    <p className="text-sm text-gray-400 mt-1 leading-relaxed">{menu.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
