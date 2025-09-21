export function TimeDisplay({ ms, status }: { ms: number; status?: string }) {
  const s = Math.floor(ms / 1000)
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return (
    <div>
      <div className="time-large">{hh}:{mm}:{ss}</div>
      {status && <div className="status-text">{status}</div>}
    </div>
  )
}

export function LastFocus({ label, ms }: { label: string; ms: number }) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  return <div className="last">{label}: {h}시간 {m}분</div>
}