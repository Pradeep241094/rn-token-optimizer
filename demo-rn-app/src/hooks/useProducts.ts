// ─── useProducts hook ─────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react';
import * as ProductService from '../services/ProductService';
import type { Product, Category } from '../types';
import type { ProductFilters } from '../services/ProductService';

export interface UseProductsReturn {
  products: Product[];
  featured: Product[];
  categories: Category[];
  selectedProduct: Product | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  filters: ProductFilters;
  loadProducts: (filters?: ProductFilters) => Promise<void>;
  loadMore: () => Promise<void>;
  loadFeatured: () => Promise<void>;
  loadCategories: () => Promise<void>;
  selectProduct: (product: Product | null) => void;
  fetchProductDetail: (id: string) => Promise<void>;
  setFilter: (key: keyof ProductFilters, value: any) => void;
  searchProducts: (query: string) => Promise<void>;
  clearFilters: () => void;
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFiltersState] = useState<ProductFilters>({ page: 1, pageSize: 20 });
  const pageRef = useRef(1);

  const loadProducts = useCallback(async (overrideFilters?: ProductFilters) => {
    setIsLoading(true);
    setError(null);
    pageRef.current = 1;
    try {
      const merged = { ...filters, ...overrideFilters, page: 1 };
      const result = await ProductService.fetchProducts(merged);
      setProducts(result.items);
      setHasMore(result.hasMore);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      pageRef.current += 1;
      const result = await ProductService.fetchProducts({ ...filters, page: pageRef.current });
      setProducts(prev => [...prev, ...result.items]);
      setHasMore(result.hasMore);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load more products');
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, filters]);

  const loadFeatured = useCallback(async () => {
    try {
      const items = await ProductService.fetchFeaturedProducts();
      setFeatured(items);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load featured products');
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await ProductService.fetchCategories();
      setCategories(cats);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load categories');
    }
  }, []);

  const fetchProductDetail = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const product = await ProductService.fetchProductById(id);
      setSelectedProduct(product);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load product');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectProduct = useCallback((product: Product | null) => {
    setSelectedProduct(product);
  }, []);

  const setFilter = useCallback((key: keyof ProductFilters, value: any) => {
    setFiltersState(prev => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const searchProducts = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await ProductService.searchProducts(query);
      setProducts(results);
      setHasMore(false);
    } catch (err: any) {
      setError(err.message ?? 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({ page: 1, pageSize: 20 });
  }, []);

  return {
    products, featured, categories, selectedProduct, isLoading, isLoadingMore,
    error, hasMore, filters, loadProducts, loadMore, loadFeatured, loadCategories,
    selectProduct, fetchProductDetail, setFilter, searchProducts, clearFilters,
  };
}
