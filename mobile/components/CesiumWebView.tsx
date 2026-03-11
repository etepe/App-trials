// Platform-agnostic CesiumJS view component
// Metro bundler will resolve .native.tsx on mobile and .web.tsx on web
// This file serves as the default fallback and re-exports types

export type { CesiumViewRef } from './CesiumWebView.native';
export { default } from './CesiumWebView.native';

// Re-export bridge message type from shared
export type { BridgeMessage } from '../../shared/types';

// Legacy alias
export type CesiumWebViewRef = import('./CesiumWebView.native').CesiumViewRef;
