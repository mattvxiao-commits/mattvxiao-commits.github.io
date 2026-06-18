import type { AppSettings } from "../domain/types";

const SETTINGS_UPDATED_EVENT = "ecrm-settings-updated";

export type SettingsUpdatedOptions = {
  suppressUnlockDialog?: boolean;
};

export type SettingsUpdatedPayload = {
  settings: AppSettings;
  options?: SettingsUpdatedOptions;
};

export function notifySettingsUpdated(settings: AppSettings, options?: SettingsUpdatedOptions): void {
  window.dispatchEvent(new CustomEvent<SettingsUpdatedPayload>(SETTINGS_UPDATED_EVENT, {
    detail: {
      settings,
      options
    }
  }));
}

export function subscribeSettingsUpdated(listener: (settings: AppSettings, options?: SettingsUpdatedOptions) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<AppSettings | SettingsUpdatedPayload>).detail;

    if ("settings" in detail) {
      listener(detail.settings, detail.options);
      return;
    }

    listener(detail);
  };

  window.addEventListener(SETTINGS_UPDATED_EVENT, handler);
  return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, handler);
}
