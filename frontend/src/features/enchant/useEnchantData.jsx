import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { setDynamicItemLevels } from './costs'
import {
  groupStarforce, starforceSummary, normalizePotential, groupPotential,
  potentialStats, sortGroups, setInsightLevels, isExcludedItem,
} from './logic'

/**
 * 강화 기록 데이터 로딩·가공 (PC·모바일 공용)
 * 전체 기간을 한 번에 받아오고(서버가 날짜별로 영구 캐시) 정렬·필터는 클라이언트에서 처리한다.
 */
export function useEnchantData({ enabled, sort, charFilter }) {
  const qOpts = { enabled, staleTime: 5 * 60 * 1000, retry: 1 }
  const sfQuery = useQuery({ queryKey: ['enchant', 'starforce', 'all'], queryFn: () => api('/api/enchant/history?type=starforce'), ...qOpts })
  const cubeQuery = useQuery({ queryKey: ['enchant', 'cube', 'all'], queryFn: () => api('/api/enchant/history?type=cube'), ...qOpts })
  const potQuery = useQuery({ queryKey: ['enchant', 'potential', 'all'], queryFn: () => api('/api/enchant/history?type=potential'), ...qOpts })

  // 원본 데이터에서 캐릭터·아이템 이름 수집 (아이콘/월드 조회 입력)
  const rawCharacterNames = useMemo(() => {
    const names = new Set()
    for (const i of sfQuery.data?.items || []) names.add(i.character_name)
    for (const i of cubeQuery.data?.items || []) names.add(i.character_name)
    for (const i of potQuery.data?.items || []) names.add(i.character_name)
    return [...names].filter(Boolean)
  }, [sfQuery.data, cubeQuery.data, potQuery.data])

  const itemNames = useMemo(() => {
    const set = new Set()
    for (const i of sfQuery.data?.items || []) set.add(i.target_item)
    for (const i of cubeQuery.data?.items || []) set.add(i.target_item)
    for (const i of potQuery.data?.items || []) set.add(i.target_item)
    return [...set].filter(Boolean).slice(0, 300)
  }, [sfQuery.data, cubeQuery.data, potQuery.data])

  const iconQuery = useQuery({
    queryKey: ['enchant', 'item-icons', rawCharacterNames.join(','), itemNames.length],
    queryFn: () => api(`/api/enchant/item-icons?characters=${encodeURIComponent(rawCharacterNames.join(','))}&items=${encodeURIComponent(itemNames.join(','))}`),
    enabled: enabled && rawCharacterNames.length > 0,
    staleTime: 60 * 60 * 1000,
  })
  const itemIcons = iconQuery.data?.items || {}
  const charInfo = useMemo(() => iconQuery.data?.characters || {}, [iconQuery.data])
  const worldIcons = useMemo(
    () => Object.fromEntries(Object.entries(charInfo).map(([n, v]) => [n, v.worldIcon])),
    [charInfo]
  )
  // 이벤트/테스트 월드 캐릭터는 통계에서 제외 (정보 조회 실패 시엔 포함)
  const excluded = useMemo(
    () => new Set(Object.entries(charInfo).filter(([, v]) => v.normalWorld === false).map(([n]) => n)),
    [charInfo]
  )

  const sfItems = useMemo(() => {
    let items = (sfQuery.data?.items || [])
      .filter((i) => !excluded.has(i.character_name) && !isExcludedItem(i.target_item))
    if (charFilter) items = items.filter((i) => i.character_name === charFilter)
    return items
  }, [sfQuery.data, charFilter, excluded])

  const potRows = useMemo(() => {
    let rows = normalizePotential(cubeQuery.data?.items || [], potQuery.data?.items || [])
      .filter((i) => !excluded.has(i.character_name) && !isExcludedItem(i.target_item))
    if (charFilter) rows = rows.filter((i) => i.character_name === charFilter)
    return rows
  }, [cubeQuery.data, potQuery.data, charFilter, excluded])

  // 서버끼리 묶고(대표 = 최고 레벨), 서버 안에서는 레벨 내림차순. 조회 안 되는 캐릭터는 맨 뒤
  const sortedCharacters = useMemo(() => {
    const names = rawCharacterNames.filter((n) => !excluded.has(n))
    const topLevel = {}
    for (const n of names) {
      const w = charInfo[n]?.world
      if (!w) continue
      topLevel[w] = Math.max(topLevel[w] ?? 0, charInfo[n]?.level ?? 0)
    }
    return names.sort((a, b) => {
      const ia = charInfo[a]
      const ib = charInfo[b]
      const knownA = ia?.image ? 0 : 1
      const knownB = ib?.image ? 0 : 1
      if (knownA !== knownB) return knownA - knownB
      const wa = ia?.world || ''
      const wb = ib?.world || ''
      if (wa !== wb) return (topLevel[wb] ?? 0) - (topLevel[wa] ?? 0) || wa.localeCompare(wb, 'ko')
      return (ib?.level ?? 0) - (ia?.level ?? 0) || a.localeCompare(b, 'ko')
    })
  }, [rawCharacterNames, excluded, charInfo])

  const characterOptions = useMemo(() => [
    {
      value: null,
      label: '모든 캐릭터',
      hasIconSlot: true,
      noSubIcon: true,
      iconElement: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--text-dim)' }}>
          <circle cx="7.5" cy="6.5" r="2.75" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.25 15.5c0-2.6 2.35-4.15 5.25-4.15s5.25 1.55 5.25 4.15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M13.25 4.35a2.6 2.6 0 0 1 0 4.9M14.5 11.9c2.05.45 3.35 1.85 3.35 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ),
    },
    ...sortedCharacters.map((n, i) => ({
      value: n,
      label: n,
      hasIconSlot: true,
      icon: charInfo[n]?.image || undefined,
      iconScale: 3,
      iconOffsetY: -3,
      subIcon: charInfo[n]?.worldIcon || undefined,
      sub: charInfo[n]?.level ? `Lv.${charInfo[n].level}` : undefined,
      // 서버가 바뀌는 지점에 구분선
      groupStart: i > 0 && charInfo[sortedCharacters[i - 1]]?.world !== charInfo[n]?.world,
    })),
  ], [sortedCharacters, charInfo])

  // 스타포스 이력엔 item_level이 없다 — 계정 장비·잠재 이력에서 얻은 실제 레벨을 비용 계산에 주입
  const itemLevelDict = useMemo(() => {
    const dict = { ...(iconQuery.data?.itemLevels || {}) }
    for (const r of potRows) {
      if (r.item_level && !dict[r.target_item]) dict[r.target_item] = r.item_level
    }
    return dict
  }, [iconQuery.data, potRows])

  const sfGroups = useMemo(() => {
    setDynamicItemLevels(itemLevelDict)
    return sortGroups(groupStarforce(sfItems), sort)
  }, [sfItems, sort, itemLevelDict])
  const sfSum = useMemo(() => {
    setDynamicItemLevels(itemLevelDict)
    return starforceSummary(sfItems)
  }, [sfItems, itemLevelDict])

  // 통찰력 성향에 따라 큐브 감정 비용이 무료가 되는 구간이 달라진다
  const insightMap = useMemo(
    () => Object.fromEntries(Object.entries(charInfo).map(([n, v]) => [n, v.insight])),
    [charInfo]
  )
  const potGroups = useMemo(() => {
    setInsightLevels(insightMap)
    return sortGroups(groupPotential(potRows), sort)
  }, [potRows, sort, insightMap])
  const potStat = useMemo(() => {
    setInsightLevels(insightMap)
    return potentialStats(potRows)
  }, [potRows, insightMap])

  const methodIconNames = useMemo(() => {
    const names = new Set()
    for (const g of potGroups) for (const m of g.methods) names.add(m.iconName)
    return [...names].sort()   // 정렬 순서가 바뀌어도 queryKey가 흔들리지 않도록 고정
  }, [potGroups])
  const methodIconQuery = useQuery({
    queryKey: ['enchant', 'method-icons', methodIconNames.join('|')],
    queryFn: async () => {
      const entries = await Promise.all(methodIconNames.map(async (n) => {
        const d = await api(`/api/images/${encodeURIComponent(n)}`).catch(() => null)
        return [n, d?.url || null]
      }))
      return Object.fromEntries(entries)
    },
    enabled: enabled && methodIconNames.length > 0,
    staleTime: Infinity,
    placeholderData: (prev) => prev,   // 목록이 바뀌어도 기존 아이콘 유지 (깜빡임 방지)
  })

  // 탭 아이콘 (이미지 관리 등록분)
  const tabIconQuery = useQuery({
    queryKey: ['enchant', 'tab-icons'],
    queryFn: async () => {
      const [sf, pot] = await Promise.all([
        api('/api/images/' + encodeURIComponent('스타포스 HD')).catch(() => api('/api/images/' + encodeURIComponent('스타포스')).catch(() => null)),
        api('/api/images/' + encodeURIComponent('잠재능력 재설정')).catch(() => null),
      ])
      return { starforce: sf?.url || null, potential: pot?.url || null }
    },
    staleTime: Infinity,
  })

  return {
    loading: sfQuery.isLoading || cubeQuery.isLoading || potQuery.isLoading,
    sfGroups,
    sfSum,
    potGroups,
    potStat,
    itemIcons,
    worldIcons,
    charInfo,
    characterOptions,
    methodIcons: methodIconQuery.data || {},
    tabIcons: tabIconQuery.data || {},
  }
}
