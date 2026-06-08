// ─── ProfileScreen ────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

export interface ProfileScreenProps {
  navigation: { navigate: (s: string, p?: any) => void; };
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, logout, isLoading } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [name, setName] = useState(user?.name ?? '');

  const handleEditProfile = useCallback(() => {
    setIsEditMode(true);
  }, []);

  const handleSaveProfile = useCallback(async () => {
    // call updateProfile from AuthService
    setIsEditMode(false);
  }, [name]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigation.navigate('Login');
  }, [logout, navigation]);

  const handleViewOrders = useCallback(() => {
    navigation.navigate('OrderHistory');
  }, [navigation]);

  const handleViewWishlist = useCallback(() => {
    navigation.navigate('Wishlist');
  }, [navigation]);

  const handleManageAddresses = useCallback(() => {
    navigation.navigate('AddressBook');
  }, [navigation]);

  const handlePaymentMethods = useCallback(() => {
    navigation.navigate('PaymentMethods');
  }, [navigation]);

  const handleSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const handleSupport = useCallback(() => {
    navigation.navigate('Support');
  }, [navigation]);

  return null;
}

// ─── SettingsScreen ───────────────────────────────────────────────────────────

export interface SettingsScreenProps {
  navigation: { navigate: (s: string) => void; goBack: () => void; };
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailMarketing, setEmailMarketing] = useState(false);
  const [biometricAuth, setBiometricAuth] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [language, setLanguage] = useState('en');

  const handleToggleNotifications = useCallback(() => {
    setNotificationsEnabled(v => !v);
  }, []);

  const handleToggleBiometric = useCallback(() => {
    setBiometricAuth(v => !v);
  }, []);

  const handleChangePassword = useCallback(() => {
    navigation.navigate('ChangePassword');
  }, [navigation]);

  const handleDeleteAccount = useCallback(() => {
    navigation.navigate('DeleteAccount');
  }, [navigation]);

  const handlePrivacyPolicy = useCallback(() => {
    navigation.navigate('WebView', { url: 'https://demo-shop.example.com/privacy', title: 'Privacy Policy' });
  }, [navigation]);

  const handleTermsOfService = useCallback(() => {
    navigation.navigate('WebView', { url: 'https://demo-shop.example.com/terms', title: 'Terms of Service' });
  }, [navigation]);

  return null;
}
