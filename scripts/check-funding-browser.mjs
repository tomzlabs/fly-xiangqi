import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {RECIPIENT,MINT,PACKAGES,paymentUrl} from '../server/funding.mjs';
const browser=await chromium.launch({headless:true});
mkdirSync('test-results/funding',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let enabled=false,paid=false,seconds=0,created=0;
 const order={id:'00000000-0000-0000-0000-000000000001',capability:'c'.repeat(64),recipient:RECIPIENT,mint:MINT,reference:RECIPIENT,units:'5000000',seconds:60,expiresAt:new Date(Date.now()+900000).toISOString()};order.paymentUrl=paymentUrl(order);
 await page.route('**/api/funding/status',r=>r.fulfill({json:{enabled,remainingSeconds:seconds,packages:PACKAGES,reason:enabled?null:'视频直播与收款尚未开放；当前模拟免费。'}}));
 await page.route('**/api/funding/order*',async r=>{
  if(r.request().method()==='POST'){created++;assert.equal(r.request().postDataJSON().minutes,1);await r.fulfill({status:201,json:order});}
  else{assert.equal(r.request().headers()['x-order-capability'],order.capability);if(paid)seconds=60;await r.fulfill({json:{state:paid?'TIME_ADDED':'AWAITING_PAYMENT',seconds:60}});}
 });
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:5277');
 await page.locator('#funding').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelectorAll('#funding-packages button').length===3);
 assert.equal(await page.locator('#funding-packages button:disabled').count(),3);assert.equal(created,0);
 await page.screenshot({path:'test-results/funding/desktop.png',fullPage:true});
 enabled=true;await page.reload();await page.locator('#funding-packages button').first().click();
 await page.locator('#funding-pay').waitFor();assert.match(await page.locator('#funding-pay').getAttribute('href'),/^solana:/);assert.equal(created,1);
 await page.reload();await page.locator('#funding-pay').waitFor();assert.equal(created,1);
 paid=true;
 await page.waitForFunction(()=>document.querySelector('#funding-result').textContent.includes('到账成功'),{},{timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#pool-clock').textContent==='01:00');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('fly-funding-order')),null);
 await page.click('#funding-dismiss');enabled=false;await page.reload();
 await page.setViewportSize({width:390,height:844});await page.locator('#funding').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelectorAll('#funding-packages button:disabled').length===3);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'test-results/funding/mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({disabledPayments:true,quoteAndQr:true,orderRecovery:true,confirmedCredit:true,mobile:true,errors}));
}finally{await browser.close();}
