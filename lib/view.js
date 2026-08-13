'use strict';

const { readUnits, readAnnouncements } = require('./store.js');

const TR_MONTHS = [
	'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
	'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function formatDate(isoDate) {
	if (!isoDate) {
		return '';
	}
	const day = String(parseInt(isoDate.slice(8, 10), 10));
	return `${day} ${TR_MONTHS[parseInt(isoDate.slice(5, 7), 10) - 1]}`;
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

function toRow(item) {
	return {
		title: item.title,
		url: item.url,
		unit: item.unit || '',
		dateLabel: formatDate(item.publishedAt),
	};
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
function buildWidget(store, { nowMs, maxItems }) {
	const units = readUnits(store, nowMs);
	const all = sortByPublished(readAnnouncements(store, nowMs).filter(item => isSafeUrl(item.url)));

	if (!all.length || !units.length) {
		return null;
	}

	const withData = new Set(all.map(item => item.unit).filter(Boolean));
	const groups = buildUnitGroups(units, withData);
	if (!groups.length) {
		return null;
	}

	return {
		groups,
		rows: all.slice(0, maxItems).map(toRow),
		// Istemci tarafi filtreleme icin tum kayitlar; secim degisince
		// sunucuya gidilmez.
		items: all.map(toRow),
		maxItems,
	};
}

module.exports = { buildWidget, isSafeUrl, sortByPublished, formatDate };
