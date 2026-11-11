"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/src/lib/supabase/client";

export type WishlistItem = {
  id: string;
  name: string;
  price: number | null;
  referencePrice?: number | null;
  image?: string;
  brand?: string;
  sellerListingId?: string;
};

type WishlistContextType = {
  items: WishlistItem[];
  addItem: (item: WishlistItem) => void;
  removeItem: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (item: WishlistItem) => boolean; // returns new state
  totalItems: number;
};

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const WL_KEY_PREFIX = "shopora_wishlist_";
const WL_GUEST_KEY = "shopora_wishlist_guest";

function getWlKey(userId: string | null) {
  return userId ? `${WL_KEY_PREFIX}${userId}` : WL_GUEST_KEY;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = (uid: string | null) => {
      try {
        const key = getWlKey(uid);
        const stored = window.localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored) as WishlistItem[];
          if (Array.isArray(parsed)) {
            setItems(parsed);
            setUserId(uid);
            setHydrated(true);
            return;
          }
        }
      } catch {
        // ignore
      }
      setItems([]);
      setUserId(uid);
      setHydrated(true);
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      load(user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(getWlKey(userId), JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items, hydrated, userId]);

  const addItem = (item: WishlistItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== productId));
  };

  const isWishlisted = (productId: string) => items.some((i) => i.id === productId);

  const toggleWishlist = (item: WishlistItem): boolean => {
    if (isWishlisted(item.id)) {
      removeItem(item.id);
      return false;
    }
    addItem(item);
    return true;
  };

  return (
    <WishlistContext.Provider value={{ items, addItem, removeItem, isWishlisted, toggleWishlist, totalItems: items.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
