import { useLayoutEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useLayout } from '../../../components/pc/Layout'
import { useLiberationStore } from '../store'
import Genesis from './Genesis'
import Destiny from './Destiny'

export default function Liberation() {
  const { setFullscreen } = useLayout()
  useLayoutEffect(() => {
    setFullscreen(true)
    return () => setFullscreen(false)
  }, [setFullscreen])

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
    <div className="space-y-6 pb-10">
      {/* 해방 종류 탭 */}
      <div className="max-w-3xl mx-auto flex gap-2">
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
              className="flex-1 flex items-center justify-center gap-3 rounded-2xl border px-5 py-3"
              style={active ? {
                background: 'var(--selected-bg)',
                borderColor: 'var(--selected-border)',
                color: 'var(--accent-bright)',
                boxShadow: 'var(--btn-primary-shadow)',
              } : {
                background: 'var(--panel-bg)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-muted)',
              }}
            >
              {tab.img && <img src={tab.img} alt="" className="w-8 h-8 object-contain" />}
              <span className="text-base font-semibold">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {liberationType === 'genesis' ? <Genesis /> : <Destiny />}
    </div>
  )
}
