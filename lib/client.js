'use strict';

// Dizi olduğunu doğrulamak yetmez; İÇERİĞİ de doğrulanır. Payload ağdan
// gelen güvenilmez bir kaynaktır ve tüketiciler alanları doğrudan okur:
// store.js `event.id.startsWith(...)` çağırıyor, view.js `event.endDate`
// karşılaştırıyor. `events: [null]` gibi bir gövde buradan geçerse hata
// widget render'ında patlar ve bozuk veri önbelleğe yazılmış olur.
// Tüm payload reddedilir — bayat veriye düşmek, çöp veriyi kabul etmekten iyidir.
function isPlainObject(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isEvent(item) {
	return isPlainObject(item) &&
		typeof item.id === 'string' &&
		typeof item.title === 'string' &&
		typeof item.startDate === 'string' &&
		typeof item.endDate === 'string' &&
		typeof item.url === 'string';
}

function isAnnouncement(item) {
	return isPlainObject(item) &&
		typeof item.id === 'string' &&
		typeof item.title === 'string' &&
		typeof item.url === 'string';
}

function isPayload(body) {
	return isPlainObject(body) &&
		typeof body.generatedAt === 'string' &&
		Array.isArray(body.events) &&
		body.events.every(isEvent) &&
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
