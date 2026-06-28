import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import Modal from '../../../../components/common/Modal'
import { DIFFICULTIES, formatMeso } from '../admin/constants'
import { LABEL_EN } from '../../logic'

// 난이도 칩 테두리: easy/normal/hard는 bg=border라 안 보이므로 어두운 테두리로 대체 (BossSelector와 동일 규칙)
function chipBorder(d) {
  return d.colors.border === d.colors.bg ? 'rgba(0, 0, 0, 0.55)' : d.colors.border
}

export default function BossPriceTableModal({ open, onClose, bosses }) {
  return (
    <Modal open={open} onClose={onClose} title="결정석 가격표" maxWidth="max-w-4xl">
      <OverlayScrollbarsComponent
        className="flex-1 min-h-0 px-6 py-5"
        options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 } }}
        defer
      >
        <table className="w-full text-base border-collapse">
          <thead>
            <tr>
              <th
                className="sticky top-0 z-10 text-left font-medium px-3 py-3"
                style={{ background: 'var(--dialog-bg-from)', color: 'var(--text-muted)' }}
              >
                보스
              </th>
              {DIFFICULTIES.map((d) => (
                <th key={d.key} className="sticky top-0 z-10 px-3 py-3" style={{ background: 'var(--dialog-bg-from)' }}>
                  <span
                    className="inline-block rounded-full px-3.5 py-1 text-xs font-bold tracking-wider"
                    style={{ background: d.colors.bg, color: d.colors.text, border: `1.5px solid ${chipBorder(d)}` }}
                  >
                    {LABEL_EN[d.key] || d.key.toUpperCase()}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bosses.map((boss) => (
              <tr key={boss.id} className="border-t" style={{ borderColor: 'var(--row-divider)' }}>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <img src={boss.image_url || '/default.png'} alt="" loading="lazy" decoding="async" className="w-11 h-11 rounded-md object-cover shrink-0" />
                    <span className="font-medium whitespace-nowrap" style={{ color: 'var(--text-strong)' }}>{boss.name}</span>
                  </div>
                </td>
                {DIFFICULTIES.map((d) => {
                  const bd = boss.difficulties.find((x) => x.difficulty === d.key)
                  return (
                    <td
                      key={d.key}
                      className="px-3 py-3 text-right tabular-nums"
                      style={{ color: bd ? 'var(--accent-bright)' : 'var(--text-dim)' }}
                    >
                      {bd ? formatMeso(bd.crystal_price) : '-'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </OverlayScrollbarsComponent>
    </Modal>
  )
}
