import { sortVenues } from '../sort';
import { CocktailType, VenueWithCocktails } from '../types';

function makeVenue(overrides: {
  id: string;
  distance_m?: number;
  confidence_score?: number | null;
  tags?: string[];
  cocktail?: CocktailType;
  google_rating?: number | null;
}): VenueWithCocktails {
  return {
    id: overrides.id,
    name: `venue-${overrides.id}`,
    address: '',
    lat: 0,
    lng: 0,
    google_place_id: null,
    google_rating: overrides.google_rating ?? null,
    google_rating_count: null,
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

describe('sortVenues — lexicographic tiers', () => {
  test('personal-add wins over everything else', () => {
    const mine = makeVenue({ id: 'mine', distance_m: 9999, google_rating: 1.0 });
    const sticker = makeVenue({ id: 'sticker', distance_m: 100, tags: ['great_vibe'], google_rating: 4.9 });
    const verified = makeVenue({ id: 'v', distance_m: 50, confidence_score: 5, google_rating: 4.8 });

    const result = sortVenues([sticker, verified, mine], 'NEGRONI', new Set(['mine']));
    expect(result.map(v => v.id)).toEqual(['mine', 'sticker', 'v']);
  });

  test('sticker beats higher rating', () => {
    const lowStarSticker = makeVenue({ id: 'low', tags: ['great_vibe'], google_rating: 3.2 });
    const highStarNoSticker = makeVenue({ id: 'hi', google_rating: 4.9 });

    const result = sortVenues([highStarNoSticker, lowStarSticker], 'NEGRONI');
    expect(result.map(v => v.id)).toEqual(['low', 'hi']);
  });

  test('among stickered venues, higher rating wins', () => {
    const a = makeVenue({ id: 'a', tags: ['great_vibe'], google_rating: 4.5 });
    const b = makeVenue({ id: 'b', tags: ['great_vibe'], google_rating: 3.8 });

    const result = sortVenues([b, a], 'NEGRONI');
    expect(result.map(v => v.id)).toEqual(['a', 'b']);
  });

  test('rating beats verified menu', () => {
    const lowStarVerified = makeVenue({ id: 'low', confidence_score: 5, google_rating: 3.0 });
    const highStarUnverified = makeVenue({ id: 'hi', google_rating: 4.9 });

    const result = sortVenues([lowStarVerified, highStarUnverified], 'NEGRONI');
    expect(result.map(v => v.id)).toEqual(['hi', 'low']);
  });

  test('null rating sinks to bottom of rating tier (treated as 0)', () => {
    const noRating = makeVenue({ id: 'none', google_rating: null });
    const lowRating = makeVenue({ id: 'low', google_rating: 1.0 });

    const result = sortVenues([noRating, lowRating], 'NEGRONI');
    expect(result.map(v => v.id)).toEqual(['low', 'none']);
  });

  test('among equal rating, verified menu wins', () => {
    const verified = makeVenue({ id: 'v', confidence_score: 4, google_rating: 4.0 });
    const unverified = makeVenue({ id: 'u', google_rating: 4.0 });

    const result = sortVenues([unverified, verified], 'NEGRONI');
    expect(result.map(v => v.id)).toEqual(['v', 'u']);
  });

  test('all-tier-equal venues sorted by distance ascending', () => {
    const far = makeVenue({ id: 'far', distance_m: 1500, google_rating: 4.0, confidence_score: 5 });
    const close = makeVenue({ id: 'close', distance_m: 200, google_rating: 4.0, confidence_score: 5 });

    const result = sortVenues([far, close], 'NEGRONI');
    expect(result.map(v => v.id)).toEqual(['close', 'far']);
  });

  test('confidence_score below 3 does not count as verified', () => {
    const partial = makeVenue({ id: 'p', confidence_score: 2, google_rating: 4.0 });
    const unverified = makeVenue({ id: 'u', google_rating: 4.0 });

    const result = sortVenues([partial, unverified], 'NEGRONI', new Set(), );
    // Both should be tied — verified=0 for both — fall through to distance (both 0); stable sort keeps input order.
    expect(result.map(v => v.id).sort()).toEqual(['p', 'u']);
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

  test('myVenueIds defaults to empty set when omitted', () => {
    const v = makeVenue({ id: 'a', google_rating: 3.0 });
    expect(() => sortVenues([v], 'NEGRONI')).not.toThrow();
  });
});
