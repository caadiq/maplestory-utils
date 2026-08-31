/**
 * 좌하단 닉네임 판을 읽어 **어느 캐릭터인가**만 가려낸다. DOM을 쓰지 않는다.
 *
 * 글자를 읽지 않는다(OCR 아님). 등록해둔 닉네임 조각과 밝기 NCC로 대조해
 * "저장된 프로필 중 어느 것인가"만 고른다 — 캐릭터를 바꾸면 그 프로필의
 * 알림 설정으로 갈아끼우는 것이 목적이라, 이름 문자열은 필요가 없다.
 *
 * ── 설계가 이렇게 된 이유 (전부 실측 근거) ───────────────────────────────
 *
 * 1) **게임 화면 왼쪽 끝을 구하지 않는다.**
 *    locateCore의 contentBox를 left까지 넓혀 보면 확장 UI에서 417~438px 틀린다
 *    (게임 왼쪽에 분리된 UI 창이 떠 있으면 그걸 화면 시작으로 잡는다. 25/25 프레임 실패).
 *    대신 화면 하단 띠를 가로 전체로 훑어 조각이 가장 잘 맞는 자리를 찾는다.
 *    확장 UI에서 정답 (527,861) 대비 (526,862)로 1px 안에 들어왔다.
 *
 * 2) **UI 배율을 믿지 않는다.**
 *    uiScale(h) = h/768은 확장 UI에서 6~11%, 창틀 포함 캡처에서 3% 과대평가한다.
 *    배율로 폭을 계산하면(round(pw*s/scale)) 1px만 틀려도 0.885 → 0.75,
 *    4px 틀리면 0.36, 배율을 그대로 믿으면 0.165까지 무너진다.
 *    그래서 폭도 **탐색 대상**으로 둔다 — 배율은 탐색 중심을 잡는 힌트일 뿐이다.
 *
 * 3) **밝기 그대로 쓴다.** 글자색 마스크는 주황 배경에서 11% 깨지고,
 *    잉크 경계 정규화는 압축 잡음에 흔들려 같은 닉이 0.19까지 내려간다.
 *    밝기 NCC는 보스전 폭발 한가운데서도 0.956 아래로 안 내려갔다
 *    (글자는 불투명 — 300프레임 시간 표준편차 글자 3.5 / 판 배경 5.7 / 판 바깥 29.5).
 *
 * 4) **닉네임 잉크 폭만 자른다.** 넓게 자르면 반투명 판 뒤 게임 장면이 섞여
 *    다른 닉네임끼리도 0.75~0.89로 붙는다. 레벨 숫자도 빼야 한다 —
 *    포함하면 레벨업 때마다 자기 자신과도 안 맞는다(같은 닉 최저 0.955 → 0.689).
 */

/** 위컴알 UI.wz > StatusBar3.img > main/nameplate 실측값 (UI 기준 해상도 1366×768) */
export const NAMEPLATE = {
  /** namePos.x — 닉네임 글자가 시작하는 자리 (레벨 숫자는 55.5까지, 12 UI px 여유) */
  anchorX: 67,
  /** -posFromLB.y - namePos.y = 48 - 13. 게임 화면 바닥에서 위로 */
  anchorY: 36,
  /** fontSize 14 — 글자 세로 실측 13·s (후광 포함 14·s) */
  fontHeight: 13,

  /**
   * 판정 통과선.
   * 실측: 같은 닉 최저 0.940 / 다른 닉 최고 0.762, 세 글자가 겹치는 이름이 0.812.
   * 0.85 아래로 내리면 비슷한 이름이 뚫린다.
   */
  accept: 0.85,
  /**
   * 1등이 2등을 이만큼 이겨야 채택한다.
   * 유사한 이름 쌍에서 마진이 0.18까지 좁아진다 — 통과선만으로는 못 가린다.
   */
  margin: 0.15,
  /** 이보다 낮으면 "닉네임 판이 없다"로 본다 (로그인·캐릭터 선택 화면 최고 0.105) */
  absent: 0.5,
  /** 같은 프로필이 연속 이만큼 나와야 전환한다 — 창 크기 변경 직후 과도구간을 덮는다 */
  votes: 3,
  /** 판정 주기. 캐릭터 변경은 몇 분에 한 번이라 잦을 이유가 없다 */
  scanMs: 3000,

  /** 보정(자리 찾기) 탐색 범위 — 배율이 6~11% 틀려도 흡수한다 */
  calibDx: 8,
  calibDy: 4,
  calibDw: 4,
  /** 자리를 잡은 뒤에는 이만큼만 다시 본다 */
  trackDx: 2,
  trackDy: 2,
}

