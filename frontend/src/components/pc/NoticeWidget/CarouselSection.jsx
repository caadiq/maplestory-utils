import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fmtMD, fmtYMD, dayBadge } from './config'

function CardItem({ item, cfg }) {
  const badge = dayBadge(item, cfg)
  const start = item[cfg.dateStartKey]
  const end = item[cfg.dateEndKey]
  const startMD = fmtMD(start || item.date)
  const endMD = fmtMD(end || item.date)
  const dateText = (item.ongoing_flag === 'true' || item.ongoing_flag === true)
    ? '상시판매'
    : start || end
      ? (startMD === endMD ? startMD : `${startMD} ~ ${endMD}`)
      : fmtYMD(item.date)
  const badgeBg = {
    emerald: 'var(--badge-emerald-bg)',
    amber: 'var(--badge-amber-bg)',
    gray: 'var(--badge-gray-bg)',
  }[badge?.tone]

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block rounded-xl overflow-hidden border"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        boxShadow: 'var(--panel-shadow)',
      }}
    >
      <div
        className="aspect-[2/1] overflow-hidden"
        style={{ background: 'var(--thumb-bg)' }}
      >
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-4xl"
            style={{ color: 'var(--thumb-placeholder)' }}
          >
            📢
          </div>
        )}
        {badge && (
          <span
            className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ background: badgeBg, color: 'var(--badge-text)' }}
          >
            {badge.label}
          </span>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div
          className="text-sm font-medium line-clamp-1 transition-colors group-hover:text-[var(--accent-hover-text)]"
          style={{ color: 'var(--text-emphasis)' }}
        >
          {item.title}
        </div>
        <div className="text-xs tabular-nums" style={{ color: 'var(--text-dim)' }}>
          {dateText}
        </div>
      </div>
    </a>
  )
}

function CarouselSection({ cfg, items, isMaintenance, isLoading }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / cfg.pageSize))
  const clamped = Math.min(page, pages - 1)
  const slice = items.slice(clamped * cfg.pageSize, (clamped + 1) * cfg.pageSize)

  const navBtn = "w-7 h-7 rounded-md border flex items-center justify-center border-[var(--btn-border)] bg-[var(--btn-bg)] hover:bg-[var(--btn-bg-hover)] hover:border-[var(--btn-border-hover)] disabled:opacity-30 disabled:hover:bg-[var(--btn-bg)] disabled:hover:border-[var(--btn-border)]"

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-medium" style={{ color: 'var(--text-emphasis)' }}>
          {cfg.label}
        </h3>
        {pages > 1 && (
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={clamped === 0}
              className={navBtn}
              aria-label="이전"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 3L4.5 6L7.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="tabular-nums min-w-[48px] text-center">
              <span style={{ color: 'var(--text-emphasis)' }}>{clamped + 1}</span>
              <span className="mx-1" style={{ color: 'var(--text-dim)' }}>/</span>
              {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={clamped >= pages - 1}
              className={navBtn}
              aria-label="다음"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        )}
      </div>
      <div className="relative overflow-x-clip pb-2">
        {isLoading ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: cfg.pageSize }).map((_, i) => (
              <div key={i} className="aspect-[2/1] rounded-xl animate-pulse" style={{ background: 'var(--skeleton-bg)' }} />
            ))}
          </div>
        ) : isMaintenance ? (
          <div
            className="py-10 rounded-xl border text-center"
            style={{
              background: 'var(--panel-bg)',
              borderColor: 'var(--panel-border)',
              boxShadow: 'var(--panel-shadow)',
            }}
          >
            <div className="text-sm font-medium" style={{ color: 'var(--maintenance-text)' }}>
              넥슨 Open API 점검중
            </div>
          </div>
        ) : slice.length === 0 ? (
          <div
            className="py-10 rounded-xl border border-dashed text-center text-sm"
            style={{ borderColor: 'var(--dashed-border)', color: 'var(--text-dim)' }}
          >
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

export default memo(CarouselSection)
