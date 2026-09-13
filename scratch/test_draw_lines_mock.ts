import { drawLines, drawDrawingPriceLabels } from '../components/chart/drawLines';
import { drawCrosshairTimeLabel } from '../components/chart/drawCrosshair';
import { formatTradingViewDateTime } from '../lib/utils/format';
import type { DrawnLine } from '../types/chart';
import type { Candle } from '../types/candle';

function createMockCtx() {
  const operations: string[] = [];
  const state = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  };

  const ctx = {
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(v: number) {
      state.globalAlpha = v;
      operations.push(`set globalAlpha = ${v}`);
    },
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v: string) {
      state.fillStyle = v;
      operations.push(`set fillStyle = ${v}`);
    },
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(v: string) {
      state.strokeStyle = v;
      operations.push(`set strokeStyle = ${v}`);
    },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v: number) {
      state.lineWidth = v;
      operations.push(`set lineWidth = ${v}`);
    },
    save: () => operations.push('save'),
    restore: () => operations.push('restore'),
    beginPath: () => operations.push('beginPath'),
    moveTo: (x: number, y: number) => operations.push(`moveTo(${x}, ${y})`),
    lineTo: (x: number, y: number) => operations.push(`lineTo(${x}, ${y})`),
    stroke: () => operations.push(`stroke(alpha=${state.globalAlpha})`),
    fill: () => operations.push(`fill(alpha=${state.globalAlpha}, fill=${state.fillStyle})`),
    fillRect: (x: number, y: number, w: number, h: number) => operations.push(`fillRect(${x},${y},${w},${h}, fill=${state.fillStyle}, alpha=${state.globalAlpha})`),
    strokeRect: (x: number, y: number, w: number, h: number) => operations.push(`strokeRect(${x},${y},${w},${h}, stroke=${state.strokeStyle}, alpha=${state.globalAlpha})`),
    roundRect: (x: number, y: number, w: number, h: number, r: number) => operations.push(`roundRect(${x},${y},${w},${h}, r=${r})`),
    quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => operations.push(`quadraticCurveTo(${cpx},${cpy},${x},${y})`),
    arc: () => operations.push('arc'),
    rect: () => operations.push('rect'),
    fillText: (text: string, x: number, y: number) => operations.push(`fillText("${text}", ${x}, ${y})`),
    measureText: (text: string) => ({ width: text.length * 7 }),
    setLineDash: () => {},
    closePath: () => operations.push('closePath'),
    operations,
  } as unknown as CanvasRenderingContext2D & { operations: string[] };

  return ctx;
}

