import { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { CocktailType, VenueWithCocktails } from '../lib/types';
import { getVenuesNearby, getTagsForVenues } from '../lib/venues';
import { Colors, FontFamily } from '../lib/theme';
import { getDistanceKm, decodePolyline } from '../lib/geo';
import { sortVenues } from '../lib/sort';

const FALLBACK_LAT = 53.4784;
const FALLBACK_LNG = -2.2232;
const MANCHESTER_RADIUS_KM = 30;

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

type RouteStep = { instruction: string; distance: string; duration: string };
type RouteState = {
  venue: VenueWithCocktails;
  polyline: { latitude: number; longitude: number }[];
  steps: RouteStep[];
  totalDistance: string;
  totalDuration: string;
} | null;

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
  const [routeState, setRouteState] = useState<RouteState>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList>(null);
  const markerRefs = useRef<{ [id: string]: any }>({});

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      let lat = FALLBACK_LAT, lng = FALLBACK_LNG;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getLastKnownPositionAsync()
            ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const distKm = getDistanceKm(loc.coords.latitude, loc.coords.longitude, FALLBACK_LAT, FALLBACK_LNG);
          if (distKm <= MANCHESTER_RADIUS_KM) {
            lat = loc.coords.latitude;
            lng = loc.coords.longitude;
          }
        } catch {
          // location lookup failed (services off, no fix, etc.) — keep Manchester fallback
        }
      }
      setUserLoc({ lat, lng });
      const results = await getVenuesNearby(cocktail, lat, lng, radiusKm);
      setVenues(sortVenues(results, cocktail));
      // Fetch tags separately so they don't block the list appearing
      getTagsForVenues(results.map(v => v.id)).then(tags => {
        setVenues(prev => sortVenues(prev.map(v => ({ ...v, tags: tags[v.id] ?? [] })), cocktail));
      });
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function selectVenue(id: string) {
    setSelectedId(id);
    setRouteState(null);
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

  async function fetchDirections(venue: VenueWithCocktails) {
    setRouteLoading(true);
    try {
      const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${userLoc.lat},${userLoc.lng}` +
        `&destination=${venue.lat},${venue.lng}` +
        `&mode=walking&key=${key}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.routes?.length) throw new Error('No route found');
      const route = json.routes[0];
      const leg = route.legs[0];
      const polyline = decodePolyline(route.overview_polyline.points);
      const steps: RouteStep[] = leg.steps.map((s: any) => ({
        instruction: s.html_instructions.replace(/<[^>]+>/g, ''),
        distance: s.distance.text,
        duration: s.duration.text,
      }));
      setRouteState({ venue, polyline, steps, totalDistance: leg.distance.text, totalDuration: leg.duration.text });
      mapRef.current?.fitToCoordinates(polyline, {
        edgePadding: { top: 80, right: 40, bottom: 360, left: 40 },
        animated: true,
      });
    } catch {
      // stay in browse mode on failure
    } finally {
      setRouteLoading(false);
    }
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
          {routeState && (
            <Polyline
              coordinates={routeState.polyline}
              strokeColor={Colors.mustard}
              strokeWidth={4}
            />
          )}
        </MapView>
        {routeLoading && (
          <View style={styles.routeLoadingOverlay}>
            <ActivityIndicator color={Colors.mustard} size="small" />
            <Text style={styles.routeLoadingText}>getting route...</Text>
          </View>
        )}
      </View>

      {/* Back button — hidden in route mode (DirectionsPanel has its own) */}
      {!routeState && (
        <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
          <Text style={styles.backPillText}>← {label} · {radiusKm}km</Text>
        </TouchableOpacity>
      )}

      {routeState ? (
        <DirectionsPanel routeState={routeState} onBack={() => setRouteState(null)} bottomInset={insets.bottom} />
      ) : (
        <>
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
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <VenueCard
                  venue={item}
                  cocktailType={cocktail}
                  index={index}
                  selected={item.id === selectedId}
                  onPress={() => selectVenue(item.id)}
                  onDirections={() => fetchDirections(item)}
                  directionsLoading={routeLoading && selectedId === item.id}
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
        </>
      )}
    </View>
  );
}

