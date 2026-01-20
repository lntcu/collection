export interface Settings {
  showDescriptions: boolean;
  showImages: boolean;
  cardsPerRow: number;
  sortBy: 'newest' | 'oldest' | 'alphabetical';
  openLinksInNewTab: boolean;
  confirmDelete: boolean;
  exportFormat: 'html' | 'markdown' | 'text' | 'json';
  exportCollectionIds: string[];
}

const SETTINGS_KEY = 'collection_settings';

const defaultSettings: Settings = {
  showDescriptions: true,
  showImages: false,
  cardsPerRow: 1,
  sortBy: 'newest',
  openLinksInNewTab: true,
  confirmDelete: true,
  exportFormat: 'html',
  exportCollectionIds: [],
};

export const settingsStorage = {
  getSettings: (): Settings => {
    if (typeof window === 'undefined') return defaultSettings;
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(data) };
  },

  saveSettings: (settings: Settings): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  updateSettings: (updates: Partial<Settings>): void => {
    const current = settingsStorage.getSettings();
    settingsStorage.saveSettings({ ...current, ...updates });
  },
};
