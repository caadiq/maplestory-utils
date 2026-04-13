import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import NoticeWidget from '../components/NoticeWidget'

export default function Home() {
  const { data: menus = [], isLoading: loading } = useQuery({
    queryKey: ['menus'],
    queryFn: () => api('/api/menus').catch(() => []),
  })

  return (
    <div className="space-y-10">
      {/* 메이플 공지 */}
      <NoticeWidget />

      {/* 구분선 */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <span className="text-xs text-gray-500 uppercase tracking-widest">Utilities</span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

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
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/5 flex items-center justify-center overflow-hidden group-hover:scale-110 group-hover:border-emerald-500/30 transition-all duration-300">
                    <img src={menu.image?.url || '/default.png'} alt={menu.title} className="w-9 h-9 object-contain" />
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
