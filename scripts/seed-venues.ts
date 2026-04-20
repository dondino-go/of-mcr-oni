import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nkkmpkhzufdyyibwimpw.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? '';

// Manchester city centre
const MANCHESTER_LAT = 53.4808;
const MANCHESTER_LNG = -2.2274;
const RADIUS_M = 5000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface PlacesResult {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
}

async function fetchPlaces(pageToken?: string): Promise<{ places: PlacesResult[]; nextPageToken?: string }> {
  const body: any = {
    includedTypes: ['bar', 'cocktail_bar'],
    locationRestriction: {
      circle: {
        center: { latitude: MANCHESTER_LAT, longitude: MANCHESTER_LNG },
        radius: RADIUS_M,
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

async function main() {
  if (!SUPABASE_SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_KEY env var');
  if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_API_KEY env var');

  console.log('Fetching bars from Google Places...');

  const allPlaces: PlacesResult[] = [];
  let pageToken: string | undefined;

  do {
    const result = await fetchPlaces(pageToken);
    allPlaces.push(...(result.places ?? []));
    pageToken = result.nextPageToken;
    if (pageToken) await new Promise(r => setTimeout(r, 2000)); // respect rate limit
  } while (pageToken);

  console.log(`Found ${allPlaces.length} places`);

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
