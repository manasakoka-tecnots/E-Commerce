// src/context/CartContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/src/lib/supabase/client";

export type CartItem = {
  product: {
    id: string;
    name: string;
    price: number;
    image?: string;
    brand?: string;
    sellerListingId?: string;
    variantId?: string;
    variantTitle?: string;
  };
  quantity: number;
};

function cartItemKey(item: CartItem["product"]): string {
  return item.variantId ? `${item.id}::${item.variantId}` : item.id;
}

type CartContextType = {
  items: CartItem[];
  addItem: (product: CartItem["product"], quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  removeItem: (productId: string, variantId?: string) => void;
  clear: () => void;
  getItemQuantity: (productId: string, variantId?: string) => number;
  totalItems: number;
  totalAmount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY_PREFIX = "shopora_cart_";
const CART_GUEST_KEY = "shopora_cart_guest";

function getCartKey(userId: string | null) {
  return userId ? `${CART_KEY_PREFIX}${userId}` : CART_GUEST_KEY;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Listen for auth changes and load the correct user's cart
  useEffect(() => {
    // supabase is imported from client module

    const loadCart = (uid: string | null) => {
      try {
        const key = getCartKey(uid);
        const stored = window.localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored) as CartItem[];
          if (Array.isArray(parsed)) {
            setItems(parsed);
            setUserId(uid);
            setHydrated(true);
            return;
          }
        }
      } catch (error) {
        console.warn("Could not load cart from localStorage", error);
      }
      setItems([]);
      setUserId(uid);
      setHydrated(true);
    };

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      loadCart(user?.id ?? null);
    });

    // Listen for sign-in / sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      loadCart(uid);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Save cart to the correct per-user key
  useEffect(() => {
    if (!hydrated) return;
    try {
      const key = getCartKey(userId);
      window.localStorage.setItem(key, JSON.stringify(items));
    } catch (error) {
      console.warn("Could not save cart to localStorage", error);
    }
  }, [items, hydrated, userId]);

  const addItem = (product: CartItem["product"], quantity = 1) => {
    const key = cartItemKey(product);
    setItems((prev) => {
      const existing = prev.find((i) => cartItemKey(i.product) === key);
      if (existing) {
        return prev.map((i) =>
          cartItemKey(i.product) === key
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const updateQuantity = (productId: string, quantity: number, variantId?: string) => {
    const key = variantId ? `${productId}::${variantId}` : productId;
    if (quantity <= 0) {
      removeItem(productId, variantId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (cartItemKey(i.product) === key ? { ...i, quantity } : i))
    );
  };

  const removeItem = (productId: string, variantId?: string) => {
    const key = variantId ? `${productId}::${variantId}` : productId;
    setItems((prev) => prev.filter((i) => cartItemKey(i.product) !== key));
  };

  const clear = () => setItems([]);

  const getItemQuantity = (productId: string, variantId?: string): number => {
    const key = variantId ? `${productId}::${variantId}` : productId;
    const item = items.find((i) => cartItemKey(i.product) === key);
    return item ? item.quantity : 0;
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clear,
        getItemQuantity,
        totalItems,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
