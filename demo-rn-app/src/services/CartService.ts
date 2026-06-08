// ─── CartService ──────────────────────────────────────────────────────────────

import { get, post, put, del } from './ApiService';
import type { CartItem, Order, Address, ApiResponse } from '../types';

export interface CartSummary {
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  itemCount: number;
}

export interface CheckoutPayload {
  shippingAddress: Address;
  paymentMethodId: string;
  couponCode?: string;
}

export async function fetchCart(): Promise<CartSummary> {
  const res = await get<CartSummary>('/cart');
  return res.data;
}

export async function addToCart(productId: string, quantity: number): Promise<CartSummary> {
  const res = await post<CartSummary>('/cart/items', { productId, quantity });
  return res.data;
}

export async function updateCartItem(productId: string, quantity: number): Promise<CartSummary> {
  const res = await put<CartSummary>(`/cart/items/${productId}`, { quantity });
  return res.data;
}

export async function removeFromCart(productId: string): Promise<CartSummary> {
  const res = await del<CartSummary>(`/cart/items/${productId}`);
  return res.data;
}

export async function clearCart(): Promise<void> {
  await del('/cart');
}

export async function applyCoupon(code: string): Promise<CartSummary> {
  const res = await post<CartSummary>('/cart/coupon', { code });
  return res.data;
}

export async function checkout(payload: CheckoutPayload): Promise<Order> {
  const res = await post<Order>('/cart/checkout', payload);
  return res.data;
}

export async function fetchOrderHistory(): Promise<Order[]> {
  const res = await get<Order[]>('/orders');
  return res.data;
}

export async function fetchOrderById(orderId: string): Promise<Order> {
  const res = await get<Order>(`/orders/${orderId}`);
  return res.data;
}

export async function cancelOrder(orderId: string): Promise<Order> {
  const res = await post<Order>(`/orders/${orderId}/cancel`, {});
  return res.data;
}

export function calculateCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}

export function formatShippingETA(daysMin: number, daysMax: number): string {
  const fmt = (d: number) => {
    const date = new Date();
    date.setDate(date.getDate() + d);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  return `${fmt(daysMin)} – ${fmt(daysMax)}`;
}