function testDrawLines() {
  console.log('\n=== Testing drawLines Canvas Execution ===');

  // Test 1: Opacity applied to line strokes, reset to 1 for delete dot / handles
  {
    const ctx = createMockCtx();
    const line: DrawnLine = {
      id: 'ray-1',
      type: 'horizontal-ray',
      value: 100,
      startIndex: 5,
      color: '#FF0000',
      opacity: 0.4,
    };
    drawLines(
      ctx,
      [line],
      (idx) => idx * 10,
      () => 50,
      500,
      500,
      30,
      50,
      8,
      'ray-1', // hovered
      null,
      false
    );

    const hasOpacityStroke = ctx.operations.some(op => op === 'set globalAlpha = 0.4');
    const hasResetAlphaBeforeHandle = ctx.operations.some(op => op === 'set globalAlpha = 1');
    console.log(`  ✓ Opacity 0.4 applied to ray stroke: ${hasOpacityStroke}`);
    console.log(`  ✓ Alpha reset to 1 before handle/dot: ${hasResetAlphaBeforeHandle}`);
    if (!hasOpacityStroke || !hasResetAlphaBeforeHandle) process.exit(1);
  }

  // Test 2: Box with showFill: false skips fillRect entirely
  {
    const ctx = createMockCtx();
    const box: DrawnLine = {
      id: 'box-no-fill',
      type: 'box',
      value: 100,
      firstIndex: 2,
      lastIndex: 8,
      priceHigh: 120,
      priceLow: 80,
      showFill: false,
      color: '#3D7EFF',
    };
    drawLines(
      ctx,
      [box],
      (idx) => idx * 10,
      (price) => price,
      500,
      500,
      30,
      50,
      8,
      null,
      null,
      false
    );

    const fillRectOps = ctx.operations.filter(op => op.startsWith('fillRect'));
    const strokeRectOps = ctx.operations.filter(op => op.startsWith('strokeRect'));
    console.log(`  ✓ Box with showFill:false has 0 fillRect calls: ${fillRectOps.length === 0}`);
    console.log(`  ✓ Box with showFill:false has strokeRect call: ${strokeRectOps.length > 0}`);
    if (fillRectOps.length !== 0 || strokeRectOps.length === 0) process.exit(1);
  }

  // Test 3: Box with independent fillOpacity vs border opacity
  {
    const ctx = createMockCtx();
    const box: DrawnLine = {
      id: 'box-custom-fill',
      type: 'box',
      value: 100,
      firstIndex: 2,
      lastIndex: 8,
      priceHigh: 120,
      priceLow: 80,
      showFill: true,
      fillColor: '#FF5722',
      color: '#2196F3',
      opacity: 0.85,     // border opacity
      fillOpacity: 0.25, // independent fill opacity
    };
    drawLines(
      ctx,
      [box],
      (idx) => idx * 10,
      (price) => price,
      500,
      500,
      30,
      50,
      8,
      null,
      null,
      false
    );

    const fillOp = ctx.operations.find(op => op.startsWith('fillRect') && op.includes('fill=#FF5722') && op.includes('alpha=0.25'));
    const strokeOp = ctx.operations.find(op => op.startsWith('strokeRect') && op.includes('stroke=#2196F3') && op.includes('alpha=0.85'));
    console.log(`  ✓ Box uses independent fillOpacity 0.25 on fillRect: ${!!fillOp}`);
    console.log(`  ✓ Box uses independent border opacity 0.85 on strokeRect: ${!!strokeOp}`);
    if (!fillOp || !strokeOp) process.exit(1);
  }

  // Test 4: Legacy box fallback behavior
  {
    const ctx = createMockCtx();
    const legacyBox: DrawnLine = {
      id: 'legacy-box',
      type: 'box',
      value: 100,
      firstIndex: 2,
      lastIndex: 8,
      priceHigh: 120,
      priceLow: 80,
      // No opacity, no fillColor, no showFill
    };
    drawLines(
      ctx,
      [legacyBox],
      (idx) => idx * 10,
      (price) => price,
      500,
      500,
      30,
      50,
      8,
      null,
      null,
      false
    );

    const fillOp = ctx.operations.find(op => op.startsWith('fillRect') && op.includes('rgba(120, 123, 134, 0.08)') && op.includes('alpha=1'));
    console.log(`  ✓ Legacy box falls back to rgba(120, 123, 134, 0.08) with alpha 1: ${!!fillOp}`);
    if (!fillOp) process.exit(1);
  }

  // Test 5: drawDrawingPriceLabels for horizontal-ray renders both price and time badges
  {
    const ctx = createMockCtx();
    const ray: DrawnLine = {
      id: 'ray-badges',
      type: 'horizontal-ray',
      value: 65432.1,
      startIndex: 3,
      startTime: 1700000000,
      color: '#2962FF',
    };
    const candles: Candle[] = [
      { time: 1699999000, open: 65000, high: 65500, low: 64900, close: 65400, volume: 100, isClosed: true },
      { time: 1699999500, open: 65000, high: 65500, low: 64900, close: 65400, volume: 100, isClosed: true },
      { time: 1699999800, open: 65000, high: 65500, low: 64900, close: 65400, volume: 100, isClosed: true },
      { time: 1700000000, open: 65000, high: 65500, low: 64900, close: 65400, volume: 100, isClosed: true },
    ];

    drawDrawingPriceLabels(
      ctx,
      [ray],
      () => 100,
      () => 200,
      800,
      600,
      30,
      50,
      8,
      candles,
      'UTC',
      '24h'
    );

    const priceTextOp = ctx.operations.find(op => op.includes('fillText("65,432.1') || op.includes('fillText("65432.1'));
    const timeTextOp = ctx.operations.find(op => op.includes('fillText("22:13'));
    console.log(`  ✓ Ray renders price badge: ${!!priceTextOp}`);
    console.log(`  ✓ Ray renders time badge: ${!!timeTextOp}`);
    if (!priceTextOp || !timeTextOp) process.exit(1);
  }

  // Test 6: 1px line coordinate alignment (Math.floor(y) + 0.5) vs 2px line (Math.round(y))
  {
    const ctx1 = createMockCtx();
    const line1px: DrawnLine = {
      id: 'h-1px',
      type: 'horizontal',
      value: 100,
      strokeWidth: 1,
    };
    drawLines(
      ctx1,
      [line1px],
      () => 0,
      () => 150.0, // returns integer y=150
      500,
      500,
      30,
      50,
      8,
      null,
      null,
      false
    );
    const moveTo1px = ctx1.operations.find(op => op.startsWith('moveTo'));
    console.log(`  ✓ 1px stroke aligns to +0.5 half-pixel boundary (moveTo(0, 150.5)): ${moveTo1px === 'moveTo(0, 150.5)'}`);
    if (moveTo1px !== 'moveTo(0, 150.5)') process.exit(1);

    const ctx2 = createMockCtx();
    const line2px: DrawnLine = {
      id: 'h-2px',
      type: 'horizontal',
      value: 100,
      strokeWidth: 2,
    };
    drawLines(
      ctx2,
      [line2px],
      () => 0,
      () => 150.0,
      500,
      500,
      30,
      50,
      8,
      null,
      null,
      false
    );
    const moveTo2px = ctx2.operations.find(op => op.startsWith('moveTo'));
    console.log(`  ✓ 2px stroke aligns to exact integer pixel boundary (moveTo(0, 150)): ${moveTo2px === 'moveTo(0, 150)'}`);
    if (moveTo2px !== 'moveTo(0, 150)') process.exit(1);
  }

  // Test 7: drawDrawingPriceLabels for horizontal line renders price badge on right price axis with line color
  {
    const ctx = createMockCtx();
    const hLine: DrawnLine = {
      id: 'h-badge',
      type: 'horizontal',
      value: 80025.9,
      color: '#089981',
      opacity: 0.5, // line opacity is 0.5, but badge should be drawn with solid alpha=1
    };

    drawDrawingPriceLabels(
      ctx,
      [hLine],
      () => 100,
      (price) => (price === 80025.9 ? 250 : 0),
      800, // canvasWidth (chartWidth = 800 - 60 = 740)
      600, // canvasHeight
      30,  // timeAxisHeight
      60,  // priceAxisWidth
      8,
      [],
      'UTC',
      '24h'
    );

    const priceTextOp = ctx.operations.find(op => op.includes('fillText("80,025.9') && op.includes('770, 250'));
    const fillOp = ctx.operations.find(op => op.includes('fill(alpha=1, fill=#089981)'));
    const rectOp = ctx.operations.find(op => op.includes('roundRect(742,240,56,20, r=3)'));

    console.log(`  ✓ Horizontal line renders price badge on price axis: ${!!priceTextOp}`);
    console.log(`  ✓ Horizontal line price badge has solid fill with line color (#089981): ${!!fillOp}`);
    console.log(`  ✓ Horizontal line price badge position and dimensions match price axis: ${!!rectOp}`);
    if (!priceTextOp || !fillOp || !rectOp) process.exit(1);
  }

  // Test 8: drawDrawingPriceLabels for vertical line renders time badge on bottom time axis
  {
    // 1788566700 is 2026-09-05T00:05:00Z -> "Sat 05 Sep '26  12:05 AM" in 12h UTC, "Sat 05 Sep '26  00:05" in 24h UTC
    const timestamp = 1788566700;
    const vLine: DrawnLine = {
      id: 'v-badge',
      type: 'vertical',
      value: 10,
      time: timestamp,
      color: '#f23645',
    };

    // 12h format test
    const ctx12h = createMockCtx();
    drawDrawingPriceLabels(
      ctx12h,
      [vLine],
      (idx) => (idx === 10 ? 350 : 0),
      () => 0,
      800,
      600, // canvasHeight (chartHeight = 600 - 24 = 576)
      24,  // timeAxisHeight
      60,  // priceAxisWidth
      8,
      [],
      'UTC',
      '12h'
    );

    const timeTextOp12h = ctx12h.operations.find(op => op.includes('fillText("Sat 05 Sep \'26  12:05 AM'));
    const fillOp12h = ctx12h.operations.find(op => op.includes('fill(alpha=1, fill=#f23645)'));
    console.log(`  ✓ Vertical line renders 12h time badge on time axis (Sat 05 Sep '26  12:05 AM): ${!!timeTextOp12h}`);
    console.log(`  ✓ Vertical line time badge has solid fill with line color (#f23645): ${!!fillOp12h}`);
    if (!timeTextOp12h || !fillOp12h) process.exit(1);

    // 24h format test
    const ctx24h = createMockCtx();
    drawDrawingPriceLabels(
      ctx24h,
      [vLine],
      (idx) => (idx === 10 ? 350 : 0),
      () => 0,
      800,
      600,
      24,
      60,
      8,
      [],
      'UTC',
      '24h'
    );

    const timeTextOp24h = ctx24h.operations.find(op => op.includes('fillText("Sat 05 Sep \'26  00:05'));
    console.log(`  ✓ Vertical line renders 24h time badge on time axis (Sat 05 Sep '26  00:05): ${!!timeTextOp24h}`);
    if (!timeTextOp24h) process.exit(1);
  }

  // Test 9: formatTradingViewDateTime test
  {
    const ts = 1788566700; // 2026-09-05T00:05:00Z
    const tv12h = formatTradingViewDateTime(ts, 'UTC', '12h');
    const tv24h = formatTradingViewDateTime(ts, 'UTC', '24h');
    console.log(`  ✓ formatTradingViewDateTime 12h UTC: "${tv12h}" === "Sat 05 Sep '26  12:05 AM": ${tv12h === "Sat 05 Sep '26  12:05 AM"}`);
    console.log(`  ✓ formatTradingViewDateTime 24h UTC: "${tv24h}" === "Sat 05 Sep '26  00:05": ${tv24h === "Sat 05 Sep '26  00:05"}`);
    if (tv12h !== "Sat 05 Sep '26  12:05 AM" || tv24h !== "Sat 05 Sep '26  00:05") process.exit(1);
  }

  // Test 10: drawCrosshairTimeLabel reuses drawTimeAxisBadge styling with base color (#1F1F1F)
  {
    const ts = 1788566700; // 2026-09-05T00:05:00Z
    const ctx = createMockCtx();
    drawCrosshairTimeLabel(ctx as unknown as CanvasRenderingContext2D, 200, ts, 576, 24, 800);

    const timeFillOp = ctx.operations.find(op => op.includes('fill(alpha=1, fill=#1F1F1F)'));
    const textOp = ctx.operations.find(op => op.includes('fillText("Sat 05 Sep \'26'));
    const textWhite = ctx.operations.find(op => op.includes('set fillStyle = #FFFFFF'));

    console.log(`  ✓ drawCrosshairTimeLabel uses base background color (#1F1F1F): ${!!timeFillOp}`);
    console.log(`  ✓ drawCrosshairTimeLabel renders formatted TradingView date/time text: ${!!textOp}`);
    console.log(`  ✓ drawCrosshairTimeLabel uses high-contrast white text (#FFFFFF): ${!!textWhite}`);
    if (!timeFillOp || !textOp || !textWhite) process.exit(1);
  }

  console.log('\nAll canvas rendering tests passed successfully!\n');
}

testDrawLines();
