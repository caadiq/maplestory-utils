import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import ImagePicker from './components/ImagePicker'

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

const inputCls = 'w-full rounded-lg border border-white/10 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/50 transition'

export default function AdminMenuForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const isEdit = !!id

  const [pickerOpen, setPickerOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    url: '/',
    image_id: null,
    image: null, // 미리보기용 캐시
  })
  const [errors, setErrors] = useState({})

  // 편집 모드일 때 기존 데이터 로드
  useQuery({
    queryKey: ['admin', 'menus', id],
    queryFn: async () => {
      const data = await api(`/api/admin/menus/${id}`)
      setForm({
        title: data.title || '',
        description: data.description || '',
        url: data.url || '/',
        image_id: data.image_id,
        image: data.image,
      })
      return data
    },
    enabled: isEdit,
  })

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const validate = () => {
    const errs = {}
    if (!form.title.trim()) errs.title = '제목을 입력해주세요'
    if (!form.url.trim()) errs.url = 'URL을 입력해주세요'
    else if (!form.url.startsWith('/')) errs.url = 'URL은 /로 시작해야 합니다'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        url: form.url.trim(),
        image_id: form.image_id,
      }
      if (isEdit) {
        return api(`/api/admin/menus/${id}`, { method: 'PATCH', body: payload })
      }
      return api('/api/admin/menus', { method: 'POST', body: payload })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'menus'] })
      queryClient.invalidateQueries({ queryKey: ['menus'] })
      navigate('/admin')
    },
    onError: (err) => alert(err.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    saveMutation.mutate()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">{isEdit ? '메뉴 항목 편집' : '메뉴 항목 추가'}</h2>
        <p className="text-sm text-gray-500 mt-0.5">홈 화면에 표시되는 카드의 정보를 설정합니다</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/5 bg-gray-900/40 p-6">
        {/* 미리보기 */}
        <div className="rounded-xl border border-white/5 bg-gray-950/50 p-4">
          <div className="text-xs text-gray-500 mb-3">미리보기</div>
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-900/40 p-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/5 flex items-center justify-center overflow-hidden">
                <img src={form.image?.url || '/default.png'} alt="" className="w-9 h-9 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{form.title || '제목 없음'}</h3>
                <p className="text-sm text-gray-400 mt-1">{form.description || '설명 없음'}</p>
              </div>
            </div>
          </div>
        </div>

        <Field label="제목" required error={errors.title}>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="예: 주간 보스 수익 계산기"
            className={inputCls}
          />
        </Field>

        <Field label="설명" hint="카드에 표시되는 부가 설명">
          <input
            type="text"
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="예: 캐릭터별 보스 결정석 수익을 계산합니다"
            className={inputCls}
          />
        </Field>

        <Field label="URL" required hint="/로 시작하는 라우트 경로" error={errors.url}>
          <input
            type="text"
            value={form.url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="예: /boss"
            className={inputCls}
          />
        </Field>

        <Field label="아이콘 이미지" hint="선택사항">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-16 h-16 rounded-lg border border-white/10 hover:border-emerald-500/40 bg-gray-950 flex items-center justify-center overflow-hidden transition shrink-0 cursor-pointer"
            >
              {form.image?.url ? (
                <img src={form.image.url} alt="" className="max-w-[80%] max-h-[80%] object-contain" />
              ) : (
                <span className="text-2xl text-gray-700">+</span>
              )}
            </button>
            <div className="flex-1 min-w-0">
              {form.image ? (
                <>
                  <div className="text-sm font-medium truncate">{form.image.name}</div>
                  <button
                    type="button"
                    onClick={() => update({ image_id: null, image: null })}
                    className="text-xs text-red-400 hover:text-red-300 transition mt-1"
                  >
                    이미지 제거
                  </button>
                </>
              ) : (
                <div className="text-sm text-gray-500">이미지 선택</div>
              )}
            </div>
          </div>
        </Field>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5 transition"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-medium disabled:opacity-50 transition shadow-lg shadow-emerald-500/20"
          >
            {saveMutation.isPending ? '저장 중...' : (isEdit ? '저장' : '추가')}
          </button>
        </div>
      </form>

      <ImagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentImageId={form.image_id}
        onSelect={(img) => update({ image_id: img?.id || null, image: img })}
      />
    </div>
  )
}
