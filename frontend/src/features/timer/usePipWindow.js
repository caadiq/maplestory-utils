import { useState, useCallback, useEffect } from 'react'

/**
 * Document Picture-in-Picture — 미니바를 항상 위에 뜨는 별도 창으로 분리한다.
 * 게임이 창모드/테두리없는창이면 그 위로 올라온다. 독점 전체화면이면 가려질 수 있다.
 *
 * 지금은 Chromium 계열만 지원한다. 미지원 브라우저에서는 supported=false로 버튼을 감춘다.
 */

const isSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window

/** 메인 문서의 스타일을 PiP 문서로 복사 — 안 하면 스타일 없는 맨몸 HTML이 뜬다 */
function copyStyles(target) {
  for (const sheet of document.styleSheets) {
    try {
      const rules = sheet.cssRules
      const style = target.document.createElement('style')
      style.textContent = Array.from(rules).map((r) => r.cssText).join('\n')
      target.document.head.appendChild(style)
    } catch {
      // 교차 출처 스타일시트는 cssRules를 못 읽는다 — link로 다시 걸어준다
      if (sheet.href) {
        const link = target.document.createElement('link')
        link.rel = 'stylesheet'
        link.href = sheet.href
        target.document.head.appendChild(link)
      }
    }
  }
}

export function usePipWindow() {
  const [pip, setPip] = useState(null)

  const open = useCallback(async ({ width = 316, height = 236 } = {}) => {
    if (!isSupported) return null
    try {
      const win = await window.documentPictureInPicture.requestWindow({ width, height })
      copyStyles(win)

      // 테마는 <html data-theme>로 결정되므로 그대로 옮겨준다
      const theme = document.documentElement.getAttribute('data-theme')
      if (theme) win.document.documentElement.setAttribute('data-theme', theme)
      win.document.body.style.margin = '0'
      win.document.body.style.background = 'transparent'

      win.addEventListener('pagehide', () => setPip(null))
      setPip(win)
      return win
    } catch {
      return null
    }
  }, [])

  const close = useCallback(() => {
    pip?.close()
    setPip(null)
  }, [pip])

  // 페이지를 떠날 때 PiP 창만 남는 것을 막는다
  useEffect(() => () => pip?.close(), [pip])

  // 테마를 바꾸면 PiP 창도 따라가야 한다
  useEffect(() => {
    if (!pip) return
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme')
      if (theme) pip.document.documentElement.setAttribute('data-theme', theme)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [pip])

  return { supported: isSupported, pip, open, close }
}
