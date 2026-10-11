import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Ensure Web Crypto API is available in test environment
if (!globalThis.crypto) {
  // @ts-ignore
  const cryptoModule = require('crypto');
  // @ts-ignore
  globalThis.crypto = cryptoModule.webcrypto;
}
