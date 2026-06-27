import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { api } from '../../api/client'
import { SECTIONS, isOngoing, fmtYMD, fmtMD, isRecent, dayBadge } from '../pc/NoticeWidget/config'

const panelStyle = { background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }

function StateMsg({ isLoading, isMaintenance, empty }) {
  return (
    <div className="p-6 text-center text-sm" style={{ color: isMaintenance ? 'var(--maintenance-text)' : 'var(--text-dim)' }}>
      {isLoading ? '불러오는 중...' : isMaintenance ? '넥슨 Open API 점검중' : empty}
    </div>
  )
}

function TextList({ cfg, items, isLoading, isMaintenance }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / cfg.pageSize))
  const clamped = Math.min(page, pages - 1)
  const slice = items.slice(clamped * cfg.pageSize, (clamped + 1) * cfg.pageSize)

  return (
    <section className="rounded-2xl border overflow-hidden" style={panelStyle}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-emphasis)' }}>{cfg.label}</h3>
        {pages > 1 && (
          <div className="flex items-center gap-3 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
            <button type="button" onClick={() => setPage(Math.max(0, clamped - 1))} disabled={clamped === 0} className="w-6 h-6 flex items-center justify-center disabled:opacity-30" aria-label="이전">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 3L4.5 6L7.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span><span style={{ color: 'var(--text-emphasis)' }}>{clamped + 1}</span>/{pages}</span>
            <button type="button" onClick={() => setPage(Math.min(pages - 1, clamped + 1))} disabled={clamped >= pages - 1} className="w-6 h-6 flex items-center justify-center disabled:opacity-30" aria-label="다음">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )}
      </div>
      {isLoading || isMaintenance || slice.length === 0 ? (
        <StateMsg isLoading={isLoading} isMaintenance={isMaintenance} empty="등록된 항목이 없습니다" />
      ) : (
        <ul>
          {slice.map((it) => (
            <li key={it.notice_id} className="border-t first:border-t-0" style={{ borderColor: 'var(--row-divider)' }}>
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3.5 py-2.5 active:bg-[var(--row-hover-bg)]">
                {isRecent(it.date) && (
                  <span className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold" style={{ background: 'var(--accent)', color: 'var(--badge-text)' }}>N</span>
                )}
                <span className="flex-1 min-w-0 text-[13px] truncate" style={{ color: 'var(--text-muted)' }}>{it.title}</span>
                <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--text-dim)' }}>{fmtYMD(it.date)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MobileCard({ item, cfg }) {
  const badge = dayBadge(item, cfg)
  const start = item[cfg.dateStartKey]
  const end = item[cfg.dateEndKey]
  const startMD = fmtMD(start || item.date)
  const endMD = fmtMD(end || item.date)
  const dateText = (item.ongoing_flag === 'true' || item.ongoing_flag === true)
    ? '상시판매'
    : start || end ? (startMD === endMD ? startMD : `${startMD} ~ ${endMD}`) : fmtYMD(item.date)
  const badgeBg = { emerald: 'var(--badge-emerald-bg)', amber: 'var(--badge-amber-bg)', gray: 'var(--badge-gray-bg)' }[badge?.tone]

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block w-60 rounded-xl overflow-hidden border" style={panelStyle}>
      <div className="relative aspect-[2/1] overflow-hidden" style={{ background: 'var(--thumb-bg)' }}>
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl" style={{ color: 'var(--thumb-placeholder)' }}>📢</div>
        )}
        {badge && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: badgeBg, color: 'var(--badge-text)' }}>{badge.label}</span>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="text-sm font-medium line-clamp-1" style={{ color: 'var(--text-emphasis)' }}>{item.title}</div>
        <div className="text-xs tabular-nums" style={{ color: 'var(--text-dim)' }}>{dateText}</div>
      </div>
    </a>
  )
}

function CardRow({ cfg, items, isLoading, isMaintenance }) {
  const slice = items.slice(0, 8)
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold px-0.5" style={{ color: 'var(--text-emphasis)' }}>{cfg.label}</h3>
      {isLoading || isMaintenance || slice.length === 0 ? (
        <div className="rounded-xl border border-dashed" style={{ borderColor: 'var(--dashed-border)' }}>
          <StateMsg isLoading={isLoading} isMaintenance={isMaintenance} empty={`진행중인 ${cfg.label}이 없습니다`} />
        </div>
      ) : (
        <div className="flex overflow-x-auto pb-2 snap-x -mx-4" style={{ scrollbarWidth: 'none' }}>
          {slice.map((it) => (
            <div key={it.notice_id} className="shrink-0 snap-start pl-4 last:pr-4">
              <MobileCard item={it} cfg={cfg} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function MobileNoticeWidget() {
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
    <section className="space-y-5">
      <div className="space-y-3">
        <TextList cfg={SECTIONS.notice} {...byKey.notice} />
        <TextList cfg={SECTIONS.update} {...byKey.update} />
      </div>
      <CardRow cfg={SECTIONS.event} {...byKey.event} />
      <CardRow cfg={SECTIONS.cashshop} {...byKey.cashshop} />
    </section>
  )
}
