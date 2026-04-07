# 메이플스토리 도우미 (maple.caadiq.co.kr) - 최종 계획서

> 첫 번째 기능: 주간 보스 수익 계산기. 추후 다른 기능 확장 가능.

## 1. 프로젝트 개요

넥슨 OAuth 로그인으로 내 캐릭터 목록을 자동으로 불러온 뒤, 각 캐릭터별로 클리어 가능한 주간 보스를 선택하면 **주간 결정석 수익(메소)**을 자동 계산해주는 웹 애플리케이션.

## 2. 기술 스택

| 구분 | 기술 | 선택 이유 |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS | 기존 레포 프로젝트들과 동일 스택 |
| Backend | Express (Node.js) | OAuth 토큰 관리, API 프록시 |
| DB | MariaDB | 기존 인프라 활용 (`db` 네트워크) |
| ORM | Sequelize | 기존 mailbox 프로젝트와 동일 |
| 세션 | express-session + Redis | 토큰 서버사이드 관리 |
| 배포 | Docker Compose + Caddy | 기존 인프라와 일관성 |

## 3. 넥슨 OAuth 2.0 인증 흐름

### 3.1 사전 준비

1. [openapi.nexon.com](https://openapi.nexon.com) 에서 Friends Application 등록
2. 플랫폼: Web, Redirect URI 설정 (예: `https://maple.caadiq.co.kr/api/auth/callback`)
3. 활용 데이터 항목: `maplestory.characterlist` 선택
4. Client ID, Client Secret 발급

### 3.2 인증 흐름

```
[프론트엔드]                    [백엔드]                     [넥슨]
     │                            │                           │
     │  1. 로그인 버튼 클릭         │                           │
     │ ──────────────────────────> │                           │
     │                            │  2. state 생성 + 세션 저장   │
     │  3. 넥슨 로그인 페이지 리다이렉트                          │
     │ ─────────────────────────────────────────────────────> │
     │                            │                           │
     │                            │  4. redirect_uri?code=XXX  │
     │                            │ <───────────────────────── │
     │                            │                           │
     │                            │  5. POST /oauth2/token     │
     │                            │    (code + client_secret)  │
     │                            │ ────────────────────────> │
     │                            │                           │
     │                            │  6. access_token 응답       │
     │                            │ <───────────────────────── │
     │                            │                           │
     │                            │  7. 토큰을 세션에 저장       │
     │  8. 로그인 완료 리다이렉트    │                           │
     │ <────────────────────────── │                           │
```

### 3.3 OAuth 엔드포인트 정리

| 용도 | Method | URL |
|---|---|---|
| 인가 코드 발급 | GET | `https://openid.nexon.com/oauth2/authorize` |
| 토큰 발급 | POST | `https://openid.nexon.com/oauth2/token` |
| 토큰 갱신 | POST | `https://openid.nexon.com/oauth2/token` (grant_type=refresh_token) |
| 사용자 정보 | GET | `https://openid.nexon.com/api/v1/user/info` |

### 3.4 인가 코드 요청 파라미터

| 파라미터 | 값 |
|---|---|
| response_type | `code` |
| client_id | 발급받은 Client ID |
| redirect_uri | `https://{도메인}/api/auth/callback` |
| scope | `maplestory.characterlist` |
| state | CSRF 방지용 랜덤 문자열 |

### 3.5 토큰 정보

| 토큰 | 유효기간 | 용도 |
|---|---|---|
| access_token | 30분 | API 호출 시 `Authorization: Bearer {token}` |
| refresh_token | 14일 | access_token 만료 시 갱신 |

### 3.6 보안 요구사항

- `client_secret`은 백엔드에서만 관리, 프론트엔드 노출 금지
- `access_token`은 서버 세션(Redis)에 저장, 클라이언트에 노출 금지
- `state` 파라미터로 CSRF 공격 방지
- 모든 통신 HTTPS 필수

## 4. 넥슨 API 활용

### 4.1 캐릭터 목록 조회 (OAuth 필요)

```
GET https://open.api.nexon.com/maplestory/v1/character/list
Authorization: Bearer {access_token}
```

### 4.2 캐릭터 상세 조회 (API 키 사용)

```
GET https://open.api.nexon.com/maplestory/v1/id?character_name={name}
→ ocid 획득

GET https://open.api.nexon.com/maplestory/v1/character/basic?ocid={ocid}
→ 레벨, 직업, 월드, 캐릭터 이미지
```

> 캐릭터 목록은 OAuth, 상세 정보는 API 키로 조회하는 하이브리드 방식.

## 5. DB 스키마

### `bosses` - 보스 기본 정보

```sql
CREATE TABLE bosses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  sort_order INT DEFAULT 0,
  image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### `boss_difficulties` - 보스 난이도별 정보

```sql
CREATE TABLE boss_difficulties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  boss_id INT NOT NULL,
  difficulty ENUM('easy','normal','hard','chaos','extreme') NOT NULL,
  crystal_price BIGINT NOT NULL,
  required_level INT DEFAULT 0,
  default_party_size TINYINT DEFAULT 1,
  FOREIGN KEY (boss_id) REFERENCES bosses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_boss_diff (boss_id, difficulty)
);
```

### `users` - 로그인 사용자

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nexon_uid VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### `user_characters` - 사용자 캐릭터 목록 (캐시)

```sql
CREATE TABLE user_characters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  character_name VARCHAR(50) NOT NULL,
  ocid VARCHAR(100),
  world_name VARCHAR(20),
  job_name VARCHAR(50),
  character_level INT,
  character_image VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_char (user_id, character_name)
);
```

### `user_boss_selections` - 캐릭터별 보스 선택

```sql
CREATE TABLE user_boss_selections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_character_id INT NOT NULL,
  boss_difficulty_id INT NOT NULL,
  party_size TINYINT NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_character_id) REFERENCES user_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (boss_difficulty_id) REFERENCES boss_difficulties(id) ON DELETE CASCADE,
  UNIQUE KEY uq_selection (user_character_id, boss_difficulty_id)
);
```

## 6. 수익 계산 로직

### 6.1 제한 조건

| 제한 | 값 |
|---|---|
| 캐릭터당 결정석 | 최대 **12개**/주 |
| 계정 전체 결정석 | 최대 **90개**/주 |

### 6.2 계산 알고리즘

```
입력: 각 캐릭터별 선택된 보스 목록 + 파티 인원

