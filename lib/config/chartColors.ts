export const CHART_BULLISH_COLOR = '#089981';
export const CHART_BEARISH_COLOR = '#f23645';

export const CHART_BULLISH_RGB = { r: 8, g: 153, b: 129 } as const;
export const CHART_BEARISH_RGB = { r: 242, g: 54, b: 69 } as const;

const LEGACY_BULLISH_COLOR = '#26a69a';
const LEGACY_BEARISH_COLOR = '#ef5350';

export function chartColorToRgba(
  color: string | { r: number; g: number; b: number },
  alpha: number,
) {
  if (!color) return `rgba(255, 255, 255, ${alpha})`;
  if (typeof color !== 'string') {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  }
  const clean = color.trim();
  if (clean.startsWith('rgba')) {
    return clean.replace(/,[\s\d.]+\)$/, `, ${alpha})`);
  }
  if (clean.startsWith('rgb')) {
    return clean.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  const rgb = hexToRgb(clean);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function normalizeChartSemanticColor(color: string | undefined, fallback: string) {
  const normalized = color?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === LEGACY_BULLISH_COLOR) return CHART_BULLISH_COLOR;
  if (normalized === LEGACY_BEARISH_COLOR) return CHART_BEARISH_COLOR;
  return color;
}

function hexToRgb(hex: string) {
  let normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    normalized = normalized[0] + normalized[0] + normalized[1] + normalized[1] + normalized[2] + normalized[2];
  } else if (normalized.length > 6) {
    normalized = normalized.slice(0, 6);
  }
  const value = parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return { r: 255, g: 255, b: 255 };
  }
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}
