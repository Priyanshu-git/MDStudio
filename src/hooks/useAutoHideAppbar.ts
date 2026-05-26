import { useEffect, useState, type RefObject } from 'react'

type UseAutoHideAppbarOptions = {
  enabled?: boolean
  resetKey?: unknown
  scrollRef?: RefObject<HTMLElement | null>
  threshold?: number
  topThreshold?: number
}

export function useAutoHideAppbar({
  enabled = true,
  resetKey,
  scrollRef,
  threshold = 8,
  topThreshold = 8,
}: UseAutoHideAppbarOptions = {}) {
  const [state, setState] = useState<{ hidden: boolean; resetKey: unknown }>({
    hidden: false,
    resetKey,
  })

  useEffect(() => {
    if (!enabled) {
      return
    }

    const scrollElement = scrollRef?.current ?? null
    let lastScrollTop = scrollElement ? scrollElement.scrollTop : window.scrollY

    function getScrollTop() {
      return scrollElement ? scrollElement.scrollTop : window.scrollY
    }

    function handleScroll() {
      const currentScrollTop = getScrollTop()
      const delta = currentScrollTop - lastScrollTop

      if (currentScrollTop <= topThreshold) {
        setState({ hidden: false, resetKey })
      } else if (delta > threshold) {
        setState({ hidden: true, resetKey })
      } else if (delta < -threshold) {
        setState({ hidden: false, resetKey })
      }

      lastScrollTop = currentScrollTop
    }

    const target: HTMLElement | Window = scrollElement ?? window
    target.addEventListener('scroll', handleScroll, { passive: true })
    return () => target.removeEventListener('scroll', handleScroll)
  }, [enabled, resetKey, scrollRef, threshold, topThreshold])

  if (!enabled || state.resetKey !== resetKey) {
    return false
  }

  return state.hidden
}
