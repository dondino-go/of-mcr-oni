import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CocktailType } from '../lib/types';
import { Colors, FontFamily } from '../lib/theme';

const PATIENCE_OPTIONS = [
  { label: 'RIGHT NOW', desc: 'Basically around the corner', radiusKm: 0.5 },
  { label: 'GETTING THERE', desc: 'Worth lacing up for', radiusKm: 1.5 },
  { label: "I'M AN EXPLORER", desc: 'Wherever the night takes you', radiusKm: 5 },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cocktail, setCocktail] = useState<CocktailType | null>(null);
  const [patienceIdx, setPatienceIdx] = useState<number | null>(null);

  const handleFind = () => {
    if (!cocktail || patienceIdx === null) return;
    router.push({
      pathname: '/results',
      params: { cocktail, radiusKm: PATIENCE_OPTIONS[patienceIdx].radiusKm },
    });
  };

  return (
    <View style={styles.container}>
      {/* Ambient background blobs */}
      <View style={styles.blobTopRight} />
      <View style={styles.blobBottomLeft} />

      {/* Cream header blob */}
      <View style={styles.headerBlob}>
        <View style={[styles.headerInner, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.eyebrow}>Manchester · Est. 2025</Text>
          <View style={styles.titleRow}>
            <Text style={styles.ofText}>OF</Text>
            <View>
              <Text style={styles.mainTitle}>MCR-</Text>
              <Text style={styles.mainTitle}>ONI</Text>
            </View>
          </View>
          <Text style={styles.tagline}>find your poison · the city awaits</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>

        <Text style={styles.sectionLabel}>What are you having</Text>
        <View style={styles.cocktailRow}>
          {(['NEGRONI', 'OLD_FASHIONED'] as CocktailType[]).map(type => {
            const sel = cocktail === type;
            const name = type === 'NEGRONI' ? 'NEGRONI' : 'OLD\nFASHIONED';
            const ing = type === 'NEGRONI' ? 'Gin · Campari\nSweet Vermouth' : 'Bourbon · Bitters\nSugar · Orange';
            return (
              <TouchableOpacity
                key={type}
                style={[styles.cocktailCircle, sel && styles.cocktailCircleSel]}
                onPress={() => setCocktail(type)}
                activeOpacity={0.85}
              >
                {sel && <View style={styles.selDot} />}
                <Text style={[styles.cocktailName, sel ? styles.cocktailNameSel : styles.cocktailNameUnsel]}>
                  {name}
                </Text>
                <Text style={[styles.cocktailIng, sel ? styles.cocktailIngSel : styles.cocktailIngUnsel]}>
                  {ing}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>How far will you go</Text>
        <View style={styles.distList}>
          {PATIENCE_OPTIONS.map((opt, i) => {
            const sel = patienceIdx === i;
            return (
              <TouchableOpacity
                key={opt.label}
                style={[styles.distPill, sel && styles.distPillSel]}
                onPress={() => setPatienceIdx(i)}
                activeOpacity={0.8}
              >
                {sel && <View style={styles.distAccent} />}
                <View style={styles.distTextCol}>
                  <Text style={[styles.distName, sel ? styles.distNameSel : styles.distNameUnsel]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.distDesc, sel ? styles.distDescSel : styles.distDescUnsel]}>
                    {opt.desc}
                  </Text>
                </View>
                <View style={styles.distKmCol}>
                  <Text style={[styles.distKm, sel ? styles.distKmSel : styles.distKmUnsel]}>
                    {opt.radiusKm}
                  </Text>
                  <Text style={[styles.distUnit, sel ? styles.distUnitSel : styles.distUnitUnsel]}>km</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CTA */}
        <View style={styles.ctaWrap}>
          <View style={styles.ctaStars}>
            {['✦', '✦', '✦', '✦', '✦'].map((s, i) => (
              <Text key={i} style={styles.ctaStar}>{s}</Text>
            ))}
          </View>
          <View style={styles.ctaContainer}>
            <View style={styles.ctaShadow} />
            <TouchableOpacity
              style={[styles.cta, (!cocktail || patienceIdx === null) && styles.ctaDisabled]}
              onPress={handleFind}
              disabled={!cocktail || patienceIdx === null}
              activeOpacity={0.9}
            >
              <Text style={styles.ctaText}>FIND MY DRINK</Text>
              <Text style={styles.ctaSub}>tap to search nearby</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const CIRCLE_SIZE = 163;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.teal,
  },

  // Background blobs
  blobTopRight: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(212,43,43,0.07)',
    top: -80,
    right: -100,
  },
  blobBottomLeft: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(232,168,32,0.05)',
    bottom: 100,
    left: -80,
  },

  // Header
  headerBlob: {
    backgroundColor: Colors.cream,
    borderBottomRightRadius: 80,
  },
  headerInner: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  eyebrow: {
    fontFamily: undefined,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: Colors.ink,
    opacity: 0.4,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 0,
  },
  ofText: {
    fontFamily: FontFamily.heading,
    fontSize: 42,
    color: Colors.red,
    lineHeight: 42,
    marginRight: 4,
    marginBottom: 8,
    transform: [{ rotate: '-4deg' }],
  },
  mainTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 72,
    color: Colors.ink,
    lineHeight: 62,
    letterSpacing: -2,
  },
  tagline: {
    fontFamily: undefined,
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: Colors.ink,
    opacity: 0.35,
    marginTop: 8,
  },

  // Body
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 32,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontFamily: undefined,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: Colors.mustard,
    opacity: 0.6,
    marginBottom: 12,
    marginLeft: 2,
  },

  // Cocktail circles
  cocktailRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 28,
  },
  cocktailCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2.5,
    borderColor: 'rgba(242,232,208,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cocktailCircleSel: {
    backgroundColor: Colors.cream,
    borderColor: Colors.ink,
    shadowColor: Colors.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  selDot: {
    position: 'absolute',
    top: -16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.mustard,
  },
  cocktailName: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
    paddingHorizontal: 10,
  },
  cocktailNameSel: { color: Colors.ink },
  cocktailNameUnsel: { color: 'rgba(242,232,208,0.3)' },
  cocktailIng: {
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  cocktailIngSel: { color: 'rgba(10,26,28,0.5)' },
  cocktailIngUnsel: { color: 'rgba(242,232,208,0.15)' },

  // Distance pills
  distList: {
    gap: 8,
    marginBottom: 0,
  },
  distPill: {
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: 'rgba(242,232,208,0.12)',
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  distPillSel: {
    borderColor: Colors.mustard,
    backgroundColor: 'rgba(232,168,32,0.1)',
  },
  distAccent: {
    position: 'absolute',
    left: 0,
    top: '20%',
    bottom: '20%',
    width: 4,
    borderRadius: 2,
    backgroundColor: Colors.mustard,
  },
  distTextCol: { flex: 1 },
  distName: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    letterSpacing: 0.3,
    lineHeight: 16,
    marginBottom: 2,
  },
  distNameSel: { color: Colors.mustard },
  distNameUnsel: { color: 'rgba(242,232,208,0.3)' },
  distDesc: {
    fontSize: 9,
    letterSpacing: 0.3,
  },
  distDescSel: { color: 'rgba(242,232,208,0.45)' },
  distDescUnsel: { color: 'rgba(242,232,208,0.15)' },
  distKmCol: { alignItems: 'flex-end' },
  distKm: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -1,
  },
  distKmSel: { color: Colors.mustard },
  distKmUnsel: { color: 'rgba(242,232,208,0.1)' },
  distUnit: {
    fontSize: 8,
    letterSpacing: 1,
    textAlign: 'right',
    marginTop: -2,
  },
  distUnitSel: { color: 'rgba(232,168,32,0.5)' },
  distUnitUnsel: { color: 'rgba(242,232,208,0.08)' },

  // CTA
  ctaWrap: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  ctaStars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  ctaStar: {
    fontSize: 10,
    color: Colors.mustard,
    opacity: 0.3,
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
    borderWidth: 3.5,
    borderColor: Colors.ink,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  ctaDisabled: {
    backgroundColor: Colors.tealMid,
    borderColor: 'rgba(242,232,208,0.1)',
  },
  ctaText: {
    fontFamily: FontFamily.heading,
    fontSize: 30,
    color: Colors.cream,
    letterSpacing: 2,
    lineHeight: 30,
  },
  ctaSub: {
    fontSize: 9,
    color: Colors.cream,
    letterSpacing: 3,
    textTransform: 'uppercase',
    opacity: 0.5,
    marginTop: 5,
  },
});
