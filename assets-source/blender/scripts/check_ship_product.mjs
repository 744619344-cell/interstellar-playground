import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const folder = new URL('../spacecraft/visibility/', import.meta.url);
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }), errors = [], resources = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: '相机试验', exact: true }).click();
  await page.getByLabel('飞船模型', { exact: true }).filter({ hasText: '飞船已就绪' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.productCanvas = document.querySelector('canvas'); });
  for (const name of ['跟随视角', '驾驶舱', '自由观察', '驾驶舱']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('canvas').count(), 1);
    assert(await page.evaluate(() => document.querySelector('canvas') === window.productCanvas));
    await page.screenshot({ path: fileURLToPath(new URL(`previews/product-${name}.png`, folder)) });
  }
  const position = () => page.getByLabel('飞行位置', { exact: true }).textContent();
  await page.locator('canvas').click({ position: { x: 800, y: 300 } });
  const before = await position();
  await page.keyboard.down('w'); await page.waitForTimeout(700); await page.keyboard.up('w');
  await page.waitForTimeout(200); assert.notEqual(await position(), before);
  for (const name of ['跟随视角', '驾驶舱', '自由观察']) {
    await page.getByRole('button', { name, exact: true }).click(); await page.waitForTimeout(700);
  }
  resources.push(await page.getByLabel('渲染资源', { exact: true }).textContent());
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.getByRole('button', { name: '返回全景', exact: true }).click();
    await page.getByRole('button', { name: '相机试验', exact: true }).click();
    await page.getByLabel('飞船模型', { exact: true }).filter({ hasText: '飞船已就绪' }).waitFor();
    for (const name of ['驾驶舱', '自由观察']) {
      await page.getByRole('button', { name, exact: true }).click(); await page.waitForTimeout(800);
    }
    resources.push(await page.getByLabel('渲染资源', { exact: true }).textContent());
  }
  assert.equal(new Set(resources).size, 1, JSON.stringify(resources));
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.waitForTimeout(250); const paused = await position();
  await page.locator('canvas').click({ position: { x: 800, y: 300 } });
  await page.keyboard.down('w'); await page.waitForTimeout(400); await page.keyboard.up('w');
  assert.equal(await position(), paused);
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(250); const blurred = await position();
  await page.waitForTimeout(400); assert.equal(await position(), blurred);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  for (const name of ['地球航线', '月球航线', '土星航线']) {
    await page.getByRole('button', { name, exact: true }).click();
    assert(!(await page.getByLabel('航线阶段').textContent()).includes('已抵达'));
    await page.getByRole('button', { name: '取消锁定', exact: true }).click();
    assert((await page.getByLabel('航线阶段').textContent()).includes('未选择航线'));
  }
  await page.getByRole('button', { name: '地球航线', exact: true }).click();
  await page.getByRole('button', { name: '复位试验', exact: true }).click();
  assert((await page.getByLabel('航线阶段').textContent()).includes('未选择航线'));
  await page.getByRole('button', { name: '返回全景', exact: true }).click();
  const asset = '**/spacecraft-pbr-lod1.glb*';
  await page.route(asset, route => route.abort());
  await page.getByRole('button', { name: '相机试验', exact: true }).click();
  await page.getByLabel('飞船模型', { exact: true }).filter({ hasText: '加载失败' }).waitFor();
  await page.getByRole('button', { name: '返回全景', exact: true }).click();
  await page.unroute(asset);
  let release, intercepted;
  const pending = new Promise(done => { intercepted = done; });
  await page.route(asset, async route => { intercepted(); await new Promise(done => { release = done; }); await route.continue(); });
  await page.getByRole('button', { name: '相机试验', exact: true }).click(); await pending;
  await page.getByRole('button', { name: '返回全景', exact: true }).click(); release();
  await page.waitForTimeout(1500);
  assert.equal(await page.getByLabel('飞船模型', { exact: true }).count(), 0);
  assert.equal(await page.locator('canvas').count(), 1);
  assert.equal(errors.length, 0, errors.join('\n'));
  await fs.writeFile(new URL('product-browser-report.json', folder), JSON.stringify({ errors, resources, singleCanvas: true,
    driving: true, pauseAndBlur: true, routesClearReset: true, failureFallback: true, exitWhileLoading: true }, null, 2));
  console.log(JSON.stringify({ errors, resources }));
} finally { await browser.close(); }
