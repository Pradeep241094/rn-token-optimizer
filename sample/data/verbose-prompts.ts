/**
 * Realistic verbose prompts that React Native developers type every day.
 * These are the inputs to the prompt optimizer.
 * Each entry has the verbose prompt and the expected compressed form.
 */

export interface PromptExample {
  category: string;
  verbose: string;
  expectedCompressed: string; // approximate — actual LLM output will vary
  tokensBefore: number;       // approximate
  tokensAfter: number;        // approximate
}

export const VERBOSE_PROMPTS: PromptExample[] = [
  {
    category: 'Authentication',
    verbose:
      'I need you to please help me fix the issue in my React Native app where users are unable to log in with their Google account. The error only happens on Android devices running version 12 or higher. The login button is present and the user can tap it, but after the Google sign-in flow completes, the app just shows a blank screen instead of navigating to the home screen.',
    expectedCompressed:
      'D=fix A Google login fail AND v12+ C=post-signin blank screen no NAV to HomeScreen',
    tokensBefore: 78,
    tokensAfter: 14,
  },
  {
    category: 'Navigation',
    verbose:
      "Can you help me understand why my React Navigation stack is not working correctly? When I navigate from the ProductListScreen to the ProductDetailScreen and then press the back button, it goes back to the correct screen on Android but on iOS it seems to skip back two screens instead of just one. I'm using React Navigation version 6.",
    expectedCompressed:
      'D=debug NAV stack back btn IOS skip 2 screens C=ProductList→ProductDetail NAV v6',
    tokensBefore: 72,
    tokensAfter: 13,
  },
  {
    category: 'Performance',
    verbose:
      "I'm experiencing significant performance issues with my FlatList component in my React Native app. The list becomes very laggy and unresponsive when it has more than 50 items, especially on older Android devices. I've already tried using keyExtractor but it didn't seem to make much difference. Each item in the list contains an image and some text.",
    expectedCompressed:
      'D=fix FlatList perf lag 50+ items AND low-end C=keyExtractor tried, items=img+text',
    tokensBefore: 76,
    tokensAfter: 14,
  },
  {
    category: 'Metro / Build',
    verbose:
      "I'm having trouble with my Metro bundler. Every time I try to start the development server it crashes immediately with a 'cannot find module' error. I've already tried clearing the cache by running npx react-native start --reset-cache but the issue persists. This started happening after I ran npm install to add a new package called react-native-reanimated.",
    expectedCompressed:
      'D=fix METRO crash C=module not found post npm-install react-native-reanimated X=cache clear failed',
    tokensBefore: 81,
    tokensAfter: 13,
  },
  {
    category: 'Native Module',
    verbose:
      "Can you please help me integrate the react-native-camera package into my existing React Native project? I've installed it using npm and linked it but when I try to use the Camera component it throws an error saying 'Invariant Violation: requireNativeComponent: \"RNCamera\" was not found in the UIManager'. I'm on React Native 0.72 and targeting both iOS and Android.",
    expectedCompressed:
      'D=fix NATIVE RNCamera not found UIManager C=react-native-camera RN 0.72 IOS+AND',
    tokensBefore: 84,
    tokensAfter: 12,
  },
  {
    category: 'State Management',
    verbose:
      'I need help debugging a problem with my Redux store. When the user successfully logs in and the authentication API returns a valid user object, the state in my Redux store is not being updated. The login action is being dispatched correctly as I can see it in Redux DevTools, but the user object in the store remains null after the dispatch.',
    expectedCompressed:
      'D=debug Redux A login C=action dispatched, state not updated user=null post-API',
    tokensBefore: 73,
    tokensAfter: 11,
  },
  {
    category: 'Styling / Layout',
    verbose:
      "I'm trying to create a responsive layout in my React Native app that works correctly on both small phones and large tablets. The issue I'm having is that the content overflows on smaller screens when I use fixed pixel values for padding and margins. I would like to use percentage-based dimensions or the Dimensions API but I'm not sure which approach is best.",
    expectedCompressed:
      'D=impl responsive layout small phones+tablets C=fixed px overflow S=use % or Dimensions API',
    tokensBefore: 74,
    tokensAfter: 12,
  },
  {
    category: 'TypeScript',
    verbose:
      "I'm getting a TypeScript error in my React Native project that I don't understand. The error says 'Type 'string | undefined' is not assignable to type 'string'' and it appears on line 34 of my UserProfileScreen.tsx file. I'm trying to pass a prop called 'userId' from the navigation params to a child component but TypeScript is complaining about the type.",
    expectedCompressed:
      "D=fix TS error 'string|undefined not assignable string' UserProfileScreen:34 C=userId nav param→child prop",
    tokensBefore: 79,
    tokensAfter: 14,
  },
];
