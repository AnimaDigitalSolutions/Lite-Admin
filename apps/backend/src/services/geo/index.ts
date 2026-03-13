import maxmind, { type Reader, type CountryResponse } from 'maxmind';
import { type GeoIpDbName } from 'geolite2-redist';
import logger from '../../utils/logger.js';

export interface GeoResult {
  country?: string;      // ISO 2-letter code, e.g. "FR"
  country_name?: string; // e.g. "France"
  city?: string;         // always undefined with Country DB (reserved for City DB upgrade)
  region?: string;       // always undefined with Country DB
}

class GeoService {
  private static instance: GeoService | null = null;
  private reader: (Reader<CountryResponse> & { close?: () => void }) | null = null;
  private initPromise: Promise<void> | null = null;
  private unavailable = false;

  private constructor() {}

  static getInstance(): GeoService {
    if (!this.instance) this.instance = new GeoService();
    return this.instance;
  }

  private async init(): Promise<void> {
    if (this.reader || this.unavailable) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const geolite2 = await import('geolite2-redist');
        // geolite2-redist ships as ESM — handle both named and default export shapes
        const lib = (geolite2 as unknown as { default?: typeof geolite2 }).default ?? geolite2;
        const dbName = geolite2.GeoIpDbName.Country as GeoIpDbName; // ~6 MB vs ~70 MB for City

        this.reader = await lib.open(
          dbName,
          (dbPath: string) => maxmind.open<CountryResponse>(dbPath)
        );

        logger.info('GeoIP service initialized (GeoLite2-Country, ~6 MB)');
      } catch (err) {
        logger.warn({ message: 'GeoIP database unavailable — location data will not be recorded', err });
        this.unavailable = true;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /** Call on SIGTERM/SIGINT so geolite2-redist's background updater stops. */
  close(): void {
    this.reader?.close?.();
    this.reader = null;
  }

  /** Extract real client IP — handles X-Forwarded-For and IPv6-mapped IPv4. */
  static extractIp(raw: string | undefined): string {
    if (!raw) return '';
    return raw.split(',')[0].trim().replace(/^::ffff:/, '');
  }

  async lookup(rawIp: string): Promise<GeoResult> {
    const ip = GeoService.extractIp(rawIp);
    if (!ip || this.isPrivateIp(ip)) return {};

    await this.init();
    if (!this.reader) return {};

    try {
      const result = this.reader.get(ip);
      if (!result) return {};

      return {
        country: result.country?.iso_code,
        country_name: result.country?.names?.en,
      };
    } catch (err) {
      logger.debug({ message: `GeoIP lookup failed for ${ip}`, err });
      return {};
    }
  }

  private isPrivateIp(ip: string): boolean {
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
      ip === 'unknown' ||
      ip === 'admin'
    );
  }
}

export default GeoService;
