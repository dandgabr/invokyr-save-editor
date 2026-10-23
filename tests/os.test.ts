import { describe, expect, it } from 'vitest';
import { detectOs, saveLocationFor } from '../src/platform/os';

describe('detectOs', () => {
  it('reconhece Windows via userAgentData', () => {
    expect(detectOs({ userAgentData: { platform: 'Windows' } })).toBe('windows');
  });
  it('reconhece Windows via userAgent', () => {
    expect(detectOs({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })).toBe('windows');
  });
  it('reconhece Linux', () => {
    expect(detectOs({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux x86_64' })).toBe(
      'linux',
    );
  });
  it('reconhece Steam Deck antes de Linux', () => {
    expect(
      detectOs({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64; SteamOS) Chrome', platform: 'Linux x86_64' }),
    ).toBe('steamdeck');
  });
  it('reconhece macOS', () => {
    expect(
      detectOs({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel' }),
    ).toBe('macos');
  });
  it('cai em unknown', () => {
    expect(detectOs({})).toBe('unknown');
  });
});

describe('saveLocationFor', () => {
  it('Windows usa LocalLow', () => {
    expect(saveLocationFor('windows').path).toContain('LocalLow\\Ludogram\\Invokyr\\saves');
  });
  it('Linux usa o prefixo Proton do AppID 3883570', () => {
    const loc = saveLocationFor('linux');
    expect(loc.path).toContain('compatdata/3883570/pfx');
    expect(loc.alternatives.length).toBeGreaterThan(0);
  });
  it('macOS não tem caminho padrão', () => {
    expect(saveLocationFor('macos').path).toBeNull();
  });
});
