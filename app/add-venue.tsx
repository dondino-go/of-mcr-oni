import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, FontFamily } from '../lib/theme';
import { searchPlaces, PlaceSuggestion } from '../lib/places';
import { addMyVenue } from '../lib/myVenues';
import { supabase } from '../lib/supabase';
import { getDistanceKm } from '../lib/geo';

const FALLBACK_LAT = 53.4784;
const FALLBACK_LNG = -2.2232;
const MANCHESTER_RADIUS_KM = 30;

type Step = 'search' | 'saving' | 'done';

export default function AddVenueScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bias, setBias] = useState<{ lat: number; lng: number }>({ lat: FALLBACK_LAT, lng: FALLBACK_LNG });
  const [savedVenue, setSavedVenue] = useState<{ id: string; name: string } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bias search to user location if available
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getLastKnownPositionAsync()
          ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const distKm = getDistanceKm(loc.coords.latitude, loc.coords.longitude, FALLBACK_LAT, FALLBACK_LNG);
        if (distKm <= MANCHESTER_RADIUS_KM) {
          setBias({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch {
        // keep Manchester fallback
      }
    })();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchPlaces(query, bias.lat, bias.lng);
        setResults(found);
        setError(null);
      } catch (e: any) {
        setError(e.message ?? 'Search failed');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, bias.lat, bias.lng]);

  async function handlePick(suggestion: PlaceSuggestion) {
    setStep('saving');
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('venues')
        .upsert(
          {
            name: suggestion.name,
            address: suggestion.address,
            lat: suggestion.lat,
            lng: suggestion.lng,
            google_place_id: suggestion.google_place_id,
            google_rating: suggestion.rating,
            google_rating_count: suggestion.rating_count,
          },
          { onConflict: 'google_place_id' },
        )
        .select('id, name')
        .single();
      if (dbError) throw dbError;
      if (!data) throw new Error('No venue returned');
      await addMyVenue(data.id);
      setSavedVenue({ id: data.id, name: data.name });
      setStep('done');
    } catch (e: any) {
      setError(e.message ?? 'Failed to add venue');
      setStep('search');
    }
  }

  if (step === 'saving') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.mustard} size="large" />
        <Text style={styles.loadingText}>Adding...</Text>
      </View>
    );
  }

  if (step === 'done' && savedVenue) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.doneInner}>
          <Text style={styles.doneEyebrow}>Added to the list</Text>
          <Text style={styles.doneTitle}>{savedVenue.name}</Text>
          <Text style={styles.doneSub}>It'll show up in your results next time.</Text>

          <View style={styles.doneActions}>
            <View style={styles.ctaContainer}>
              <View style={styles.ctaShadow} />
              <TouchableOpacity
                style={styles.cta}
                onPress={() =>
                  router.replace({
                    pathname: '/contribute',
                    params: { venue_id: savedVenue.id, venue_name: savedVenue.name },
                  })
                }
              >
                <Text style={styles.ctaText}>ADD A MENU PHOTO</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/')}>
              <Text style={styles.secondaryBtnText}>Done — back home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
          <Text style={styles.backPillText}>← back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>Found a bar we're missing</Text>
          <Text style={styles.title}>Add a bar</Text>
          <Text style={styles.subtitle}>Search by name. We'll grab the address and rating.</Text>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Bar name (e.g. Schofield's)"
            placeholderTextColor="rgba(10,26,28,0.35)"
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {searching && (
          <View style={styles.searchingRow}>
            <ActivityIndicator color={Colors.mustard} size="small" />
            <Text style={styles.searchingText}>searching...</Text>
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={item => item.google_place_id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !searching && query.trim().length >= 2 ? (
              <Text style={styles.emptyText}>No matches. Try a different spelling?</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.resultCard} onPress={() => handlePick(item)} activeOpacity={0.85}>
              <View style={styles.resultTop}>
                <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                {item.rating != null && (
                  <Text style={styles.resultRating}>★ {item.rating.toFixed(1)}</Text>
                )}
              </View>
              <Text style={styles.resultAddress} numberOfLines={2}>{item.address}</Text>
            </TouchableOpacity>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.teal,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: Colors.cream,
    opacity: 0.5,
    marginTop: 12,
    fontSize: 14,
    letterSpacing: 2,
  },

  backPill: {
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: Colors.cream,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: Colors.ink,
    paddingVertical: 7,
    paddingHorizontal: 14,
    shadowColor: Colors.ink,
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  backPillText: {
    color: Colors.ink,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 16,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: Colors.mustard,
    opacity: 0.6,
    marginBottom: 6,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 38,
    color: Colors.cream,
    lineHeight: 40,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.cream,
    opacity: 0.45,
    marginTop: 6,
    lineHeight: 18,
  },

  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: Colors.cream,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: Colors.ink,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.ink,
    fontWeight: '600',
  },

  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  searchingText: {
    color: Colors.cream,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.6,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 24,
    gap: 8,
  },
  emptyText: {
    color: Colors.cream,
    opacity: 0.4,
    fontSize: 13,
    textAlign: 'center',
    paddingTop: 24,
  },
  resultCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(242,232,208,0.12)',
    borderRadius: 18,
    padding: 14,
  },
  resultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultName: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.cream,
    flex: 1,
    lineHeight: 22,
  },
  resultRating: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    color: Colors.mustard,
    marginLeft: 10,
  },
  resultAddress: {
    fontSize: 11,
    color: 'rgba(242,232,208,0.45)',
    lineHeight: 16,
  },

  errorText: {
    color: Colors.red,
    fontSize: 12,
    paddingHorizontal: 22,
    paddingTop: 4,
  },

  doneInner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  doneEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: Colors.mustard,
    opacity: 0.6,
    marginBottom: 8,
  },
  doneTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 42,
    color: Colors.cream,
    lineHeight: 46,
    letterSpacing: -1,
    marginBottom: 10,
  },
  doneSub: {
    fontSize: 14,
    color: Colors.cream,
    opacity: 0.5,
    lineHeight: 20,
  },
  doneActions: {
    marginTop: 36,
    gap: 12,
  },
  ctaContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  ctaShadow: {
    position: 'absolute',
    top: 6,
    left: 5,
    right: -5,
    bottom: -6,
    borderRadius: 999,
    backgroundColor: Colors.ink,
  },
  cta: {
    backgroundColor: Colors.red,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: Colors.ink,
    paddingVertical: 18,
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  ctaText: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    color: Colors.cream,
    letterSpacing: 1,
  },
  secondaryBtn: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(242,232,208,0.2)',
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    color: Colors.cream,
    opacity: 0.5,
  },
});
