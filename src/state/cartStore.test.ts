import { beforeEach, expect, test, vi } from "vitest";

async function loadCartStore() {
  vi.resetModules();
  return import("./cartStore");
}

beforeEach(() => {
  localStorage.clear();
});

test("persists cart items across store reloads", async () => {
  const firstModule = await loadCartStore();

  firstModule.useCartStore.getState().replace([
    {
      productId: "product-1",
      quantity: 2,
      addedAt: "2026-06-16T07:00:00.000Z"
    }
  ]);

  const secondModule = await loadCartStore();

  expect(secondModule.useCartStore.getState().items).toEqual([
    {
      productId: "product-1",
      quantity: 2,
      addedAt: "2026-06-16T07:00:00.000Z"
    }
  ]);
});

test("clear removes persisted cart items", async () => {
  const firstModule = await loadCartStore();

  firstModule.useCartStore.getState().replace([
    {
      productId: "product-1",
      quantity: 2,
      addedAt: "2026-06-16T07:00:00.000Z"
    }
  ]);
  firstModule.useCartStore.getState().clear();

  const secondModule = await loadCartStore();

  expect(secondModule.useCartStore.getState().items).toEqual([]);
});
