import { EncryptionService } from './encryption.service';
import pino from 'pino';

describe('EncryptionService', () => {
  let service: EncryptionService;
  const logger = pino();

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32).toString('hex');
    service = new EncryptionService(logger);
  });

  describe('AES-256-GCM Encryption/Decryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'Hello, World!';
      const encrypted = service.encrypt(plaintext);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt data with additional authenticated data', () => {
      const plaintext = 'Secret message';
      const aad = 'additional-data';
      const encrypted = service.encrypt(plaintext, aad);

      const decrypted = service.decrypt(encrypted, aad);
      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption with wrong AAD', () => {
      const plaintext = 'Secret message';
      const aad = 'correct-aad';
      const encrypted = service.encrypt(plaintext, aad);

      expect(() => {
        service.decrypt(encrypted, 'wrong-aad');
      }).toThrow();
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'Same message';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });
  });

  describe('Password Hashing', () => {
    it('should hash password with salt', () => {
      const password = 'SecurePassword123!';
      const result = service.hashPassword(password);

      expect(result.hash).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(result.hash).not.toBe(password);
    });

    it('should produce different hashes for same password', () => {
      const password = 'SecurePassword123!';
      const hash1 = service.hashPassword(password);
      const hash2 = service.hashPassword(password);

      expect(hash1.hash).not.toBe(hash2.hash);
    });

    it('should verify correct password', () => {
      const password = 'SecurePassword123!';
      const { hash, salt } = service.hashPassword(password);

      const isValid = service.verifyPassword(password, hash, salt);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', () => {
      const password = 'SecurePassword123!';
      const { hash, salt } = service.hashPassword(password);

      const isValid = service.verifyPassword('WrongPassword', hash, salt);
      expect(isValid).toBe(false);
    });
  });

  describe('HMAC Signature', () => {
    it('should generate HMAC signature', () => {
      const data = 'Important data';
      const signature = service.generateSignature(data);

      expect(signature).toBeDefined();
      expect(signature).toHaveLength(64); // SHA256 hex length
    });

    it('should verify valid signature', () => {
      const data = 'Important data';
      const signature = service.generateSignature(data);

      const isValid = service.verifySignature(data, signature);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const data = 'Important data';
      const signature = service.generateSignature(data);

      const isValid = service.verifySignature('Modified data', signature);
      expect(isValid).toBe(false);
    });

    it('should support custom secrets', () => {
      const data = 'Data';
      const secret = 'custom-secret';
      const signature = service.generateSignature(data, secret);

      const isValid = service.verifySignature(data, signature, secret);
      expect(isValid).toBe(true);
    });
  });

  describe('Random Token Generation', () => {
    it('should generate random token', () => {
      const token = service.generateToken(32);

      expect(token).toBeDefined();
      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = service.generateToken(32);
      const token2 = service.generateToken(32);

      expect(token1).not.toBe(token2);
    });

    it('should respect length parameter', () => {
      const token16 = service.generateToken(16);
      const token64 = service.generateToken(64);

      expect(token16).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(token64).toHaveLength(128); // 64 bytes = 128 hex chars
    });
  });

  describe('SHA-256 Hashing', () => {
    it('should hash data consistently', () => {
      const data = 'test-data';
      const hash1 = service.hashData(data);
      const hash2 = service.hashData(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it('should produce different hashes for different data', () => {
      const hash1 = service.hashData('data1');
      const hash2 = service.hashData('data2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('RSA Encryption', () => {
    it('should generate RSA key pair', () => {
      const keyPair = service.generateRSAKeyPair(2048);

      expect(keyPair.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(keyPair.privateKey).toContain('BEGIN PRIVATE KEY');
    });

    it('should encrypt and decrypt with RSA', () => {
      const keyPair = service.generateRSAKeyPair(2048);
      const plaintext = 'Secret message';

      const encrypted = service.encryptWithRSA(plaintext, keyPair.publicKey);
      const decrypted = service.decryptWithRSA(encrypted, keyPair.privateKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption with wrong key', () => {
      const keyPair1 = service.generateRSAKeyPair(2048);
      const keyPair2 = service.generateRSAKeyPair(2048);
      const plaintext = 'Secret message';

      const encrypted = service.encryptWithRSA(plaintext, keyPair1.publicKey);

      expect(() => {
        service.decryptWithRSA(encrypted, keyPair2.privateKey);
      }).toThrow();
    });
  });
});
