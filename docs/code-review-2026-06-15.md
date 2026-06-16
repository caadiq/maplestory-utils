# maplestory 코드 검토 보고서

작성일: 2026-06-15
대상: `/docker/maplestory` (backend ~1.8K LOC, frontend ~9.4K LOC)
범위: Node.js/Express 백엔드, React 프론트엔드 전체 (node_modules 제외)

개인 운영 도구치고 전반적으로 잘 구조화된 코드입니다. 아래는 심각도순으로 정리한 개선 항목입니다.

---

## 🔴 높음 — 실제 버그 / 보안

### B1. 보스 이름 변경 시 S3 키와 DB 경로 어긋남 → 이미지 깨짐
- **위치**: `backend/routes/admin/boss-crystal.js:166-169`
- **문제**: 이미지 재업로드 없이 이름만 변경하면 `newImagePath = bossImagePath(newName)`로 DB의 `image_path`를 새 경로로 바꾸지만, 실제 S3 객체는 옛 경로에 그대로 남아 있음. 다음 이미지 업로드 전까지 `getPublicUrl(image_path)`가 존재하지 않는 객체를 가리켜 공개 목록(`backend/routes/boss-crystal.js:19`)에서 이미지가 깨짐.
- **개선안**: 이름 변경 시 S3 객체를 copy/rename 하거나, 이미지가 함께 업로드되지 않으면 `image_path`를 변경하지 않도록 수정.

### B2. 관리자 인증 키 = Nexon API 키 재사용 + 타이밍 비교
- **위치**: `backend/routes/admin.js:21,30`
- **문제**: 관리자 인증 키(`x-admin-key`)와 검증(`/verify`)이 모두 `process.env.NEXON_API_KEY`를 비교. 외부 Nexon Open API 호출용 키가 곧 사이트 관리자 비밀번호. 이 키는 `routes/character.js`, `routes/notices.js`, `services/sundayMaple.js` 등 다수 위치에서 서버→Nexon 요청 헤더로도 쓰임. 또한 `key !== process.env.NEXON_API_KEY` 단순 비교는 타이밍 공격에 노출.
- **개선안**: 별도 `ADMIN_KEY` 환경변수로 관리자 인증과 외부 API 키 분리. 검증에는 `crypto.timingSafeEqual` 사용(길이 불일치 처리 포함).

### F1. persist 구버전 데이터로 렌더 크래시 (옵셔널 체이닝 누락)
- **위치**: `frontend/src/features/liberation/pc/components/QuestSelector.jsx:22,41,47`, `WeeklyDefault.jsx:20,149`
- **문제**: `const selected = chapters[value]` 후 `selected.boss`를 옵셔널 체이닝 없이 접근. `startChapter`는 persist 스토어 값이라 데이터 챕터 수가 줄면 `selected`가 undefined → 전체 트리 크래시. `WeeklyDefault`의 `sel.difficulty`도 persist된 옛 `weekly.bosses`에 신규 보스 key가 없을 때 undefined 접근.
- **개선안**: `chapters[value] ?? chapters[0]`, `sel ?? { difficulty:'none', party:1, done:false }` 폴백. 또는 store `migrate`에서 보강.

### F2. `useQueries` 결과를 인덱스로 store와 매칭 (race / stale)
- **위치**: `frontend/src/features/symbol/pc/Symbol.jsx:51-75,89-114`, `frontend/src/features/boss-crystal/pc/BossCrystal.jsx:46-61`
- **문제**: `characters.forEach((c, idx) => basicQueries[idx]?.data)`로 인덱스 매칭. 캐릭터 추가/삭제 시 한 렌더 사이클 동안 `characters`(새 길이)와 직전 `basicQueries`(옛 길이)가 어긋나 잘못된 캐릭터에 데이터 반영 위험. 의존성을 `[basicQueries.map(q=>q.dataUpdatedAt).join(',')]`로 우회 + `eslint-disable exhaustive-deps` → stale closure 위험.
- **개선안**: 인덱스가 아닌 `data.character_name === c.character_name`로 매칭. 데이터 반영을 React Query `select`/`onSuccess`로 옮겨 effect 의존성 문제 제거.

---

## 🟡 중간 — 정합성 / 안정성

