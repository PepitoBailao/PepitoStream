import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { Logger } from 'pino';

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  algorithm: string;
}

@Injectable()
export class EncryptionService {
  private logger: Logger;
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';

  constructor(logger: Logger) {
    this.logger = logger.child({ context: 'EncryptionService' });
    
    // Get encryption key from env or generate
    const keyEnv = process.env.ENCRYPTION_KEY;
    if (keyEnv) {
      this.encryptionKey = Buffer.from(keyEnv, 'hex');
    } else {
      this.encryptionKey = crypto.randomBytes(32);
      this.logger.warn('Using randomly generated encryption key - set ENCRYPTION_KEY in production');
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(data: string, additionalData?: string): EncryptedData {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      if (additionalData) {
        cipher.setAAD(Buffer.from(additionalData, 'utf-8'));
      }

      let ciphertext = cipher.update(data, 'utf-8', 'hex');
      ciphertext += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        ciphertext,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm,
      };
    } catch (error) {
      this.logger.error({ error }, 'Encryption failed');
      throw error;
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encrypted: EncryptedData, additionalData?: string): string {
    try {
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        Buffer.from(encrypted.iv, 'hex')
      );

      decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

      if (additionalData) {
        decipher.setAAD(Buffer.from(additionalData, 'utf-8'));
      }

      let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf-8');
      plaintext += decipher.final('utf-8');

      return plaintext;
    } catch (error) {
      this.logger.error({ error }, 'Decryption failed');
      throw error;
    }
  }

  /**
   * Hash password with bcrypt-like approach using PBKDF2
   */
  hashPassword(password: string, salt?: Buffer): { hash: string; salt: string } {
    try {
      const iterations = 100000;
      const keyLength = 64;
      const digest = 'sha512';

      const saltBuffer = salt || crypto.randomBytes(32);
      const hash = crypto
        .pbkdf2Sync(password, saltBuffer, iterations, keyLength, digest)
        .toString('hex');

      return {
        hash,
        salt: saltBuffer.toString('hex'),
      };
    } catch (error) {
      this.logger.error({ error }, 'Password hashing failed');
      throw error;
    }
  }

  /**
   * Verify password
   */
  verifyPassword(password: string, hash: string, salt: string): boolean {
    try {
      const { hash: newHash } = this.hashPassword(
        password,
        Buffer.from(salt, 'hex')
      );
      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(newHash, 'hex')
      );
    } catch (error) {
      this.logger.error({ error }, 'Password verification failed');
      return false;
    }
  }

  /**
   * Generate HMAC signature
   */
  generateSignature(data: string, secret?: string): string {
    const hmacSecret = secret || this.encryptionKey.toString('hex');
    return crypto
      .createHmac('sha256', hmacSecret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifySignature(data: string, signature: string, secret?: string): boolean {
    const hmacSecret = secret || this.encryptionKey.toString('hex');
    const expectedSignature = crypto
      .createHmac('sha256', hmacSecret)
      .update(data)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Generate random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash data with SHA-256
   */
  hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate RSA key pair (for asymmetric encryption)
   */
  generateRSAKeyPair(modulusLength: number = 2048): {
    publicKey: string;
    privateKey: string;
  } {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      return {
        publicKey,
        privateKey,
      };
    } catch (error) {
      this.logger.error({ error }, 'RSA key pair generation failed');
      throw error;
    }
  }

  /**
   * Encrypt with public RSA key
   */
  encryptWithRSA(data: string, publicKey: string): string {
    try {
      return crypto
        .publicEncrypt(publicKey, Buffer.from(data, 'utf-8'))
        .toString('base64');
    } catch (error) {
      this.logger.error({ error }, 'RSA encryption failed');
      throw error;
    }
  }

  /**
   * Decrypt with private RSA key
   */
  decryptWithRSA(encryptedData: string, privateKey: string): string {
    try {
      return crypto
        .privateDecrypt(privateKey, Buffer.from(encryptedData, 'base64'))
        .toString('utf-8');
    } catch (error) {
      this.logger.error({ error }, 'RSA decryption failed');
      throw error;
    }
  }
}
