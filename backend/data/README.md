# 결정석 가격 데이터

- `crystal-prices-2026-09-17.json`: 패치 이전 가격 → 2026-09-17 본서버 확정 가격, 주간 보스 44행.
- `crystal-prices-2026-09-17-live-correction.json`: 테스트월드 가격을 이미 적용한 DB에 사용하는 보정표, 2행.
- `backup/bc-prices-2026-09-17-before-live-correction.json`: 본서버 보정 직전 DB 가격 백업.

공식 [9/10 테스트월드 1.2.206](https://maplestory.nexon.com/testworld/news/update/199)과 [9/17 본서버 1.2.419](https://maplestory.nexon.com/news/update/813)의 보스 리워드 표를 비교했습니다. 본서버에서는 노멀 카링이 576,000,000 → 593,000,000메소, 노멀 찬란한 흉성이 593,000,000 → 576,000,000메소로 변경되었습니다. 나머지 42행은 같습니다.

기존 스크립트의 가격 일치 검증을 유지합니다. 테스트월드 가격이 적용된 DB에는 보정표를 먼저 실행한 뒤, 전체 확정표를 확인합니다. 패치 이전 DB에는 전체 확정표를 바로 사용합니다. 이미 적용된 가격은 건너뛰므로 재실행할 수 있습니다.

```sh
node scripts/apply-crystal-prices.js data/crystal-prices-2026-09-17-live-correction.json
node scripts/apply-crystal-prices.js data/crystal-prices-2026-09-17-live-correction.json --apply
node scripts/apply-crystal-prices.js data/crystal-prices-2026-09-17.json
```

검은 마법사는 월간 보스여서 현재 주간 수익 계산기와 이 표에 포함되지 않습니다. 공식 공지의 검은 마법사 가격 변경은 **2026-10-01부터** 적용되므로 9/17 가격표에 추가하지 않습니다.

# 2026-09-17 콘텐츠·심볼 반영

공식 [1.2.419 업데이트](https://maplestory.nexon.com/news/update/813)를 기준으로 적용합니다.

- `exp-data.json`: 기어드락 몬스터파크(Lv.295), 아우룸 레기스(Lv.290), 기존 에픽던전 Lv.295–299 경험치 상향. 에픽 보상 단계는 기본 포함 1/5/9배입니다.
- 정확한 정수 경험치는 [기어드락 표](https://matsu1207.tistory.com/872), [아우룸 레기스 표](https://matsu1207.tistory.com/1343), [하루1소재 계산기](https://haru1sojae.kr/)의 9/17 갱신 데이터를 대조했습니다. 기존 던전은 패치 대상인 295–299만 변경했습니다.
- `mvpResort.hourly`: [메이플로드 잠수맵 계산기](https://mapleroad.kr/utils/afk)의 2026-09-17 기준, 버닝 미적용·MVP·1분 경험치 정수 응답 × 60. 200–299 전 구간을 조회했습니다. 기존 `sauna.hourly`는 VIP 사우나 전용으로 유지합니다. 2배속은 이용 시간도 2배 차감되므로 입력은 차감되는 시간 기준이며, 총 보상에 다시 2를 곱하지 않습니다.
- 업로드된 `지역 : 기어드락`, `에픽던전 : 아우름 레기스` 이미지를 사용합니다. 후자는 관리 화면에 등록된 이름을 그대로 조회하며 화면에는 공식 명칭 `아우룸 레기스`를 표시합니다.
- HEXA 주간 보상은 아우룸 레기스의 짙은 솔 에르다의 기운까지 환산하여 솔 에르다 2.5/12.5/22.5개, 조각 15개입니다.
- `arcane-costs-2026-09-17.json`: 아케인 6지역 × 19단계의 메소 비용 30% 인하. `backup/symbols-2026-09-17-before-discount.json`은 적용 전 공개 마스터 데이터이며 사용자 진행도는 포함하지 않습니다. 어센틱·그랜드 어센틱 비용과 요구 심볼 수는 변경하지 않습니다.

```sh
node scripts/apply-arcane-costs.js
node scripts/apply-arcane-costs.js --apply
node --test tests/patch-20260917.test.js
```

스크립트는 트랜잭션 안에서 기존 가격을 확인하고 잠근 뒤 반영하며, 불일치가 하나라도 있으면 전부 취소합니다. 재실행 시 적용된 행은 건너뜁니다.

API 호환성은 [넥슨 공식 API](https://openapi.nexon.com/ko/game/maplestory/?id=17)의 9/17 스키마를 확인했습니다. 펄스 인핸서는 메소·큐브 감정비에 합산하지 않으며, 같은 반지에 메소를 사용한 강화는 정상 계산합니다. 프라임 큐브는 기존 잠재/에디셔널 분류와 감정비 계산을 사용합니다.

훈련 일지는 9/23까지 효과가 유지되므로 9/17에 제거하지 않습니다. 새 이벤트 스킬은 이름 대신 API 효과 텍스트를 읽고, 동시에 적용되는 이벤트 심볼 보너스는 합산합니다. 실제 확인 계정은 9/17 아르고 효과가 빈 문자열(미강화)이었으며, 펄스/프라임 강화 이력은 없어서 해당 응답은 공식 스키마에 맞춘 회귀 테스트로 검증했습니다.
