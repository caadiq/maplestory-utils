import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useLayout } from '../../components/Layout'
import { SYMBOL_TABS, SYMBOLS } from './data'

function CharacterCard({ char, active, onSelect, onRemove }) {
  return (
    <div
      onClick={(e) => {
        if (e.target.closest('button')) return
        onSelect()
      }}
      className={`group relative shrink-0 w-36 rounded-xl border cursor-pointer select-none transition ${
        active
          ? 'border-emerald-500/40 bg-emerald-500/[0.08]'
          : 'border-white/5 hover:border-white/15 bg-gray-950/40 hover:bg-gray-950/60'
      }`}
    >
      {/* 삭제 (우상단) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        style={{ position: 'absolute', top: 6, right: 6, zIndex: 10 }}
        className="w-6 h-6 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition flex items-center justify-center text-base leading-none"
        aria-label="삭제"
      >
        ×
      </button>

      {/* 내용 */}
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
            <span className="text-gray-600 text-3xl">?</span>
          )}
        </div>
        <div className={`mt-2 text-base font-semibold truncate w-full ${active ? 'text-emerald-200' : 'text-gray-200'}`}>
          {char.character_name}
        </div>
        <div className="text-xs text-gray-500 tabular-nums mt-0.5 truncate w-full">
          Lv.{char.character_level} · {char.job_name}
        </div>
      </div>
    </div>
  )
}

function TabImage({ name }) {
  const { data } = useQuery({
    queryKey: ['image', name],
    queryFn: () => api('/api/images/' + encodeURIComponent(name)).catch(() => null),
    staleTime: Infinity,
  })
  if (!data?.url) return <div className="w-8 h-8 bg-gray-800 rounded" />
  return <img src={data.url} alt="" className="w-8 h-8 object-contain" />
}

