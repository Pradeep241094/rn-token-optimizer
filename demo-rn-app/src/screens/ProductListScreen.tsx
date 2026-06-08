// ─── ProductListScreen ────────────────────────────────────────────────────────

import { useEffect, useCallback } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useCart } from '../hooks/useCart';
import { useDebounce } from '../hooks/useTheme';
import { formatPrice } from '../services/ProductService';
import type { Product } from '../types';

export interface ProductListScreenProps {
  navigation: { navigate: (screen: string, params?: any) => void; goBack: () => void; };
  route: { params: { categorySlug?: string; title?: string; featured?: boolean } };
}

export function ProductListScreen({ navigation, route }: ProductListScreenProps) {
  const { products, isLoading, isLoadingMore, hasMore, filters, loadProducts, loadMore, setFilter, searchProducts, clearFilters } = useProducts();
  const { addToCart } = useCart();
  const debouncedSearch = useDebounce(filters.search ?? '', 350);

  useEffect(() => {
    if (route.params?.categorySlug) {
      setFilter('category', route.params.categorySlug);
    }
    loadProducts();
  }, [route.params]);

  useEffect(() => {
    if (debouncedSearch) {
      searchProducts(debouncedSearch);
    } else {
      loadProducts();
    }
  }, [debouncedSearch]);

  const handleProductPress = useCallback((product: Product) => {
    navigation.navigate('ProductDetail', { productId: product.id, product });
  }, [navigation]);

  const handleAddToCart = useCallback(async (product: Product) => {
    await addToCart(product.id);
  }, [addToCart]);

  const handleFilterPress = useCallback(() => {
    navigation.navigate('FilterSheet', { currentFilters: filters });
  }, [navigation, filters]);

  const handleSortPress = useCallback((sortBy: string) => {
    setFilter('sortBy', sortBy);
    loadProducts({ sortBy: sortBy as any });
  }, [setFilter, loadProducts]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) loadMore();
  }, [hasMore, isLoadingMore, loadMore]);

  const handleClearFilters = useCallback(() => {
    clearFilters();
    loadProducts({});
  }, [clearFilters, loadProducts]);

  return null;
}
