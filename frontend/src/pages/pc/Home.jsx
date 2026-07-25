import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PageLoader from '../../components/common/PageLoader'
import { api } from '../../api/client'
import NoticeWidget from '../../components/pc/NoticeWidget'
import SundayMapleBanner from '../../components/pc/SundayMapleBanner'
import { prefetchUserComponent } from '../../features/registry'

export default function Home() {
  const { data: menus = [], isLoading: loading } = useQuery({
    queryKey: ['menus'],
    queryFn: () => api('/api/menus').catch(() => []),
  })

  if (loading) return <PageLoader />

  return (
    <div className="mpl-page-enter space-y-10 max-w-5xl mx-auto pt-6">
      {/* 썬데이 메이플 배너 (금~일만 표시) */}
      <div className="">
        <SundayMapleBanner />
      </div>

      {/* 구분선 */}
      <div className="flex items-center gap-4">
        <div
          className="h-px flex-1"
          style={{ backgroundImage: 'linear-gradient(to right, transparent, var(--divider-line), transparent)' }}
        />
        <span
          className="text-xs uppercase tracking-widest"
          style={{ color: 'var(--text-dim)' }}
        >
          Utilities
        </span>
        <div
          className="h-px flex-1"
          style={{ backgroundImage: 'linear-gradient(to right, transparent, var(--divider-line), transparent)' }}
        />
      </div>

      {/* 메뉴 그리드 */}
      <section className="">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-2xl animate-pulse"
                style={{ background: 'var(--skeleton-bg)' }}
              />
            ))}
          </div>
        ) : menus.length === 0 ? (
          <div
            className="rounded-2xl border p-16 text-center"
            style={{ background: 'var(--empty-bg)', borderColor: 'var(--empty-border)' }}
          >
            <div className="text-5xl mb-4 opacity-50">🍁</div>
            <p
              className="transition-colors duration-500"
              style={{ color: 'var(--text-muted)' }}
            >
              아직 등록된 기능이 없습니다
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menus.map((menu) => (
              <Link
                key={menu.id}
                to={menu.url}
                onMouseEnter={() => prefetchUserComponent(menu.url)}
                onFocus={() => prefetchUserComponent(menu.url)}
                className="relative rounded-2xl border p-6 transition-transform duration-300 hover:scale-[1.02] border-[var(--card-border)]"
                style={{
                  backgroundImage: 'linear-gradient(to bottom right, var(--card-bg-from), var(--card-bg-to))',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <div className="space-y-3">
                  <div
                    className="w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden border-[var(--icon-box-border)]"
                    style={{ backgroundImage: 'linear-gradient(to bottom right, var(--icon-box-from), var(--icon-box-to))' }}
                  >
                    <img src={menu.image?.url || '/default.png'} alt={menu.title} className="w-9 h-9 object-contain" />
                  </div>
                  <div>
                    <h2 className="font-medium">{menu.title}</h2>
                    <p
                      className="text-sm mt-1 leading-relaxed"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {menu.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 구분선 */}
      <div className="flex items-center gap-4">
        <div
          className="h-px flex-1"
          style={{ backgroundImage: 'linear-gradient(to right, transparent, var(--divider-line), transparent)' }}
        />
        <span
          className="text-xs uppercase tracking-widest"
          style={{ color: 'var(--text-dim)' }}
        >
          Notices
        </span>
        <div
          className="h-px flex-1"
          style={{ backgroundImage: 'linear-gradient(to right, transparent, var(--divider-line), transparent)' }}
        />
      </div>

      {/* 메이플 공지 */}
      <div className="">
        <NoticeWidget />
      </div>
    </div>
  )
}
