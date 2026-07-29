import { useState, useLayoutEffect } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { useBackClose } from '../../../hooks/useBackClose'
import MapleWindow, { MapleWindowTab } from '../../../components/pc/MapleWindow'
import PageLoader from '../../../components/common/PageLoader'
import Select from '../../../components/common/Select'
import { useEnchantData } from '../useEnchantData'
import {
  formatKoreanMeso, formatMesoShort, formatDateParts,
  sfResult, sfCost, flagApplied, isDrop,
  potentialCost, starRangeStats, potentialStats, SORT_OPTIONS,
  GRADE_COLOR, GRADE_COLOR_SOFT,
} from '../logic'

const SLATE_BAR = {
  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  color: '#ffffff',
  textShadow: '0 1px 1px rgba(44,55,69,.3)',
}
const CARD = { background: 'var(--mpl-card)', border: '1px solid var(--mpl-card-line)' }

const BADGE = {
  success: { label: '성공', style: { background: 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))', color: '#fff' } },
  fail: { label: '실패', style: { background: 'linear-gradient(180deg, #c2cdd8, #a8b6c4)', color: '#5c6b7a' } },
  drop: { label: '하락', style: { background: 'linear-gradient(180deg, #f0b661, #dd9231)', color: '#fff' } },
  destroy: { label: '파괴', style: { background: 'linear-gradient(180deg, var(--mpl-red-from), var(--mpl-red-to))', color: '#fff' } },
}
const EDGE = {
  success: '#7cbf3f',
  fail: '#c2cdd8',
  drop: '#dd9231',
  destroy: 'var(--mpl-red-to)',
}

const PAGE_SIZE = 40

// ─────────── 공용 조각 ───────────

function ItemSlot({ url, size = 52 }) {
  return (
    <span
      className="rounded-[10px] flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(180deg, #f4f7fa, #e6ecf2)',
        boxShadow: 'inset 0 0 0 1px var(--mpl-card-line), inset 0 2px 4px rgba(31,44,61,.07)',
      }}
    >
      {url
        ? <img src={url} alt="" draggable={false} loading="lazy" decoding="async"
            style={{ maxWidth: size * 0.66, maxHeight: size * 0.66, objectFit: 'contain', imageRendering: 'pixelated', filter: 'drop-shadow(0 0 1px rgba(1,0,0,.5))' }} />
        : <span style={{ color: 'var(--text-dim)', fontSize: size * 0.3 }}>?</span>}
    </span>
  )
}

/** 금액 강조 줄 (총 메소 등) */
function MesoRow({ label, value }) {
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center justify-between" style={CARD}>
      <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-[17px] font-bold tabular-nums" style={{ color: 'var(--accent-bright)', letterSpacing: '-.3px' }}>{value}</span>
    </div>
  )
}

function StatBox({ label, value, color }) {
  const len = String(value).length
  return (
    <div className="rounded-[10px] px-1.5 py-2 text-center" style={CARD}>
      <div className="text-[12.5px] font-bold" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div
        className="font-bold tabular-nums mt-0.5 whitespace-nowrap"
        style={{ color: color || 'var(--text-strong)', fontSize: len > 9 ? 12.5 : len > 6 ? 14 : 16 }}
      >
        {value}
      </div>
    </div>
  )
}

function PanelHead({ title, right }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-[12.5px] font-bold" style={SLATE_BAR}>
      <span>{title}</span>
      {right && <span className="text-[12.5px] font-semibold" style={{ color: '#cfdae4' }}>{right}</span>}
    </div>
  )
}

