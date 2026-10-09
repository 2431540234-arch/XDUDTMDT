import { describe, expect, it } from 'vitest';
import tailwindConfig from '../../tailwind.config';
import { theme } from '../../src/styles/theme';

describe('theme nối vào Tailwind', () => {
  it('màu thương hiệu có trong theme.extend.colors', () => {
    const colors = tailwindConfig.theme?.extend?.colors as Record<string, string>;
    expect(colors.primary).toBe(theme.colors.primary);
    expect(colors.secondary).toBe(theme.colors.secondary);
  });
});
