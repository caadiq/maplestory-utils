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
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  )
}
