import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useLiberationStore, liberationInitial, migrateLiberationState } from '../store'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import Genesis from './Genesis'
import Destiny from './Destiny'
import MapleWindow, { MapleWindowTab } from '../../../components/pc/MapleWindow'
import PageLoader from '../../../components/common/PageLoader'

export default function Liberation() {
  const { hydrated } = useFeatureSync({
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

  if (!hydrated) return <PageLoader />

  return (
    <MapleWindow
      className="mpl-page-enter"
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
      {liberationType === 'genesis' ? <Genesis /> : <Destiny />}
    </MapleWindow>
  )
}
