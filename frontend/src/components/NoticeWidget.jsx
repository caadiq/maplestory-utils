import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api/client'

const SECTIONS = {
  notice: { label: '메이플스토리 공지사항', dataKey: 'notice', pageSize: 5, kind: 'text' },
  update: { label: '메이플스토리 업데이트', dataKey: 'update_notice', pageSize: 5, kind: 'text' },
  event: {
    label: '진행 중인 이벤트',
    dataKey: 'event_notice',
    pageSize: 3,
    kind: 'card',
    dateStartKey: 'date_event_start',
    dateEndKey: 'date_event_end',
    filterOngoing: true,
  },
  cashshop: {
    label: '캐시샵 공지',
    dataKey: 'cashshop_notice',
    pageSize: 3,
    kind: 'card',
    dateStartKey: 'date_sale_start',
    dateEndKey: 'date_sale_end',
    filterOngoing: true,
  },
}

function fmtMD(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
function fmtYMD(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isRecent(iso, days = 3) {
  if (!iso) return false
  return (Date.now() - new Date(iso).getTime()) / 86400000 < days
}
function isOngoing(item, cfg) {
  if (!cfg.filterOngoing) return true
  const end = item[cfg.dateEndKey]
  if (end) return new Date(end) > new Date()
  if (item.ongoing_flag !== undefined) return item.ongoing_flag === 'true' || item.ongoing_flag === true
  return false
}
function dayBadge(item, cfg) {
  const now = Date.now()
  const start = item[cfg.dateStartKey] ? new Date(item[cfg.dateStartKey]).getTime() : null
  const end = item[cfg.dateEndKey] ? new Date(item[cfg.dateEndKey]).getTime() : null
  if (start && start > now) {
    const d = Math.ceil((start - now) / 86400000)
    return { label: `시작 ${d}일 전`, tone: 'emerald' }
  }
  if (end) {
    const d = Math.ceil((end - now) / 86400000)
    if (d <= 0) return null
    return { label: `D-${d}`, tone: 'amber' }
  }
  if (item.ongoing_flag === 'true' || item.ongoing_flag === true) {
    return { label: '상시판매', tone: 'gray' }
  }
  return null
}

/* ─── Text List Section ─────────────────────────────────────── */

function TextListSection({ cfg, items, isMaintenance, isLoading }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / cfg.pageSize))
  const clamped = Math.min(page, pages - 1)
  const slice = items.slice(clamped * cfg.pageSize, (clamped + 1) * cfg.pageSize)

  return (
    <section className="rounded-2xl border border-white/5 bg-gray-900/50 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-bold text-gray-200">{cfg.label}</h3>
      </div>
      <div className="relative overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">불러오는 중...</div>
        ) : isMaintenance ? (
          <div className="p-8 text-center">
            <div className="text-sm text-amber-300 font-medium">넥슨 Open API 점검중</div>
          </div>
        ) : slice.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">등록된 항목이 없습니다</div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul
              key={`page-${clamped}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="divide-y divide-white/[0.04]"
            >
              {slice.map((it) => (
                <li key={it.notice_id} className="flex items-center gap-2">
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 flex items-center gap-2 px-3.5 py-2 hover:bg-white/[0.03] transition"
                  >
                    {isRecent(it.date) && (
                      <span className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-bold text-gray-950">N</span>
                    )}
                    <span className="flex-1 min-w-0 text-[13px] text-gray-300 truncate hover:text-emerald-300 transition">
                      {it.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-gray-500 tabular-nums">{fmtYMD(it.date)}</span>
                  </a>
                </li>
              ))}
            </motion.ul>
          </AnimatePresence>
        )}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-white/5 px-4 py-3 text-sm text-gray-400">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clamped === 0}
            className="inline-flex items-center gap-1.5 hover:text-gray-100 disabled:opacity-30 disabled:hover:text-gray-400 transition"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 3L4.5 6L7.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            이전
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                aria-label={`${i + 1}페이지`}
                className={`w-2 h-2 rounded-full transition ${i === clamped ? 'bg-emerald-400' : 'bg-gray-600 hover:bg-gray-500'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={clamped >= pages - 1}
            className="inline-flex items-center gap-1.5 hover:text-gray-100 disabled:opacity-30 disabled:hover:text-gray-400 transition"
          >
            다음
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      )}
    </section>
  )
}

/* ─── Carousel Section (image cards) ────────────────────────── */

