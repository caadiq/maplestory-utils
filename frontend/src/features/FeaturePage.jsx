import { Suspense } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { getUserComponent } from './registry'
import ErrorBoundary from '../components/common/ErrorBoundary'

export default function FeaturePage() {
  const { slug } = useParams()
  const Component = getUserComponent(slug)

  if (!Component) {
    return <Navigate to="/" replace />
  }

  return (
    <ErrorBoundary key={slug}>
      <Suspense fallback={
        <div className="flex items-center justify-center pt-20">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <Component />
      </Suspense>
    </ErrorBoundary>
  )
}
