/**
 * 기능 자동 등록 시스템
 *
 * - features/{kebab-case}/pc/{PascalCase}.jsx     : PC 사용자 페이지
 * - features/{kebab-case}/pc/{PascalCase}Admin.jsx: PC 관리자 페이지
 * - features/{kebab-case}/tablet/{PascalCase}.jsx : 태블릿 사용자 페이지
 * - features/{kebab-case}/mobile/{PascalCase}.jsx : 모바일 사용자 페이지
 */

import { lazy } from 'react'

const pages = import.meta.glob('./*/{pc,tablet,mobile}/*.jsx')

function slugToPascal(slug) {
  return slug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

const userPcCache = new Map()
const adminPcCache = new Map()
const userTabletCache = new Map()
const userMobileCache = new Map()

function loadCached(cache, slug, device, suffix) {
  if (cache.has(slug)) return cache.get(slug)
  const pascal = slugToPascal(slug)
  const path = `./${slug}/${device}/${pascal}${suffix}.jsx`
  const loader = pages[path]
  const component = loader ? lazy(loader) : null
  cache.set(slug, component)
  return component
}

/**
 * slug에 해당하는 PC 사용자 페이지 컴포넌트 반환
 */
export function getUserComponent(slug) {
  return loadCached(userPcCache, slug, 'pc', '')
}

/**
 * slug에 해당하는 관리자 페이지 컴포넌트 반환 (PC 전용)
 */
export function getAdminComponent(slug) {
  return loadCached(adminPcCache, slug, 'pc', 'Admin')
}

/**
 * slug에 해당하는 태블릿 사용자 페이지 컴포넌트 반환
 */
export function getTabletComponent(slug) {
  return loadCached(userTabletCache, slug, 'tablet', '')
}

/**
 * slug에 해당하는 모바일 사용자 페이지 컴포넌트 반환
 */
export function getMobileComponent(slug) {
  return loadCached(userMobileCache, slug, 'mobile', '')
}

/**
 * slug에 해당하는 관리자 페이지가 존재하는지
 */
export function hasAdminPage(slug) {
  if (!slug) return false
  const cleaned = slug.replace(/^\/+/, '').split('/')[0]
  return getAdminComponent(cleaned) !== null
}

/**
 * chunk prefetch: 렌더 트리거 없이 동적 import 만 시작
 * 메뉴 카드 hover 시 호출해 네비게이션 직후 Suspense 깜빡임을 제거.
 */
export function prefetchUserComponent(slug) {
  if (!slug) return
  const cleaned = slug.replace(/^\/+/, '').split('/')[0]
  const pascal = slugToPascal(cleaned)
  const loader = pages[`./${cleaned}/pc/${pascal}.jsx`]
  if (loader) loader()
}
