import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthReturn, clearSponsorCode, readAuthReturn, readSponsorCode, rememberAuthReturn, rememberSponsorCode, safeReturnPath } from '@/lib/auth-navigation';

describe('OAuth return navigation and pending coupons', () => {
  beforeEach(() => sessionStorage.clear());

  it.each([
    'https://example.com/steal', '//example.com/steal', '/\\example.com', '/%2f%2fexample.com', '/%5cexample.com',
    '/home%0aexample.com', '/broken%escape', '/auth/callback', '/login', null,
  ])('rejects an unsafe or looping return value: %s', value => {
    expect(safeReturnPath(value)).toBe('/home');
  });

  it('preserves a local course destination and sponsorship return', () => {
    expect(safeReturnPath('/learn/course-123?lesson=one#video')).toBe('/learn/course-123?lesson=one#video');
    rememberAuthReturn('/sponsored-access');
    expect(readAuthReturn()).toBe('/sponsored-access');
    clearAuthReturn();
    expect(readAuthReturn()).toBeNull();
  });

  it('keeps the coupon in tab storage independently of the URL and clears it after use', () => {
    const locationBefore = window.location.href;
    rememberSponsorCode('  TEAM-PRIVATE-123  ');
    expect(readSponsorCode()).toBe('TEAM-PRIVATE-123');
    expect(window.location.href).toBe(locationBefore);
    clearSponsorCode();
    expect(readSponsorCode()).toBe('');
  });

  it('can continue authentication when session storage is unavailable', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    expect(() => rememberSponsorCode('TEAM-123')).not.toThrow();
    expect(() => rememberAuthReturn('/sponsored-access')).not.toThrow();
    expect(readSponsorCode()).toBe('');
    expect(readAuthReturn()).toBeNull();
    write.mockRestore();
    read.mockRestore();
  });
});
