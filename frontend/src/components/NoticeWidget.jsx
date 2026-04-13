import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

const TABS = [
  { key: 'event', label: '이벤트', dataKey: 'event_notice', filterOngoing: true, dateStartKey: 'date_event_start', dateEndKey: 'date_event_end' },
  { key: 'cashshop', label: '캐시샵', dataKey: 'cashshop_notice', filterOngoing: true, dateStartKey: 'date_sale_start', dateEndKey: 'date_sale_end' },
  { key: 'update', label: '업데이트', dataKey: 'update_notice' },
  { key: 'notice', label: '공지', dataKey: 'notice' },
]

const DEFAULT_LIMIT = 6

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}.${day}`
}

function isOngoing(notice, tab) {
  if (!tab.filterOngoing) return false
  const endDate = notice[tab.dateEndKey]
  // 종료일이 있으면 종료일 비교
  if (endDate) return new Date(endDate) > new Date()
  // 종료일이 없으면 ongoing_flag로 판단 (캐시샵 상시판매 등)
  if (notice.ongoing_flag !== undefined) {
    return notice.ongoing_flag === 'true' || notice.ongoing_flag === true
  }
  return false
}

function splitTitle(title) {
  // "3월 23일 캐시아이템 업데이트 - 메이플스토리 & 진" → ["3월 23일 캐시아이템 업데이트", "메이플스토리 & 진"]
  const idx = title.indexOf(' - ')
  if (idx === -1) return { prefix: null, main: title }
  return {
    prefix: title.slice(0, idx),
    main: title.slice(idx + 3),
  }
}

function NoticeCard({ notice, tab }) {
  const startDate = tab.dateStartKey ? notice[tab.dateStartKey] : null
  const endDate = tab.dateEndKey ? notice[tab.dateEndKey] : null
  const hasDateRange = startDate || endDate

  const dateText = hasDateRange
    ? `${formatDate(startDate || notice.date)}${endDate ? ` ~ ${formatDate(endDate)}` : ''}`
    : (tab.key === 'cashshop' && isOngoing(notice, tab) ? '상시판매' : formatDate(notice.date))

  const { prefix, main } = splitTitle(notice.title)

  return (
    <a
      href={notice.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-lg border border-white/5 bg-gray-950/40 p-2 hover:border-white/15 hover:bg-gray-950/70 transition"
    >
      {notice.thumbnail_url && (
        <div className="shrink-0 w-20 h-20 rounded-md bg-gray-900 overflow-hidden">
          <img
            src={notice.thumbnail_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-1 gap-1.5">
        <div className="min-w-0 space-y-1">
          {prefix && (
            <p className="text-xs text-gray-500 truncate leading-tight">{prefix}</p>
          )}
          <p className="text-sm font-medium text-gray-200 group-hover:text-emerald-300 transition line-clamp-2 leading-snug">
            {main}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>📅</span>
          <span>{dateText}</span>
        </div>
      </div>
    </a>
  )
}

export default function NoticeWidget() {
  const [activeTab, setActiveTab] = useState('event')
  const [expanded, setExpanded] = useState(false)
  const tab = TABS.find((t) => t.key === activeTab)

  const { data, isLoading } = useQuery({
    queryKey: ['notices', activeTab],
    queryFn: () => api(`/api/notices?type=${activeTab}`),
    staleTime: 5 * 60 * 1000,
  })

  const list = data?.[tab.dataKey] || []
  const allItems = tab.filterOngoing
    ? list.filter((n) => isOngoing(n, tab))
    : list
  const initialItems = allItems.slice(0, DEFAULT_LIMIT)
  const extraItems = allItems.slice(DEFAULT_LIMIT)
  const hasMore = extraItems.length > 0

  const handleTabChange = (key) => {
    setActiveTab(key)
    setExpanded(false)
  }

  return (
    <section className="rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900/80 to-gray-900/40 overflow-hidden">
      {/* 헤더 + 탭 */}
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📢</span>
          <h2 className="font-semibold">메이플 공지</h2>
          {tab.filterOngoing && allItems.length > 0 && (
            <span className="text-xs text-gray-500">진행중 {allItems.length}건</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`text-xs px-2.5 py-1 rounded-md transition ${
                activeTab === t.key
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="p-3">
        {isLoading ? (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : initialItems.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            {tab.filterOngoing ? `진행중인 ${tab.label}이 없습니다` : `등록된 ${tab.label}이 없습니다`}
          </div>
        ) : (
          <>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {initialItems.map((notice) => (
                <NoticeCard key={notice.notice_id} notice={notice} tab={tab} />
              ))}
            </div>

            {/* 펼쳐지는 영역 - grid-template-rows 트릭으로 부드럽게 애니메이션 */}
            {hasMore && (
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pt-2">
                    {extraItems.map((notice) => (
                      <NoticeCard key={notice.notice_id} notice={notice} tab={tab} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* 더보기 / 접기 */}
        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 w-full rounded-lg border border-white/5 bg-gray-950/30 hover:bg-gray-950/60 hover:border-white/10 py-2 text-xs text-gray-400 hover:text-gray-200 transition flex items-center justify-center gap-1.5"
          >
            <span>{expanded ? '접기' : `더보기 (${extraItems.length}건)`}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            >
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </section>
  )
}
