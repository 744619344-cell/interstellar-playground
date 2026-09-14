import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
try{
 const page=await browser.newPage(),errors=[];let release;
 const gate=new Promise(resolve=>{release=resolve;});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/spacecraft-pbr-lod1.glb',async route=>{await gate;await route.continue();});
 await page.goto('http://127.0.0.1:5173/assets-source/blender/spacecraft/pbr/viewer.html',{waitUntil:'commit'});
 await page.waitForFunction(()=>window.mechanismReview?.entries.length===1);
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));
 release();await page.waitForFunction(()=>window.mechanismReview.discardedLoads===1);
 const report=await page.evaluate(()=>{const r=window.mechanismReview;return {ready:r.ready,discardedLoads:r.discardedLoads,errors:r.errors,disposal:r.disposal};});
 assert.equal(report.ready,false);assert.equal(report.discardedLoads,1);
 assert.equal(report.disposal.geometries,0);assert.equal(report.disposal.contextLost,true);
 assert.deepEqual(report.errors,[]);assert.deepEqual(errors,[]);
 await fs.writeFile(new URL('../spacecraft/pbr/loading-report.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await browser.close();}
