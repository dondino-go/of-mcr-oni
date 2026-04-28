jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __reset: () => { store = {}; },
    getItem: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
    setItem: jest.fn((k: string, v: string) => { store[k] = v; return Promise.resolve(); }),
    removeItem: jest.fn((k: string) => { delete store[k]; return Promise.resolve(); }),
    clear: jest.fn(() => { store = {}; return Promise.resolve(); }),
  };
});
