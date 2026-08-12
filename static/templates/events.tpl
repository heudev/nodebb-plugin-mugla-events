{{{ if title }}}<h5 class="widget-title fw-semibold mb-2">{title}</h5>{{{ end }}}
<ul class="mugla-events list-unstyled mb-0">
	{{{ each rows }}}
	<li class="d-flex gap-2 align-items-baseline mb-2">
		<span class="text-muted small text-nowrap">{./dateLabel}</span>
		<a href="{./url}" target="_blank" rel="noopener" class="flex-grow-1">{./title}</a>
		{{{ if ./badge }}}<span class="badge bg-secondary">{./badge}</span>{{{ end }}}
	</li>
	{{{ end }}}
</ul>
<a href="https://www.mugla.bel.tr/etkinlik" target="_blank" rel="noopener" class="small">tümü &rarr;</a>
