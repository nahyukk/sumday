import { useEffect } from 'react'
import styles from './PauseModal.module.css'

interface PauseModalProps {
  show: boolean
  onClose: () => void
}

export function PauseModal({ show, onClose }: PauseModalProps) {
  useEffect(() => {
    if (!show) return
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [show, onClose])

  if (!show) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.icon}>⚠️</div>
        <h2 className={styles.title}>외출 중입니다</h2>
        <p className={styles.message}>
          지금은 집중 시간이 멈춰있어요.<br />
          다시 집중을 시작해보세요!
        </p>
        <button className={styles.button} onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  )
}