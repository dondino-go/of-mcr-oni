export type CocktailType = 'NEGRONI' | 'OLD_FASHIONED';

export interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  google_place_id: string | null;
  distance_m?: number;
}

export interface VenueCocktail {
  id: string;
  venue_id: string;
  cocktail: CocktailType;
  price: number | null;
  notes: string | null;
  confidence_score: number | null;
  last_verified_at: string | null;
}

export interface VenueWithCocktails extends Venue {
  cocktails: VenueCocktail[];
  tags?: string[];
}
