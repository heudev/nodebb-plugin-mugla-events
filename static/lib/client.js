'use strict';

// Widget'in istemci tarafi: acilir listeden fakulte/bolum secilince listeyi
// ANINDA yeniden cizer — sunucuya gidilmez. Secim tarayicida saklanir, boylece
// ogrenci her girisinde kendi bolumunu gorur.
//
// Veri, sunucunun gomdugu <script type="application/json"> blogundan okunur.
// Sunucu "Tumu" gorunumunu zaten HTML olarak basiyor; JS kapaliysa da widget
// calisir, yalnizca secim yapilamaz.
(function () {
	const STORAGE_KEY = 'msku-announcements:unit';

	function escapeHtml(value) {
		return String(value == null ? '' : value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function isSafeUrl(url) {
		return typeof url === 'string' && url.indexOf('https://') === 0;
	}

	function readItems(root) {
		const node = root.querySelector('[data-msku-data]');
		if (!node) {
			return [];
		}
		try {
			const parsed = JSON.parse(node.textContent || '[]');
			return Array.isArray(parsed) ? parsed : [];
		} catch (err) {
			return [];
		}
	}

	function render(root, items, unitId, maxItems) {
		const list = root.querySelector('[data-msku-list]');
		const empty = root.querySelector('[data-msku-empty]');
		if (!list) {
			return;
		}

		const filtered = (unitId ? items.filter(i => i.unit === unitId) : items).slice(0, maxItems);

		list.innerHTML = filtered.map(function (item) {
			if (!isSafeUrl(item.url)) {
				return '';
			}
			return '<li class="d-flex gap-2 align-items-baseline mb-2">' +
				'<span class="text-muted text-nowrap">' + escapeHtml(item.dateLabel) + '</span>' +
				'<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener" class="flex-grow-1 text-body">' +
				escapeHtml(item.title) + '</a></li>';
		}).join('');

		if (empty) {
			empty.classList.toggle('d-none', filtered.length > 0);
		}
	}

	function setup(root) {
		if (root.dataset.mskuReady === '1') {
			return;
		}
		root.dataset.mskuReady = '1';

		const select = root.querySelector('[data-msku-unit]');
		if (!select) {
			return;
		}

		const items = readItems(root);
		const maxItems = parseInt(root.getAttribute('data-msku-max'), 10) || 5;

		let saved = '';
		try {
			saved = window.localStorage.getItem(STORAGE_KEY) || '';
		} catch (err) {
			saved = '';
		}

		// Kayitli birim artik listede yoksa (ornegin o birim coktuyse) "Tumu"ye
		// duseriz; aksi halde bos liste gosterirdik.
		if (saved && select.querySelector('option[value="' + saved.replace(/"/g, '') + '"]')) {
			select.value = saved;
			render(root, items, saved, maxItems);
		}

		select.addEventListener('change', function () {
			const value = select.value;
			try {
				window.localStorage.setItem(STORAGE_KEY, value);
			} catch (err) {
				// depolama kapaliysa secim yalnizca bu sayfa icin gecerli olur
			}
			render(root, items, value, maxItems);
		});
	}

	function init() {
		const roots = document.querySelectorAll('[data-msku-widget]');
		for (let i = 0; i < roots.length; i++) {
			setup(roots[i]);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	// NodeBB bir SPA; sayfa gecislerinde widget yeniden basiliyor.
	if (window.$) {
		window.$(window).on('action:ajaxify.end action:widgets.loaded', init);
	}
}());
