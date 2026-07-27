import { useEffect, useRef } from 'react'

// 열려 있는 다이얼로그 스택 — 뒤로가기 한 번에 마지막에 연 다이얼로그 하나만 닫는다
const stack = []

/**
 * 다이얼로그가 열려 있을 때 뒤로가기를 누르면 페이지 이동 대신 다이얼로그만 닫는다.
 * - 열릴 때 같은 URL로 히스토리 엔트리를 하나 추가 → 뒤로가기가 그 엔트리만 소비
 * - 버튼/배경 클릭으로 닫히면 추가했던 엔트리를 자동 제거 (state 토큰 확인 후라
 *   다이얼로그를 열어둔 채 다른 페이지로 이동한 경우엔 건드리지 않음)
 *
 * @param {boolean} open   다이얼로그 열림 여부 (항상 열린 채 마운트되는 컴포넌트는 true 고정)
 * @param {function} onClose
 */
export function useBackClose(open, onClose) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    if (!open) return
    const token = `dlg-${Math.random().toString(36).slice(2)}`
    const id = {}
    stack.push(id)
    window.history.pushState({ __dialog: token }, '')

    const onPop = () => {
      // 마지막에 연 다이얼로그이고, pop 결과가 자기 엔트리가 아닐 때만 닫기
      // (위에 쌓인 다이얼로그의 엔트리 제거로 자기 엔트리에 도착한 경우는 무시)
      if (stack[stack.length - 1] === id && window.history.state?.__dialog !== token) {
        stack.pop()
        closeRef.current?.()
      }
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      const idx = stack.indexOf(id)
      if (idx !== -1) {
        stack.splice(idx, 1)
        if (window.history.state?.__dialog === token) window.history.back()
      }
    }
  }, [open])
}
