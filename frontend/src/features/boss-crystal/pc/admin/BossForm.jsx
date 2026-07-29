import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../../api/client'
import ConfirmDialog from '../../../../components/common/ConfirmDialog'
import Checkbox from '../../../../components/common/Checkbox'
import Select from '../../../../components/common/Select'
import FormField, { formInputClass, formInputStyle } from '../../../../components/common/FormField'
import { DIFFICULTIES, formatMeso, getDifficultyImageUrl } from './constants'

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}인` }))

function emptyDifficultyState() {
  const obj = {}
  DIFFICULTIES.forEach((d) => {
    obj[d.key] = { enabled: false, crystal_price: '' }
  })
  return obj
}

export default function BossForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const isEdit = !!id
  const fileInputRef = useRef(null)

  const [name, setName] = useState('')
  const [maxPartySize, setMaxPartySize] = useState(3)
  const [isSeasonBoss, setIsSeasonBoss] = useState(false)
  const [seasonId, setSeasonId] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [difficulties, setDifficulties] = useState(emptyDifficultyState())
  const [errors, setErrors] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 챌린저스 시즌 목록 (시즌보스 지정용)
  const { data: seasons = [] } = useQuery({
    queryKey: ['admin', 'challenger-seasons'],
    queryFn: () => api('/api/admin/challenger-seasons').catch(() => []),
  })

  // 편집 모드 데이터 로드
  const { data: bossData } = useQuery({
    queryKey: ['admin', 'boss-crystal', 'bosses', id],
    queryFn: () => api(`/api/admin/boss-crystal/bosses/${id}`),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!isEdit) {
      setName('')
      setMaxPartySize(3)
      setIsSeasonBoss(false)
      setSeasonId(null)
      setImageFile(null)
      setImagePreview(null)
      setExistingImageUrl(null)
      setDifficulties(emptyDifficultyState())
      return
    }
    if (bossData) {
      setName(bossData.name || '')
      setMaxPartySize(bossData.max_party_size || 3)
      setIsSeasonBoss(bossData.season_id != null)
      setSeasonId(bossData.season_id ?? null)
      setExistingImageUrl(bossData.image_url || null)
      setImagePreview(null)
      setImageFile(null)

      const next = emptyDifficultyState()
      bossData.difficulties?.forEach((d) => {
        next[d.difficulty] = {
          enabled: true,
          crystal_price: String(d.crystal_price),
        }
      })
      setDifficulties(next)
    }
  }, [isEdit, id, bossData])

  const handleImagePick = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const updateDifficulty = (key, patch) => {
    setDifficulties((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const validate = () => {
    const errs = {}
    if (!name.trim()) errs.name = '보스 이름을 입력해주세요'
    if (!isEdit && !imageFile) errs.image = '보스 이미지를 업로드해주세요'
    if (isSeasonBoss && seasonId == null) errs.season = '시즌을 선택해주세요'

    const enabledKeys = DIFFICULTIES.filter((d) => difficulties[d.key].enabled)
    if (enabledKeys.length === 0) {
      errs.difficulties = '하나 이상의 난이도를 선택해주세요'
    } else {
      for (const d of enabledKeys) {
        const v = difficulties[d.key]
        const price = Number(v.crystal_price)
        if (!v.crystal_price || isNaN(price) || price <= 0) {
          errs[`price_${d.key}`] = '가격을 입력해주세요'
        }
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('max_party_size', String(maxPartySize))
      formData.append('season_id', isSeasonBoss && seasonId != null ? String(seasonId) : '')
      if (imageFile) formData.append('image', imageFile)

      const diffsPayload = DIFFICULTIES
        .filter((d) => difficulties[d.key].enabled)
        .map((d) => ({
          difficulty: d.key,
          crystal_price: Number(difficulties[d.key].crystal_price),
        }))
      formData.append('difficulties', JSON.stringify(diffsPayload))

      const url = isEdit
        ? `/api/admin/boss-crystal/bosses/${id}`
        : '/api/admin/boss-crystal/bosses'
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
      queryClient.invalidateQueries({ queryKey: ['admin', 'boss-crystal', 'bosses'] })
      queryClient.invalidateQueries({ queryKey: ['boss-crystal'] })
      navigate('..')
    },
    onError: (err) => alert(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api(`/api/admin/boss-crystal/bosses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'boss-crystal', 'bosses'] })
      queryClient.invalidateQueries({ queryKey: ['boss-crystal'] })
      navigate('..')
    },
    onError: (err) => alert(err.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    saveMutation.mutate()
  }

  const displayImage = imagePreview || existingImageUrl

  return (
    <div className="space-y-5 max-w-[780px]">
      <div>
        <h2 className="text-[20px] font-bold" style={{ color: 'var(--text-strong)' }}>{isEdit ? '보스 편집' : '보스 추가'}</h2>
        <p className="text-[14px] mt-1" style={{ color: 'var(--text-muted)' }}>보스 이름과 난이도별 결정 정보를 입력합니다</p>
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
        {/* 이름 + 최대 인원 */}
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <FormField label="보스 이름" required error={errors.name}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 검은 마법사"
              className={formInputClass}
              style={formInputStyle}
            />
          </FormField>
          <FormField label="최대 인원">
            <Select
              value={maxPartySize}
              onChange={setMaxPartySize}
              options={PARTY_OPTIONS}
              className="w-24"
            />
          </FormField>
        </div>

        {/* 시즌보스 지정 */}
        <FormField
          label="시즌보스"
          error={errors.season}
          hint={seasons.length === 0
            ? '등록된 챌린저스 시즌이 없습니다 (자원 관리 → 챌린저스 시즌 관리에서 추가)'
            : '시즌보스는 해당 챌린저스 시즌 기간에 챌린저스 월드 캐릭터에게만 노출됩니다 (메소 드랍 — 결정석 한도 미포함)'}
        >
          <div className="flex items-center gap-4 h-12">
            <button
              type="button"
              disabled={seasons.length === 0}
              onClick={() => {
                const next = !isSeasonBoss
                setIsSeasonBoss(next)
                if (next && seasonId == null) setSeasonId(seasons[0]?.id ?? null)
                if (errors.season) setErrors((prev) => ({ ...prev, season: undefined }))
              }}
              className="flex items-center gap-2.5 disabled:opacity-50"
            >
              <span
                className="relative shrink-0 rounded-full transition-colors"
                style={{ width: 46, height: 26, background: isSeasonBoss ? 'var(--btn-primary-bg)' : '#374151' }}
              >
                <span
                  className="absolute top-[3px] rounded-full bg-white transition-all"
                  style={{ width: 20, height: 20, left: isSeasonBoss ? 23 : 3 }}
                />
              </span>
              <span className="text-sm" style={{ color: 'var(--text-emphasis)' }}>
                {isSeasonBoss ? '시즌보스' : '일반 보스'}
              </span>
            </button>
            {isSeasonBoss && (
              <Select
                value={seasonId}
                onChange={(val) => {
                  setSeasonId(val)
                  if (errors.season) setErrors((prev) => ({ ...prev, season: undefined }))
                }}
                options={seasons.map((s) => ({ value: s.id, label: `챌린저스 ${s.season_number}시즌` }))}
                placeholder="시즌 선택"
                className="w-48"
              />
            )}
          </div>
        </FormField>

        {/* 이미지 */}
        <FormField label="보스 이미지" required={!isEdit} error={errors.image}>
          <label
            className="flex items-center gap-4 rounded-xl border-2 border-dashed p-4 cursor-pointer hover:border-[var(--selected-border)]"
            style={{
              background: 'var(--surface-3)',
              borderColor: errors.image ? 'var(--icon-danger-border)' : 'var(--dashed-border)',
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
                <img src={displayImage} alt="" className="w-full h-full object-cover" />
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImagePick(e.target.files[0])}
              className="hidden"
            />
          </label>
        </FormField>

        {/* 난이도 */}
        <FormField label="난이도별 결정 정보" required error={errors.difficulties} hint="활성화한 난이도만 저장됩니다">
          <div className="space-y-2">
            {DIFFICULTIES.map((d) => {
              const v = difficulties[d.key]
              const priceErr = errors[`price_${d.key}`]
              return (
                <div
                  key={d.key}
                  className="rounded-lg border p-3"
                  style={{
                    background: 'var(--surface-3)',
                    borderColor: 'var(--panel-border)',
                    opacity: v.enabled ? 1 : 0.6,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center gap-2.5 shrink-0 cursor-pointer select-none"
                      onClick={() => updateDifficulty(d.key, { enabled: !v.enabled })}
                    >
                      <Checkbox
                        checked={v.enabled}
                        onChange={(checked) => updateDifficulty(d.key, { enabled: checked })}
                        tabIndex={-1}
                      />
                      <img
                        src={getDifficultyImageUrl(d.key)}
                        alt={d.label}
                        className="h-5"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={v.crystal_price ? Number(v.crystal_price).toLocaleString() : ''}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^\d]/g, '')
                            updateDifficulty(d.key, { crystal_price: digits })
                          }}
                          disabled={!v.enabled}
                          placeholder="결정 가격"
                          className="w-full rounded-lg border pl-4 pr-28 py-2 text-sm outline-none focus:border-[var(--input-border-focus)] disabled:opacity-50"
                          style={{
                            background: 'var(--input-bg)',
                            borderColor: priceErr ? 'var(--icon-danger-border)' : 'var(--input-border)',
                            color: 'var(--text-strong)',
                          }}
                        />
                        {v.crystal_price && v.enabled && (
                          <span
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none whitespace-nowrap"
                            style={{ color: 'var(--accent-bright)' }}
                          >
                            {formatMeso(Number(v.crystal_price))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </FormField>

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
            onClick={() => navigate('..')}
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
        onConfirm={() => { setConfirmDelete(false); deleteMutation.mutate() }}
        title="보스 삭제"
        description={`"${name}" 보스를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
