/** 페이지 데이터 로딩 화면 — 로딩이 끝나면 페이지 전체가 .mpl-page-enter로 페이드 인 */
export default function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="w-8 h-8 rounded-full animate-spin"
        style={{ border: '3px solid var(--accent)', borderTopColor: 'transparent' }}
      />
    </div>
  )
}
