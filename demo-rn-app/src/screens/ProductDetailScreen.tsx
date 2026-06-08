// ─── ProductDetailScreen ──────────────────────────────────────────────────────

import { useEffect, useCallback, useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useCart } from '../hooks/useCart';
import { formatPrice, fetchRelatedProducts, calculateDiscount, submitProductReview } from '../services/ProductService';
import type { Product } from '../types';

export interface ProductDetailScreenProps {
  navigation: { navigate: (s: string, p?: any) => void; goBack: () => void; };
  route: { params: { productId: string } };
}

export function ProductDetailScreen({ navigation, route }: ProductDetailScreenProps) {
  const { fetchProductDetail, selectedProduct, isLoading } = useProducts();
  const { addToCart, isLoading: cartLoading } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState<Product[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    fetchProductDetail(route.params.productId);
    loadRelated();
  }, [route.params.productId]);

  const loadRelated = useCallback(async () => {
    try {
      const items = await fetchRelatedProducts(route.params.productId);
      setRelated(items);
    } catch { /* ignore */ }
  }, [route.params.productId]);

  const handleAddToCart = useCallback(async () => {
    if (!selectedProduct) return;
    await addToCart(selectedProduct.id, quantity);
    navigation.navigate('Cart');
  }, [selectedProduct, quantity, addToCart, navigation]);

  const handleBuyNow = useCallback(async () => {
    if (!selectedProduct) return;
    await addToCart(selectedProduct.id, quantity);
    navigation.navigate('Checkout');
  }, [selectedProduct, quantity, addToCart, navigation]);

  const handleQuantityChange = useCallback((delta: number) => {
    setQuantity(q => Math.max(1, Math.min(selectedProduct?.stock ?? 99, q + delta)));
  }, [selectedProduct]);

  const handleRelatedProductPress = useCallback((product: Product) => {
    navigation.navigate('ProductDetail', { productId: product.id });
  }, [navigation]);

  const handleSubmitReview = useCallback(async () => {
    if (!selectedProduct || reviewRating === 0) return;
    setIsSubmittingReview(true);
    try {
      await submitProductReview(selectedProduct.id, reviewRating, reviewComment);
      setReviewRating(0);
      setReviewComment('');
    } finally {
      setIsSubmittingReview(false);
    }
  }, [selectedProduct, reviewRating, reviewComment]);

  const handleShareProduct = useCallback(() => {
    if (!selectedProduct) return;
    // Share sheet with product URL
    const url = `https://demo-shop.example.com/products/${selectedProduct.id}`;
  }, [selectedProduct]);

  return null;
}
