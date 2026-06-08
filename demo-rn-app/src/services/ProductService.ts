// ─── ProductService ───────────────────────────────────────────────────────────

import { get, post } from './ApiService';
import type { Product, Category, PaginatedResponse, ApiResponse } from '../types';

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  search?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'newest';
  page?: number;
  pageSize?: number;
}

export async function fetchProducts(filters: ProductFilters = {}): Promise<PaginatedResponse<Product>> {
  const params: Record<string, string> = {};
  if (filters.category)  params['category']  = filters.category;
  if (filters.minPrice)  params['minPrice']  = String(filters.minPrice);
  if (filters.maxPrice)  params['maxPrice']  = String(filters.maxPrice);
  if (filters.minRating) params['minRating'] = String(filters.minRating);
  if (filters.inStock)   params['inStock']   = String(filters.inStock);
  if (filters.search)    params['search']    = filters.search;
  if (filters.sortBy)    params['sortBy']    = filters.sortBy;
  if (filters.page)      params['page']      = String(filters.page);
  if (filters.pageSize)  params['pageSize']  = String(filters.pageSize ?? 20);

  const res = await get<PaginatedResponse<Product>>('/products', params);
  return res.data;
}

export async function fetchProductById(productId: string): Promise<Product> {
  const res = await get<Product>(`/products/${productId}`);
  return res.data;
}

export async function fetchFeaturedProducts(): Promise<Product[]> {
  const res = await get<Product[]>('/products/featured');
  return res.data;
}

export async function fetchProductsByCategory(categorySlug: string, page = 1): Promise<PaginatedResponse<Product>> {
  return fetchProducts({ category: categorySlug, page });
}

export async function searchProducts(query: string): Promise<Product[]> {
  const res = await get<Product[]>('/products/search', { q: query });
  return res.data;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await get<Category[]>('/categories');
  return res.data;
}

export async function fetchRelatedProducts(productId: string): Promise<Product[]> {
  const res = await get<Product[]>(`/products/${productId}/related`);
  return res.data;
}

export async function submitProductReview(productId: string, rating: number, comment: string): Promise<void> {
  await post(`/products/${productId}/reviews`, { rating, comment });
}

export function formatPrice(price: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

export function calculateDiscount(original: number, sale: number): number {
  return Math.round(((original - sale) / original) * 100);
}
