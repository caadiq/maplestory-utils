import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import Select from '../../../components/Select'
import ConfirmDialog from '../../../components/ConfirmDialog'

const TYPE_OPTIONS = [
  { value: '아케인', label: '아케인' },
  { value: '어센틱', label: '어센틱' },
  { value: '그랜드 어센틱', label: '그랜드 어센틱' },
]

const inputCls = 'w-full rounded-lg border border-white/10 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50 transition'

function formatMesoKorean(n) {
  if (!n || n <= 0) return ''
  const eok = Math.floor(n / 100_000_000)
  const man = Math.floor((n % 100_000_000) / 10_000)
  const parts = []
  if (eok) parts.push(`${eok}억`)
  if (man) parts.push(`${man.toLocaleString()}만`)
  if (!parts.length) return `${n.toLocaleString()}`
  return parts.join(' ')
}

function MesoInput({ value, onChange, ...rest }) {
  const display = value === '' || value == null ? '' : Number(String(value).replace(/[^\d]/g, '')).toLocaleString()
  const korean = formatMesoKorean(Number(String(value).replace(/[^\d]/g, '')) || 0)
  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, '')
          onChange(digits)
        }}
        className={`${inputCls} tabular-nums text-right`}
        {...rest}
      />
      <div className="text-sm text-amber-300 mt-1 text-right tabular-nums min-h-[18px]">{korean || '\u00A0'}</div>
    </div>
  )
}

function Field({ label, hint, error, required, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-gray-300">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
      {children}
      {error && <div className="text-[11px] text-red-400">{error}</div>}
    </div>
  )
}

