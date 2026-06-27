import { Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { getMobileComponent } from './registry'
import ErrorBoundary from '../components/common/ErrorBoundary'

export default function MobileFeaturePage() {
  const { slug } = useParams()
  const Component = getMobileComponent(slug)

  if (!Component) {
    // 모바일 페이지가 아직 없는 기능 — 준비 중 안내 (PC에서 이용 가능)
    return (
      <div className="flex flex-col items-center justify-center text-center pt-24 px-4">
        <div className="text-4xl mb-3 opacity-50">📱</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>이 기능의 모바일 버전은 준비 중입니다</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>PC에서 이용해 주세요</p>
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