function CardItem({ item, cfg }) {
  const badge = dayBadge(item, cfg)
  const start = item[cfg.dateStartKey]
  const end = item[cfg.dateEndKey]
  const dateText = (item.ongoing_flag === 'true' || item.ongoing_flag === true)
    ? '상시판매'
    : start || end
      ? `${fmtMD(start || item.date)} ~ ${fmtMD(end || item.date)}`
      : fmtYMD(item.date)
  const toneCls = {
    emerald: 'bg-emerald-600 text-white',
    amber: 'bg-amber-600 text-white',
    gray: 'bg-gray-700 text-white',
  }[badge?.tone]

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block rounded-xl overflow-hidden bg-gray-900 border border-white/5 hover:border-white/15 transition"
    >
      <div className="aspect-[2/1] bg-gray-950 overflow-hidden">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-700">📢</div>
        )}
        {badge && (
          <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-medium ${toneCls}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="text-sm font-medium text-gray-200 line-clamp-1 group-hover:text-emerald-300 transition">
          {item.title}
        </div>
        <div className="text-xs text-gray-500 tabular-nums">{dateText}</div>
      </div>
    </a>
  )
}

function CarouselSection({ cfg, items, isMaintenance, isLoading }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / cfg.pageSize))
  const clamped = Math.min(page, pages - 1)
  const slice = items.slice(clamped * cfg.pageSize, (clamped + 1) * cfg.pageSize)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-200">{cfg.label}</h3>
        {pages > 1 && (
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={clamped === 0}
              className="w-7 h-7 rounded-md border border-white/10 bg-gray-900/60 hover:bg-gray-800 hover:border-white/20 disabled:opacity-30 disabled:hover:bg-gray-900/60 disabled:hover:border-white/10 transition flex items-center justify-center"
              aria-label="이전"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 3L4.5 6L7.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="tabular-nums text-gray-500 min-w-[48px] text-center">
              <span className="text-gray-200">{clamped + 1}</span>
              <span className="mx-1 text-gray-600">/</span>
              {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={clamped >= pages - 1}
              className="w-7 h-7 rounded-md border border-white/10 bg-gray-900/60 hover:bg-gray-800 hover:border-white/20 disabled:opacity-30 disabled:hover:bg-gray-900/60 disabled:hover:border-white/10 transition flex items-center justify-center"
              aria-label="다음"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        )}
      </div>
      <div className="relative overflow-hidden">
        {isLoading ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: cfg.pageSize }).map((_, i) => (
              <div key={i} className="aspect-[2/1] rounded-xl bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : isMaintenance ? (
          <div className="py-10 rounded-xl border border-white/5 bg-gray-900/50 text-center">
            <div className="text-sm text-amber-300 font-medium">넥슨 Open API 점검중</div>
          </div>
        ) : slice.length === 0 ? (
          <div className="py-10 rounded-xl border border-dashed border-white/10 text-center text-sm text-gray-500">
            {cfg.filterOngoing ? `진행중인 ${cfg.label}이 없습니다` : `등록된 ${cfg.label}이 없습니다`}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`cpage-${clamped}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            >
              {slice.map((it) => <CardItem key={it.notice_id} item={it} cfg={cfg} />)}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  )
}

/* ─── Root ──────────────────────────────────────────────────── */

export default function NoticeWidget() {
  const queries = useQueries({
    queries: Object.keys(SECTIONS).map((key) => ({
      queryKey: ['notices', key],
      queryFn: () => api(`/api/notices?type=${key}`),
      staleTime: 5 * 60 * 1000,
      retry: (n, err) => (err?.maintenance ? false : n < 1),
    })),
  })

  const byKey = Object.keys(SECTIONS).reduce((acc, key, i) => {
    const q = queries[i]
    const cfg = SECTIONS[key]
    const list = q.data?.[cfg.dataKey] || []
    const items = cfg.filterOngoing ? list.filter((n) => isOngoing(n, cfg)) : list
    acc[key] = { items, isLoading: q.isLoading, isMaintenance: !!q.error?.maintenance }
    return acc
  }, {})

  return (
    <section className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <TextListSection cfg={SECTIONS.notice} {...byKey.notice} />
        <TextListSection cfg={SECTIONS.update} {...byKey.update} />
      </div>
      <CarouselSection cfg={SECTIONS.event} {...byKey.event} />
      <CarouselSection cfg={SECTIONS.cashshop} {...byKey.cashshop} />
    </section>
  )
}