/** 아이템 카드 (2열 그리드) */
function ItemCard({ onClick, icon, worldIcon, character, name, sub, cost, footer }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: 'var(--mpl-card)', boxShadow: '0 2px 7px rgba(31,44,61,.1), inset 0 0 0 1px var(--mpl-card-line)' }}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5" style={SLATE_BAR}>
        {worldIcon && <img src={worldIcon} alt="" className="w-[14px] h-[14px] object-contain shrink-0" style={{ imageRendering: 'pixelated' }} draggable={false} />}
        <span className="text-[12.5px] font-bold truncate">{character}</span>
      </div>
      <div className="px-2 pt-2.5 pb-2 flex flex-col items-center text-center flex-1">
        <ItemSlot url={icon} />
        <div className="text-[12.5px] font-bold leading-tight mt-1.5" style={{ color: 'var(--text-strong)' }}>{name}</div>
        <div className="text-[12.5px] mt-1" style={{ color: 'var(--text-dim)' }}>{sub}</div>
        <div className="text-[15px] font-bold tabular-nums mt-1.5" style={{ color: 'var(--accent-bright)', letterSpacing: '-.3px' }}>{cost}</div>
        {footer}
      </div>
    </div>
  )
}

/** 카드 하단 성공 / 실패 / 파괴 */
function ResultStrip({ success, fail, destroy }) {
  const cells = [
    { label: '성공', value: success, color: 'var(--mpl-lime-to)' },
    { label: '실패', value: fail, color: 'var(--text-muted)' },
    { label: '파괴', value: destroy, color: destroy > 0 ? 'var(--mpl-red-to)' : 'var(--text-dim)' },
  ]
  return (
    <div className="mt-2 pt-2 w-full flex items-center" style={{ borderTop: '1px dashed #d9e2ea' }}>
      {cells.map((c, i) => (
        <div
          key={c.label}
          className="flex-1 flex flex-col items-center gap-0.5"
          style={i > 0 ? { borderLeft: '1px solid var(--mpl-card-line)' } : undefined}
        >
          <span className="text-[12.5px] font-bold" style={{ color: 'var(--text-muted)' }}>{c.label}</span>
          <span className="text-[14px] font-bold tabular-nums leading-none" style={{ color: c.color }}>{c.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

/** 카드 하단 수단 아이콘 (상위 3개 + N) */
function MethodStrip({ methods, methodIcons }) {
  const top = methods.slice(0, 3)
  const rest = methods.length - top.length
  return (
    <div className="mt-2 pt-2 w-full flex items-end justify-center gap-2.5" style={{ borderTop: '1px dashed #d9e2ea' }}>
      {top.map((m) => (
        <div key={m.iconName} className="flex flex-col items-center gap-0.5">
          {methodIcons[m.iconName]
            ? <img src={methodIcons[m.iconName]} alt="" className="w-7 h-7 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
            : <span className="w-7 h-7 rounded flex items-center justify-center text-[12.5px]" style={{ background: 'var(--mpl-row)', color: 'var(--text-dim)' }}>?</span>}
          <span className="text-[12.5px] font-bold tabular-nums leading-none" style={{ color: 'var(--text-strong)' }}>{m.count.toLocaleString()}</span>
        </div>
      ))}
      {rest > 0 && (
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-[12.5px] font-bold self-center"
          style={{ background: 'var(--mpl-row)', color: 'var(--text-muted)' }}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

/** 상세 상단 명패 */
function NamePlate({ icon, worldIcon, character, name, sub }) {
  return (
    <div className="rounded-xl p-3 flex items-center gap-3" style={CARD}>
      <ItemSlot url={icon} size={62} />
      <div className="flex-1 min-w-0">
        <span
          className="inline-flex items-center gap-1 rounded-full pl-1 pr-2.5 py-0.5 text-[12.5px] font-bold"
          style={{ background: 'var(--mpl-row)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)', color: 'var(--text-muted)' }}
        >
          {worldIcon && <img src={worldIcon} alt="" className="w-[15px] h-[15px] object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />}
          {character}
        </span>
        <div className="text-[15px] font-bold mt-0.5 leading-tight" style={{ color: 'var(--text-strong)' }}>{name}</div>
        <div className="mt-0.5">{sub}</div>
      </div>
    </div>
  )
}

/** 상세 상단 바 — 기간 칩 + 이전/다음 */
function DetailBar({ index, total, onPrev, onNext }) {
  const btn = (dis) => ({
    background: 'var(--mpl-card)',
    border: '1px solid var(--mpl-card-line)',
    color: dis ? 'var(--text-dim)' : 'var(--text-muted)',
    opacity: dis ? 0.5 : 1,
  })
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[12.5px] font-bold" style={CARD}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--accent-bright)' }}>
          <rect x="1.5" y="2.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M1.5 5.5h11M4.5 1.5v2M9.5 1.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span style={{ color: 'var(--text-muted)' }}>전체 기간</span>
      </span>
      <span className="flex items-center gap-1.5">
        <button type="button" onClick={onPrev} disabled={index <= 0} className="w-8 h-8 rounded-lg text-[13px] font-bold" style={btn(index <= 0)}>‹</button>
        <span className="text-[12.5px] font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>{index + 1} / {total}</span>
        <button type="button" onClick={onNext} disabled={index >= total - 1} className="w-8 h-8 rounded-lg text-[13px] font-bold" style={btn(index >= total - 1)}>›</button>
      </span>
    </div>
  )
}

function MoreButton({ shown, total, onMore }) {
  if (shown >= total) return null
  return (
    <button
      type="button"
      onClick={onMore}
      className="w-full py-2.5 text-[12.5px] font-bold"
      style={{ background: 'var(--mpl-row)', color: 'var(--text-muted)' }}
    >
      더보기 ▼
    </button>
  )
}

function EmptyBox({ text }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center text-[13px]" style={{ borderColor: 'var(--dashed-border)', color: 'var(--text-dim)' }}>
      {text}
    </div>
  )
}

function GradeUpPanel({ title, rows }) {
  if (!rows?.length) return null
  return (
    <div className="rounded-xl overflow-hidden" style={CARD}>
      <PanelHead title={title} right="성공 / 시도" />
      {rows.map((r) => (
        <div key={r.from} className="flex items-center px-3 py-2 border-b last:border-b-0 text-[12.5px]" style={{ borderColor: 'var(--mpl-card-line)' }}>
          <span className="flex-1 font-bold">
            <span style={{ color: GRADE_COLOR[r.from] }}>{r.from}</span>
            <span style={{ color: 'var(--text-dim)' }}> → </span>
            <span style={{ color: GRADE_COLOR[r.to] }}>{r.to}</span>
          </span>
          <span className="tabular-nums mr-3" style={{ color: 'var(--text-muted)' }}>{r.success} / {r.tries.toLocaleString()}</span>
          <span className="w-[52px] text-right font-bold tabular-nums" style={{ color: 'var(--accent-bright)' }}>
            {r.tries > 0 ? `${((r.success / r.tries) * 100).toFixed(2)}%` : '-'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─────────── 스타포스 상세 ───────────

function StarforceDetail({ group, icon, worldIcon, onBack, nav }) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [allRanges, setAllRanges] = useState(false)
  const ranges = starRangeStats(group.records)
  const shownRanges = allRanges ? ranges : ranges.filter((s) => s.tries > 1)
  const hidden = ranges.length - shownRanges.length
  const rows = group.records.slice(0, limit)

  return (
    <MapleWindow
      title="STARFORCE HISTORY"
      tabs={<MapleWindowTab active onClick={onBack}>‹ 목록</MapleWindowTab>}
      bodyClassName="space-y-2"
    >
      <DetailBar {...nav} />

      <NamePlate
        icon={icon}
        worldIcon={worldIcon}
        character={group.character}
        name={group.item}
        sub={(
          <span className="text-[13.5px] font-bold tabular-nums">
            <span style={{ color: '#c9a227' }}>★{group.startStar}</span>
            <span style={{ color: 'var(--text-dim)' }}> → </span>
            {group.destroyed
              ? <span style={{ color: 'var(--mpl-red-to)' }}>파괴</span>
              : <span style={{ color: '#c9a227' }}>★{group.endStar}</span>}
          </span>
        )}
      />

      <MesoRow label="사용 메소" value={group.totalCost != null ? formatMesoShort(group.totalCost) : '-'} />
      <div className="grid grid-cols-4 gap-1.5">
        <StatBox label="시도" value={group.tries.toLocaleString()} />
        <StatBox label="성공" value={group.success.toLocaleString()} color="#4e9e20" />
        <StatBox label="실패" value={(group.tries - group.success - group.destroyCount).toLocaleString()} color="#5c6b7a" />
        <StatBox label="파괴" value={group.destroyCount.toLocaleString()} color={group.destroyCount > 0 ? 'var(--mpl-red-to)' : undefined} />
      </div>

      {shownRanges.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={CARD}>
          <PanelHead title="구간별 성공률" right="시도 많은 순" />
          {shownRanges.map((s) => (
            <div key={s.star} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 text-[12.5px]" style={{ borderColor: 'var(--mpl-card-line)' }}>
              <span className="w-[74px] shrink-0 font-bold tabular-nums" style={{ color: '#c9a227' }}>★{s.star}→★{s.star + 1}</span>
              <span className="flex-1 h-[8px] rounded-full overflow-hidden" style={{ background: '#e4ebf1', boxShadow: 'inset 0 1px 2px rgba(31,44,61,.12)' }}>
                <span className="block h-full rounded-full" style={{ width: `${s.rate}%`, background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))' }} />
              </span>
              <span className="w-[46px] text-right font-bold tabular-nums">{s.rate.toFixed(1)}%</span>
            </div>
          ))}
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setAllRanges((v) => !v)}
              className="w-full py-2 text-[12.5px] font-bold"
              style={{ background: 'var(--mpl-row)', color: 'var(--text-muted)' }}
            >
              {allRanges ? '접기 ▲' : `1회 시도 구간 ${hidden}개 더보기 ▼`}
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={CARD}>
        <PanelHead title="강화 내역" right={`${group.records.length.toLocaleString()}회`} />
        {rows.map((r) => {
          const { date, time } = formatDateParts(r.date_create)
          const res = sfResult(r)
          const drop = isDrop(r)
          const kind = drop ? 'drop' : res
          const cost = sfCost(r)
          return (
            <div
              key={r.id}
              className="px-3 py-2.5 border-b last:border-b-0"
              style={{
                borderColor: 'var(--mpl-card-line)',
                background: res === 'destroy' ? 'var(--mpl-row-danger, #fdf1ef)' : undefined,
                boxShadow: `inset 3px 0 0 ${EDGE[kind]}`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold tabular-nums text-[13.5px]">
                  {r.before_starforce_count}성 <span style={{ color: 'var(--text-dim)' }}>→</span>{' '}
                  {res === 'destroy'
                    ? <span style={{ color: 'var(--mpl-red-to)' }}>파괴</span>
                    : res === 'success'
                      ? <span style={{ color: 'var(--accent-bright)' }}>{r.after_starforce_count}성</span>
                      : `${r.after_starforce_count}성`}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {flagApplied(r.chance_time) && (
                    <span className="rounded-md px-2 py-0.5 text-[12.5px] font-bold" style={{ background: 'linear-gradient(180deg, #ffd76e, #f0a828)', color: '#6b4b00' }}>찬스타임</span>
                  )}
                  <span className="rounded-md px-2.5 py-0.5 text-[12.5px] font-bold" style={BADGE[kind].style}>{BADGE[kind].label}</span>
                </span>
              </div>
              <div className="flex items-start justify-between gap-2 mt-1">
                <span className="text-[12.5px] leading-tight">
                  <span className="block" style={{ color: 'var(--text-muted)' }}>{date}</span>
                  <span className="block mt-0.5" style={{ color: 'var(--text-dim)' }}>{time}</span>
                </span>
                <span className="text-[12.5px] tabular-nums whitespace-nowrap">
                  {cost == null ? <span style={{ color: 'var(--text-dim)' }}>-</span> : (
                    <>
                      {cost.final !== cost.base && <span className="line-through mr-1" style={{ color: 'var(--text-dim)' }}>{formatMesoShort(cost.base)}</span>}
                      <span className="font-bold" style={{ color: 'var(--accent-bright)' }}>{formatKoreanMeso(cost.final)}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          )
        })}
        <MoreButton shown={rows.length} total={group.records.length} onMore={() => setLimit((v) => v + PAGE_SIZE)} />
      </div>
    </MapleWindow>
  )
}

// ─────────── 잠재능력 상세 ───────────

/** 수단 아이콘 이름 (큐브명 또는 재설정 종류) */
function methodIconName(r) {
  return r.method === 'cube' ? r.cube_type : (r.kind === 'additional' ? '에디셔널 잠재능력 재설정' : '잠재능력 재설정')
}

function PotentialDetail({ group, icon, worldIcon, methodIcons, onBack, nav }) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const stat = potentialStats(group.records)
  const rows = group.records.slice(0, limit)

  return (
    <MapleWindow
      title="POTENTIAL HISTORY"
      tabs={<MapleWindowTab active onClick={onBack}>‹ 목록</MapleWindowTab>}
      bodyClassName="space-y-2"
    >
      <DetailBar {...nav} />

      <NamePlate
        icon={icon}
        worldIcon={worldIcon}
        character={group.character}
        name={group.item}
        sub={<span className="text-[12.5px]" style={{ color: 'var(--text-dim)' }}>{group.part} · Lv.{group.level}</span>}
      />

      <MesoRow label="사용 메소" value={group.totalCost != null ? formatMesoShort(group.totalCost) : '-'} />
      <div className="grid grid-cols-3 gap-1.5">
        <StatBox label="재설정" value={group.tries.toLocaleString()} />
        <StatBox label="등급업" value={group.gradeUps.toLocaleString()} color="#4e9e20" />
        <StatBox label="미라클" value={stat.miracle.toLocaleString()} />
      </div>

      <GradeUpPanel title="잠재능력 등급업" rows={stat.upgradeRates.potential} />
      <GradeUpPanel title="에디셔널 잠재능력 등급업" rows={stat.upgradeRates.additional} />

      <div className="rounded-xl overflow-hidden" style={CARD}>
        <PanelHead title="재설정 내역" right={`${group.records.length.toLocaleString()}회`} />
        {rows.map((r) => {
          const { date, time } = formatDateParts(r.date_create)
          const mIcon = methodIcons[methodIconName(r)]
          const cost = potentialCost(r)
          const before = r.kind === 'additional' ? r.before_additional_potential_option : r.before_potential_option
          const after = r.kind === 'additional' ? r.after_additional_potential_option : r.after_potential_option
          return (
            <div key={r.id} className="px-3 py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--mpl-card-line)' }}>
              <div className="flex items-center gap-2">
                {mIcon
                  ? <img src={mIcon} alt="" className="w-[26px] h-[26px] object-contain shrink-0" style={{ imageRendering: 'pixelated' }} draggable={false} />
                  : <span className="w-[26px] h-[26px] rounded flex items-center justify-center text-[12.5px] shrink-0" style={{ background: 'var(--mpl-row)', color: 'var(--text-dim)' }}>?</span>}
                <span className="flex-1 min-w-0 text-[12.5px] font-bold truncate" style={{ color: 'var(--text-strong)' }}>{r.methodName}</span>
                <span className="text-[12.5px] font-bold tabular-nums shrink-0" style={{ color: 'var(--accent-bright)' }}>
                  {cost == null ? '-' : formatKoreanMeso(cost)}
                </span>
              </div>
              <div className="flex gap-2 mt-1.5 text-[12.5px] leading-[1.5]">
                <span className="flex-1">
                  {(before || []).map((o, i) => (
                    <span key={i} className="block" style={{ color: GRADE_COLOR_SOFT[o.grade] || '#a6b4c0' }}>{o.value}</span>
                  ))}
                </span>
                <span className="self-center shrink-0" style={{ color: 'var(--text-dim)' }}>→</span>
                <span className="flex-1">
                  {(after || []).map((o, i) => (
                    <span key={i} className="block" style={{ color: GRADE_COLOR[o.grade] || 'var(--text-muted)' }}>{o.value}</span>
                  ))}
                </span>
              </div>
              <div className="text-[12.5px] mt-1.5" style={{ color: 'var(--text-dim)' }}>{date} · {time}</div>
            </div>
          )
        })}
        <MoreButton shown={rows.length} total={group.records.length} onMore={() => setLimit((v) => v + PAGE_SIZE)} />
      </div>
    </MapleWindow>
  )
}

// ─────────── 잠재 목록 통계 ───────────

function PotentialStats({ stat, methodIcons }) {
  const grades = ['레어', '에픽', '유니크', '레전드리']
  return (
    <>
      <MesoRow label="누적 재설정" value={formatMesoShort(stat.resetCost)} />
      <div className="grid grid-cols-3 gap-1.5">
        <StatBox label="감정 비용" value={formatMesoShort(stat.feeCost)} color="var(--accent-bright)" />
        <StatBox label="총 재설정" value={stat.total.toLocaleString()} />
        <StatBox label="미라클" value={stat.miracle.toLocaleString()} />
      </div>

      {stat.methods.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={CARD}>
          <PanelHead title="재설정 횟수 / 큐브 개수" />
          <div className="grid grid-cols-5 gap-x-1 gap-y-2.5 p-2.5">
            {stat.methods.map((m) => (
              <div key={m.iconName} className="flex flex-col items-center gap-0.5">
                {methodIcons[m.iconName]
                  ? <img src={methodIcons[m.iconName]} alt="" className="w-7 h-7 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
                  : <span className="w-7 h-7 rounded flex items-center justify-center text-[12.5px]" style={{ background: 'var(--mpl-row)', color: 'var(--text-dim)' }}>?</span>}
                <span className="text-[12.5px] font-bold tabular-nums" style={{ color: 'var(--accent-bright)' }}>{m.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={CARD}>
        <PanelHead title="등급별 재설정" right="잠재 · 에디" />
        {grades.map((g) => (
          <div key={g} className="flex items-center px-3 py-2 border-b last:border-b-0 text-[12.5px]" style={{ borderColor: 'var(--mpl-card-line)' }}>
            <span className="flex-1 font-bold" style={{ color: GRADE_COLOR[g] }}>{g}</span>
            <span className="w-[64px] text-right font-bold tabular-nums">{(stat.resetByGrade.potential[g] || 0).toLocaleString()}</span>
            <span className="w-[64px] text-right font-bold tabular-nums" style={{ color: 'var(--accent-bright)' }}>{(stat.resetByGrade.additional[g] || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ─────────── 메인 ───────────

export default function Enchant() {
  const { user, isLoading: authLoading } = useAuth()
  const [tab, setTab] = useState('starforce')
  const [sort, setSort] = useState('cost')
  const [charFilter, setCharFilter] = useState(null)
  const [detailKey, setDetailKey] = useState(null)
  useBackClose(detailKey != null, () => setDetailKey(null))
  // 목록 ↔ 상세 전환 시 이전 스크롤 위치가 남지 않도록
  useLayoutEffect(() => { window.scrollTo(0, 0) }, [detailKey])

  const {
    loading, sfGroups, sfSum, potGroups, potStat,
    itemIcons, worldIcons, characterOptions, methodIcons, tabIcons,
  } = useEnchantData({ enabled: !!user, sort, charFilter })

  if (authLoading) return <PageLoader />

  if (!user) {
    return (
      <div className="px-3 pt-10">
        <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--dashed-border)', background: 'var(--skeleton-bg)' }}>
          <div className="text-3xl mb-2">🔑</div>
          <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>API 키 로그인이 필요합니다</p>
          <p className="text-[13px] mt-1.5" style={{ color: 'var(--text-muted)' }}>강화 기록은 본인 계정의 넥슨 API 키로 로그인해야 조회할 수 있습니다</p>
        </div>
      </div>
    )
  }

  const activeGroups = tab === 'starforce' ? sfGroups : potGroups
  const detailIndex = detailKey ? activeGroups.findIndex((g) => g.key === detailKey) : -1
  const detailGroup = detailIndex >= 0 ? activeGroups[detailIndex] : null
  const nav = {
    index: detailIndex,
    total: activeGroups.length,
    onPrev: () => detailIndex > 0 && setDetailKey(activeGroups[detailIndex - 1].key),
    onNext: () => detailIndex < activeGroups.length - 1 && setDetailKey(activeGroups[detailIndex + 1].key),
  }

  return (
    <div key={detailKey || 'list'} className="pb-6 mpl-page-enter">
      {detailGroup ? (
        tab === 'starforce'
          ? <StarforceDetail group={detailGroup} icon={itemIcons[detailGroup.item]} worldIcon={worldIcons[detailGroup.character]} onBack={() => setDetailKey(null)} nav={nav} />
          : <PotentialDetail group={detailGroup} icon={itemIcons[detailGroup.item]} worldIcon={worldIcons[detailGroup.character]} methodIcons={methodIcons} onBack={() => setDetailKey(null)} nav={nav} />
      ) : (
        <MapleWindow
          title="ENCHANT HISTORY"
          tabs={[
            { key: 'starforce', label: '스타포스', icon: tabIcons.starforce },
            { key: 'potential', label: '잠재능력', icon: tabIcons.potential },
          ].map((t) => (
            <MapleWindowTab key={t.key} active={tab === t.key} onClick={() => { setTab(t.key); setDetailKey(null) }}>
              {t.icon && <img src={t.icon} alt="" className="w-[15px] h-[15px] object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />}
              {t.label}
            </MapleWindowTab>
          ))}
          bodyClassName="space-y-2"
        >
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-[12.5px] font-bold shrink-0" style={CARD}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--accent-bright)' }}>
                <rect x="1.5" y="2.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M1.5 5.5h11M4.5 1.5v2M9.5 1.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span style={{ color: 'var(--text-muted)' }}>전체 기간</span>
            </span>
            <Select value={charFilter} onChange={setCharFilter} options={characterOptions} className="flex-1" />
          </div>
          <Select value={sort} onChange={setSort} options={SORT_OPTIONS} className="w-full" />

          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-7 h-7 rounded-full animate-spin" style={{ border: '3px solid var(--accent)', borderTopColor: 'transparent' }} />
              <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>넥슨 API에서 이력을 불러오는 중...</span>
            </div>
          ) : tab === 'starforce' ? (
            <>
              <MesoRow label="총 메소" value={sfSum.cost > 0 ? formatMesoShort(sfSum.cost) : '-'} />
              <div className="grid grid-cols-4 gap-1.5">
                <StatBox label="시도" value={sfSum.tries.toLocaleString()} />
                <StatBox label="성공" value={sfSum.success.toLocaleString()} color="#5aa626" />
                <StatBox label="실패" value={sfSum.fail.toLocaleString()} color="#5c6b7a" />
                <StatBox label="파괴" value={sfSum.destroy.toLocaleString()} color="var(--mpl-red-to)" />
              </div>

              {sfGroups.length === 0 ? (
                <EmptyBox text="스타포스 기록이 없습니다" />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {sfGroups.map((g) => (
                    <ItemCard
                      key={g.key}
                      onClick={() => setDetailKey(g.key)}
                      icon={itemIcons[g.item]}
                      worldIcon={worldIcons[g.character]}
                      character={g.character}
                      name={g.item}
                      sub={<>
                        <span style={{ color: '#c9a227', fontWeight: 800 }}>★{g.startStar}</span>
                        <span> → </span>
                        {g.destroyed
                          ? <span style={{ color: 'var(--mpl-red-to)', fontWeight: 800 }}>파괴</span>
                          : <span style={{ color: '#c9a227', fontWeight: 800 }}>★{g.endStar}</span>}
                      </>}
                      cost={g.totalCost != null ? formatMesoShort(g.totalCost) : '-'}
                      footer={<ResultStrip success={g.success} fail={g.tries - g.success - g.destroyCount} destroy={g.destroyCount} />}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <PotentialStats stat={potStat} methodIcons={methodIcons} />
              {potGroups.length === 0 ? (
                <EmptyBox text="잠재능력 기록이 없습니다" />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {potGroups.map((g) => (
                    <ItemCard
                      key={g.key}
                      onClick={() => setDetailKey(g.key)}
                      icon={itemIcons[g.item]}
                      worldIcon={worldIcons[g.character]}
                      character={g.character}
                      name={g.item}
                      sub={`${g.part} · Lv.${g.level}`}
                      cost={g.totalCost != null ? formatMesoShort(g.totalCost) : '-'}
                      footer={<MethodStrip methods={g.methods} methodIcons={methodIcons} />}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </MapleWindow>
      )}
    </div>
  )
}
