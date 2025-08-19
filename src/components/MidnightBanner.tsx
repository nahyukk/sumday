export function MidnightBanner({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="banner">
      <span className="dot" /> 자정 5분 전입니다. <b>퇴근</b>하세요.
    </div>
  )
}