1. 각 보스의 실수익 계산: crystal_price ÷ party_size
2. 캐릭터별로 실수익 내림차순 정렬
3. 캐릭터별 상위 12개만 유효 (캐릭터 한도 적용)
4. 모든 캐릭터의 유효 결정석을 실수익 기준으로 병합 정렬
5. 상위 90개 선택 (계정 한도 적용)
6. 선택된 결정석의 실수익 합산 = 주간 총 수익

부가 정보:
- 캐릭터별 수익 소계
- 한도 초과로 제외된 결정석 표시
- 수익 극대화를 위한 추천 (낮은 수익 보스 → 제외 제안)
```

### 6.3 예시

```
캐릭터A: 검마하드(500M÷6=83M), 스우하드(256M÷6=42M), ... → 12개 선택
캐릭터B: 루시드하드(175M÷6=29M), 윌하드(140M÷6=23M), ... → 10개 선택
캐릭터C: 노말자쿰(10M÷1=10M), ... → 8개 선택

합계: 30/90개, 총 수익: 약 2,400,000,000 메소
```

## 7. API 엔드포인트 설계

### 7.1 인증

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/auth/login` | 넥슨 OAuth 로그인 리다이렉트 |
| GET | `/api/auth/callback` | OAuth 콜백 (토큰 교환) |
| POST | `/api/auth/logout` | 로그아웃 (세션 삭제) |
| GET | `/api/auth/me` | 현재 로그인 상태 확인 |

### 7.2 캐릭터

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/characters` | 내 캐릭터 목록 (넥슨 API → DB 캐시) |
| POST | `/api/characters/refresh` | 캐릭터 목록 갱신 |

### 7.3 보스

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/bosses` | 보스 목록 + 난이도별 결정석 가격 |

