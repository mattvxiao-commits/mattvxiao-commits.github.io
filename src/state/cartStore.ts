import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, NonSalesReason } from "../domain/types";

type AddNonSalesInput = {
  productId: string;
  reason: Exclude<NonSalesReason, "tier_gift">;
  note?: string;
  campaignNameSnapshot?: string;
};

type CartState = {
  items: CartItem[];
  addProduct: (productId: string) => void;
  addNonSalesProduct: (input: AddNonSalesInput) => void;
  increment: (itemIdOrProductId: string) => void;
  decrement: (itemIdOrProductId: string) => void;
  updateLineType: (itemId: string, patch: Partial<CartItem>) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
};

function incrementItems(items: CartItem[], productId: string): CartItem[] {
  const existing = items.find((item) => item.productId === productId && item.revenueType !== "non_sales");
  if (!existing) {
    return [...items, { id: createCartLineId(), productId, quantity: 1, addedAt: new Date().toISOString(), revenueType: "sale" }];
  }

  return items.map((item) =>
    item === existing ? { ...item, revenueType: "sale", quantity: item.quantity + 1 } : item
  );
}

function createCartLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function findItemByIdOrProductId(items: CartItem[], itemIdOrProductId: string): CartItem | undefined {
  return items.find((item) => item.id === itemIdOrProductId) ?? items.find((item) => item.productId === itemIdOrProductId);
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addProduct: (productId) => {
        set((state) => ({ items: incrementItems(state.items, productId) }));
      },
      addNonSalesProduct: (input) => {
        set((state) => ({
          items: [
            ...state.items,
            {
              id: createCartLineId(),
              productId: input.productId,
              quantity: 1,
              addedAt: new Date().toISOString(),
              revenueType: "non_sales",
              nonSalesReason: input.reason,
              nonSalesNote: input.note?.trim() || undefined,
              campaignNameSnapshot: input.campaignNameSnapshot
            }
          ]
        }));
      },
      increment: (itemIdOrProductId) => {
        set((state) => {
          const target = findItemByIdOrProductId(state.items, itemIdOrProductId);
          if (!target) {
            return { items: incrementItems(state.items, itemIdOrProductId) };
          }

          return {
            items: state.items.map((item) => (item === target ? { ...item, quantity: item.quantity + 1 } : item))
          };
        });
      },
      decrement: (itemIdOrProductId) => {
        set((state) => {
          const target = findItemByIdOrProductId(state.items, itemIdOrProductId);

          return {
            items: state.items.flatMap((item) => {
              if (item !== target) {
                return [item];
              }

              const quantity = item.quantity - 1;
              return quantity > 0 ? [{ ...item, quantity }] : [];
            })
          };
        });
      },
      updateLineType: (itemId, patch) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  ...patch,
                  revenueType: patch.revenueType ?? item.revenueType ?? "sale"
                }
              : item
          )
        }));
      },
      clear: () => {
        set({ items: [] });
      },
      replace: (items) => {
        set({ items: items.map((item) => ({ ...item })) });
      }
    }),
    {
      name: "ecrm-cart",
      partialize: (state) => ({ items: state.items })
    }
  )
);

export type { CartState };
