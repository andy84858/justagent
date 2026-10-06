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

  await page.click('[data-npc-toggle="ORDER_ASSIST"]');
  await page.click('[data-create-variant="ORDER_ASSIST"]');
  const variantFormVisible = await page.locator('[data-variant-form="ORDER_ASSIST"]').count();
  record('clicking + 新人物卡 opens inline form', variantFormVisible === 1);

  await page.fill('[data-variant-form-code="ORDER_ASSIST"]', 'bad-code');
  await page.click('[data-variant-form-submit="ORDER_ASSIST"]');
  const variantErrorText = await page.locator('[data-variant-form-error="ORDER_ASSIST"]').innerText();
  record('invalid variant code shows error', variantErrorText.length > 0, variantErrorText);

  await page.fill('[data-variant-form-code="ORDER_ASSIST"]', 'BASIC');
  await page.fill('[data-variant-form-name="ORDER_ASSIST"]', '基本版');
  await page.click('[data-variant-form-submit="ORDER_ASSIST"]');
  const orderAssistVariantCount = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'ORDER_ASSIST'; }).variants.length;
  });
  record('valid code creates the variant', orderAssistVariantCount === 1, 'count=' + orderAssistVariantCount);
  const selectedVariant = await page.evaluate(() => window.appState.selection.variantCode);
  record('newly created variant is auto-selected', selectedVariant === 'BASIC');

  await page.click('[data-create-variant="ORDER_ASSIST"]');
  await page.fill('[data-variant-form-code="ORDER_ASSIST"]', 'BASIC');
  await page.fill('[data-variant-form-name="ORDER_ASSIST"]', '重複版');
  await page.click('[data-variant-form-submit="ORDER_ASSIST"]');
  const dupVariantError = await page.locator('[data-variant-form-error="ORDER_ASSIST"]').innerText();
  record('duplicate variant code within the same NPC is rejected', dupVariantError.length > 0, dupVariantError);
  const stillOneVariant = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'ORDER_ASSIST'; }).variants.length;
  });
  record('duplicate variant submission did not add a second variant', stillOneVariant === 1, stillOneVariant);

  await page.click('[data-npc-toggle="INTENT_SWITCH"]');
  const switchCreateDisabled = await page.locator('[data-npc-row="INTENT_SWITCH"] + .ws-nav-variant.ws-nav-create').count();
  record('SWITCH-type NPC has no clickable + 新人物卡 trigger', switchCreateDisabled === 0);

  await page.click('[data-npc-select="FAQ_ANSWER"]');
  const npcPaneText = await page.locator('#ws-npc-pane').innerText();
  record('NPC pane shows displayName', npcPaneText.indexOf('客服問答助手') !== -1);
  record('NPC pane shows locked code as text', npcPaneText.indexOf('FAQ_ANSWER') !== -1);

  const codeIsInput = await page.locator('#ws-npc-pane input[value="FAQ_ANSWER"]').count();
  record('locked code field is not an input', codeIsInput === 0);

  const lockIconCount = await page.locator('#ws-npc-pane .badge-locked').count();
  record('locked fields show the lock badge (code, type, usedFor = 3)', lockIconCount === 3, 'found ' + lockIconCount);

  const pencilCount = await page.locator('[data-npc-edit-pencil]').count();
  record('NPC pane has an edit pencil', pencilCount === 1);

  await page.click('[data-npc-edit-pencil]');
  const nameInputCount = await page.locator('[data-npc-name-input]').count();
  record('clicking pencil turns displayName into an input', nameInputCount === 1);
  const codeStillLocked = await page.locator('#ws-npc-pane input[value="FAQ_ANSWER"]').count();
  record('code stays locked text even in edit mode', codeStillLocked === 0);

  await page.fill('[data-npc-name-input]', '客服智慧助手');
  await page.click('[data-npc-edit-commit]');
  const savedName = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'FAQ_ANSWER'; }).displayName;
  });
  record('committing edit persists the new displayName', savedName === '客服智慧助手', savedName);
  const backToReadOnly = await page.locator('[data-npc-name-input]').count();
  record('after commit, pane returns to read-only', backToReadOnly === 0);

  await page.click('[data-npc-select="ORDER_ASSIST"]');
  const noModelHint = await page.locator('#ws-npc-model-section').innerText();
  record('ORDER_ASSIST shows no-chat-model state', noModelHint.indexOf('尚未設定對話模型') !== -1, noModelHint);

  await page.click('[data-add-model="chatModel"]');
  const templateSelectCount = await page.locator('[data-model-template-select="chatModel"]').count();
  record('clicking 加入模型 shows a template dropdown', templateSelectCount === 1);

  await page.selectOption('[data-model-template-select="chatModel"]', 'bedrock:claude-sonnet-5.5');
  await page.click('[data-model-confirm="chatModel"]');
  const chatModelKey = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'ORDER_ASSIST'; }).chatModel.key;
  });
  record('confirming attaches the chosen template', chatModelKey === 'bedrock:claude-sonnet-5.5', chatModelKey);

  const chatModelParams = await page.evaluate(function () {
    return window.appState.data.npcs.find(function (n) { return n.code === 'ORDER_ASSIST'; }).chatModel.params;
  });
  record('attached model gets default params from template', chatModelParams.temperature === 0.5 && chatModelParams.max_tokens === 2048, JSON.stringify(chatModelParams));

  await browser.close();

  const failed = results.filter((r) => !r.passed).length;
  console.log('\n' + results.length + ' checks, ' + failed + ' failed, ' + jsErrors.length + ' JS errors');
  if (jsErrors.length) console.log('JS errors:', jsErrors);
  process.exit(failed > 0 || jsErrors.length > 0 ? 1 : 0);
}

main();
