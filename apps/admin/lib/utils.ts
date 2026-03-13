import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns true for loopback, private (RFC 1918), and reserved documentation
 * IP ranges — addresses that will never have meaningful geo data.
 */
/**
 * Truncates long email addresses for display.
 * e.g. "verylongemailusername@emailserviceverylong.com" → "verylonge****@emailser****.com"
 */
export function truncateEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maxLocal = 8;
  const maxDomain = 8;
  const truncLocal = local.length > maxLocal ? local.slice(0, maxLocal) + '****' : local;
  const dotIdx = domain.lastIndexOf('.');
  const tld = dotIdx !== -1 ? domain.slice(dotIdx) : '';
  const domainName = dotIdx !== -1 ? domain.slice(0, dotIdx) : domain;
  const truncDomain = domainName.length > maxDomain ? domainName.slice(0, maxDomain) + '****' + tld : domain;
  return `${truncLocal}@${truncDomain}`;
}

export function isPrivateIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  // Strip IPv4-mapped IPv6 prefix
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const parts = v4.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 127 ||                          // 127.0.0.0/8  loopback
    a === 10 ||                           // 10.0.0.0/8   RFC 1918
    (a === 172 && b >= 16 && b <= 31) ||  // 172.16.0.0/12 RFC 1918
    (a === 192 && b === 168) ||           // 192.168.0.0/16 RFC 1918
    (a === 192 && b === 0 && parts[2] === 2) ||   // 192.0.2.0/24 TEST-NET-1
    (a === 198 && b === 51 && parts[2] === 100) || // 198.51.100.0/24 TEST-NET-2
    (a === 203 && b === 0 && parts[2] === 113)     // 203.0.113.0/24 TEST-NET-3
  );
}