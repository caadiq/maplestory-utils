import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fmtYMD, isRecent } from './config'

function TextListSection({ cfg, items, isMaintenance, isLoading }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / cfg.pageSize))
  const clamped = Math.min(page, pages - 1)
  const slice = items.slice(clamped * cfg.pageSize, (clamped + 1) * cfg.pageSize)

  return (
    <section
      className="rounded-2xl border overflow-hidden flex flex-col"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        boxShadow: 'var(--panel-shadow)',
      }}
    >
      <div
        className="px-4 py-2.5"
        style={{ background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))' }}
      >
        <h3 className="text-sm font-bold" style={{ color: '#ffffff', textShadow: '0 1px 1px rgba(44,55,69,.3)' }}>
          {cfg.label}
        </h3>
      </div>
      <div className="relative overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
            불러오는 중...
          </div>
        ) : isMaintenance ? (
          <div className="p-8 text-center">
            <div className="text-sm font-medium" style={{ color: 'var(--maintenance-text)' }}>
              넥슨 Open API 점검중
            </div>
          </div>
        ) : slice.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
            등록된 항목이 없습니다
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul
              key={`page-${clamped}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {slice.map((it) => (
                <li
                  key={it.notice_id}
                  className="flex items-center gap-2 border-t first:border-t-0"
                  style={{ borderColor: 'var(--row-divider)' }}
                >
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 flex items-center gap-2 px-3.5 py-2 transition hover:bg-[var(--row-hover-bg)]"
                  >
                    {isRecent(it.date) && (
                      <span
                        className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                        style={{ background: 'var(--accent)', color: 'var(--badge-text)' }}
                      >
                        N
                      </span>
                    )}
                    <span
                      className="flex-1 min-w-0 text-[13px] truncate transition-colors hover:text-[var(--accent-hover-text)]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {it.title}
                    </span>
                    <span
                      className="shrink-0 text-[11px] tabular-nums"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      {fmtYMD(it.date)}
                    </span>
                  </a>
                </li>
              ))}
            </motion.ul>
          </AnimatePresence>
        )}
      </div>
      {pages > 1 && (
        <div
          className="flex items-center justify-between border-t px-4 py-3 text-sm"
          style={{ borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clamped === 0}
            className="inline-flex items-center gap-1.5 transition hover:text-[var(--text-strong)] disabled:opacity-30 disabled:hover:text-[var(--text-muted)]"
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
                className="w-2 h-2 rounded-full transition"
                style={{
                  background: i === clamped ? 'var(--accent)' : 'var(--dot-inactive)',
                }}
                onMouseEnter={(e) => {
                  if (i !== clamped) e.currentTarget.style.background = 'var(--dot-inactive-hover)'
                }}
                onMouseLeave={(e) => {
                  if (i !== clamped) e.currentTarget.style.background = 'var(--dot-inactive)'
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={clamped >= pages - 1}
            className="inline-flex items-center gap-1.5 transition hover:text-[var(--text-strong)] disabled:opacity-30 disabled:hover:text-[var(--text-muted)]"
          >
            다음
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      )}
    </section>
  )
}

export default memo(TextListSection)
