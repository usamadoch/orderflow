import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3001');
  
  await new Promise(r => setTimeout(r, 10000)); // wait 10 sec

  const bufLength = await page.evaluate(() => {
    return (window.__ltBuf || []).length;
  });
  
  console.log("ltBuf length:", bufLength);

  const ltBuf = await page.evaluate(() => window.__ltBuf || []);
  console.log("first 5 tasks:", JSON.stringify(ltBuf.slice(0, 5), null, 2));

  await browser.close();
})();
