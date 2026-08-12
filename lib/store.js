'use strict';

const STALE_MS = 24 * 60 * 60 * 1000;
const RETRY_COOLDOWN_MS = 5 * 60 * 1000;

const EVENT_SOURCES = ['mugla.bel.tr', 'bodrum.bel.tr'];
const ANNOUNCEMENT_SOURCES = ['mu.edu.tr'];

// Açık eşleme; bilinmeyen kaynak `null` döner. Eski hâli tanımadığı her
// kaynağı sessizce `'mbb'` sayıyordu — EVENT_SOURCES büyüdüğünde yeni kaynağın
// etkinlikleri gürültüsüzce Muğla BB'ye yazılırdı.
const SOURCE_PREFIXES = {
	'mugla.bel.tr': 'mbb',
	'bodrum.bel.tr': 'bodrum',
};

function mergePayload(store, payload, nowMs) {
	const next = { ...(store || {}) };
	const status = (payload && payload.sourceStatus) || {};

	for (const source of EVENT_SOURCES) {
		if (status[source] === 'ok') {
			const prefix = sourcePrefix(source);
			next[source] = {
				fetchedAt: nowMs,
				events: (payload.events || []).filter(
					event => Boolean(prefix) && event.id.startsWith(`${prefix}:`)
				),
			};
		}
	}

	for (const source of ANNOUNCEMENT_SOURCES) {
		if (status[source] === 'ok') {
			next[source] = { fetchedAt: nowMs, announcements: payload.announcements || [] };
		}
	}

	return next;
}

function sourcePrefix(source) {
	return SOURCE_PREFIXES[source] || null;
}

function readSource(store, source, nowMs) {
	const record = store && store[source];
	if (!record || nowMs - record.fetchedAt > STALE_MS) {
		return null;
	}
	return {
		// Kopya döndürülür. Ham diziyi vermek, çağıranın yerinde yaptığı bir
		// `sort()`/`reverse()`/`push()` işleminin önbelleği bozması demekti;
		// ölçüldü ve doğrulandı. Kopyalama, deponun dışarıdan salt-okunur
		// görünmesini sağlar.
		items: (record.events || record.announcements || []).slice(),
		fetchedAt: record.fetchedAt,
	};
}

// Yenileme kapısı. `fetchedAt` yalnızca BAŞARILI çekimde ilerlediği için tek
// başına yetmez: hiç başarılı çekim olmadığında her sayfa gösterimi yeniden
// deneme tetikler. `lastAttemptAt` başarısız denemeleri de sayar ve iki deneme
// arasına bir taban koyar.
function shouldAttemptRefresh({ store, nowMs, refreshMs, lastAttemptAt, cooldownMs }) {
	if (nowMs - (lastAttemptAt || 0) < cooldownMs) {
		return false;
	}
	const freshest = Math.max(0, ...Object.values(store || {}).map(record => record.fetchedAt || 0));
	return nowMs - freshest >= refreshMs;
}

module.exports = { mergePayload, readSource, STALE_MS, shouldAttemptRefresh, RETRY_COOLDOWN_MS };
