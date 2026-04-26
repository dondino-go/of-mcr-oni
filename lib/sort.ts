import { CocktailType, VenueWithCocktails } from './types';

export function scoreVenue(venue: VenueWithCocktails, cocktailType: CocktailType): number {
  let score = 0;
  const cocktail = venue.cocktails.find(c => c.cocktail === cocktailType);
  if (cocktail?.confidence_score != null && cocktail.confidence_score >= 3) score += 2;
  if (venue.tags && venue.tags.length > 0) score += 1;
  return score;
}

export function sortVenues(venues: VenueWithCocktails[], cocktailType: CocktailType): VenueWithCocktails[] {
  return [...venues].sort((a, b) => {
    const scoreDiff = scoreVenue(b, cocktailType) - scoreVenue(a, cocktailType);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.distance_m ?? 0) - (b.distance_m ?? 0);
  });
}
