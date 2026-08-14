/**
 * VIP 부스터 남은시간 탐색 워커.
 * 라벨 NCC + 숫자 두 칸 판독을 메인 스레드에서 돌리면 화면이 걸린다.
 */
import { scanBooster } from './boosterCore'

self.onmessage = (e) => {
  const { id, band, variants, lockedScale } = e.data
  try {
    self.postMessage({ id, hit: scanBooster(band, variants, lockedScale) })
  } catch (err) {
    self.postMessage({ id, hit: null, error: String(err) })
  }
}
