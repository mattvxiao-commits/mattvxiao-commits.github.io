import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import { createDefaultSettings } from "./db/db";
import { setFieldLockPin } from "./domain/fieldLock";

const repositories = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn()
}));

vi.mock("./db/repositories", () => repositories);
vi.mock("./pages/ProductsPage", () => ({ default: () => <h1>商品</h1> }));
vi.mock("./pages/SalesPage", () => ({ default: () => <h1>售卖</h1> }));
vi.mock("./pages/DashboardPage", () => ({ default: () => <h1>仪表盘</h1> }));
vi.mock("./pages/SettingsPage", () => ({ default: () => <h1>设置</h1> }));

beforeEach(() => {
  vi.clearAllMocks();
  repositories.getSettings.mockResolvedValue(createDefaultSettings());
  repositories.saveSettings.mockResolvedValue(undefined);
});

test("renders the app shell navigation and redirects to products by default", async () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );

  const nav = screen.getByRole("navigation", { name: "主导航" });

  expect(nav).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "商品" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "售卖" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "仪表盘" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "设置" })).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { level: 1, name: "商品" })
  ).toBeVisible();
});

test("locks products navigation when field mode is enabled", async () => {
  repositories.getSettings.mockResolvedValue({
    ...createDefaultSettings(),
    fieldLock: {
      enabled: true,
      pinHash: "secret-hash",
      pinSalt: "secret-salt",
      failedAttempts: 0
    }
  });

  render(
    <MemoryRouter initialEntries={["/sales"]}>
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { level: 1, name: "售卖" })).toBeVisible();
  fireEvent.click(screen.getByRole("link", { name: "商品" }));

  expect(await screen.findByRole("dialog", { name: "管理页面已锁定" })).toBeVisible();
  expect(screen.queryByRole("heading", { level: 1, name: "商品" })).not.toBeInTheDocument();
});

test("unlocks protected navigation with correct PIN", async () => {
  repositories.getSettings.mockResolvedValue({
    ...createDefaultSettings(),
    fieldLock: await setFieldLockPin(createDefaultSettings().fieldLock, "2580", "2580")
  });

  render(
    <MemoryRouter initialEntries={["/sales"]}>
      <App />
    </MemoryRouter>
  );

  fireEvent.click(await screen.findByRole("link", { name: "商品" }));
  fireEvent.change(await screen.findByLabelText("4 位数字密码"), { target: { value: "2580" } });
  fireEvent.click(screen.getByRole("button", { name: "解锁" }));

  expect(await screen.findByRole("heading", { level: 1, name: "商品" })).toBeVisible();
});
