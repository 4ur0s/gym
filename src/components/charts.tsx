import { fmtDayMonth } from '../logic/dates'

function scale(values: number[], h: number, pad = 2) {
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  return (v: number) => h - pad - ((v - min) / span) * (h - pad * 2)
}

export function Sparkline({ values, color, width = 64, height = 26 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />
  const y = scale(values, height)
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  )
}

export function LineChart({ points, color }: { points: { date: string; value: number }[]; color: string }) {
  const W = 320, H = 150, B = 18
  if (points.length < 2) return <div className="empty">Пока мало данных для графика</div>
  const y = scale(points.map((p) => p.value), H - B, 6)
  const t0 = new Date(points[0].date).getTime(), t1 = new Date(points[points.length - 1].date).getTime()
  const x = (d: string) => ((new Date(d).getTime() - t0) / (t1 - t0 || 1)) * (W - 8) + 4
  const pts = points.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const min = Math.min(...points.map((p) => p.value)), max = Math.max(...points.map((p) => p.value))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="График прогресса">
      <line x1={0} x2={W} y1={H - B} y2={H - B} stroke="#2c2c2e" />
      <text x={W} y={y(max) - 4} textAnchor="end" fill="#8e8e93" fontSize={10} fontFamily="Unbounded">{max}</text>
      {min !== max && <text x={W} y={y(min) + 12} textAnchor="end" fill="#8e8e93" fontSize={10} fontFamily="Unbounded">{min}</text>}
      <polyline fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" points={pts} />
      {points.map((p) => <circle key={p.date + p.value} cx={x(p.date)} cy={y(p.value)} r={2} fill={color} />)}
      <circle cx={x(last.date)} cy={y(last.value)} r={4.5} fill={color} />
      <text x={0} y={H - 4} fill="#8e8e93" fontSize={10} fontFamily="Montserrat">{fmtDayMonth(points[0].date)}</text>
      <text x={W} y={H - 4} textAnchor="end" fill="#8e8e93" fontSize={10} fontFamily="Montserrat">{fmtDayMonth(last.date)}</text>
    </svg>
  )
}
