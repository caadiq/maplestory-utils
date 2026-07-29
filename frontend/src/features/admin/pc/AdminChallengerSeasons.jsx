import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import Modal from '../../../components/common/Modal'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import DatePicker from '../../../components/common/DatePicker'
import FormField, { formInputClass, formInputStyle } from '../../../components/common/FormField'

function formatPeriod(s) {
  return `${s.start_date} ~ ${s.end_date}`
}

function isActive(s) {
  const today = new Date().toISOString().slice(0, 10)
  return s.start_date <= today && today <= s.end_date
}

function SeasonModal({ open, onClose, season, onSave, saving, error }) {
  const [seasonNumber, setSeasonNumber] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (!open) return
    setSeasonNumber(season ? String(season.season_number) : '')
    setStartDate(season?.start_date || '')
    setEndDate(season?.end_date || '')
  }, [open, season])

  const valid = seasonNumber && Number(seasonNumber) > 0 && startDate && endDate && startDate <= endDate

  return (
    <Modal open={open} onClose={onClose} title={season ? '시즌 수정' : '시즌 추가'} maxWidth="max-w-lg">
      <div className="p-5 space-y-4">
        <FormField label="시즌 번호" required>
          <input
            type="number"
            min="1"
            value={seasonNumber}
            onChange={(e) => setSeasonNumber(e.target.value)}
            placeholder="예: 4"
            className={formInputClass}
            style={formInputStyle}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="시작일" required>
            <DatePicker value={startDate} onChange={setStartDate} placeholder="시작일 선택" />
          </FormField>
          <FormField label="종료일" required>
            <DatePicker value={endDate} onChange={setEndDate} placeholder="종료일 선택" />
          </FormField>
        </div>
        {startDate && endDate && startDate > endDate && (
          <p className="text-sm" style={{ color: 'var(--danger-text)' }}>종료일이 시작일보다 빠릅니다</p>
        )}
        {error && <p className="text-sm" style={{ color: 'var(--danger-text)' }}>{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--btn-bg)', color: 'var(--text-strong)', border: '1px solid var(--btn-border)' }}
          >
            취소
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={() => onSave({ season_number: Number(seasonNumber), start_date: startDate, end_date: endDate })}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function AdminChallengerSeasons() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [saveError, setSaveError] = useState('')

  const { data: seasons = [], isLoading } = useQuery({
    queryKey: ['admin', 'challenger-seasons'],
    queryFn: () => api('/api/admin/challenger-seasons'),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'challenger-seasons'] })
    queryClient.invalidateQueries({ queryKey: ['boss-crystal', 'bosses'] })
  }

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const url = editing
        ? `/api/admin/challenger-seasons/${editing.id}`
        : '/api/admin/challenger-seasons'
      return api(url, { method: editing ? 'PATCH' : 'POST', body: data })
    },
    onSuccess: () => {
      invalidate()
      setModalOpen(false)
      setSaveError('')
    },
    onError: (err) => setSaveError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/api/admin/challenger-seasons/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      setConfirmDelete(null)
    },
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">챌린저스 시즌 관리</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
            시즌 기간을 등록하면 그 기간에 해당 시즌의 시즌보스가 챌린저스 월드 캐릭터에게 노출됩니다
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setSaveError(''); setModalOpen(true) }}
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}
        >
          + 시즌 추가
        </button>
      </div>

      {isLoading ? (
        <div className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--skeleton-bg)' }} />
      ) : seasons.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-12 text-center text-sm"
          style={{ borderColor: 'var(--dashed-border)', color: 'var(--text-dim)' }}
        >
          등록된 시즌이 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {seasons.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-4 rounded-xl border px-5 py-4"
              style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
            >
              <span className="text-base font-semibold">챌린저스 {s.season_number}시즌</span>
              {isActive(s) && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                  style={{ background: 'var(--selected-bg)', color: 'var(--accent-bright)', border: '1px solid var(--selected-border)' }}
                >
                  진행 중
                </span>
              )}
              <span className="flex-1 text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {formatPeriod(s)}
              </span>
              <button
                type="button"
                onClick={() => { setEditing(s); setSaveError(''); setModalOpen(true) }}
                className="rounded-lg px-3 py-1.5 text-sm"
                style={{ background: 'var(--btn-bg)', border: '1px solid var(--btn-border)' }}
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(s)}
                className="rounded-lg px-3 py-1.5 text-sm"
                style={{ background: 'var(--btn-bg)', border: '1px solid var(--btn-border)', color: 'var(--danger-text)' }}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      <SeasonModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        season={editing}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
        error={saveError}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        title="시즌 삭제"
        description={confirmDelete ? `챌린저스 ${confirmDelete.season_number}시즌을 삭제할까요?` : ''}
        confirmText="삭제"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
