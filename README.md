# 🍄 MapleStory Tools

메이플스토리 플레이에 필요한 계산기·체크리스트 도구 모음입니다.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker)

---

## ✨ 주요 기능

- 🔍 **캐릭터 조회** - NEXON Open API로 닉네임 검색 (월드/직업/레벨/캐릭터 이미지)
- 💎 **보스 결정석 계산기** - 보스/난이도별 주간 결정석 수익 정산 (캐릭터별 패널 관리)
- 🔮 **심볼 계산기** - 아케인/어센틱 심볼 레벨업에 필요한 심볼 수·메소 계산 (캐릭터별 관리)
- ⚔️ **해방 / 제네시스** - 제네시스 무기 해방 8단계(총 6,500) 진행도 추적, 주간 보스 스케줄러로 완료 예상 주차 산정
- 🎫 **제네시스 패스** - 패스 기간/배수 기반 활성 여부 및 정보 표시
- 🔨 **장비 강화 기록** - 스타포스·잠재능력 이력을 아이템별로 묶어 사용 메소·성공률·등급업 확률 분석 (전체 기간, 날짜별 영구 캐시)
- ⏱️ **야누스 알림** - 화면 공유로 퀵슬롯 아이콘의 설치를 감지해 지속시간이 끝나기 전에 알림 (PiP 미니바)
- 📰 **공지사항** - NEXON 공지/이벤트/업데이트/캐시샵 공지 연동 조회
- ☀️ **썬데이 메이플** - 금요일 기준 주차별 썬데이 메이플(노멀/스페셜) 자동 수집 (node-cron 스케줄링)
- 🛠️ **관리자** - 사이드바 레이아웃 기반 보스·심볼·시즌·이미지·메뉴 관리 (S3 업로드, sharp 이미지 처리)
- 📱 **디바이스 분기** - PC / 태블릿 / 모바일 레이아웃 자동 분기 (feature 자동 등록 시스템)

---

## 📁 프로젝트 구조

```
maplestory/
├── frontend/                 # React 19 + Vite 프론트엔드
│   └── src/
│       ├── features/         # 기능별 모듈 (자동 등록)
│       │   ├── boss-crystal/ # 보스 결정석 계산기
│       │   ├── symbol/       # 심볼 계산기
│       │   ├── liberation/   # 해방 / 제네시스 진행도 (+ 제네시스 패스 설정)
│       │   ├── enchant/      # 장비 강화 기록 (스타포스·잠재능력)
│       │   ├── janus/        # 야누스 알림 (화면 인식, 프론트 전용 — 백엔드 없음)
│       │   ├── admin/        # 관리자 화면 (사이드바 레이아웃 + 공용 UI 조각)
│       │   └── registry.js   # PC/태블릿/모바일 컴포넌트 자동 매핑
│       ├── pages/            # pc / tablet 페이지
│       ├── routes/           # pc / tablet / mobile 라우트
│       ├── components/       # 공용 UI 컴포넌트
│       ├── api/              # API 클라이언트
│       ├── hooks/            # 커스텀 훅
│       ├── stores/           # Zustand 스토어
│       └── utils/            # 헬퍼
├── backend/                  # Node.js + Express 5 백엔드
│   ├── routes/               # boss-crystal, symbol, character, notices, enchant,
│   │                         #   sunday-maple, genesis-pass, images, menus, admin
│   ├── models/               # Sequelize 모델 (Boss, Symbol, GenesisPass, Image,
│   │                         #   EnchantHistoryCache 등)
│   ├── services/             # 이미지 처리, 썬데이 메이플 수집/크론
│   ├── lib/                  # DB 연결, S3 클라이언트
│   ├── middleware/           # Express 미들웨어
│   └── server.js             # 엔트리포인트
└── docker-compose.yml        # Docker Compose 설정
```

---

## 🔨 장비 강화 기록

넥슨 Open API의 스타포스·큐브·잠재능력 재설정 이력을 **아이템(캐릭터 + 장비) 단위로 묶어** 보여줍니다.

- **전체 기간 조회** — 하루치 응답은 변하지 않으므로 날짜별로 DB에 영구 캐시(`enchant_history_cache`). 최초 1회만 API를 훑고 이후에는 즉시 로드
- **비용은 계산값** — API가 사용 메소를 주지 않아 공개된 공식으로 산출합니다. 이력에 담긴 이벤트 할인·파괴 방지·강화권만 반영하며, **MVP·PC방 할인이나 통찰력 감정 면제처럼 시점을 알 수 없는 할인은 제외**합니다
- **아이템 레벨 보강** — 스타포스 이력에는 `item_level`이 없어 계정 장비와 maplestory.io에서 이름→레벨 사전을 만들어 주입합니다

> API 제약: 이력 보존 기간 약 728일, 아이템 개체 식별자 없음(같은 캐릭터의 동명 장비는 한 항목으로 합산), 파괴 방지의 실제 발동 여부는 판별 불가

---

## ⏱️ 야누스 알림

메이플 창을 화면 공유로 받아 **퀵슬롯 야누스 아이콘이 어두워지는 순간(= 설치)만** 감지하고, 이후는 타이머로 셉니다. 서버로 아무것도 보내지 않는 프론트 전용 기능입니다.

### 왜 이렇게 만들었나

