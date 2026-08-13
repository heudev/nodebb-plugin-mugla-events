'use strict';

// Widget'in istemci tarafi: acilir listeden fakulte/bolum secilince listeyi
// ANINDA yeniden cizer — sunucuya gidilmez.
//
// Secim CEREZDE saklanir; sunucu cerezi okuyup ilk render'da zaten dogru
// birimi basar, dolayisiyla sayfa acilisinda icerik sicramasi olmaz ve
// JS kapaliyken de ogrenci kendi bolumunu gorur. Bu betigin isi yalnizca
// yeniden yukleme olmadan degistirmeyi saglamak.
//
// Veri, sunucunun gomdugu <script type="application/json"> blogundan okunur.
(function () {
	// Tercih CEREZDE tutulur, localStorage'da degil: sunucu cerezi okuyup daha
	// ilk render'da dogru birimi basiyor. localStorage ile once "Tüm birimler"
	// basiliyor, sonra istemci listeyi degistiriyordu — gorunur bir sicrama.
	const COOKIE = 'msku-unit';

	function readCookie() {
		const m = document.cookie.match(/(?:^|;\s*)msku-unit=([a-z0-9-]{1,40})(?:;|$)/);
		return m ? m[1] : '';
	}

	function writeCookie(value) {
		const safe = /^[a-z0-9-]{0,40}$/.test(value) ? value : '';
		document.cookie = COOKIE + '=' + safe + ';path=/;max-age=31536000;samesite=lax';
	}

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

	// Bir birim secildiginde birim adini her satirda tekrarlamak gurultu olur;
	// zaten acilir listede yaziyor.
	function rowHtml(item, showUnit, animate, index) {
		if (!isSafeUrl(item.url)) {
			return '';
		}
		const classes = ['msku-announcements__item'];
		if (item.fresh) {
			classes.push('msku-announcements__item--fresh');
		}
		if (animate) {
			classes.push('msku-announcements__item--enter');
		}
		const delay = animate ? ' style="animation-delay:' + (index * 45) + 'ms"' : '';
		const unit = showUnit && item.unitName
			? '<span class="msku-announcements__unit">' + escapeHtml(item.unitName) + '</span>'
			: '';

		return '<li class="' + classes.join(' ') + '"' + delay + '>' +
			'<a class="msku-announcements__link" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">' +
			'<span class="msku-announcements__meta">' +
			'<span class="msku-announcements__date">' + escapeHtml(item.dateLabel) + '</span>' +
			unit +
			'</span>' +
			'<span class="msku-announcements__title">' + escapeHtml(item.title) + '</span>' +
			'</a></li>';
	}

	function render(root, items, unitId, maxItems, animate) {
		const list = root.querySelector('[data-msku-list]');
		const empty = root.querySelector('[data-msku-empty]');
		const more = root.querySelector('[data-msku-more]');
		if (!list) {
			return;
		}

		const filtered = (unitId ? items.filter(i => i.unit === unitId) : items).slice(0, maxItems);
		list.innerHTML = filtered.map(function (item, i) {
			return rowHtml(item, !unitId, animate, i);
		}).join('');

		if (empty) {
			empty.classList.toggle('d-none', filtered.length > 0);
		}
		// "Tümünü gör" secili birimin kendi duyuru sayfasina gitsin.
		if (more) {
			more.href = unitId
				? 'https://' + unitId + '.mu.edu.tr/tr/duyurular'
				: 'https://www.mu.edu.tr/tr/duyurular';
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

		// Sunucu cerezi okuyup dogru birimi zaten bastigi icin ilk render'da
		// hicbir sey yeniden cizilmez. Kayitli birim artik listede yoksa
		// (o birim coktuyse) sunucu "Tüm birimler"e dusmus olur; cerezi de
		// temizleyip tutarli kalalim.
		const saved = readCookie();
		if (saved && !select.querySelector('option[value="' + saved + '"]')) {
			writeCookie('');
		}

		select.addEventListener('change', function () {
			const value = select.value;
			writeCookie(value);
			render(root, items, value, maxItems, true);
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
