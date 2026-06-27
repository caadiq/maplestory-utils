import { useEffect, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useSymbolStore } from './store'

/**
 * 추가된 캐릭터들의 기본정보(코디 이미지/레벨/직업)와 장착 심볼을 서버에서 가져와
 * store에 반영한다. PC·모바일 심볼 계산기가 공유.
 * @param {Array} allSymbols 심볼 마스터데이터 (type|region → id 매칭용)
 */
export function useSymbolCharacterSync(allSymbols) {
  const characters = useSymbolStore((s) => s.characters)
  const updateCharacter = useSymbolStore((s) => s.updateCharacter)
  const syncCharacterSymbols = useSymbolStore((s) => s.syncCharacterSymbols)

  // 각 캐릭터 기본정보 새로고침
  const basicQueries = useQueries({
    queries: useMemo(() => characters.map((c) => ({
      queryKey: ['character', 'basic', c.character_name],
      queryFn: () => api(`/api/character/search?name=${encodeURIComponent(c.character_name)}`),
      enabled: !!c.character_name,
      refetchOnMount: 'always',
      staleTime: 0,
      retry: false,
    })), [characters]),
  })
  useEffect(() => {
    // 인덱스가 아닌 character_name으로 매칭 (캐릭터 추가/삭제 시 순서 어긋남 방지)
    const byName = {}
    for (const q of basicQueries) {
      const d = q?.data
      if (d?.character_name) byName[d.character_name] = d
    }
    characters.forEach((c) => {
      const d = byName[c.character_name]
      if (!d) return
      if (d.character_image !== c.character_image || d.character_level !== c.character_level || d.job_name !== c.job_name) {
        updateCharacter(c.id, {
          character_image: d.character_image,
          character_level: d.character_level,
          job_name: d.job_name,
          world_name: d.world_name,
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basicQueries.map((q) => q.dataUpdatedAt).join(',')])

  // 각 캐릭터의 장착 심볼 새로고침
  const symbolQueries = useQueries({
    queries: useMemo(() => characters.map((c) => ({
      queryKey: ['character', 'symbols', c.id],
      queryFn: () => api(`/api/character/symbols?ocid=${c.id}`),
      enabled: !!c.id,
      refetchOnMount: 'always',
      staleTime: 0,
    })), [characters]),
  })
  useEffect(() => {
    if (!allSymbols.length || !characters.length) return
    const lookup = {}
    for (const s of allSymbols) lookup[`${s.type}|${s.region}`] = s
    // 인덱스가 아닌 응답의 ocid로 매칭
    const byOcid = {}
    for (const q of symbolQueries) {
      const d = q?.data
      if (d?.ocid) byOcid[d.ocid] = d
    }
    characters.forEach((c) => {
      const d = byOcid[c.id]
      if (!d?.symbols) return
      const equippedMap = {}
      for (const es of d.symbols) {
        const match = lookup[`${es.type}|${es.region}`]
        if (!match) continue
        equippedMap[match.id] = {
          level: es.level,
          growth: es.growth_count,
          require_growth: es.require_growth_count,
        }
      }
      syncCharacterSymbols(c.id, equippedMap)
      const nextEs = d.event_skill ?? null
      const prevEs = c.event_skill ?? null
      if (JSON.stringify(nextEs) !== JSON.stringify(prevEs)) {
        updateCharacter(c.id, { event_skill: nextEs })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSymbols, symbolQueries.map((q) => q.dataUpdatedAt).join(',')])
}
