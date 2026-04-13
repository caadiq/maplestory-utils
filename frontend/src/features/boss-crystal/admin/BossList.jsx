import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { DIFFICULTIES, formatMeso, getDifficultyImageUrl } from './constants'

export default function BossList() {
  const { data: bosses = [], isLoading } = useQuery({
    queryKey: ['admin', 'boss-crystal', 'bosses'],
    queryFn: () => api('/api/admin/boss-crystal/bosses').catch(() => []),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">보스 결정 관리</h2>
          <p className="text-sm text-gray-500 mt-0.5">보스 정보 및 난이도별 결정 가격을 관리합니다</p>
        </div>
        <Link
          to="bosses/new"
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium transition shadow-lg shadow-emerald-500/20"
        >
          <span className="text-base leading-none">+</span>
          보스 추가
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : bosses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center">
          <div className="text-5xl mb-3 opacity-30">⚔️</div>
          <p className="text-gray-400 mb-4">등록된 보스가 없습니다</p>
          <Link to="bosses/new" className="text-sm text-emerald-400 hover:text-emerald-300 transition">
            첫 보스 추가하기 →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bosses.map((boss) => (
            <Link
              key={boss.id}
              to={`bosses/${boss.id}`}
              className="group rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900/80 to-gray-900/40 p-4 hover:border-emerald-500/30 transition"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/5 flex items-center justify-center overflow-hidden">
                  <img
                    src={boss.image_url || '/default.png'}
                    alt={boss.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold group-hover:text-emerald-300 transition truncate">{boss.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {DIFFICULTIES.filter((d) => boss.difficulties?.some((bd) => bd.difficulty === d.key)).map((d) => {
                      const bd = boss.difficulties.find((x) => x.difficulty === d.key)
                      return (
                        <span key={d.key} className={`text-[10px] px-1.5 py-0.5 rounded border ${d.color}`} title={`${formatMeso(bd.crystal_price)} / ${bd.max_party_size}인`}>
                          {d.label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
