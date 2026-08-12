'use strict';

define('admin/plugins/mugla-events', ['settings', 'alerts'], function (settings, alerts) {
	const ACP = {};

	ACP.init = function () {
		settings.load('mugla-events', $('.mugla-events-settings'));

		$('#save').on('click', function () {
			settings.save('mugla-events', $('.mugla-events-settings'), function () {
				alerts.success('Ayarlar kaydedildi. Değişikliğin görünmesi için önbellek yenilenmesini bekleyin.');
			});
		});
	};

	return ACP;
});
