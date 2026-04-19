import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(persist(
  (set) => ({
    apiKey: '',
    setApiKey: (k) => set({ apiKey: k }),
    clearApiKey: () => set({ apiKey: '' }),
  }),
  { name: 'maple-auth' },
))
