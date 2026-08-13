/**
 * 모바일 캐릭터 칩 — 가로 스크롤 목록의 한 항목.
 *
 * 여러 기능(보스·심볼·헥사)이 같은 모양을 쓴다.
 * 규격(이미지 64px·이름 16px·선택 링)을 한 곳에 두어 한꺼번에 조정할 수 있게 한다.
 *
 * @param footer  이름·레벨 아래 한 줄 더 (보스 계산기의 주간 수익 등). 없으면 2줄.
 * @param onSelect 칩 탭
 * @param onRemove 우상단 ✕ 탭 (내부에서 stopPropagation 처리 — 순수 삭제 액션만 넘기면 된다)
 */
export default function CharacterChip({ char, active, onSelect, onRemove, footer }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative shrink-0 rounded-2xl border p-3 pr-9 text-left active:scale-[0.98] transition-transform"
      style={active
        ? { background: 'var(--mpl-card)', borderColor: 'transparent', boxShadow: 'inset 0 0 0 2px var(--selected-border), 0 3px 10px rgba(134,201,62,.25)' }
        : { background: 'var(--mpl-card)', borderColor: 'transparent', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'var(--surface-nested)' }}>
          {char.character_image
            ? <img src={char.character_image} alt="" className="w-full h-full object-contain scale-[2.1] origin-center select-none" style={{ imageRendering: 'pixelated' }} draggable={false} loading="lazy" decoding="async" />
            : <span className="text-2xl" style={{ color: 'var(--text-dim)' }}>?</span>}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            {char.world_icon && (
              <img src={char.world_icon} alt="" className="w-5 h-5 shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />
            )}
            <div className="text-base font-semibold truncate max-w-[9rem]" style={{ color: active ? 'var(--accent-bright)' : 'var(--text-strong)' }}>{char.character_name}</div>
          </div>
          <div className="text-xs truncate max-w-[9rem] mt-0.5" style={{ color: 'var(--text-dim)' }}>Lv.{char.character_level} · {char.job_name}</div>
          {footer}
        </div>
      </div>
      <span
        role="button"
        tabIndex={-1}
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full text-sm"
        style={{ color: 'var(--text-dim)' }}
      >
        ×
      </span>
    </button>
  )
}
