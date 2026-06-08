// ─── AppNavigator ─────────────────────────────────────────────────────────────
// Root navigator — decides between AuthNavigator (unauthenticated)
// and MainTabNavigator (authenticated) based on auth state.

import { useAuth } from '../hooks/useAuth';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './TabNavigator';

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null; // SplashScreen

  return isAuthenticated ? MainTabNavigator() : AuthNavigator();
}

// ─── AuthNavigator ────────────────────────────────────────────────────────────

export function AuthNavigator() {
  // Stack: Login → Register → ForgotPassword → OAuthWebView
  return null;
}

export function createAuthStack() {
  return {
    screens: ['Login', 'Register', 'ForgotPassword', 'ResetPassword', 'OAuthWebView'],
    initialRoute: 'Login',
  };
}

// ─── MainTabNavigator ─────────────────────────────────────────────────────────

export function MainTabNavigator() {
  // Bottom tabs: Home | Search | Cart | Profile
  return null;
}

export function createBottomTabs() {
  return {
    tabs: [
      { name: 'Home',    icon: 'home',   screen: 'HomeScreen'   },
      { name: 'Search',  icon: 'search', screen: 'SearchScreen' },
      { name: 'Cart',    icon: 'cart',   screen: 'CartScreen'   },
      { name: 'Profile', icon: 'person', screen: 'ProfileScreen'},
    ],
  };
}

// ─── ShopNavigator (nested in Home tab) ──────────────────────────────────────

export function ShopNavigator() {
  return null;
}

export function createShopStack() {
  return {
    screens: ['Home', 'ProductList', 'ProductDetail', 'CategoryView', 'Checkout', 'OrderConfirmation'],
    initialRoute: 'Home',
  };
}
