export interface PlaceSuggestion {
  google_place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  rating_count: number | null;
}

interface PlacesResult {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
].join(',');

export async function searchPlaces(
  query: string,
  biasLat?: number,
  biasLng?: number,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');

  const body: any = {
    textQuery: trimmed,
    includedType: 'bar',
    maxResultCount: 10,
  };
  if (biasLat != null && biasLng != null) {
    body.locationBias = {
      circle: {
        center: { latitude: biasLat, longitude: biasLng },
        radius: 10000,
      },
    };
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API error ${res.status}: ${err}`);
  }

  const json = (await res.json()) as { places?: PlacesResult[] };
  return (json.places ?? []).map(p => ({
    google_place_id: p.id,
    name: p.displayName.text,
    address: p.formattedAddress,
    lat: p.location.latitude,
    lng: p.location.longitude,
    rating: p.rating ?? null,
    rating_count: p.userRatingCount ?? null,
  }));
}
