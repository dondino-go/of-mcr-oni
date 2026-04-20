import { supabase } from './supabase';
import { CocktailType, VenueWithCocktails } from './types';

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getVenuesNearby(
  cocktailType: CocktailType,
  userLat: number,
  userLng: number,
  radiusKm: number
): Promise<VenueWithCocktails[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((userLat * Math.PI) / 180));

  const { data, error } = await supabase
    .from('venues')
    .select(`
      id, name, address, lat, lng, google_place_id,
      venue_cocktails!inner (
        id, venue_id, cocktail, price, notes, confidence_score, last_verified_at
      )
    `)
    .eq('venue_cocktails.cocktail', cocktailType)
    .gte('lat', userLat - latDelta)
    .lte('lat', userLat + latDelta)
    .gte('lng', userLng - lngDelta)
    .lte('lng', userLng + lngDelta);

  if (error) throw error;
  if (!data) return [];

  return (data as any[])
    .map(v => ({
      ...v,
      cocktails: v.venue_cocktails,
      distance_m: Math.round(distanceM(userLat, userLng, v.lat, v.lng)),
    }))
    .filter(v => v.distance_m <= radiusKm * 1000)
    .sort((a, b) => a.distance_m - b.distance_m);
}
