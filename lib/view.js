'use strict';

const { readUnits, readAnnouncements } = require('./store.js');

const TR_MONTHS = [
	'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
	'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// Son 7 gun "taze" sayilir: widget'in asil isi "harekete gecmem gereken yeni
// bir sey var mi?" sorusunu bir bakista cevaplamak.
const FRESH_DAYS = 7;

function daysBetween(fromIso, toIso) {
	const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
	const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
	return Math.round((b - a) / 86400000);
}

// Yakin tarihler kelimeyle, digerleri kisa biçimde. Ogrenci "13 Mayıs"tan
// once "Bugün"u anlar.
function formatDate(isoDate, today) {
	if (!isoDate) {
		return '';
	}
	if (today) {
		const diff = daysBetween(isoDate, today);
		if (diff === 0) {
			return 'Bugün';
		}
		if (diff === 1) {
			return 'Dün';
		}
	}
	const day = String(parseInt(isoDate.slice(8, 10), 10));
	return `${day} ${TR_MONTHS[parseInt(isoDate.slice(5, 7), 10) - 1]}`;
}

function isFresh(isoDate, today) {
	if (!isoDate || !today) {
		return false;
	}
	const diff = daysBetween(isoDate, today);
	return diff >= 0 && diff <= FRESH_DAYS;
}

// Kaçışlama bir URL şemasını etkisizleştirmez; `javascript:` şemalı bir href
// render edilirse tıklanabilir bir XSS olur. Son durakta süzülür.
function isSafeUrl(url) {
	return typeof url === 'string' && url.startsWith('https://');
}

// Tarihliler en yeniden eskiye; tarihsizler kaynak sırasını koruyarak sonda.
// Naif bir `a > b ? -1 : 1` karşılaştırıcısı null'larla geçerli bir sıralama
// tanımlamaz (JS'te `'2026-08-10' > null` ve tersi ikisi de false).
function sortByPublished(items) {
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

// Açılır liste seçenekleri: fakülteler <optgroup> başlığı, bölümler altında.
// Yalnızca veride duyurusu OLAN birimler listelenir — ölü seçenek gösterilmez.
function buildUnitGroups(units, withData) {
	const faculties = units.filter(u => u.kind === 'faculty');
	const groups = [];

	for (const faculty of faculties) {
		const depts = units.filter(u => u.kind === 'dept' && u.parent === faculty.id && withData.has(u.id));
		const facultyHasData = withData.has(faculty.id);
		if (!facultyHasData && !depts.length) {
			continue;
		}
		groups.push({
			label: faculty.name,
			options: [
				...(facultyHasData ? [{ id: faculty.id, name: `${faculty.name} (genel)` }] : []),
				...depts.map(d => ({ id: d.id, name: d.name })),
			],
		});
	}

	return groups;
}

// Dönüş `null` ise widget gizlenir. NodeBB boş `html` dönen widget'ı çıktıdan
// eler, dolayısıyla başlık ve çerçeve de görünmez.
function buildWidget(store, { nowMs, today, maxItems }) {
	const units = readUnits(store, nowMs);
	const all = sortByPublished(readAnnouncements(store, nowMs).filter(item => isSafeUrl(item.url)));

	if (!all.length || !units.length) {
		return null;
	}

	const names = new Map(units.map(u => [u.id, u.name]));
	const withData = new Set(all.map(item => item.unit).filter(Boolean));
	const groups = buildUnitGroups(units, withData);
	if (!groups.length) {
		return null;
	}

	const toRow = item => ({
		title: item.title,
		url: item.url,
		unit: item.unit || '',
		unitName: names.get(item.unit) || '',
		dateLabel: formatDate(item.publishedAt, today),
		fresh: isFresh(item.publishedAt, today),
	});

	return {
		groups,
		rows: all.slice(0, maxItems).map(toRow),
		// Istemci tarafi filtreleme icin tum kayitlar; secim degisince
		// sunucuya gidilmez.
		items: all.map(toRow),
		maxItems,
	};
}

module.exports = { buildWidget, isSafeUrl, sortByPublished, formatDate, isFresh };
