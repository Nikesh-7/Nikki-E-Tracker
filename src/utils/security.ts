/**
 * Client-Side PIN Hashing & Security Utilities
 * Uses Web Crypto API PBKDF2 with SHA-256 (100,000 iterations).
 * 
 * Note: As documented in the README, client-side PIN hashing serves as a local privacy barrier
 * to prevent accidental exposure or casual browsing on a shared screen. It does not provide
 * server-grade authentication against physical device compromise or browser DevTools tampering.
 */

// Convert ArrayBuffer to Hex string
function bufToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// Convert Hex string to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Generates a cryptographically random salt (16 bytes = 128 bits) in hex format.
 */
export function generateSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bufToHex(salt.buffer);
}

/**
 * Derives a salted cryptographic hash of a PIN using PBKDF2 (100,000 iterations, SHA-256).
 */
export async function hashPin(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const pinKeyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const saltBytes = hexToBuf(saltHex);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    pinKeyMaterial,
    256
  );

  return bufToHex(derivedBits);
}

/**
 * Verifies whether an entered PIN matches the stored salt and hash in constant time.
 */
export async function verifyPin(
  enteredPin: string,
  saltHex: string,
  storedHashHex: string
): Promise<boolean> {
  if (!enteredPin || !saltHex || !storedHashHex) {
    return false;
  }

  try {
    const computedHash = await hashPin(enteredPin, saltHex);
    // Constant-time comparison
    if (computedHash.length !== storedHashHex.length) {
      return false;
    }
    let mismatch = 0;
    for (let i = 0; i < computedHash.length; i++) {
      mismatch |= computedHash.charCodeAt(i) ^ storedHashHex.charCodeAt(i);
    }
    return mismatch === 0;
  } catch (err) {
    console.error('Error verifying PIN:', err);
    return false;
  }
}

/**
 * Default initial PIN specified in requirements: 2510
 * Returns the default salt and hash for the first-run initialization.
 */
export async function createInitialPinCredentials(): Promise<{ salt: string; hash: string }> {
  const salt = generateSalt();
  const hash = await hashPin('2510', salt);
  return { salt, hash };
}
