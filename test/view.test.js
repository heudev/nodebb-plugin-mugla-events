'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEventRows, buildAnnouncementRows } = require('../lib/view.js');
const { STALE_MS } = require('../lib/store.js');

const T0 = 1_760_000_000_000;
const TODAY = '2026-08-12';

function event(id, startDate, endDate, district, url) {
	return {
		id, title: `Etkinlik ${id}`, type: 'Konser', startDate, endDate: endDate || startDate,
		venue: 'Yer', district: district || null, url: url || `https://example.com/${id}`,
	};
}

function storeWith(events, announcements, fetchedAt) {
	const at = fetchedAt === undefined ? T0 : fetchedAt;
	const store = {};
	if (events) {
		store['mugla.bel.tr'] = { fetchedAt: at, events };
	}
	if (announcements) {
		store['mu.edu.tr'] = { fetchedAt: at, announcements };
	}
	return store;
}

const OPTS = { nowMs: T0, today: TODAY, maxItems: 5, showDistrictBadge: true };

test('etkinlikleri başlangıç tarihine göre sıralar', () => {
	const rows = buildEventRows(storeWith([
		event('mbb:2', '2026-09-01'),
		event('mbb:1', '2026-08-20'),
	]), OPTS);
	assert.deepEqual(rows.map(row => row.title), ['Etkinlik mbb:1', 'Etkinlik mbb:2']);
});

test('süregelen etkinlik listenin tepesini işgal etmez', () => {
	// Ocak'ta başlayıp Aralık'ta biten etkinlik, ham başlangıca göre
	// sıralansaydı yılın geri kalanında birinci sırada kalırdı.
	const rows = buildEventRows(storeWith([
		event('mbb:uzun', '2026-01-14', '2026-12-31'),
		event('mbb:bugun', '2026-08-12'),
		event('mbb:yakin', '2026-08-14'),
	]), OPTS);
	assert.deepEqual(rows.map(row => row.title), [
		'Etkinlik mbb:bugun', 'Etkinlik mbb:yakin', 'Etkinlik mbb:uzun',
	]);
});

test('aynı gün anahtarında önce biten önce gelir', () => {
	const rows = buildEventRows(storeWith([
		event('mbb:gec', '2026-08-01', '2026-08-31'),
		event('mbb:erken', '2026-08-05', '2026-08-13'),
	]), OPTS);
	assert.deepEqual(rows.map(row => row.title), ['Etkinlik mbb:erken', 'Etkinlik mbb:gec']);
});

test('süregelen etkinlik başlangıç değil bitiş tarihiyle etiketlenir', () => {
	const rows = buildEventRows(storeWith([
		event('mbb:1', '2026-07-18', '2026-08-31'),
	]), OPTS);
	assert.equal(rows[0].dateLabel, '31 Ağustos\'a kadar');
});

test('maxItems kadar satır döner', () => {
	const events = ['20', '21', '22', '23', '24', '25'].map(day => event(`mbb:${day}`, `2026-08-${day}`));
	assert.equal(buildEventRows(storeWith(events), OPTS).length, 5);
});

test('bitmiş etkinlikleri render sırasında da eler', () => {
	const rows = buildEventRows(storeWith([
		event('mbb:gecmis', '2026-08-01', '2026-08-11'),
		event('mbb:gelecek', '2026-08-20'),
	]), OPTS);
	assert.deepEqual(rows.map(row => row.title), ['Etkinlik mbb:gelecek']);
});

test('Menteşe dışı ilçe rozeti alır, district null olan almaz', () => {
	const store = {
		'mugla.bel.tr': { fetchedAt: T0, events: [event('mbb:1', '2026-08-20')] },
		'bodrum.bel.tr': { fetchedAt: T0, events: [event('bodrum:1', '2026-08-21', null, 'Bodrum')] },
	};
	const rows = buildEventRows(store, OPTS);
	assert.equal(rows[0].badge, null);
	assert.equal(rows[1].badge, 'Bodrum');
});

test('rozet kapalıyken hiçbir satır rozet taşımaz', () => {
	const store = { 'bodrum.bel.tr': { fetchedAt: T0, events: [event('bodrum:1', '2026-08-21', null, 'Bodrum')] } };
	const rows = buildEventRows(store, { ...OPTS, showDistrictBadge: false });
	assert.equal(rows[0].badge, null);
});

