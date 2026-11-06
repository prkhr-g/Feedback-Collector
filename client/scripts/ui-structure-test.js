import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createExportQuery, createFeedbackQuery, formatFeedbackDate } from '../src/services/adminApi.js';
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const widget = await readFile(new URL('../src/components/TurnstileWidget.jsx', import.meta.url), 'utf8');
const adminApp = await readFile(new URL('../src/components/admin/AdminApp.jsx', import.meta.url), 'utf8');
const adminDashboard = await readFile(new URL('../src/components/admin/AdminDashboard.jsx', import.meta.url), 'utf8');
const adminApi = await readFile(new URL('../src/services/adminApi.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
const adminCss = await readFile(new URL('../src/components/admin/admin.css', import.meta.url), 'utf8');

assert.match(app, /<main\b/u);
assert.match(app, /<h1 id="page-title"/u);
assert.match(app, /<form onSubmit=\{handleSubmit\} noValidate/u);
for (const id of ['name', 'email', 'feedbackType', 'message']) {
  assert.match(app, new RegExp(`htmlFor="${id}"`, 'u'));
}
assert.match(app, /RATING_OPTIONS\.map/u);
assert.match(app, /type="radio"/u);
assert.match(app, /aria-required="true"/u);
assert.match(widget, /role="group"\s+aria-labelledby="captcha-label"/u);
assert.doesNotMatch(app, /Use a prompt|usePrompt|getSuggestedPrompt/u);
assert.match(app, /onFocus=\{\(\) => \{/u);
assert.match(app, /setSuggestionsOpen\(true\)/u);
assert.match(app, /aria-autocomplete="list"/u);
assert.match(app, /role="listbox"/u);
assert.match(app, /role="option"/u);
assert.match(app, /onClick=\{\(\) => chooseSuggestion\(suggestion\)\}/u);
assert.match(app, /value=\{form\.message\}[\s\S]*?onChange=\{updateField\}/u);
assert.match(app, /function chooseSuggestion\(suggestion\)\s*\{\s*setForm\(\(current\) => \(\{ \.\.\.current, message: suggestion \}\)\)/u);
assert.match(app, /function handleSubmit\(event\)\s*\{[\s\S]*?setSuggestionsOpen\(false\)/u);
assert.match(app, /document\.addEventListener\('pointerdown', closeOnOutsidePointer\)/u);
assert.match(app, /onPointerDown=\{\(event\) => event\.preventDefault\(\)\}/u);
assert.match(app, /setSuggestionsOpen\(false\)/u);
assert.match(app, /type="submit"/u);
console.log('PASS: form exposes accessible message suggestions, selection, editable text, outside-click handling, and submit/close behavior');

assert.match(adminApp, /\/api\/auth\/me/u);
assert.match(adminApp, /\/api\/auth\/login/u);
assert.match(adminDashboard, /\/api\/admin\/dashboard\/stats/u);
assert.match(adminDashboard, /\/api\/admin\/dashboard\/charts/u);
assert.match(adminDashboard, /\/api\/admin\/feedback\?/u);
assert.match(adminDashboard, /method: 'DELETE'/u);
assert.match(adminDashboard, /role="alertdialog"|<dialog/u);
assert.match(adminApi, /credentials: 'same-origin'/u);
assert.doesNotMatch(adminApp + adminDashboard, /localStorage|sessionStorage/u);
console.log('PASS: admin UI uses session/API routes, confirms deletion, and does not store authentication tokens in web storage');

const query = new URLSearchParams(createFeedbackQuery({
  filters: { keyword: 'Ada & Co', startDate: '2025-01-01', endDate: '', feedbackType: '', rating: '5', sort: 'oldest' },
  page: 2,
  limit: 20,
}));
assert.equal(query.get('keyword'), 'Ada & Co');
assert.equal(query.get('startDate'), '2025-01-01');
assert.equal(query.get('rating'), '5');
assert.equal(query.get('page'), '2');
assert.equal(query.get('limit'), '20');
assert.equal(query.get('sort'), 'oldest');
assert.equal(query.has('endDate'), false);
const exportQuery = new URLSearchParams(createExportQuery({ keyword: 'Ada & Co', startDate: '2025-01-01', endDate: '', feedbackType: '', rating: '5', sort: 'oldest' }));
assert.equal(exportQuery.get('keyword'), 'Ada & Co');
assert.equal(exportQuery.get('rating'), '5');
assert.equal(exportQuery.get('sort'), 'oldest');
assert.equal(exportQuery.has('page'), false);
assert.equal(exportQuery.has('limit'), false);
assert.match(formatFeedbackDate('2025-01-01T00:00:00.000Z'), /UTC$/u);
console.log('PASS: admin query serialization preserves filters/paging and displays timestamps explicitly in UTC');

assert.match(css, /@media\s*\(max-width:\s*900px\)/u);
assert.match(css, /@media\s*\(max-width:\s*560px\)/u);
assert.match(css, /\.suggestion-list\s*\{[^}]*max-height:\s*164px/u);
assert.match(css, /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*?\.suggestion-list\s*\{\s*max-height:\s*138px/u);
assert.match(css, /\.suggestion-option-active/u);
assert.match(css, /prefers-reduced-motion:\s*reduce/u);
assert.match(css, /:focus-visible/u);
assert.match(adminCss, /@media\s*\(max-width:\s*680px\)/u);
assert.match(adminCss, /@media\s*\(max-width:\s*420px\)/u);
assert.match(adminCss, /:focus-visible/u);
assert.match(adminCss, /prefers-reduced-motion:\s*reduce/u);
console.log('PASS: public/admin responsive breakpoints, keyboard focus styles, and reduced-motion support exist');
