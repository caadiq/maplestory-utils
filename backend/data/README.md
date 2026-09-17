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