function SymbolCard({ symbol, equipped }) {
  // 임시 목업 데이터
  const level = equipped ? 7 : 0
  const maxLevel = 20
  const growth = equipped ? 120 : 0
  const requireGrowth = 60
  const remainingSymbols = 540
  const remainingMeso = 128_000_000
  const daysLeft = equipped ? 84 : '-'
  const completeDate = equipped ? '2026년 07월 09일 (목)' : '미장착'

  return (
    <div className={`rounded-2xl border p-5 transition ${
      equipped
        ? 'border-white/10 bg-gray-900/60 hover:border-white/20'
        : 'border-white/5 bg-gray-950/40 opacity-60'
    }`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-14 h-14 rounded-lg bg-gray-950 overflow-hidden shrink-0 flex items-center justify-center">
          <img
            src={symbol.image}
            alt={symbol.name}
            className={`w-12 h-12 object-contain ${!equipped ? 'grayscale opacity-50' : ''}`}
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-gray-100 truncate">{symbol.name}</div>
          <div className="text-sm text-gray-400 tabular-nums mt-0.5">
            Lv.<span className="text-emerald-300 font-bold text-base">{level}</span>
            <span className="text-gray-600"> / {maxLevel}</span>
          </div>
        </div>
      </div>

      {/* 진행도 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-400 tabular-nums mb-1.5">
          <span>성장치 {growth} / {requireGrowth}</span>
          <span>{requireGrowth ? Math.min(Math.floor((growth / requireGrowth) * 100), 100) : 0}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-950 overflow-hidden">
          <div
            className="h-full bg-emerald-500/80 transition-all"
            style={{ width: `${Math.min((growth / requireGrowth) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* 획득량 입력 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="space-y-1">
          <label className="block text-xs text-gray-400">일퀘 획득</label>
          <input
            type="text"
            inputMode="numeric"
            defaultValue={equipped ? '20' : '0'}
            disabled={!equipped}
            className="w-full h-10 rounded-md border border-white/10 bg-gray-950 px-3 text-base text-right tabular-nums outline-none focus:border-emerald-500/50 hover:border-white/20 disabled:opacity-50 transition"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-gray-400">주간퀘 획득</label>
          <input
            type="text"
            inputMode="numeric"
            defaultValue={equipped ? '45' : '0'}
            disabled={!equipped}
            className="w-full h-10 rounded-md border border-white/10 bg-gray-950 px-3 text-base text-right tabular-nums outline-none focus:border-emerald-500/50 hover:border-white/20 disabled:opacity-50 transition"
          />
        </div>
      </div>

      {/* 정보 */}
      <div className="divide-y divide-white/5 text-base">
        <div className="flex justify-between py-2">
          <span className="text-gray-400">남은 심볼</span>
          <span className="tabular-nums text-gray-200 font-medium">{remainingSymbols.toLocaleString()}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-gray-400">필요 메소</span>
          <span className="tabular-nums text-amber-300 font-medium">{remainingMeso.toLocaleString()}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-gray-400">체납 메소</span>
          <span className="tabular-nums text-red-400 font-medium">{(equipped ? 18_000_000 : 0).toLocaleString()}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-gray-400">남은 일수</span>
          <span className="tabular-nums text-gray-200 font-medium">{typeof daysLeft === 'number' ? `${daysLeft}일` : daysLeft}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-gray-400">예상 완료일</span>
          <span className={`tabular-nums font-semibold ${equipped ? 'text-emerald-300' : 'text-gray-600'}`}>
            {completeDate}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function Symbol() {
  const { setFullscreen } = useLayout()
  useEffect(() => {
    setFullscreen(true)
    return () => setFullscreen(false)
  }, [setFullscreen])

  const STORAGE_KEY = 'maple-symbol'
  const [tab, setTab] = useState('arcane')
  const [characters, setCharacters] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved).characters || []
    } catch { /* ignore */ }
    return []
  })
  const [selectedCharId, setSelectedCharId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved).selectedCharId ?? null
    } catch { /* ignore */ }
    return null
  })
  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ characters, selectedCharId }))
  }, [characters, selectedCharId])
  const symbols = SYMBOLS[tab]
  const tabInfo = SYMBOL_TABS.find((t) => t.key === tab)

  const searchMutation = useMutation({
    mutationFn: (name) => api(`/api/character/search?name=${encodeURIComponent(name)}`),
    onSuccess: (data) => {
      setCharacters((prev) => {
        if (prev.find((c) => c.character_name === data.character_name)) {
          setAddError('이미 추가된 캐릭터입니다')
          return prev
        }
        setAddError('')
        setAddName('')
        setSelectedCharId(data.ocid)
        return [...prev, { ...data, id: data.ocid }]
      })
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

  // 임시: 첫 번째 심볼만 장착된 것으로 표시
  const isEquipped = (i) => i === 0

  return (
    <div className="space-y-6 pb-10 max-w-5xl mx-auto">
      {/* 캐릭터 조회 */}
      <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-5 space-y-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 12L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="text"
              value={addName}
              onChange={(e) => { setAddName(e.target.value); if (addError) setAddError('') }}
              placeholder="캐릭터 닉네임으로 장착 심볼 불러오기"
              className="w-full h-12 rounded-lg border-2 border-white/10 bg-gray-950 pl-10 pr-4 text-base outline-none focus:border-emerald-500/60 hover:border-white/20 transition"
            />
          </div>
          <button
            type="submit"
            disabled={searchMutation.isPending}
            className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 h-12 text-base font-semibold shadow-lg shadow-emerald-500/20 transition"
          >
            {searchMutation.isPending ? '...' : '조회'}
          </button>
        </form>
        {addError && <p className="text-sm text-red-400">{addError}</p>}

        {/* 캐릭터 목록 */}
        {characters.length > 0 && (
          <div className="flex items-start gap-3 overflow-x-auto pt-1">
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                char={c}
                active={c.id === selectedCharId}
                onSelect={() => setSelectedCharId(c.id)}
                onRemove={() => {
                  setCharacters((prev) => prev.filter((x) => x.id !== c.id))
                  if (selectedCharId === c.id) setSelectedCharId(null)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 심볼 타입 탭 */}
      <div className="flex gap-2">
        {SYMBOL_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2.5 rounded-2xl border px-4 py-3 transition ${
              tab === t.key
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200 shadow-lg shadow-emerald-500/10'
                : 'border-white/10 bg-gray-900/40 text-gray-400 hover:border-white/20 hover:text-gray-200'
            }`}
          >
            <TabImage name={t.imageName} />
            <span className="text-base font-semibold">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 심볼 카드 그리드 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {symbols.map((s, i) => (
          <SymbolCard key={s.key} symbol={s} equipped={isEquipped(i)} />
        ))}
      </div>

      {/* 전체 요약 */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.02] p-6 flex items-center justify-between gap-6 flex-wrap">
        <div>
          <div className="text-base text-emerald-200/80">{tabInfo?.label} 전체 만렙 완료 예상일</div>
          <div className="text-3xl font-bold text-emerald-300 tabular-nums mt-1.5">2026년 09월 12일 (토)</div>
        </div>
        <div className="flex items-center">
          <div className="text-right pr-10">
            <div className="text-base text-gray-400">누적 체납 메소</div>
            <div className="text-2xl font-bold text-red-400 tabular-nums mt-1">108,000,000</div>
          </div>
          <div className="w-px h-12 bg-white/10" />
          <div className="text-right pl-10">
            <div className="text-base text-gray-400">누적 필요 메소</div>
            <div className="text-2xl font-bold text-amber-300 tabular-nums mt-1">768,000,000</div>
          </div>
        </div>
      </div>
    </div>
  )
}
