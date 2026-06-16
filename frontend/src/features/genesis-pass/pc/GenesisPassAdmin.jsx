import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import FormField, { formInputClass, formInputStyle } from '../../../components/common/FormField'
import DatePicker from '../../../components/common/DatePicker'
import ImagePicker from '../../admin/pc/components/ImagePicker'

export default function GenesisPassAdmin() {
  const queryClient = useQueryClient()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [multiplier, setMultiplier] = useState('3')
  const [imageId, setImageId] = useState(null)
  const [image, setImage] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const { data } = useQuery({
    queryKey: ['admin', 'genesis-pass'],
    queryFn: () => api('/api/admin/genesis-pass'),
  })

  useEffect(() => {
    if (!data) return
    setStartDate(data.start_date || '')
    setEndDate(data.end_date || '')
    setMultiplier(String(data.multiplier ?? '3'))
    setImageId(data.image_id ?? null)
    setImage(data.image ?? null)
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => api('/api/admin/genesis-pass', {
      method: 'PATCH',
      body: {
        start_date: startDate || null,
        end_date: endDate || null,
        multiplier: Number(multiplier),
        image_id: imageId,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'genesis-pass'] })
      queryClient.invalidateQueries({ queryKey: ['genesis-pass'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => setError(err.message),
  })

  const handleSubmit = () => {
    setError('')
    const m = Number(multiplier)
    if (isNaN(m) || m <= 0) return setError('배수는 0보다 커야 합니다')
    if (startDate && endDate && startDate > endDate) return setError('시작일이 종료일보다 늦을 수 없습니다')
    saveMutation.mutate()
  }

  const panelStyle = {
    background: 'var(--panel-bg)',
    borderColor: 'var(--panel-border)',
    boxShadow: 'var(--panel-shadow)',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-6">
      <div>
        <h2 className="text-lg font-medium">제네시스 패스</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>
          해방 계산기에 표시되는 제네시스 패스 시즌·배수·기간을 설정합니다.
        </p>
      </div>

      <div className="rounded-2xl border p-6 space-y-5" style={panelStyle}>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          오늘 날짜가 시작일~종료일 사이일 때만 해방 계산기에 패스 카드가 자동으로 표시됩니다.
          시즌이 없을 때는 두 날짜를 비워두세요.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="시작일" hint="이 날짜부터 노출">
            <DatePicker value={startDate} onChange={setStartDate} placeholder="시작일 선택" />
          </FormField>
          <FormField label="종료일" hint="이 날짜까지 노출·적용">
            <DatePicker value={endDate} onChange={setEndDate} placeholder="종료일 선택" />
          </FormField>
        </div>

        <FormField label="포인트 배수" required hint="예: 3 (3배)">
          <input
            type="number"
            step="0.5"
            min="0"
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            className={formInputClass}
            style={formInputStyle}
          />
        </FormField>

        <FormField label="패스 이미지" hint="해방 계산기 카드에 표시됩니다">
          <div className="flex items-center gap-3">
            <div
              className="shrink-0 w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden"
              style={{
                borderColor: 'rgba(252,211,77,0.18)',
                background: 'radial-gradient(circle at 50% 45%, rgba(252,211,77,0.12), rgba(2,6,23,0.6))',
              }}
            >
              {image?.url
                ? <img src={image.url} alt={image.name} className="max-w-[52px] max-h-[52px] object-contain" style={{ imageRendering: 'pixelated' }} />
                : <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>없음</span>}
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-[var(--btn-bg-hover)]"
              style={{ borderColor: 'var(--btn-border)', background: 'var(--btn-bg)', color: 'var(--text-emphasis)' }}
            >
              {image ? '이미지 변경' : '이미지 선택'}
            </button>
            {image && (
              <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{image.name}</span>
            )}
          </div>
        </FormField>

        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--danger-bg-hover)', color: 'var(--danger-text)' }}>
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && <span className="text-sm" style={{ color: 'var(--accent-bright)' }}>저장되었습니다</span>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
          >
            {saveMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <ImagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentImageId={imageId}
        onSelect={(img) => { setImageId(img?.id || null); setImage(img) }}
      />
    </div>
  )
}
