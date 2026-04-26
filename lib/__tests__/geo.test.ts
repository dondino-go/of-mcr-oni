import { getDistanceKm, decodePolyline } from '../geo';

describe('getDistanceKm', () => {
  test('zero distance for identical points', () => {
    expect(getDistanceKm(53.4784, -2.2232, 53.4784, -2.2232)).toBeCloseTo(0, 6);
  });

  test('symmetric: A→B equals B→A', () => {
    const ab = getDistanceKm(53.4784, -2.2232, 51.5074, -0.1278);
    const ba = getDistanceKm(51.5074, -0.1278, 53.4784, -2.2232);
    expect(ab).toBeCloseTo(ba, 6);
  });

  test('Manchester to London is ~262km (within 2km tolerance)', () => {
    // Manchester centre: 53.4784, -2.2232. London (Trafalgar): 51.5074, -0.1278.
    const km = getDistanceKm(53.4784, -2.2232, 51.5074, -0.1278);
    expect(km).toBeGreaterThan(260);
    expect(km).toBeLessThan(264);
  });

  test('1 degree of latitude is ~111km', () => {
    const km = getDistanceKm(0, 0, 1, 0);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });
});

describe('decodePolyline', () => {
  test('Google reference fixture decodes correctly', () => {
    // From https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    const result = decodePolyline(encoded);
    expect(result).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  test('empty string returns empty array', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  test('single point round-trips through known encoding', () => {
    // Single point (38.5, -120.2) encodes to "_p~iF~ps|U"
    const result = decodePolyline('_p~iF~ps|U');
    expect(result).toEqual([{ latitude: 38.5, longitude: -120.2 }]);
  });
});