### 7.4 보스 선택 & 계산

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/selections` | 내 캐릭터별 보스 선택 현황 |
| PUT | `/api/selections/:characterId` | 캐릭터별 보스 선택 저장 |
| GET | `/api/calculate` | 주간 수익 계산 결과 |

## 8. 프로젝트 구조

```
maplestory/
├── docker-compose.yml
├── .env                                # DB, Redis, OAuth, S3 설정
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       │   ├── Layout.jsx              # 공통 레이아웃 (네비게이션 포함)
│       │   └── LoginButton.jsx         # 넥슨 로그인 버튼
│       ├── features/
│       │   └── boss/                   # 보스 수익 계산기 기능
│       │       ├── components/
│       │       │   ├── CharacterList.jsx       # 캐릭터 목록 (카드형)
│       │       │   ├── CharacterCard.jsx       # 캐릭터 정보 카드
│       │       │   ├── BossSelector.jsx        # 캐릭터별 보스 선택 체크리스트
│       │       │   ├── PartySize.jsx           # 파티 인원 입력
│       │       │   └── RevenueSummary.jsx      # 수익 요약 대시보드
│       │       ├── hooks/
│       │       │   ├── useBosses.js            # 보스 데이터 조회
│       │       │   └── useCalculator.js        # 수익 계산
│       │       ├── utils/
│       │       │   └── calculator.js           # 수익 계산 로직 (12개/90개 제한)
│       │       └── BossPage.jsx                # 보스 계산기 페이지
│       ├── hooks/
│       │   ├── useAuth.js              # 로그인 상태 관리
│       │   └── useCharacters.js        # 캐릭터 목록 조회
│       ├── api/
│       │   └── client.js               # API 클라이언트 (fetch wrapper)
│       └── pages/
│           └── Home.jsx                # 홈 (기능 목록)
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js                       # Express 엔트리포인트
│   ├── lib/
│   │   ├── db.js                       # Sequelize 연결
│   │   └── redis.js                    # Redis 연결
│   ├── middleware/
│   │   ├── auth.js                     # 세션 인증 미들웨어
│   │   └── session.js                  # express-session + Redis 설정
│   ├── routes/
│   │   ├── auth.js                     # OAuth 로그인/콜백/로그아웃
│   │   ├── characters.js              # 캐릭터 목록 조회/갱신
│   │   └── boss/                       # 보스 관련 라우트
│   │       ├── bosses.js               # 보스 데이터 조회
│   │       ├── selections.js           # 보스 선택 저장/조회
│   │       └── calculate.js            # 수익 계산
│   ├── models/
│   │   ├── index.js                    # Sequelize 모델 연결
│   │   ├── User.js
│   │   ├── UserCharacter.js
│   │   └── boss/                       # 보스 관련 모델
│   │       ├── Boss.js
│   │       ├── BossDifficulty.js
│   │       └── UserBossSelection.js
│   ├── services/
│   │   ├── nexon.js                    # 넥슨 API 호출 서비스
│   │   └── boss/
│   │       └── calculator.js           # 수익 계산 서비스
│   └── seeders/
│       └── boss-data.js                # 초기 보스 + 결정석 데이터 시드
│
└── scripts/
    └── upload-boss-images.js           # 보스 이미지 RustFS 업로드 스크립트
```

## 9. 보스 이미지

### 추출 경로 (WzComparerR2)

### 추출 경로 (WzComparerR2)

```
UI.wz > UIBoss.img
```

초상화+배경+텍스트가 하나로 합쳐진 통합 이미지 사용.

### 저장 위치

기존 RustFS(S3 호환 스토리지)에 저장:

```
버킷: maplestory
경로: boss/images/{boss-slug}.png

예시:
  s3://maplestory/boss/images/black-mage.png
  s3://maplestory/boss/images/seren.png
  s3://maplestory/boss/images/lucid.png
```

- 내부 접근: `http://rustfs:9000/maplestory/boss/images/...`
- 외부 URL: `https://s3.caadiq.co.kr/maplestory/boss/images/...`
- DB `bosses.image_url` 컬럼에 `boss/images/{slug}.png` 경로 저장
- 프론트엔드에서 `S3_PUBLIC_URL + image_url`로 이미지 표시
- `scripts/upload-boss-images.js`로 로컬 PNG → RustFS 일괄 업로드

## 10. UI 화면 구성

