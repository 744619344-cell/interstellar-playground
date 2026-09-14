import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
const kind=process.argv.includes('--pbr')?'pbr':'mechanisms';
const folder=new URL(`../spacecraft/${kind}/`,import.meta.url);
await fs.mkdir(new URL('previews/',folder),{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:5173/assets-source/blender/spacecraft/${kind}/viewer.html`);
 await page.waitForFunction(()=>window.mechanismReview?.ready,{},{timeout:30000});
 await page.evaluate(()=>{window.mechanismReview.manualClock=true;window.mechanismReview.player.reset();});
 const advance=async seconds=>page.evaluate(s=>{for(let t=0;t<s;t+=.025)window.mechanismReview.player.update(.025);},seconds);
 const snapshot=()=>page.evaluate(()=>window.mechanismReview.player.snapshot());
 const capture=async name=>{await page.waitForTimeout(150);await page.screenshot({path:fileURLToPath(new URL(`previews/${name}.png`,folder))});};
 for(let lod=0;lod<2;lod++){
  await page.locator(`[data-lod="${lod}"]`).click();await page.locator('#reset').click();
  await page.locator('[data-view="portal"]').click();await capture(`lod${lod}-outer-closed`);
  await page.locator('[data-door="outer"][data-open="1"]').click();await advance(.6);await capture(`lod${lod}-outer-mid`);
  await page.locator('#pause').click();const paused=await snapshot();await advance(2);assert.deepEqual(await snapshot(),paused);
  await page.locator('#pause').click();await advance(1);assert.equal((await snapshot()).doors.outer.progress,1);
  await capture(`lod${lod}-outer-open`);
  await page.locator('[data-door="inner"][data-open="1"]').click();assert.equal((await snapshot()).doors.inner.target,0);
  assert.match(await page.locator('#message').innerText(),/另一扇门/);
  await page.locator('[data-door="outer"][data-open="0"]').click();await advance(1.4);
  await page.locator('[data-view="inner"]').click();
  await page.locator('[data-door="inner"][data-open="1"]').click();await advance(1.4);await capture(`lod${lod}-inner-open`);
  await page.locator('#reset').click();await page.locator('[data-view="pilot"]').click();
  await page.locator('#console').click();await advance(.6);await capture(`lod${lod}-console`);
  await page.locator('[data-view="rear"]').click();await page.locator('#thrust').click();await capture(`lod${lod}-thrust`);
 }
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const hidden=await snapshot();await advance(3);assert.deepEqual(await snapshot(),hidden);assert.equal(hidden.suspended,true);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal((await snapshot()).suspended,false);
 const baseline=await page.evaluate(()=>window.mechanismReview.render.geometries);
 const before=await snapshot();
 for(let i=0;i<12;i++)await page.locator(`[data-lod="${i%2}"]`).click();
 assert.deepEqual(await snapshot(),before);await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.mechanismReview.render.geometries),baseline);
 await page.locator('#reset').click();const reset=await snapshot();
 assert.equal(reset.time,0);assert.equal(reset.console,false);assert.equal(reset.thrust,false);
 assert.equal(reset.doors.inner.progress,0);assert.equal(reset.doors.outer.progress,0);
 assert.equal(await page.locator('canvas').count(),1);assert.deepEqual(errors,[]);
 const result=await page.evaluate(()=>({errors:window.mechanismReview.errors,selection:window.mechanismReview.selection,render:window.mechanismReview.render}));
 assert.deepEqual(result.errors,[]);
 const textures=await page.evaluate(()=>window.mechanismReview.textures);
 if(kind==='pbr'){
  assert.equal(textures.length,6);
  for(const texture of textures){assert.equal(texture.width,2048);assert.equal(texture.height,2048);
   assert.equal(texture.colorSpace,texture.name.includes('ORM')?'':'srgb');}
  assert(result.render.calls<=24);
  assert.equal(result.render.textures,8); // six atlases + PMREM + Three.js's empty sampler texture
 }
 const disposal=await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));return window.mechanismReview.disposal;});
 assert.equal(disposal.geometries,0);
 // Three.js retains its module-level empty sampler counter; final context loss releases it.
 assert.equal(disposal.textures,1);assert.equal(disposal.contextLost,true);
 const report={...result,textures,baseline,disposal,checks:['two LODs / six views of animation states','pause','hidden time','door interlock','12 LOD switches preserve state','reset','one renderer','pagehide disposal']};
 await fs.writeFile(new URL('browser-report.json',folder),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