export default function SymbolForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const isEdit = !!id
  const fileInputRef = useRef(null)

  const [type, setType] = useState('아케인')
  const [region, setRegion] = useState('')
  const [maxLevel, setMaxLevel] = useState('')
  const [dailyDefault, setDailyDefault] = useState('')
  const [weeklyDefault, setWeeklyDefault] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [levels, setLevels] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  // 편집 시 데이터 로드
  const { data: symbolData } = useQuery({
    queryKey: ['admin', 'symbol', 'symbols', id],
    queryFn: () => api(`/api/admin/symbol/symbols/${id}`),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!symbolData) return
    setType(symbolData.type)
    setRegion(symbolData.region)
    setMaxLevel(String(symbolData.max_level))
    setDailyDefault(String(symbolData.daily_default ?? ''))
    setWeeklyDefault(String(symbolData.weekly_default ?? ''))
    setExistingImageUrl(symbolData.image_url)
    const rows = Array.from({ length: symbolData.max_level - 1 }, (_, i) => {
      const level = i + 1
      const existing = symbolData.levels.find((l) => l.level === level)
      return {
        level,
        required_count: existing?.required_count ?? '',
        meso_cost: existing?.meso_cost ?? '',
      }
    })
    setLevels(rows)
  }, [symbolData])

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const updateLevel = (idx, field, val) => {
    setLevels((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)))
  }

  const adjustLevelRows = (newMax) => {
    const n = Number(newMax)
    if (!n || n < 2) return
    setLevels((prev) => {
      const rows = Array.from({ length: n - 1 }, (_, i) => {
        const level = i + 1
        return prev.find((l) => l.level === level) || { level, required_count: '', meso_cost: '' }
      })
      return rows
    })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append('type', type)
      formData.append('region', region.trim())
      formData.append('max_level', String(maxLevel))
      formData.append('daily_default', String(Number(dailyDefault) || 0))
      formData.append('weekly_default', String(Number(weeklyDefault) || 0))
      formData.append('levels', JSON.stringify(
        levels
          .filter((l) => l.required_count !== '' || l.meso_cost !== '')
          .map((l) => ({
            level: l.level,
            required_count: Number(l.required_count) || 0,
            meso_cost: Number(l.meso_cost) || 0,
          }))
      ))
      if (imageFile) formData.append('image', imageFile)

      const adminKey = localStorage.getItem('maple-admin-key')
      const url = isEdit ? `/api/admin/symbol/symbols/${id}` : '/api/admin/symbol/symbols'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'x-admin-key': adminKey },
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '저장 실패')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'symbol', 'symbols'] })
      queryClient.invalidateQueries({ queryKey: ['symbol', 'symbols'] })
      navigate('..')
    },
    onError: (err) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api(`/api/admin/symbol/symbols/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'symbol', 'symbols'] })
      queryClient.invalidateQueries({ queryKey: ['symbol', 'symbols'] })
      navigate('..')
    },
    onError: (err) => alert(err.message),
  })

  const handleSubmit = () => {
    setError('')
    if (!type) return setError('심볼 종류를 선택해주세요')
    if (!region.trim()) return setError('지역 이름을 입력해주세요')
    if (!maxLevel || Number(maxLevel) < 2) return setError('만렙을 입력해주세요')
    if (!isEdit && !imageFile) return setError('심볼 이미지를 업로드해주세요')
    saveMutation.mutate()
  }

  const displayImage = imagePreview || existingImageUrl

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{isEdit ? '심볼 편집' : '심볼 추가'}</h2>
        <p className="text-sm text-gray-500 mt-0.5">심볼 정보와 레벨별 필요 개수/메소를 입력합니다</p>
      </div>

      {/* 기본 정보 */}
      <div className="rounded-2xl border border-white/5 bg-gray-900/40 p-6 space-y-5">
        <div className="text-sm font-semibold text-emerald-300">기본 정보</div>

        <Field label="심볼 이미지" required={!isEdit}>
          <label className="flex items-center gap-4 rounded-xl border-2 border-dashed border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 bg-gray-950/50 p-4 transition cursor-pointer">
            <div className="w-32 h-32 rounded-lg bg-gray-900 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
              {displayImage ? (
                <img src={displayImage} alt="" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
              ) : (
                <span className="text-5xl text-gray-700">+</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-300">
                {displayImage ? '클릭하여 이미지 변경' : '클릭하여 이미지 업로드'}
              </div>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF 등 → WebP로 자동 변환됩니다</p>
              {imageFile && (
                <div className="text-xs text-emerald-400 mt-2 truncate">📎 {imageFile.name}</div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
        </Field>

        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="심볼 종류" required>
                <Select value={type} onChange={setType} options={TYPE_OPTIONS} />
              </Field>
              <Field label="지역 이름" required hint="예: 소멸의 여로">
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className={inputCls}
                  placeholder="소멸의 여로"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="만렙" required>
                <input
                  type="number"
                  value={maxLevel}
                  onChange={(e) => { setMaxLevel(e.target.value); adjustLevelRows(e.target.value) }}
                  className={inputCls}
                  min="2"
                />
              </Field>
              <Field label="기본 일퀘 획득량">
                <input
                  type="number"
                  value={dailyDefault}
                  onChange={(e) => setDailyDefault(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="기본 주간퀘 획득량">
                <input
                  type="number"
                  value={weeklyDefault}
                  onChange={(e) => setWeeklyDefault(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

          </div>
      </div>

      {/* 레벨별 설정 */}
      <div className="rounded-2xl border border-white/5 bg-gray-900/40 p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-semibold text-emerald-300">레벨별 필요 개수 · 메소</div>
          <div className="text-xs text-gray-500">레벨 N → N+1 업그레이드 기준 (만렙-1행)</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-white/5">
                <th className="py-2 px-3 text-left font-medium w-20">레벨</th>
                <th className="py-2 px-3 text-left font-medium">필요 심볼 수</th>
                <th className="py-2 px-3 text-left font-medium">메소</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {levels.map((l, idx) => (
                <tr key={l.level}>
                  <td className="py-1.5 px-3 text-gray-400 tabular-nums">
                    Lv.<span className="text-gray-200 font-semibold">{l.level}</span>
                    <span className="text-gray-600 mx-1">→</span>
                    {l.level + 1}
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      type="number"
                      value={l.required_count}
                      onChange={(e) => updateLevel(idx, 'required_count', e.target.value)}
                      className={`${inputCls} max-w-36`}
                      placeholder="0"
                    />
                  </td>
                  <td className="py-1.5 px-3">
                    <div className="max-w-48">
                      <MesoInput
                        value={l.meso_cost}
                        onChange={(v) => updateLevel(idx, 'meso_cost', v)}
                        placeholder="0"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          {isEdit && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 px-4 py-2 text-sm font-medium transition"
            >
              삭제
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('..')}
            className="rounded-lg border border-white/10 hover:bg-white/5 text-gray-300 px-4 py-2 text-sm transition"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2 text-sm font-semibold shadow-lg shadow-emerald-500/20 transition"
          >
            {saveMutation.isPending ? '저장 중...' : isEdit ? '저장' : '추가'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-sm px-4 py-2">
          {error}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); deleteMutation.mutate() }}
        title="심볼 삭제"
        description={'이 심볼을 삭제하시겠습니까?\n레벨별 데이터도 함께 삭제됩니다.'}
        confirmText="삭제"
        destructive
      />
    </div>
  )
}
