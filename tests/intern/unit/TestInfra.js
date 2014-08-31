/**
 * Simple unit test case to validate the test infrastructure
 */
define([
		"intern!object",
		"intern/chai!assert",
		"dpointer/events"
	], function (registerSuite, assert, dpointer) {
		// console is not defined on IE9 
		if (!window.console) {
			window.console = {};
		}
		if (!window.console.log) {
			window.console.log = function () {
			};
		}
		registerSuite({
			name: "validation",
			"test infra": function () {
				console.log("--- Test infra ok ---");
			}
		});
	}
);