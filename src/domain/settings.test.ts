import { describe, expect, test } from "vitest";
import { createDefaultCampaignGiftConfig, normalizeCampaignGiftConfig } from "./settings";

describe("campaign gift settings", () => {
  test("creates the default campaign gift config", () => {
    expect(createDefaultCampaignGiftConfig()).toEqual({
      enabled: false,
      activityName: "运营赠礼",
      targetType: "sku",
      defaultProductId: "",
      defaultSpu: "",
      requireSaleLine: true
    });
  });

  test("trims activity names and keeps provided values", () => {
    expect(
      normalizeCampaignGiftConfig({
        enabled: true,
        activityName: "  关注小红书赠礼  ",
        defaultProductId: "gift-active",
        requireSaleLine: false
      })
    ).toEqual({
      enabled: true,
      activityName: "关注小红书赠礼",
      targetType: "sku",
      defaultProductId: "gift-active",
      defaultSpu: "",
      requireSaleLine: false
    });
  });

  test("补齐旧运营赠礼配置的目标类型和默认 SPU", () => {
    expect(
      normalizeCampaignGiftConfig({
        enabled: true,
        activityName: "关注社媒赠礼",
        defaultProductId: "gift-1",
        requireSaleLine: true
      })
    ).toEqual({
      enabled: true,
      activityName: "关注社媒赠礼",
      targetType: "sku",
      defaultProductId: "gift-1",
      defaultSpu: "",
      requireSaleLine: true
    });
  });

  test("falls back to the default activity name when the provided name is blank", () => {
    expect(
      normalizeCampaignGiftConfig({
        activityName: "   "
      })
    ).toEqual({
      enabled: false,
      activityName: "运营赠礼",
      targetType: "sku",
      defaultProductId: "",
      defaultSpu: "",
      requireSaleLine: true
    });
  });
});
