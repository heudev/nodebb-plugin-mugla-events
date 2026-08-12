'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mergePayload, readSource, STALE_MS, shouldAttemptRefresh, RETRY_COOLDOWN_MS } = require('../lib/store.js');

const T0 = 1_760_000_000_000;

function payload(status, events, announcements) {
	return {
		generatedAt: new Date(T0).toISOString(),
		events: events || [],
		announcements: announcements || [],
		sourceStatus: status,
	};
}

const OK_ALL = {
	'mugla.bel.tr': 'ok', 'bodrum.bel.tr': 'ok', 'mu.edu.tr': 'ok',
};

test('STALE_MS 24 saattir', () => {
	assert.equal(STALE_MS, 24 * 60 * 60 * 1000);
});

test('ok kaynakları yazar', () => {
	const store = mergePayload({}, payload(OK_ALL,
		[{ id: 'mbb:1', startDate: '2026-08-20', endDate: '2026-08-20' }],
		[{ id: 'mu:1', title: 'D', publishedAt: null, url: 'https://x' }]), T0);

	assert.equal(store['mugla.bel.tr'].fetchedAt, T0);
	assert.equal(store['mugla.bel.tr'].events.length, 1);
	assert.equal(store['mu.edu.tr'].announcements.length, 1);
});

test('error kaynağı önceki iyi kaydı ezmez', () => {
	const first = mergePayload({}, payload(OK_ALL, [], [{ id: 'mu:1', title: 'Eski', publishedAt: null, url: 'https://x' }]), T0);
	const second = mergePayload(first, payload(
		{ ...OK_ALL, 'mu.edu.tr': 'error' }, [], []
	), T0 + 60_000);

	assert.equal(second['mu.edu.tr'].fetchedAt, T0);
	assert.equal(second['mu.edu.tr'].announcements[0].title, 'Eski');
});

test('mergePayload girdiyi değiştirmez', () => {
	const original = {};
	mergePayload(original, payload(OK_ALL, [{ id: 'mbb:1' }]), T0);
	assert.deepEqual(original, {});
});

test('readSource taze kaydı döner', () => {
	const store = mergePayload({}, payload(OK_ALL, [{ id: 'mbb:1' }]), T0);
	const read = readSource(store, 'mugla.bel.tr', T0 + 1000);
	assert.equal(read.items.length, 1);
	assert.equal(read.fetchedAt, T0);
});

test('readSource bayat sınırında hâlâ veri döner', () => {
	const store = mergePayload({}, payload(OK_ALL, [{ id: 'mbb:1' }]), T0);
	assert.notEqual(readSource(store, 'mugla.bel.tr', T0 + STALE_MS), null);
});

test('readSource bayat sınırı aşılınca null döner', () => {
	const store = mergePayload({}, payload(OK_ALL, [{ id: 'mbb:1' }]), T0);
	assert.equal(readSource(store, 'mugla.bel.tr', T0 + STALE_MS + 1), null);
});

test('readSource bilinmeyen kaynakta null döner', () => {
	assert.equal(readSource({}, 'mugla.bel.tr', T0), null);
});

test('readSource kopya döndürür, çağıran depoyu bozamaz', () => {
	const store = mergePayload({}, payload(OK_ALL,
		[{ id: 'mbb:1' }, { id: 'mbb:2' }]), T0);

	const first = readSource(store, 'mugla.bel.tr', T0);
	first.items.reverse();
	first.items.push({ id: 'mbb:SAHTE' });

	const second = readSource(store, 'mugla.bel.tr', T0);
	assert.deepEqual(second.items.map(item => item.id), ['mbb:1', 'mbb:2']);
});

test('bilinmeyen önekli etkinlik hiçbir kaynağa yazılmaz', () => {
	const store = mergePayload({}, payload(OK_ALL,
		[{ id: 'mbb:1' }, { id: 'bilinmeyen:1' }]), T0);

	assert.deepEqual(store['mugla.bel.tr'].events.map(item => item.id), ['mbb:1']);
	assert.deepEqual(store['bodrum.bel.tr'].events, []);
});

const REFRESH_MS = 60 * 60 * 1000;

test('shouldAttemptRefresh: veri yok, önceki deneme yok -> true', () => {
	assert.equal(shouldAttemptRefresh({
		store: {}, nowMs: T0, refreshMs: REFRESH_MS, lastAttemptAt: 0, cooldownMs: RETRY_COOLDOWN_MS,
	}), true);
});

test('shouldAttemptRefresh: veri yok, deneme 1 dakika önce -> false', () => {
	assert.equal(shouldAttemptRefresh({
		store: {}, nowMs: T0, refreshMs: REFRESH_MS, lastAttemptAt: T0 - 60_000, cooldownMs: RETRY_COOLDOWN_MS,
	}), false);
});

test('shouldAttemptRefresh: veri yok, deneme 6 dakika önce -> true', () => {
	assert.equal(shouldAttemptRefresh({
		store: {}, nowMs: T0, refreshMs: REFRESH_MS, lastAttemptAt: T0 - 6 * 60_000, cooldownMs: RETRY_COOLDOWN_MS,
	}), true);
});

test('shouldAttemptRefresh: taze veri -> false', () => {
	const store = mergePayload({}, payload(OK_ALL, [{ id: 'mbb:1' }]), T0);
	assert.equal(shouldAttemptRefresh({
		store, nowMs: T0 + 1000, refreshMs: REFRESH_MS, lastAttemptAt: 0, cooldownMs: RETRY_COOLDOWN_MS,
	}), false);
});

test('shouldAttemptRefresh: veri refreshMs\'den eski ve cooldown geçmiş -> true', () => {
	const store = mergePayload({}, payload(OK_ALL, [{ id: 'mbb:1' }]), T0);
	const nowMs = T0 + REFRESH_MS + RETRY_COOLDOWN_MS + 1;
	assert.equal(shouldAttemptRefresh({
		store, nowMs, refreshMs: REFRESH_MS, lastAttemptAt: 0, cooldownMs: RETRY_COOLDOWN_MS,
	}), true);
});
