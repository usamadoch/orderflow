import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: [
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3001');
  
  await new Promise(r => setTimeout(r, 10000)); // wait 10 sec

  try {
    const indicatorsBtns = await page.$$('button');
    for (const btn of indicatorsBtns) {
        const title = await page.evaluate(el => el.getAttribute('title'), btn);
        if (title && title.includes('Indicators')) {
            await btn.click();
            await new Promise(r => setTimeout(r, 1000));
            break;
        }
    }
    const labels = await page.$$('label, div, span, h3');
    for (const label of labels) {
        const text = await page.evaluate(el => el.textContent, label);
        if (text && text.includes('VWAP')) {
            await label.click();
            await new Promise(r => setTimeout(r, 1000));
            break;
        }
    }
  } catch {
    // ignore
  }

  await new Promise(r => setTimeout(r, 60000)); // Wait 60 seconds

  const markBuf = await page.evaluate(() => window.__markBuf || []);
  const renders = markBuf.filter(m => m.label === 'ReactRender');
  const redraws = markBuf.filter(m => m.label === 'rAF_redraw');
  
  console.log("ReactRender count:", renders.length, "avg:", renders.reduce((a,b)=>a+b.duration,0)/(renders.length||1));
  console.log("rAF_redraw count:", redraws.length, "avg:", redraws.reduce((a,b)=>a+b.duration,0)/(redraws.length||1));

  const longRedraws = redraws.filter(m => m.duration > 100);
  console.log("rAF_redraw > 100ms count:", longRedraws.length);

  await browser.close();
})();
