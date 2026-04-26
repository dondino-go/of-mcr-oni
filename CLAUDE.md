# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Personal mobile app for finding Manchester bars serving Negroni or Old Fashioned, with crowdsourced menu data via photo + GPT-4o extraction. Two core flows:
- **Find:** Select cocktail + radius → grant location → see nearby bars sorted by distance
- **Contribute:** Photograph a menu → GPT-4o extracts prices → confirm → save to DB

## Commands

```bash
yarn start          # Start Expo dev server
yarn ios            # Run on iOS simulator
yarn android        # Run on Android emulator/device

yarn test:unit      # Jest unit tests (pure logic in lib/) — fast, no emulator
yarn test:e2e       # Maestro E2E flows in .maestro/ — needs running emulator + installed APK

# Supabase edge functions (run from project root)
supabase functions serve extract-menu   # Local dev of edge function
supabase secrets set OPENAI_API_KEY=... # Set edge function secret

# One-off seed script (requires SUPABASE_SERVICE_KEY + GOOGLE_API_KEY in env)
npx ts-node scripts/seed-venues.ts
```

No linter is configured. Tests: `ts-jest` for unit (`lib/__tests__/`), Maestro for E2E (`.maestro/*.yaml`). E2E test script also enables location services + seeds GPS via adb before running, since the app's `load()` falls back to Manchester centre when device location is unavailable.

## Architecture

### Navigation (Expo Router — file-based stack)

```
app/_layout.tsx       Root layout: SafeAreaProvider, TitanOne font load, hidden headers
app/index.tsx         Home: cocktail type + distance selector
app/results.tsx       Venue list + embedded Google Map
app/contribute.tsx    Photo → extract → confirm → save (step state machine)
```

Navigation flow: `index → results?cocktail=&radiusKm= → contribute?venue_id=&cocktail=`

### Data layer

- **`lib/supabase.ts`** — Supabase client (AsyncStorage session persistence)
- **`lib/venues.ts`** — `getVenuesNearby()`: bounding box Supabase query + Haversine post-sort
- **`lib/types.ts`** — `CocktailType`, `Venue`, `VenueCocktail`, `VenueWithCocktails`

**DB tables:** `venues` (id, name, address, lat, lng, google_place_id) and `venue_cocktails` (venue_id FK, cocktail ENUM, price, notes, confidence_score, last_verified_at). Unique constraint on (venue_id, cocktail).

### Edge function

`supabase/functions/extract-menu/` — Deno. Accepts `{ image_base64, mime_type }`, calls GPT-4o vision, returns `{ cocktails: [{ type, price_gbp }] }`. Deploy/run separately from the Expo app.

### UI conventions

No component library — all UI uses inline `StyleSheet.create` within each screen file. Theme constants (colours, font) live in `lib/theme.ts`. The `components/` directory exists but is currently empty.

## Environment variables

| Variable | Where used |
|---|---|
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Client app (`.env.local`) |
| `OPENAI_API_KEY` | Edge function (set via `supabase secrets set`) |
| `SUPABASE_SERVICE_KEY` | Seed script only — never in app |
| `GOOGLE_API_KEY` | Seed script only — never in app |

The Supabase project URL is hardcoded in `lib/supabase.ts` (not an env var).

## New architecture flag

`app.json` has `"newArchEnabled": false` — required for react-native-maps compatibility. Don't re-enable without checking map library support.
