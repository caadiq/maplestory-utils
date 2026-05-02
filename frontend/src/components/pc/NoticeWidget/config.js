export const SECTIONS = {
  notice: { label: '공지사항', dataKey: 'notice', pageSize: 5, kind: 'text' },
  update: { label: '업데이트', dataKey: 'update_notice', pageSize: 5, kind: 'text' },
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

export function fmtMD(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
export function fmtYMD(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function isRecent(iso, days = 3) {
  if (!iso) return false
  return (Date.now() - new Date(iso).getTime()) / 86400000 < days
}
export function isOngoing(item, cfg) {
  if (!cfg.filterOngoing) return true
  const end = item[cfg.dateEndKey]
  if (end) return new Date(end) > new Date()
  if (item.ongoing_flag !== undefined) return item.ongoing_flag === 'true' || item.ongoing_flag === true
  return false
}
export function dayBadge(item, cfg) {
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
    return { label: `종료 ${d}일 전`, tone: 'amber' }
  }
  if (item.ongoing_flag === 'true' || item.ongoing_flag === true) {
    return { label: '상시판매', tone: 'gray' }
  }
  return null
}
