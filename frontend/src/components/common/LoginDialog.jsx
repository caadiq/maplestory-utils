import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'

export default function LoginDialog({ open, onClose }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setInput('')
      setError('')
      setBusy(false)
    }
  }, [open])

  const handleSave = async () => {
    const key = input.trim()
    if (!key) {
      setError('API 키를 입력해주세요')
      return
    }
    setError('')
    setBusy(true)
    try {
      const { user: loggedIn } = await api('/api/auth/login', { method: 'POST', body: { nexonKey: key } })
      queryClient.setQueryData(['auth', 'me'], loggedIn)
      onClose()
    } catch (err) {
      setError(err.message || '로그인 실패')
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }) } catch { /* 무시 */ }
    queryClient.setQueryData(['auth', 'me'], null)
    queryClient.removeQueries({ queryKey: ['admin'] })
    setInput('')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'var(--dialog-backdrop)' }}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-2xl border shadow-2xl ring-1"
            style={{
              backgroundImage: 'linear-gradient(to bottom, var(--dialog-bg-from), var(--dialog-bg-to))',
              borderColor: 'var(--dialog-border)',
              '--tw-ring-color': 'var(--ring-info)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-3 flex items-start gap-4">
              <div
                className="shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center"
                style={{
                  background: 'var(--icon-info-bg)',
                  borderColor: 'var(--icon-info-border)',
                  color: 'var(--accent-bright)',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M15 7C15 5.34 13.66 4 12 4C10.34 4 9 5.34 9 7C9 7.74 9.27 8.42 9.71 8.95L4 14.66V20H9.34L15.05 14.29C15.58 14.73 16.26 15 17 15C18.66 15 20 13.66 20 12M17 8.5C16.72 8.5 16.5 8.28 16.5 8C16.5 7.72 16.72 7.5 17 7.5C17.28 7.5 17.5 7.72 17.5 8C17.5 8.28 17.28 8.5 17 8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold pt-1" style={{ color: 'var(--text-strong)' }}>API 키 로그인</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  NEXON Open API 키를 입력하면 계정의 캐릭터 목록을 불러올 수 있습니다
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-8 h-8 -mt-1 -mr-1 rounded-lg hover:bg-[var(--row-hover-bg)] flex items-center justify-center text-xl leading-none"
                style={{ color: 'var(--text-dim)' }}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="px-7 py-4 space-y-2">
              <input
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); if (error) setError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !busy) handleSave() }}
                placeholder="live_xxxxxxxxxxxxxxxxxx..."
                className="w-full rounded-lg border-2 px-3 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)] font-mono"
                style={{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--text-strong)',
                }}
                autoFocus
              />
              {error && (
                <p className="text-xs" style={{ color: 'var(--danger-text)' }}>{error}</p>
              )}
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                키는 저장되지 않으며, 로그인 시 NEXON 서버 인증에만 사용됩니다.
              </p>
            </div>
            <div
              className="flex gap-2 px-7 py-4 border-t"
              style={{ borderColor: 'var(--panel-border)' }}
            >
              {user ? (
                <button
                  onClick={handleLogout}
                  className="flex-1 rounded-lg border px-4 h-11 text-sm font-medium hover:bg-[var(--danger-bg-hover)] hover:text-[var(--danger-text)]"
                  style={{
                    borderColor: 'var(--btn-border)',
                    color: 'var(--text-emphasis)',
                  }}
                >
                  로그아웃
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border px-4 h-11 text-sm font-medium hover:bg-[var(--btn-bg-hover)]"
                  style={{
                    background: 'var(--btn-bg)',
                    borderColor: 'var(--btn-border)',
                    color: 'var(--text-emphasis)',
                  }}
                >
                  취소
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={busy}
                className="flex-1 rounded-lg px-4 h-11 text-sm font-semibold disabled:opacity-50 hover:bg-[var(--btn-primary-bg-hover)]"
                style={{
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  boxShadow: 'var(--btn-primary-shadow)',
                }}
              >
                {busy ? '로그인 중...' : user ? '다시 로그인' : '로그인'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
