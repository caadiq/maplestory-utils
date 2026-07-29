import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import FormField, { formInputClass, formInputStyle } from '../../../components/common/FormField'
import DatePicker from '../../../components/common/DatePicker'
import { PageHeader, Panel, Button } from '../../admin/pc/components/ui'
import ImagePicker from '../../admin/pc/components/ImagePicker'

export default function LiberationAdmin() {
  const queryClient = useQueryClient()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [multiplier, setMultiplier] = useState('3')
  const [imageId, setImageId] = useState(null)
  const [image, setImage] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef(null)
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

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
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
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


  return (
    <div className="space-y-5 max-w-[780px] mx-auto">
      <PageHeader
        title="해방 날짜 계산기"
        description="해방 계산기에 표시되는 제네시스 패스 시즌·배수·기간을 설정합니다"
      />

      <Panel title="제네시스 패스 설정">
        <div className="p-5 space-y-5">
        <p className="text-[13px] leading-relaxed px-3 py-2.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--mpl-row)' }}>
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
                borderColor: 'var(--mpl-card-line)',
                background: 'linear-gradient(180deg, #f4f7fa, #e6ecf2)',
              }}
            >
              {image?.url
                ? <img src={image.url} alt={image.name} className="max-w-[52px] max-h-[52px] object-contain" style={{ imageRendering: 'pixelated' }} />
                : <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>없음</span>}
            </div>
            <Button variant="ghost" onClick={() => setPickerOpen(true)}>
              {image ? '이미지 변경' : '이미지 선택'}
            </Button>
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

        <div className="flex items-center justify-end gap-3 pt-1">
          {saved && <span className="text-[13px]" style={{ color: 'var(--accent-bright)' }}>저장되었습니다</span>}
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
        </div>
      </Panel>

      <ImagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentImageId={imageId}
        onSelect={(img) => { setImageId(img?.id || null); setImage(img) }}
      />
    </div>
  )
}
