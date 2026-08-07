import { Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { getMobileComponent, isPcOnly } from './registry'
import ErrorBoundary from '../components/common/ErrorBoundary'

export default function MobileFeaturePage() {
  const { slug } = useParams()
  const Component = getMobileComponent(slug)

  if (!Component) {
    // 만들 수 없는 것과 아직 안 만든 것은 다르게 알린다
    const pcOnly = isPcOnly(slug)
    return (
      <div className="flex flex-col items-center justify-center text-center pt-24 px-4">
        <div className="text-4xl mb-3 opacity-50">{pcOnly ? '🖥️' : '📱'}</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {pcOnly ? '이 기능은 PC 전용입니다' : '이 기능의 모바일 버전은 준비 중입니다'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
          {pcOnly ? '게임 화면 공유가 필요해 모바일에서는 동작하지 않습니다' : 'PC에서 이용해 주세요'}
        </p>
      </div>
    )
  }

  return (
    <ErrorBoundary key={slug}>
      <Suspense fallback={
        <div className="flex items-center justify-center pt-24">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      }>
        <Component />
      </Suspense>
    </ErrorBoundary>
  )
}
