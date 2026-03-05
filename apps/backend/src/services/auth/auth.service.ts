import type { AdminUser, AuthResponse, LoginRequest } from '@lite/shared';
import { cryptoService } from './crypto.service.js';
import { jwtService } from './jwt.service.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

export class AuthService {
  private adminUser: Omit<AdminUser, 'createdAt' | 'updatedAt'> | null = null;
  private hashedPassword: string | null = null;

  async initialize() {
    // Hash the admin password on startup
    this.hashedPassword = await cryptoService.hashPassword(config.adminPassword);
    
    // Create in-memory admin user
    this.adminUser = {
      id: 1,
      email: config.adminUsername,
      name: 'Administrator',
      role: 'super_admin',
      lastLoginAt: undefined,
    };

    logger.info('Auth service initialized');
  }

  async login({ email, password }: LoginRequest): Promise<AuthResponse> {
    // Validate credentials
    if (email !== config.adminUsername) {
      throw new Error('Invalid credentials');
    }

    if (!this.hashedPassword) {
      await this.initialize();
    }

    const isValid = await cryptoService.verifyPassword(password, this.hashedPassword!);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    if (!this.adminUser) {
      throw new Error('Admin user not initialized');
    }

    // Update last login
    this.adminUser.lastLoginAt = new Date();

    // Generate tokens
    const tokens = jwtService.generateTokens(this.adminUser);

    // Log successful login
    logger.info({
      message: 'Admin login successful',
      data: { email }
    });

    return {
      ...tokens,
      user: {
        ...this.adminUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    // Verify refresh token
    const { id } = jwtService.verifyRefreshToken(refreshToken);

    if (id !== this.adminUser?.id) {
      throw new Error('Invalid refresh token');
    }

    // Generate new tokens
    const tokens = jwtService.generateTokens(this.adminUser!);

    return {
      ...tokens,
      user: {
        ...this.adminUser!,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  async validateToken(token: string): Promise<any> {
    return jwtService.verifyAccessToken(token);
  }

  // For future: When we add database support
  async createAdminUser(email: string, _password: string, name?: string): Promise<AdminUser> {
    // In a real implementation, we would hash and store the password
    // const hashedPassword = await cryptoService.hashPassword(password);
    
    // This would save to database in production
    const user: AdminUser = {
      id: Date.now(), // Temporary ID generation
      email,
      name,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    logger.info({
      message: 'Admin user created',
      data: { email }
    });
    return user;
  }
}

// Export singleton instance
export const authService = new AuthService();