import { useEffect, useState } from 'react'

export function useRelativeTimeNow(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const minute = 60 * 1000
    const delayUntilNextMinute = minute - (Date.now() % minute) || minute
    let intervalId: number | undefined

    const timeoutId = window.setTimeout(() => {
      setNow(Date.now())
      intervalId = window.setInterval(() => setNow(Date.now()), minute)
    }, delayUntilNextMinute)

    return () => {
      window.clearTimeout(timeoutId)
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
      }
    }
  }, [])

  return now
}
