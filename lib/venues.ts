import { supabase } from './supabase';
import { CocktailType, VenueCocktail, VenueWithCocktails } from './types';
import { filterVenueForCocktail } from './inclusion';

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

function topTag(tags: { tag: string }[]): string | null {
  if (!tags.length) return null;
  const counts: Record<string, number> = {};
  for (const { tag } of tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}


export async function getTagsForVenues(venueIds: string[]): Promise<Record<string, string[]>> {
  if (!venueIds.length) return {};
  const { data } = await supabase
    .from('venue_tags')
    .select('venue_id, tag')
    .in('venue_id', venueIds);
  if (!data) return {};
  const byVenue: Record<string, Record<string, number>> = {};
  for (const row of data) {
    if (!byVenue[row.venue_id]) byVenue[row.venue_id] = {};
    byVenue[row.venue_id][row.tag] = (byVenue[row.venue_id][row.tag] ?? 0) + 1;
  }
  const result: Record<string, string[]> = {};
  for (const [venueId, counts] of Object.entries(byVenue)) {
    result[venueId] = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }
  return result;
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
      id, name, address, lat, lng, google_place_id, google_rating, google_rating_count,
      venue_cocktails (
        id, venue_id, cocktail, price, notes, confidence_score, last_verified_at
      )
    `)
    .gte('lat', userLat - latDelta)
    .lte('lat', userLat + latDelta)
    .gte('lng', userLng - lngDelta)
    .lte('lng', userLng + lngDelta);

  if (error) throw error;
  if (!data) return [];

  return (data as any[])
    .map(v => {
      const { include, matchingCocktails } = filterVenueForCocktail(v.venue_cocktails ?? [], cocktailType);
      return {
        ...v,
        _include: include,
        cocktails: matchingCocktails,
        distance_m: Math.round(distanceM(userLat, userLng, v.lat, v.lng)),
      };
    })
    .filter(v => v._include)
    .filter(v => v.distance_m <= radiusKm * 1000)
    .map(({ _include, venue_cocktails, ...rest }: any) => rest as VenueWithCocktails)
    .sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));
}

export async function deleteVenue(id: string): Promise<void> {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) throw error;
}
