import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import { createDefaultSettings } from "./db/db";
import { setFieldLockPin } from "./domain/fieldLock";
import { notifyPwaUpdateReadyForTest } from "./utils/pwaUpdate";
import { notifySettingsUpdated } from "./utils/settingsEvents";

const repositories = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn()
}));
const pwaUpdate = vi.hoisted(() => ({
  applyPwaUpdate: vi.fn(),
  listeners: new Set<() => void>()
}));

vi.mock("./db/repositories", () => repositories);
vi.mock("./utils/pwaUpdate", () => ({
  applyPwaUpdate: pwaUpdate.applyPwaUpdate,
  notifyPwaUpdateReadyForTest: () => {
    pwaUpdate.listeners.forEach((listener) => listener());
  },
  subscribePwaUpdateReady: (listener: () => void) => {
    pwaUpdate.listeners.add(listener);

    return () => {
      pwaUpdate.listeners.delete(listener);
    };
  }
}));
vi.mock("./pages/ProductsPage", () => ({ default: () => <h1>商品</h1> }));
vi.mock("./pages/SalesPage", () => ({ default: () => <h1>售卖</h1> }));
vi.mock("./pages/DashboardPage", () => ({ default: () => <h1>仪表盘</h1> }));
vi.mock("./pages/SettingsPage", () => ({ default: () => <h1>设置</h1> }));

beforeEach(() => {
  vi.clearAllMocks();
  repositories.getSettings.mockResolvedValue(createDefaultSettings());
  repositories.saveSettings.mockResolvedValue(undefined);
  pwaUpdate.applyPwaUpdate.mockResolvedValue(undefined);
  pwaUpdate.listeners.clear();
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

test("shows the running app version in the top bar", async () => {
  render(
    <MemoryRouter initialEntries={["/sales"]}>
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByText("v1.6.1")).toBeVisible();
});

test("shows shop name in the top bar subtitle and refreshes it after settings update", async () => {
  repositories.getSettings.mockResolvedValue({
    ...createDefaultSettings(),
    shopName: "楼下的妖怪便利店"
  });

  render(
    <MemoryRouter initialEntries={["/sales"]}>
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByText("楼下的妖怪便利店")).toBeVisible();
  expect(screen.queryByText("Booth POS 摊位工具")).not.toBeInTheDocument();

  act(() => {
    notifySettingsUpdated({
      ...createDefaultSettings(),
      shopName: "GA10 摊位"
    });
  });

  expect(await screen.findByText("GA10 摊位")).toBeVisible();
  expect(screen.queryByText("楼下的妖怪便利店")).not.toBeInTheDocument();
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

test("silently returns to sales when field mode is relocked from settings", async () => {
  const unlockedSettings = {
    ...createDefaultSettings(),
    fieldLock: {
      enabled: true,
      pinHash: "secret-hash",
      pinSalt: "secret-salt",
      failedAttempts: 0,
      unlockExpiresAt: "2099-06-19T09:05:00.000Z"
    }
  };
  repositories.getSettings.mockResolvedValue(unlockedSettings);

  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { level: 1, name: "设置" })).toBeVisible();

  act(() => {
    notifySettingsUpdated(
      {
        ...unlockedSettings,
        fieldLock: {
          ...unlockedSettings.fieldLock,
          unlockExpiresAt: undefined
        }
      },
      { suppressUnlockDialog: true }
    );
  });

  expect(await screen.findByRole("heading", { level: 1, name: "售卖" })).toBeVisible();
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "管理页面已锁定" })).not.toBeInTheDocument());
});

test("shows and dismisses the PWA update prompt when a new version is ready", async () => {
  render(
    <MemoryRouter initialEntries={["/sales"]}>
      <App />
    </MemoryRouter>
  );

  expect(screen.queryByText("发现新版本")).not.toBeInTheDocument();

  act(() => {
    notifyPwaUpdateReadyForTest();
  });

  expect(await screen.findByText("发现新版本")).toBeVisible();
  expect(screen.getByText("建议在空闲时刷新更新，商品、订单和库存数据不会被清空。")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "稍后" }));

  expect(screen.queryByText("发现新版本")).not.toBeInTheDocument();
});

test("applies the PWA update when the refresh update action is clicked", async () => {
  render(
    <MemoryRouter initialEntries={["/sales"]}>
      <App />
    </MemoryRouter>
  );

  act(() => {
    notifyPwaUpdateReadyForTest();
  });

  fireEvent.click(await screen.findByRole("button", { name: "刷新更新" }));

  expect(pwaUpdate.applyPwaUpdate).toHaveBeenCalledTimes(1);
});
