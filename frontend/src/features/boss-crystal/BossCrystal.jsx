import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useLayout } from '../../components/Layout'
import CharacterPanel from './user/CharacterPanel'
import BossSelector from './user/BossSelector'

const STORAGE_CHARS = 'maple-bc-characters'
const STORAGE_SELECTIONS = 'maple-bc-selections'
const MAX_PER_CHARACTER = 12

export default function BossCrystal() {
  const [characters, setCharacters] = useState(() => {
    const saved = localStorage.getItem(STORAGE_CHARS)
    return saved ? JSON.parse(saved) : []
  })
  const [selectedChar, setSelectedChar] = useState(() => {
    const saved = localStorage.getItem(STORAGE_CHARS)
    const list = saved ? JSON.parse(saved) : []
    return list[0]?.character_name || null
  })
  const [allSelections, setAllSelections] = useState(() => {
    const saved = localStorage.getItem(STORAGE_SELECTIONS)
    return saved ? JSON.parse(saved) : {}
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_CHARS, JSON.stringify(characters))
  }, [characters])

  useEffect(() => {
    localStorage.setItem(STORAGE_SELECTIONS, JSON.stringify(allSelections))
  }, [allSelections])

  // 풀스크린 모드 (푸터 숨김 + 내부 스크롤)
  const { setFullscreen } = useLayout()
  useEffect(() => {
    setFullscreen(true)
    return () => setFullscreen(false)
  }, [setFullscreen])

  const { data: bosses = [], isLoading } = useQuery({
    queryKey: ['boss-crystal', 'bosses'],
    queryFn: () => api('/api/boss-crystal/bosses').catch(() => []),
  })

  const handleAddCharacter = (char) => {
    setCharacters((prev) => [...prev, char])
    setSelectedChar(char.character_name)
  }

  const handleRemoveCharacter = (name) => {
    setCharacters((prev) => {
      const next = prev.filter((c) => c.character_name !== name)
      if (selectedChar === name) {
        setSelectedChar(next[0]?.character_name || null)
      }
      return next
    })
    setAllSelections((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const handleReorderCharacters = (next) => {
    setCharacters(next)
  }

  const handleBossChange = (bossId, sel) => {
    if (!selectedChar) return
    setAllSelections((prev) => {
      const charSel = { ...(prev[selectedChar] || {}) }
      if (sel === null) {
        delete charSel[bossId]
      } else {
        charSel[bossId] = sel
      }
      return { ...prev, [selectedChar]: charSel }
    })
  }

  const currentSelections = selectedChar ? (allSelections[selectedChar] || {}) : {}
  const currentSelectedCount = Object.values(currentSelections).filter(Boolean).length
  const isMaxReached = currentSelectedCount >= MAX_PER_CHARACTER


  return (
    <div className="h-full">
      {isLoading ? (
        <div className="rounded-2xl border border-white/5 bg-gray-900/40 p-16 text-center">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[420px_1fr] h-full min-h-0">
          {/* 좌측: 캐릭터 + 결과 통합 (총 수익/추가 고정 + 목록 스크롤) */}
          <div className="rounded-2xl border border-white/5 bg-gray-900/40 p-4 min-h-0 max-h-full self-start overflow-hidden flex flex-col">
            <CharacterPanel
              characters={characters}
              selectedName={selectedChar}
              allSelections={allSelections}
              bosses={bosses}
              onSelect={setSelectedChar}
              onAdd={handleAddCharacter}
              onRemove={handleRemoveCharacter}
              onReorder={handleReorderCharacters}
            />
          </div>

          {/* 우측: 보스 선택 (헤더 고정 + 목록 스크롤) */}
          <div className="min-h-0">
            <BossSelector
              characterName={selectedChar}
              bosses={bosses}
              selections={currentSelections}
              onChange={handleBossChange}
              maxReached={isMaxReached}
              selectedCount={currentSelectedCount}
              maxPerCharacter={MAX_PER_CHARACTER}
            />
          </div>
        </div>
      )}
    </div>
  )
}
