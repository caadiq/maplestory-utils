import { Routes, Route } from 'react-router-dom'

/**
 * 모바일 라우트 (placeholder)
 * 추후 MobileLayout, 기능별 모바일 페이지 등록 예정
 */
export default function MobileRoutes() {
  return (
    <Routes>
      <Route
        path="*"
        element={
          <div
            className="min-h-screen flex items-center justify-center p-6 text-center"
            style={{ color: 'var(--text-muted)' }}
          >
            <div>
              <div className="text-4xl mb-3 opacity-50">📱</div>
              <p className="text-sm">모바일 버전은 준비 중입니다</p>
            </div>
          </div>
        }
      />
    </Routes>
  )
}