/** RGBA → 밝기 평면 (Rec.601) */
export function toGray(data, out) {
  const n = data.length >> 2
  const g = out && out.length === n ? out : new Float32Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    g[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }
  return g
}

/**
 * 등록할 때 **한 번만** 닉네임 잉크의 오른쪽 끝을 잰다.
 *
 * 런타임에는 절대 쓰지 않는다 — 이 마스크는 보스전 이펙트 위에서 38~41% 깨진다.
 * 등록은 사용자가 조용한 화면에서 한 번 하는 일이라 그때만 쓰면 안전하다.
 *
 * @returns {number} 잉크 폭(px). 글자를 못 찾으면 0
 */
export function inkWidth(data, w, h, s = 1) {
  // 닉네임 글자색 FFC4DAE1 — 푸르스름하고 밝다
  const isInk = (p) => data[p + 2] > 140 && data[p + 1] > 130 && data[p] > 110 && data[p + 2] >= data[p]
  const colHas = new Uint8Array(w)
  for (let x = 0; x < w; x++) {
    let n = 0
    for (let y = 0; y < h; y++) if (isInk((y * w + x) * 4)) n++
    colHas[x] = n >= 2 ? 1 : 0   // 한 점짜리 잡음은 글자가 아니다
  }
  let start = -1
  for (let x = 0; x < w; x++) if (colHas[x]) { start = x; break }
  if (start < 0) return 0
  // 글자 사이 공백은 실측 3px — 그보다 크게 벌어지면 닉네임이 끝난 것이다
  const maxGap = Math.max(3, Math.round(4 * s))
  let end = start
  let gap = 0
  for (let x = start; x < w; x++) {
    if (colHas[x]) { end = x; gap = 0; continue }
    if (++gap > maxGap) break
  }
  return end - start + 1
}

/** 조각을 다른 크기로 리샘플한다 (이중선형) */
export function resample(src, sw, sh, dw, dh) {
  const out = new Float32Array(dw * dh)
  const rx = sw / dw
  const ry = sh / dh
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) * ry - 0.5))
    const y0 = Math.max(0, Math.floor(fy))
    const y1 = Math.min(sh - 1, y0 + 1)
    const wy = Math.min(1, Math.max(0, fy - y0))   // 가장자리에서 음수가 되면 값이 범위를 벗어난다
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) * rx - 0.5))
      const x0 = Math.max(0, Math.floor(fx))
      const x1 = Math.min(sw - 1, x0 + 1)
      const wx = Math.min(1, Math.max(0, fx - x0))
      const a = src[y0 * sw + x0] * (1 - wx) + src[y0 * sw + x1] * wx
      const b = src[y1 * sw + x0] * (1 - wx) + src[y1 * sw + x1] * wx
      out[y * dw + x] = a * (1 - wy) + b * wy
    }
  }
  return out
}

/** 평균 0·길이 1로 맞춘다. 평탄하면 null (NCC가 성립하지 않는다) */
export function normalizePatch(v) {
  let sum = 0
  for (let i = 0; i < v.length; i++) sum += v[i]
  const mean = sum / v.length
  let ss = 0
  const out = new Float32Array(v.length)
  for (let i = 0; i < v.length; i++) { const d = v[i] - mean; out[i] = d; ss += d * d }
  if (ss < 1e-6) return null
  const inv = 1 / Math.sqrt(ss)
  for (let i = 0; i < out.length; i++) out[i] *= inv
  return out
}

