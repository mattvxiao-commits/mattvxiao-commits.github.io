import type { CampaignGiftConfig } from "./types";

const defaultCampaignGift: CampaignGiftConfig = {
  enabled: false,
  activityName: "运营赠礼",
  targetType: "sku",
  defaultProductId: "",
  defaultSpu: "",
  requireSaleLine: true
};

export function createDefaultCampaignGiftConfig(): CampaignGiftConfig {
  return structuredClone(defaultCampaignGift);
}

export function normalizeCampaignGiftConfig(config?: Partial<CampaignGiftConfig>): CampaignGiftConfig {
  const defaults = createDefaultCampaignGiftConfig();
  const activityName = config?.activityName?.trim() || defaults.activityName;

  return {
    enabled: config?.enabled ?? defaults.enabled,
    activityName,
    targetType: config?.targetType === "spu" ? "spu" : defaults.targetType,
    defaultProductId: config?.defaultProductId ?? defaults.defaultProductId,
    defaultSpu: config?.defaultSpu ?? defaults.defaultSpu,
    requireSaleLine: config?.requireSaleLine ?? defaults.requireSaleLine
  };
}
