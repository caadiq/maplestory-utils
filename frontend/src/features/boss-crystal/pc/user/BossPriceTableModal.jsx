import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import Modal from '../../../../components/common/Modal'
import { DIFFICULTIES, formatMeso } from '../admin/constants'
import { LABEL_EN } from '../../logic'

// 난이도 칩 테두리: easy/normal/hard는 bg=border라 안 보이므로 어두운 테두리로 대체 (BossSelector와 동일 규칙)
function chipBorder(d) {
  return d.colors.border === d.colors.bg ? 'rgba(0, 0, 0, 0.55)' : d.colors.border
}

// 난이도별 가격 텍스트 색 (칩 색과 매칭해 열 구분이 잘 되도록)
const PRICE_COLOR = {
  easy: '#6e7d8d',
  normal: '#2196ad',
  hard: '#d63d82',
  chaos: '#b07a1f',
  extreme: '#e02b4e',
}

// 열: 보스 | 난이도 5종 — 헤더는 스크롤 영역 밖에 고정 (sticky는 행이 헤더 위로 비치는 문제가 있어 미사용)
const GRID = 'grid grid-cols-[minmax(180px,1fr)_repeat(5,116px)] items-center'

export default function BossPriceTableModal({ open, onClose, bosses }) {
  return (
    <Modal open={open} onClose={onClose} title="결정석 가격표" maxWidth="max-w-4xl">
      {/* 표 헤더 (청회색 필 바, 고정) */}
      <div className="px-5 pt-4 shrink-0">
        <div
          className={`${GRID} px-3 py-2 rounded-lg`}
          style={{ background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))' }}
        >
          <span className="text-sm font-bold" style={{ color: '#ffffff', textShadow: '0 1px 1px rgba(44,55,69,.3)' }}>보스</span>
          {DIFFICULTIES.map((d) => (
            <span key={d.key} className="text-right">
              <span
                className="inline-block rounded-full px-3.5 py-1 text-xs font-bold tracking-wider"
                style={{ background: d.colors.bg, color: d.colors.text, border: `1.5px solid ${chipBorder(d)}` }}
              >
                {LABEL_EN[d.key] || d.key.toUpperCase()}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* 본문 (스크롤) */}
      <OverlayScrollbarsComponent
        className="flex-1 min-h-0 px-5 pb-4"
        options={{ scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 } }}
        defer
      >
        {bosses.map((boss, i) => (
          <div
            key={boss.id}
            className={`${GRID} px-2 py-2.5 rounded-lg`}
            style={{ background: i % 2 === 1 ? 'var(--row-hover-bg)' : 'transparent' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <img src={boss.image_url || '/default.png'} alt="" loading="lazy" decoding="async" className="w-10 h-10 rounded-md object-cover shrink-0" />
              <span className="font-medium truncate" style={{ color: 'var(--text-strong)' }}>{boss.name}</span>
            </div>
            {DIFFICULTIES.map((d) => {
              const bd = boss.difficulties.find((x) => x.difficulty === d.key)
              return (
                <span
                  key={d.key}
                  className="text-right tabular-nums text-[15px]"
                  style={{ color: bd ? PRICE_COLOR[d.key] : 'var(--text-dim)', fontWeight: bd ? 700 : 400 }}
                >
                  {bd ? formatMeso(bd.crystal_price) : '-'}
                </span>
              )
            })}
          </div>
        ))}
      </OverlayScrollbarsComponent>
    </Modal>
  )
}
