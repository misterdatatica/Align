const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are .sql files bundled with the app.
config.resolver.sourceExts.push('sql');

// Add wasm asset support (expo-sqlite on web)
config.resolver.assetExts.push('wasm');

// Add COEP and COOP headers to support SharedArrayBuffer (expo-sqlite on web).
// The documented `server.enhanceMiddleware` only wraps Metro's own middleware,
// but the Expo CLI serves the web HTML page before Metro, so the page never got
// the headers. Patch every response of this dev-server process instead.
// Dev only: this file is not used when hosting the exported web build.
const { ServerResponse } = require('http');
const originalWriteHead = ServerResponse.prototype.writeHead;
ServerResponse.prototype.writeHead = function (...args) {
  if (!this.headersSent) {
    this.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    this.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
  return originalWriteHead.apply(this, args);
};

module.exports = config;
