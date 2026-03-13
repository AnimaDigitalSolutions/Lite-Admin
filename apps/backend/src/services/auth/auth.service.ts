import type { AdminUser, AuthResponse, LoginRequest } from '@lite/shared';
import { cryptoService } from './crypto.service.js';
import { jwtService } from './jwt.service.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import SettingsService from '../settings/index.js';

export class AuthService {
  private adminUser: Omit<AdminUser, 'createdAt' | 'updatedAt'> | null = null;
  private hashedPassword: string | null = null;

  async initialize() {
    // Check if a password override is stored in DB settings
    let passwordToHash = config.adminPassword;
    try {
      const settingsService = await SettingsService.getInstance();
      const storedHash = settingsService.get('admin_password_hash');
      if (storedHash) {
        this.hashedPassword = storedHash;
        this.adminUser = {
          id: 1,
          email: config.adminUsername,
          name: 'Administrator',
          role: 'super_admin',
          lastLoginAt: undefined,
        };
        logger.info('Auth service initialized (using stored password hash)');
        return;
      }
    } catch {
      // Settings not yet ready — use env password
    }

    // Hash the admin password on startup
    this.hashedPassword = await cryptoService.hashPassword(passwordToHash);
    
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
    const tokens = jwtService.generateTokens(this.adminUser);

    return {
      ...tokens,
      user: {
        ...this.adminUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  async validateToken(token: string): Promise<ReturnType<typeof jwtService.verifyAccessToken>> {
    return jwtService.verifyAccessToken(token);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!this.hashedPassword) await this.initialize();

    const isValid = await cryptoService.verifyPassword(currentPassword, this.hashedPassword!);
    if (!isValid) throw new Error('Invalid credentials');

    const newHash = await cryptoService.hashPassword(newPassword);
    this.hashedPassword = newHash;

    // Persist so it survives restart
    const settingsService = await SettingsService.getInstance();
    await settingsService.set('admin_password_hash', newHash);

    logger.info('Admin password changed');
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