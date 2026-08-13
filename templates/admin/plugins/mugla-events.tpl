<div class="acp-page-container">
	<div class="row">
		<div class="col-12">
			<form role="form" class="mugla-events-settings">
				<div class="mb-3">
					<label class="form-label" for="endpointUrl">n8n webhook adresi</label>
					<input type="text" id="endpointUrl" name="endpointUrl" class="form-control"
						placeholder="https://n8n.example.com/webhook/mskuforum-events" />
				</div>
				<div class="mb-3">
					<label class="form-label" for="token">Erişim anahtarı (X-Events-Token)</label>
					<input type="text" id="token" name="token" class="form-control" />
				</div>
				<div class="mb-3">
					<label class="form-label" for="refreshMinutes">Yenileme aralığı (dakika)</label>
					<input type="number" id="refreshMinutes" name="refreshMinutes" class="form-control" value="60" min="1" />
				</div>
				<div class="mb-3">
					<label class="form-label" for="maxItems">Widget başına satır</label>
					<input type="number" id="maxItems" name="maxItems" class="form-control" value="5" min="0" />
				</div>
				</form>
			<button id="save" class="btn btn-primary">Kaydet</button>
		</div>
	</div>
</div>
