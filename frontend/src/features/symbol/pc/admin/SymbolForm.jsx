import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../../api/client'
import Select from '../../../../components/common/Select'
import ConfirmDialog from '../../../../components/common/ConfirmDialog'
import FormField, { formInputClass, formInputStyle } from '../../../../components/common/FormField'
import { formatMeso } from '../../../../utils/formatting'

const TYPE_OPTIONS = [
  { value: '아케인', label: '아케인' },
  { value: '어센틱', label: '어센틱' },
  { value: '그랜드 어센틱', label: '그랜드 어센틱' },
]

function MesoInput({ value, onChange, ...rest }) {
  const display = value === '' || value == null ? '' : Number(String(value).replace(/[^\d]/g, '')).toLocaleString()
  const korean = formatMeso(Number(String(value).replace(/[^\d]/g, '')) || 0)
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
        className={`${formInputClass} tabular-nums text-right`}
        style={formInputStyle}
        {...rest}
      />
      <div
        className="text-sm mt-1 text-right tabular-nums min-h-[18px]"
        style={{ color: 'var(--warning-text-bright)' }}
      >
        {korean === '0' ? '\u00A0' : korean}
      </div>
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

      const url = isEdit ? `/api/admin/symbol/symbols/${id}` : '/api/admin/symbol/symbols'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
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

  const panelStyle = {
    background: 'var(--panel-bg)',
    borderColor: 'var(--panel-border)',
    boxShadow: 'var(--panel-shadow)',
  }

  return (
    <div className="space-y-5 max-w-[780px] mx-auto">
      <div>
        <h2 className="text-[20px] font-bold" style={{ color: 'var(--text-strong)' }}>{isEdit ? '심볼 편집' : '심볼 추가'}</h2>
        <p className="text-[14px] mt-1" style={{ color: 'var(--text-muted)' }}>심볼 정보와 레벨별 필요 개수/메소를 입력합니다</p>
      </div>

      {/* 기본 정보 */}
      <div className="rounded-2xl border p-6 space-y-5" style={panelStyle}>
        <div className="text-sm font-semibold" style={{ color: 'var(--accent-bright)' }}>기본 정보</div>

        <FormField label="심볼 이미지" required={!isEdit}>
          <label
            className="flex items-center gap-4 rounded-xl border-2 border-dashed p-4 cursor-pointer hover:border-[var(--selected-border)]"
            style={{
              background: 'var(--surface-3)',
              borderColor: 'var(--dashed-border)',
            }}
          >
            <div
              className="w-32 h-32 rounded-lg border flex items-center justify-center overflow-hidden shrink-0"
              style={{
                background: 'var(--surface-nested)',
                borderColor: 'var(--panel-border)',
              }}
            >
              {displayImage ? (
                <img src={displayImage} alt="" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
              ) : (
                <span className="text-5xl" style={{ color: 'var(--text-dim)' }}>+</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: 'var(--text-emphasis)' }}>
                {displayImage ? '클릭하여 이미지 변경' : '클릭하여 이미지 업로드'}
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>PNG, JPG, GIF 등 → WebP로 자동 변환됩니다</p>
              {imageFile && (
                <div className="text-xs mt-2 truncate" style={{ color: 'var(--accent-bright)' }}>📎 {imageFile.name}</div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
        </FormField>

        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="심볼 종류" required>
                <Select value={type} onChange={setType} options={TYPE_OPTIONS} />
              </FormField>
              <FormField label="지역 이름" required hint="예: 소멸의 여로">
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className={formInputClass}
                  style={formInputStyle}
                  placeholder="소멸의 여로"
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="만렙" required>
                <input
                  type="number"
                  value={maxLevel}
                  onChange={(e) => { setMaxLevel(e.target.value); adjustLevelRows(e.target.value) }}
                  className={formInputClass}
                  style={formInputStyle}
                  min="2"
                />
              </FormField>
              <FormField label="기본 일퀘 획득량">
                <input
                  type="number"
                  value={dailyDefault}
                  onChange={(e) => setDailyDefault(e.target.value)}
                  className={formInputClass}
                  style={formInputStyle}
                />
              </FormField>
              <FormField label="기본 주간퀘 획득량">
                <input
                  type="number"
                  value={weeklyDefault}
                  onChange={(e) => setWeeklyDefault(e.target.value)}
                  className={formInputClass}
                  style={formInputStyle}
                />
              </FormField>
            </div>
        </div>
      </div>

      {/* 레벨별 설정 */}
      <div className="rounded-2xl border p-6 space-y-4" style={panelStyle}>
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-semibold" style={{ color: 'var(--accent-bright)' }}>레벨별 필요 개수 · 메소</div>
          <div className="text-xs" style={{ color: 'var(--text-dim)' }}>레벨 N → N+1 업그레이드 기준 (만렙-1행)</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase border-b" style={{ color: 'var(--text-dim)', borderColor: 'var(--panel-border)' }}>
                <th className="py-2 px-3 text-left font-medium w-20">레벨</th>
                <th className="py-2 px-3 text-left font-medium">필요 심볼 수</th>
                <th className="py-2 px-3 text-left font-medium">메소</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((l, idx) => (
                <tr key={l.level} className="border-t first:border-t-0" style={{ borderColor: 'var(--row-divider)' }}>
                  <td className="py-1.5 px-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    Lv.<span className="font-semibold" style={{ color: 'var(--text-emphasis)' }}>{l.level}</span>
                    <span className="mx-1" style={{ color: 'var(--text-dim)' }}>→</span>
                    {l.level + 1}
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      type="number"
                      value={l.required_count}
                      onChange={(e) => updateLevel(idx, 'required_count', e.target.value)}
                      className={`${formInputClass} max-w-36`}
                      style={formInputStyle}
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
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-[var(--danger-bg-hover)]"
              style={{
                borderColor: 'var(--icon-danger-border)',
                background: 'var(--icon-danger-bg)',
                color: 'var(--danger-text)',
              }}
            >
              삭제
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('..')}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-[var(--btn-bg-hover)]"
            style={{
              background: 'var(--btn-bg)',
              borderColor: 'var(--btn-border)',
              color: 'var(--text-emphasis)',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-[var(--btn-primary-bg-hover)]"
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              boxShadow: 'var(--btn-primary-shadow)',
            }}
          >
            {saveMutation.isPending ? '저장 중...' : isEdit ? '저장' : '추가'}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg border text-sm px-4 py-2"
          style={{
            borderColor: 'var(--icon-danger-border)',
            background: 'var(--icon-danger-bg)',
            color: 'var(--danger-text)',
          }}
        >
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
