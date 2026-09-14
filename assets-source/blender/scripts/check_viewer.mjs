import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5173/assets-source/blender/spacecraft/viewer.html');
 await page.waitForFunction(()=>window.assetReview?.ready,undefined,{timeout:30000});
 for(let lod=0;lod<3;lod++){
  await page.locator(`[data-lod="${lod}"]`).click();
  await page.waitForTimeout(250);
  await page.screenshot({path:fileURLToPath(new URL(`../spacecraft/previews/three-lod${lod}.png`,import.meta.url))});
 }
 const review=await page.evaluate(()=>window.assetReview);
 assert.equal(await page.locator('canvas').count(),1);
 assert.equal(errors.length,0,errors.join('\n'));
 assert.equal(review.models.length,3);
 for(const m of review.models){
  assert(m.dimensions.every((v,i)=>Math.abs(v-[7.8,4.8,15.6][i])<.02));
  assert(m.triangles<=[120000,60000,20000][m.lod]);
 }
 for(let i=0;i<12;i++)await page.locator(`[data-lod="${i%3}"]`).click();
 const after=await page.evaluate(()=>window.assetReview.render);
 assert.equal(after.geometries,review.render.geometries);
 const result={...review,errors,afterSwitches:after};
 await fs.writeFile(new URL('../spacecraft/browser-report.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close();}
