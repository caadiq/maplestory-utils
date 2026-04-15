export const SYMBOL_TABS = [
  { key: 'arcane', label: '아케인 심볼', imageName: '아케인심볼 : 소멸의 여로', maxLevel: 20 },
  { key: 'authentic', label: '어센틱 심볼', imageName: '어센틱심볼 : 세르니움', maxLevel: 11 },
  { key: 'grand', label: '그랜드 어센틱 심볼', imageName: '그랜드 어센틱심볼 : 탈라하트', maxLevel: 11 },
]

const BASE = 'https://s3.caadiq.co.kr/maplestory/symbol'

export const SYMBOLS = {
  arcane: [
    { key: 'yeoro', name: '소멸의 여로', image: `${BASE}/아케인심볼(소멸의 여로).webp` },
    { key: 'chuchu', name: '츄츄 아일랜드', image: `${BASE}/아케인심볼(츄츄 아일랜드).webp` },
    { key: 'lachelein', name: '레헬른', image: `${BASE}/아케인심볼(레헬른).webp` },
    { key: 'arcana', name: '아르카나', image: `${BASE}/아케인심볼(아르카나).webp` },
    { key: 'morass', name: '모라스', image: `${BASE}/아케인심볼(모라스).webp` },
    { key: 'esfera', name: '에스페라', image: `${BASE}/아케인심볼(에스페라).webp` },
  ],
  authentic: [
    { key: 'cernium', name: '세르니움', image: `${BASE}/어센틱심볼(세르니움).webp` },
    { key: 'arcs', name: '아르크스', image: `${BASE}/어센틱심볼(아르크스).webp` },
    { key: 'odium', name: '오디움', image: `${BASE}/어센틱심볼(오디움).webp` },
    { key: 'dowongyeong', name: '도원경', image: `${BASE}/어센틱심볼(도원경).webp` },
    { key: 'arteria', name: '아르테리아', image: `${BASE}/어센틱심볼(아르테리아).webp` },
    { key: 'carcion', name: '카르시온', image: `${BASE}/어센틱심볼(카르시온).webp` },
  ],
  grand: [
    { key: 'talahart', name: '탈라하트', image: `${BASE}/그랜드 어센틱심볼(탈라하트).webp` },
    { key: 'geardrock', name: '기어드락', image: `${BASE}/그랜드 어센틱심볼(기어드락).webp` },
  ],
}
