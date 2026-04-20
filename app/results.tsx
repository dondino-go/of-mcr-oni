import { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { CocktailType, VenueWithCocktails } from '../lib/types';
import { getVenuesNearby } from '../lib/venues';
import { Colors, FontFamily } from '../lib/theme';

const FALLBACK_LAT = 53.4784;
const FALLBACK_LNG = -2.2232;
const MANCHESTER_RADIUS_KM = 30;

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1A4248' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#F2E8D0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0D2B2E' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0D2B2E' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0A1A1C' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#F2E8D0' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#153538' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1A4248' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A1A1C' }] },
];

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { cocktail, radiusKm: radiusKmParam } = useLocalSearchParams<{ cocktail: CocktailType; radiusKm: string }>();
  const radiusKm = parseFloat(radiusKmParam ?? '5');
  const router = useRouter();

  const [venues, setVenues] = useState<VenueWithCocktails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState({ lat: FALLBACK_LAT, lng: FALLBACK_LNG });

  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList>(null);
  const markerRefs = useRef<{ [id: string]: any }>({});

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      let lat = FALLBACK_LAT, lng = FALLBACK_LNG;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const distKm = getDistanceKm(loc.coords.latitude, loc.coords.longitude, FALLBACK_LAT, FALLBACK_LNG);
        if (distKm <= MANCHESTER_RADIUS_KM) {
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      }
      setUserLoc({ lat, lng });
      const results = await getVenuesNearby(cocktail, lat, lng, radiusKm);
      setVenues(results);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function selectVenue(id: string) {
    setSelectedId(id);
    const venue = venues.find(v => v.id === id);
    if (!venue) return;
    mapRef.current?.animateToRegion({
      latitude: venue.lat,
      longitude: venue.lng,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    }, 300);
    markerRefs.current[id]?.showCallout();
    const index = venues.findIndex(v => v.id === id);
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
  }

  const label = cocktail === 'NEGRONI' ? 'Negroni' : 'Old Fashioned';
  const mapDelta = (radiusKm * 2 / 111) * 1.6;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.mustard} size="large" />
        <Text style={styles.loadingText}>Finding bars...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={[styles.mapWrapper, { height: 380 + insets.top }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={MAP_STYLE}
          initialRegion={{
            latitude: userLoc.lat,
            longitude: userLoc.lng,
            latitudeDelta: mapDelta,
            longitudeDelta: mapDelta,
          }}
        >
          <Marker
            coordinate={{ latitude: userLoc.lat, longitude: userLoc.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={true}
            zIndex={10}
          >
            <View style={styles.userDot} />
          </Marker>
          {venues.map(venue => (
            <Marker
              key={venue.id}
              ref={ref => { if (ref) markerRefs.current[venue.id] = ref; }}
              coordinate={{ latitude: venue.lat, longitude: venue.lng }}
              onPress={() => selectVenue(venue.id)}
              pinColor={Colors.red}
              title={venue.name}
            />
          ))}
        </MapView>

      </View>

      {/* Back button — below map */}
      <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
        <Text style={styles.backPillText}>← {label} · {radiusKm}km</Text>
      </TouchableOpacity>

      {/* Results header */}
      <View style={styles.resultsHeader}>
        <View style={styles.resultsHeaderInner}>
          <View>
            <Text style={styles.resultsCount}>
              <Text style={styles.resultsCountNum}>{venues.length}</Text>
              {' '}bars
            </Text>
            <Text style={styles.resultsSub}>nearby · {label.toLowerCase()} · {radiusKm}km</Text>
          </View>
        </View>
      </View>

      {/* List */}
      {venues.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No {label} bars within range.{'\n'}Try more patience!</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          data={venues}
          keyExtractor={item => item.id}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item, index }) => (
            <VenueCard
              venue={item}
              cocktailType={cocktail}
              index={index}
              selected={item.id === selectedId}
              onPress={() => selectVenue(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Bottom strip */}
      <View style={styles.bottomStrip}>
        <View>
          <Text style={styles.bottomStripText}>Prices change. Help us keep up.</Text>
          <Text style={styles.bottomStripSub}>Tap + update on any bar above</Text>
        </View>
        <Text style={styles.bottomStripArrow}>→</Text>
      </View>
    </View>
  );
}

function VenueCard({
  venue,
  cocktailType,
  index,
  selected,
  onPress,
}: {
  venue: VenueWithCocktails;
  cocktailType: CocktailType;
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const router = useRouter();
  const cocktail = venue.cocktails.find(c => c.cocktail === cocktailType)!;
  const distanceText = venue.distance_m! < 1000
    ? `${venue.distance_m}m`
    : `${(venue.distance_m! / 1000).toFixed(1)}km`;

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Floating rank badge */}
      <View style={[styles.rankBadge, !selected && styles.rankBadgeUnsel]}>
        <Text style={[styles.rankText, !selected && styles.rankTextUnsel]}>{index + 1}</Text>
      </View>

      <View style={styles.cardInner}>
        <View style={styles.cardTop}>
          <Text style={[styles.venueName, !selected && styles.venueNameUnsel]} numberOfLines={1}>
            {venue.name}
          </Text>
          <Text style={[styles.venueDistance, !selected && styles.venueDistanceUnsel]}>
            {distanceText}
          </Text>
        </View>
        <Text style={[styles.venueAddress, !selected && styles.venueAddressUnsel]}>
          {venue.address}
        </Text>
        <View style={styles.cardBottom}>
          {cocktail.price != null && (
            <Text style={[styles.venuePrice, !selected && styles.venuePriceUnsel]}>
              £{cocktail.price.toFixed(2)}
            </Text>
          )}
          {cocktail.confidence_score != null && cocktail.confidence_score < 3 && (
            <View style={[styles.badge, !selected && styles.badgeUnsel]}>
              <Text style={[styles.badgeText, !selected && styles.badgeTextUnsel]}>unverified</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.updateBtn, !selected && styles.updateBtnUnsel]}
            onPress={() => router.push({ pathname: '/contribute', params: { venue_id: venue.id, venue_name: venue.name, cocktail: cocktailType } })}
          >
            <Text style={[styles.updateText, !selected && styles.updateTextUnsel]}>+ update</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
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
  errorText: {
    color: Colors.red,
    fontSize: 15,
    textAlign: 'center',
  },

  // Map
  mapWrapper: {
    height: 380, // overridden inline to add insets.top
    position: 'relative',
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.ink,
  },
  map: {
    flex: 1,
  },
  userDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.mustard,
    borderWidth: 2.5,
    borderColor: Colors.ink,
  },
  backPill: {
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
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

  // Results header
  resultsHeader: {
    backgroundColor: Colors.teal,
  },
  resultsHeaderInner: {
    paddingHorizontal: 20,
    paddingTop: 16, // supplemented by insets.top inline
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  resultsCount: {
    fontFamily: FontFamily.heading,
    fontSize: 36,
    color: Colors.cream,
    letterSpacing: -1,
    lineHeight: 36,
  },
  resultsCountNum: {
    fontFamily: FontFamily.heading,
    fontSize: 48,
    color: Colors.red,
  },
  resultsSub: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: Colors.cream,
    opacity: 0.35,
    marginTop: 4,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    color: Colors.cream,
    opacity: 0.4,
    textAlign: 'center',
    lineHeight: 28,
  },

  // Venue card
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 2.5,
    borderColor: 'rgba(242,232,208,0.1)',
    borderRadius: 24,
    padding: 14,
    position: 'relative',
    marginTop: 8,
  },
  cardSelected: {
    backgroundColor: Colors.cream,
    borderColor: Colors.ink,
    borderWidth: 3,
    shadowColor: Colors.ink,
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  rankBadge: {
    position: 'absolute',
    top: -10,
    left: 14,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.mustard,
    borderWidth: 2.5,
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  rankBadgeUnsel: {
    backgroundColor: 'rgba(232,168,32,0.2)',
    borderColor: 'rgba(242,232,208,0.12)',
  },
  rankText: {
    fontFamily: FontFamily.heading,
    fontSize: 13,
    color: Colors.ink,
    lineHeight: 16,
  },
  rankTextUnsel: {
    color: 'rgba(232,168,32,0.55)',
  },
  cardInner: {
    paddingTop: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  venueName: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    color: Colors.ink,
    flex: 1,
    lineHeight: 22,
  },
  venueNameUnsel: {
    color: 'rgba(242,232,208,0.65)',
  },
  venueDistance: {
    fontFamily: FontFamily.heading,
    fontSize: 16,
    color: Colors.red,
    marginLeft: 8,
  },
  venueDistanceUnsel: {
    color: 'rgba(212,43,43,0.4)',
  },
  venueAddress: {
    fontSize: 10,
    color: 'rgba(10,26,28,0.45)',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  venueAddressUnsel: {
    color: 'rgba(242,232,208,0.25)',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  venuePrice: {
    fontFamily: FontFamily.heading,
    fontSize: 19,
    color: Colors.ink,
    lineHeight: 20,
  },
  venuePriceUnsel: {
    color: 'rgba(242,232,208,0.45)',
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(10,26,28,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeUnsel: {
    borderColor: 'rgba(242,232,208,0.1)',
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(10,26,28,0.5)',
  },
  badgeTextUnsel: {
    color: 'rgba(242,232,208,0.2)',
  },
  updateBtn: {
    marginLeft: 'auto',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(212,43,43,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  updateBtnUnsel: {
    borderColor: 'rgba(212,43,43,0.15)',
  },
  updateText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.red,
  },
  updateTextUnsel: {
    color: 'rgba(212,43,43,0.35)',
  },

  // Bottom strip
  bottomStrip: {
    backgroundColor: Colors.mustard,
    borderTopWidth: 3.5,
    borderColor: Colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomStripText: {
    fontFamily: FontFamily.heading,
    fontSize: 15,
    color: Colors.ink,
    lineHeight: 18,
  },
  bottomStripSub: {
    fontSize: 9,
    color: Colors.ink,
    opacity: 0.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  bottomStripArrow: {
    fontFamily: FontFamily.heading,
    fontSize: 26,
    color: Colors.ink,
    opacity: 0.3,
  },
});
