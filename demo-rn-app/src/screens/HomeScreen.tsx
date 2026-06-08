// ─── HomeScreen ───────────────────────────────────────────────────────────────
// Main landing screen for authenticated users.
// Shows featured products, category carousel, and personalized recommendations.

import { useEffect, useCallback } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { formatPrice } from '../services/ProductService';
import type { Product, Category } from '../types';

export interface HomeScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; };
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const { featured, categories, loadFeatured, loadCategories, isLoading } = useProducts();
  const { itemCount, addToCart } = useCart();

  useEffect(() => {
    loadFeatured();
    loadCategories();
  }, [loadFeatured, loadCategories]);

  const handleProductPress = useCallback((product: Product) => {
    navigation.navigate('ProductDetail', { productId: product.id });
  }, [navigation]);

  const handleCategoryPress = useCallback((category: Category) => {
    navigation.navigate('ProductList', { categorySlug: category.slug, title: category.name });
  }, [navigation]);

  const handleAddToCart = useCallback(async (product: Product) => {
    await addToCart(product.id, 1);
  }, [addToCart]);

  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleNotificationsPress = useCallback(() => {
    navigation.navigate('Notifications');
  }, [navigation]);

  const handleCartPress = useCallback(() => {
    navigation.navigate('Cart');
  }, [navigation]);

  const handleSeeAllFeatured = useCallback(() => {
    navigation.navigate('ProductList', { title: 'Featured Products', featured: true });
  }, [navigation]);

  const getGreeting = useCallback((): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const renderHeroSection = useCallback(() => {
    return { greeting: getGreeting(), userName: user?.name ?? 'there' };
  }, [getGreeting, user]);

  return null;
}
