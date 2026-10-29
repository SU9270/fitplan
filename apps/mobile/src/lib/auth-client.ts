import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { getBaseUrl } from './base-url';

/**
 * Better Auth client for the app. `expoClient` keeps the session cookie (and a cached
 * session, so a relaunch is signed in before the network answers) in the iOS Keychain /
 * Android Keystore via expo-secure-store, and attaches it to every auth request.
 * The API mounts Better Auth at the default `/api/auth` path.
 */
export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  plugins: [
    expoClient({
      scheme: 'fitplan',
      storagePrefix: 'fitplan',
      storage: SecureStore,
    }),
  ],
});
