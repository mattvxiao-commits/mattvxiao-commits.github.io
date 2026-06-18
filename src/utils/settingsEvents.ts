import type { AppSettings } from "../domain/types";

const SETTINGS_UPDATED_EVENT = "ecrm-settings-updated";

export function notifySettingsUpdated(settings: AppSettings): void {
  window.dispatchEvent(new CustomEvent<AppSettings>(SETTINGS_UPDATED_EVENT, { detail: settings }));
}

export function subscribeSettingsUpdated(listener: (settings: AppSettings) => void): () => void {
  const handler = (event: Event) => {
    listener((event as CustomEvent<AppSettings>).detail);
  };

  window.addEventListener(SETTINGS_UPDATED_EVENT, handler);
  return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, handler);
}