```
┌─────────────────────────────────────────────────────┐
│  메이플스토리 주간 보스 수익 계산기                       │
│                                [넥슨 로그인] / [로그아웃] │
├─────────────────────────────────────────────────────┤
│                                                      │
│  내 캐릭터                                  [새로고침]  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ [캐릭IMG] │ │ [캐릭IMG] │ │ [캐릭IMG] │              │
│  │ Lv.285   │ │ Lv.275   │ │ Lv.260   │              │
│  │ 아크메이지│ │ 나이트로드│ │ 아델      │              │
│  │ 4/12개   │ │ 6/12개   │ │ 0/12개   │              │
│  │ [선택]   │ │ [선택]   │ │ [선택]   │              │
│  └──────────┘ └──────────┘ └──────────┘              │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  아크메이지 (리부트) - 보스 선택         4/12개 사용중   │
│  ┌───────────────────────────────────────────────┐   │
│  │ ☑ [IMG] 검은 마법사 하드   500,000,000  ÷[6]  │   │
│  │ ☑ [IMG] 스우 하드         256,000,000  ÷[6]  │   │
│  │ ☑ [IMG] 루시드 하드       175,000,000  ÷[6]  │   │
│  │ ☑ [IMG] 윌 하드          140,000,000  ÷[6]  │   │
│  │ ☐ [IMG] 가엔슬 노말       42,000,000  ÷[1]  │   │
│  │ ☐ [IMG] 듄켈 하드         70,000,000  ÷[6]  │   │
│  │ ...                                           │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  주간 수익 요약                                       │
│  ┌───────────────────────────────────────────────┐   │
│  │ 캐릭터        결정석    수익                    │   │
│  │ ─────────────────────────────────────────────  │   │
│  │ 아크메이지     12/12    1,200,000,000 메소     │   │
│  │ 나이트로드     10/12      800,000,000 메소     │   │
│  │ 아델           8/12      400,000,000 메소     │   │
│  │ ─────────────────────────────────────────────  │   │
│  │ 합계          30/90    2,400,000,000 메소     │   │
│  │                                               │   │
│  │ ⚠ 수익 최적화 팁:                              │   │
│  │ 아델의 자쿰(10M)을 제외하면 다른 캐릭터에서       │   │
│  │ 더 높은 수익 보스를 추가할 수 있습니다.            │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## 11. Docker Compose 구성

```yaml
services:
  frontend:
    build: ./frontend
    labels:
      - "com.centurylinklabs.watchtower.enable=false"
    networks:
      - caddy

  backend:
    build: ./backend
    env_file: .env
    depends_on:
      - redis
    labels:
      - "com.centurylinklabs.watchtower.enable=false"
    networks:
      - caddy
      - db
      - app

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    networks:
      - app

volumes:
  redis-data:

networks:
  caddy:
    external: true
  db:
    external: true
  app:
    external: true
```

## 12. 환경 변수 (.env)

```env
# DB (기존 MariaDB 활용)
DB_HOST=mariadb
DB_PORT=3306
DB_USER=maplestory
DB_PASSWORD=
DB_NAME=maplestory

# Redis (세션 저장)
REDIS_HOST=redis
REDIS_PORT=6379

# RustFS (S3 호환 스토리지)
S3_ENDPOINT=http://rustfs:9000
S3_PUBLIC_URL=https://s3.caadiq.co.kr
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=maplestory

# 넥슨 OAuth
NEXON_CLIENT_ID=
NEXON_CLIENT_SECRET=
NEXON_REDIRECT_URI=https://maple.caadiq.co.kr/api/auth/callback

# 넥슨 API (캐릭터 상세 조회용)
NEXON_API_KEY=

# 세션
SESSION_SECRET=

# 앱
NODE_ENV=production
PORT=3000
```

## 13. 구현 단계

| 단계 | 내용 | 상세 |
|---|---|---|
| **1** | 프로젝트 초기 설정 | Vite + Express 스캐폴딩, Docker, MariaDB/Redis 연결 |
| **2** | DB 스키마 + 시드 | 테이블 생성, 전체 주간 보스 결정석 데이터 시딩 |
| **3** | 넥슨 OAuth 구현 | 로그인/콜백/로그아웃, 세션 관리 |
| **4** | 캐릭터 목록 연동 | OAuth 토큰으로 캐릭터 목록 조회 + ocid로 상세 조회 |
| **5** | 보스 목록 UI | 보스 데이터 API + 프론트엔드 보스 목록 표시 |
| **6** | 캐릭터별 보스 선택 | 체크박스 UI, 파티 인원 설정, 선택 저장 |
| **7** | 수익 계산 엔진 | 12개/90개 제한 적용, 최적 조합 계산, 요약 대시보드 |
| **8** | 보스 이미지 적용 | WZ 추출 이미지 적용 |
| **9** | Docker 배포 | Dockerfile, docker-compose, Caddy 리버스 프록시 |

## 14. 고려사항

- **Friends 앱 등록**: 넥슨 Open API에서 Friends Application 등록 및 검수 필요 (초기 테스트 단계에서는 5명까지 사용 가능)
- **결정석 가격 업데이트**: 패치 시 DB의 `boss_difficulties` 테이블만 업데이트
- **토큰 갱신**: access_token 만료(30분) 시 refresh_token으로 자동 갱신 미들웨어 구현
- **데이터 갱신 의무**: 넥슨 정책상 30일 내 데이터 갱신 필요
- **보스 이미지 저작권**: 넥슨 게임 리소스 사용 시 저작권 고려 필요
