import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nkkmpkhzufdyyibwimpw.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? '';

type SearchPoint = { lat: number; lng: number; radiusM: number; label: string };

const CITIES: Record<string, { name: string; searchPoints: SearchPoint[] }> = {
  manchester: {
    name: 'Manchester',
    searchPoints: [
      { lat: 53.4808, lng: -2.2274, radiusM: 5000, label: 'centre' },
    ],
  },
  london: {
    name: 'London',
    // Two search points because the Places API caps at ~60 results per circle —
    // central covers the West End/City, Crystal Palace covers the home-area fallback.
    searchPoints: [
      { lat: 51.5074, lng: -0.1278, radiusM: 5000, label: 'central' },
      { lat: 51.4267, lng: -0.0830, radiusM: 5000, label: 'crystal palace' },
    ],
  },
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface PlacesResult {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
}

async function fetchPlaces(point: SearchPoint, pageToken?: string): Promise<{ places: PlacesResult[]; nextPageToken?: string }> {
  const body: any = {
    includedTypes: ['bar', 'cocktail_bar'],
    locationRestriction: {
      circle: {
        center: { latitude: point.lat, longitude: point.lng },
        radius: point.radiusM,
      },
    },
    maxResultCount: 20,
  };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API error: ${res.status} ${err}`);
  }

  return res.json() as Promise<{ places: PlacesResult[]; nextPageToken?: string }>;
}

async function fetchAllForPoint(point: SearchPoint): Promise<PlacesResult[]> {
  const out: PlacesResult[] = [];
  let pageToken: string | undefined;
  do {
    const result = await fetchPlaces(point, pageToken);
    out.push(...(result.places ?? []));
    pageToken = result.nextPageToken;
    if (pageToken) await new Promise(r => setTimeout(r, 2000));
  } while (pageToken);
  return out;
}

async function main() {
  if (!SUPABASE_SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_KEY env var');
  if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_API_KEY env var');

  const cityArg = (process.argv[2] ?? 'manchester').toLowerCase();
  const city = CITIES[cityArg];
  if (!city) {
    throw new Error(`Unknown city "${cityArg}". Known: ${Object.keys(CITIES).join(', ')}`);
  }

  console.log(`Seeding ${city.name} (${city.searchPoints.length} search point${city.searchPoints.length > 1 ? 's' : ''})...`);

  const byPlaceId = new Map<string, PlacesResult>();
  for (const point of city.searchPoints) {
    console.log(`  · ${point.label} (${point.lat}, ${point.lng}, ${point.radiusM}m)`);
    const results = await fetchAllForPoint(point);
    for (const r of results) byPlaceId.set(r.id, r);
    console.log(`    found ${results.length}, running total unique: ${byPlaceId.size}`);
  }

  const allPlaces = [...byPlaceId.values()];
  console.log(`Total unique places: ${allPlaces.length}`);

  const venues = allPlaces.map(p => ({
    name: p.displayName.text,
    address: p.formattedAddress,
    lat: p.location.latitude,
    lng: p.location.longitude,
    google_place_id: p.id,
  }));

  const { data, error } = await supabase
    .from('venues')
    .upsert(venues, { onConflict: 'google_place_id', ignoreDuplicates: false })
    .select('id, name');

  if (error) throw error;

  console.log(`Upserted ${data?.length ?? 0} venues:`);
  data?.forEach(v => console.log(` - ${v.name}`));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
