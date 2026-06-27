import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OverlayScrollbars } from 'overlayscrollbars'
import './index.css'
import App from './App.jsx'

// body 전체에 오버레이 스크롤바 적용 (화면을 밀지 않음)
OverlayScrollbars(
  { target: document.body },
  {
    scrollbars: { theme: 'os-theme-maple os-theme-dark os-thin', autoHide: 'leave', autoHideDelay: 800 },
  }
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
