'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWidget, isSafeUrl, formatDate } = require('../lib/view.js');
const { mergePayload, STALE_MS } = require('../lib/store.js');

const T0 = 1_760_000_000_000;
const OPTS = { nowMs: T0, maxItems: 5 };

const UNITS = [
	{ id: 'muhendislik', name: 'Mühendislik Fakültesi', kind: 'faculty' },
	{ id: 'bilgisayar', name: 'Bilgisayar Mühendisliği', kind: 'dept', parent: 'muhendislik' },
	{ id: 'yazilim', name: 'Yazılım Mühendisliği', kind: 'dept', parent: 'muhendislik' },
	{ id: 'egitim', name: 'Eğitim Fakültesi', kind: 'faculty' },
];

function ann(id, unit, date, url) {
	return {
		id: `mu:${id}`, unit, title: `Duyuru ${id}`,
		publishedAt: date, url: url || `https://${unit}.mu.edu.tr/tr/duyuru/x-${id}`,
	};
}

function storeWith(announcements, fetchedAt) {
	const at = fetchedAt === undefined ? T0 : fetchedAt;
	const status = {};
	for (const a of announcements) status[a.unit] = 'ok';
	return mergePayload({}, { generatedAt: '', units: UNITS, announcements, sourceStatus: status }, at);
}

test('formatDate Türkçe ay adı verir', () => {
	assert.equal(formatDate('2026-08-13'), '13 Ağustos');
	assert.equal(formatDate(null), '');
});

test('isSafeUrl yalnızca https kabul eder', () => {
	assert.equal(isSafeUrl('https://x.mu.edu.tr/a'), true);
	assert.equal(isSafeUrl('http://x.mu.edu.tr/a'), false);
	assert.equal(isSafeUrl('javascript:alert(1)'), false);
});

test('veri yoksa null döner (widget gizlenir)', () => {
	assert.equal(buildWidget({}, OPTS), null);
});

test('duyurular en yeniden eskiye sıralanır', () => {
	const data = buildWidget(storeWith([
		ann(1, 'muhendislik', '2026-08-01'),
		ann(2, 'bilgisayar', '2026-08-10'),
	]), OPTS);
	assert.deepEqual(data.rows.map(r => r.title), ['Duyuru 2', 'Duyuru 1']);
});

test('rows maxItems ile sınırlanır, items TAMAMINI taşır', () => {
	// items istemci tarafi filtreleme icin gerekli; kirpilirsa bir bolum
	// secildiginde o bolumun duyurulari kaybolur.
	const list = ['1', '2', '3', '4', '5', '6', '7'].map((n, i) => ann(n, 'muhendislik', `2026-08-0${i + 1}`));
	const data = buildWidget(storeWith(list), OPTS);
	assert.equal(data.rows.length, 5);
	assert.equal(data.items.length, 7);
});

test('açılır liste fakülteleri grup, bölümleri seçenek yapar', () => {
	const data = buildWidget(storeWith([
		ann(1, 'muhendislik', '2026-08-01'),
		ann(2, 'bilgisayar', '2026-08-02'),
		ann(3, 'yazilim', '2026-08-03'),
	]), OPTS);

	assert.equal(data.groups.length, 1);
	assert.equal(data.groups[0].label, 'Mühendislik Fakültesi');
	assert.deepEqual(data.groups[0].options.map(o => o.id), ['muhendislik', 'bilgisayar', 'yazilim']);
	assert.match(data.groups[0].options[0].name, /genel/);
});

test('duyurusu olmayan birim açılır listede görünmez', () => {
	// Olu secenek gosterilmez: ogrenci secip bos liste gormemeli.
	const data = buildWidget(storeWith([ann(1, 'bilgisayar', '2026-08-02')]), OPTS);
	const ids = data.groups.flatMap(g => g.options.map(o => o.id));
	assert.deepEqual(ids, ['bilgisayar']);
	assert.ok(!ids.includes('yazilim'));
	assert.ok(!ids.includes('egitim'));
});

test('yalnızca bölümü olan fakülte grup olarak yine görünür', () => {
	const data = buildWidget(storeWith([ann(1, 'yazilim', '2026-08-02')]), OPTS);
	assert.equal(data.groups[0].label, 'Mühendislik Fakültesi');
	assert.deepEqual(data.groups[0].options.map(o => o.id), ['yazilim']);
});

