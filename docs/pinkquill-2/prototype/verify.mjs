// DOM-level behavior checks for the isolated prototype. Does not launch a browser
// or connect to a real Pinkquill account. Visual/native-browser checks are separate.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('./prototype.js', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://prototype.local/#home', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.scrollTo = () => {};
// JSDOM has no layout or native dialog behavior. Model those boundaries, while
// exercising the prototype's actual event handlers and DOM, rather than globals.
window.HTMLElement.prototype.getClientRects = function () { return this.hidden ? [] : [{ width: 100, height: 44 }]; };
window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector('button')?.focus(); };
window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
window.Audio = class extends window.EventTarget {
  currentTime = 0; paused = true;
  play() { this.paused = false; this.dispatchEvent(new window.Event('play')); return Promise.resolve(); }
  pause() { this.paused = true; this.dispatchEvent(new window.Event('pause')); }
};
window.eval(source);
const tests = [];
const check = (name, fn) => { fn(); tests.push(name); };
const click = selector => {
  const element = document.querySelector(selector);
  assert.ok(element, `Missing element: ${selector}`);
  element.click();
};
const input = (selector, value) => {
  const element = document.querySelector(selector);
  assert.ok(element, `Missing input: ${selector}`);
  element.value = value;
  element.dispatchEvent(new window.Event('input', { bubbles: true }));
};
const navigate = route => { window.location.hash = route; window.dispatchEvent(new window.HashChangeEvent('hashchange')); };
const submit = selector => document.querySelector(selector).dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
const close = () => click('#overlay [data-action="close"]');

check('Gallery uses the same DOM and visual reading sequence', () => {
  assert.deepEqual([...document.querySelectorAll('#main [data-post]')].map(el => el.dataset.post), ['sunroom', 'movement', 'afterglow', 'small-things', 'first-try', 'clay', 'acting']);
});
check('Save toggles preserve keyboard focus and accessible state', () => {
  document.querySelector('[data-post="sunroom"] [data-action="save"]').focus();
  click('[data-post="sunroom"] [data-action="save"]');
  assert.equal(document.activeElement.dataset.action, 'save');
  assert.equal(document.activeElement.getAttribute('aria-pressed'), 'true');
});
check('Dialog Tab and Shift+Tab wrap inside the dialog', () => {
  click('.create-button');
  const dialog = document.querySelector('dialog');
  const first = dialog.querySelector('[data-action="close"]');
  first.focus();
  first.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  assert.equal(document.activeElement.dataset.id, '/sell/service');
  document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  assert.equal(document.activeElement, first);
});
check('Draft text survives medium changes, closing, and reopening', () => {
  click('#overlay [data-action="compose"]');
  input('[name="title"]', 'A beginning');
  input('[name="body"]', 'A little time for something I love.');
  click('[data-action="format"][data-id="Audio"]');
  assert.equal(document.querySelector('[name="title"]').value, 'A beginning');
  assert.equal(document.querySelector('[name="body"]').value, 'A little time for something I love.');
  assert.equal(document.querySelector('input[type="file"]').getAttribute('accept'), 'audio/*');
  click('[data-action="save-draft"]');
  click('.composer-prompt');
  assert.equal(document.querySelector('[name="title"]').value, 'A beginning');
  close();
});
check('Menu arrows traverse actions and Escape restores its trigger', () => {
  click('[data-post="sunroom"] [data-action="post-menu"]');
  document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  assert.equal(document.activeElement.dataset.action, 'report');
  document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(document.getElementById('menu').hidden, true);
  assert.equal(document.activeElement.dataset.action, 'post-menu');
});
check('Search handles text safely and links to a real sample destination', () => {
  click('.search-trigger');
  input('#search-input', 'Lina');
  assert.equal(document.querySelector('#search-results a').getAttribute('href'), '#studio/lina');
  input('#search-input', '<img src=x onerror=alert(1)>');
  assert.equal(document.querySelector('#search-results img'), null);
  close();
});
check('Visitor and owner studios retain different controls and attribution', () => {
  navigate('studio/lina');
  assert.equal(document.querySelector('h1').textContent, 'Lina Reyes');
  assert.ok(document.querySelector('[data-action="follow"]'));
  assert.equal(document.querySelector('[data-action="edit-profile"]'), null);
  assert.equal(document.querySelector('a[href="#studio/noor"]').getAttribute('aria-current'), null);
  navigate('studio/noor');
  assert.ok(document.querySelector('[data-action="edit-profile"]'));
  assert.match(document.querySelector('#main').textContent, /A little sunshine, brought home/);
});
check('Following one creator does not follow every creator', () => {
  navigate('studio/lina'); click('[data-action="follow"]');
  navigate('studio/ren');
  assert.equal(document.querySelector('[data-action="follow"]').getAttribute('aria-pressed'), 'false');
});
check('Community leave is confirmed and join state updates', () => {
  navigate('community'); click('[data-action="join"]');
  assert.ok(document.querySelector('dialog[open]'));
  click('[data-action="leave-community"]');
  assert.equal(document.querySelector('[data-action="join"]').getAttribute('aria-pressed'), 'false');
  click('[data-action="join"]');
  assert.equal(document.querySelector('[data-action="join"]').getAttribute('aria-pressed'), 'true');
});
check('Revision keeps the feedback visible and updates the order actions', () => {
  navigate('order'); click('.summary-controls [data-action="revision"]');
  input('[name="revision"]', 'Could the little bird be a deeper blue?');
  submit('[data-form="revision"]');
  assert.match(document.querySelector('#main').textContent, /Could the little bird be a deeper blue/);
  assert.match(document.querySelector('#main').textContent, /Your feedback is with Lina/);
  assert.equal(document.querySelector('.summary-controls [data-action="approve"]'), null);
});
check('Approval requires its confirmation and changes the sample order state', () => {
  click('[data-action="preview-info"]'); click('[data-action="reset-order"]');
  click('.summary-controls [data-action="approve"]');
  assert.match(document.querySelector('#main').textContent, /Submitted/);
  click('[data-action="confirm-approve"]');
  assert.match(document.querySelector('#main').textContent, /You approved the delivery/);
  assert.ok(document.querySelector('.summary-controls [data-action="review"]'));
});
check('Order messages render as text, not executable markup', () => {
  click('[data-action="order-tab"][data-id="Messages"]');
  input('[name="message"]', '<img src=x onerror=alert(1)> Thank you!');
  submit('[data-form="message"]');
  assert.match(document.querySelector('#order-tab-panel').textContent, /<img src=x onerror=alert\(1\)> Thank you!/);
  assert.equal(document.querySelector('#order-tab-panel img'), null);
});
check('Error-state retry restores usable content', () => {
  navigate('home'); click('#state-button'); click('#state-button'); click('#state-button');
  assert.match(document.querySelector('h2').textContent, /couldn’t load/);
  click('[data-action="populated"]');
  assert.equal(document.querySelectorAll('#main [data-post]').length, 7);
});
console.log(`PASS: ${tests.length} prototype behavior checks`);
tests.forEach(name => console.log(`  ✓ ${name}`));
dom.window.close();
