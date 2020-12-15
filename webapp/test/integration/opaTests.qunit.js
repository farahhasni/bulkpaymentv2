/* global QUnit */

QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/ee/BulkPayment/test/integration/AllJourneys"
	], function () {
		QUnit.start();
	});
});