test('güvensiz URL taşıyan satırlar elenir', () => {
	const data = buildWidget(storeWith([
		ann(1, 'muhendislik', '2026-08-01', 'javascript:alert(1)'),
		ann(2, 'bilgisayar', '2026-08-02'),
	]), OPTS);
	assert.equal(data.items.length, 1);
	assert.equal(data.items[0].title, 'Duyuru 2');
});

test('tüm satırlar güvensizse widget gizlenir', () => {
	assert.equal(buildWidget(storeWith([
		ann(1, 'muhendislik', '2026-08-01', 'javascript:alert(1)'),
	]), OPTS), null);
});

test('bayat veri gizlenir', () => {
	const store = storeWith([ann(1, 'muhendislik', '2026-08-01')], T0 - STALE_MS - 1);
	assert.equal(buildWidget(store, OPTS), null);
});

test('her satır birim kimliğini taşır (istemci filtresi buna dayanıyor)', () => {
	const data = buildWidget(storeWith([
		ann(1, 'muhendislik', '2026-08-01'),
		ann(2, 'bilgisayar', '2026-08-02'),
	]), OPTS);
	assert.deepEqual(data.items.map(i => i.unit).sort(), ['bilgisayar', 'muhendislik']);
});

test('tarihsiz duyurular sona düşer, girdi sırasından bağımsız', () => {
	const dated = ann(1, 'muhendislik', '2026-08-10');
	const older = ann(2, 'muhendislik', '2026-08-01');
	const undated = ann(3, 'muhendislik', null);
	const ids = order => buildWidget(storeWith(order), OPTS).items.map(i => i.title);
	assert.deepEqual(ids([dated, undated, older]), ['Duyuru 1', 'Duyuru 2', 'Duyuru 3']);
	assert.deepEqual(ids([undated, dated, older]), ['Duyuru 1', 'Duyuru 2', 'Duyuru 3']);
});

test('seçili birim SUNUCUDA uygulanır — istemciye iş kalmaz', () => {
	// Sicramanin kok nedeni buydu: sunucu "Tüm birimler" basip istemci sonra
	// degistiriyordu. Artik tercih cerezle sunucuya ulasiyor.
	const data = buildWidget(storeWith([
		ann(1, 'muhendislik', '2026-08-01'),
		ann(2, 'bilgisayar', '2026-08-02'),
		ann(3, 'bilgisayar', '2026-08-03'),
	]), { ...OPTS, selectedUnit: 'bilgisayar' });

	assert.equal(data.selected, 'bilgisayar');
	assert.deepEqual(data.rows.map(r => r.title), ['Duyuru 3', 'Duyuru 2']);
});

test('seçili birimde satırlarda birim adı tekrarlanmaz', () => {
	const data = buildWidget(storeWith([ann(1, 'bilgisayar', '2026-08-02')]), {
		...OPTS, selectedUnit: 'bilgisayar',
	});
	assert.equal(data.rows[0].unitName, '');
});

test('items birim adını HER ZAMAN taşır (kullanıcı Tümü\'ne dönebilir)', () => {
	const data = buildWidget(storeWith([
		ann(1, 'muhendislik', '2026-08-01'),
		ann(2, 'bilgisayar', '2026-08-02'),
	]), { ...OPTS, selectedUnit: 'bilgisayar' });
	assert.deepEqual(data.items.map(i => i.unitName).sort(), ['Bilgisayar Mühendisliği', 'Mühendislik Fakültesi']);
});

test('seçili birim açılır listede işaretlenir', () => {
	const data = buildWidget(storeWith([
		ann(1, 'muhendislik', '2026-08-01'),
		ann(2, 'bilgisayar', '2026-08-02'),
	]), { ...OPTS, selectedUnit: 'bilgisayar' });
	const opts = data.groups.flatMap(g => g.options);
	assert.equal(opts.find(o => o.id === 'bilgisayar').selected, true);
	assert.equal(opts.find(o => o.id === 'muhendislik').selected, false);
});

test('artık veri taşımayan birim seçiliyse Tümü\'ne düşer', () => {
	// O birimin sitesi coktuyse bos liste gostermek yerine hepsini goster.
	const data = buildWidget(storeWith([ann(1, 'muhendislik', '2026-08-01')]), {
		...OPTS, selectedUnit: 'yazilim',
	});
	assert.equal(data.selected, '');
	assert.equal(data.rows.length, 1);
	assert.equal(data.rows[0].unitName, 'Mühendislik Fakültesi');
});
