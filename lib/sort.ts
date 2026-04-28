import { CocktailType, VenueWithCocktails } from './types';

// Lexicographic tiers (each higher = better).
// Order matters: a venue that wins an earlier tier beats anything in later tiers,
// regardless of how it compares lower down. Distance is the final tiebreaker.
//   1. Personal-add (local-only signal — venues I added via "Add a bar")
//   2. Has at least one sticker
//   3. Google star rating (null sinks to bottom of this tier)
//   4. Verified menu (confidence_score >= 3)
function tierKey(
  venue: VenueWithCocktails,
  cocktailType: CocktailType,
  myVenueIds: Set<string>,
): [number, number, number, number] {
  const isMine = myVenueIds.has(venue.id) ? 1 : 0;
  const hasSticker = venue.tags && venue.tags.length > 0 ? 1 : 0;
  const rating = venue.google_rating ?? 0;
  const cocktail = venue.cocktails.find(c => c.cocktail === cocktailType);
  const isVerified = cocktail?.confidence_score != null && cocktail.confidence_score >= 3 ? 1 : 0;
  return [isMine, hasSticker, rating, isVerified];
}

export function sortVenues(
  venues: VenueWithCocktails[],
  cocktailType: CocktailType,
  myVenueIds: Set<string> = new Set(),
): VenueWithCocktails[] {
  return [...venues].sort((a, b) => {
    const ka = tierKey(a, cocktailType, myVenueIds);
    const kb = tierKey(b, cocktailType, myVenueIds);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return kb[i] - ka[i];
    }
    return (a.distance_m ?? 0) - (b.distance_m ?? 0);
  });
}
