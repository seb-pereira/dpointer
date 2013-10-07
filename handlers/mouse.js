define([
	"./utils"
], function (utils) {
	/**
	 * this module listen to mouse events and generates corresponding pointer events.
	 *
	 * http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-eventgroupings-mouseevents
	 * http://www.w3.org/TR/DOM-Level-3-Events/#events-mouseevent-event-order
	 */
	"use strict";

	var MouseEvents = {
		mousedown: "mousedown",
		mousemove: "mousemove",
		mouseout: "mouseout",
		mouseover: "mouseover",
		mouseup: "mouseup"
	};

	// indicates if the mouse is scrolling an element with CSS overflow=auto|scroll.
	var isScrolling = false;

	var MouseTracker = {
		_lastNativeEvent: null,
		_captureTarget: null,
		register: function () {
		},
		update: function (mouseEvent) {
			this._lastNativeEvent = mouseEvent;
		},
		setCapture: function (targetElement) {
			// 1. check if pointerId is active, otw throw DOMException with the name InvalidPointerId.
			if (!this._lastNativeEvent) throw "InvalidPointerId";
			// 2. at least one button must be pressed
			if (this._lastNativeEvent.buttons == 0) return false;
			// 3. set PointerCapture=true
			this._captureTarget = targetElement;
			// 4. Fire a gotpointercapture event at the targetElement
			var syntheticEvent = createPointer(utils.events.GOTCAPTURE, this._lastNativeEvent);
			var target = this._lastNativeEvent.target;
			utils.dispatchEvent(target, syntheticEvent);
			return true;
		},
		hasCapture: function () {
			return !!(this._captureTarget);
		},
		identifyTarget: function (nonCapturedElement) {
			return (this._captureTarget) || nonCapturedElement;
		},
		releaseCapture: function (targetElement, implicit) {
			// 1. check if pointerId is active, otw throw DOMException with the name InvalidPointerId.
			if (!this._lastNativeEvent) throw "InvalidPointerId";
			// 2. if pointer capture not set at targetElement, return
			if (!implicit && (this._captureTarget !== targetElement )) return false;
			// 3. release capture
			if (this._captureTarget) {
				// 4. Fire a lostpointercapture event at the targetElement
				var syntheticEvent = createPointer(utils.events.LOSTCAPTURE, this._lastNativeEvent);
				utils.dispatchEvent(this._captureTarget, syntheticEvent);
				this._captureTarget = null;
			}
			return true;
		},
		implicitReleaseCapture: function (touchId) {
			return this.releaseCapture(null, true);
		}
	};

	/**
	 * Create a synthetic pointer from a mouse event.
	 *
	 * @param pointerType
	 * @param mouseEvent
	 * @param props
	 * @returns {utils.Pointer}
	 */
	function createPointer(pointerType, mouseEvent, props) {
		props = props || {};
		// Mouse Events properties
		props.screenX = mouseEvent.screenX;
		props.screenY = mouseEvent.screenY;
		props.clientX = mouseEvent.clientX;
		props.clientY = mouseEvent.clientY;
		props.ctrlKey = mouseEvent.ctrlKey;
		props.altKey = mouseEvent.altKey;
		props.shiftKey = mouseEvent.shiftKey;
		props.metaKey = mouseEvent.metaKey;
		// normalize button/buttons values
		// http://www.w3.org/TR/pointerevents/#chorded-button-interactions
		var buttonValue = mouseEvent.button;
		var buttonsValue = (mouseEvent.buttons !== undefined ) ? mouseEvent.buttons : utils.which2buttons(mouseEvent.which);
		// buttonValue should be -1 but browsers implement with unsigned int: http://www.w3.org/TR/DOM-Level-3-Events/
		if (mouseEvent.type == "mousemove") buttonValue = 0;
		if (mouseEvent.type == "mouseup") buttonValue = 0;
		props.button = buttonValue;
		props.buttons = buttonsValue;
		props.which = buttonValue + 1;
		if (MouseTracker.hasCapture()) {  // spec §10.1
			props.relatedTarget = null;
		} else {
			props.relatedTarget = mouseEvent.relatedTarget;
		}
		// Pointer Events properties
		props.pointerId = 1;
		props.pointerType = 'mouse';
		props.isPrimary = true;
		return new utils.Pointer(pointerType, props);
	}

	/**
	 * mousedown event handler.
	 *
	 * @param e
	 */
	function mousedown(e) {
		var syntheticEvent;

		MouseTracker.update(e);

		syntheticEvent = createPointer(utils.events.DOWN, e);
		utils.dispatchEvent(e.target, syntheticEvent);

		// firefox continue to send mouse event while dragging the scrollbar:
		// if overflow CSS style is set at target element, fire a PointerCancel,
		// then track and absorb subsequent mouse events until a mouseup occurs
		var overflow = (window.getComputedStyle(e.target).overflow);
		if (overflow && (overflow == "auto" || overflow == "scroll")) {
			isScrolling = true;
			syntheticEvent = createPointer(utils.events.CANCEL, e);
			utils.dispatchEvent(e.target, syntheticEvent);
		}
	}

	/**
	 * mousemove event handler.
	 *
	 * @param e
	 */
	function mousemove(e) {
		if (isScrolling) return;
		var syntheticEvent;
		syntheticEvent = createPointer(utils.events.MOVE, e);
		utils.dispatchEvent(MouseTracker.identifyTarget(e.target), syntheticEvent);
		MouseTracker.update(e);
	}

	/**
	 * mouseout event handler.
	 *
	 * @param e
	 */
	function mouseout(e) {
		if (isScrolling || MouseTracker.hasCapture()) return;
		if (e.relatedTarget) {
			var syntheticEvent;
			syntheticEvent = createPointer(utils.events.OUT, e);
			utils.dispatchEvent(e.target, syntheticEvent);
			// generate pointerleave events
			syntheticEvent = createPointer(utils.events.LEAVE, e, {bubbles: false});
			utils.dispatchLeaveEvents(e.target, e.relatedTarget, syntheticEvent);
		}
		MouseTracker.update(e);
	}

	/**
	 * mouseover event handler.
	 *
	 * @param e
	 */
	function mouseover(e) {
		if (isScrolling || MouseTracker.hasCapture()) return;
		if (e.relatedTarget) {
			var syntheticEvent;
			syntheticEvent = createPointer(utils.events.OVER, e);
			utils.dispatchEvent(e.target, syntheticEvent);
			// generate pointerenter events
			syntheticEvent = createPointer(utils.events.ENTER, e, {bubbles: false});
			utils.dispatchEnterEvents(e.target, e.relatedTarget, syntheticEvent);
		}
		MouseTracker.update(e);
	}

	/**
	 * mouseup event handler.
	 *
	 * @param e
	 */
	function mouseup(e) {
		if (isScrolling) {
			isScrolling = false;
		} else {
			var syntheticEvent;
			syntheticEvent = createPointer(utils.events.UP, e);
			utils.dispatchEvent(e.target, syntheticEvent);
			MouseTracker.implicitReleaseCapture();
			MouseTracker.update(e);
		}
	}

	return {
		/**
		 * register mouse events handlers.
		 *
		 * @param targetElement
		 */
		registerHandlers: function (targetElement) {
			targetElement = targetElement || window.document;
			utils.addEventListener(targetElement, MouseEvents.mousedown, mousedown, true);
			utils.addEventListener(targetElement, MouseEvents.mousemove, mousemove, true);
			utils.addEventListener(targetElement, MouseEvents.mouseout, mouseout, true);
			utils.addEventListener(targetElement, MouseEvents.mouseover, mouseover, true);
			utils.addEventListener(targetElement, MouseEvents.mouseup, mouseup, true);
		},

		/**
		 * deregister mouse events handlers.
		 * @param targetElement
		 */
		deregisterHandlers: function (targetElement) {
			utils.removeEventListener(targetElement, MouseEvents.mousedown, mousedown, true);
			utils.removeEventListener(targetElement, MouseEvents.mousemove, mousemove, true);
			utils.removeEventListener(targetElement, MouseEvents.mouseout, mouseout, true);
			utils.removeEventListener(targetElement, MouseEvents.mouseover, mouseover, true);
			utils.removeEventListener(targetElement, MouseEvents.mouseup, mouseup, true);
		},

		/**
		 * set pointer capture.
		 *
		 * @param targetElement
		 * @returns {*}
		 */
		setPointerCapture: function (targetElement) {
			return MouseTracker.setCapture(targetElement);
		},

		/**
		 * release pointer capture.
		 *
		 * @param targetElement
		 * @returns {*}
		 */
		releasePointerCapture: function (targetElement) {
			return MouseTracker.releaseCapture(targetElement, false);
		}
	};
});