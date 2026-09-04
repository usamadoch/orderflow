import { useChartStore } from '../lib/store/chart';
import { drawSessions } from '../lib/draw/drawSessions';
import { parseHexColor, COLOR_PALETTE_ROWS } from '../components/ui/ColorPickerPopover';
import type { Candle } from '../types/candle';

function runSessionTests() {
  console.log('\n=== Testing Session Color Picker & Opacity Integration ===');

  // Test 1: Store updates session color and opacity
  {
    const state = useChartStore.getState();
    const panelId = 'left';
    
    // Set Tokyo session color
    state.setSessionColor(panelId, 'tokyo', '#9C27B0');
    let tokyo = useChartStore.getState().panels[panelId].sessions.tokyo;
    console.log(`  ✓ setSessionColor updates tokyo color to #9C27B0: ${tokyo.color === '#9C27B0'}`);
    if (tokyo.color !== '#9C27B0') process.exit(1);

    // Set Tokyo session opacity
    state.setSessionOpacity(panelId, 'tokyo', 0.15);
    tokyo = useChartStore.getState().panels[panelId].sessions.tokyo;
    console.log(`  ✓ setSessionOpacity updates tokyo opacity to 0.15: ${tokyo.opacity === 0.15}`);
    if (tokyo.opacity !== 0.15) process.exit(1);

    // setSessionColor with optional opacity
    state.setSessionColor(panelId, 'london', '#00BCD4', 0.20);
    const london = useChartStore.getState().panels[panelId].sessions.london;
    console.log(`  ✓ setSessionColor with opacity updates london to #00BCD4 @ 0.20: ${london.color === '#00BCD4' && london.opacity === 0.20}`);
    if (london.color !== '#00BCD4' || london.opacity !== 0.20) process.exit(1);
  }

  // Test 2: drawSessions canvas execution respects config.opacity
  {
    const operations: string[] = [];
    let fillStyle = '';
    const mockCtx = {
      get fillStyle() { return fillStyle; },
      set fillStyle(v: string) { fillStyle = v; operations.push(`fillStyle=${v}`); },
      fillRect: (x: number, y: number, w: number, h: number) => operations.push(`fillRect(${x},${y},${w},${h})`),
      fillText: (text: string, x: number, y: number) => operations.push(`fillText(${text},${x},${y})`),
      font: '',
    } as unknown as CanvasRenderingContext2D;

    const candles: Candle[] = [
      { time: 1700000000, open: 100, high: 110, low: 90, close: 105, volume: 10, isClosed: true },
      { time: 1700003600, open: 105, high: 115, low: 95, close: 110, volume: 10, isClosed: true },
    ];

    // Session with custom opacity 0.12
    drawSessions(
      mockCtx,
      candles,
      { firstIndex: 0, lastIndex: 1 },
      () => 50,
      10,
      600,
      24,
      {
        tokyo: {
          enabled: true,
          startHour: 22,
          startMin: 0,
          endHour: 23,
          endMin: 0,
          color: '#9C27B0',
          opacity: 0.12,
        },
      },
      true,
      'UTC'
    );

    const hasCustomOpacityFill = operations.some(op => op.includes('rgba(156, 39, 176, 0.12)'));
    console.log(`  ✓ drawSessions applies custom opacity (0.12) to fillStyle: ${hasCustomOpacityFill}`);
    if (!hasCustomOpacityFill) process.exit(1);

    // Session without custom opacity falls back to 0.07
    operations.length = 0;
    drawSessions(
      mockCtx,
      candles,
      { firstIndex: 0, lastIndex: 1 },
      () => 50,
      10,
      600,
      24,
      {
        london: {
          enabled: true,
          startHour: 22,
          startMin: 0,
          endHour: 23,
          endMin: 0,
          color: '#2196F3',
        },
      },
      true,
      'UTC'
    );

    const hasFallbackOpacityFill = operations.some(op => op.includes('rgba(33, 150, 243, 0.07)'));
    console.log(`  ✓ drawSessions without opacity falls back to 0.07: ${hasFallbackOpacityFill}`);
    if (!hasFallbackOpacityFill) process.exit(1);
  }

  // Test 3: Shared ColorPickerPopover exports
  {
    console.log(`  ✓ COLOR_PALETTE_ROWS has 8 rows: ${COLOR_PALETTE_ROWS.length === 8}`);
    const parsed8 = parseHexColor('#9C27B080');
    console.log(`  ✓ parseHexColor 8-digit split: ${parsed8?.color === '#9C27B0' && parsed8?.opacity === 0.5}`);
    if (COLOR_PALETTE_ROWS.length !== 8 || parsed8?.color !== '#9C27B0' || parsed8?.opacity !== 0.5) process.exit(1);
  }

  console.log('\nAll session color picker tests passed successfully!\n');
}

runSessionTests();
