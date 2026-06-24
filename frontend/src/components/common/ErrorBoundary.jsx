import { Component } from 'react'

/**
 * 렌더링 중 발생한 예외를 잡아 전체 화면 백지화를 막는 안전망.
 * persist된 구버전 데이터로 인한 크래시, lazy 청크 로드 실패 등을 격리한다.
 *
 * @param {React.ReactNode} children
 * @param {(ctx: { error: Error, reset: () => void }) => React.ReactNode} [fallback]
 *   커스텀 폴백. 없으면 기본 안내 UI를 보여준다.
 *
 * 라우트별로 에러 상태를 초기화하려면 `key`(예: slug)를 부여해 재마운트시킨다.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('렌더링 오류:', error, info)
  }

  handleReset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.handleReset })
    }

    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4">
        <div className="text-4xl mb-3 opacity-40">⚠️</div>
        <p className="text-base font-medium" style={{ color: 'var(--text-emphasis)' }}>
          화면을 표시하는 중 문제가 발생했어요
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
          다시 시도하거나 페이지를 새로고침해 주세요
        </p>
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-lg px-4 h-10 text-sm font-semibold"
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              boxShadow: 'var(--btn-primary-shadow)',
            }}
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border px-4 h-10 text-sm font-medium"
            style={{
              background: 'var(--btn-bg)',
              borderColor: 'var(--btn-border)',
              color: 'var(--text-emphasis)',
            }}
          >
            새로고침
          </button>
        </div>
      </div>
    )
  }
}
