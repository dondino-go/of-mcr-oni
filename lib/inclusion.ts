import { CocktailType, VenueCocktail } from './types';

// Pure inclusion rule for the per-cocktail results list.
// Returns whether to keep the venue, plus the cocktail rows that should be
// surfaced (only those matching the active cocktail).
//
// A venue is kept iff it has zero cocktail rows (genuinely unchecked menu —
// surfaced with "no menu yet") OR has at least one row for the active
// cocktail. A venue with a Negroni row but no Old Fashioned row is dropped
// from the Old Fashioned list.
export function filterVenueForCocktail(
  cocktailRows: VenueCocktail[],
  cocktailType: CocktailType,
): { include: boolean; matchingCocktails: VenueCocktail[] } {
  const matching = cocktailRows.filter(c => c.cocktail === cocktailType);
  const include = cocktailRows.length === 0 || matching.length > 0;
  return { include, matchingCocktails: matching };
}
