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

// 컴포넌트 캐시 - 동일 slug에 대해 항상 같은 컴포넌트 인스턴스 반환
// (매 렌더마다 새 lazy() 생성하면 React가 unmount/remount하면서 화면 갱신이 깨짐)
const userCache = new Map()
const adminCache = new Map()

function loadCached(cache, slug, suffix) {
  if (cache.has(slug)) return cache.get(slug)
  const pascal = slugToPascal(slug)
  const path = `./${slug}/${pascal}${suffix}.jsx`
  const loader = userPages[path]
  const component = loader ? lazy(loader) : null
  cache.set(slug, component)
  return component
}

/**
 * slug에 해당하는 사용자 페이지 컴포넌트 반환
 */
export function getUserComponent(slug) {
  return loadCached(userCache, slug, '')
}

/**
 * slug에 해당하는 관리자 페이지 컴포넌트 반환
 */
export function getAdminComponent(slug) {
  return loadCached(adminCache, slug, 'Admin')
}

/**
 * slug에 해당하는 관리자 페이지가 존재하는지
 */
export function hasAdminPage(slug) {
  if (!slug) return false
  const cleaned = slug.replace(/^\/+/, '').split('/')[0]
  return getAdminComponent(cleaned) !== null
}
