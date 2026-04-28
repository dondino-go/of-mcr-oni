import AsyncStorage from '@react-native-async-storage/async-storage';
import { addMyVenue, getMyVenueIds, removeMyVenue } from '../myVenues';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('getMyVenueIds', () => {
  test('returns empty Set when storage is empty', async () => {
    const ids = await getMyVenueIds();
    expect(ids.size).toBe(0);
  });

  test('returns empty Set when storage holds malformed JSON', async () => {
    await AsyncStorage.setItem('@of_mcroni/my_venue_ids', 'not-json');
    const ids = await getMyVenueIds();
    expect(ids.size).toBe(0);
  });

  test('returns empty Set when storage holds non-array JSON', async () => {
    await AsyncStorage.setItem('@of_mcroni/my_venue_ids', '{"foo": "bar"}');
    const ids = await getMyVenueIds();
    expect(ids.size).toBe(0);
  });
});

describe('addMyVenue', () => {
  test('persists a single id', async () => {
    await addMyVenue('venue-1');
    const ids = await getMyVenueIds();
    expect([...ids]).toEqual(['venue-1']);
  });

  test('accumulates multiple ids', async () => {
    await addMyVenue('a');
    await addMyVenue('b');
    await addMyVenue('c');
    const ids = await getMyVenueIds();
    expect(ids.has('a') && ids.has('b') && ids.has('c')).toBe(true);
    expect(ids.size).toBe(3);
  });

  test('is idempotent — adding the same id twice keeps one', async () => {
    await addMyVenue('venue-1');
    await addMyVenue('venue-1');
    const ids = await getMyVenueIds();
    expect(ids.size).toBe(1);
  });
});

describe('removeMyVenue', () => {
  test('removes an id from the set', async () => {
    await addMyVenue('a');
    await addMyVenue('b');
    await removeMyVenue('a');
    const ids = await getMyVenueIds();
    expect([...ids]).toEqual(['b']);
  });

  test('is a no-op when id not in set', async () => {
    await addMyVenue('a');
    await removeMyVenue('not-there');
    const ids = await getMyVenueIds();
    expect([...ids]).toEqual(['a']);
  });

  test('safe to call when storage is empty', async () => {
    await expect(removeMyVenue('anything')).resolves.toBeUndefined();
    const ids = await getMyVenueIds();
    expect(ids.size).toBe(0);
  });

  test('after add → remove, set is empty again', async () => {
    await addMyVenue('a');
    await removeMyVenue('a');
    const ids = await getMyVenueIds();
    expect(ids.size).toBe(0);
  });
});

describe('round-trip', () => {
  test('add then remove restores original empty state', async () => {
    const before = await getMyVenueIds();
    expect(before.size).toBe(0);
    await addMyVenue('x');
    await removeMyVenue('x');
    const after = await getMyVenueIds();
    expect(after.size).toBe(0);
  });
});