/**
 * 큰 밝기 평면 위의 (x,y)에서 tw×th 창을 떼어 정규화된 조각과 NCC.
 * tpl은 normalizePatch를 거친 것이어야 한다.
 */
export function nccAt(gray, gw, gh, tpl, tw, th, x, y) {
  if (x < 0 || y < 0 || x + tw > gw || y + th > gh) return -1
  let sum = 0
  let sq = 0
  for (let j = 0; j < th; j++) {
    const row = (y + j) * gw + x
    for (let i = 0; i < tw; i++) { const v = gray[row + i]; sum += v; sq += v * v }
  }
  const n = tw * th
  const mean = sum / n
  const varSum = sq - mean * sum
  if (varSum < 1e-6) return -1
  const inv = 1 / Math.sqrt(varSum)
  let dot = 0
  for (let j = 0; j < th; j++) {
    const row = (y + j) * gw + x
    const trow = j * tw
    for (let i = 0; i < tw; i++) dot += (gray[row + i] - mean) * tpl[trow + i]
  }
  return dot * inv
}

/**
 * 프로필의 등록 조각을 런타임 크기로 미리 만들어 둔다.
 *
 * 자리마다 리샘플하면 13배 느리다(7.29ms → 0.55ms) — 크기별로 한 번만 만들고
 * 그 위를 미끄러뜨린다.
 */
export function prepareTemplates(profile, widths) {
  const out = []
  for (const W of widths) {
    const H = Math.max(4, Math.round(profile.ph * (W / profile.pw)))
    const v = normalizePatch(resample(profile.patch, profile.pw, profile.ph, W, H))
    if (v) out.push({ W, H, v })
  }
  return out
}

/** 배율 힌트로 폭 후보를 만든다. 배율이 틀려도 ±calibDw가 흡수한다 */
export function widthCandidates(profile, s, spread = NAMEPLATE.calibDw) {
  const center = Math.max(6, Math.round(profile.pw * (s / profile.scale)))
  const set = new Set()
  for (let d = -spread; d <= spread; d++) set.add(Math.max(6, center + d))
  return [...set].sort((a, b) => a - b)
}

/**
 * 자리를 모른 채 화면 하단 띠를 훑어 닉네임 판을 찾는다.
 *
 * 게임 화면 왼쪽 끝도 UI 배율도 몰라도 된다 — 그 둘이 정확히 못 믿을 값이라서
 * 아예 입력에서 뺐다. 대신 비싸다(1920폭 기준 약 300ms) 워커에서 돌린다.
 *
 * @param band  하단 띠 밝기 평면
 * @returns {{x,y,W,H,score,id}|null} 띠 안에서의 좌표
 */
export function calibrate(band, bw, bh, profiles, s) {
  /*
   * 성긴 훑기 → 정련. 전수로 하면 1920폭에서 3.6초가 걸린다(실측).
   * 자리만 찾으면 되므로 폭 후보도 성긴 단계에서는 가운데 하나만 쓴다 —
   * 폭이 몇 px 달라도 봉우리 자리는 그대로다.
   */
  const coarse = []
  for (const p of profiles) {
    const mid = Math.max(6, Math.round(p.pw * (s / p.scale)))
    const t = prepareTemplates(p, [mid])[0]
    if (t && t.W <= bw && t.H <= bh) coarse.push({ p, t })
  }
  if (!coarse.length) return null

  let rough = null
  for (const { p, t } of coarse) {
    for (let y = 0; y + t.H <= bh; y += 2) {
      for (let x = 0; x + t.W <= bw; x += 3) {
        const sc = nccAt(band, bw, bh, t.v, t.W, t.H, x, y)
        if (!rough || sc > rough.score) rough = { x, y, score: sc, id: p.id }
      }
    }
  }
  if (!rough || rough.score < NAMEPLATE.absent * 0.6) return null

  // 정련 — 봉우리 둘레에서 폭까지 함께 맞춘다
  let best = null
  for (const p of profiles) {
    for (const t of prepareTemplates(p, widthCandidates(p, s))) {
      if (t.W > bw || t.H > bh) continue
      for (let y = rough.y - 3; y <= rough.y + 3; y++) {
        for (let x = rough.x - 4; x <= rough.x + 4; x++) {
          const sc = nccAt(band, bw, bh, t.v, t.W, t.H, x, y)
          if (!best || sc > best.score) best = { x, y, W: t.W, H: t.H, score: sc, id: p.id }
        }
      }
    }
  }
  return best && best.score >= NAMEPLATE.absent ? best : null
}

