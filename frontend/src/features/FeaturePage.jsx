import { Suspense } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { getUserComponent } from './registry'

export default function FeaturePage() {
  const { slug } = useParams()
  const Component = getUserComponent(slug)

  if (!Component) {
    return <Navigate to="/" replace />
  }

  return (
    <Suspense fallback={null}>
      <Component />
    </Suspense>
  )
}
