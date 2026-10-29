/** The approved indoor-character integration uses the existing microgravity cabin by default. */
export function useMicrogravityCabin(search = typeof window === 'undefined' ? '' : window.location.search) {
  return new URLSearchParams(search).get('microgravity') !== '0'
}
