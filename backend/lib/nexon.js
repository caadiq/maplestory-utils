import axios from 'axios';

export const NEXON_API_BASE = 'https://open.api.nexon.com';

// 점검/일시 오류 코드 — 이 경우 503 + maintenance 플래그로 응답한다
export const MAINTENANCE_CODES = ['OPENAPI00001', 'OPENAPI00007', 'OPENAPI00010', 'OPENAPI00011'];

/**
 * 넥슨 OpenAPI GET.
 * @param apiKey 미지정 시 서버 키(NEXON_API_KEY) 사용. 사용자 제공 키가 있으면 넘긴다.
 */
export function nexonGet(path, params, { apiKey, timeout = 10000 } = {}) {
  return axios.get(`${NEXON_API_BASE}${path}`, {
    params,
    headers: { 'x-nxopen-api-key': apiKey || process.env.NEXON_API_KEY },
    timeout,
  });
}

/** 닉네임 → ocid */
export async function getOcid(name) {
  const { data } = await nexonGet('/maplestory/v1/id', { character_name: name });
  return data.ocid;
}

/**
 * 넥슨 호출 실패의 공통 응답 처리. 처리했으면 true를 반환한다.
 * @param notFound 지정하면 400을 404+이 메시지로 내린다. 없으면 400도 500으로 떨어진다
 *                 (ocid/키 문제라 "존재하지 않는 캐릭터"가 아닌 route용).
 */
export function handleNexonError(err, res, { label, notFound, failMsg = '조회 실패' } = {}) {
  const code = err.response?.data?.error?.name;
  if (MAINTENANCE_CODES.includes(code)) {
    res.status(503).json({ error: 'API 점검중입니다', code, maintenance: true });
    return true;
  }
  if (notFound && err.response?.status === 400) {
    res.status(404).json({ error: notFound });
    return true;
  }
  if (label) console.error(`${label}:`, err.response?.data || err.message);
  res.status(500).json({ error: failMsg });
  return true;
}
