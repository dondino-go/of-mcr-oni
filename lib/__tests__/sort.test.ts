import { scoreVenue, sortVenues } from '../sort';
import { CocktailType, VenueWithCocktails } from '../types';

function makeVenue(overrides: {
  id: string;
  distance_m?: number;
  confidence_score?: number | null;
  tags?: string[];
  cocktail?: CocktailType;
}): VenueWithCocktails {
  return {
    id: overrides.id,
    name: `venue-${overrides.id}`,
    address: '',
    lat: 0,
    lng: 0,
    google_place_id: null,
    distance_m: overrides.distance_m ?? 0,
    cocktails: [
      {
        id: `c-${overrides.id}`,
        venue_id: overrides.id,
        cocktail: overrides.cocktail ?? 'NEGRONI',
        price: null,
        notes: null,
        confidence_score: overrides.confidence_score ?? null,
        last_verified_at: null,
      },
    ],
    tags: overrides.tags,
  };
}

describe('scoreVenue', () => {
  test('returns 0 for unverified venue with no tags', () => {
    const v = makeVenue({ id: 'a' });
    expect(scoreVenue(v, 'NEGRONI')).toBe(0);
  });

  test('returns 2 for verified venue (confidence_score >= 3)', () => {
    const v = makeVenue({ id: 'a', confidence_score: 3 });
    expect(scoreVenue(v, 'NEGRONI')).toBe(2);
  });

  test('returns 1 for tagged-but-unverified venue', () => {
    const v = makeVenue({ id: 'a', tags: ['great_vibe'] });
    expect(scoreVenue(v, 'NEGRONI')).toBe(1);
  });

  test('returns 3 for verified + tagged venue', () => {
    const v = makeVenue({ id: 'a', confidence_score: 5, tags: ['great_vibe'] });
    expect(scoreVenue(v, 'NEGRONI')).toBe(3);
  });

  test('confidence_score below 3 does not count as verified', () => {
    const v = makeVenue({ id: 'a', confidence_score: 2 });
    expect(scoreVenue(v, 'NEGRONI')).toBe(0);
  });

  test('null confidence_score does not count as verified', () => {
    const v = makeVenue({ id: 'a', confidence_score: null });
    expect(scoreVenue(v, 'NEGRONI')).toBe(0);
  });

  test('empty tags array does not count as tagged', () => {
    const v = makeVenue({ id: 'a', tags: [] });
    expect(scoreVenue(v, 'NEGRONI')).toBe(0);
  });

  test('returns 0 if venue has no matching cocktail entry', () => {
    const v = makeVenue({ id: 'a', confidence_score: 5, cocktail: 'OLD_FASHIONED' });
    expect(scoreVenue(v, 'NEGRONI')).toBe(0);
  });
});

describe('sortVenues', () => {
  test('orders verified+tagged > verified > tagged > bare, distance as tiebreaker', () => {
    const verifiedTagged = makeVenue({ id: 'vt', distance_m: 800, confidence_score: 5, tags: ['great_vibe'] });
    const verifiedOnly =   makeVenue({ id: 'v',  distance_m: 200, confidence_score: 4 });
    const taggedOnly =     makeVenue({ id: 't',  distance_m: 100, tags: ['hits_the_spot'] });
    const bare =           makeVenue({ id: 'b',  distance_m: 50 });

    const result = sortVenues([bare, taggedOnly, verifiedOnly, verifiedTagged], 'NEGRONI');
    expect(result.map(v => v.id)).toEqual(['vt', 'v', 't', 'b']);
  });

  test('ties on score broken by distance (closer first)', () => {
    const farVerified =   makeVenue({ id: 'far',   distance_m: 1500, confidence_score: 5 });
    const closeVerified = makeVenue({ id: 'close', distance_m: 200,  confidence_score: 5 });

    const result = sortVenues([farVerified, closeVerified], 'NEGRONI');
    expect(result.map(v => v.id)).toEqual(['close', 'far']);
  });

  test('does not mutate input array', () => {
    const a = makeVenue({ id: 'a', distance_m: 100 });
    const b = makeVenue({ id: 'b', distance_m: 50, confidence_score: 5 });
    const input = [a, b];
    sortVenues(input, 'NEGRONI');
    expect(input.map(v => v.id)).toEqual(['a', 'b']);
  });

  test('empty array returns empty array', () => {
    expect(sortVenues([], 'NEGRONI')).toEqual([]);
  });
});
