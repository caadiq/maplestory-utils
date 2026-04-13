/**
 * 기능 자동 등록 시스템
 *
 * - features/{kebab-case}/{PascalCase}.jsx : 사용자 페이지
 * - features/{kebab-case}/{PascalCase}Admin.jsx : 관리자 페이지
 *
 * 예시:
 *   /boss-crystal      → features/boss-crystal/BossCrystal.jsx
 *   /admin/boss-crystal → features/boss-crystal/BossCrystalAdmin.jsx
 */

import { lazy } from 'react'

// Vite의 import.meta.glob으로 features 폴더 전체를 스캔
const userPages = import.meta.glob('./*/*.jsx')

function slugToPascal(slug) {
  return slug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

/**
 * slug에 해당하는 사용자 페이지 컴포넌트 반환
 * @returns {React.LazyExoticComponent | null}
 */
export function getUserComponent(slug) {
  const pascal = slugToPascal(slug)
  const path = `./${slug}/${pascal}.jsx`
  const loader = userPages[path]
  if (!loader) return null
  return lazy(loader)
}

/**
 * slug에 해당하는 관리자 페이지 컴포넌트 반환
 */
export function getAdminComponent(slug) {
  const pascal = slugToPascal(slug)
  const path = `./${slug}/${pascal}Admin.jsx`
  const loader = userPages[path]
  if (!loader) return null
  return lazy(loader)
}

/**
 * slug에 해당하는 관리자 페이지가 존재하는지
 */
export function hasAdminPage(slug) {
  if (!slug) return false
  const cleaned = slug.replace(/^\/+/, '').split('/')[0]
  const pascal = slugToPascal(cleaned)
  return !!userPages[`./${cleaned}/${pascal}Admin.jsx`]
}