### B3. 고아 S3 객체 발생 (업로드가 트랜잭션 밖)
- **위치**: `backend/routes/admin.js:121-142`, `backend/routes/admin/boss-crystal.js:107-126`, `backend/routes/admin/symbol.js:119`
- **문제**: 이미지 업로드 후 DB 트랜잭션이 실패하거나, 다중 이미지 업로드 시 사전 중복 체크(`admin.js:121`)와 `Image.create`(`admin.js:142`) 사이에 동일 이름 동시 요청이 들어와 unique 충돌하면 이미 S3에 올린 객체가 고아로 남음.
- **개선안**: 트랜잭션 실패/unique 충돌 시 방금 업로드한 객체를 `safeDelete`하는 보정 로직 추가.

### F3. Error Boundary 전무
- **위치**: `frontend/src/App.jsx`, `routes/pc.jsx`, `features/FeaturePage.jsx:14`(Suspense만), `features/admin/pc/AdminFeaturePage.jsx`
- **문제**: F1 같은 크래시 발생 시 전체 화면 백지화. lazy 청크 로드 실패도 미처리.
- **개선안**: 최소한 `FeaturePage`/`AdminFeaturePage`의 Suspense를 ErrorBoundary로 감싸 폴백 제공.

### F4. AdminImages 페이지 간 다중 선택 삭제 누락
- **위치**: `frontend/src/features/admin/pc/AdminImages.jsx:97-111`
- **문제**: `selectedIds`는 페이지 전환 후에도 유지되지만 `requestDelete`는 현재 페이지 `images.filter(...)`만 대상. 다른 페이지에서 선택한 항목이 삭제에서 누락.
- **개선안**: 페이지 변경 시 선택 초기화하거나, 선택 항목 메타(id, name)를 별도 Map에 누적.

### F5. setTimeout cleanup 누락
- **위치**: `frontend/src/features/admin/pc/AdminImages.jsx:124-128`(copyUrl 1.5s), `frontend/src/features/genesis-pass/pc/GenesisPassAdmin.jsx:48`(saved 2s)
- **문제**: 연속 클릭 시 타이머 누적, 언마운트 시 미정리.
- **개선안**: ref에 타이머 id 저장 후 새 호출/언마운트 시 `clearTimeout`.

### F6. 무거운 계산 메모이제이션 누락
- **위치**: `frontend/src/features/liberation/pc/Genesis.jsx:101`, `Destiny.jsx:61`
- **문제**: `computeCompletionDate`의 `useMemo` 의존성이 `state` 전체. Zustand가 매 업데이트마다 새 객체를 만들어 보스 하나만 바꿔도 최대 520주+120개월 계산 재실행. 실제 필요 의존성은 `state.startDate`, `state.schedulerWeeks`뿐. `Genesis.jsx:70-91`의 `headerWeekly`/`headerMonthly` dayjs 연산도 메모 없이 매 렌더 수행.
- **기타 메모이제이션**: `AdminImages.jsx:51`(`new Set` 매 렌더 재생성), `components/pc/NoticeWidget/index.jsx:17-24`(reduce+필터 매 렌더), `boss-crystal/pc/user/CharacterPanel.jsx:21,234`(`bosses.find` 선형 탐색 반복 + `CharacterItem` memo 미적용).

### S1. admin 키 localStorage 평문 저장
- **위치**: `frontend/src/stores/auth.js:4-11`, `api/client.js:7-10`, `components/pc/Layout.jsx:153`, `features/admin/pc/AdminLayout.jsx:12`
- **문제**: zustand `persist`(localStorage `maple-auth`)에 admin 키 평문 저장 → XSS 시 탈취 가능. verify queryKey `['admin','verify', apiKey]`에 키 평문 포함 → React Query 캐시/Devtools 노출. 헤더(`x-admin-key`)와 바디(`body:{key}`) 방식 혼재.
- **개선안**: 가능하면 httpOnly 쿠키 세션으로 전환(이미 `credentials:'include'` 사용 중). 단일 운영자용이라 위험도는 제한적이나 구조적 약점. verify도 헤더 방식으로 통일.

