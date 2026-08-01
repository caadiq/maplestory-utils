# 야누스 알림 소리 파일

여기에 mp3(또는 ogg/wav)를 넣으면 알림 소리 목록에 추가할 수 있습니다.

## 넣는 방법

1. 파일을 이 폴더에 복사합니다. 파일명은 영문·숫자·하이픈만 쓰세요.
   (한글 파일명은 URL 인코딩 때문에 문제가 생길 수 있습니다)
2. `src/features/janus/alarm.js`의 `FILE_SOUNDS`에 한 줄 추가합니다.

   ```js
   { value: 'ding', label: '딩', file: 'ding.mp3' },
   ```

3. `docker compose up -d --build frontend`

## 고를 때

- **1~2초**가 적당합니다. 길면 다음 젠을 도는 동안 계속 울립니다.
- 시작하자마자 소리가 나야 합니다. 앞에 무음이 붙어 있으면
  그만큼 알림이 늦어지므로 잘라내고 넣으세요.

## 라이선스

넣는 파일의 라이선스를 직접 확인하세요.
[Pixabay](https://pixabay.com/sound-effects/)는 Pixabay License로
상업적 사용과 수정이 가능하고 출처 표기도 필요 없어서 쓰기 좋습니다.
다른 사이트에서 받은 효과음은 출처가 불분명한 경우가 많으니 주의하세요.
