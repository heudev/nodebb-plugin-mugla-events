'use strict';

// Dizi olduğunu doğrulamak yetmez; İÇERİĞİ de doğrulanır. Payload ağdan gelen
// güvenilmez bir kaynaktır ve tüketiciler alanları doğrudan okur: store.js
// `item.unit` ile grupluyor, view.js `item.url`/`item.publishedAt` okuyor.
// `announcements: [null]` gibi bir gövde geçerse hata widget render'ında
// patlar ve bozuk veri önbelleğe yazılmış olur. Tüm payload reddedilir —
// bayat veriye düşmek, çöp veriyi kabul etmekten iyidir.
function isPlainObject(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isUnit(item) {
	return isPlainObject(item) &&
		typeof item.id === 'string' &&
		typeof item.name === 'string' &&
		(item.kind === 'faculty' || item.kind === 'dept') &&
		(item.kind === 'faculty' || typeof item.parent === 'string');
}

function isAnnouncement(item) {
	return isPlainObject(item) &&
		typeof item.id === 'string' &&
		typeof item.title === 'string' &&
		typeof item.url === 'string' &&
		typeof item.unit === 'string' &&
		(item.publishedAt === null || typeof item.publishedAt === 'string');
}

function isPayload(body) {
	return isPlainObject(body) &&
		typeof body.generatedAt === 'string' &&
		Array.isArray(body.units) &&
		body.units.length > 0 &&
		body.units.every(isUnit) &&
		Array.isArray(body.announcements) &&
		body.announcements.every(isAnnouncement) &&
		isPlainObject(body.sourceStatus);
}

async function fetchPayload({ url, token, timeoutMs, fetchImpl }) {
	if (!url) {
		return Promise.reject(new Error('mugla-events: endpoint adresi ayarlanmamış'));
	}

	const doFetch = fetchImpl || globalThis.fetch;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await doFetch(url, {
			method: 'GET',
			headers: { 'X-Events-Token': token || '', Accept: 'application/json' },
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(`mugla-events: beklenmeyen HTTP ${response.status}`);
		}

		const body = await response.json();
		if (!isPayload(body)) {
			throw new Error('mugla-events: geçersiz payload biçimi');
		}

		return body;
	} finally {
		clearTimeout(timer);
	}
}

module.exports = { fetchPayload };
