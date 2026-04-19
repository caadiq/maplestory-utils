import { useQueries } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { SECTIONS, isOngoing } from './config'
import TextListSection from './TextListSection'
import CarouselSection from './CarouselSection'

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
      <div className="pt-2">
        <CarouselSection cfg={SECTIONS.event} {...byKey.event} />
      </div>
      <CarouselSection cfg={SECTIONS.cashshop} {...byKey.cashshop} />
    </section>
  )
}
