/**
 * 미니맵 룬 표식 워커.
 *
 * 두 가지 일을 한다 — 미니맵 자리 찾기(화면 전체를 여러 배율로 훑어 무겁다)와
 * 표식 찾기(지도 영역만 보므로 가볍다). 둘 다 메인 스레드에서 돌리면 화면이 걸린다.
 */
import { locateMinimap, scanRuneMark } from './runeMarkCore'

self.onmessage = (e) => {
  const { id, op, payload } = e.data
  try {
    const result = op === 'locate' ? locateMinimap(payload) : scanRuneMark(payload.band, payload.marks)
    self.postMessage({ id, result })
  } catch (err) {
    self.postMessage({ id, result: null, error: String(err) })
  }
}
