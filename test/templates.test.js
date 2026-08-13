'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Kaçışlama hikayesinin tamamı Benchpress'in tek küme parantezi ile
// (`{./title}`) kaçışlama yapıp çift küme parantezi (`{{./title}}`) ile
// yapmamasına dayanır. Tek karakterlik bir değişiklik kaçışlamayı sessizce
// devre dışı bırakabilir.
//
// Benchpress bu paketin bağımlılığı değildir — çalışma anında NodeBB sağlar.
// Bulunabiliyorsa şablon gerçekten render edilir; bulunamazsa statik denetim
// yine koşar, yani güvenlik testi sessizce kaybolmaz.
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
			// sonraki adaya gec
		}
	}
	return null;
}

const benchpressjs = loadBenchpress();
const TEMPLATE = path.join(__dirname, '..', 'static', 'templates', 'announcements.tpl');
const source = fs.readFileSync(TEMPLATE, 'utf8');

const XSS_TITLE = '<img src=x onerror=alert(1)>';
const XSS_URL = 'https://example.com/"><script>alert(1)</script>';

test('şablonda kullanıcı verisi ham basılmaz', () => {
	// itemsJson bilerek ham basiliyor (JSON blogu) ama o deger sunucuda
	// ayrica kacisliyor. Baska hicbir alan ham olmamali.
	// Once ucluleri (kontrol bloklari: each/if/end) cikar, sonra kalan ciftlere bak.
	const withoutControl = source.replace(/\{\{\{[\s\S]*?\}\}\}/g, '');
	const raw = [...withoutControl.matchAll(/\{\{\s*(?:\.\/)?[A-Za-z0-9_.]+\s*\}\}/g)].map(m => m[0]);
	const allowed = new Set(['{{itemsJson}}']);
	for (const token of raw) {
		assert.ok(allowed.has(token), `ham basılan beklenmedik alan: ${token}`);
	}
});

test('render edilen çıktıda başlık ve adres kaçışlanır', { skip: benchpressjs ? false : 'benchpressjs bulunamadı' }, async () => {
	const out = await benchpressjs.compileRender(source, {
		title: 'MSKÜ Duyuruları',
		maxItems: 5,
		groups: [{ label: 'Mühendislik', options: [{ id: 'bilgisayar', name: 'Bilgisayar' }] }],
		rows: [{ title: XSS_TITLE, url: XSS_URL, dateLabel: '13 Ağustos', unit: 'bilgisayar' }],
		itemsJson: '[]',
	});
	assert.ok(!out.includes('<img'), `kaçışlanmamış <img:\n${out}`);
	assert.ok(!out.includes('onerror='), `kaçışlanmamış onerror=:\n${out}`);
	assert.ok(!out.includes('<script>alert'), `kaçışlanmamış <script>:\n${out}`);
});

test('gömülü JSON bloğu </script> ile erken kapanamaz', { skip: benchpressjs ? false : 'benchpressjs bulunamadı' }, async () => {
	// library.js'teki toEmbeddedJson `<` karakterini < yapar. Yapmasaydi
	// scraped bir baslikta gecen </script> blogu erken kapatir ve kalan JSON
	// sayfaya HTML olarak duserdi — dogrudan XSS.
	const evil = JSON.stringify([{ title: '</script><img src=x onerror=alert(1)>', url: 'https://x/y', dateLabel: '', unit: 'a' }])
		.replace(/</g, '\\u003c');

	const out = await benchpressjs.compileRender(source, {
		title: '', maxItems: 5, groups: [], rows: [], itemsJson: evil,
	});
	const scriptBody = /<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/.exec(out);
	assert.ok(scriptBody, 'JSON bloğu bulunamadı');
	assert.ok(!scriptBody[1].includes('</script'), 'blok erken kapanmış');
	assert.ok(!out.includes('<img src=x'), 'yük HTML olarak düşmüş');
	// Kacisli hali istemcide JSON.parse ile geri cozulebilmeli.
	assert.equal(JSON.parse(scriptBody[1])[0].title, '</script><img src=x onerror=alert(1)>');
});

test('şablon istemci betiğinin dayandığı kancaları taşır', () => {
	for (const hook of ['data-msku-widget', 'data-msku-unit', 'data-msku-list', 'data-msku-data', 'data-msku-max']) {
		assert.ok(source.includes(hook), `${hook} eksik — istemci betiği buna bağlı`);
	}
});
