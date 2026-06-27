import { useEffect, useLayoutEffect } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useLayout } from '../../../components/pc/Layout'
import CharacterPanel from './user/CharacterPanel'
import BossSelector from './user/BossSelector'
import { useBossStore, bossInitialState } from '../store'
import { useFeatureSync } from '../../../hooks/useFeatureSync'
import { MAX_PER_CHARACTER } from '../logic'

export default function BossCrystal() {
  useFeatureSync({ feature: 'boss-crystal', store: useBossStore, initial: bossInitialState })

  const characters = useBossStore((s) => s.characters)
  const selectedChar = useBossStore((s) => s.selectedChar)
  const selections = useBossStore((s) => s.selections)
  const addCharacter = useBossStore((s) => s.addCharacter)
  const removeCharacter = useBossStore((s) => s.removeCharacter)
  const selectCharacter = useBossStore((s) => s.selectCharacter)
  const reorderCharacters = useBossStore((s) => s.reorderCharacters)
  const setBossSelection = useBossStore((s) => s.setBossSelection)
  const updateCharacter = useBossStore((s) => s.updateCharacter)

  // 풀스크린 모드 (푸터 숨김 + 내부 스크롤)
  const { setFullscreen } = useLayout()
  useLayoutEffect(() => {
    setFullscreen(true)
    return () => setFullscreen(false)
  }, [setFullscreen])

  const { data: bosses = [], isLoading } = useQuery({
    queryKey: ['boss-crystal', 'bosses'],
    queryFn: () => api('/api/boss-crystal/bosses').catch(() => []),
  })

  // 저장된 캐릭터의 기본 정보 새로고침
  const charRefreshQueries = useQueries({
    queries: characters.map((c) => ({
      queryKey: ['character', 'basic', c.character_name],
      queryFn: () => api(`/api/character/search?name=${encodeURIComponent(c.character_name)}`),
      enabled: !!c.character_name,
      refetchOnMount: 'always',
      staleTime: 0,
      retry: false,
    })),
  })

  useEffect(() => {
    // 인덱스가 아닌 character_name으로 매칭 (캐릭터 추가/삭제 시 순서 어긋남 방지)
    const byName = {}
    for (const q of charRefreshQueries) {
      const d = q?.data
      if (d?.character_name) byName[d.character_name] = d
    }
    characters.forEach((c) => {
      const d = byName[c.character_name]
      if (!d) return
      if (d.character_image !== c.character_image || d.character_level !== c.character_level || d.job_name !== c.job_name) {
        updateCharacter(c.character_name, {
          character_image: d.character_image,
          character_level: d.character_level,
          job_name: d.job_name,
          world_name: d.world_name,
          ocid: d.ocid,
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charRefreshQueries.map((q) => q.dataUpdatedAt).join(',')])

  const handleBossChange = (bossId, sel) => {
    if (!selectedChar) return
    setBossSelection(selectedChar, bossId, sel)
  }

  const currentSelections = selectedChar ? (selections[selectedChar] || {}) : {}
  const currentSelectedCount = Object.values(currentSelections).filter(Boolean).length
  const isMaxReached = currentSelectedCount >= MAX_PER_CHARACTER

  return (
    <div className="h-full">
      {isLoading ? (
        <div
          className="rounded-2xl border p-16 text-center"
          style={{
            background: 'var(--panel-bg)',
            borderColor: 'var(--panel-border)',
            boxShadow: 'var(--panel-shadow)',
          }}
        >
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[420px_1fr] h-full min-h-0">
          <div
            className="rounded-2xl border p-4 min-h-0 max-h-full self-start overflow-hidden flex flex-col"
            style={{
              background: 'var(--panel-bg)',
              borderColor: 'var(--panel-border)',
              boxShadow: 'var(--panel-shadow)',
            }}
          >
            <CharacterPanel
              characters={characters}
              selectedName={selectedChar}
              allSelections={selections}
              bosses={bosses}
              onSelect={selectCharacter}
              onAdd={addCharacter}
              onRemove={removeCharacter}
              onReorder={reorderCharacters}
            />
          </div>

          <div className="min-h-0">
            <BossSelector
              characterName={selectedChar}
              bosses={bosses}
              selections={currentSelections}
              onChange={handleBossChange}
              maxReached={isMaxReached}
            />
          </div>
        </div>
      )}
    </div>
  )
}
