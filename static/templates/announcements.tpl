{{{ if title }}}<h5 class="widget-title fw-semibold mb-2">{title}</h5>{{{ end }}}
<div class="msku-announcements" data-msku-widget data-msku-max="{maxItems}">
	<select class="form-select form-select-sm mb-2" data-msku-unit aria-label="Fakülte veya bölüm seç">
		<option value="">Tümü</option>
		{{{ each groups }}}
		<optgroup label="{./label}">
			{{{ each ./options }}}<option value="{./id}">{./name}</option>{{{ end }}}
		</optgroup>
		{{{ end }}}
	</select>
	<ul class="list-unstyled mb-0 small" data-msku-list>
		{{{ each rows }}}
		<li class="d-flex gap-2 align-items-baseline mb-2">
			<span class="text-muted text-nowrap">{./dateLabel}</span>
			<a href="{./url}" target="_blank" rel="noopener" class="flex-grow-1 text-body">{./title}</a>
		</li>
		{{{ end }}}
	</ul>
	<div class="text-muted small mt-2 d-none" data-msku-empty>Bu birimde duyuru yok.</div>
	<script type="application/json" data-msku-data>{{itemsJson}}</script>
</div>
