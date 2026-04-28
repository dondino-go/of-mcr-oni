import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nkkmpkhzufdyyibwimpw.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface PlaceDetails {
  rating?: number;
  userRatingCount?: number;
}

async function fetchRating(placeId: string): Promise<PlaceDetails> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'rating,userRatingCount',
    },
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  if (!SUPABASE_SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_KEY');
  if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_API_KEY');

  const { data: venues, error } = await supabase
    .from('venues')
    .select('id, name, google_place_id, google_rating')
    .not('google_place_id', 'is', null)
    .is('google_rating', null);

  if (error) throw error;
  if (!venues?.length) {
    console.log('Nothing to backfill.');
    return;
  }

  console.log(`Backfilling ${venues.length} venues...`);

  for (const v of venues) {
    try {
      const details = await fetchRating(v.google_place_id);
      const { error: updateErr } = await supabase
        .from('venues')
        .update({
          google_rating: details.rating ?? null,
          google_rating_count: details.userRatingCount ?? null,
        })
        .eq('id', v.id);
      if (updateErr) throw updateErr;
      console.log(` ✓ ${v.name} → ${details.rating ?? 'no rating'} (${details.userRatingCount ?? 0})`);
      await new Promise(r => setTimeout(r, 100));
    } catch (e: any) {
      console.error(` ✗ ${v.name}: ${e.message}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
