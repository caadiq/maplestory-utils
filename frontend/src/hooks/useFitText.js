import { useEffect, useRef, useState } from 'react'

/**
 * 텍스트가 컨테이너에 들어가도록 자동으로 폰트 크기 축소
 * @param {number} maxFontSize - 최대 폰트 크기 (px)
 * @param {number} minFontSize - 최소 폰트 크기 (px)
 * @param {string} value - 텍스트 (변경 감지용)
 */
export function useFitText({ maxFontSize = 30, minFontSize = 12, value }) {
  const containerRef = useRef(null)
  const textRef = useRef(null)
  const [fontSize, setFontSize] = useState(maxFontSize)

  useEffect(() => {
    if (!containerRef.current || !textRef.current) return

    const fit = () => {
      const container = containerRef.current
      const text = textRef.current
      if (!container || !text) return

      // 일단 최대 크기로 시도
      let size = maxFontSize
      text.style.fontSize = `${size}px`

      // 컨테이너보다 크면 줄여나감
      while (text.scrollWidth > container.clientWidth && size > minFontSize) {
        size -= 1
        text.style.fontSize = `${size}px`
      }

      setFontSize(size)
    }

    fit()

    const ro = new ResizeObserver(fit)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [value, maxFontSize, minFontSize])

  return { containerRef, textRef, fontSize }
}
