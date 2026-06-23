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
- 📰 **공지사항** - NEXON 공지/이벤트/업데이트/캐시샵 공지 연동 조회
- ☀️ **썬데이 메이플** - 금요일 기준 주차별 썬데이 메이플(노멀/스페셜) 자동 수집 (node-cron 스케줄링)
- 🛠️ **관리자** - 보스·심볼·제네시스 패스·메뉴·이미지 관리 (S3 업로드, sharp 이미지 처리)
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
│       │   ├── liberation/   # 해방 / 제네시스 진행도
│       │   ├── genesis-pass/ # 제네시스 패스
│       │   ├── admin/        # 관리자 화면
│       │   └── registry.js   # PC/태블릿/모바일 컴포넌트 자동 매핑
│       ├── pages/            # pc / tablet 페이지
│       ├── routes/           # pc / tablet / mobile 라우트
│       ├── components/       # 공용 UI 컴포넌트
│       ├── api/              # API 클라이언트
│       ├── hooks/            # 커스텀 훅
│       ├── stores/           # Zustand 스토어
│       └── utils/            # 헬퍼
├── backend/                  # Node.js + Express 5 백엔드
│   ├── routes/               # boss-crystal, symbol, character, notices,
│   │                         #   sunday-maple, genesis-pass, images, menus, admin
│   ├── models/               # Sequelize 모델 (Boss, Symbol, GenesisPass, Image 등)
│   ├── services/             # 이미지 처리, 썬데이 메이플 수집/크론
│   ├── lib/                  # DB 연결, S3 클라이언트
│   ├── middleware/           # Express 미들웨어
│   └── server.js             # 엔트리포인트
└── docker-compose.yml        # Docker Compose 설정
```

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
