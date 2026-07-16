import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const URL_BASE = 'http://localhost:4173/';
const APP = '/Users/andimatthies/Documents/ANDREA AI OS/ANDREA AI OS/projects/diy-project-tracker/app';

let failures = 0;
const check = (label, ok, extra = '') => {
  if (ok) console.log(`ok   ${label}`);
  else { failures++; console.log(`FAIL ${label} ${extra}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-first-run', '--hide-scrollbars']
});
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('pageerror', (e) => { failures++; console.log('PAGE ERROR:', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.log('console.error:', m.text()); });

async function clickText(selector, textWanted) {
  const ok = await page.evaluate((sel, t) => {
    const els = [...document.querySelectorAll(sel)];
    const el = els.find((e) => e.textContent.trim().toLowerCase().includes(t.toLowerCase()));
    if (el) { el.click(); return true; }
    return false;
  }, selector, textWanted);
  if (!ok) throw new Error(`clickText: no ${selector} containing "${textWanted}"`);
}
const text = () => page.evaluate(() => document.body.innerText);
async function openProject(name) {
  await page.evaluate((n) => {
    const card = [...document.querySelectorAll('.proj-card')].find((c) => c.textContent.includes(n));
    card.querySelector('.inner').click();
  }, name);
  await sleep(400);
}
async function openTask(name) {
  await page.evaluate((n) => {
    const row = [...document.querySelectorAll('.task-row')].find((r) => r.textContent.includes(n));
    row.querySelector('.tbody').click();
  }, name);
  await sleep(450);
}

// ---------- 1. welcome + app identity ----------
await page.goto(URL_BASE, { waitUntil: 'networkidle0' });
await sleep(300);
let t = await text();
check('welcome greets Jillian', t.includes('Hello, Jillian.'));
check('app titled Jillie', (await page.title()) === 'Jillie');
const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
check('manifest named Jillie', manifest.name === 'Jillie' && manifest.short_name === 'Jillie');
check('manifest share_target wired', manifest.share_target?.action?.includes('share-target') && manifest.share_target?.params?.files?.[0]?.name === 'images');
check('manifest icons are the v2 purple set', manifest.icons?.every((i) => i.src.includes('-v2.png')) && manifest.icons?.some((i) => i.purpose === 'maskable'));
await clickText('button', 'Next'); await sleep(150);
await clickText('button', 'Next'); await sleep(150);
await clickText('button', "Let's go"); await sleep(300);

// ---------- 2. empty dashboard ----------
t = await text();
check('dashboard greeting', /Morning, Jillian|Afternoon, Jillian|Evening, Jillian/.test(t));
check('empty dashboard is warm', t.includes('No projects yet, Jillian.'));
check('new project button on Today', !!(await page.$('.new-proj-inline')));

// ---------- 3. create project; 12 pastel swatches ----------
await clickText('.bottomnav a', 'Projects'); await sleep(300);
await clickText('button', 'New project'); await sleep(300);
await page.type('.sheet input[type=text]', 'Laundry reno');
check('twelve colours plus pick-your-own', (await page.$$eval('.swatch', (els) => els.length)) === 13);
const swatchCols = await page.$$eval('.swatch', (els) => els.map((e) => getComputedStyle(e).backgroundColor));
check('palette is the pastel flower set', swatchCols.includes('rgb(244, 143, 190)') && swatchCols.includes('rgb(117, 213, 232)') && !swatchCols.includes('rgb(138, 111, 75)'), JSON.stringify(swatchCols));
await page.evaluate(() => [...document.querySelectorAll('.swatch')][2].click()); // blue
await sleep(120);
await clickText('button', 'Create project'); await sleep(500);
t = await text();
check('sheet closed and landed in project', t.includes('Laundry reno') && t.includes('No tasks yet.'));

// ---------- 4. quick add tasks; field clears ----------
for (const name of ['Measure the wall space', 'Pick the paint colour', 'Order the new cabinet', 'Book Bob for plumbing']) {
  await page.type('.quickadd input', name);
  await clickText('.quickadd button', 'Add');
  await sleep(200);
}
check('quick add field cleared itself', (await page.$eval('.quickadd input', (e) => e.value)) === '');
let labels = await page.$$eval('.num-chip', (els) => els.map((e) => e.textContent));
check('four numbered steps', JSON.stringify(labels) === JSON.stringify(['1', '2', '3', '4']), JSON.stringify(labels));

// ---------- 5. sub-step under task 2 ----------
await page.evaluate(() => [...document.querySelectorAll('.task-row [aria-label^="Options for"]')][1].click());
await sleep(300);
await clickText('.sheet-item', 'Add a step under this'); await sleep(500);
await page.type('input[placeholder="What needs doing?"]', 'Get sample pots');
await sleep(400);
await page.evaluate(() => window.history.back()); await sleep(500);
labels = await page.$$eval('.num-chip', (els) => els.map((e) => e.textContent));
check('sub-step numbered 2.1', JSON.stringify(labels) === JSON.stringify(['1', '2', '2.1', '3', '4']), JSON.stringify(labels));

// ---------- 6. tick done: progress, confetti, encouragement ----------
await page.evaluate(() => document.querySelectorAll('.tick')[0].click());
await sleep(250);
check('confetti bursts on tick', !!(await page.$('.confetti-layer')));
await sleep(400);
t = await text();
check('progress in words', t.includes('1 of 5 things done'));
const snack = await page.$eval('.snackbar .msg', (e) => e.textContent).catch(() => '');
check('encouragement message on tick', /underway|quarter|halfway|left|list|progress|head|jillian/i.test(snack), snack);

// ---------- 7. task page: fields, labels, gradients, save button ----------
await openTask('Order the new cabinet');
await clickText('.prio-btn', 'High'); await sleep(200);
const yesterday = new Date(Date.now() - 86400000);
const iso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
await page.evaluate((v) => {
  const el = document.querySelector('input[type=date]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, iso);
await sleep(200);
await page.type('input[placeholder^="e.g. Me"]', 'Bob the plumber');
check('description is second field', await page.evaluate(() => {
  const fieldLabels = [...document.querySelectorAll('.field-label')].map((e) => e.textContent.replace('?', '').trim());
  return fieldLabels[0] === 'Task name' && fieldLabels[1] === 'Task description';
}));
await page.type('textarea[placeholder^="What\'s this task about"]', 'Cabinet from Bunnings Bayswater, ask for Karen');
await page.type('textarea[placeholder^="Add your notes"]', 'Rang Bunnings, cabinet arrives Thursday.');
await clickText('.update-add button', 'Add'); await sleep(300);
t = await text();
check('note stamped with date and time', /\w{3} \d{1,2} \w+, \d{1,2}:\d{2} (am|pm)/.test(t) && t.includes('Rang Bunnings'));
check('note box cleared itself', (await page.$eval('textarea[placeholder^="Add your notes"]', (e) => e.value)) === '');
check('notes field renamed', (await text()).includes('Task updates and notes'));
check('Mark as done is last, after Save task', await page.evaluate(() => {
  const save = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save task');
  const done = document.querySelector('.btn-done');
  return !!save && !!done && !!(save.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING);
}));
await clickText('button', 'Save task'); await sleep(300);
check('Save task gives feedback', (await text()).includes('All saved, Jillian.'));
check('Energy required label with new options', (await text()).includes('Energy required') && (await text()).includes('Minimum') && (await text()).includes('Moderate'));
check('priority + energy buttons have gradients', await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.prio-btn')];
  return btns.length >= 6 && btns.every((b) => getComputedStyle(b).backgroundImage.includes('gradient'));
}));
check('description cannot be drag-resized', (await page.$eval('textarea.autogrow', (e) => getComputedStyle(e).resize)) === 'none');
check('description grows to its text', await page.$eval('textarea.autogrow', (e) => e.style.height !== '' && e.scrollHeight <= e.clientHeight + 2));

// ---------- 8. photos: import + confirm above viewer ----------
const input = await page.$('input[type=file][accept="image/*"]');
await input.uploadFile(APP + '/public/icons/icon-512-v2.png');
await sleep(1500);
check('photo imported, thumbnail shown', (await page.$$eval('.photo-thumb img', (els) => els.length)) === 1);
await page.evaluate(() => document.querySelector('.photo-thumb').click()); await sleep(400);
await page.evaluate(() => document.querySelector('[aria-label="Remove photo"]').click()); await sleep(300);
check('remove-photo confirm visible over image', (await text()).includes('Remove this photo?'));
check('confirm stacked above viewer', await page.evaluate(() => {
  const b = parseInt(getComputedStyle(document.querySelector('.sheet-backdrop')).zIndex, 10);
  const v = parseInt(getComputedStyle(document.querySelector('.viewer')).zIndex, 10);
  return b > v;
}));
await clickText('button', 'Keep it'); await sleep(250);
await page.evaluate(() => document.querySelector('[aria-label="Close photo"]').click()); await sleep(300);

// ---------- 9. shopping from the task; store picker sheet; notes ----------
await page.type('input[placeholder^="e.g. Sandpaper"]', 'Sandpaper, 120 grit');
await page.evaluate(() => document.querySelector('[aria-label="Where to buy it"]').click()); await sleep(300);
const storeItems = await page.$$eval('.sheet-item', (els) => els.map((e) => e.textContent.replace(' ✓', '').trim()));
check('stores alphabetical', JSON.stringify(storeItems) === JSON.stringify([...storeItems].sort((a, b) => a.localeCompare(b))), JSON.stringify(storeItems));
await clickText('.sheet-item', 'Hardware Store'); await sleep(250);
await clickText('.shop-add-row button', 'Add'); await sleep(300);
check('shopping field cleared itself', (await page.$eval('input[placeholder^="e.g. Sandpaper"]', (e) => e.value)) === '');
await page.type('input[placeholder^="e.g. Sandpaper"]', 'Sugar soap');
await page.evaluate(() => document.querySelector('[aria-label="Where to buy it"]').click()); await sleep(250);
await clickText('.sheet-item', 'Supermarket'); await sleep(250);
await clickText('.shop-add-row button', 'Add'); await sleep(300);
const chips = await page.$$eval('.shop-mini-item', (els) => els.map((e) => e.textContent));
check('items chip up on the task', chips.includes('Sandpaper, 120 grit') && chips.includes('Sugar soap'), JSON.stringify(chips));
await page.type('textarea[placeholder^="Add your notes"]', 'Found the taps here https://example.com/taps.');
await clickText('.update-add button', 'Add'); await sleep(300);
const link = await page.$eval('.note-link', (a) => ({ href: a.href, target: a.target })).catch(() => null);
check('note link active, opens in browser', link?.href === 'https://example.com/taps' && link?.target === '_blank', JSON.stringify(link));
await page.evaluate(() => document.querySelectorAll('[aria-label="Note options"]')[0].click()); await sleep(300);
await clickText('.sheet-item', 'Edit note'); await sleep(300);
await page.evaluate(() => {
  const ta = document.querySelector('.sheet textarea');
  const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  s.call(ta, 'Edited: taps ordered, arriving Monday');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
});
await clickText('.sheet button', 'Save'); await sleep(300);
check('note edited in place', (await text()).includes('Edited: taps ordered, arriving Monday'));
await page.evaluate(() => document.querySelectorAll('[aria-label="Note options"]')[0].click()); await sleep(300);
await clickText('.sheet-item', 'Delete note'); await sleep(300);
t = await text();
check('note deleted with undo offered', t.includes('Note deleted.') && !t.includes('Edited: taps ordered'));
check('undo bar has a dismiss X', !!(await page.$('.snack-close')));
await page.evaluate(() => document.querySelector('.snack-close').click()); await sleep(300);
check('undo bar dismissed early', !(await page.$('.snackbar')));

// ---------- 10. dependency-aware Today feed; simplified snippets ----------
await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle0' }); await sleep(500);
t = await text();
const lower = t.toLowerCase();
check('Your projects above the tasks', lower.indexOf('your projects') !== -1 && lower.indexOf('your projects') < lower.indexOf('running late'));
check('feed shows Running late', /running late/i.test(t));
const dashHeroes = await page.$$eval('.hero-pick', (els) => els.map((e) => e.textContent));
check('feed leads with the next step, snippet simplified', dashHeroes.length >= 1 && dashHeroes[0].includes('Pick the paint colour') && dashHeroes[0].includes('Laundry reno') && dashHeroes[0].includes('was due') && !dashHeroes[0].includes('clears the way') && !dashHeroes[0].includes('Order the new cabinet'), JSON.stringify(dashHeroes));
check('project name bold on snippet', await page.evaluate(() => !!document.querySelector('.hero-pick .hwhy strong')));
check('project chip with progress', t.includes('Laundry reno') && t.includes('1 of 5 done'));

// ---------- 11. latest updates; no task archiving; project archive round-trip ----------
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(400);
await openProject('Laundry reno');
t = await text();
check('latest updates section on project', /latest updates/i.test(t) && t.includes('Rang Bunnings') && t.includes('Order the new cabinet'));
await page.evaluate(() => [...document.querySelectorAll('.task-row [aria-label^="Options for"]')].at(-1).click()); await sleep(300);
const rowItems = await page.$$eval('.sheet-item', (els) => els.map((e) => e.textContent));
check('task menu has no Archive', rowItems.some((x) => x.includes('Delete')) && !rowItems.some((x) => x.includes('Archive')), JSON.stringify(rowItems));
await page.mouse.click(206, 60); await sleep(300);
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(300);
await page.evaluate(() => document.querySelector('[aria-label^="Options for"]').click()); await sleep(300);
await clickText('.sheet-item', 'Archive'); await sleep(400);
check('undo bar offered for project archive', (await text()).includes('Undo'));
await page.evaluate(() => document.querySelector('.snack-close').click()); await sleep(300);
await page.goto(URL_BASE + '#/archive', { waitUntil: 'networkidle0' }); await sleep(300);
t = await text();
check('archive lists project, no tabs', t.includes('Laundry reno') && !(await page.$('.tabs')));
await clickText('.putback', 'Put back'); await sleep(400);
check('project put back', (await text()).includes('back with your projects'));

// ---------- 12. delete project + undo (in-session) ----------
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(400);
await page.evaluate(() => document.querySelector('[aria-label^="Options for"]').click()); await sleep(300);
await clickText('.sheet-item', 'Delete'); await sleep(300);
check('delete asks first', (await text()).includes('Delete Laundry reno?'));
await clickText('button', 'Delete'); await sleep(500);
t = await text();
check('project gone with undo offered', t.includes('deleted') && t.includes('Undo'));
await clickText('.snackbar .undo', 'Undo'); await sleep(500);
check('undo brings it back', (await text()).includes('Laundry reno'));
await openProject('Laundry reno');
t = await text();
check('undo restored tasks and notes too', t.includes('Order the new cabinet') && t.includes('Rang Bunnings'));

// ---------- 13. help page + two-step backup ----------
await page.goto(URL_BASE + '#/help', { waitUntil: 'networkidle0' }); await sleep(300);
t = await text();
check('help page complete', t.includes('How this works') && t.includes('Backups') && t.includes('Guide Me'));
await clickText('button', 'Save a backup'); await sleep(1500);
t = await text();
check('backup prepared before sharing', t.includes('Ready — everything packed'));
await clickText('button', 'Save to phone instead'); await sleep(400);
check('backup fallback saves to phone', (await text()).includes('saved to your phone'));

// ---------- 14. share picker (simulated share-target arrival) ----------
await page.evaluate(async () => {
  const blob = await (await fetch('./icons/icon-192-v2.png')).blob();
  const req = indexedDB.open('jillians-diy-projects');
  const idb = await new Promise((res) => { req.onsuccess = () => res(req.result); });
  const tx = idb.transaction('pendingShares', 'readwrite');
  tx.objectStore('pendingShares').put({ id: 'test-share', blob, createdAt: Date.now() });
  await new Promise((res) => { tx.oncomplete = res; });
});
await page.goto(URL_BASE + '#/share', { waitUntil: 'networkidle0' }); await sleep(600);
t = await text();
check('share picker asks which task', t.includes('Which task is this for?'));
check('share picker lists open tasks', t.includes('Pick the paint colour'));
await page.evaluate(() => [...document.querySelectorAll('.feed-item')][0].click()); await sleep(1200);

// ---------- 15. guide me: energy + dependencies ----------
await page.goto(URL_BASE + '#/guide', { waitUntil: 'networkidle0' }); await sleep(400);
t = await text();
check('guide asks how she feels', t.includes('How are you feeling today, Jillian?'));
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(300);
await openProject('Laundry reno');
await openTask('Pick the paint colour');
await clickText('.prio-row button', 'Minimum'); await sleep(300);
await page.goto(URL_BASE + '#/guide', { waitUntil: 'networkidle0' }); await sleep(400);
await clickText('.energy-card', 'Taking it gently'); await sleep(400);
t = await text();
check('low energy shows the gentle next step', t.includes('Pick the paint colour'));
check('low energy copy is kind', t.includes('Gentle day') && /counts double|good day/i.test(t));
await clickText('button', 'Feeling different?'); await sleep(300);
await clickText('.energy-card', 'Full of beans'); await sleep(400);
check('high energy leads with the step that unblocks the urgent job', (await page.$eval('.hero-pick', (e) => e.textContent)).includes('Pick the paint colour'));
await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle0' }); await sleep(300);
await page.goto(URL_BASE + '#/guide', { waitUntil: 'networkidle0' }); await sleep(400);
t = await text();
check('energy remembered for the day', !t.includes('How are you feeling today') && /plenty of energy/i.test(t));

// ---------- 16. dependencies: only the next step is ever offered ----------
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(400);
await openProject('Laundry reno');
for (let i = 1; i <= 8; i++) {
  await page.type('.quickadd input', `Extra job ${i}`);
  await clickText('.quickadd button', 'Add');
  await sleep(120);
}
await page.goto(URL_BASE + '#/guide', { waitUntil: 'networkidle0' }); await sleep(400);
const heroCount = await page.$$eval('.hero-pick', (els) => els.length);
const alsoCount = await page.$$eval('.feed-item', (els) => els.length);
check('guide offers only the next step per project', heroCount === 1 && alsoCount === 0 && !(await page.$('.show-more')), `heroes=${heroCount} also=${alsoCount}`);
check('the pick is the blocker, not a later urgent task', (await page.$eval('.hero-pick', (e) => e.textContent)).includes('Pick the paint colour'));
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(300);
await openProject('Laundry reno');
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.task-row')].find((r) => r.textContent.includes('Pick the paint colour'));
  row.querySelector('.tick').click();
}); await sleep(600);
await page.goto(URL_BASE + '#/guide', { waitUntil: 'networkidle0' }); await sleep(400);
check('queue advances when the blocker is done', (await page.$eval('.hero-pick', (e) => e.textContent)).includes('Get sample pots'));

// ---------- 17. done-task notes hidden from Latest updates ----------
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(300);
await openProject('Laundry reno');
await openTask('Measure the wall space');
await page.type('textarea[placeholder^="Add your notes"]', 'Bob confirmed for Tuesday');
await clickText('.update-add button', 'Add'); await sleep(300);
await page.evaluate(() => window.history.back()); await sleep(400);
t = await text();
check('done-task notes hidden from Latest updates', /latest updates/i.test(t) && !t.includes('Bob confirmed'));

// ---------- 18. shopping: Bought, clear tidies everywhere, edit, filters ----------
await page.goto(URL_BASE + '#/shopping', { waitUntil: 'networkidle0' }); await sleep(400);
t = await text();
check('nav has four tabs', (await page.$$eval('.bottomnav a', (els) => els.length)) === 4);
check('shopping grouped by store', /hardware store/i.test(t) && /supermarket/i.test(t));
await page.select('select[aria-label="Show items from"]', 'Supermarket'); await sleep(300);
t = await text();
check('store filter narrows list', t.includes('Sugar soap') && !t.includes('Sandpaper, 120 grit'));
await page.select('select[aria-label="Show items from"]', 'all'); await sleep(300);
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.shop-row .body.editable')].find((r) => r.textContent.includes('Sandpaper'));
  row.click();
}); await sleep(300);
check('edit sheet opens for unbought item', (await text()).includes('Fix this item'));
await page.evaluate(() => { const i = document.querySelector('.sheet input[type=text]'); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); });
await page.type('.sheet input[type=text]', 'Sandpaper, 240 grit');
await clickText('.sheet button', 'Save'); await sleep(300);
check('item name edited', (await text()).includes('Sandpaper, 240 grit'));
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.shop-row')].find((r) => r.textContent.includes('Sugar soap'));
  row.querySelector('.tick').click();
}); await sleep(300);
t = await text();
check('Bought section appears', /bought/i.test(t));
await clickText('button', 'Clear ticked items'); await sleep(300);
t = await text();
check('clear tidies with undo', t.includes('Undo') && !t.includes('Sugar soap'));
await page.evaluate(() => document.querySelector('.snack-close')?.click()); await sleep(200);
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(300);
await openProject('Laundry reno');
await openTask('Order the new cabinet');
t = await text();
check('cleared item tidied off its task too', !t.includes('Sugar soap'));
check('unbought chip green + tappable', !!(await page.$('button.shop-mini-item.active')));

// ---------- 19. new project from Today; alphabetical; pastel cards ----------
await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle0' }); await sleep(400);
await clickText('.new-proj-inline', 'New project'); await sleep(300);
await page.type('.sheet input[type=text]', 'Deck oiling');
await clickText('button', 'Create project'); await sleep(500);
check('project created from Today screen', (await text()).includes('Deck oiling'));
await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle0' }); await sleep(300);
await clickText('.new-proj-inline', 'New project'); await sleep(300);
await page.type('.sheet input[type=text]', 'Tiny job');
await clickText('button', 'Create project'); await sleep(500);
await page.type('.quickadd input', 'Only task');
await clickText('.quickadd button', 'Add'); await sleep(300);
await page.evaluate(() => document.querySelector('.tick').click()); await sleep(600);
check('tiny project finished', (await text()).includes('Project finished'));
check('archive button offered on finished project', (await text()).includes('Archive this project'));
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(400);
await openProject('Laundry reno');
check('no archive button while tasks remain', !(await text()).includes('Archive this project'));
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(400);
const cardNames = await page.$$eval('.proj-card h3', (els) => els.map((e) => e.textContent));
check('projects screen alphabetical', cardNames[0] === 'Deck oiling' && cardNames[1] === 'Laundry reno', JSON.stringify(cardNames));
const pastelBlooms = ['rgb(249, 168, 112)', 'rgb(126, 217, 160)', 'rgb(133, 175, 245)', 'rgb(249, 156, 148)', 'rgb(244, 143, 190)', 'rgb(111, 209, 196)', 'rgb(195, 147, 242)', 'rgb(117, 213, 232)', 'rgb(143, 207, 248)', 'rgb(231, 148, 240)', 'rgb(247, 143, 164)', 'rgb(155, 160, 245)'];
const cardBgs = await page.$$eval('.proj-card', (els) => els.map((e) => getComputedStyle(e).backgroundColor));
check('project cards wear the pastel colours', cardBgs.every((c) => pastelBlooms.includes(c)), JSON.stringify(cardBgs));
await page.goto(URL_BASE + '#/shopping', { waitUntil: 'networkidle0' }); await sleep(400);
const filterOpts = await page.$$eval('select[aria-label="Show items for"] option', (els) => els.map((e) => e.textContent).slice(1));
check('filter projects alphabetical', JSON.stringify(filterOpts) === JSON.stringify([...filterOpts].sort((a, b) => a.localeCompare(b))), JSON.stringify(filterOpts));
await clickText('button', 'Add to the list'); await sleep(300);
const beforeVal = await page.$eval('[aria-label="Where from"]', (e) => e.textContent.trim());
await page.evaluate(() => document.querySelector('[aria-label="Where from"]').click()); await sleep(300);
await clickText('.sheet button', 'Close'); await sleep(300);
check('store list closes without choosing', (await page.$eval('[aria-label="Where from"]', (e) => e.textContent.trim())) === beforeVal);
const opts = await page.$$eval('.sheet select option', (els) => els.map((e) => e.textContent));
check('finished project not offered', !opts.includes('Tiny job') && opts.includes('Deck oiling'), JSON.stringify(opts));
check('add-sheet projects alphabetical', JSON.stringify(opts) === JSON.stringify([...opts].sort((a, b) => a.localeCompare(b))), JSON.stringify(opts));

// ---------- 20. lock-screen simulation: dead DB heals on wake ----------
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(400);
check('projects visible before sleep', (await text()).includes('Laundry reno'));
await page.evaluate(() => window.__jillieDb.close());
check('connection is dead', await page.evaluate(() => !window.__jillieDb.isOpen()));
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await sleep(900);
check('connection revived on wake', await page.evaluate(() => window.__jillieDb.isOpen()));
check('data back after wake', (await text()).includes('Laundry reno'));

// ---------- 21. scroll to top on navigation ----------
await openProject('Laundry reno');
await page.evaluate(() => window.scrollTo(0, 2000)); await sleep(200);
await page.evaluate(() => document.querySelector('.bottomnav a').click()); await sleep(500);
check('pages open at the top', (await page.evaluate(() => window.scrollY)) === 0);

// ---------- 22. durable delete: refresh can never resurrect (item 33) ----------
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(400);
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.proj-card')].find((c) => c.textContent.includes('Tiny job'));
  card.querySelector('[aria-label^="Options for"]').click();
}); await sleep(300);
await clickText('.sheet-item', 'Delete'); await sleep(300);
await clickText('button', 'Delete'); await sleep(400);
// refresh IMMEDIATELY, inside the undo window — the old bug's exact trigger
await page.reload({ waitUntil: 'networkidle0' }); await sleep(600);
check('deleted project stays gone after instant refresh', !(await text()).includes('Tiny job'));
await page.reload({ waitUntil: 'networkidle0' }); await sleep(600);
check('still gone after a second refresh', !(await text()).includes('Tiny job'));
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(400);
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.proj-card')].find((c) => c.textContent.includes('Deck oiling'));
  card.querySelector('[aria-label^="Options for"]').click();
}); await sleep(300);
await clickText('.sheet-item', 'Delete'); await sleep(300);
await clickText('button', 'Delete'); await sleep(400);
await clickText('.snackbar .undo', 'Undo'); await sleep(500);
check('undo still restores a deleted project', (await text()).includes('Deck oiling'));

// ---------- 23. dark mode: app stays its designed light self (item 32) ----------
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
await page.reload({ waitUntil: 'networkidle0' }); await sleep(500);
check('dark mode: page keeps light background', (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(250, 247, 242)');
check('dark mode: colour-scheme declared light only', (await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).includes('light'));
await page.emulateMediaFeatures([]);

// ---------- 24. custom colour: the 13th swatch (round 6) ----------
await page.goto(URL_BASE + '#/projects', { waitUntil: 'networkidle0' }); await sleep(400);
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.proj-card')].find((c) => c.textContent.includes('Deck oiling'));
  card.querySelector('[aria-label^="Options for"]').click();
}); await sleep(300);
await clickText('.sheet-item', 'Change colour'); await sleep(300);
check('custom swatch is the 13th option', (await page.$$eval('.swatch', (els) => els.length)) === 13 && !!(await page.$('.swatch-custom input[type=color]')));
await page.evaluate(() => {
  const i = document.querySelector('.swatch-custom input[type=color]');
  const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  s.call(i, '#1c2d5e'); // deep navy — must come out pastel, ink text readable
  i.dispatchEvent(new Event('input', { bubbles: true }));
  i.dispatchEvent(new Event('change', { bubbles: true }));
}); await sleep(400);
check('custom pick keeps the sheet open to fiddle', !!(await page.$('.sheet')));
check('custom swatch shows as selected', !!(await page.$('.swatch-custom.sel')));
await page.evaluate(() => document.querySelector('.sheet-backdrop').click()); await sleep(300);
const customBg = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.proj-card')].find((c) => c.textContent.includes('Deck oiling'));
  return getComputedStyle(card).backgroundColor;
});
check('project card wears her own colour', !pastelBlooms.includes(customBg), customBg);
check('her pick is pastelised so text stays readable', (() => {
  const [r, g, b] = customBg.match(/\d+/g).map(Number);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255 > 0.6;
})(), customBg);
await page.reload({ waitUntil: 'networkidle0' }); await sleep(600);
check('custom colour survives a refresh', (await page.evaluate(() => {
  const card = [...document.querySelectorAll('.proj-card')].find((c) => c.textContent.includes('Deck oiling'));
  return getComputedStyle(card).backgroundColor;
})) === customBg);

// ---------- 25. Today: dateless tasks under "Ready when you are" (round 6) ----------
await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle0' }); await sleep(400);
await clickText('.new-proj-inline', 'New project'); await sleep(300);
await page.type('.sheet input[type=text]', 'Anytime jobs');
await clickText('button', 'Create project'); await sleep(500);
await page.type('.quickadd input', 'Sort the shed');
await clickText('.quickadd button', 'Add'); await sleep(300);
await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle0' }); await sleep(400);
t = await text();
check('dateless task shows under Ready when you are', /ready when you are/i.test(t) && t.includes('Sort the shed'));
check('urgent groups still come first', t.toLowerCase().indexOf('running late') !== -1 && t.toLowerCase().indexOf('running late') < t.toLowerCase().indexOf('ready when you are'));
// and Guide Me still offers the same dateless task
await page.goto(URL_BASE + '#/guide', { waitUntil: 'networkidle0' }); await sleep(400);
if ((await text()).includes('How are you feeling')) {
  await clickText('.energy-card', 'Full of beans'); await sleep(400);
} else {
  await clickText('button', 'Feeling different?'); await sleep(300);
  await clickText('.energy-card', 'Full of beans'); await sleep(400);
}
check('Guide Me offers the dateless task too', (await text()).includes('Sort the shed'));

await browser.close();
console.log(failures === 0 ? '\nE2E ALL PASS' : `\n${failures} E2E FAILURES`);
process.exit(failures === 0 ? 0 : 1);
