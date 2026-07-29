import { useMemo, useState, useLayoutEffect, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { useScrollChainBlock } from '../../hooks/useScrollLock'

/**
 * 캐릭터 입력 input 아래 뜨는 드롭다운 (포털 렌더 → 부모 overflow:hidden에도 안 잘림)
 * - 로그인 계정의 캐릭터 목록(/api/me/characters)을 조회
 * - anchorRef: 위치 기준이 되는 input 컨테이너 ref
 * - 항목 클릭 시 onSelect(characterName)
 */
export default function CharacterSuggestDropdown({ open, filter = '', excludeNames = [], onSelect, anchorRef }) {
  const { user } = useAuth()
  const [pos, setPos] = useState({ top: 0, bottom: 0, left: 0, width: 0, flipUp: false })
  const popupRef = useRef(null)
  useScrollChainBlock(popupRef, open)

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['me', 'characters'],
    queryFn: async () => {
      const r = await api('/api/me/characters')
      return r.characters || []
    },
    enabled: open && !!user,
    staleTime: 10 * 60 * 1000,
    retry: false,
  })

  const filtered = useMemo(() => {
    const exclude = new Set(excludeNames)
    const q = filter.trim().toLowerCase()
    return data
      .filter((c) => !exclude.has(c.character_name))
      .filter((c) => !q || c.character_name.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (b.character_level || 0) - (a.character_level || 0))
      .slice(0, 50)
  }, [data, filter, excludeNames])

  const updatePosition = () => {
    const el = anchorRef?.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const estHeight = 256
    const spaceBelow = window.innerHeight - rect.bottom
    const flipUp = spaceBelow < estHeight && rect.top > spaceBelow
    setPos({
      top: rect.bottom,
      bottom: window.innerHeight - rect.top,
      left: rect.left,
      width: rect.width,
      flipUp,
    })
  }

  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onScroll = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const popup = (
    <AnimatePresence>
      {open && user && (
        <motion.div
          key="dropdown"
          initial={{ opacity: 0, y: pos.flipUp ? 4 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: pos.flipUp ? 4 : -4 }}
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          ref={popupRef}
          className="fixed z-[100] rounded-lg border overflow-hidden"
          style={{
            background: 'var(--popup-bg)',
            borderColor: 'var(--popup-border)',
            boxShadow: 'var(--popup-shadow)',
            left: pos.left,
            width: pos.width,
            ...(pos.flipUp ? { bottom: pos.bottom + 4 } : { top: pos.top + 4 }),
          }}
        >
          <OverlayScrollbarsComponent style={{ maxHeight: 256 }} options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 }, overflow: { x: 'hidden', y: 'scroll' } }} defer>
          {isLoading ? (
            <div className="p-4 text-center text-sm" style={{ color: 'var(--text-dim)' }}>불러오는 중...</div>
          ) : error ? (
            <div className="p-4 text-center text-sm" style={{ color: 'var(--danger-text)' }}>
              {error.message || '조회 실패'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
              {data.length === 0 ? '캐릭터가 없습니다' : '일치하는 캐릭터가 없습니다'}
            </div>
          ) : (
            <ul>
              {filtered.map((c) => (
                <li key={c.ocid}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); onSelect(c.character_name) }}
                    className="w-full text-left pl-3 pr-5 py-2.5 flex items-center gap-2 hover:bg-[var(--row-hover-bg)]"
                  >
                    {c.world_icon ? (
                      <img
                        src={c.world_icon}
                        alt={c.world_name}
                        title={c.world_name}
                        className="w-5 h-5 shrink-0 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <span
                        className="w-5 h-5 shrink-0 rounded-full text-[10px] font-bold flex items-center justify-center"
                        style={{
                          background: 'var(--surface-nested)',
                          color: 'var(--text-dim)',
                        }}
                        title={c.world_name}
                      >
                        {c.world_name?.[0] || '?'}
                      </span>
                    )}
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-strong)' }}>
                      {c.character_name}
                    </span>
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-dim)' }}>
                      Lv.{c.character_level} · {c.job_name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </OverlayScrollbarsComponent>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(popup, document.body)
}
