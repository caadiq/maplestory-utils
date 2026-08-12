/**
 * 룬 문구 탐색 워커.
 * 상단 띠(1000×180px 남짓)를 NCC로 훑는 계산이라 메인 스레드에서 돌리면 화면이 걸린다.
 */
import { scanRuneBand } from './runeCore'

self.onmessage = (e) => {
  const { id, band, templates } = e.data
  try {
    self.postMessage({ id, hit: scanRuneBand(band, templates) })
  } catch (err) {
    self.postMessage({ id, hit: null, error: String(err) })
  }
}
