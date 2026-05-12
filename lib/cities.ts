import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDistanceKm } from './geo';

export type CityId = 'manchester' | 'london';
export type LatLng = { lat: number; lng: number };

export type City = {
  id: CityId;
  name: string;
  center: LatLng;
  // Anchor used when the device location is more than `radiusKm` from `center`.
  // Manchester reuses its centre (legacy behaviour); London anchors to home (37 Oakfield Gardens).
  fallbackWhenAway: LatLng;
  radiusKm: number;
};

export const CITIES: Record<CityId, City> = {
  manchester: {
    id: 'manchester',
    name: 'Manchester',
    center: { lat: 53.4784, lng: -2.2232 },
    fallbackWhenAway: { lat: 53.4784, lng: -2.2232 },
    radiusKm: 30,
  },
  london: {
    id: 'london',
    name: 'London',
    center: { lat: 51.5074, lng: -0.1278 },
    fallbackWhenAway: { lat: 51.4267043, lng: -0.0830224 },
    radiusKm: 30,
  },
};

export const CITY_IDS: CityId[] = ['manchester', 'london'];

function isCityId(v: unknown): v is CityId {
  return v === 'manchester' || v === 'london';
}

export function detectCity(loc: LatLng): CityId | null {
  let best: { id: CityId; dist: number } | null = null;
  for (const city of Object.values(CITIES)) {
    const d = getDistanceKm(loc.lat, loc.lng, city.center.lat, city.center.lng);
    if (d <= city.radiusKm && (!best || d < best.dist)) {
      best = { id: city.id, dist: d };
    }
  }
  return best?.id ?? null;
}

export function resolveActiveLocation(city: City, deviceLoc: LatLng | null): LatLng {
  if (!deviceLoc) return city.fallbackWhenAway;
  const d = getDistanceKm(deviceLoc.lat, deviceLoc.lng, city.center.lat, city.center.lng);
  return d <= city.radiusKm ? deviceLoc : city.fallbackWhenAway;
}

const KEY = '@of_mcroni/active_city';

export async function getActiveCityId(): Promise<CityId | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return isCityId(raw) ? raw : null;
}

export async function setActiveCityId(id: CityId): Promise<void> {
  await AsyncStorage.setItem(KEY, id);
}

export type ActiveCityResolution = { city: City; source: 'persisted' | 'detected' | 'default' };

// Module-level flag: GPS detection fires once per app process (cold launch).
// Without this, navigating add-venue → home (via router.replace) re-mounts home, calls
// loadActiveCity again, and GPS-wins overwrites the user's in-session toggle.
// Resets on app kill (fresh JS bundle = fresh module = fresh flag).
let gpsResolvedThisSession = false;

export function __resetGpsResolutionForTest() {
  gpsResolvedThisSession = false;
}

// Picks the active city in priority: GPS-detected (first call only) → persisted → Manchester default.
// GPS wins on cold launch so the app auto-corrects when you change cities. Once resolved this
// session, the toggle persists — long-press to London stays London even when navigating around.
export async function loadActiveCity(opts?: { gpsLoc?: LatLng | null }): Promise<ActiveCityResolution> {
  if (opts?.gpsLoc && !gpsResolvedThisSession) {
    gpsResolvedThisSession = true;
    const detected = detectCity(opts.gpsLoc);
    if (detected) {
      await setActiveCityId(detected);
      return { city: CITIES[detected], source: 'detected' };
    }
    // Out of coverage: fall through to persisted/default below.
  }
  const persisted = await getActiveCityId();
  if (persisted) return { city: CITIES[persisted], source: 'persisted' };
  return { city: CITIES.manchester, source: 'default' };
}
