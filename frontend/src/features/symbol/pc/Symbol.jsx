import { memo, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { useQuery, useQueries, useMutation } from '@tanstack/react-query'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { api } from '../../../api/client'
import { useLayout } from '../../../components/pc/Layout'
import Select from '../../../components/common/Select'
import Tooltip from '../../../components/common/Tooltip'
import CharacterSuggestDropdown from '../../../components/common/CharacterSuggestDropdown'
import { useSymbolStore } from '../store'
import { formatMesoKorean } from '../../../utils/formatting'

dayjs.extend(utc)
dayjs.extend(timezone)
const KST = 'Asia/Seoul'
const DOW = ['일', '월', '화', '수', '목', '금', '토']

function formatKoreanDate(d) {
  const dj = dayjs(d).tz(KST)
  return `${dj.year()}년 ${String(dj.month() + 1).padStart(2, '0')}월 ${String(dj.date()).padStart(2, '0')}일 (${DOW[dj.day()]})`
}

/**
 * 심볼 완료까지 남은 일수/예상 완료일 계산
 * - 일퀘는 매일, 주간퀘는 매주 목요일 리셋 시 N회분을 한 번에 지급한다고 가정
 * - extra(추가 심볼)는 즉시 적용
 * - dailyDone이면 오늘 일퀘는 이미 받은 걸로 간주 (내일부터 다시 지급)
 */
function computeCompletion({ remainingSymbols, daily, weeklyPerWeek, extra, dailyDone }) {
  const need = Math.max(remainingSymbols - extra, 0)
  if (need === 0) return { days: 0, date: dayjs().tz(KST).startOf('day').toDate() }
  if (daily <= 0 && weeklyPerWeek <= 0) return { days: null, date: null }

  let acc = 0
  let cursor = dayjs().tz(KST).startOf('day')
  for (let day = 0; day < 3650; day++) {
    // 오늘은 dailyDone이면 일퀘 없음, 그 외엔 daily
    if (!(day === 0 && dailyDone)) acc += daily
    // 목요일(day=4)에 주간퀘 전량 지급
    if (cursor.day() === 4 && weeklyPerWeek > 0) acc += weeklyPerWeek
    if (acc >= need) return { days: day, date: cursor.toDate() }
    cursor = cursor.add(1, 'day')
  }
  return { days: null, date: null }
}

const TYPE_ORDER = ['아케인', '어센틱', '그랜드 어센틱']

const CharacterCard = memo(function CharacterCard({ char, active, onSelect, onRemove }) {
  return (
    <div
      onClick={(e) => {
        if (e.target.closest('button')) return
        onSelect()
      }}
      className="group relative shrink-0 w-36 rounded-xl border cursor-pointer select-none"
      style={{
        borderColor: active ? 'var(--selected-border)' : 'var(--panel-border)',
        background: active ? 'var(--selected-bg)' : 'var(--surface-3)',
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        style={{ position: 'absolute', top: 6, right: 6, zIndex: 10, color: 'var(--text-dim)' }}
        className="w-6 h-6 rounded-md hover:bg-[var(--danger-bg-hover)] hover:text-[var(--danger-text)] flex items-center justify-center text-base leading-none"
        aria-label="삭제"
      >
        ×
      </button>

      <div className="pt-3 px-3 pb-3 flex flex-col items-center text-center">
        <div className="w-24 h-24 overflow-hidden flex items-center justify-center">
          {char.character_image ? (
            <img
              src={char.character_image}
              alt=""
              className="w-full h-full object-contain scale-[3] origin-center pointer-events-none"
              style={{ imageRendering: 'pixelated' }}
              draggable={false}
            />
          ) : (
            <span className="text-3xl" style={{ color: 'var(--text-dim)' }}>?</span>
          )}
        </div>
        <div
          className="mt-2 text-base font-semibold truncate w-full"
          style={{ color: active ? 'var(--accent-bright)' : 'var(--text-emphasis)' }}
        >
          {char.character_name}
        </div>
        <div
          className="text-xs tabular-nums mt-0.5 truncate w-full"
          style={{ color: 'var(--text-dim)' }}
        >
          Lv.{char.character_level} · {char.job_name}
        </div>
      </div>
    </div>
  )
})

const SymbolCard = memo(function SymbolCard({ symbol, equipped, charId }) {
  const progress = useSymbolStore((s) => s.progress?.[charId]?.[symbol.id])
  const updateSymbol = useSymbolStore((s) => s.updateSymbol)

  const dailyDone = progress?.dailyDone ?? false
  const weeklyCount = progress?.weeklyCount ?? 3
  const daily = progress?.daily ?? symbol.daily_default
  const extra = progress?.extra ?? 0
  const patch = (p) => charId && updateSymbol(charId, symbol.id, p)

  const level = progress?.level ?? 0
  const growth = progress?.growth ?? 0
  const requireGrowth = symbol.levels?.find((l) => l.level === level)?.required_count || 0
  const isMax = equipped && level >= symbol.max_level

  // 남은 심볼: 현재 레벨→만렙 까지 필요한 심볼 총합 (현재 성장치 차감)
  // 필요 메소: 현재 레벨→만렙 까지 필요한 메소 총합
  // 체납 메소: 이미 성장치가 현재 레벨 요구치 이상이면 바로 올릴 수 있는 레벨의 메소
  const { remainingSymbols, remainingMeso, arrearMeso } = useMemo(() => {
    if (!equipped || !symbol.levels?.length) return { remainingSymbols: 0, remainingMeso: 0, arrearMeso: 0 }
    let sym = 0, meso = 0, arr = 0
    // 체납: 현재 성장치로 올릴 수 있는 레벨까지 누적
    let arrLv = level, arrG = growth
    while (arrLv < symbol.max_level) {
      const req = symbol.levels.find((l) => l.level === arrLv)?.required_count
      const cost = symbol.levels.find((l) => l.level === arrLv)?.meso_cost
      if (req == null || cost == null || arrG < req) break
      arr += cost
      arrG -= req
      arrLv += 1
    }
    let g = growth
    for (const l of symbol.levels) {
      if (l.level < level) continue
      sym += Math.max(l.required_count - g, 0)
      g = Math.max(g - l.required_count, 0)
      meso += l.meso_cost
    }
    return { remainingSymbols: sym, remainingMeso: meso, arrearMeso: arr }
  }, [equipped, level, growth, symbol.levels, symbol.max_level])

  // 현재 성장치로 도달 가능한 최대 레벨 (연속 체납 반영)
  const reachableLevel = useMemo(() => {
    if (!equipped || isMax) return level
    let lv = level
    let g = growth
    while (lv < symbol.max_level) {
      const req = symbol.levels?.find((l) => l.level === lv)?.required_count
      if (!req || g < req) break
      g -= req
      lv += 1
    }
    return lv
  }, [equipped, isMax, level, growth, symbol.levels, symbol.max_level])

  // 성장치로 만렙까지 도달 가능하지만 레벨업은 안 한 상태
  const effectivelyMax = equipped && !isMax && reachableLevel >= symbol.max_level
  const interactable = equipped && !isMax && !effectivelyMax

  // 남은 일수/예상 완료일
  const { days: daysLeft, date: completeDate } = useMemo(() => {
    if (!equipped || isMax) return { days: null, date: null }
    return computeCompletion({
      remainingSymbols,
      daily,
      weeklyPerWeek: (weeklyCount || 0) * (symbol.weekly_default || 0),
      extra,
      dailyDone,
    })
  }, [equipped, isMax, remainingSymbols, daily, weeklyCount, symbol.weekly_default, extra, dailyDone])

  const inputClass = "w-full h-10 rounded-md border px-3 text-base text-right tabular-nums outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)] disabled:opacity-50"

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        boxShadow: 'var(--panel-shadow)',
        opacity: equipped ? 1 : 0.6,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-14 h-14 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
          style={{ background: 'var(--surface-nested)' }}
        >
          {symbol.image_url && (
            <img
              src={symbol.image_url}
              alt={symbol.region}
              className={`w-12 h-12 object-contain ${!equipped ? 'grayscale opacity-50' : ''}`}
              style={{ imageRendering: 'pixelated' }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold truncate">{symbol.region}</div>
          <div
            className="text-sm tabular-nums mt-0.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Lv.<span className="font-bold text-base" style={{ color: 'var(--accent-bright)' }}>{level}</span>
            <span style={{ color: 'var(--text-dim)' }}> / {symbol.max_level}</span>
          </div>
        </div>
        {equipped && !isMax && !effectivelyMax && (
          <button
            type="button"
            onClick={() => patch({ dailyDone: !dailyDone })}
            title="오늘 일퀘 완료 여부"
            className="shrink-0 rounded-md h-8 px-3 text-xs font-semibold border disabled:opacity-40 disabled:cursor-not-allowed"
            style={dailyDone ? {
              background: 'var(--selected-bg)',
              borderColor: 'var(--selected-border)',
              color: 'var(--accent-bright)',
            } : {
              background: 'var(--danger-bg-hover)',
              borderColor: 'var(--icon-danger-border)',
              color: 'var(--danger-text)',
            }}
          >
            {dailyDone ? '금일 일퀘 완료' : '금일 일퀘 미완료'}
          </button>
        )}
      </div>

      {/* 진행도 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm tabular-nums mb-1.5">
          {isMax ? (
            <span style={{ color: 'var(--text-muted)' }}>
              성장치 <span className="font-bold" style={{ color: 'var(--warning-text-bright)' }}>MAX</span>
            </span>
          ) : effectivelyMax ? (
            <Tooltip text={`Lv.${symbol.max_level}까지 상승 가능`}>
              <span style={{ color: 'var(--text-muted)' }}>
                성장치 {growth} <span className="font-bold" style={{ color: 'var(--warning-text-bright)' }}>(MAX)</span> / {requireGrowth}
              </span>
            </Tooltip>
          ) : reachableLevel > level ? (
            <Tooltip text={`Lv.${reachableLevel}까지 상승 가능`}>
              <span style={{ color: 'var(--text-muted)' }}>
                성장치 {growth} / {requireGrowth}
              </span>
            </Tooltip>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>
              성장치 {growth} / {requireGrowth}
            </span>
          )}
          {!isMax && !effectivelyMax && (
            <span style={{ color: 'var(--text-muted)' }}>
              {requireGrowth ? Math.min(Math.floor((growth / requireGrowth) * 100), 100) : 0}%
            </span>
          )}
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: 'var(--progress-track)' }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: isMax || effectivelyMax ? '100%' : `${Math.min((growth / requireGrowth) * 100, 100)}%`,
              background: isMax || effectivelyMax ? 'var(--progress-amber)' : 'var(--progress-emerald)',
            }}
          />
        </div>
      </div>

      {/* 획득량 입력 */}
      <div
        className="grid gap-2 mb-4"
        style={{ gridTemplateColumns: symbol.weekly_default > 0 ? '0.7fr 1.3fr 1fr' : '1fr 1fr' }}
      >
        <div className="space-y-1">
          <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>일퀘 획득</label>
          <input
            type="text"
            inputMode="numeric"
            value={equipped ? String(daily) : '0'}
            onChange={(e) => patch({ daily: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
            disabled={!interactable}
            className={inputClass}
            style={{
              background: 'var(--input-bg)',
              borderColor: 'var(--input-border)',
              color: 'var(--text-strong)',
            }}
          />
        </div>
        {symbol.weekly_default > 0 && (
          <div className="space-y-1">
            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>주간퀘 획득</label>
            <Select
              value={weeklyCount}
              onChange={(v) => patch({ weeklyCount: v })}
              options={[0, 1, 2, 3].map((n) => ({
                value: n,
                label: `${n * symbol.weekly_default}개`,
              }))}
              disabled={!interactable}
            />
          </div>
        )}
        <div className="space-y-1">
          <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>추가 심볼</label>
          <input
            type="text"
            inputMode="numeric"
            value={equipped ? String(extra) : '0'}
            onChange={(e) => patch({ extra: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
            disabled={!interactable}
            className={inputClass}
            style={{
              background: 'var(--input-bg)',
              borderColor: 'var(--input-border)',
              color: 'var(--text-strong)',
            }}
          />
        </div>
      </div>

      {/* 정보 */}
      <div className="text-base">
        {[
          { label: '남은 심볼', value: equipped && !isMax && !effectivelyMax ? `${remainingSymbols.toLocaleString()}개` : '-', color: 'var(--text-emphasis)' },
          { label: '필요 메소', value: equipped && !isMax ? remainingMeso.toLocaleString() : '-', color: 'var(--warning-text-bright)', tooltip: equipped && !isMax ? formatMesoKorean(remainingMeso) : null },
          { label: '체납 메소', value: equipped && !isMax ? arrearMeso.toLocaleString() : '-', color: 'var(--danger-text)', tooltip: equipped && !isMax ? formatMesoKorean(arrearMeso) : null },
          { label: '남은 일수', value: equipped && !isMax && !effectivelyMax && daysLeft != null ? `${daysLeft.toLocaleString()}일` : '-', color: 'var(--text-emphasis)' },
          { label: '예상 완료일', value: equipped && !isMax && !effectivelyMax && completeDate ? formatKoreanDate(completeDate) : '-', color: equipped && !isMax && !effectivelyMax && completeDate ? 'var(--accent-bright)' : 'var(--text-dim)', strong: true },
        ].map((row, i) => (
          <div
            key={row.label}
            className="flex justify-between py-2 border-t first:border-t-0"
            style={{ borderColor: 'var(--row-divider)' }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
            {row.tooltip ? (
              <Tooltip text={row.tooltip}>
                <span className={`tabular-nums ${row.strong ? 'font-semibold' : 'font-medium'}`} style={{ color: row.color }}>
                  {row.value}
                </span>
              </Tooltip>
            ) : (
              <span className={`tabular-nums ${row.strong ? 'font-semibold' : 'font-medium'}`} style={{ color: row.color }}>
                {row.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

export default function Symbol() {
  const { setFullscreen } = useLayout()
  useLayoutEffect(() => {
    setFullscreen(true)
    return () => setFullscreen(false)
  }, [setFullscreen])

  // 심볼 목록 (DB에서 로드)
  const { data: allSymbols = [] } = useQuery({
    queryKey: ['symbol', 'symbols'],
    queryFn: () => api('/api/symbols').catch(() => []),
    staleTime: 5 * 60 * 1000,
  })

  const tabs = useMemo(() => {
    const groups = {}
    for (const s of allSymbols) {
      if (!groups[s.type]) groups[s.type] = s
    }
    return TYPE_ORDER
      .filter((t) => groups[t])
      .map((t) => ({ key: t, label: `${t} 심볼`, image_url: groups[t].image_url }))
  }, [allSymbols])

  const characters = useSymbolStore((s) => s.characters)
  const selectedCharId = useSymbolStore((s) => s.selectedCharId)
  const addCharacter = useSymbolStore((s) => s.addCharacter)
  const removeCharacter = useSymbolStore((s) => s.removeCharacter)
  const selectCharacter = useSymbolStore((s) => s.selectCharacter)
  const syncCharacterSymbols = useSymbolStore((s) => s.syncCharacterSymbols)
  const updateCharacter = useSymbolStore((s) => s.updateCharacter)
  const storedTab = useSymbolStore((s) => s.selectedTabs?.[selectedCharId])
  const setTabStore = useSymbolStore((s) => s.setTab)

  const tab = storedTab || tabs[0]?.key || null
  const setTab = (t) => { if (selectedCharId) setTabStore(selectedCharId, t) }
  
  // 각 캐릭터 기본정보(코디 이미지) 새로고침
  const basicQueries = useQueries({
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
    characters.forEach((c, idx) => {
      const d = basicQueries[idx]?.data
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

  // 각 캐릭터의 장착 심볼 fetch (새로고침마다 갱신)
  const symbolQueries = useQueries({
    queries: characters.map((c) => ({
      queryKey: ['character', 'symbols', c.id],
      queryFn: () => api(`/api/character/symbols?ocid=${c.id}`),
      enabled: !!c.id,
      refetchOnMount: 'always',
      staleTime: 0,
    })),
  })

  // symbolQueries 결과를 store로 반영
  useEffect(() => {
    if (!allSymbols.length || !characters.length) return
    // (type, region) → symbol id 매핑
    const lookup = {}
    for (const s of allSymbols) lookup[`${s.type}|${s.region}`] = s
    characters.forEach((c, idx) => {
      const q = symbolQueries[idx]
      if (!q?.data?.symbols) return
      const equippedMap = {}
      for (const es of q.data.symbols) {
        const match = lookup[`${es.type}|${es.region}`]
        if (!match) continue
        equippedMap[match.id] = {
          level: es.level,
          growth: es.growth_count,
          require_growth: es.require_growth_count,
        }
      }
      syncCharacterSymbols(c.id, equippedMap)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSymbols, symbolQueries.map((q) => q.dataUpdatedAt).join(',')])

  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const symbols = allSymbols.filter((s) => s.type === tab)
  const tabInfo = tabs.find((t) => t.key === tab)

  const searchMutation = useMutation({
    mutationFn: (name) => api(`/api/character/search?name=${encodeURIComponent(name)}`),
    onSuccess: (data) => {
      if (characters.find((c) => c.character_name === data.character_name)) {
        setAddError('이미 추가된 캐릭터입니다')
        return
      }
      setAddError('')
      setAddName('')
      addCharacter(data)
    },
    onError: (err) => setAddError(err.message || '조회 실패'),
  })

  const handleSearch = (e) => {
    e.preventDefault()
    const n = addName.trim()
    if (!n) return
    setAddError('')
    searchMutation.mutate(n)
  }

  const progress = useSymbolStore((s) => s.progress[selectedCharId])
  const isEquipped = (symbolId) => !!progress?.[symbolId]?.equipped

  // 현재 탭의 누적 메소 + 최종 완료일 계산
  const { totalRequiredMeso, totalArrearMeso, overallDate } = useMemo(() => {
    let req = 0, arr = 0, latest = null
    for (const s of symbols) {
      const p = progress?.[s.id]
      if (!p?.equipped) continue
      if (p.level >= s.max_level) continue
      // 체납 성장치로 만렙 도달 가능한지 확인
      let lv = p.level, g = p.growth || 0
      while (lv < s.max_level) {
        const r = s.levels?.find((l) => l.level === lv)?.required_count
        if (!r || g < r) break
        g -= r; lv += 1
      }
      const effMax = lv >= s.max_level

      // 체납 누적 (성장치 cascade)
      let arrLv = p.level, arrG = p.growth || 0
      while (arrLv < s.max_level) {
        const lv = s.levels?.find((x) => x.level === arrLv)
        if (!lv || arrG < lv.required_count) break
        arr += lv.meso_cost
        arrG -= lv.required_count
        arrLv += 1
      }
      let remaining = 0
      let gg = p.growth || 0
      for (const l of s.levels || []) {
        if (l.level < p.level) continue
        remaining += Math.max(l.required_count - gg, 0)
        gg = Math.max(gg - l.required_count, 0)
        req += l.meso_cost
      }
      if (effMax) continue // 완료 예상일 계산에서 제외
      const { date } = computeCompletion({
        remainingSymbols: remaining,
        daily: p.daily ?? s.daily_default ?? 0,
        weeklyPerWeek: (p.weeklyCount ?? 3) * (s.weekly_default || 0),
        extra: p.extra || 0,
        dailyDone: !!p.dailyDone,
      })
      if (date && (!latest || date > latest)) latest = date
    }
    return { totalRequiredMeso: req, totalArrearMeso: arr, overallDate: latest }
  }, [symbols, progress])

  return (
    <div className="space-y-6 pb-10 max-w-5xl mx-auto">
      {/* 캐릭터 조회 */}
      <div
        className="rounded-2xl border p-5 space-y-4"
        style={{
          background: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          boxShadow: 'var(--panel-shadow)',
        }}
      >
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--input-icon)' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 12L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="text"
              value={addName}
              onChange={(e) => { setAddName(e.target.value); if (addError) setAddError('') }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              placeholder="캐릭터 닉네임으로 장착 심볼 불러오기"
              className="w-full h-12 box-border rounded-lg border pl-10 pr-4 text-base outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
              style={{
                background: 'var(--input-bg)',
                borderColor: 'var(--input-border)',
                color: 'var(--text-strong)',
              }}
            />
            <CharacterSuggestDropdown
              open={dropdownOpen}
              filter={addName}
              excludeNames={characters.map((c) => c.character_name)}
              onSelect={(n) => {
                setAddName(n)
                setDropdownOpen(false)
                setAddError('')
                searchMutation.mutate(n)
              }}
            />
          </div>
          <button
            type="submit"
            disabled={searchMutation.isPending}
            className="shrink-0 rounded-lg disabled:opacity-50 px-6 h-12 text-base font-semibold hover:bg-[var(--btn-primary-bg-hover)]"
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              boxShadow: 'var(--btn-primary-shadow)',
            }}
          >
            {searchMutation.isPending ? '...' : '조회'}
          </button>
        </form>
        {addError && (
          <p className="text-sm" style={{ color: 'var(--danger-text)' }}>{addError}</p>
        )}

        {/* 캐릭터 목록 */}
        {characters.length > 0 && (
          <div className="flex items-start gap-3 overflow-x-auto pt-1">
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                char={c}
                active={c.id === selectedCharId}
                onSelect={() => selectCharacter(c.id)}
                onRemove={() => removeCharacter(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 심볼 타입 탭 */}
      <div className="flex gap-2">
        {tabs.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="flex-1 flex items-center justify-center gap-2.5 rounded-2xl border px-4 py-3"
              style={active ? {
                background: 'var(--selected-bg)',
                borderColor: 'var(--selected-border)',
                color: 'var(--accent-bright)',
                boxShadow: 'var(--btn-primary-shadow)',
              } : {
                background: 'var(--panel-bg)',
                borderColor: 'var(--panel-border)',
                color: 'var(--text-muted)',
              }}
            >
              {t.image_url ? (
                <img src={t.image_url} alt="" className="w-8 h-8 object-contain" style={{ imageRendering: 'pixelated' }} />
              ) : (
                <div className="w-8 h-8 rounded" style={{ background: 'var(--surface-nested)' }} />
              )}
              <span className="text-base font-semibold">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* 심볼 카드 그리드 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {symbols.map((s) => (
          <SymbolCard key={s.id} symbol={s} equipped={isEquipped(s.id)} charId={selectedCharId} />
        ))}
      </div>

      {/* 전체 요약 */}
      <div
        className="rounded-2xl border p-6 flex items-center justify-between gap-6 flex-wrap"
        style={{
          background: 'var(--selected-bg)',
          borderColor: 'var(--selected-border)',
          boxShadow: 'var(--panel-shadow)',
        }}
      >
        <div>
          <div className="text-base" style={{ color: 'var(--text-muted)' }}>
            {tabInfo?.label} 전체 만렙 완료 예상일
          </div>
          <div
            className="text-3xl font-bold tabular-nums mt-1.5"
            style={{ color: 'var(--accent-bright)' }}
          >
            {overallDate ? formatKoreanDate(overallDate) : '-'}
          </div>
        </div>
        <div className="flex items-center">
          <div className="text-right pr-10">
            <div className="text-base" style={{ color: 'var(--text-muted)' }}>누적 체납 메소</div>
            <Tooltip text={formatMesoKorean(totalArrearMeso)}>
              <div
                className="text-2xl font-bold tabular-nums mt-1 inline-block"
                style={{ color: 'var(--danger-text)' }}
              >
                {totalArrearMeso.toLocaleString()}
              </div>
            </Tooltip>
          </div>
          <div className="w-px h-12" style={{ background: 'var(--panel-border)' }} />
          <div className="text-right pl-10">
            <div className="text-base" style={{ color: 'var(--text-muted)' }}>남은 필요 메소</div>
            <Tooltip text={formatMesoKorean(totalRequiredMeso)}>
              <div
                className="text-2xl font-bold tabular-nums mt-1 inline-block"
                style={{ color: 'var(--warning-text-bright)' }}
              >
                {totalRequiredMeso.toLocaleString()}
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
