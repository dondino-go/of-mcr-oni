# OF MCR-oni

A personal mobile app for finding the nearest Manchester bar serving a Negroni or Old Fashioned, and for keeping that data up to date by photographing menus.

## What it does

**Find** — Select a cocktail type (Negroni or Old Fashioned), grant location permission, and get a list of nearby Manchester bars sorted by distance. Each result shows the bar name, address, distance, price (if known), and a flag if the data is unverified.

**Contribute** — From any result, tap "+ update" to photograph or upload the bar's cocktail menu. GPT-4o vision extracts any Negroni or Old Fashioned listings and their prices. You confirm the result before it's saved.

## Tech choices

### React Native + Expo
Mobile-first, iOS-focused for personal use. Expo gives fast iteration without a native build step for most dev work. `expo-router` for file-based navigation keeps the screen structure obvious.

### Supabase
Postgres-backed BaaS that handles the database, auth scaffold, and edge function hosting in one place. The venue + cocktail data model is simple enough that a managed Postgres with row-level security is more than sufficient — no need for a custom backend.

### OpenAI GPT-4o vision (via Supabase Edge Function)
Menu photos are unstructured and highly variable. A vision model handles this far better than any OCR + regex approach. The edge function (`supabase/functions/extract-menu`) accepts a base64 image, calls the GPT-4o API, and returns a typed JSON result — keeping the API key server-side and the client logic simple.

### Google Places API (seed script only)
Used once (or on-demand) to populate the `venues` table with bars and cocktail bars within 5km of Manchester city centre. Not called at runtime — venue data lives in Supabase.

### Confidence scoring
`venue_cocktails.confidence_score` tracks data reliability. Photo-extracted entries get a score of 3; anything below 3 is flagged as "unverified" in the UI. Leaves room to add manual verification or staleness decay later.

## Project structure

```
app/
  index.tsx          # Home: cocktail type selector
  results.tsx        # Nearby venues list
  contribute.tsx     # Photo → extract → confirm → save flow
  _layout.tsx        # Expo Router root layout
lib/
  supabase.ts        # Supabase client
  venues.ts          # getVenuesNearby() — bounding box query + Haversine sort
  types.ts           # Shared types (Venue, VenueCocktail, CocktailType)
supabase/
  functions/
    extract-menu/    # Deno edge function: image → GPT-4o → cocktail JSON
scripts/
  seed-venues.ts     # One-off: populate venues from Google Places API
```

## Environment variables

| Variable | Where used | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Client (lib/supabase.ts) | Public anon key |
| `SUPABASE_SERVICE_KEY` | Seed script only | Service role key, never in app |
| `GOOGLE_API_KEY` | Seed script only | Places API key |
| `OPENAI_API_KEY` | Edge function (Supabase secret) | Set via `supabase secrets set` |

## Running locally

```bash
npm install
npx expo start
```

To re-seed venues:
```bash
SUPABASE_SERVICE_KEY=... GOOGLE_API_KEY=... npx ts-node scripts/seed-venues.ts
```

To deploy the edge function:
```bash
supabase functions deploy extract-menu
```
