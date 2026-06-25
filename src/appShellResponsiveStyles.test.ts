import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

declare const process: {
  cwd: () => string;
};

const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

function readZIndex(selector: string): number {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{[\\s\\S]*?z-index:\\s*(\\d+)`));

  if (!match) {
    throw new Error(`Missing z-index for ${selector}`);
  }

  return Number(match[1]);
}

test("app shell switches from left rail to bottom navigation on narrow screens", () => {
  expect(styles).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*\.appRail\s*\{[\s\S]*inset:\s*auto 0 0 0/);
  expect(styles).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*\.appMain\s*\{[\s\S]*margin-left:\s*0/);
  expect(styles).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*\.railNav\s*\{[\s\S]*grid-auto-flow:\s*column/);
});

test("mobile cart drawer stays above the bottom app shell", () => {
  expect(readZIndex(".cartDrawerLayer")).toBeGreaterThan(readZIndex(".appRail"));
});

test("mobile floating cart button avoids the bottom app shell", () => {
  expect(styles).toMatch(
    /@media\s*\(max-width:\s*720px\)[\s\S]*\.salesDock\s*\{[\s\S]*bottom:\s*calc\(var\(--app-mobile-nav-height\) \+ env\(safe-area-inset-bottom\) \+ 10px\)/
  );
});

test("checkout payment panel keeps confirmation actions reachable in the app shell", () => {
  expect(styles).toMatch(/\.checkoutPanel\s*\{[\s\S]*max-height:\s*calc\(100dvh - 96px\)/);
  expect(styles).toMatch(/\.checkoutPanel\s*\{[\s\S]*overflow:\s*auto/);
});

test("order detail dialogs keep actions reachable on constrained screens", () => {
  expect(styles).toMatch(/\.confirmDialog\s*\{[\s\S]*max-height:\s*min\(86dvh, 720px\)/);
  expect(styles).toMatch(/\.confirmDialog\s*\{[\s\S]*overflow:\s*auto/);
  expect(styles).toMatch(
    /@media\s*\(max-width:\s*720px\)[\s\S]*\.orderDetailDialog\s*\{[\s\S]*max-height:\s*calc\(100dvh - var\(--app-mobile-nav-height\) - env\(safe-area-inset-bottom\) - 20px\)/
  );
  expect(styles).toMatch(
    /@media\s*\(max-width:\s*720px\)[\s\S]*\.orderDetailBody\s*\{[\s\S]*padding-bottom:\s*calc\(18px \+ env\(safe-area-inset-bottom\)\)/
  );
});

test("management headers wrap before the mobile shell breakpoint", () => {
  expect(styles).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*\.productsToolbar\s*\{[\s\S]*align-items:\s*stretch/);
  expect(styles).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*\.toolbarActions\s*\{[\s\S]*width:\s*100%/);
  expect(styles).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*\.dashboardHeader\s*\{[\s\S]*align-items:\s*stretch/);
  expect(styles).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*\.dashboardFilterPanel\s*\{[\s\S]*width:\s*100%/);
  expect(styles).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*\.settingsHeader\s*\{[\s\S]*align-items:\s*stretch/);
  expect(styles).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*\.settingsHeader \.primaryButton\s*\{[\s\S]*width:\s*100%/);
});
