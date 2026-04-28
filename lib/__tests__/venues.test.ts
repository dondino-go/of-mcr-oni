import { filterVenueForCocktail } from '../inclusion';
import { CocktailType, VenueCocktail } from '../types';

function row(id: string, cocktail: CocktailType, overrides: Partial<VenueCocktail> = {}): VenueCocktail {
  return {
    id,
    venue_id: 'v',
    cocktail,
    price: null,
    notes: null,
    confidence_score: null,
    last_verified_at: null,
    ...overrides,
  };
}

describe('filterVenueForCocktail', () => {
  test('venue with no cocktail rows is included (no menu yet)', () => {
    const result = filterVenueForCocktail([], 'NEGRONI');
    expect(result.include).toBe(true);
    expect(result.matchingCocktails).toEqual([]);
  });

  test('venue with matching cocktail row is included with the row surfaced', () => {
    const negroni = row('1', 'NEGRONI');
    const result = filterVenueForCocktail([negroni], 'NEGRONI');
    expect(result.include).toBe(true);
    expect(result.matchingCocktails).toEqual([negroni]);
  });

  test('venue with only OF row is dropped from NEGRONI list', () => {
    const oldFashioned = row('1', 'OLD_FASHIONED');
    const result = filterVenueForCocktail([oldFashioned], 'NEGRONI');
    expect(result.include).toBe(false);
    expect(result.matchingCocktails).toEqual([]);
  });

  test('venue with only NEGRONI row is dropped from OLD_FASHIONED list', () => {
    const negroni = row('1', 'NEGRONI');
    const result = filterVenueForCocktail([negroni], 'OLD_FASHIONED');
    expect(result.include).toBe(false);
    expect(result.matchingCocktails).toEqual([]);
  });

  test('venue with both cocktail rows surfaces only the active one', () => {
    const negroni = row('1', 'NEGRONI');
    const oldFashioned = row('2', 'OLD_FASHIONED');
    const result = filterVenueForCocktail([negroni, oldFashioned], 'NEGRONI');
    expect(result.include).toBe(true);
    expect(result.matchingCocktails).toEqual([negroni]);
  });

  test('does not mutate input array', () => {
    const negroni = row('1', 'NEGRONI');
    const oldFashioned = row('2', 'OLD_FASHIONED');
    const input = [negroni, oldFashioned];
    filterVenueForCocktail(input, 'NEGRONI');
    expect(input).toEqual([negroni, oldFashioned]);
  });

  test('multiple rows of the same cocktail are all returned', () => {
    const a = row('1', 'NEGRONI', { price: 10 });
    const b = row('2', 'NEGRONI', { price: 12 });
    const result = filterVenueForCocktail([a, b], 'NEGRONI');
    expect(result.include).toBe(true);
    expect(result.matchingCocktails).toEqual([a, b]);
  });
});
