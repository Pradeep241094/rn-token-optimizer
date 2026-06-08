// ─── useCart hook ─────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import * as CartService from '../services/CartService';
import type { CartItem, Order, Address } from '../types';

export interface UseCartReturn {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  total: number;
  isLoading: boolean;
  isCheckingOut: boolean;
  error: string | null;
  lastOrder: Order | null;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  checkout: (address: Address, paymentMethodId: string, couponCode?: string) => Promise<Order | null>;
  refreshCart: () => Promise<void>;
}

export function useCart(): UseCartReturn {
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const syncCart = useCallback((summary: CartService.CartSummary) => {
    setItems(summary.items);
    setSubtotal(summary.subtotal);
    setTotal(summary.total);
  }, []);

  const refreshCart = useCallback(async () => {
    setIsLoading(true);
    try {
      const summary = await CartService.fetchCart();
      syncCart(summary);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load cart');
    } finally {
      setIsLoading(false);
    }
  }, [syncCart]);

  const addToCart = useCallback(async (productId: string, quantity = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await CartService.addToCart(productId, quantity);
      syncCart(summary);
    } catch (err: any) {
      setError(err.message ?? 'Could not add to cart');
    } finally {
      setIsLoading(false);
    }
  }, [syncCart]);

  const removeFromCart = useCallback(async (productId: string) => {
    setIsLoading(true);
    try {
      const summary = await CartService.removeFromCart(productId);
      syncCart(summary);
    } catch (err: any) {
      setError(err.message ?? 'Could not remove item');
    } finally {
      setIsLoading(false);
    }
  }, [syncCart]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (quantity <= 0) { await removeFromCart(productId); return; }
    setIsLoading(true);
    try {
      const summary = await CartService.updateCartItem(productId, quantity);
      syncCart(summary);
    } catch (err: any) {
      setError(err.message ?? 'Could not update quantity');
    } finally {
      setIsLoading(false);
    }
  }, [syncCart, removeFromCart]);

  const clearCart = useCallback(async () => {
    setIsLoading(true);
    try {
      await CartService.clearCart();
      setItems([]); setSubtotal(0); setTotal(0);
    } catch (err: any) {
      setError(err.message ?? 'Could not clear cart');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const applyCoupon = useCallback(async (code: string) => {
    setIsLoading(true);
    try {
      const summary = await CartService.applyCoupon(code);
      syncCart(summary);
    } catch (err: any) {
      setError(err.message ?? 'Invalid coupon code');
    } finally {
      setIsLoading(false);
    }
  }, [syncCart]);

  const checkout = useCallback(async (address: Address, paymentMethodId: string, couponCode?: string): Promise<Order | null> => {
    setIsCheckingOut(true);
    setError(null);
    try {
      const order = await CartService.checkout({ shippingAddress: address, paymentMethodId, couponCode });
      setLastOrder(order);
      setItems([]); setSubtotal(0); setTotal(0);
      return order;
    } catch (err: any) {
      setError(err.message ?? 'Checkout failed. Please try again.');
      return null;
    } finally {
      setIsCheckingOut(false);
    }
  }, []);

  return {
    items, itemCount, subtotal, total, isLoading, isCheckingOut, error, lastOrder,
    addToCart, removeFromCart, updateQuantity, clearCart, applyCoupon, checkout, refreshCart,
  };
}