test('tek günlük ve çok günlük etkinlik farklı etiketlenir', () => {
	const rows = buildEventRows(storeWith([
		event('mbb:1', '2026-08-20'),
		event('mbb:2', '2026-08-21', '2026-08-23'),
	]), OPTS);
	assert.equal(rows[0].dateLabel, '20 Ağustos');
	assert.equal(rows[1].dateLabel, '21-23 Ağustos');
});

test('veri yoksa null döner', () => {
	assert.equal(buildEventRows({}, OPTS), null);
});

test('bayat sınırı aşılmışsa null döner', () => {
	const store = storeWith([event('mbb:1', '2026-08-20')], null, T0 - STALE_MS - 1);
	assert.equal(buildEventRows(store, OPTS), null);
});

test('tüm etkinlikler geçmişse null döner', () => {
	const store = storeWith([event('mbb:1', '2026-08-01', '2026-08-05')]);
	assert.equal(buildEventRows(store, OPTS), null);
});

test('javascript: şemalı etkinlik url\'i elenir, https olan kalır', () => {
	const rows = buildEventRows(storeWith([
		event('mbb:kotu', '2026-08-20', null, null, 'javascript:alert(1)'),
		event('mbb:iyi', '2026-08-21'),
	]), OPTS);
	assert.deepEqual(rows.map(row => row.title), ['Etkinlik mbb:iyi']);
});

test('duyurular en yeni üstte döner', () => {
	const rows = buildAnnouncementRows(storeWith(null, [
		{ id: 'mu:1', title: 'Eski', publishedAt: '2026-08-01', url: 'https://x/1' },
		{ id: 'mu:2', title: 'Yeni', publishedAt: '2026-08-10', url: 'https://x/2' },
	]), { nowMs: T0, maxItems: 5 });
	assert.deepEqual(rows.map(row => row.title), ['Yeni', 'Eski']);
});

test('duyuru kaynağı bayatsa null döner', () => {
	const store = storeWith(null, [{ id: 'mu:1', title: 'D', publishedAt: null, url: 'https://x' }], T0 - STALE_MS - 1);
	assert.equal(buildAnnouncementRows(store, { nowMs: T0, maxItems: 5 }), null);
});

test('tarihsiz duyurular sona düşer, girdi sırasından bağımsız', () => {
	const dated = (id, date) => ({ id, title: id, publishedAt: date, url: `https://x/${id}` });
	const expected = ['yeni', 'eski', 'tarihsiz'];

	// Aynı küme, iki farklı girdi sırası. Naif karşılaştırıcı burada çuvallar.
	const datedFirst = buildAnnouncementRows(storeWith(null, [
		dated('yeni', '2026-08-10'), dated('tarihsiz', null), dated('eski', '2026-08-01'),
	]), { nowMs: T0, maxItems: 5 });
	const nullFirst = buildAnnouncementRows(storeWith(null, [
		dated('tarihsiz', null), dated('yeni', '2026-08-10'), dated('eski', '2026-08-01'),
	]), { nowMs: T0, maxItems: 5 });

	assert.deepEqual(datedFirst.map(row => row.title), expected);
	assert.deepEqual(nullFirst.map(row => row.title), expected);
});

test('javascript: şemalı duyuru url\'i elenir, https olan kalır', () => {
	const rows = buildAnnouncementRows(storeWith(null, [
		{ id: 'mu:kotu', title: 'Kötü', publishedAt: '2026-08-10', url: 'javascript:alert(1)' },
		{ id: 'mu:iyi', title: 'İyi', publishedAt: '2026-08-09', url: 'https://x/iyi' },
	]), { nowMs: T0, maxItems: 5 });
	assert.deepEqual(rows.map(row => row.title), ['İyi']);
});

test('tüm satırlar güvensiz URL taşıyorsa widget gizlenir', () => {
	const unsafe = 'javascript:alert(1)';
	const events = buildEventRows({ 'mugla.bel.tr': { fetchedAt: T0, events: [{
		id: 'mbb:1', title: 'E', type: null, startDate: '2026-08-20',
		endDate: '2026-08-20', venue: null, district: null, url: unsafe,
	}] } }, OPTS);
	const announcements = buildAnnouncementRows({ 'mu.edu.tr': { fetchedAt: T0, announcements: [
		{ id: 'mu:1', title: 'D', publishedAt: '2026-08-10', url: unsafe },
	] } }, { nowMs: T0, maxItems: 5 });

	assert.equal(events, null);
	assert.equal(announcements, null);
});
