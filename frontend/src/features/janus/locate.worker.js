/**
 * 아이콘 탐색 워커.
 * 큰 화면을 여러 크기로 훑는 동안 화면이 멈추지 않도록 계산을 여기서 돌린다.
 */
import { locateIcon } from './locateCore'

self.onmessage = (e) => {
  const { id, payload } = e.data
  try {
    self.postMessage({ id, hits: locateIcon(payload) })
  } catch (err) {
    self.postMessage({ id, hits: [], error: String(err) })
  }
}
