import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { Colors, FontFamily } from '../lib/theme';

const SUPABASE_URL = 'https://nkkmpkhzufdyyibwimpw.supabase.co';

interface ExtractedCocktail {
  type: 'NEGRONI' | 'OLD_FASHIONED';
  price_gbp: number | null;
}

type Step = 'pick' | 'extracting' | 'confirm' | 'saving' | 'done';

export default function ContributeScreen() {
  const { venue_id, venue_name, cocktail } = useLocalSearchParams<{ venue_id: string; venue_name: string; cocktail: string }>();
  const router = useRouter();

  const [step, setStep] = useState<Step>('pick');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [cocktails, setCocktails] = useState<ExtractedCocktail[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
      allowsEditing: false,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      await extract(result.assets[0].uri, result.assets[0].base64!);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.5,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      await extract(result.assets[0].uri, result.assets[0].base64!);
    }
  }

  async function extract(uri: string, base64: string) {
    setImageUri(uri);
    setStep('extracting');
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('extract-menu', {
        body: { image_base64: base64, mime_type: 'image/jpeg' },
      });
      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);
      setCocktails(data.cocktails ?? []);
      setStep('confirm');
    } catch (e: any) {
      setError(e.message ?? 'Failed to extract menu data');
      setStep('pick');
    }
  }

  async function save() {
    setStep('saving');
    try {
      const rows = cocktails.map(c => ({
        venue_id,
        cocktail: c.type,
        price: c.price_gbp,
        confidence_score: 3,
      }));
      const { error: dbError } = await supabase
        .from('venue_cocktails')
        .upsert(rows, { onConflict: 'venue_id,cocktail' });
      if (dbError) throw dbError;
      setStep('done');
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
      setStep('confirm');
    }
  }

  if (step === 'done') {
    return (
      <View style={styles.centered}>
        <Text style={styles.doneTitle}>Done!</Text>
        <Text style={styles.doneSub}>Thanks for keeping the data fresh.</Text>
        <View style={styles.ctaContainer}>
          <View style={styles.ctaShadow} />
          <TouchableOpacity style={styles.cta} onPress={() => router.replace({ pathname: '/results', params: { cocktail } })}>
            <Text style={styles.ctaText}>BACK TO RESULTS</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'extracting' || step === 'saving') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.mustard} size="large" />
        <Text style={styles.loadingText}>
          {step === 'extracting' ? 'Reading the menu...' : 'Saving...'}
        </Text>
      </View>
    );
  }

  if (step === 'confirm') {
    return (
      <SafeAreaView style={styles.container}>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />}

        <Text style={styles.heading}>Found on the menu</Text>

        {cocktails.length === 0 ? (
          <Text style={styles.emptyText}>
            No Negroni or Old Fashioned found.{'\n'}Try a clearer photo of the cocktails section.
          </Text>
        ) : (
          cocktails.map((c, i) => (
            <View key={i} style={styles.cocktailRow}>
              <Text style={styles.cocktailName}>
                {c.type === 'NEGRONI' ? 'Negroni' : 'Old Fashioned'}
              </Text>
              {c.price_gbp != null && (
                <Text style={styles.cocktailPrice}>£{c.price_gbp.toFixed(2)}</Text>
              )}
            </View>
          ))
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.actions}>
          {cocktails.length > 0 && (
            <View style={styles.ctaContainer}>
              <View style={styles.ctaShadow} />
              <TouchableOpacity style={styles.cta} onPress={save}>
                <Text style={styles.ctaText}>LOOKS RIGHT — SUBMIT</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('pick')}>
            <Text style={styles.secondaryBtnText}>Try another photo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // step === 'pick'
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>{venue_name}</Text>
      <Text style={styles.subheading}>
        Photograph the cocktail menu to update the drink info.
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.actions}>
        <View style={styles.ctaContainer}>
          <View style={styles.ctaShadow} />
          <TouchableOpacity style={styles.cta} onPress={takePhoto}>
            <Text style={styles.ctaText}>TAKE A PHOTO</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage}>
          <Text style={styles.secondaryBtnText}>Choose from library</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.teal,
    padding: 24,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  heading: {
    fontFamily: FontFamily.heading,
    fontSize: 28,
    color: Colors.cream,
    marginBottom: 8,
    lineHeight: 30,
  },
  subheading: {
    fontSize: 14,
    color: Colors.cream,
    opacity: 0.45,
    marginBottom: 32,
    lineHeight: 22,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 3,
    borderColor: Colors.ink,
  },
  cocktailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(242,232,208,0.1)',
    padding: 16,
    marginBottom: 10,
  },
  cocktailName: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.cream,
  },
  cocktailPrice: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.mustard,
  },
  actions: {
    marginTop: 'auto',
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
  loadingText: {
    color: Colors.cream,
    opacity: 0.5,
    marginTop: 14,
    fontSize: 14,
    letterSpacing: 2,
  },
  doneTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 48,
    color: Colors.mustard,
    marginBottom: 8,
  },
  doneSub: {
    fontSize: 14,
    color: Colors.cream,
    opacity: 0.45,
    letterSpacing: 1,
    marginBottom: 36,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.cream,
    opacity: 0.45,
    lineHeight: 22,
    marginBottom: 24,
  },
  errorText: {
    color: Colors.red,
    fontSize: 13,
    marginBottom: 16,
  },
});
