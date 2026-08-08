import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { SundayMaple } from '../models/index.js';
import { nexonGet } from '../lib/nexon.js';
import { uploadObject, getPublicUrl } from '../lib/s3.js';

dayjs.extend(utc);
dayjs.extend(timezone);
const KST = 'Asia/Seoul';

const RUSTFS_PREFIX = 'sunday';

/**
 * 제목을 파싱하여 썬데이 메이플 변형을 반환
 * @returns {'normal'|'special'|null}
 */
export function detectVariant(title) {
  if (!title) return null;
  const t = title.trim();
  if (!t.includes('썬데이') || !t.includes('메이플')) return null;
  return t.includes('스페셜') ? 'special' : 'normal';
}

/**
 * 금요일 기준의 이번 주차 시작일 (YYYY-MM-DD, KST) 반환
 * 목 → 다음 날 금요일 (금요일 공휴일로 목요일 선공개되는 경우 대응)
 * 금/토/일 → 이번 주 금요일
 * 월/화/수 → 지난 주 금요일
 */
export function currentWeekFriday(now = dayjs().tz(KST)) {
  const dow = now.day(); // 0=일 ... 4=목 5=금 6=토
  // 목요일은 내일이 금요일이므로 -1
  const diff = dow === 4 ? -1 : (dow >= 5 ? dow - 5 : dow + 2);
  return now.startOf('day').subtract(diff, 'day').format('YYYY-MM-DD');
}

/**
 * 썬데이 메이플 표시 가능한 요일대 (목~일)
 * 목요일은 금요일 공휴일 케이스 대응용. 해당 주차 row 가 없으면 어차피 available: false.
 */
export function isInSundayWindow(now = dayjs().tz(KST)) {
  const dow = now.day();
  return dow === 4 || dow === 5 || dow === 6 || dow === 0;
}

/**
 * Nexon 이벤트 API에서 이번 주 썬데이 메이플 항목 찾기
 */
async function findSundayPost() {
  const { data } = await nexonGet('/maplestory/v1/notice-event');
  const list = data.event_notice || [];
  const weekStart = currentWeekFriday();
  // 제목 매칭 + 이번 주 시작
  return list.find((n) => {
    if (detectVariant(n.title) === null) return null;
    const start = n.date_event_start ? dayjs(n.date_event_start).tz(KST).format('YYYY-MM-DD') : null;
    // date_event_start가 금요일 아닐 수 있음 → 시작일이 해당 주 금요일과 같은 주인지 체크
    if (!start) return false;
    const sameWeek = dayjs(start).tz(KST).isSame(dayjs(weekStart).tz(KST), 'week')
      // dayjs isSame 'week' 는 일요일 기준이라 금/토 확인 필요 → 직접 비교
      || Math.abs(dayjs(start).diff(dayjs(weekStart), 'day')) <= 2;
    return sameWeek;
  }) || null;
}

/**
 * 게시글 HTML에서 첫 번째 컨텐츠 PNG URL 추출
 */
async function scrapeImageUrl(postUrl) {
  const { data: html } = await axios.get(postUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const re = /<img[^>]+src=["'](https:\/\/lwi\.nexon\.com\/maplestory\/\d{4}\/\d{4}_board\/[^"']+\.png)["']/i;
  const m = html.match(re);
  return m ? m[1] : null;
}

/**
 * Nexon CDN에서 이미지 다운로드 → rustfs 업로드 → URL 반환
 */
async function downloadAndUpload(sourceUrl, weekStart) {
  const { data: buffer } = await axios.get(sourceUrl, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const key = `${RUSTFS_PREFIX}/${weekStart}.png`;
  await uploadObject(key, Buffer.from(buffer), 'image/png');
  return { key, url: getPublicUrl(key) };
}

/**
 * 핵심: 이번 주 썬데이 메이플을 Nexon에서 찾아 rustfs에 업로드하고 DB 저장.
 * 이미 DB에 있으면 그대로 반환 (noop).
 *
 * @returns SundayMaple | null (게시글 아직 없음)
 */
export async function fetchAndSaveSundayMaple() {
  const weekStart = currentWeekFriday();

  // 이미 저장되어 있으면 스킵
  const existing = await SundayMaple.findOne({ where: { week_start: weekStart } });
  if (existing) return existing;

  const post = await findSundayPost();
  if (!post) return null;

  const variant = detectVariant(post.title);
  const sourceUrl = await scrapeImageUrl(post.url);
  if (!sourceUrl) {
    console.warn('[sunday-maple] 이미지 URL 못찾음:', post.url);
    return null;
  }

  const { url: uploadedUrl } = await downloadAndUpload(sourceUrl, weekStart);

  // 업로드 완료 후 DB insert (동시성 대비 findOrCreate)
  const [row] = await SundayMaple.findOrCreate({
    where: { week_start: weekStart },
    defaults: {
      week_start: weekStart,
      variant,
      event_post_id: String(post.notice_id || ''),
      event_post_url: post.url,
      source_image_url: sourceUrl,
      image_url: uploadedUrl,
    },
  });
  console.log('[sunday-maple] 저장 완료:', weekStart, variant, uploadedUrl);
  return row;
}
