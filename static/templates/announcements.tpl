{{{ if title }}}<h5 class="widget-title fw-semibold mb-2">{title}</h5>{{{ end }}}
<div class="msku-announcements" data-msku-widget data-msku-max="{maxItems}">
	<select class="form-select form-select-sm mb-2 msku-announcements__select" data-msku-unit aria-label="Fakülte veya bölüm seç">
		<option value=""{{{ if allSelected }}} selected{{{ end }}}>Tüm birimler</option>
		{{{ each groups }}}
		<optgroup label="{./label}">
			{{{ each ./options }}}<option value="{./id}"{{{ if ./selected }}} selected{{{ end }}}>{./name}</option>{{{ end }}}
		</optgroup>
		{{{ end }}}
	</select>
	<ul class="msku-announcements__list" data-msku-list>
		{{{ each rows }}}
		<li class="msku-announcements__item{{{ if ./fresh }}} msku-announcements__item--fresh{{{ end }}}">
			<a class="msku-announcements__link" href="{./url}" target="_blank" rel="noopener">
				<span class="msku-announcements__meta">
					<span class="msku-announcements__date">{./dateLabel}</span>
					{{{ if ./unitName }}}<span class="msku-announcements__unit">{./unitName}</span>{{{ end }}}
				</span>
				<span class="msku-announcements__title">{./title}</span>
			</a>
		</li>
		{{{ end }}}
	</ul>
	<div class="msku-announcements__empty d-none" data-msku-empty>Bu birimde henüz duyuru yok.</div>
	<a class="msku-announcements__footer" href="https://www.mu.edu.tr/tr/duyurular" target="_blank" rel="noopener" data-msku-more>Tümünü gör →</a>
	<script type="application/json" data-msku-data>{{itemsJson}}</script>
</div>
