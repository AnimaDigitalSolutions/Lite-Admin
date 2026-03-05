import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export class CryptoService {
  private readonly keyLength = 64;
  private readonly saltLength = 32;
  private readonly scryptCost = 32768; // 2^15
  private readonly blockSize = 8;
  private readonly parallelization = 1;

  /**
   * Hash a password using scrypt
   */
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(this.saltLength);
    const derivedKey = await scryptAsync(
      password, 
      salt, 
      this.keyLength
    ) as Buffer;
    
    // Format: salt:hash
    return salt.toString('hex') + ':' + derivedKey.toString('hex');
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const [saltHex, keyHex] = hash.split(':');
    if (!saltHex || !keyHex) {
      throw new Error('Invalid hash format');
    }

    const salt = Buffer.from(saltHex, 'hex');
    const key = Buffer.from(keyHex, 'hex');
    
    const derivedKey = await scryptAsync(
      password,
      salt,
      this.keyLength
    ) as Buffer;
    
    return timingSafeEqual(key, derivedKey);
  }

  /**
   * Generate a cryptographically secure random token
   */
  generateToken(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Generate a secure random string for sessions
   */
  generateSessionId(): string {
    return this.generateToken(32);
  }

  /**
   * Hash a token for storage (one-way)
   */
  async hashToken(token: string): Promise<string> {
    const hash = await scryptAsync(token, 'static-salt', 32) as Buffer;
    return hash.toString('hex');
  }
}

// Export singleton instance
export const cryptoService = new CryptoService();