import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import MobileSundayBanner from '../../components/mobile/SundayBanner'
import MobileNoticeWidget from '../../components/mobile/NoticeWidget'

export default function MobileHome() {
  const { data: menus = [], isLoading } = useQuery({
    queryKey: ['menus'],
    queryFn: () => api('/api/menus').catch(() => []),
  })

  return (
    <div className="space-y-6">
      {/* 썬데이 메이플 배너 (금~일만) */}
      <MobileSundayBanner />

      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Utilities</span>
        <div className="h-px flex-1" style={{ backgroundImage: 'linear-gradient(to right, var(--divider-line), transparent)' }} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--skeleton-bg)' }} />
          ))}
        </div>
      ) : menus.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={{ background: 'var(--empty-bg)', borderColor: 'var(--empty-border)' }}>
          <div className="text-4xl mb-3 opacity-50">🍁</div>
          <p style={{ color: 'var(--text-muted)' }}>아직 등록된 기능이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {menus.map((menu) => (
            <Link
              key={menu.id}
              to={menu.url}
              className="flex items-center gap-3 rounded-2xl border p-4 active:scale-[0.99] transition-transform border-[var(--card-border)]"
              style={{
                backgroundImage: 'linear-gradient(to bottom right, var(--card-bg-from), var(--card-bg-to))',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div
                className="w-11 h-11 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 border-[var(--icon-box-border)]"
                style={{ backgroundImage: 'linear-gradient(to bottom right, var(--icon-box-from), var(--icon-box-to))' }}
              >
                <img src={menu.image?.url || '/default.png'} alt={menu.title} className="w-8 h-8 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-medium truncate">{menu.title}</h2>
                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{menu.description}</p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: 'var(--text-dim)' }}>
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>
      )}

      {/* 메이플 공지 */}
      <div className="flex items-center gap-3 pt-2">
        <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Notices</span>
        <div className="h-px flex-1" style={{ backgroundImage: 'linear-gradient(to right, var(--divider-line), transparent)' }} />
      </div>
      <MobileNoticeWidget />
    </div>
  )
}
