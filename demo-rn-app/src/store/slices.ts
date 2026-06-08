// ─── Redux Store ──────────────────────────────────────────────────────────────

// authSlice.ts
export interface AuthState {
  user: import('../types').User | null;
  tokens: import('../types').AuthTokens | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const initialAuthState: AuthState = {
  user: null, tokens: null, isLoading: false, error: null, isAuthenticated: false,
};

// Simulated Redux Toolkit slice (without the actual RTK import to keep zero-dep)
export function createAuthActions() {
  return {
    loginStart: () => ({ type: 'auth/loginStart' }),
    loginSuccess: (user: AuthState['user'], tokens: AuthState['tokens']) =>
      ({ type: 'auth/loginSuccess', payload: { user, tokens } }),
    loginFailure: (error: string) => ({ type: 'auth/loginFailure', payload: error }),
    logout: () => ({ type: 'auth/logout' }),
    updateUser: (user: AuthState['user']) => ({ type: 'auth/updateUser', payload: user }),
    clearError: () => ({ type: 'auth/clearError' }),
  };
}

export function authReducer(state = initialAuthState, action: { type: string; payload?: any }): AuthState {
  switch (action.type) {
    case 'auth/loginStart':
      return { ...state, isLoading: true, error: null };
    case 'auth/loginSuccess':
      return { ...state, isLoading: false, isAuthenticated: true, user: action.payload.user, tokens: action.payload.tokens };
    case 'auth/loginFailure':
      return { ...state, isLoading: false, error: action.payload };
    case 'auth/logout':
      return { ...initialAuthState };
    case 'auth/updateUser':
      return { ...state, user: action.payload };
    case 'auth/clearError':
      return { ...state, error: null };
    default:
      return state;
  }
}

// ─── Cart Slice ───────────────────────────────────────────────────────────────

export interface CartState {
  items: import('../types').CartItem[];
  isLoading: boolean;
  error: string | null;
  checkoutInProgress: boolean;
  lastOrderId: string | null;
}

const initialCartState: CartState = {
  items: [], isLoading: false, error: null, checkoutInProgress: false, lastOrderId: null,
};

export function createCartActions() {
  return {
    setCartItems: (items: import('../types').CartItem[]) => ({ type: 'cart/setItems', payload: items }),
    addItem: (item: import('../types').CartItem) => ({ type: 'cart/addItem', payload: item }),
    removeItem: (productId: string) => ({ type: 'cart/removeItem', payload: productId }),
    updateQuantity: (productId: string, quantity: number) =>
      ({ type: 'cart/updateQuantity', payload: { productId, quantity } }),
    clearCart: () => ({ type: 'cart/clear' }),
    setCheckoutStart: () => ({ type: 'cart/checkoutStart' }),
    setCheckoutSuccess: (orderId: string) => ({ type: 'cart/checkoutSuccess', payload: orderId }),
    setCheckoutFailure: (error: string) => ({ type: 'cart/checkoutFailure', payload: error }),
  };
}

export function cartReducer(state = initialCartState, action: { type: string; payload?: any }): CartState {
  switch (action.type) {
    case 'cart/setItems':
      return { ...state, items: action.payload, isLoading: false };
    case 'cart/addItem': {
      const exists = state.items.find(i => i.product.id === action.payload.product.id);
      if (exists) {
        return { ...state, items: state.items.map(i => i.product.id === action.payload.product.id
          ? { ...i, quantity: i.quantity + action.payload.quantity } : i) };
      }
      return { ...state, items: [...state.items, action.payload] };
    }
    case 'cart/removeItem':
      return { ...state, items: state.items.filter(i => i.product.id !== action.payload) };
    case 'cart/updateQuantity':
      return { ...state, items: state.items.map(i => i.product.id === action.payload.productId
        ? { ...i, quantity: action.payload.quantity } : i) };
    case 'cart/clear':
      return { ...state, items: [], lastOrderId: null };
    case 'cart/checkoutStart':
      return { ...state, checkoutInProgress: true, error: null };
    case 'cart/checkoutSuccess':
      return { ...state, checkoutInProgress: false, items: [], lastOrderId: action.payload };
    case 'cart/checkoutFailure':
      return { ...state, checkoutInProgress: false, error: action.payload };
    default:
      return state;
  }
}

// ─── Products Slice ───────────────────────────────────────────────────────────

export interface ProductsState {
  items: import('../types').Product[];
  featured: import('../types').Product[];
  categories: import('../types').Category[];
  selectedProduct: import('../types').Product | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    category: string | null;
    search: string;
    sortBy: string;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

const initialProductsState: ProductsState = {
  items: [], featured: [], categories: [], selectedProduct: null,
  isLoading: false, error: null,
  filters: { category: null, search: '', sortBy: 'newest' },
  pagination: { page: 1, pageSize: 20, total: 0, hasMore: false },
};

export function createProductsActions() {
  return {
    setProducts: (items: import('../types').Product[], pagination: ProductsState['pagination']) =>
      ({ type: 'products/setProducts', payload: { items, pagination } }),
    setFeatured: (items: import('../types').Product[]) => ({ type: 'products/setFeatured', payload: items }),
    setCategories: (items: import('../types').Category[]) => ({ type: 'products/setCategories', payload: items }),
    selectProduct: (product: import('../types').Product | null) => ({ type: 'products/select', payload: product }),
    setFilter: (key: string, value: string | null) => ({ type: 'products/setFilter', payload: { key, value } }),
    setLoading: (loading: boolean) => ({ type: 'products/setLoading', payload: loading }),
    setError: (error: string | null) => ({ type: 'products/setError', payload: error }),
  };
}

export function productsReducer(state = initialProductsState, action: { type: string; payload?: any }): ProductsState {
  switch (action.type) {
    case 'products/setProducts':
      return { ...state, items: action.payload.items, pagination: action.payload.pagination, isLoading: false };
    case 'products/setFeatured':
      return { ...state, featured: action.payload };
    case 'products/setCategories':
      return { ...state, categories: action.payload };
    case 'products/select':
      return { ...state, selectedProduct: action.payload };
    case 'products/setFilter':
      return { ...state, filters: { ...state.filters, [action.payload.key]: action.payload.value }, pagination: { ...state.pagination, page: 1 } };
    case 'products/setLoading':
      return { ...state, isLoading: action.payload };
    case 'products/setError':
      return { ...state, error: action.payload, isLoading: false };
    default:
      return state;
  }
}
