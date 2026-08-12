'use strict';

const { readSource } = require('./store.js');

const EVENT_SOURCES = ['mugla.bel.tr', 'bodrum.bel.tr'];
const TR_MONTH_NAMES = [
	'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
	'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function monthName(isoDate) {
	return TR_MONTH_NAMES[parseInt(isoDate.slice(5, 7), 10) - 1];
}

function dayOf(isoDate) {
	return String(parseInt(isoDate.slice(8, 10), 10));
}

function formatRange(startDate, endDate) {
	if (endDate === startDate) {
		return `${dayOf(startDate)} ${monthName(startDate)}`;
	}
	if (startDate.slice(0, 7) === endDate.slice(0, 7)) {
		return `${dayOf(startDate)}-${dayOf(endDate)} ${monthName(startDate)}`;
	}
	return `${dayOf(startDate)} ${monthName(startDate)} - ${dayOf(endDate)} ${monthName(endDate)}`;
}

function formatOngoing(endDate) {
	return `${dayOf(endDate)} ${monthName(endDate)}'a kadar`;
}

function sortKey(event, today) {
	return event.startDate < today ? `1:${event.endDate}` : `0:${event.startDate}`;
}

// Kaçışlama bir URL şemasını etkisizleştirmez; `javascript:` şemalı bir href
// render edilirse tıklanabilir bir XSS olur. Son durakta süzülür ki gelecekte
// eklenecek parser'lar da kapsansın.
function isSafeUrl(url) {
	return typeof url === 'string' && url.startsWith('https://');
}

function buildEventRows(store, { nowMs, today, maxItems, showDistrictBadge }) {
	const events = EVENT_SOURCES
		.map(source => readSource(store, source, nowMs))
		.filter(Boolean)
		.flatMap(record => record.items)
		.filter(event => event.endDate >= today)
		.filter(event => isSafeUrl(event.url))
		.sort((a, b) => {
			const aKey = sortKey(a, today);
			const bKey = sortKey(b, today);
			if (aKey !== bKey) {
				return aKey < bKey ? -1 : 1;
			}
			if (a.endDate !== b.endDate) {
				return a.endDate < b.endDate ? -1 : 1;
			}
			return 0;
		})
		.slice(0, maxItems);

	if (!events.length) {
		return null;
	}

	return events.map(event => ({
		title: event.title,
		url: event.url,
		dateLabel: event.startDate < today ?
			formatOngoing(event.endDate) :
			formatRange(event.startDate, event.endDate),
		badge: showDistrictBadge && event.district && event.district !== 'Menteşe' ? event.district : null,
	}));
}

// `publishedAt` null olabilir (MSKÜ listesinde tarih her satırda görünmüyor).
// Naif bir `a > b ? -1 : 1` karşılaştırıcısı null'larla GEÇERLİ BİR SIRALAMA
// TANIMLAMAZ: JS'te hem `'2026-08-10' > null` hem `null > '2026-08-10'` false
// döner, sonuç girdi sırasına göre değişir ve tarihsiz bir duyuru listenin
// başına geçebilir. Bu, Task 4'teki `sortAnnouncements` ile aynı kuraldır:
// tarihliler azalan sırada önce, tarihsizler kaynak sırasını koruyarak sonra.
function sortAnnouncements(items) {
	return items
		.map((item, index) => ({ item, index }))
		.sort((a, b) => {
			const aDate = a.item.publishedAt;
			const bDate = b.item.publishedAt;
			if (aDate && bDate && aDate !== bDate) {
				return aDate < bDate ? 1 : -1;
			}
			if (aDate && !bDate) {
				return -1;
			}
			if (!aDate && bDate) {
				return 1;
			}
			return a.index - b.index;
		})
		.map(entry => entry.item);
}

function buildAnnouncementRows(store, { nowMs, maxItems }) {
	const record = readSource(store, 'mu.edu.tr', nowMs);
	if (!record) {
		return null;
	}

	const rows = sortAnnouncements(record.items.filter(item => isSafeUrl(item.url)))
		.slice(0, maxItems)
		.map(item => ({
			title: item.title,
			url: item.url,
			dateLabel: item.publishedAt ? `${dayOf(item.publishedAt)} ${monthName(item.publishedAt)}` : '',
			badge: null,
		}));

	if (!rows.length) {
		return null;
	}

	return rows;
}

module.exports = { buildEventRows, buildAnnouncementRows };
