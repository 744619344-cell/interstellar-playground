import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
const folder=new URL('../spacecraft/visibility/',import.meta.url);await fs.mkdir(new URL('previews/',folder),{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[],states=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/assets-source/blender/spacecraft/visibility/viewer.html');
 await page.waitForFunction(()=>window.visibilityReview?.ready,{},{timeout:30000});
 await page.evaluate(()=>{window.visibilityReview.manualClock=true;});
 const step=()=>page.evaluate(()=>{for(let i=0;i<60;i++)window.visibilityReview.player.update(.025);});
 for(let lod=0;lod<2;lod++){
  await page.locator(`[data-lod="${lod}"]`).click();
  for(const view of ['exterior','cockpit','cabin','airlock','cutaway']){
   await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(120);
   const state=await page.evaluate(()=>window.visibilityReview.state);states.push(state);
   assert(state.triangles<[237312,123408][lod]);
   await page.screenshot({path:fileURLToPath(new URL(`previews/lod${lod}-${view}.png`,folder))});
  }
 }
 await page.locator('[data-view="exterior"]').click();await page.waitForTimeout(50);
 const closed=await page.evaluate(()=>window.visibilityReview.state.triangles);
 await page.locator('[data-door="outer"]').click();await step();await page.waitForTimeout(50);
 const opened=await page.evaluate(()=>window.visibilityReview.state.triangles);assert(opened>closed);
 await page.screenshot({path:fileURLToPath(new URL('previews/outer-open.png',folder))});
 const before=await page.evaluate(()=>window.visibilityReview.player.snapshot());
 for(let i=0;i<20;i++){
  await page.locator(`[data-lod="${i%2}"]`).click();
  await page.locator(`[data-view="${i%2?'cockpit':'exterior'}"]`).click();
 }
 assert.deepEqual(await page.evaluate(()=>window.visibilityReview.player.snapshot()),before);
 await page.locator('#pause').click();await step();assert.equal(await page.evaluate(()=>window.visibilityReview.player.time),before.time);
 await page.locator('#pause').click();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await step();assert.equal(await page.evaluate(()=>window.visibilityReview.player.time),before.time);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.locator('#reset').click();await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.visibilityReview.player.doors.outer.progress),0);
 const baseline=await page.evaluate(()=>window.visibilityReview.render);
 for(let i=0;i<10;i++)await page.locator(`[data-view="${i%2?'airlock':'exterior'}"]`).click();
 await page.waitForTimeout(100);const current=await page.evaluate(()=>window.visibilityReview.render);
 assert.equal(current.geometries,baseline.geometries);assert.equal(current.textures,baseline.textures);
 const disposal=await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));return window.visibilityReview.disposal;});
 assert.equal(disposal.geometries,0);assert(disposal.contextLost);assert.deepEqual(errors,[]);
 const report={states,closed,opened,baseline,disposal,errors};
 await fs.writeFile(new URL('browser-report.json',folder),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
