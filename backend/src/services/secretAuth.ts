import crypto from 'crypto';

/**
 * Secret authentication service for one-time tokens.
 * Supports time-based expiration and IP-based rate limiting.
 */

interface TokenRecord {
  token: string;
  expiresAt: number;
  attempts: number;
  lastAttemptAt: number;
}

class SecretAuth {
  private tokens: Map<string, TokenRecord> = new Map();
  private ipAttempts: Map<string, { count: number; resetAt: number }> = new Map();
  private tokenLength = 32;
  private tokenTTL = 3600000; // 1 hour
  private maxAttemptsPerIP = 10;
  private ipAttemptWindow = 900000; // 15 minutes

  /**
   * Generate a new secret token (random 32 bytes, hex-encoded).
   */
  generateToken(): string {
    const token = crypto.randomBytes(this.tokenLength).toString('hex');
    const expiresAt = Date.now() + this.tokenTTL;
    this.tokens.set(token, {
      token,
      expiresAt,
      attempts: 0,
      lastAttemptAt: 0,
    });
    return token;
  }

  /**
   * Validate a token against a provided value using constant-time comparison.
   * @param providedToken - token from request
   * @param storedToken - token from storage
   * @returns true if tokens match and token is not expired
   */
  validateToken(providedToken: string, storedToken: string): boolean {
    // Constant-time comparison to prevent timing attacks
    const provided = Buffer.from(providedToken || '');
    const stored = Buffer.from(storedToken || '');

    if (provided.length !== stored.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < provided.length; i++) {
      mismatch |= provided[i] ^ stored[i];
    }

    const tokenRecord = this.tokens.get(storedToken);
    if (!tokenRecord) {
      return false;
    }

    if (Date.now() > tokenRecord.expiresAt) {
      this.tokens.delete(storedToken);
      return false;
    }

    return mismatch === 0;
  }

  /**
   * Check if an IP is rate-limited.
   * @param ip - client IP address
   * @returns true if rate-limited, false otherwise
   */
  isRateLimited(ip: string): boolean {
    const record = this.ipAttempts.get(ip);
    if (!record) {
      this.ipAttempts.set(ip, { count: 1, resetAt: Date.now() + this.ipAttemptWindow });
      return false;
    }

    if (Date.now() > record.resetAt) {
      record.count = 1;
      record.resetAt = Date.now() + this.ipAttemptWindow;
      return false;
    }

    record.count++;
    return record.count > this.maxAttemptsPerIP;
  }

  /**
   * Cleanup expired tokens (call periodically, e.g., every 10 minutes).
   */
  cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [token, record] of this.tokens.entries()) {
      if (now > record.expiresAt) {
        this.tokens.delete(token);
      }
    }
  }

  /**
   * Get token statistics (for debugging).
   */
  getStats() {
    return {
      activeTokens: this.tokens.size,
      trackedIPs: this.ipAttempts.size,
    };
  }
}

export default new SecretAuth();
