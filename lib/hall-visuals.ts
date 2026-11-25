export type HallVisualInfo = {
  image: string
  wing: string
  tagline: string
  amenities: string[]
}

const HALL_VISUALS: Record<string, HallVisualInfo> = {
  KIL: {
    image: '/images/hall-kilimanjaro.jpg',
    wing: 'North Campus Ridge',
    tagline: 'Quiet study-focused residence overlooking the Kisii highlands.',
    amenities: ['High-speed Wi-Fi', '24/7 Security', 'Reading Lounge'],
  },
  VIC: {
    image: '/images/hall-victoria.jpg',
    wing: 'Central Courtyard',
    tagline: 'Gated female residence with landscaped gardens and common rooms.',
    amenities: ['Biometric Gate', 'Laundry Bay', 'High-speed Wi-Fi'],
  },
  SAV: {
    image: '/images/hall-savannah.jpg',
    wing: 'East Academic Wing',
    tagline: 'Modern single, double, and shared rooms steps from lecture halls.',
    amenities: ['Study Desks', 'Solar Hot Water', 'Backup Power'],
  },
}

const DEFAULT_VISUAL: HallVisualInfo = {
  image: '/images/kisii-campus-hero.jpg',
  wing: 'Main Campus',
  tagline: 'On-campus student accommodation managed by Kisii University.',
  amenities: ['Wi-Fi', '24/7 Security', 'Study Area'],
}

export function getHallVisual(code: string): HallVisualInfo {
  return HALL_VISUALS[code.toUpperCase()] ?? DEFAULT_VISUAL
}
