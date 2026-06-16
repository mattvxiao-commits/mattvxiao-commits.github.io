import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "../domain/types";

type CartState = {
  items: CartItem[];
  addProduct: (productId: string) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
};

function incrementItems(items: CartItem[], productId: string): CartItem[] {
  const existing = items.find((item) => item.productId === productId);
  if (!existing) {
    return [...items, { productId, quantity: 1, addedAt: new Date().toISOString() }];
  }

  return items.map((item) =>
    item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addProduct: (productId) => {
        set((state) => ({ items: incrementItems(state.items, productId) }));
      },
      increment: (productId) => {
        set((state) => ({ items: incrementItems(state.items, productId) }));
      },
      decrement: (productId) => {
        set((state) => ({
          items: state.items.flatMap((item) => {
            if (item.productId !== productId) {
              return [item];
            }

            const quantity = item.quantity - 1;
            return quantity > 0 ? [{ ...item, quantity }] : [];
          })
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
