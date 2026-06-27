import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useLiberationStore, liberationInitial, migrateLiberationState } from '../store'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import Genesis from './Genesis'
import Destiny from './Destiny'

export default function Liberation() {
  useFeatureSync({
    feature: 'liberation',
    store: useLiberationStore,
    initial: liberationInitial,
    migrate: migrateLiberationState,
  })

  const liberationType = useLiberationStore((s) => s.liberationType)
  const setLiberationType = useLiberationStore((s) => s.setLiberationType)

  const genesisImg = useQuery({
    queryKey: ['image', '제네시스 스태프'],
    queryFn: () => api('/api/images/' + encodeURIComponent('제네시스 스태프')).catch(() => null),
    staleTime: Infinity,
  })
  const destinyImg = useQuery({
    queryKey: ['image', '데스티니 스태프'],
    queryFn: () => api('/api/images/' + encodeURIComponent('데스티니 스태프')).catch(() => null),
    staleTime: Infinity,
  })

  return (
    <div className="space-y-4">
      {/* 해방 종류 탭 */}
      <div className="flex gap-2">
        {[
          { key: 'genesis', label: '제네시스 해방', img: genesisImg.data?.url },
          { key: 'destiny', label: '데스티니 해방', img: destinyImg.data?.url },
        ].map((tab) => {
          const active = liberationType === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setLiberationType(tab.key)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5"
              style={active ? {
                background: 'var(--selected-bg)', borderColor: 'var(--selected-border)',
                color: 'var(--accent-bright)', boxShadow: 'var(--btn-primary-shadow)',
              } : {
                background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', color: 'var(--text-muted)',
              }}
            >
              {tab.img && <img src={tab.img} alt="" className="w-6 h-6 object-contain shrink-0" />}
              <span className="text-sm font-semibold whitespace-nowrap">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {liberationType === 'genesis' ? <Genesis /> : <Destiny />}
    </div>
  )
}
