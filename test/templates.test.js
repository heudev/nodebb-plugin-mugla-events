'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Kaçışlama hikayesinin tamamı Benchpress'in tek küme parantezi ile
// (`{./title}`) kaçışlama yapıp çift küme parantezi (`{{./title}}`) ile
// yapmamasına dayanır. Tek karakterlik bir değişiklik kaçışlamayı
// sessizce devre dışı bırakabilir ve hiçbir şey kırmaz.
//
// Benchpress bu paketin bağımlılığı değildir — çalışma anında NodeBB
// sağlar. Bulunabiliyorsa şablonlar gerçekten render edilip çıktı
// denetlenir. Bulunamıyorsa test ATLANMAZ: şablonların çift küme
// parantezi içermediği statik olarak doğrulanır. Aynı regresyonu yakalar,
// yalnızca daha zayıf bir kanıtla.
function loadBenchpress() {
	const candidates = [
		'benchpressjs',
		path.join(__dirname, '..', '..', 'NodeBB', 'node_modules', 'benchpressjs'),
		'/Users/enes/Development/NodeBB/node_modules/benchpressjs',
	];
	for (const candidate of candidates) {
		try {
			return require(candidate);
		} catch (err) {
			// sonraki adaya geç
		}
	}
	return null;
}

const benchpressjs = loadBenchpress();

const TEMPLATES_DIR = path.join(__dirname, '..', 'static', 'templates');

const XSS_TITLE = '<img src=x onerror=alert(1)>';
const XSS_URL = 'https://example.com/"><script>alert(1)</script>';

async function renderWithPayload(templateName, row) {
	const source = fs.readFileSync(path.join(TEMPLATES_DIR, templateName), 'utf8');
	return benchpressjs.compileRender(source, { rows: [row] });
}

test('şablonlar kaçışlamayan çift küme parantezi kullanmaz', () => {
	// Benchpress bulunamasa bile koşan güvenlik ağı.
	for (const name of ['events.tpl', 'announcements.tpl']) {
		const source = fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8');
		assert.doesNotMatch(
			source,
			/\{\{\s*\.\//,
			`${name} kaçışlamayan {{./...}} kullanıyor — scraped içerik ham basılır`
		);
	}
});

test('events.tpl scraped başlık ve url\'i kaçışlar', { skip: benchpressjs ? false : 'benchpressjs bulunamadı' }, async () => {
	const out = await renderWithPayload('events.tpl', {
		title: XSS_TITLE,
		url: XSS_URL,
		dateLabel: '20 Ağustos',
		badge: null,
	});
	assert.ok(!out.includes('<img'), `kaçışlanmamış <img bulundu:\n${out}`);
	assert.ok(!out.includes('onerror='), `kaçışlanmamış onerror= bulundu:\n${out}`);
	assert.ok(!out.includes('<script>'), `kaçışlanmamış <script> bulundu:\n${out}`);
});

test('announcements.tpl scraped başlık ve url\'i kaçışlar', { skip: benchpressjs ? false : 'benchpressjs bulunamadı' }, async () => {
	const out = await renderWithPayload('announcements.tpl', {
		title: XSS_TITLE,
		url: XSS_URL,
		dateLabel: '20 Ağustos',
	});
	assert.ok(!out.includes('<img'), `kaçışlanmamış <img bulundu:\n${out}`);
	assert.ok(!out.includes('onerror='), `kaçışlanmamış onerror= bulundu:\n${out}`);
	assert.ok(!out.includes('<script>'), `kaçışlanmamış <script> bulundu:\n${out}`);
});
