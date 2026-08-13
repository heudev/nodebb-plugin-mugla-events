'use strict';

const STALE_MS = 24 * 60 * 60 * 1000;
const RETRY_COOLDOWN_MS = 5 * 60 * 1000;
const UNITS_KEY = '__units';

// Payload birim başına durum taşır. `"error"` bildiren birimin kaydı EZİLMEZ;
// önceki iyi kaydı bayatlık sınırına kadar yaşar. Bir fakültenin sitesi çökse
// yalnızca o birim etkilenir, diğerleri normal akmaya devam eder.
function mergePayload(store, payload, nowMs) {
	const next = { ...(store || {}) };
	const status = (payload && payload.sourceStatus) || {};
	const announcements = (payload && payload.announcements) || [];

	const byUnit = new Map();
	for (const item of announcements) {
		if (!item || !item.unit) {
			continue;
		}
		if (!byUnit.has(item.unit)) {
			byUnit.set(item.unit, []);
		}
		byUnit.get(item.unit).push(item);
	}

	for (const unitId of Object.keys(status)) {
		if (status[unitId] === 'ok') {
			next[unitId] = { fetchedAt: nowMs, announcements: byUnit.get(unitId) || [] };
		}
	}

	// Kayıt defteri ayrı tutulur: bir birim geçici olarak çökse bile açılır
	// listede adıyla durmaya devam etsin diye.
	if (payload && Array.isArray(payload.units) && payload.units.length) {
		next[UNITS_KEY] = { fetchedAt: nowMs, units: payload.units };
	}

	return next;
}

function isFresh(record, nowMs) {
	return Boolean(record) && nowMs - record.fetchedAt <= STALE_MS;
}

function readUnits(store, nowMs) {
	const record = store && store[UNITS_KEY];
	return isFresh(record, nowMs) ? record.units.slice() : [];
}

// Bayat olmayan tüm birimlerin duyuruları. Kopya döndürülür; çağıran yerinde
// sort/reverse yaparsa önbellek bozulmasın.
function readAnnouncements(store, nowMs) {
	const out = [];
	for (const key of Object.keys(store || {})) {
		if (key === UNITS_KEY) {
			continue;
		}
		const record = store[key];
		if (!isFresh(record, nowMs)) {
			continue;
		}
		for (const item of record.announcements || []) {
			out.push(item);
		}
	}
	return out;
}

// `fetchedAt` yalnızca BAŞARILI çekimde ilerlediği için tek başına yetmez:
// hiç başarılı çekim olmadığında her sayfa gösterimi yeniden deneme
// tetiklerdi. `lastAttemptAt` başarısız denemeleri de sayar.
function shouldAttemptRefresh({ store, nowMs, refreshMs, lastAttemptAt, cooldownMs }) {
	if (nowMs - (lastAttemptAt || 0) < cooldownMs) {
		return false;
	}
	const times = Object.keys(store || {}).map(k => (store[k] && store[k].fetchedAt) || 0);
	const freshest = Math.max(0, ...times);
	return nowMs - freshest >= refreshMs;
}

module.exports = {
	mergePayload,
	readUnits,
	readAnnouncements,
	shouldAttemptRefresh,
	STALE_MS,
	RETRY_COOLDOWN_MS,
};
