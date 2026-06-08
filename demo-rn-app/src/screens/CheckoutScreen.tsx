// ─── CheckoutScreen ───────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { formatShippingETA } from '../services/CartService';
import type { Address } from '../types';

export interface CheckoutScreenProps {
  navigation: { navigate: (s: string, p?: any) => void; goBack: () => void; };
}

type CheckoutStep = 'address' | 'payment' | 'review' | 'confirmation';

export function CheckoutScreen({ navigation }: CheckoutScreenProps) {
  const { items, subtotal, total, checkout, isCheckingOut, error } = useCart();
  const { user } = useAuth();
  const [step, setStep] = useState<CheckoutStep>('address');
  const [address, setAddress] = useState<Address>({ street: '', city: '', state: '', zip: '', country: 'US' });
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<'standard' | 'express' | 'overnight'>('standard');

  const validateAddress = useCallback((): boolean => {
    return !!(address.street && address.city && address.state && address.zip);
  }, [address]);

  const handleAddressNext = useCallback(() => {
    if (validateAddress()) setStep('payment');
  }, [validateAddress]);

  const handlePaymentNext = useCallback(() => {
    if (paymentMethodId) setStep('review');
  }, [paymentMethodId]);

  const handleBack = useCallback(() => {
    const steps: CheckoutStep[] = ['address', 'payment', 'review', 'confirmation'];
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
    else navigation.goBack();
  }, [step, navigation]);

  const handlePlaceOrder = useCallback(async () => {
    const order = await checkout(address, paymentMethodId, couponApplied ? couponCode : undefined);
    if (order) {
      setStep('confirmation');
      navigation.navigate('OrderConfirmation', { orderId: order.id });
    }
  }, [checkout, address, paymentMethodId, couponCode, couponApplied, navigation]);

  const handleApplyCoupon = useCallback(async () => {
    // validate coupon via cart hook
    setCouponApplied(true);
  }, [couponCode]);

  const handleAddressChange = useCallback((field: keyof Address, value: string) => {
    setAddress(prev => ({ ...prev, [field]: value }));
  }, []);

  const getShippingCost = useCallback((): number => {
    switch (selectedShipping) {
      case 'standard': return subtotal > 50 ? 0 : 5.99;
      case 'express':  return 12.99;
      case 'overnight': return 24.99;
    }
  }, [selectedShipping, subtotal]);

  const getShippingETA = useCallback((): string => {
    switch (selectedShipping) {
      case 'standard':  return formatShippingETA(5, 7);
      case 'express':   return formatShippingETA(2, 3);
      case 'overnight': return formatShippingETA(1, 1);
    }
  }, [selectedShipping]);

  return null;
}
