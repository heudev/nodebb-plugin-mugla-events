'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
	mergePayload, readUnits, readAnnouncements, shouldAttemptRefresh,
	STALE_MS, RETRY_COOLDOWN_MS,
} = require('../lib/store.js');

const T0 = 1_760_000_000_000;
const UNITS = [
	{ id: 'muhendislik', name: 'Mühendislik Fakültesi', kind: 'faculty' },
	{ id: 'bilgisayar', name: 'Bilgisayar Mühendisliği', kind: 'dept', parent: 'muhendislik' },
];
const ann = (id, unit) => ({ id: `mu:${id}`, unit, title: `D${id}`, publishedAt: '2026-08-10', url: `https://${unit}.mu.edu.tr/x` });

function payload(status, announcements) {
	return {
		generatedAt: new Date(T0).toISOString(),
		units: UNITS,
		announcements: announcements || [],
		sourceStatus: status,
	};
}

test('STALE_MS 24 saat, RETRY_COOLDOWN_MS 5 dakika', () => {
	assert.equal(STALE_MS, 24 * 60 * 60 * 1000);
	assert.equal(RETRY_COOLDOWN_MS, 5 * 60 * 1000);
});

test('ok birimleri duyurularıyla birlikte yazar, kayıt defterini saklar', () => {
	const store = mergePayload({}, payload(
		{ muhendislik: 'ok', bilgisayar: 'ok' },
		[ann(1, 'muhendislik'), ann(2, 'bilgisayar')]
	), T0);

	assert.equal(store.muhendislik.announcements.length, 1);
	assert.equal(store.bilgisayar.announcements.length, 1);
	assert.deepEqual(readUnits(store, T0).map(u => u.id), ['muhendislik', 'bilgisayar']);
});

test('error bildiren birimin önceki iyi kaydı EZİLMEZ', () => {
	const first = mergePayload({}, payload(
		{ muhendislik: 'ok', bilgisayar: 'ok' },
		[ann(1, 'muhendislik'), ann(2, 'bilgisayar')]
	), T0);

	const second = mergePayload(first, payload(
		{ muhendislik: 'ok', bilgisayar: 'error' },
		[ann(3, 'muhendislik')]
	), T0 + 60_000);

	assert.equal(second.muhendislik.announcements[0].id, 'mu:3');
	assert.equal(second.bilgisayar.announcements[0].id, 'mu:2', 'çöken birim eski verisini korumalı');
	assert.equal(second.bilgisayar.fetchedAt, T0);
});

test('mergePayload girdiyi değiştirmez', () => {
	const original = {};
	mergePayload(original, payload({ muhendislik: 'ok' }, [ann(1, 'muhendislik')]), T0);
	assert.deepEqual(original, {});
});

test('readAnnouncements kopya döndürür, çağıran depoyu bozamaz', () => {
	const store = mergePayload({}, payload(
		{ muhendislik: 'ok' }, [ann(1, 'muhendislik'), ann(2, 'muhendislik')]
	), T0);

	const first = readAnnouncements(store, T0);
	first.reverse();
	first.push({ id: 'SAHTE' });

	assert.deepEqual(readAnnouncements(store, T0).map(a => a.id), ['mu:1', 'mu:2']);
});

test('bayat sınırında veri gelir, bir milisaniye sonrası gelmez', () => {
	const store = mergePayload({}, payload({ muhendislik: 'ok' }, [ann(1, 'muhendislik')]), T0);
	assert.equal(readAnnouncements(store, T0 + STALE_MS).length, 1);
	assert.equal(readAnnouncements(store, T0 + STALE_MS + 1).length, 0);
	assert.deepEqual(readUnits(store, T0 + STALE_MS + 1), []);
});

test('kayıt defteri duyuru okumasına karışmaz', () => {
	const store = mergePayload({}, payload({ muhendislik: 'ok' }, [ann(1, 'muhendislik')]), T0);
	// __units kaydi bir birimmis gibi okunursa undefined duyurular sizardi.
	assert.equal(readAnnouncements(store, T0).length, 1);
});

test('shouldAttemptRefresh: veri yok + hiç deneme yok -> dener', () => {
	assert.equal(shouldAttemptRefresh({
		store: {}, nowMs: T0, refreshMs: 3600_000, lastAttemptAt: 0, cooldownMs: RETRY_COOLDOWN_MS,
	}), true);
});

test('shouldAttemptRefresh: az önce denenmişse beklemeye devam', () => {
	assert.equal(shouldAttemptRefresh({
		store: {}, nowMs: T0, refreshMs: 3600_000, lastAttemptAt: T0 - 60_000, cooldownMs: RETRY_COOLDOWN_MS,
	}), false);
});

test('shouldAttemptRefresh: soğuma dolduysa yeniden dener', () => {
	assert.equal(shouldAttemptRefresh({
		store: {}, nowMs: T0, refreshMs: 3600_000, lastAttemptAt: T0 - 6 * 60_000, cooldownMs: RETRY_COOLDOWN_MS,
	}), true);
});

test('shouldAttemptRefresh: veri tazeyse denemez', () => {
	const store = mergePayload({}, payload({ muhendislik: 'ok' }, [ann(1, 'muhendislik')]), T0);
	assert.equal(shouldAttemptRefresh({
		store, nowMs: T0 + 60_000, refreshMs: 3600_000, lastAttemptAt: 0, cooldownMs: RETRY_COOLDOWN_MS,
	}), false);
});

test('shouldAttemptRefresh: veri bayatladıysa dener', () => {
	const store = mergePayload({}, payload({ muhendislik: 'ok' }, [ann(1, 'muhendislik')]), T0);
	assert.equal(shouldAttemptRefresh({
		store, nowMs: T0 + 3600_001, refreshMs: 3600_000, lastAttemptAt: 0, cooldownMs: RETRY_COOLDOWN_MS,
	}), true);
});
