type IconName = 'map' | 'ship' | 'crew' | 'help' | 'pause' | 'play' | 'music' | 'photo'

const paths: Record<IconName, string> = {
  map: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z',
  ship: 'M9 16 8 8l4-5 4 5-1 8H9ZM8 10l-4 6v3l5-3m7-6 4 6v3l-5-3m-5 3v3m4-3v3M11 9h2',
  crew: 'M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM8 13h8l3 4v5H5v-5l3-4ZM9 17h6M9 6h6',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6m0-10v.5',
  pause: 'M8 5v14M16 5v14',
  play: 'm8 5 11 7-11 7V5Z',
  music: 'M9 18V5l11-2v13M9 18c0 4-6 4-6 1s6-4 6-1Zm11-2c0 4-6 4-6 1s6-4 6-1Z',
  photo: 'M3 4h18v16H3V4Zm0 12 6-6 7 10m-3-3 4-4 4 4M16 8h.1'
}

export default function SystemMapIcon({ name }: { name: IconName }) {
  return <svg className='system-map-icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'><path d={paths[name]} /></svg>
}
