import { useState } from 'react'
import Modal from '../../../components/common/Modal'

/**
 * 캐릭터 프로필 관리.
 *
 * 이름표는 화면에서 잘라낸 닉네임 조각 자체다 — 글자를 읽지 않으므로(OCR 아님)
 * 문자열이 없다. 메모는 사용자가 적는 것이고 비워둬도 된다
 * ("비머비숍"보다 "본섭"이 실제로 더 쓸모 있다).
 */

const SW = [
  ['alarmEnabled', '야누스'],
  ['runeEnabled', '룬'],
  ['boosterEnabled', '부스터'],
  ['stallEnabled', '동꼽'],
]

function Summary({ settings }) {
  return (
    <span className="text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
      {SW.map(([k, label], i) => (
        <span key={k}>
          {i > 0 && ' · '}
          {label}{' '}
          <b style={{ color: settings?.[k] ? 'var(--text-dim)' : 'var(--danger-text)' }}>
            {settings?.[k] ? '켬' : '끔'}
          </b>
        </span>
      ))}
    </span>
  )
}

export default function ProfileDialog({
  open, onClose, profiles, currentId, capturing,
  onAdd, onMemo, onSaveSettings, onRemove, onPick,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const add = async () => {
    setBusy(true)
    setError(null)
    try {
      const msg = await onAdd()
      if (msg) setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`캐릭터 프로필${profiles.length ? ` (${profiles.length})` : ''}`}
      maxWidth="max-w-xl"
    >
      <div className="flex flex-col">
        <p className="px-4 pt-3 text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
          캐릭터를 바꾸면 그 캐릭터의 알림 설정으로 자동으로 갈아끼웁니다.
          {profiles.length === 1 && ' 프로필이 둘 이상이어야 전환이 시작됩니다.'}
        </p>

        {profiles.length === 0 && (
          <p className="px-4 py-6 text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
            아직 등록한 캐릭터가 없습니다.<br />
            게임 화면을 공유한 상태에서 아래 버튼을 눌러 주세요.
          </p>
        )}

        {profiles.map((p) => {
          const on = p.id === currentId
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderTop: '1px solid var(--mpl-card-line)',
                background: on ? 'var(--selected-bg)' : undefined,
              }}
            >
              {/* 잘라낸 조각이 곧 이름표 — 픽셀을 뭉개지 않게 확대한다 */}
              <button
                type="button"
                title="이 프로필로 지금 바꾸기"
                onClick={() => onPick(p.id)}
                className="shrink-0 rounded-md overflow-hidden"
                style={{ border: '1px solid var(--mpl-card-line)', background: '#0a1016', lineHeight: 0 }}
              >
                {p.thumb
                  ? <img src={p.thumb} alt="" style={{ height: 34, imageRendering: 'pixelated', display: 'block' }} />
                  : <span className="block px-3 py-2 text-[12px]" style={{ color: 'var(--text-dim)' }}>조각 없음</span>}
              </button>

              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <input
                    value={p.memo || ''}
                    placeholder="메모 (선택)"
                    onChange={(e) => onMemo(p.id, e.target.value)}
                    className="rounded-md px-2 py-1 text-[13px] font-bold outline-none"
                    style={{
                      width: 130,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text-emphasis)',
                    }}
                  />
                  {on && (
                    <span
                      className="text-[11.5px] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap"
                      style={{
                        color: '#3d8b1f',
                        background: 'rgba(143,209,79,.16)',
                        borderColor: 'rgba(143,209,79,.5)',
                      }}
                    >
                      ● 지금 이 캐릭터
                    </span>
                  )}
                </div>
                <Summary settings={p.settings} />
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSaveSettings(p.id)}
                  className="rounded-md px-2.5 py-1 text-[12px] font-bold"
                  style={{
                    background: 'var(--btn-bg)',
                    border: '1px solid var(--btn-border)',
                    color: 'var(--text-emphasis)',
                  }}
                >
                  지금 설정 저장
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  className="rounded-md px-2.5 py-1 text-[12px] font-bold"
                  style={{ background: 'var(--btn-bg)', border: '1px solid #f0c2bd', color: 'var(--danger-text)' }}
                >
                  삭제
                </button>
              </div>
            </div>
          )
        })}

        {error && (
          <p className="px-4 pt-3 text-[13px]" style={{ color: 'var(--danger-text)' }}>{error}</p>
        )}

        <div
          className="flex gap-2 px-4 py-3"
          style={{ borderTop: '1px solid var(--mpl-card-line)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border px-4 py-2 text-sm"
            style={{ background: 'var(--btn-bg)', borderColor: 'var(--btn-border)', color: 'var(--text-emphasis)' }}
          >
            닫기
          </button>
          <button
            type="button"
            onClick={add}
            disabled={busy || capturing}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              boxShadow: 'var(--btn-primary-shadow)',
            }}
          >
            {busy ? '읽는 중…' : '+ 지금 캐릭터 추가'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
