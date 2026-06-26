// 난이도 ENUM — 모델과 validation 에서 공용
export const DIFFICULTIES = ['easy', 'normal', 'hard', 'chaos', 'extreme'];

// 심볼 종류 ENUM — 모델과 validation 에서 공용
export const SYMBOL_TYPES = ['아케인', '어센틱', '그랜드 어센틱'];

// 파티 인원수 범위
export const PARTY_SIZE = { min: 1, max: 6 };

// 심볼 마스터 레벨 범위
export const SYMBOL_MASTER_LEVEL = { min: 2, max: 99 };

// 업로드 파일 크기 상한 (10MB)
export const UPLOAD_FILE_SIZE_LIMIT = 10 * 1024 * 1024;
