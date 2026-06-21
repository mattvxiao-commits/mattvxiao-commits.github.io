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

test("同一商品可以同时存在销售行和非销售出库行", async () => {
  const { useCartStore } = await loadCartStore();
  const store = useCartStore.getState();

  store.clear();
  store.addProduct("product-a");
  store.addNonSalesProduct({
    productId: "product-a",
    reason: "manual_gift",
    note: "好友赠送"
  });

  expect(useCartStore.getState().items).toMatchObject([
    { productId: "product-a", quantity: 1, revenueType: "sale" },
    {
      productId: "product-a",
      quantity: 1,
      revenueType: "non_sales",
      nonSalesReason: "manual_gift",
      nonSalesNote: "好友赠送"
    }
  ]);
  expect(useCartStore.getState().items[1].id).toEqual(expect.any(String));
});
