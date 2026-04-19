import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import ImagePicker from './components/ImagePicker'
import ConfirmDialog from '../../components/ConfirmDialog'

function Field({ label, hint, error, required, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium" style={{ color: 'var(--text-emphasis)' }}>
          {label} {required && <span style={{ color: 'var(--danger-text)' }}>*</span>}
        </label>
        {hint && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{hint}</span>}
      </div>
      {children}
      {error && <div className="text-[11px]" style={{ color: 'var(--danger-text)' }}>{error}</div>}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]'
const inputStyle = {
  background: 'var(--input-bg)',
  borderColor: 'var(--input-border)',
  color: 'var(--text-strong)',
}

export default function AdminMenuForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const isEdit = !!id

  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    slug: '',
    image_id: null,
    image: null,
  })
  const [errors, setErrors] = useState({})

  const { data: menuData } = useQuery({
    queryKey: ['admin', 'menus', id],
    queryFn: () => api(`/api/admin/menus/${id}`),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!isEdit) {
      setForm({ title: '', description: '', slug: '', image_id: null, image: null })
      return
    }
    if (menuData) {
      setForm({
        title: menuData.title || '',
        description: menuData.description || '',
        slug: (menuData.url || '').replace(/^\/+/, ''),
        image_id: menuData.image_id,
        image: menuData.image,
      })
    }
  }, [isEdit, id, menuData])

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const handleSlugChange = (value) => {
    update({ slug: value.replace(/^\/+/, '') })
  }

  const fullUrl = `/${form.slug.trim()}`

  const validate = () => {
    const errs = {}
    if (!form.title.trim()) errs.title = '제목을 입력해주세요'
    if (!form.slug.trim()) errs.slug = '경로를 입력해주세요'
    else if (!/^[a-zA-Z0-9\-/]+$/.test(form.slug.trim())) errs.slug = '영문, 숫자, 하이픈(-), 슬래시(/)만 사용할 수 있습니다'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        url: fullUrl,
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

  const deleteMutation = useMutation({
    mutationFn: () => api(`/api/admin/menus/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'menus'] })
      queryClient.invalidateQueries({ queryKey: ['menus'] })
      navigate('/admin')
    },
    onError: (err) => alert(err.message),
  })

  return (
    <div className="space-y-6 max-w-2xl mx-auto pt-6">
      <div>
        <h2 className="text-lg font-medium">{isEdit ? '메뉴 항목 편집' : '메뉴 항목 추가'}</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>
          홈 화면에 표시되는 카드의 정보를 설정합니다
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border p-6"
        style={{
          background: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          boxShadow: 'var(--panel-shadow)',
        }}
      >
        {/* 미리보기 */}
        <div
          className="rounded-xl border p-4"
          style={{
            background: 'var(--surface-3)',
            borderColor: 'var(--panel-border)',
          }}
        >
          <div className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>미리보기</div>
          <div
            className="rounded-xl border p-5"
            style={{
              backgroundImage: 'linear-gradient(to bottom right, var(--card-bg-from), var(--card-bg-to))',
              borderColor: 'var(--card-border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden"
                style={{
                  backgroundImage: 'linear-gradient(to bottom right, var(--icon-box-from), var(--icon-box-to))',
                  borderColor: 'var(--icon-box-border)',
                }}
              >
                <img src={form.image?.url || '/default.png'} alt="" className="w-9 h-9 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium">{form.title || '제목 없음'}</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {form.description || '설명 없음'}
                </p>
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
            style={inputStyle}
          />
        </Field>

        <Field label="설명" hint="카드에 표시되는 부가 설명">
          <input
            type="text"
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="예: 캐릭터별 보스 결정석 수익을 계산합니다"
            className={inputCls}
            style={inputStyle}
          />
        </Field>

        <Field label="경로" required error={errors.slug}>
          <div
            className="flex items-stretch rounded-lg border focus-within:border-[var(--input-border-focus)] hover:border-[var(--input-border-hover)]"
            style={{
              background: 'var(--input-bg)',
              borderColor: errors.slug ? 'var(--icon-danger-border)' : 'var(--input-border)',
            }}
          >
            <span
              className="flex items-center px-3 text-sm border-r select-none"
              style={{ color: 'var(--text-dim)', borderColor: 'var(--input-border)' }}
            >
              /
            </span>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="boss-crystal"
              className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none"
              style={{ color: 'var(--text-strong)' }}
            />
          </div>
          {form.slug.trim() && !errors.slug && (
            <div className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
              <span>전체 URL:</span>
              <code
                className="px-1.5 py-0.5 rounded"
                style={{
                  color: 'var(--accent-bright)',
                  background: 'var(--surface-3)',
                }}
              >
                https://maple.caadiq.co.kr{fullUrl}
              </code>
            </div>
          )}
        </Field>

        <Field label="아이콘 이미지" hint="선택사항">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-16 h-16 rounded-lg border flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-[var(--selected-border)]"
              style={{
                background: 'var(--input-bg)',
                borderColor: 'var(--input-border)',
              }}
            >
              {form.image?.url ? (
                <img src={form.image.url} alt="" className="max-w-[80%] max-h-[80%] object-contain" />
              ) : (
                <span className="text-2xl" style={{ color: 'var(--text-dim)' }}>+</span>
              )}
            </button>
            <div className="flex-1 min-w-0">
              {form.image ? (
                <>
                  <div className="text-sm font-medium truncate">{form.image.name}</div>
                  <button
                    type="button"
                    onClick={() => update({ image_id: null, image: null })}
                    className="text-xs mt-1 hover:text-[var(--danger-text-strong)]"
                    style={{ color: 'var(--danger-text)' }}
                  >
                    이미지 제거
                  </button>
                </>
              ) : (
                <div className="text-sm" style={{ color: 'var(--text-dim)' }}>이미지 선택</div>
              )}
            </div>
          </div>
        </Field>

        <div className="flex items-center gap-2 pt-2">
          {isEdit && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border px-4 py-2.5 text-sm hover:bg-[var(--danger-bg-hover)]"
              style={{
                borderColor: 'var(--icon-danger-border)',
                color: 'var(--danger-text)',
              }}
            >
              삭제
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="rounded-lg border px-5 py-2.5 text-sm hover:bg-[var(--btn-bg-hover)]"
            style={{
              background: 'var(--btn-bg)',
              borderColor: 'var(--btn-border)',
              color: 'var(--text-emphasis)',
            }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-[var(--btn-primary-bg-hover)]"
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              boxShadow: 'var(--btn-primary-shadow)',
            }}
          >
            {saveMutation.isPending ? '저장 중...' : (isEdit ? '저장' : '추가')}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="메뉴 삭제"
        description={`"${form.title}" 메뉴를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        destructive
        loading={deleteMutation.isPending}
      />

      <ImagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentImageId={form.image_id}
        onSelect={(img) => update({ image_id: img?.id || null, image: img })}
      />
    </div>
  )
}
