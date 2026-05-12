import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CITIES,
  detectCity,
  resolveActiveLocation,
  getActiveCityId,
  setActiveCityId,
  loadActiveCity,
  __resetGpsResolutionForTest,
} from '../cities';

const MANCHESTER_CENTRE = { lat: 53.4784, lng: -2.2232 };
const LONDON_CENTRE = { lat: 51.5074, lng: -0.1278 };
const OAKFIELD = { lat: 51.4267043, lng: -0.0830224 }; // London fallback
const PARIS = { lat: 48.8566, lng: 2.3522 };
const EDINBURGH = { lat: 55.9533, lng: -3.1883 };

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetGpsResolutionForTest();
});

describe('detectCity', () => {
  test('picks Manchester at Manchester centre', () => {
    expect(detectCity(MANCHESTER_CENTRE)).toBe('manchester');
  });

  test('picks London at London centre', () => {
    expect(detectCity(LONDON_CENTRE)).toBe('london');
  });

  test('picks London when at the Crystal Palace home address', () => {
    expect(detectCity(OAKFIELD)).toBe('london');
  });

  test('returns null when far from any city (Paris)', () => {
    expect(detectCity(PARIS)).toBeNull();
  });

  test('returns null when between cities (Edinburgh, ~250km from both)', () => {
    expect(detectCity(EDINBURGH)).toBeNull();
  });
});

describe('resolveActiveLocation', () => {
  test('uses device location when within the city radius', () => {
    const inLondon = { lat: 51.52, lng: -0.10 };
    expect(resolveActiveLocation(CITIES.london, inLondon)).toEqual(inLondon);
  });

  test('falls back to city anchor when device location is outside the radius', () => {
    expect(resolveActiveLocation(CITIES.london, MANCHESTER_CENTRE)).toEqual(CITIES.london.fallbackWhenAway);
  });

  test('falls back to city anchor when device location is null', () => {
    expect(resolveActiveLocation(CITIES.london, null)).toEqual(CITIES.london.fallbackWhenAway);
  });

  test('Manchester fallback is the city centre (legacy behaviour preserved)', () => {
    expect(resolveActiveLocation(CITIES.manchester, null)).toEqual(CITIES.manchester.center);
  });
});

describe('getActiveCityId / setActiveCityId', () => {
  test('returns null when nothing persisted', async () => {
    expect(await getActiveCityId()).toBeNull();
  });

  test('round-trips a value', async () => {
    await setActiveCityId('london');
    expect(await getActiveCityId()).toBe('london');
  });

  test('returns null when storage holds an unknown value', async () => {
    await AsyncStorage.setItem('@of_mcroni/active_city', 'gotham');
    expect(await getActiveCityId()).toBeNull();
  });
});

describe('loadActiveCity', () => {
  test('GPS wins over persisted (session override does not lock in)', async () => {
    await setActiveCityId('london');
    const { city, source } = await loadActiveCity({ gpsLoc: MANCHESTER_CENTRE });
    expect(city.id).toBe('manchester');
    expect(source).toBe('detected');
    expect(await getActiveCityId()).toBe('manchester');
  });

  test('auto-detects from GPS when nothing is persisted, and writes that choice', async () => {
    const { city, source } = await loadActiveCity({ gpsLoc: LONDON_CENTRE });
    expect(city.id).toBe('london');
    expect(source).toBe('detected');
    expect(await getActiveCityId()).toBe('london');
  });

  test('falls back to persisted when GPS is out of coverage', async () => {
    await setActiveCityId('london');
    const { city, source } = await loadActiveCity({ gpsLoc: PARIS });
    expect(city.id).toBe('london');
    expect(source).toBe('persisted');
  });

  test('defaults to Manchester when no persisted choice and GPS is out of coverage', async () => {
    const { city, source } = await loadActiveCity({ gpsLoc: PARIS });
    expect(city.id).toBe('manchester');
    expect(source).toBe('default');
  });

  test('default does NOT persist (so a future visit can still auto-detect)', async () => {
    await loadActiveCity({ gpsLoc: PARIS });
    expect(await getActiveCityId()).toBeNull();
  });

  test('defaults to Manchester when no GPS provided and nothing persisted', async () => {
    const { city, source } = await loadActiveCity();
    expect(city.id).toBe('manchester');
    expect(source).toBe('default');
  });

  test('falls back to persisted when no GPS provided', async () => {
    await setActiveCityId('london');
    const { city, source } = await loadActiveCity();
    expect(city.id).toBe('london');
    expect(source).toBe('persisted');
  });

  test('GPS detection fires only once per session — toggle survives subsequent calls', async () => {
    // Cold launch: GPS in Manchester, no persisted choice.
    const first = await loadActiveCity({ gpsLoc: MANCHESTER_CENTRE });
    expect(first.city.id).toBe('manchester');
    expect(first.source).toBe('detected');

    // User long-presses to London (in-session override).
    await setActiveCityId('london');

    // Subsequent calls in the same session (e.g., home re-mount after router.replace)
    // should NOT re-run GPS detection — they read the persisted toggle.
    const second = await loadActiveCity({ gpsLoc: MANCHESTER_CENTRE });
    expect(second.city.id).toBe('london');
    expect(second.source).toBe('persisted');
  });

  test('after a session reset (cold launch), GPS re-asserts itself', async () => {
    await loadActiveCity({ gpsLoc: MANCHESTER_CENTRE });
    await setActiveCityId('london');
    // Simulate cold launch.
    __resetGpsResolutionForTest();
    const fresh = await loadActiveCity({ gpsLoc: MANCHESTER_CENTRE });
    expect(fresh.city.id).toBe('manchester');
    expect(fresh.source).toBe('detected');
  });
});
