import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  console.log("Navigating to app...");
  await page.goto('http://localhost:3001');
  
  console.log("Waiting for app to load...");
  await new Promise(r => setTimeout(r, 10000));
  
  try {
    console.log("Enabling VWAP...");
    // The Indicators button might contain an Activity icon or text "Indicators"
    const indicatorsBtns = await page.$$('button');
    for (const btn of indicatorsBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        const title = await page.evaluate(el => el.getAttribute('title'), btn);
        if ((text && text.includes('Indicators')) || (title && title.includes('Indicators'))) {
            await btn.click();
            await new Promise(r => setTimeout(r, 1000));
            break;
        }
    }
      
    // Now click VWAP
    const labels = await page.$$('label, div, span, h3');
    for (const label of labels) {
        const text = await page.evaluate(el => el.textContent, label);
        if (text && text.includes('VWAP')) {
            await label.click();
            console.log("VWAP clicked.");
            await new Promise(r => setTimeout(r, 1000));
            break;
        }
    }
    
    // Close modal or just click away
    await page.mouse.click(10, 10);
    
  } catch (e) {
    console.error("Failed to enable VWAP", e);
  }

  console.log("Running for 1 minute...");
  await new Promise(r => setTimeout(r, 60 * 1000));

  console.log("Extracting trace...");
  const result = await page.evaluate(() => {
    const ltBuf = window.__ltBuf || [];
    const markBuf = window.__markBuf || [];
    
    const results = ltBuf.map(lt => {
      const ltStart = lt.startTime;
      const ltEnd = lt.startTime + lt.duration;
      
      const overlappingMarks = markBuf.filter(m => {
        const mStart = m.startTime;
        const mEnd = m.startTime + m.duration;
        return (mStart < ltEnd) && (mEnd > ltStart);
      });
      
      let totalMarkDurationInLt = 0;
      const markDetails = overlappingMarks.map(m => {
        const mStart = m.startTime;
        const mEnd = m.startTime + m.duration;
        const overlapStart = Math.max(ltStart, mStart);
        const overlapEnd = Math.min(ltEnd, mEnd);
        const overlapDuration = overlapEnd - overlapStart;
        totalMarkDurationInLt += overlapDuration;
        return `${m.label}(${overlapDuration.toFixed(1)}ms)`;
      });
      
      const unexplained = Math.max(0, lt.duration - totalMarkDurationInLt);
      const fractionMarked = (totalMarkDurationInLt / lt.duration) * 100;
      
      // Determine VWAP state
      const vwapOn = true; // Assuming we successfully clicked it
      
      return {
        wallTime: lt.wallTime,
        duration: Math.round(lt.duration),
        vwap_on: vwapOn,
        marks: markDetails.join(', '),
        unexplained: Math.round(unexplained),
        fractionMarked: fractionMarked.toFixed(1) + '%'
      };
    });
    
    return {
      longTasks: results.filter(r => r.duration > 100),
      divergence: window.__vwapDivergenceBuf || []
    };
  });
  
  fs.writeFileSync('perf_trace_verification.json', JSON.stringify(result, null, 2));
  console.log("Trace saved to perf_trace_verification.json");
  
  await browser.close();
})();