/**
 * 잡아둔 자리 근처에서 프로필마다 최고점을 낸다.
 * @returns [{id, score}] 점수 내림차순
 */
export function scoreProfiles(band, bw, bh, profiles, spot, s, radius = NAMEPLATE.trackDx) {
  const out = []
  for (const p of profiles) {
    const widths = widthCandidates(p, s, 1)
    let best = -1
    for (const t of prepareTemplates(p, widths)) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const sc = nccAt(band, bw, bh, t.v, t.W, t.H, spot.x + dx, spot.y + dy)
          if (sc > best) best = sc
        }
      }
    }
    out.push({ id: p.id, score: best, pw: p.pw })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** 저장 폭이 이 비율보다 좁으면 '접두'로 보고 경쟁자에서 뺀다 */
const PREFIX_RATIO = 0.85

/**
 * 점수에서 결론을 낸다.
 *
 * **접두 함정**: 짧은 이름은 긴 이름의 앞부분과 그대로 겹친다 —
 * "비머"(폭 37)는 "비머비숍"·"비머레테" 화면 양쪽에서 0.996~0.998이 나온다.
 * 그래서 통과한 것이 여럿이면 **저장 폭이 가장 넓은 것**을 택한다.
 * 반대 방향은 저절로 막힌다(짧은 이름 화면에서 긴 프로필은 0.578).
 *
 * @returns {{id, score}|null} null이면 판단 보류 — 지금 프로필을 유지한다
 */
export function decide(scored) {
  if (!scored.length) return null
  const passed = scored.filter((x) => x.score >= NAMEPLATE.accept)
  if (!passed.length) return null

  /*
   * 접두 함정: 짧은 이름은 긴 이름의 앞부분과 그대로 겹쳐 만점이 나온다 —
   * "비머"(폭 37)는 "비머비숍" 화면에서 0.998이다(실측). 점수만 보면 짧은 쪽이 이긴다.
   * 통과한 것 중 **가장 넓은 것**이 진짜다. 반대 방향은 저절로 막힌다
   * (짧은 이름 화면에서 긴 프로필은 0.578).
   */
  const pick = passed.reduce((a, b) => (
    b.pw > a.pw || (b.pw === a.pw && b.score > a.score) ? b : a
  ))

  /*
   * 폭이 비슷한 것끼리는 접두가 아니라 그냥 '비슷한 이름'이다 — 점수 격차로 갈라야 한다.
   * 유사한 이름 쌍에서 마진이 0.18까지 좁아지므로 통과선만으로는 못 가린다(실측).
   */
  let rival = null
  for (const x of scored) {
    if (x.id === pick.id) continue
    if (x.pw < pick.pw * PREFIX_RATIO) continue   // 접두 — 경쟁자가 아니다
    if (!rival || x.score > rival.score) rival = x
  }
  if (rival && pick.score - rival.score < NAMEPLATE.margin) return null

  return { id: pick.id, score: pick.score }
}

/**
 * 닉네임 판이 들어갈 하단 띠. 게임 화면 바닥만 알면 된다(contentBox가 이미 준다).
 * 왼쪽 끝은 모르는 채로 두고 가로 전체를 준다 — calibrate가 훑는다.
 */
export function searchBand(vw, vh, bottom, s) {
  const anchor = Math.round(NAMEPLATE.anchorY * s)
  const pad = Math.round(10 * s)
  const y0 = Math.max(0, bottom - anchor - pad)
  const y1 = Math.min(vh, bottom - anchor + Math.round(NAMEPLATE.fontHeight * s) + pad)
  return { x: 0, y: y0, w: vw, h: Math.max(1, y1 - y0) }
}
