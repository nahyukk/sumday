import { useEffect, useMemo, useRef, useState } from 'react'
import { TimeDisplay, LastFocus } from './components/TimeDisplay'
import { PrimaryButton } from './components/PrimaryButton'
import { MidnightBanner } from './components/MidnightBanner'
import { PauseModal } from './components/PauseModal'

type State = 'idle' | 'running' | 'paused'

const EIGHT_HOURS = 8 * 60 * 60 * 1000
const LS_HISTORY = 'focusHistory' // { [YYYY-MM-DD]: number(ms) }
const LS_STATE = 'currentState' // { state, focusedMs, sinceStartMs, startedAt }

function todayISO(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function loadHistory(): Record<string, number> {
  try { const raw = localStorage.getItem(LS_HISTORY); return raw ? JSON.parse(raw) : {} } catch { return {} }
}
function saveHistory(h: Record<string, number>) {
  try { localStorage.setItem(LS_HISTORY, JSON.stringify(h)) } catch {}
}
function loadState(): { state: State, focusedMs: number, sinceStartMs: number, startedAt: number | null } | null {
  try {
    const raw = localStorage.getItem(LS_STATE)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function saveState(state: State, focusedMs: number, sinceStartMs: number, startedAt: number | null) {
  try {
    localStorage.setItem(LS_STATE, JSON.stringify({ state, focusedMs, sinceStartMs, startedAt }))
  } catch {}
}
function pruneTo7Days(history: Record<string, number>): Record<string, number> {
  const entries = Object.entries(history)
  entries.sort(([a], [b]) => a.localeCompare(b))
  const last7 = entries.slice(-7)
  const next: Record<string, number> = {}
  for (const [k, v] of last7) next[k] = v
  return next
}
function latestFinished(history: Record<string, number>): { date: string, ms: number } | null {
  const entries = Object.entries(history)
  if (!entries.length) return null
  entries.sort(([a], [b]) => a.localeCompare(b))
  
  // 최근 날짜부터 거꾸로 검색해서 0이 아닌 첫 번째 값 찾기
  for (let i = entries.length - 1; i >= 0; i--) {
    const [date, ms] = entries[i]
    if (ms > 0) {
      return { date, ms }
    }
  }
  
  return null
}

export default function App() {
  const savedState = loadState()
  const [state, setState] = useState<State>(savedState?.state ?? 'idle')
  const [focusedMs, setFocusedMs] = useState(savedState?.focusedMs ?? 0)
  const [sinceStartMs, setSinceStartMs] = useState(savedState?.sinceStartMs ?? 0)
  const [history, setHistory] = useState<Record<string, number>>(() => loadHistory())
  const [midnightWarn, setMidnightWarn] = useState(false)
  const [showPauseModal, setShowPauseModal] = useState(false)

  const startedAtRef = useRef<number | null>(savedState?.startedAt ?? null)
  const lastTickRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  const lastEntry = useMemo(() => latestFinished(history), [history])

  // 1) running일 때만 오늘 집중시간 증가
  useEffect(() => {
    if (state !== 'running') {
      if (rafRef.current) clearInterval(rafRef.current)
      rafRef.current = null
      lastTickRef.current = null
      return
    }
    lastTickRef.current = Date.now()
    const tick = setInterval(() => {
      const now = Date.now()
      const dt = now - (lastTickRef.current || now)
      lastTickRef.current = now
      setFocusedMs(v => v + dt)
    }, 100) // 100ms 간격으로 업데이트
    rafRef.current = tick
    return () => clearInterval(tick)
  }, [state])

  // 2) 출근 이후 경과 (8시간 라벨 전환용)
  useEffect(() => {
    const id = setInterval(() => {
      if (startedAtRef.current && state !== 'idle') setSinceStartMs(Date.now() - startedAtRef.current)
    }, 1000)
    return () => clearInterval(id)
  }, [state])

  // 3) 자정 롤오버: 오늘 focused를 어제로 저장하고 리셋 + idle
  useEffect(() => {
    let lastDate = todayISO()
    const tick = setInterval(() => {
      const currentDate = todayISO()
      if (currentDate !== lastDate) {
        // 날짜가 바뀜 = 자정을 지남
        const yISO = lastDate
        setHistory(h => {
          const next = { ...h, [yISO]: (h[yISO] ?? 0) + focusedMs }
          const pruned = pruneTo7Days(next)
          saveHistory(pruned)
          return pruned
        })
        // reset to idle
        setFocusedMs(0)
        setSinceStartMs(0)
        setState('idle')
        startedAtRef.current = null
        lastDate = currentDate
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [focusedMs])

  // 4) 상태 저장
  useEffect(() => {
    saveState(state, focusedMs, sinceStartMs, startedAtRef.current)
  }, [state, focusedMs, sinceStartMs])

  // 5) 외출 상태일 때 모달 표시
  useEffect(() => {
    if (state === 'paused') {
      const timer = setTimeout(() => setShowPauseModal(true), 1000)
      return () => clearTimeout(timer)
    } else {
      setShowPauseModal(false)
    }
  }, [state])

  // 6) 자정 5분 전 경고 + 비프 (타이머 실행 중일 때만)
  useEffect(() => {
    // 타이머 실행 중이 아니면 알림 안함
    if (state !== 'running') {
      setMidnightWarn(false)
      return
    }
    
    function msToNextMidnight(date = new Date()) {
      const next = new Date(date)
      next.setHours(24, 0, 0, 0)
      return next.getTime() - date.getTime()
    }
    const now = new Date()
    const msToMidnight = msToNextMidnight(now)
    const warnAt = msToMidnight - 5 * 60 * 1000
    let warnTimer: number | undefined
    let resetTimer: number | undefined

    if (warnAt <= 0) setMidnightWarn(true)
    else warnTimer = window.setTimeout(() => {
      setMidnightWarn(true)
      try {
        const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext
        const ctx = new Ctx()
        const o = ctx.createOscillator(); const g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = 880
        o.connect(g); g.connect(ctx.destination)
        g.gain.setValueAtTime(0.0001, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01)
        o.start(); o.stop(ctx.currentTime + 0.15)
      } catch {}
    }, warnAt)

    resetTimer = window.setTimeout(() => setMidnightWarn(false), msToMidnight + 2000)
    return () => { if (warnTimer) clearTimeout(warnTimer); if (resetTimer) clearTimeout(resetTimer) }
  }, [state])

  // 8) 버튼 라벨 및 상태 텍스트
  const primaryLabel = useMemo(() => {
    if (state === 'idle') return '출근'
    if (focusedMs >= EIGHT_HOURS) return '퇴근'
    return state === 'running' ? '외출' : '재개'
  }, [state, focusedMs])

  const statusText = useMemo(() => {
    if (state === 'idle') return null
    if (state === 'running') return '집중 중'
    if (state === 'paused') return '외출 중'
    return null
  }, [state])

  // 9) 액션
  function handlePrimary() {
    if (state === 'idle') {
      // 처음 출근이면 새로 시작, 퇴근 후 재출근이면 기존 시간 유지
      if (!startedAtRef.current) {
        startedAtRef.current = Date.now()
        setSinceStartMs(0)
      } else {
        // 재출근: 기존 startedAt 유지하여 sinceStartMs 연속 진행
        // startedAtRef.current와 sinceStartMs는 그대로 유지
      }
      // focusedMs는 리셋하지 않음 (누적 유지)
      setState('running')
      return
    }
    if (focusedMs >= EIGHT_HOURS) {
      // 수동 퇴근: idle로만 변경, 시간은 자정까지 유지
      setState('idle')
      // startedAtRef는 유지해서 재출근시 연속 진행되도록
      return
    }
    // 토글
    setState(s => (s === 'running' ? 'paused' : 'running'))
  }

  return (
    <div className="wrap">
      <MidnightBanner show={midnightWarn} />

      <div className="card">
        <h1>오늘 투자한 시간</h1>
        <TimeDisplay ms={focusedMs} status={statusText ?? undefined} />
        <PrimaryButton label={primaryLabel} onClick={handlePrimary} />
        <LastFocus label="Last Focus Time" ms={lastEntry?.ms ?? 0} />
      </div>
      
      <PauseModal 
        show={showPauseModal} 
        onClose={() => setShowPauseModal(false)} 
      />
    </div>
  )
}
