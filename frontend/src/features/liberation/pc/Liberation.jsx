import { useLayoutEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useLayout } from '../../../components/pc/Layout'
import MapleWindow, { MapleWindowTab } from '../../../components/pc/MapleWindow'
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
    <div className="pb-10 max-w-4xl mx-auto">
      <MapleWindow
        title="LIBERATION"
        tabs={[
          { key: 'genesis', label: '제네시스 해방', img: genesisImg.data?.url },
          { key: 'destiny', label: '데스티니 해방', img: destinyImg.data?.url },
        ].map((tab) => (
          <MapleWindowTab
            key={tab.key}
            active={liberationType === tab.key}
            onClick={() => setLiberationType(tab.key)}
          >
            {tab.img && <img src={tab.img} alt="" className="w-5 h-5 object-contain" style={{ imageRendering: 'pixelated' }} />}
            {tab.label}
          </MapleWindowTab>
        ))}
      >
        <div className="space-y-4">
          {liberationType === 'genesis' ? <Genesis /> : <Destiny />}
        </div>
      </MapleWindow>
    </div>
  )
}
