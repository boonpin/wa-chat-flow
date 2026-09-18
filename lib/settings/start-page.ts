/** Browser preference only; this does not control account permissions. */
export function getStartPage(): '/inbox' | '/dashboard' {
  try { return localStorage.getItem('wa-start-page') === '/dashboard' ? '/dashboard' : '/inbox' } catch { return '/inbox' }
}
export function setStartPage(page: string) {
  try { localStorage.setItem('wa-start-page', page === '/dashboard' ? '/dashboard' : '/inbox') } catch { /* Storage may be disabled. */ }
  window.dispatchEvent(new Event('wa-start-page'))
}
export function subscribeStartPage(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener('wa-start-page', notify)
  return () => { window.removeEventListener('storage', notify); window.removeEventListener('wa-start-page', notify) }
}
