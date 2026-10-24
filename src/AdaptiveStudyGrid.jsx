import { useEffect, useState } from 'react'

// Keep the original columns. Only phones switch to the original stacked layout.
export function AdaptiveStudyGrid({ group, children }) {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const update = () => {
      const iPad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      setPhone(!iPad && innerWidth <= 720 && Math.min(screen.width, screen.height) <= 600 && matchMedia('(pointer: coarse)').matches)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return <div className={`study-grid ${group.options.length && !group.judgement ? '' : 'no-options'} ${phone ? 'phone-layout' : ''}`}>{children}</div>
}
