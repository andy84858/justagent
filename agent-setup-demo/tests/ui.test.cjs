const path = require('path');
const { chromium } = require('playwright-core');

const results = [];
function record(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + name + (detail ? ' (' + detail + ')' : ''));
}

async function main() {
  const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(String(err)));

  await page.goto('file://' + path.resolve(__dirname, '../index.html'));

  const paneCount = await page.locator('.ws-pane').count();
  record('three pane containers exist', paneCount === 3, 'found ' + paneCount);

  const navExists = await page.locator('#ws-nav').count();
  record('#ws-nav exists', navExists === 1);

  const centerExists = await page.locator('#ws-center').count();
  record('#ws-center exists', centerExists === 1);

  const bagExists = await page.locator('#ws-bag').count();
  record('#ws-bag exists', bagExists === 1);

  const npcCount = await page.evaluate(() => window.appState.data.npcs.length);
  record('SEED has 3 NPCs loaded into appState', npcCount === 3, 'found ' + npcCount);

  const faqNpc = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'FAQ_ANSWER'));
  record('FAQ_ANSWER NPC present with 2 variants', !!faqNpc && faqNpc.variants.length === 2);

  const switchNpc = await page.evaluate(() => window.appState.data.npcs.find((n) => n.code === 'INTENT_SWITCH'));
  record('INTENT_SWITCH NPC is type SWITCH', !!switchNpc && switchNpc.type === 'SWITCH');

  await browser.close();

  const failed = results.filter((r) => !r.passed).length;
  console.log('\n' + results.length + ' checks, ' + failed + ' failed, ' + jsErrors.length + ' JS errors');
  if (jsErrors.length) console.log('JS errors:', jsErrors);
  process.exit(failed > 0 || jsErrors.length > 0 ? 1 : 0);
}

main();
