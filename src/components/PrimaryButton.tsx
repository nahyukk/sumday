import styles from './Button.module.css'

export function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  const getButtonClass = () => {
    if (label === '출근') return styles.start
    if (label === '퇴근') return styles.end
    if (label === '외출') return styles.pause
    if (label === '재개') return styles.resume
    return styles.button
  }

  return (
    <button className={`${styles.button} ${getButtonClass()}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  )
}