import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api/client'
import { useAuthStore } from '../stores/auth'

/**
 * 캐릭터 입력 input 아래 뜨는 드롭다운
 * - 로그인된 API 키로 /api/character/list 조회
 * - input value로 필터링
 * - 항목 클릭 시 onSelect(characterName)
 * - excludeNames: 이미 추가된 캐릭터는 목록에서 제외
 */
export default function CharacterSuggestDropdown({ open, filter = '', excludeNames = [], onSelect }) {
  const apiKey = useAuthStore((s) => s.apiKey)

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['user-character-list', apiKey],
    queryFn: async () => {
      const r = await api('/api/character/list', { headers: { 'x-user-api-key': apiKey } })
      return r.characters || []
    },
    enabled: open && !!apiKey,
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

  return (
    <AnimatePresence>
      {open && apiKey && (
      <motion.div
        key="dropdown"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-full left-0 right-0 mt-1 z-30 rounded-lg border max-h-64 overflow-y-auto"
        style={{
          background: 'var(--popup-bg)',
          borderColor: 'var(--popup-border)',
          boxShadow: 'var(--popup-shadow)',
        }}
      >
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
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-[var(--row-hover-bg)]"
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
      </motion.div>
      )}
    </AnimatePresence>
  )
}
