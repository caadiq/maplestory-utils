/**
 * 공용 모션 (fromis_9 에디토리얼 모션 이식 — 절제된 페이드업 계열)
 */
export const EASE = [0.22, 1, 0.36, 1]

/** 아래에서 올라오며 나타나는 기본 리빌 */
export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

/** 자식 스태거 컨테이너 (섹션들이 순차 등장) */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
