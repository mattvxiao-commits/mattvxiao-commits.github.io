import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

declare const process: {
  cwd: () => string;
};

const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

test("app shell switches from left rail to bottom navigation on narrow screens", () => {
  expect(styles).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*\.appRail\s*\{[\s\S]*inset:\s*auto 0 0 0/);
  expect(styles).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*\.appMain\s*\{[\s\S]*margin-left:\s*0/);
  expect(styles).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*\.railNav\s*\{[\s\S]*grid-auto-flow:\s*column/);
});
