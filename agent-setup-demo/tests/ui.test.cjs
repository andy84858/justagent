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

  const navText1 = await page.locator('#ws-nav').innerText();
  record('nav tree lists FAQ_ANSWER display name', navText1.indexOf('客服問答助手') !== -1);
  record('nav tree lists ORDER_ASSIST display name', navText1.indexOf('訂單助手') !== -1);

  // Collapsed by default: variant names not visible yet.
  record('variants hidden before expand', navText1.indexOf('一般版') === -1);

  await page.click('[data-npc-toggle="FAQ_ANSWER"]');
  const navText2 = await page.locator('#ws-nav').innerText();
  record('expanding FAQ_ANSWER reveals its variants', navText2.indexOf('一般版') !== -1 && navText2.indexOf('豪華版') !== -1);

  await page.click('[data-npc-toggle="FAQ_ANSWER"]');
  const navText3 = await page.locator('#ws-nav').innerText();
  record('collapsing FAQ_ANSWER hides its variants again', navText3.indexOf('一般版') === -1);

  const centerEmptyText = await page.locator('#ws-center').innerText();
  record('center pane shows empty-state hint before any selection', centerEmptyText.indexOf('請從左側選擇') !== -1, centerEmptyText);

  await page.click('[data-npc-select="FAQ_ANSWER"]');
  const npcPaneCount = await page.locator('#ws-npc-pane').count();
  record('selecting an NPC renders #ws-npc-pane', npcPaneCount === 1);

  await page.click('[data-npc-toggle="FAQ_ANSWER"]');
  await page.click('[data-variant-row="FAQ_ANSWER.STANDARD"]');
  const variantStubCount = await page.locator('.ws-variant-stub').count();
  record('selecting a variant renders the Phase 2 stub', variantStubCount === 1);

  await page.click('.ws-nav-create-npc');
  const formVisible = await page.locator('[data-npc-form]').count();
  record('clicking + 新增 NPC opens the create form', formVisible === 1);

  await page.fill('[data-npc-form-code]', 'bad code!');
  await page.click('[data-npc-form-submit]');
  const errorText1 = await page.locator('[data-npc-form-error]').innerText();
  record('invalid code shows a validation error and does not create', errorText1.length > 0, errorText1);
  const npcCountAfterBad = await page.evaluate(() => window.appState.data.npcs.length);
  record('invalid code did not add an NPC', npcCountAfterBad === 3, 'count=' + npcCountAfterBad);

  await page.fill('[data-npc-form-code]', 'DATA_ANALYST');
  await page.fill('[data-npc-form-name]', '數據分析助手');
  await page.click('[data-npc-form-submit]');
  const npcCountAfterGood = await page.evaluate(() => window.appState.data.npcs.length);
  record('valid code creates a new NPC', npcCountAfterGood === 4, 'count=' + npcCountAfterGood);
  const selectedCode = await page.evaluate(() => window.appState.selection.npcCode);
  record('newly created NPC is auto-selected', selectedCode === 'DATA_ANALYST');

  const dupError = await page.evaluate(function () {
    return wsValidateNpcCode('FAQ_ANSWER', 'customer_service', window.appState.data.npcs);
  });
  record('duplicate code+usedFor is rejected by validator', typeof dupError === 'string' && dupError.length > 0, dupError);

  await browser.close();

  const failed = results.filter((r) => !r.passed).length;
  console.log('\n' + results.length + ' checks, ' + failed + ' failed, ' + jsErrors.length + ' JS errors');
  if (jsErrors.length) console.log('JS errors:', jsErrors);
  process.exit(failed > 0 || jsErrors.length > 0 ? 1 : 0);
}

main();
