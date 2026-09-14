import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/assets-source/blender/spacecraft/interior/viewer.html');
 await page.waitForFunction(()=>window.interiorReview?.ready,{},{timeout:30000});
 for(let lod=0;lod<2;lod++){
  await page.locator(`[data-lod="${lod}"]`).click();
  for(const view of ['cutaway','cabin','cockpit','pilot','airlock']){
   await page.locator(`[data-view="${view}"]`).click();
   await page.waitForTimeout(200);
   await page.screenshot({path:fileURLToPath(new URL(`../spacecraft/interior/previews/browser-${lod}-${view}.png`,import.meta.url))});
  }
 }
 await page.locator('#door').click();
 assert.equal(await page.evaluate(()=>window.interiorReview.selection.door),true);
 await page.waitForTimeout(100);
 await page.locator('#door').click();
 const baseline=await page.evaluate(()=>window.interiorReview.render.geometries);
 for(let i=0;i<12;i++)await page.locator(`[data-lod="${i%2}"]`).click();
 await page.waitForTimeout(100);
 const result=await page.evaluate(()=>window.interiorReview);
 assert.deepEqual(errors,[]);assert.deepEqual(result.errors,[]);
 assert.equal(await page.locator('canvas').count(),1);
 assert.equal(result.models.length,2);
 for(const m of result.models)assert(m.triangles>=[100000,40000][m.lod]&&m.triangles<=[160000,80000][m.lod]);
 assert.equal(result.render.geometries,baseline);
 const disposal=await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));return window.interiorReview.disposal;});
 assert.equal(disposal.geometries,0);
 await fs.writeFile(new URL('../spacecraft/interior/browser-report.json',import.meta.url),JSON.stringify({...result,errors,baseline,disposal},null,2));
 console.log(JSON.stringify({...result,baseline,disposal}));
}finally{await browser.close();}