### Q1. 중복 로직
- `serialize` 함수: 공개 vs 관리자 라우트 중복 (`routes/menus.js:7`↔`admin.js:182`, `routes/symbol.js:13`↔`admin/symbol.js:21`, `routes/boss-crystal.js:14`↔`admin/boss-crystal.js:18`)
- `VALID_TYPES` ENUM 중복 (`admin/symbol.js:15`↔`models/symbol/Symbol.js:6`) → `constants.js`로 추출
- 프론트: `Genesis.jsx`↔`Destiny.jsx` cascade 계산/모드 탭/리셋 다이얼로그, `Symbol.jsx:150-193`↔`SymbolCard.jsx:37-70` 성장치→레벨 while 루프, `ImagePicker.jsx`↔`AdminImages.jsx` 디바운스+페이지네이션 → 공용 유틸/훅 추출

---

## 🟢 낮음 — 코드 품질 / 접근성

- **동적 import**: `backend/routes/admin.js:65` `await import('sequelize')`를 핸들러마다 호출 → 상단 정적 import로 변경
- **죽은 코드**: `backend/services/image.js:29-31` `deleteFromS3` 미사용, `frontend/.../ProgressBar.jsx:21` `filled > 0 ? 'active' : 'active'` 양쪽 동일
- **전역 에러 핸들러 부재**: `backend/server.js`에 Express 에러 미들웨어 없음 → multer `LIMIT_FILE_SIZE` 등이 스택 트레이스 노출 가능
- **FLOAT multiplier**: `models/genesis-pass/GenesisPass.js:9` 부동소수점 오차 → `DECIMAL` 권장
- **접근성**: 클릭 가능 `div`에 role/tabIndex/키보드 핸들러 부재 (`symbol/.../CharacterCard.jsx:5`, `boss-crystal/.../CharacterPanel.jsx:153`, `admin/.../ImageCard.jsx:5`), 난이도 버튼 `tabIndex={-1}`+onClick blur (`BossSelector.jsx:127`), 커스텀 드롭다운 ARIA 부재, 검색 input label/aria-label 없음
- **안내 문구 오류**: `components/common/LoginDialog.jsx:121` "키는 서버로 전송되지 않습니다"라고 표시하나 실제로는 검증 위해 `:32`에서 `x-user-api-key` 헤더로 전송
- **BossForm 삭제 다이얼로그 미닫힘**: `boss-crystal/.../BossForm.jsx:355` `setConfirmDelete(false)` 미호출 (SymbolForm은 닫음 — 패턴 불일치)
- **캐릭터 식별자 불일치**: `symbol/store.js`는 `id`(ocid), `boss-crystal/store.js`는 `character_name`으로 키잉 → 닉네임 변경/동명에 취약
- **React Query staleTime 불일치**: 사용자 쿼리는 5분, admin/boss-crystal 목록은 미설정(기본 0) → 마운트/포커스마다 refetch
- **reorder 루프**: 정렬 변경이 행 수만큼 개별 UPDATE (`admin.js:299`, `boss-crystal.js:220`, `symbol.js:228`) → `CASE WHEN` 벌크 UPDATE 가능 (항목 적어 영향 작음)

---

## 양호하게 구현된 부분 (비-이슈로 확인)

- `GlobalTooltip.jsx`, `DatePicker.jsx`, `QuestSelector.jsx`의 이벤트 리스너/타이머 cleanup 정확 — 메모리 누수 없음
- `hooks/useSmoothSticky.js` callback ref 패턴이 RAF/리스너/ResizeObserver 모두 정리 + `el.isConnected` 가드 포함 — 견고
- 전 범위 `dangerouslySetInnerHTML` 미사용 — XSS 표면 없음. 외부 링크 `rel="noopener noreferrer"` 일관 적용
- `main.jsx` React Query 기본 설정(`staleTime 30s`, `refetchOnWindowFocus:false`, `retry:1`) 합리적

---

## 우선 수정 권장 (영향 대비 비용)

1. **B1** 보스 이름 변경 시 이미지 깨짐 (사용자 직접 마주침)
2. **F1** liberation persist 데이터 옵셔널 체이닝 (크래시 방지)
3. **F2** `Symbol.jsx`/`BossCrystal.jsx` 인덱스 → name 매칭 (데이터 정합성)
4. **B2** 관리자 키 ↔ Nexon API 키 분리
5. **F3** Error Boundary 도입 (위 크래시 안전망)
6. **B3 / F4 / F5** 고아 S3 객체 보정, AdminImages 삭제 누락, setTimeout cleanup
