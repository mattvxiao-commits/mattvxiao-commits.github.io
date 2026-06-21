import { describe, expect, test } from "vitest";
import { createDefaultCampaignGiftConfig, normalizeCampaignGiftConfig } from "./settings";

describe("campaign gift settings", () => {
  test("creates the default campaign gift config", () => {
    expect(createDefaultCampaignGiftConfig()).toEqual({
      enabled: false,
      activityName: "运营赠礼",
      defaultProductId: "",
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
      defaultProductId: "gift-active",
      requireSaleLine: false
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
      defaultProductId: "",
      requireSaleLine: true
    });
  });
});
