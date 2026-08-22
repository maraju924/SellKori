import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Product } from '../../types';
import {
  addCartLine,
  cartItemCount,
  parseStoredCart,
  removeCartLine,
  setCartLineQuantity,
  shopCartStorageKey,
  shopPassengerId,
  type CartLine,
} from '../../lib/storefront';

interface ShopCartContextValue {
  businessId: string;
  sessionId: string;
  items: CartLine[];
  itemCount: number;
  addItem: (productId: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  quantityOf: (productId: string) => number;
}

const ShopCartContext = createContext<ShopCartContextValue | null>(null);

export function ShopCartProvider({
  businessId,
  children,
}: {
  businessId: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    if (!businessId) return;
    setItems(parseStoredCart(localStorage.getItem(shopCartStorageKey(businessId))));
    setSessionId(shopPassengerId(businessId));
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    localStorage.setItem(shopCartStorageKey(businessId), JSON.stringify(items));
  }, [businessId, items]);

  const addItem = useCallback((productId: string, quantity = 1) => {
    setItems(current => addCartLine(current, productId, quantity));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems(current => setCartLineQuantity(current, productId, quantity));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(current => removeCartLine(current, productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const quantityOf = useCallback((productId: string) => {
    return items.find(line => line.productId === productId)?.quantity || 0;
  }, [items]);

  const value = useMemo<ShopCartContextValue>(() => ({
    businessId,
    sessionId,
    items,
    itemCount: cartItemCount(items),
    addItem,
    setQuantity,
    removeItem,
    clear,
    quantityOf,
  }), [addItem, businessId, clear, items, quantityOf, removeItem, sessionId, setQuantity]);

  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>;
}

export function useShopCart() {
  const ctx = useContext(ShopCartContext);
  if (!ctx) throw new Error('useShopCart must be used inside ShopCartProvider');
  return ctx;
}

export function productById(products: Product[] | undefined, productId: string): Product | undefined {
  return (products || []).find(product => product.id === productId);
}
