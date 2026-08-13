'use strict';

const routeHelpers = require.main.require('./src/routes/helpers');
const meta = require.main.require('./src/meta');
const db = require.main.require('./src/database');
const winston = require.main.require('winston');
const benchpressjs = require.main.require('benchpressjs');
const fs = require('node:fs/promises');
const path = require('node:path');

const { fetchPayload } = require('./lib/client.js');
const { mergePayload, shouldAttemptRefresh, RETRY_COOLDOWN_MS } = require('./lib/store.js');
const { buildWidget } = require('./lib/view.js');

const plugin = module.exports;

const CACHE_KEY = 'mugla-events:cache';
const MEMO_MS = 60 * 1000;

const DEFAULTS = {
	endpointUrl: '',
	token: '',
	refreshMinutes: 60,
	maxItems: 5,
};

let memo = { at: 0, store: null };
let refreshing = false;
let lastAttemptAt = 0;

// `parseInt(x, 10) || fallback` açıkça girilmiş 0 değerini yutar: maxItems=0
// (widget'ı gizle) sessizce 5'e dönerdi.
function toNumber(value, fallback) {
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

// `toISOString()` UTC tarihini verir; Türkiye sabit UTC+3 olduğu için her gece
// 00:00-03:00 arasında "bugün" bir gün geride kalır ve dünkü duyuru "Bugün"
// diye etiketlenirdi.
function istanbulToday(date) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(date);
}

async function loadStore() {
	if (memo.store && Date.now() - memo.at < MEMO_MS) {
		return memo.store;
	}
	const raw = await db.getObjectField(CACHE_KEY, 'store');
	const store = raw ? JSON.parse(raw) : {};
	memo = { at: Date.now(), store };
	return store;
}

async function refreshInBackground() {
	if (refreshing) {
		return;
	}
	refreshing = true;
	try {
		const settings = await plugin.getSettings();
		const store = await loadStore();
		const should = shouldAttemptRefresh({
			store,
			nowMs: Date.now(),
			refreshMs: settings.refreshMinutes * 60 * 1000,
			lastAttemptAt,
			cooldownMs: RETRY_COOLDOWN_MS,
		});
		if (!should) {
			return;
		}

		lastAttemptAt = Date.now();
		const payload = await fetchPayload({
			url: settings.endpointUrl,
			token: settings.token,
			timeoutMs: 20000,
		});
		const merged = mergePayload(store, payload, Date.now());
		await db.setObjectField(CACHE_KEY, 'store', JSON.stringify(merged));
		memo = { at: Date.now(), store: merged };
	} catch (err) {
		winston.warn(`[mugla-events] yenileme başarısız: ${err.message}`);
	} finally {
		refreshing = false;
	}
}

async function renderTemplate(name, data) {
	const file = path.join(__dirname, 'static/templates', `${name}.tpl`);
	const source = await fs.readFile(file, 'utf8');
	return benchpressjs.compileRender(source, data);
}

// JSON, <script> bloğunun içine gömülüyor. `<` kaçırılmazsa gövdedeki bir
// `</script>` bloğu erkenden kapatır ve kalan JSON sayfaya HTML olarak
// düşer — kaynak içerik scraped olduğu için bu doğrudan XSS olurdu.
function toEmbeddedJson(value) {
	return JSON.stringify(value)
		.replace(/</g, '\\u003c')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}

plugin.init = async function (params) {
	const { router } = params;

	routeHelpers.setupAdminPageRoute(router, '/admin/plugins/mugla-events', [], (req, res) => {
		res.render('admin/plugins/mugla-events', { title: 'MSKÜ Duyuruları' });
	});
};

plugin.addAdminNavigation = async function (header) {
	header.plugins.push({
		route: '/plugins/mugla-events',
		icon: 'fa-bullhorn',
		name: 'MSKÜ Duyuruları',
	});
	return header;
};

plugin.getSettings = async function () {
	const saved = await meta.settings.get('mugla-events');
	return {
		endpointUrl: saved.endpointUrl || DEFAULTS.endpointUrl,
		token: saved.token || DEFAULTS.token,
		refreshMinutes: toNumber(saved.refreshMinutes, DEFAULTS.refreshMinutes),
		maxItems: toNumber(saved.maxItems, DEFAULTS.maxItems),
	};
};

plugin.defineWidgets = async function (widgets) {
	widgets.push({
		widget: 'mskuAnnouncements',
		name: 'MSKÜ Duyuruları',
		description: 'Fakülte/bölüm seçilebilen duyuru listesi',
		content: '',
	});
	return widgets;
};

plugin.renderAnnouncements = async function (widget) {
	refreshInBackground();

	const settings = await plugin.getSettings();
	const store = await loadStore();
	const now = new Date();
	const data = buildWidget(store, {
		nowMs: now.getTime(),
		today: istanbulToday(now),
		maxItems: settings.maxItems,
	});

	if (!data) {
		// Veri yoksa widget tamamen gizlenir; boş kutu gösterilmez.
		widget.html = '';
		return widget;
	}

	widget.html = await renderTemplate('announcements', {
		title: widget.data.title || '',
		groups: data.groups,
		rows: data.rows,
		maxItems: settings.maxItems,
		itemsJson: toEmbeddedJson(data.items),
	});
	return widget;
};
