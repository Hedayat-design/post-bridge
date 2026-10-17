/**
 * Fades [data-reveal] elements in as they scroll into view.
 *
 * Content is visible without JavaScript: it is only hidden (by
 * `.motion-ready` in globals.css) once this has run. Returns the cleanup.
 */
export function observeReveals(page: HTMLElement) {
  page.classList.add('motion-ready')
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // Also reveal what is already above the viewport — a reload mid-page
        // restores the scroll position past it.
        if (!entry.isIntersecting && entry.boundingClientRect.bottom > 0) continue
        ;(entry.target as HTMLElement).dataset.visible = 'true'
        observer.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  )
  page.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el))

  return () => {
    observer.disconnect()
    page.classList.remove('motion-ready')
  }
}
