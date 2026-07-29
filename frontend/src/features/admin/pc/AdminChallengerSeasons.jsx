import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import Modal from '../../../components/common/Modal'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { PageHeader, Panel, Row, Button, EmptyBox } from './components/ui'
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
    <div>
      <PageHeader
        title="챌린저스 시즌 관리"
        description="시즌 기간을 등록하면 그 기간에 해당 시즌의 시즌보스가 챌린저스 월드 캐릭터에게 노출됩니다"
      >
        <Button onClick={() => { setEditing(null); setSaveError(''); setModalOpen(true) }}>+ 시즌 추가</Button>
      </PageHeader>

      {isLoading ? (
        <Panel>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[62px] animate-pulse border-b last:border-b-0" style={{ background: 'var(--skeleton-bg)', borderColor: 'var(--mpl-card-line)' }} />
          ))}
        </Panel>
      ) : seasons.length === 0 ? (
        <EmptyBox
          icon="🏆"
          text="등록된 시즌이 없습니다"
          action={<Button onClick={() => { setEditing(null); setSaveError(''); setModalOpen(true) }}>첫 시즌 추가하기</Button>}
        />
      ) : (
        <Panel
          columns={(
            <>
              <span className="flex-[2] min-w-0">시즌</span>
              <span className="flex-[3] min-w-0">기간</span>
              <span className="w-[136px] shrink-0 text-right" style={{ color: '#cfdae4' }}>{seasons.length}</span>
            </>
          )}
        >
          {seasons.map((s, i) => (
            <Row key={s.id} index={i}>
              <span className="flex-[2] min-w-0 flex items-center gap-2">
                <span className="text-[15px] font-bold" style={{ color: 'var(--text-strong)' }}>
                  챌린저스 {s.season_number}시즌
                </span>
                {isActive(s) && (
                  <span
                    className="rounded px-2 py-0.5 text-[12px] font-bold shrink-0"
                    style={{ background: 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))', color: '#fff' }}
                  >
                    진행 중
                  </span>
                )}
              </span>
              <span className="flex-[3] min-w-0 text-[14px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {formatPeriod(s)}
              </span>
              <span className="flex items-center gap-1.5 shrink-0 w-[136px] justify-end">
                <Button variant="ghost" onClick={() => { setEditing(s); setSaveError(''); setModalOpen(true) }}>수정</Button>
                <Button variant="dangerGhost" onClick={() => setConfirmDelete(s)}>삭제</Button>
              </span>
            </Row>
          ))}
        </Panel>
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
