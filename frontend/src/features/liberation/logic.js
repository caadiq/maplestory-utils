// 해방 진행도 계산 (제네시스·데스티니 공유)

/**
 * 현재 진행 챕터 + 보유 흔적으로 누적/남은 흔적 계산.
 * 보유 흔적이 현재 챕터 required를 넘으면 다음 챕터로 자동 이월(cascade).
 * @param {Array} chapters 챕터 목록 ({ required })
 * @param {number} total 전체 필요 흔적
 * @param {number} startChapter 현재 진행 챕터 인덱스
 * @param {number} currentPoints 현재 보유 흔적
 * @returns {{ initialAccumulated: number, alreadyDone: boolean, remaining: number }}
 */
export function liberationProgress(chapters, total, startChapter, currentPoints) {
  const priorConsumed = chapters
    .slice(0, startChapter)
    .reduce((s, c) => s + c.required, 0)
  let idx = startChapter
  let remain = currentPoints
  let consumed = 0
  while (idx < chapters.length && remain >= chapters[idx].required) {
    consumed += chapters[idx].required
    remain -= chapters[idx].required
    idx++
  }
  const initialAccumulated = priorConsumed + consumed + remain
  return {
    initialAccumulated,
    alreadyDone: initialAccumulated >= total,
    remaining: Math.max(total - initialAccumulated, 0),
  }
}
