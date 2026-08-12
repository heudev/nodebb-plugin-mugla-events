<ul class="msku-announcements list-unstyled mb-0">
	{{{ each rows }}}
	<li class="d-flex gap-2 align-items-baseline mb-2">
		{{{ if ./dateLabel }}}<span class="text-muted small text-nowrap">{./dateLabel}</span>{{{ end }}}
		<a href="{./url}" target="_blank" rel="noopener" class="flex-grow-1">{./title}</a>
	</li>
	{{{ end }}}
</ul>
