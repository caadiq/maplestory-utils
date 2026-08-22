/**
 * 화면에서 실측한 게임 UI 배율의 공유 저장소.
 *
 * 룬·부스터 템플릿은 캡처 세로 크기로 배율을 예측하는데, 인게임 **확장 UI**는
 * 창 크기와 UI 배율이 따로 놀아 그 예측이 크게 어긋난다(실측: 890px 창에서
 * 예측 1.16배, 실제 0.94배). 야누스 아이콘을 찾은 순간이 가장 정확한 실측이다 —
 * 아이콘의 기본 크기는 32px로 고정이라, 찾은 크기 ÷ 32가 곧 실제 UI 배율이다.
 *
 * 캡처 크기가 바뀌면(다른 창을 공유) 실측도 무효가 되므로 크기까지 같이 기억한다.
 */

let measured = null // { iconPx, vw, vh }

/** 야누스 아이콘을 찾거나 직접 지정한 순간 호출 — iconPx는 원본 해상도 기준 */
export function learnIconSize(iconPx, vw, vh) {
  if (!iconPx || iconPx < 10 || !vw || !vh) return
  measured = { iconPx, vw, vh }
}

/** 같은 캡처 크기에서 실측된 UI 배율. 없거나 캡처가 달라졌으면 null */
export function measuredUiScale(vw, vh) {
  if (!measured || measured.vw !== vw || measured.vh !== vh) return null
  return measured.iconPx / 32
}
