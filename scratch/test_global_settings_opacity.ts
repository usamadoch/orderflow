import { useChartStore } from '../lib/store/chart';
import { drawGrid } from '../components/chart/drawAxes';
import { drawCandles } from '../components/chart/drawCandles';
import { chartColorToRgba } from '../lib/config/chartColors';
import { parseHexColor } from '../components/ui/ColorPickerPopover';
import type { Candle } from '../types/candle';

function runTests() {
  console.log('\n=== Testing Global Settings Opacity & Color Picker Integration ===');

  // Test 1: chartColorToRgba with different inputs and alphas
  {
    console.log('\n--- 1. Testing chartColorToRgba ---');
    const hex6 = chartColorToRgba('#1F1F1F', 0.5);
    console.log(`  #1F1F1F @ 0.5 -> ${hex6}`);
    if (hex6 !== 'rgba(31, 31, 31, 0.5)') throw new Error(`Unexpected hex6 conversion: ${hex6}`);

    const hex3 = chartColorToRgba('#FFF', 0.2);
    console.log(`  #FFF @ 0.2 -> ${hex3}`);
    if (hex3 !== 'rgba(255, 255, 255, 0.2)') throw new Error(`Unexpected hex3 conversion: ${hex3}`);

    const rgb = chartColorToRgba('rgb(10, 20, 30)', 0.8);
    console.log(`  rgb(10, 20, 30) @ 0.8 -> ${rgb}`);
    if (rgb !== 'rgba(10, 20, 30, 0.8)') throw new Error(`Unexpected rgb conversion: ${rgb}`);

    const rgba = chartColorToRgba('rgba(10, 20, 30, 0.2)', 0.45);
    console.log(`  rgba(10, 20, 30, 0.2) @ 0.45 -> ${rgba}`);
    if (rgba !== 'rgba(10, 20, 30, 0.45)') throw new Error(`Unexpected rgba conversion: ${rgba}`);
    console.log('  ✓ chartColorToRgba passed all cases');
  }

  // Test 2: parseHexColor
  {
    console.log('\n--- 2. Testing parseHexColor ---');
    const p6 = parseHexColor('#3D7EFF');
    if (p6?.color !== '#3D7EFF' || p6?.opacity !== undefined) throw new Error('parseHexColor 6 failed');

    const p8 = parseHexColor('#3D7EFF80');
    if (p8?.color !== '#3D7EFF' || p8?.opacity !== 0.5) throw new Error('parseHexColor 8 failed');

    const p3 = parseHexColor('#FFF');
    if (p3?.color !== '#FFFFFF') throw new Error('parseHexColor 3 failed');
    console.log('  ✓ parseHexColor passed all cases');
  }

  // Test 3: Zustand Store Opacity State & Actions
  {
    console.log('\n--- 3. Testing Store Opacity State & Actions ---');
    const state = useChartStore.getState();

    // Candle opacities
    state.setCandleUpOpacity(0.75);
    state.setCandleDownOpacity(0.65);
    state.setCandleUpWickOpacity(0.85);
    state.setCandleDownWickOpacity(0.55);

    const s1 = useChartStore.getState();
    if (s1.candleUpOpacity !== 0.75) throw new Error('candleUpOpacity failed');
    if (s1.candleDownOpacity !== 0.65) throw new Error('candleDownOpacity failed');
    if (s1.candleUpWickOpacity !== 0.85) throw new Error('candleUpWickOpacity failed');
    if (s1.candleDownWickOpacity !== 0.55) throw new Error('candleDownWickOpacity failed');
    console.log('  ✓ Candle opacities updated in store');

    // Background opacities
    state.setChartBackgroundOpacity(0.9);
    state.setChartBackgroundGradientTopOpacity(0.8);
    state.setChartBackgroundGradientBottomOpacity(0.7);

    const s2 = useChartStore.getState();
    if (s2.chartBackgroundOpacity !== 0.9) throw new Error('chartBackgroundOpacity failed');
    if (s2.chartBackgroundGradientTopOpacity !== 0.8) throw new Error('chartBackgroundGradientTopOpacity failed');
    if (s2.chartBackgroundGradientBottomOpacity !== 0.7) throw new Error('chartBackgroundGradientBottomOpacity failed');
    console.log('  ✓ Background opacities updated in store');

    // Grid opacities and styles
    state.setVerticalGridLineOpacity(0.35);
    state.setHorizontalGridLineOpacity(0.45);
    state.setVerticalGridLineStyle('dotted');
    state.setHorizontalGridLineStyle('dashed');

    const s3 = useChartStore.getState();
    if (s3.verticalGridLineOpacity !== 0.35) throw new Error('verticalGridLineOpacity failed');
    if (s3.horizontalGridLineOpacity !== 0.45) throw new Error('horizontalGridLineOpacity failed');
    if (s3.verticalGridLineStyle !== 'dotted') throw new Error('verticalGridLineStyle failed');
    if (s3.horizontalGridLineStyle !== 'dashed') throw new Error('horizontalGridLineStyle failed');
    console.log('  ✓ Grid line opacities & styles updated in store');
  }

  // Test 4: drawGrid Canvas strokes with opacity and line styles
  {
    console.log('\n--- 4. Testing drawGrid canvas strokes with opacity and line styles ---');
    const strokes: string[] = [];
    const dashes: number[][] = [];
    let currentStroke = '';
    const mockCtx = {
      get strokeStyle() { return currentStroke; },
      set strokeStyle(val: string) { currentStroke = val; strokes.push(`strokeStyle=${val}`); },
      save: () => {},
      restore: () => {},
      setLineDash: (d: number[]) => { dashes.push(d); },
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => { strokes.push(`stroke() with ${currentStroke}`); },
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    drawGrid(
      mockCtx,
      100, // priceMin
      200, // priceMax
      () => 50, // priceToY
      () => 50, // indexToX
      0, // rawFirstIndex
      10, // rawLastIndex
      800, // canvasWidth
      600, // canvasHeight
      60, // priceAxisWidth
      24, // timeAxisHeight
      10, // barWidth
      {
        showHorizontal: true,
        horizontalColor: '#1F1F1F',
        horizontalOpacity: 0.4,
        horizontalStyle: 'dashed',
        showVertical: true,
        verticalColor: '#333333',
        verticalOpacity: 0.25,
        verticalStyle: 'dotted',
      }
    );

    const horzStroke = strokes.find(s => s.includes('rgba(31, 31, 31, 0.4)'));
    const vertStroke = strokes.find(s => s.includes('rgba(51, 51, 51, 0.25)'));
    const hasDashed = dashes.some(d => d.length === 2 && d[0] === 4 && d[1] === 4);
    const hasDotted = dashes.some(d => d.length === 2 && d[0] === 2 && d[1] === 2);

    console.log(`  Horizontal stroke with 0.4 opacity: ${Boolean(horzStroke)}`);
    console.log(`  Vertical stroke with 0.25 opacity: ${Boolean(vertStroke)}`);
    console.log(`  Horizontal dashed line style ([4,4]): ${hasDashed}`);
    console.log(`  Vertical dotted line style ([2,2]): ${hasDotted}`);
    if (!horzStroke || !vertStroke || !hasDashed || !hasDotted) {
      throw new Error('drawGrid did not apply opacity or line style!');
    }
    console.log('  ✓ drawGrid opacity & line styles applied correctly');
  }

  // Test 5: drawCandles Canvas strokes/fills with opacity
  {
    console.log('\n--- 5. Testing drawCandles canvas strokes/fills with opacity ---');
    const ops: string[] = [];
    let curFill = '';
    let curStroke = '';
    const mockCtx = {
      get fillStyle() { return curFill; },
      set fillStyle(val: string) { curFill = val; ops.push(`fill=${val}`); },
      get strokeStyle() { return curStroke; },
      set strokeStyle(val: string) { curStroke = val; ops.push(`stroke=${val}`); },
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fillRect: () => {},
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    const testCandles: Candle[] = [
      { time: 1000, open: 100, high: 110, low: 95, close: 108, volume: 100, isClosed: true }, // Bullish
      { time: 2000, open: 108, high: 112, low: 90, close: 98, volume: 100, isClosed: true }, // Bearish
    ];

    drawCandles(
      mockCtx,
      testCandles,
      0, // firstIndex
      1, // lastIndex
      () => 100,
      () => 50,
      10,
      false, // isHollowMode
      {
        upColor: '#089981',
        upOpacity: 0.6,
        downColor: '#F23645',
        downOpacity: 0.4,
        upWickColor: '#00BCD4',
        upWickOpacity: 0.7,
        downWickColor: '#FF9800',
        downWickOpacity: 0.5,
      }
    );

    const hasUpBody = ops.some(op => op === 'fill=rgba(8, 153, 129, 0.6)');
    const hasDownBody = ops.some(op => op === 'fill=rgba(242, 54, 69, 0.4)');
    const hasUpWick = ops.some(op => op === 'stroke=rgba(0, 188, 212, 0.7)');
    const hasDownWick = ops.some(op => op === 'stroke=rgba(255, 152, 0, 0.5)');

    console.log(`  Up body with 0.6 opacity: ${hasUpBody}`);
    console.log(`  Down body with 0.4 opacity: ${hasDownBody}`);
    console.log(`  Up wick with 0.7 opacity: ${hasUpWick}`);
    console.log(`  Down wick with 0.5 opacity: ${hasDownWick}`);

    if (!hasUpBody || !hasDownBody || !hasUpWick || !hasDownWick) {
      throw new Error('drawCandles did not apply custom candle opacities!');
    }
    console.log('  ✓ drawCandles opacity applied correctly');
  }

  console.log('\n>>> All Global Settings Opacity & Color Picker Integration Tests Passed! <<<\n');
}

runTests();