function DirectionsPanel({
  routeState,
  onBack,
  bottomInset,
}: {
  routeState: NonNullable<RouteState>;
  onBack: () => void;
  bottomInset: number;
}) {
  return (
    <View style={[styles.directionsPanel, { paddingBottom: bottomInset + 12 }]}>
      <View style={styles.directionsPanelHeader}>
        <TouchableOpacity style={styles.backPill} onPress={onBack}>
          <Text style={styles.backPillText}>← back</Text>
        </TouchableOpacity>
        <View style={styles.directionsPanelVenue}>
          <Text style={styles.directionsPanelVenueName} numberOfLines={1}>{routeState.venue.name}</Text>
          <Text style={styles.directionsPanelSummary}>{routeState.totalDuration} · {routeState.totalDistance} walking</Text>
        </View>
        <TouchableOpacity
          style={styles.openInMapsPill}
          onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${routeState.venue.lat},${routeState.venue.lng}&travelmode=walking`)}
        >
          <Text style={styles.openInMapsPillText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.stepsScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.stepsContent}>
        {routeState.steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepDot} />
            <Text style={styles.stepInstruction} numberOfLines={4}>{step.instruction}</Text>
            <Text style={styles.stepDistance}>{step.distance}</Text>
          </View>
        ))}
        <View style={styles.stepDestination}>
          <View style={[styles.stepDot, styles.stepDotDest]} />
          <Text style={styles.stepDestinationText}>{routeState.venue.name}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const TAG_IMAGES: Record<string, any> = {
  great_vibe:     require('../assets/great_vibes.png'),
  hits_the_spot:  require('../assets/hits_the_spot.png'),
  perfectly_made: require('../assets/perfectly-made.png'),
  late_night_gem: require('../assets/late_night_gem.png'),
};

const TAG_ROTATION: Record<string, string> = {
  great_vibe:     '2deg',
  hits_the_spot:  '-2.5deg',
  perfectly_made: '1.5deg',
  late_night_gem: '-1.5deg',
};

function VenueCard({
  venue,
  cocktailType,
  index,
  selected,
  onPress,
  onDirections,
  directionsLoading,
}: {
  venue: VenueWithCocktails;
  cocktailType: CocktailType;
  index: number;
  selected: boolean;
  onPress: () => void;
  onDirections: () => void;
  directionsLoading: boolean;
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


      {venue.tags && venue.tags.length > 0 && (
        selected ? (
          <View style={styles.stickerCluster}>
            {venue.tags.slice(0, 4).map((tag, i) =>
              TAG_IMAGES[tag] ? (
                <Image
                  key={tag}
                  source={TAG_IMAGES[tag]}
                  style={[
                    styles.stickerCard,
                    { transform: [{ rotate: TAG_ROTATION[tag] ?? '0deg' }], marginLeft: i > 0 ? -22 : 0, zIndex: i },
                  ]}
                  resizeMode="contain"
                />
              ) : null
            )}
          </View>
        ) : (
          <View style={styles.stickerDotWrap}>
            <View style={styles.stickerDot} />
          </View>
        )
      )}

      <View style={[styles.cardInner, selected && venue.tags?.length ? styles.cardInnerWithStickers : undefined]}>
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
          <TouchableOpacity
            style={[styles.directionsBtn, !selected && styles.directionsBtnUnsel]}
            onPress={onDirections}
            disabled={directionsLoading}
          >
            <Text style={[styles.directionsText, !selected && styles.directionsTextUnsel]}>
              {directionsLoading ? '...' : 'directions'}
            </Text>
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
  routeLoadingOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    opacity: 0.85,
  },
  routeLoadingText: {
    color: Colors.cream,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
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
  stickerDotWrap: {
    position: 'absolute',
    top: -5,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  stickerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.mustard,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    opacity: 0.6,
  },
  stickerCluster: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  stickerCard: {
    width: 66,
    height: 52,
  },
  cardInnerWithStickers: {
    paddingTop: 32,
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
  directionsBtn: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(26,66,72,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  directionsBtnUnsel: {
    borderColor: 'rgba(242,232,208,0.12)',
  },
  directionsText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.teal,
  },
  directionsTextUnsel: {
    color: 'rgba(242,232,208,0.3)',
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

  // Directions panel
  directionsPanel: {
    flex: 1,
    backgroundColor: Colors.teal,
  },
  directionsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(242,232,208,0.1)',
    paddingBottom: 12,
  },
  directionsPanelVenue: {
    flex: 1,
  },
  directionsPanelVenueName: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.cream,
    lineHeight: 20,
  },
  directionsPanelSummary: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Colors.mustard,
    marginTop: 3,
  },
  openInMapsPill: {
    backgroundColor: Colors.mustard,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: Colors.ink,
    paddingVertical: 7,
    paddingHorizontal: 12,
    shadowColor: Colors.ink,
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  openInMapsPillText: {
    color: Colors.ink,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  stepsScroll: {
    flex: 1,
  },
  stepsContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,232,208,0.07)',
    gap: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.mustard,
    marginTop: 5,
    flexShrink: 0,
  },
  stepInstruction: {
    flex: 1,
    fontSize: 13,
    color: Colors.cream,
    lineHeight: 19,
  },
  stepDistance: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(242,232,208,0.4)',
    letterSpacing: 0.5,
    marginTop: 4,
    flexShrink: 0,
  },
  stepDestination: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  stepDotDest: {
    backgroundColor: Colors.red,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepDestinationText: {
    fontFamily: FontFamily.heading,
    fontSize: 16,
    color: Colors.red,
  },
});
