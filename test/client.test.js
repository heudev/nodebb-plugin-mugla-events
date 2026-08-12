'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchPayload } = require('../lib/client.js');

const VALID = {
	generatedAt: '2026-08-12T14:00:00.000Z',
	events: [],
	announcements: [],
	sourceStatus: { 'mugla.bel.tr': 'ok', 'bodrum.bel.tr': 'ok', 'mu.edu.tr': 'ok' },
};

function fakeFetch(response) {
	return async (url, options) => {
		fakeFetch.lastCall = { url, options };
		return response;
	};
}

function jsonResponse(body, status) {
	return {
		ok: (status || 200) < 400,
		status: status || 200,
		json: async () => body,
	};
}

test('geçerli payload döner ve token başlığını gönderir', async () => {
	const impl = fakeFetch(jsonResponse(VALID));
	const payload = await fetchPayload({
		url: 'https://n8n.example.com/webhook/mskuforum-events',
		token: 'gizli',
		timeoutMs: 5000,
		fetchImpl: impl,
	});

	assert.deepEqual(payload, VALID);
	assert.equal(fakeFetch.lastCall.options.headers['X-Events-Token'], 'gizli');
});

test('url boşsa hata fırlatır', async () => {
	await assert.rejects(
		() => fetchPayload({ url: '', token: 't', timeoutMs: 100, fetchImpl: fakeFetch(jsonResponse(VALID)) }),
		/endpoint/i
	);
});

test('HTTP hatasında hata fırlatır', async () => {
	await assert.rejects(
		() => fetchPayload({ url: 'https://x/y', token: 't', timeoutMs: 100, fetchImpl: fakeFetch(jsonResponse({ error: 'unauthorized' }, 401)) }),
		/401/
	);
});

test('bozuk JSON gövdesinde hata fırlatır', async () => {
	const impl = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bozuk'); } });
	await assert.rejects(
		() => fetchPayload({ url: 'https://x/y', token: 't', timeoutMs: 100, fetchImpl: impl }),
		/bozuk/
	);
});

test('beklenen alanları taşımayan gövde reddedilir', async () => {
	await assert.rejects(
		() => fetchPayload({ url: 'https://x/y', token: 't', timeoutMs: 100, fetchImpl: fakeFetch(jsonResponse({ hello: 'world' })) }),
		/geçersiz/i
	);
});

test('zaman aşımında hata fırlatır', async () => {
	const impl = (url, options) => new Promise((resolve, reject) => {
		options.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
	});
	await assert.rejects(
		() => fetchPayload({ url: 'https://x/y', token: 't', timeoutMs: 20, fetchImpl: impl }),
		/abort/i
	);
});

test('bozuk içerikli diziler reddedilir', async () => {
	// Diziler doğru tipte ama içleri çöp. Tüketiciler alanları doğrudan
	// okuduğu için bunun istemcide durdurulması gerekir.
	const bad = [
		{ ...VALID, events: [null] },
		{ ...VALID, events: [{ id: 'mbb:1' }] },
		{ ...VALID, announcements: ['metin'] },
		{ ...VALID, sourceStatus: [] },
	];
	for (const body of bad) {
		await assert.rejects(
			() => fetchPayload({ url: 'https://x/y', token: 't', timeoutMs: 100, fetchImpl: fakeFetch(jsonResponse(body)) }),
			/geçersiz/i,
			`kabul edilmemeliydi: ${JSON.stringify(body).slice(0, 60)}`
		);
	}
});

test('geçerli içerikli diziler kabul edilir', async () => {
	const body = {
		...VALID,
		events: [{
			id: 'mbb:1', title: 'E', type: null, startDate: '2026-08-20',
			endDate: '2026-08-20', venue: null, district: null, url: 'https://x/1',
		}],
		announcements: [{ id: 'mu:1', title: 'D', publishedAt: null, url: 'https://x/2' }],
	};
	const payload = await fetchPayload({
		url: 'https://x/y', token: 't', timeoutMs: 100, fetchImpl: fakeFetch(jsonResponse(body)),
	});
	assert.equal(payload.events.length, 1);
	assert.equal(payload.announcements.length, 1);
});