- **쿨타임은 보지 않습니다** — 지속시간(30렙 2분)이 쿨타임보다 길어 야누스가 사라지기 전에 이미 쿨이 돌아와 있습니다. 정작 필요한 알림은 "사라지기 전에 다시 깔아라"입니다
- **지속시간은 스킬 레벨에서** — 10레벨 단위 계단식(1~9렙 60초 / 10~19렙 70초 / 20~29렙 80초 / 30렙 120초). 야누스는 버프 지속시간 증가의 영향을 받지 않습니다
- **알림 시점은 초 단위 직접 입력** — 사냥터마다 젠 주기가 달라 고정 프리셋을 쓸 수 없습니다
- **알림은 `AudioContext` 예약** — `setTimeout`은 백그라운드 탭에서 1초 단위로 밀립니다. 이미 울리기 시작한 소리는 다음 사이클이 시작돼도 끊지 않습니다

### 오검출을 막는 장치들 (전부 실사용에서 드러난 것)

| 상황 | 왜 문제였나 | 어떻게 막았나 |
|---|---|---|
| 쿨타임 막바지 깜빡임 | 밝은 구간이 "쿨 종료"로 읽히고 이어지는 어두운 구간이 새 설치가 됨 | 밝아짐 확정을 2.2초로 (깜빡임 한 주기보다 길게) |
| 맵 이동 시 화면 암전 | 상호상관은 밝기에 불변이라 모양 검사를 통과 | 쿨타임 숫자(밝은 점)가 보일 때만 설치로 인정 + 주변까지 어두워지면 판단 보류 |
| 다른 UI에 가려짐 | 밝기만으로는 "어두워짐"과 구분 불가 | 지정한 아이콘 모양과의 상호상관이 기준 아래면 판단을 얼림 |

설치 시각은 **어두워지기 시작한 순간**으로 소급하고, `requestVideoFrameCallback`의 `captureTime`으로 화면 공유 지연을 실측해 보정합니다. 그래도 환경마다 남는 오차는 **타이머 보정** 설정으로 직접 맞춥니다.

### 아이콘 자동 탐색

화면 공유 권한은 기억되지 않아 매번 창을 다시 골라야 하는데, 아이콘까지 매번 집지 않도록 화면에서 자동으로 찾습니다.

- **밝기가 아니라 자주색 성분 `(R+B)/2 − G`로 찾습니다.** 퀵슬롯 아이콘 위에는 단축키 글자가 흰색·노란색으로 얹혀 밝기 분포를 망가뜨립니다. 실측하면 밝기로는 0.16~0.33(잡음 수준), 색 성분으로는 0.65~0.78이 나옵니다
- 640px로 줄인 화면에서 자리를 추린 뒤 **원본 해상도에서 다시 확인**하는 2단계
- 한 번 직접 지정하면 그 모양을 저장하고, 쿨타임 중의 모습도 따로 학습합니다
- 자동 선택 기준은 출처에 따라 다릅니다 — 저장된 모양이면 1등을 믿고, 내장 원본이면 압도적이지 않은 한 사람에게 묻습니다

### 소리

`src/features/janus/sounds/`에 파일을 넣고 다시 빌드하면 자동으로 목록에 뜹니다(코드 수정 불필요). 앞쪽 무음은 재생 시 자동으로 건너뜁니다.

> 브라우저 제약: 공유할 창을 **자동으로 고를 수 없고**(선택 UI는 브라우저가 그림), 공유 권한은 기억되지 않습니다. 게임 화면 위에 직접 오버레이를 그리는 것도 불가능해 미니 HUD는 Document PiP로 띄웁니다. 모바일은 화면 공유가 없어 PC 전용입니다.

---

## 🛠️ 기술 스택

### Frontend

| 분류 | 기술 |
|------|------|
| 프레임워크 | React 19 |
| 빌드 도구 | Vite 8 |
| 스타일링 | Tailwind CSS 4 |
| 상태 관리 | Zustand 5 |
| 서버 상태 | TanStack React Query 5 |
| 라우팅 | React Router 7 |
| 드래그앤드롭 | dnd-kit |
| 애니메이션 | Framer Motion 12 |
| 기타 | dayjs, OverlayScrollbars, react-device-detect |
| 테스트 | Vitest |

### Backend

| 분류 | 기술 |
|------|------|
| 런타임 | Node.js (ESM) |
| 프레임워크 | Express 5 |
| ORM | Sequelize 6 |
| DB | MariaDB / MySQL2 |
| 스토리지 | AWS S3 (`@aws-sdk/client-s3`) |
| 이미지 처리 | sharp |
| 업로드 | multer |
| 스케줄링 | node-cron |
| 외부 연동 | NEXON Open API (axios) |
| 기타 | dayjs, cors |

---

## 🚀 개발 & 실행

### Docker (운영)

```bash
docker compose up -d --build    # 빌드 및 시작
docker compose down             # 중지
docker compose logs -f          # 로그 확인
```

> `caddy`, `db`, `app` 외부 네트워크와 `.env`(DB·S3·NEXON_API_KEY 등) 설정이 필요합니다.

### Frontend

```bash
cd frontend
npm run dev        # 개발 서버 (Vite)
npm run build      # 프로덕션 빌드
npm run lint       # ESLint
npm run test       # Vitest
```

### Backend

```bash
cd backend
npm run dev        # 개발 서버 (--watch)
npm start          # 프로덕션 실행
```

---

## 📄 라이선스

MIT
