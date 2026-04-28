import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@of_mcroni/my_venue_ids';

export async function getMyVenueIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export async function addMyVenue(id: string): Promise<void> {
  const ids = await getMyVenueIds();
  if (ids.has(id)) return;
  ids.add(id);
  await AsyncStorage.setItem(KEY, JSON.stringify([...ids]));
}

// Drop a venue from the personal-add boost. Two callers:
//  - contribute success: user contributed verified data, natural signals take over.
//  - removeBar (dead-end): user is deleting a venue they added that turned out to be unusable.
export async function removeMyVenue(id: string): Promise<void> {
  const ids = await getMyVenueIds();
  if (!ids.has(id)) return;
  ids.delete(id);
  await AsyncStorage.setItem(KEY, JSON.stringify([...ids]));
}
