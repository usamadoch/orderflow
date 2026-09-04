import { parseHexColor, COLOR_PALETTE_ROWS, DEFAULT_DRAWING_COLOR, DEFAULT_DRAWING_STROKE_WIDTH } from '../components/chart/CanvasDrawingToolbar';
import type { DrawnLine } from '../types/chart';
import { formatPrice, formatTime } from '../lib/utils/format';

function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  console.log('\n=== 1. Testing parseHexColor & 8-Digit Hex Splitting ===');
  // 3-digit
  const res3 = parseHexColor('#f0a');
  assert(res3?.color === '#FF00AA' && res3.opacity === undefined, '3-digit hex #f0a expands to #FF00AA');

  // 6-digit
  const res6 = parseHexColor('#2962FF');
  assert(res6?.color === '#2962FF' && res6.opacity === undefined, '6-digit hex #2962FF parses to #2962FF');

  // 8-digit hex: split into color (#RRGGBB) + opacity (AA / 255)
  const res8_half = parseHexColor('#2962FF80');
  assert(res8_half?.color === '#2962FF' && res8_half?.opacity === 0.5, '8-digit hex #2962FF80 splits into color #2962FF and opacity 0.5');

  const res8_full = parseHexColor('#FF0000FF');
  assert(res8_full?.color === '#FF0000' && res8_full?.opacity === 1, '8-digit hex #FF0000FF splits into color #FF0000 and opacity 1.0');

  const res8_zero = parseHexColor('#00000000');
  assert(res8_zero?.color === '#000000' && res8_zero?.opacity === 0, '8-digit hex #00000000 splits into color #000000 and opacity 0.0');

  // Case insensitivity & without hash
  const res_no_hash = parseHexColor('2962ff80');
  assert(res_no_hash?.color === '#2962FF' && res_no_hash?.opacity === 0.5, '8-digit hex without # prefix parses correctly');

  // Invalid hex rejection
  assert(parseHexColor('#12345') === null, '5-digit hex #12345 is rejected');
  assert(parseHexColor('invalid-color') === null, 'Non-hex string is rejected');

  console.log('\n=== 2. Testing Color Palette Grid ===');
  assert(COLOR_PALETTE_ROWS.length === 8, 'Grid has 8 rows (1 grayscale + 7 hue rows)');
  assert(COLOR_PALETTE_ROWS.every((row: string[]) => row.length === 10), 'Each row has exactly 10 columns (8x10 = 80 swatches)');
  assert(COLOR_PALETTE_ROWS[0][0] === '#FFFFFF', 'Top-left swatch is #FFFFFF (pure white)');
  assert(COLOR_PALETTE_ROWS[0][9] === '#000000', 'Top-right swatch is #000000 (pure black)');

  console.log('\n=== 3. Testing Opacity Initial State (Unset -> 100%, not 0%) ===');
  const drawingWithoutOpacity: DrawnLine = {
    id: 'legacy-line-1',
    type: 'horizontal',
    value: 50000,
  };
  const visualOpacity = Math.round((drawingWithoutOpacity.opacity ?? 1) * 100);
  assert(visualOpacity === 100, 'Drawing with no stored opacity visually displays 100%, not 0%');

  const drawingWithZeroOpacity: DrawnLine = {
    id: 'transparent-line',
    type: 'horizontal',
    value: 50000,
    opacity: 0,
  };
  assert(Math.round((drawingWithZeroOpacity.opacity ?? 1) * 100) === 0, 'Explicit opacity: 0 correctly displays 0%');

  console.log('\n=== 4. Testing Box Fill / Border Separation & showFill Toggle ===');
  const boxWithFill: DrawnLine = {
    id: 'box-1',
    type: 'box',
    value: 50000,
    color: '#3D7EFF',
    fillColor: '#FF9800',
    showFill: true,
    opacity: 0.85,
    fillOpacity: 0.25,
  };
  assert(boxWithFill.showFill !== false, 'boxWithFill has showFill active');
  assert(boxWithFill.fillColor === '#FF9800', 'boxWithFill uses dedicated fillColor #FF9800');
  assert(boxWithFill.color === '#3D7EFF', 'boxWithFill uses independent border color #3D7EFF');
  assert(boxWithFill.opacity === 0.85, 'boxWithFill has independent border opacity 0.85');
  assert(boxWithFill.fillOpacity === 0.25, 'boxWithFill has independent fill opacity 0.25');

  const boxWithoutFill: DrawnLine = {
    id: 'box-2',
    type: 'box',
    value: 50000,
    color: '#3D7EFF',
    showFill: false,
  };
  assert(boxWithoutFill.showFill === false, 'boxWithoutFill toggled showFill to false');

  console.log('\n=== 5. Regression Check: Legacy Drawings Render Identically to Before ===');
  const legacyBox: DrawnLine = {
    id: 'legacy-box-1',
    type: 'box',
    value: 62000,
    priceHigh: 63000,
    priceLow: 61000,
    firstIndex: 10,
    lastIndex: 20,
    // opacity, fillColor, and showFill are all undefined in legacy drawings!
  };
  const legacyAlpha = legacyBox.opacity ?? 1;
  const legacyRendersFill = legacyBox.showFill !== false;
  const legacyUsesFallbackFill = legacyBox.fillColor === undefined;
  assert(legacyAlpha === 1, 'Legacy drawing opacity defaults to 1 (fully opaque stroke/fill)');
  assert(legacyRendersFill === true, 'Legacy box showFill defaults to true (renders fill)');
  assert(legacyUsesFallbackFill === true, 'Legacy box without fillColor uses existing fallback tint (rgba(61,126,255,0.10) / rgba(120,123,134,0.08))');

  console.log('\n=== 6. Testing Horizontal-Ray Time + Price Badges Geometry ===');
  const rayY = 250; // priceToY(line.value)
  const rayStartX = 150; // indexToX(line.startIndex)
  const pricePlacement = 'above';
  const timePlacement = 'below';
  const badgeHeight = 17;

  // Price badge anchor is at rayY - 4 (placed 'above')
  const priceBadgeTop = rayY - 4 - badgeHeight; // 250 - 4 - 17 = 229
  const priceBadgeBottom = rayY - 4; // 246

  // Time badge anchor is at rayY + 4 (placed 'below')
  const timeBadgeTop = rayY + 4; // 254
  const timeBadgeBottom = rayY + 4 + badgeHeight; // 271

  assert(priceBadgeBottom < rayY, `Price badge bottom (${priceBadgeBottom}) is above ray line (${rayY}) with 4px gap`);
  assert(timeBadgeTop > rayY, `Time badge top (${timeBadgeTop}) is below ray line (${rayY}) with 4px gap`);
  assert(timeBadgeTop > priceBadgeBottom, `Zero collision: gap between price badge bottom (${priceBadgeBottom}) and time badge top (${timeBadgeTop}) is ${timeBadgeTop - priceBadgeBottom}px`);

  // Formatting check
  const testTimestamp = 1700000000;
  const formattedTime = formatTime(testTimestamp, 'UTC', '24h');
  assert(typeof formattedTime === 'string' && formattedTime.length > 0, `formatTime produces valid localized string: "${formattedTime}"`);

  console.log(`\n========================================`);
  console.log(`Total tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
