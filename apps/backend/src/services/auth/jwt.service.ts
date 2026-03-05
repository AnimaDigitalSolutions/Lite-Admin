import jwt from 'jsonwebtoken';
import type { JWTPayload, AdminUser, AuthTokens } from '@lite/shared';
import config from '../../config/index.js';

export class JWTService {
  private readonly secret: string;
  private readonly expiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(
    secret = config.jwtSecret,
    expiresIn = config.jwtExpiresIn,
    refreshExpiresIn = config.refreshTokenExpiresIn
  ) {
    this.secret = secret;
    this.expiresIn = expiresIn;
    this.refreshExpiresIn = refreshExpiresIn;
  }

  /**
   * Generate access and refresh tokens for a user
   */
  generateTokens(user: Pick<AdminUser, 'id' | 'email' | 'role'>): AuthTokens {
    const payload: JWTPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      this.secret,
      { expiresIn: this.refreshExpiresIn } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify and decode an access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): { id: number } {
    try {
      const decoded = jwt.verify(token, this.secret) as any;
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      return { id: decoded.id };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    return jwt.decode(token) as JWTPayload | null;
  }
}

// Export singleton instance
export const jwtService = new JWTService();