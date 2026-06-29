import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 저장된 값이 없을 때(첫 방문)의 기본 테마 = 시스템 설정
function getSystemTheme() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return 'dark'
}

export const useThemeStore = create(persist(
  (set) => ({
    theme: getSystemTheme(),
    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  }),
  { name: 'maple-theme' },
))
