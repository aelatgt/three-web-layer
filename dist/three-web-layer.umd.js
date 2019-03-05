(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('three'), require('os'), require('crypto')) :
    typeof define === 'function' && define.amd ? define(['three', 'os', 'crypto'], factory) :
    (global.threeWebLayer = factory(global.THREE,global.os,global.crypto));
}(this, (function (THREE,os,crypto) { 'use strict';

    os = os && os.hasOwnProperty('default') ? os['default'] : os;
    crypto = crypto && crypto.hasOwnProperty('default') ? crypto['default'] : crypto;

    /**
     * A collection of shims that provide minimal functionality of the ES6 collections.
     *
     * These implementations are not meant to be used outside of the ResizeObserver
     * modules as they cover only a limited range of use cases.
     */
    /* eslint-disable require-jsdoc, valid-jsdoc */
    var MapShim = (function () {
        if (typeof Map !== 'undefined') {
            return Map;
        }
        /**
         * Returns index in provided array that matches the specified key.
         *
         * @param {Array<Array>} arr
         * @param {*} key
         * @returns {number}
         */
        function getIndex(arr, key) {
            var result = -1;
            arr.some(function (entry, index) {
                if (entry[0] === key) {
                    result = index;
                    return true;
                }
                return false;
            });
            return result;
        }
        return /** @class */ (function () {
            function class_1() {
                this.__entries__ = [];
            }
            Object.defineProperty(class_1.prototype, "size", {
                /**
                 * @returns {boolean}
                 */
                get: function () {
                    return this.__entries__.length;
                },
                enumerable: true,
                configurable: true
            });
            /**
             * @param {*} key
             * @returns {*}
             */
            class_1.prototype.get = function (key) {
                var index = getIndex(this.__entries__, key);
                var entry = this.__entries__[index];
                return entry && entry[1];
            };
            /**
             * @param {*} key
             * @param {*} value
             * @returns {void}
             */
            class_1.prototype.set = function (key, value) {
                var index = getIndex(this.__entries__, key);
                if (~index) {
                    this.__entries__[index][1] = value;
                }
                else {
                    this.__entries__.push([key, value]);
                }
            };
            /**
             * @param {*} key
             * @returns {void}
             */
            class_1.prototype.delete = function (key) {
                var entries = this.__entries__;
                var index = getIndex(entries, key);
                if (~index) {
                    entries.splice(index, 1);
                }
            };
            /**
             * @param {*} key
             * @returns {void}
             */
            class_1.prototype.has = function (key) {
                return !!~getIndex(this.__entries__, key);
            };
            /**
             * @returns {void}
             */
            class_1.prototype.clear = function () {
                this.__entries__.splice(0);
            };
            /**
             * @param {Function} callback
             * @param {*} [ctx=null]
             * @returns {void}
             */
            class_1.prototype.forEach = function (callback, ctx) {
                if (ctx === void 0) { ctx = null; }
                for (var _i = 0, _a = this.__entries__; _i < _a.length; _i++) {
                    var entry = _a[_i];
                    callback.call(ctx, entry[1], entry[0]);
                }
            };
            return class_1;
        }());
    })();

    /**
     * Detects whether window and document objects are available in current environment.
     */
    var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && window.document === document;

    // Returns global object of a current environment.
    var global$1 = (function () {
        if (typeof global !== 'undefined' && global.Math === Math) {
            return global;
        }
        if (typeof self !== 'undefined' && self.Math === Math) {
            return self;
        }
        if (typeof window !== 'undefined' && window.Math === Math) {
            return window;
        }
        // eslint-disable-next-line no-new-func
        return Function('return this')();
    })();

    /**
     * A shim for the requestAnimationFrame which falls back to the setTimeout if
     * first one is not supported.
     *
     * @returns {number} Requests' identifier.
     */
    var requestAnimationFrame$1 = (function () {
        if (typeof requestAnimationFrame === 'function') {
            // It's required to use a bounded function because IE sometimes throws
            // an "Invalid calling object" error if rAF is invoked without the global
            // object on the left hand side.
            return requestAnimationFrame.bind(global$1);
        }
        return function (callback) { return setTimeout(function () { return callback(Date.now()); }, 1000 / 60); };
    })();

    // Defines minimum timeout before adding a trailing call.
    var trailingTimeout = 2;
    /**
     * Creates a wrapper function which ensures that provided callback will be
     * invoked only once during the specified delay period.
     *
     * @param {Function} callback - Function to be invoked after the delay period.
     * @param {number} delay - Delay after which to invoke callback.
     * @returns {Function}
     */
    function throttle (callback, delay) {
        var leadingCall = false, trailingCall = false, lastCallTime = 0;
        /**
         * Invokes the original callback function and schedules new invocation if
         * the "proxy" was called during current request.
         *
         * @returns {void}
         */
        function resolvePending() {
            if (leadingCall) {
                leadingCall = false;
                callback();
            }
            if (trailingCall) {
                proxy();
            }
        }
        /**
         * Callback invoked after the specified delay. It will further postpone
         * invocation of the original function delegating it to the
         * requestAnimationFrame.
         *
         * @returns {void}
         */
        function timeoutCallback() {
            requestAnimationFrame$1(resolvePending);
        }
        /**
         * Schedules invocation of the original function.
         *
         * @returns {void}
         */
        function proxy() {
            var timeStamp = Date.now();
            if (leadingCall) {
                // Reject immediately following calls.
                if (timeStamp - lastCallTime < trailingTimeout) {
                    return;
                }
                // Schedule new call to be in invoked when the pending one is resolved.
                // This is important for "transitions" which never actually start
                // immediately so there is a chance that we might miss one if change
                // happens amids the pending invocation.
                trailingCall = true;
            }
            else {
                leadingCall = true;
                trailingCall = false;
                setTimeout(timeoutCallback, delay);
            }
            lastCallTime = timeStamp;
        }
        return proxy;
    }

    // Minimum delay before invoking the update of observers.
    var REFRESH_DELAY = 20;
    // A list of substrings of CSS properties used to find transition events that
    // might affect dimensions of observed elements.
    var transitionKeys = ['top', 'right', 'bottom', 'left', 'width', 'height', 'size', 'weight'];
    // Check if MutationObserver is available.
    var mutationObserverSupported = typeof MutationObserver !== 'undefined';
    /**
     * Singleton controller class which handles updates of ResizeObserver instances.
     */
    var ResizeObserverController = /** @class */ (function () {
        /**
         * Creates a new instance of ResizeObserverController.
         *
         * @private
         */
        function ResizeObserverController() {
            /**
             * Indicates whether DOM listeners have been added.
             *
             * @private {boolean}
             */
            this.connected_ = false;
            /**
             * Tells that controller has subscribed for Mutation Events.
             *
             * @private {boolean}
             */
            this.mutationEventsAdded_ = false;
            /**
             * Keeps reference to the instance of MutationObserver.
             *
             * @private {MutationObserver}
             */
            this.mutationsObserver_ = null;
            /**
             * A list of connected observers.
             *
             * @private {Array<ResizeObserverSPI>}
             */
            this.observers_ = [];
            this.onTransitionEnd_ = this.onTransitionEnd_.bind(this);
            this.refresh = throttle(this.refresh.bind(this), REFRESH_DELAY);
        }
        /**
         * Adds observer to observers list.
         *
         * @param {ResizeObserverSPI} observer - Observer to be added.
         * @returns {void}
         */
        ResizeObserverController.prototype.addObserver = function (observer) {
            if (!~this.observers_.indexOf(observer)) {
                this.observers_.push(observer);
            }
            // Add listeners if they haven't been added yet.
            if (!this.connected_) {
                this.connect_();
            }
        };
        /**
         * Removes observer from observers list.
         *
         * @param {ResizeObserverSPI} observer - Observer to be removed.
         * @returns {void}
         */
        ResizeObserverController.prototype.removeObserver = function (observer) {
            var observers = this.observers_;
            var index = observers.indexOf(observer);
            // Remove observer if it's present in registry.
            if (~index) {
                observers.splice(index, 1);
            }
            // Remove listeners if controller has no connected observers.
            if (!observers.length && this.connected_) {
                this.disconnect_();
            }
        };
        /**
         * Invokes the update of observers. It will continue running updates insofar
         * it detects changes.
         *
         * @returns {void}
         */
        ResizeObserverController.prototype.refresh = function () {
            var changesDetected = this.updateObservers_();
            // Continue running updates if changes have been detected as there might
            // be future ones caused by CSS transitions.
            if (changesDetected) {
                this.refresh();
            }
        };
        /**
         * Updates every observer from observers list and notifies them of queued
         * entries.
         *
         * @private
         * @returns {boolean} Returns "true" if any observer has detected changes in
         *      dimensions of it's elements.
         */
        ResizeObserverController.prototype.updateObservers_ = function () {
            // Collect observers that have active observations.
            var activeObservers = this.observers_.filter(function (observer) {
                return observer.gatherActive(), observer.hasActive();
            });
            // Deliver notifications in a separate cycle in order to avoid any
            // collisions between observers, e.g. when multiple instances of
            // ResizeObserver are tracking the same element and the callback of one
            // of them changes content dimensions of the observed target. Sometimes
            // this may result in notifications being blocked for the rest of observers.
            activeObservers.forEach(function (observer) { return observer.broadcastActive(); });
            return activeObservers.length > 0;
        };
        /**
         * Initializes DOM listeners.
         *
         * @private
         * @returns {void}
         */
        ResizeObserverController.prototype.connect_ = function () {
            // Do nothing if running in a non-browser environment or if listeners
            // have been already added.
            if (!isBrowser || this.connected_) {
                return;
            }
            // Subscription to the "Transitionend" event is used as a workaround for
            // delayed transitions. This way it's possible to capture at least the
            // final state of an element.
            document.addEventListener('transitionend', this.onTransitionEnd_);
            window.addEventListener('resize', this.refresh);
            if (mutationObserverSupported) {
                this.mutationsObserver_ = new MutationObserver(this.refresh);
                this.mutationsObserver_.observe(document, {
                    attributes: true,
                    childList: true,
                    characterData: true,
                    subtree: true
                });
            }
            else {
                document.addEventListener('DOMSubtreeModified', this.refresh);
                this.mutationEventsAdded_ = true;
            }
            this.connected_ = true;
        };
        /**
         * Removes DOM listeners.
         *
         * @private
         * @returns {void}
         */
        ResizeObserverController.prototype.disconnect_ = function () {
            // Do nothing if running in a non-browser environment or if listeners
            // have been already removed.
            if (!isBrowser || !this.connected_) {
                return;
            }
            document.removeEventListener('transitionend', this.onTransitionEnd_);
            window.removeEventListener('resize', this.refresh);
            if (this.mutationsObserver_) {
                this.mutationsObserver_.disconnect();
            }
            if (this.mutationEventsAdded_) {
                document.removeEventListener('DOMSubtreeModified', this.refresh);
            }
            this.mutationsObserver_ = null;
            this.mutationEventsAdded_ = false;
            this.connected_ = false;
        };
        /**
         * "Transitionend" event handler.
         *
         * @private
         * @param {TransitionEvent} event
         * @returns {void}
         */
        ResizeObserverController.prototype.onTransitionEnd_ = function (_a) {
            var _b = _a.propertyName, propertyName = _b === void 0 ? '' : _b;
            // Detect whether transition may affect dimensions of an element.
            var isReflowProperty = transitionKeys.some(function (key) {
                return !!~propertyName.indexOf(key);
            });
            if (isReflowProperty) {
                this.refresh();
            }
        };
        /**
         * Returns instance of the ResizeObserverController.
         *
         * @returns {ResizeObserverController}
         */
        ResizeObserverController.getInstance = function () {
            if (!this.instance_) {
                this.instance_ = new ResizeObserverController();
            }
            return this.instance_;
        };
        /**
         * Holds reference to the controller's instance.
         *
         * @private {ResizeObserverController}
         */
        ResizeObserverController.instance_ = null;
        return ResizeObserverController;
    }());

    /**
     * Defines non-writable/enumerable properties of the provided target object.
     *
     * @param {Object} target - Object for which to define properties.
     * @param {Object} props - Properties to be defined.
     * @returns {Object} Target object.
     */
    var defineConfigurable = (function (target, props) {
        for (var _i = 0, _a = Object.keys(props); _i < _a.length; _i++) {
            var key = _a[_i];
            Object.defineProperty(target, key, {
                value: props[key],
                enumerable: false,
                writable: false,
                configurable: true
            });
        }
        return target;
    });

    /**
     * Returns the global object associated with provided element.
     *
     * @param {Object} target
     * @returns {Object}
     */
    var getWindowOf = (function (target) {
        // Assume that the element is an instance of Node, which means that it
        // has the "ownerDocument" property from which we can retrieve a
        // corresponding global object.
        var ownerGlobal = target && target.ownerDocument && target.ownerDocument.defaultView;
        // Return the local global object if it's not possible extract one from
        // provided element.
        return ownerGlobal || global$1;
    });

    // Placeholder of an empty content rectangle.
    var emptyRect = createRectInit(0, 0, 0, 0);
    /**
     * Converts provided string to a number.
     *
     * @param {number|string} value
     * @returns {number}
     */
    function toFloat(value) {
        return parseFloat(value) || 0;
    }
    /**
     * Extracts borders size from provided styles.
     *
     * @param {CSSStyleDeclaration} styles
     * @param {...string} positions - Borders positions (top, right, ...)
     * @returns {number}
     */
    function getBordersSize(styles) {
        var positions = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            positions[_i - 1] = arguments[_i];
        }
        return positions.reduce(function (size, position) {
            var value = styles['border-' + position + '-width'];
            return size + toFloat(value);
        }, 0);
    }
    /**
     * Extracts paddings sizes from provided styles.
     *
     * @param {CSSStyleDeclaration} styles
     * @returns {Object} Paddings box.
     */
    function getPaddings(styles) {
        var positions = ['top', 'right', 'bottom', 'left'];
        var paddings = {};
        for (var _i = 0, positions_1 = positions; _i < positions_1.length; _i++) {
            var position = positions_1[_i];
            var value = styles['padding-' + position];
            paddings[position] = toFloat(value);
        }
        return paddings;
    }
    /**
     * Calculates content rectangle of provided SVG element.
     *
     * @param {SVGGraphicsElement} target - Element content rectangle of which needs
     *      to be calculated.
     * @returns {DOMRectInit}
     */
    function getSVGContentRect(target) {
        var bbox = target.getBBox();
        return createRectInit(0, 0, bbox.width, bbox.height);
    }
    /**
     * Calculates content rectangle of provided HTMLElement.
     *
     * @param {HTMLElement} target - Element for which to calculate the content rectangle.
     * @returns {DOMRectInit}
     */
    function getHTMLElementContentRect(target) {
        // Client width & height properties can't be
        // used exclusively as they provide rounded values.
        var clientWidth = target.clientWidth, clientHeight = target.clientHeight;
        // By this condition we can catch all non-replaced inline, hidden and
        // detached elements. Though elements with width & height properties less
        // than 0.5 will be discarded as well.
        //
        // Without it we would need to implement separate methods for each of
        // those cases and it's not possible to perform a precise and performance
        // effective test for hidden elements. E.g. even jQuery's ':visible' filter
        // gives wrong results for elements with width & height less than 0.5.
        if (!clientWidth && !clientHeight) {
            return emptyRect;
        }
        var styles = getWindowOf(target).getComputedStyle(target);
        var paddings = getPaddings(styles);
        var horizPad = paddings.left + paddings.right;
        var vertPad = paddings.top + paddings.bottom;
        // Computed styles of width & height are being used because they are the
        // only dimensions available to JS that contain non-rounded values. It could
        // be possible to utilize the getBoundingClientRect if only it's data wasn't
        // affected by CSS transformations let alone paddings, borders and scroll bars.
        var width = toFloat(styles.width), height = toFloat(styles.height);
        // Width & height include paddings and borders when the 'border-box' box
        // model is applied (except for IE).
        if (styles.boxSizing === 'border-box') {
            // Following conditions are required to handle Internet Explorer which
            // doesn't include paddings and borders to computed CSS dimensions.
            //
            // We can say that if CSS dimensions + paddings are equal to the "client"
            // properties then it's either IE, and thus we don't need to subtract
            // anything, or an element merely doesn't have paddings/borders styles.
            if (Math.round(width + horizPad) !== clientWidth) {
                width -= getBordersSize(styles, 'left', 'right') + horizPad;
            }
            if (Math.round(height + vertPad) !== clientHeight) {
                height -= getBordersSize(styles, 'top', 'bottom') + vertPad;
            }
        }
        // Following steps can't be applied to the document's root element as its
        // client[Width/Height] properties represent viewport area of the window.
        // Besides, it's as well not necessary as the <html> itself neither has
        // rendered scroll bars nor it can be clipped.
        if (!isDocumentElement(target)) {
            // In some browsers (only in Firefox, actually) CSS width & height
            // include scroll bars size which can be removed at this step as scroll
            // bars are the only difference between rounded dimensions + paddings
            // and "client" properties, though that is not always true in Chrome.
            var vertScrollbar = Math.round(width + horizPad) - clientWidth;
            var horizScrollbar = Math.round(height + vertPad) - clientHeight;
            // Chrome has a rather weird rounding of "client" properties.
            // E.g. for an element with content width of 314.2px it sometimes gives
            // the client width of 315px and for the width of 314.7px it may give
            // 314px. And it doesn't happen all the time. So just ignore this delta
            // as a non-relevant.
            if (Math.abs(vertScrollbar) !== 1) {
                width -= vertScrollbar;
            }
            if (Math.abs(horizScrollbar) !== 1) {
                height -= horizScrollbar;
            }
        }
        return createRectInit(paddings.left, paddings.top, width, height);
    }
    /**
     * Checks whether provided element is an instance of the SVGGraphicsElement.
     *
     * @param {Element} target - Element to be checked.
     * @returns {boolean}
     */
    var isSVGGraphicsElement = (function () {
        // Some browsers, namely IE and Edge, don't have the SVGGraphicsElement
        // interface.
        if (typeof SVGGraphicsElement !== 'undefined') {
            return function (target) { return target instanceof getWindowOf(target).SVGGraphicsElement; };
        }
        // If it's so, then check that element is at least an instance of the
        // SVGElement and that it has the "getBBox" method.
        // eslint-disable-next-line no-extra-parens
        return function (target) { return (target instanceof getWindowOf(target).SVGElement &&
            typeof target.getBBox === 'function'); };
    })();
    /**
     * Checks whether provided element is a document element (<html>).
     *
     * @param {Element} target - Element to be checked.
     * @returns {boolean}
     */
    function isDocumentElement(target) {
        return target === getWindowOf(target).document.documentElement;
    }
    /**
     * Calculates an appropriate content rectangle for provided html or svg element.
     *
     * @param {Element} target - Element content rectangle of which needs to be calculated.
     * @returns {DOMRectInit}
     */
    function getContentRect(target) {
        if (!isBrowser) {
            return emptyRect;
        }
        if (isSVGGraphicsElement(target)) {
            return getSVGContentRect(target);
        }
        return getHTMLElementContentRect(target);
    }
    /**
     * Creates rectangle with an interface of the DOMRectReadOnly.
     * Spec: https://drafts.fxtf.org/geometry/#domrectreadonly
     *
     * @param {DOMRectInit} rectInit - Object with rectangle's x/y coordinates and dimensions.
     * @returns {DOMRectReadOnly}
     */
    function createReadOnlyRect(_a) {
        var x = _a.x, y = _a.y, width = _a.width, height = _a.height;
        // If DOMRectReadOnly is available use it as a prototype for the rectangle.
        var Constr = typeof DOMRectReadOnly !== 'undefined' ? DOMRectReadOnly : Object;
        var rect = Object.create(Constr.prototype);
        // Rectangle's properties are not writable and non-enumerable.
        defineConfigurable(rect, {
            x: x, y: y, width: width, height: height,
            top: y,
            right: x + width,
            bottom: height + y,
            left: x
        });
        return rect;
    }
    /**
     * Creates DOMRectInit object based on the provided dimensions and the x/y coordinates.
     * Spec: https://drafts.fxtf.org/geometry/#dictdef-domrectinit
     *
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {number} width - Rectangle's width.
     * @param {number} height - Rectangle's height.
     * @returns {DOMRectInit}
     */
    function createRectInit(x, y, width, height) {
        return { x: x, y: y, width: width, height: height };
    }

    /**
     * Class that is responsible for computations of the content rectangle of
     * provided DOM element and for keeping track of it's changes.
     */
    var ResizeObservation = /** @class */ (function () {
        /**
         * Creates an instance of ResizeObservation.
         *
         * @param {Element} target - Element to be observed.
         */
        function ResizeObservation(target) {
            /**
             * Broadcasted width of content rectangle.
             *
             * @type {number}
             */
            this.broadcastWidth = 0;
            /**
             * Broadcasted height of content rectangle.
             *
             * @type {number}
             */
            this.broadcastHeight = 0;
            /**
             * Reference to the last observed content rectangle.
             *
             * @private {DOMRectInit}
             */
            this.contentRect_ = createRectInit(0, 0, 0, 0);
            this.target = target;
        }
        /**
         * Updates content rectangle and tells whether it's width or height properties
         * have changed since the last broadcast.
         *
         * @returns {boolean}
         */
        ResizeObservation.prototype.isActive = function () {
            var rect = getContentRect(this.target);
            this.contentRect_ = rect;
            return (rect.width !== this.broadcastWidth ||
                rect.height !== this.broadcastHeight);
        };
        /**
         * Updates 'broadcastWidth' and 'broadcastHeight' properties with a data
         * from the corresponding properties of the last observed content rectangle.
         *
         * @returns {DOMRectInit} Last observed content rectangle.
         */
        ResizeObservation.prototype.broadcastRect = function () {
            var rect = this.contentRect_;
            this.broadcastWidth = rect.width;
            this.broadcastHeight = rect.height;
            return rect;
        };
        return ResizeObservation;
    }());

    var ResizeObserverEntry = /** @class */ (function () {
        /**
         * Creates an instance of ResizeObserverEntry.
         *
         * @param {Element} target - Element that is being observed.
         * @param {DOMRectInit} rectInit - Data of the element's content rectangle.
         */
        function ResizeObserverEntry(target, rectInit) {
            var contentRect = createReadOnlyRect(rectInit);
            // According to the specification following properties are not writable
            // and are also not enumerable in the native implementation.
            //
            // Property accessors are not being used as they'd require to define a
            // private WeakMap storage which may cause memory leaks in browsers that
            // don't support this type of collections.
            defineConfigurable(this, { target: target, contentRect: contentRect });
        }
        return ResizeObserverEntry;
    }());

    var ResizeObserverSPI = /** @class */ (function () {
        /**
         * Creates a new instance of ResizeObserver.
         *
         * @param {ResizeObserverCallback} callback - Callback function that is invoked
         *      when one of the observed elements changes it's content dimensions.
         * @param {ResizeObserverController} controller - Controller instance which
         *      is responsible for the updates of observer.
         * @param {ResizeObserver} callbackCtx - Reference to the public
         *      ResizeObserver instance which will be passed to callback function.
         */
        function ResizeObserverSPI(callback, controller, callbackCtx) {
            /**
             * Collection of resize observations that have detected changes in dimensions
             * of elements.
             *
             * @private {Array<ResizeObservation>}
             */
            this.activeObservations_ = [];
            /**
             * Registry of the ResizeObservation instances.
             *
             * @private {Map<Element, ResizeObservation>}
             */
            this.observations_ = new MapShim();
            if (typeof callback !== 'function') {
                throw new TypeError('The callback provided as parameter 1 is not a function.');
            }
            this.callback_ = callback;
            this.controller_ = controller;
            this.callbackCtx_ = callbackCtx;
        }
        /**
         * Starts observing provided element.
         *
         * @param {Element} target - Element to be observed.
         * @returns {void}
         */
        ResizeObserverSPI.prototype.observe = function (target) {
            if (!arguments.length) {
                throw new TypeError('1 argument required, but only 0 present.');
            }
            // Do nothing if current environment doesn't have the Element interface.
            if (typeof Element === 'undefined' || !(Element instanceof Object)) {
                return;
            }
            if (!(target instanceof getWindowOf(target).Element)) {
                throw new TypeError('parameter 1 is not of type "Element".');
            }
            var observations = this.observations_;
            // Do nothing if element is already being observed.
            if (observations.has(target)) {
                return;
            }
            observations.set(target, new ResizeObservation(target));
            this.controller_.addObserver(this);
            // Force the update of observations.
            this.controller_.refresh();
        };
        /**
         * Stops observing provided element.
         *
         * @param {Element} target - Element to stop observing.
         * @returns {void}
         */
        ResizeObserverSPI.prototype.unobserve = function (target) {
            if (!arguments.length) {
                throw new TypeError('1 argument required, but only 0 present.');
            }
            // Do nothing if current environment doesn't have the Element interface.
            if (typeof Element === 'undefined' || !(Element instanceof Object)) {
                return;
            }
            if (!(target instanceof getWindowOf(target).Element)) {
                throw new TypeError('parameter 1 is not of type "Element".');
            }
            var observations = this.observations_;
            // Do nothing if element is not being observed.
            if (!observations.has(target)) {
                return;
            }
            observations.delete(target);
            if (!observations.size) {
                this.controller_.removeObserver(this);
            }
        };
        /**
         * Stops observing all elements.
         *
         * @returns {void}
         */
        ResizeObserverSPI.prototype.disconnect = function () {
            this.clearActive();
            this.observations_.clear();
            this.controller_.removeObserver(this);
        };
        /**
         * Collects observation instances the associated element of which has changed
         * it's content rectangle.
         *
         * @returns {void}
         */
        ResizeObserverSPI.prototype.gatherActive = function () {
            var _this = this;
            this.clearActive();
            this.observations_.forEach(function (observation) {
                if (observation.isActive()) {
                    _this.activeObservations_.push(observation);
                }
            });
        };
        /**
         * Invokes initial callback function with a list of ResizeObserverEntry
         * instances collected from active resize observations.
         *
         * @returns {void}
         */
        ResizeObserverSPI.prototype.broadcastActive = function () {
            // Do nothing if observer doesn't have active observations.
            if (!this.hasActive()) {
                return;
            }
            var ctx = this.callbackCtx_;
            // Create ResizeObserverEntry instance for every active observation.
            var entries = this.activeObservations_.map(function (observation) {
                return new ResizeObserverEntry(observation.target, observation.broadcastRect());
            });
            this.callback_.call(ctx, entries, ctx);
            this.clearActive();
        };
        /**
         * Clears the collection of active observations.
         *
         * @returns {void}
         */
        ResizeObserverSPI.prototype.clearActive = function () {
            this.activeObservations_.splice(0);
        };
        /**
         * Tells whether observer has active observations.
         *
         * @returns {boolean}
         */
        ResizeObserverSPI.prototype.hasActive = function () {
            return this.activeObservations_.length > 0;
        };
        return ResizeObserverSPI;
    }());

    // Registry of internal observers. If WeakMap is not available use current shim
    // for the Map collection as it has all required methods and because WeakMap
    // can't be fully polyfilled anyway.
    var observers = typeof WeakMap !== 'undefined' ? new WeakMap() : new MapShim();
    /**
     * ResizeObserver API. Encapsulates the ResizeObserver SPI implementation
     * exposing only those methods and properties that are defined in the spec.
     */
    var ResizeObserver = /** @class */ (function () {
        /**
         * Creates a new instance of ResizeObserver.
         *
         * @param {ResizeObserverCallback} callback - Callback that is invoked when
         *      dimensions of the observed elements change.
         */
        function ResizeObserver(callback) {
            if (!(this instanceof ResizeObserver)) {
                throw new TypeError('Cannot call a class as a function.');
            }
            if (!arguments.length) {
                throw new TypeError('1 argument required, but only 0 present.');
            }
            var controller = ResizeObserverController.getInstance();
            var observer = new ResizeObserverSPI(callback, controller, this);
            observers.set(this, observer);
        }
        return ResizeObserver;
    }());
    // Expose public methods of ResizeObserver.
    [
        'observe',
        'unobserve',
        'disconnect'
    ].forEach(function (method) {
        ResizeObserver.prototype[method] = function () {
            var _a;
            return (_a = observers.get(this))[method].apply(_a, arguments);
        };
    });

    var index = (function () {
        // Export existing implementation if available.
        if (typeof global$1.ResizeObserver !== 'undefined') {
            return global$1.ResizeObserver;
        }
        return ResizeObserver;
    })();

    var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x.default : x;
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var _global = createCommonjsModule(function (module) {
    // https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
    var global = module.exports = typeof window != 'undefined' && window.Math == Math
      ? window : typeof self != 'undefined' && self.Math == Math ? self
      // eslint-disable-next-line no-new-func
      : Function('return this')();
    if (typeof __g == 'number') __g = global; // eslint-disable-line no-undef
    });

    var hasOwnProperty = {}.hasOwnProperty;
    var _has = function (it, key) {
      return hasOwnProperty.call(it, key);
    };

    var _fails = function (exec) {
      try {
        return !!exec();
      } catch (e) {
        return true;
      }
    };

    // Thank's IE8 for his funny defineProperty
    var _descriptors = !_fails(function () {
      return Object.defineProperty({}, 'a', { get: function () { return 7; } }).a != 7;
    });

    var _core = createCommonjsModule(function (module) {
    var core = module.exports = { version: '2.6.5' };
    if (typeof __e == 'number') __e = core; // eslint-disable-line no-undef
    });
    var _core_1 = _core.version;

    var _isObject = function (it) {
      return typeof it === 'object' ? it !== null : typeof it === 'function';
    };

    var _anObject = function (it) {
      if (!_isObject(it)) throw TypeError(it + ' is not an object!');
      return it;
    };

    var document$1 = _global.document;
    // typeof document.createElement is 'object' in old IE
    var is = _isObject(document$1) && _isObject(document$1.createElement);
    var _domCreate = function (it) {
      return is ? document$1.createElement(it) : {};
    };

    var _ie8DomDefine = !_descriptors && !_fails(function () {
      return Object.defineProperty(_domCreate('div'), 'a', { get: function () { return 7; } }).a != 7;
    });

    // 7.1.1 ToPrimitive(input [, PreferredType])

    // instead of the ES6 spec version, we didn't implement @@toPrimitive case
    // and the second argument - flag - preferred type is a string
    var _toPrimitive = function (it, S) {
      if (!_isObject(it)) return it;
      var fn, val;
      if (S && typeof (fn = it.toString) == 'function' && !_isObject(val = fn.call(it))) return val;
      if (typeof (fn = it.valueOf) == 'function' && !_isObject(val = fn.call(it))) return val;
      if (!S && typeof (fn = it.toString) == 'function' && !_isObject(val = fn.call(it))) return val;
      throw TypeError("Can't convert object to primitive value");
    };

    var dP = Object.defineProperty;

    var f = _descriptors ? Object.defineProperty : function defineProperty(O, P, Attributes) {
      _anObject(O);
      P = _toPrimitive(P, true);
      _anObject(Attributes);
      if (_ie8DomDefine) try {
        return dP(O, P, Attributes);
      } catch (e) { /* empty */ }
      if ('get' in Attributes || 'set' in Attributes) throw TypeError('Accessors not supported!');
      if ('value' in Attributes) O[P] = Attributes.value;
      return O;
    };

    var _objectDp = {
    	f: f
    };

    var _propertyDesc = function (bitmap, value) {
      return {
        enumerable: !(bitmap & 1),
        configurable: !(bitmap & 2),
        writable: !(bitmap & 4),
        value: value
      };
    };

    var _hide = _descriptors ? function (object, key, value) {
      return _objectDp.f(object, key, _propertyDesc(1, value));
    } : function (object, key, value) {
      object[key] = value;
      return object;
    };

    var id = 0;
    var px = Math.random();
    var _uid = function (key) {
      return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
    };

    var _library = false;

    var _shared = createCommonjsModule(function (module) {
    var SHARED = '__core-js_shared__';
    var store = _global[SHARED] || (_global[SHARED] = {});

    (module.exports = function (key, value) {
      return store[key] || (store[key] = value !== undefined ? value : {});
    })('versions', []).push({
      version: _core.version,
      mode: _library ? 'pure' : 'global',
      copyright: '© 2019 Denis Pushkarev (zloirock.ru)'
    });
    });

    var _functionToString = _shared('native-function-to-string', Function.toString);

    var _redefine = createCommonjsModule(function (module) {
    var SRC = _uid('src');

    var TO_STRING = 'toString';
    var TPL = ('' + _functionToString).split(TO_STRING);

    _core.inspectSource = function (it) {
      return _functionToString.call(it);
    };

    (module.exports = function (O, key, val, safe) {
      var isFunction = typeof val == 'function';
      if (isFunction) _has(val, 'name') || _hide(val, 'name', key);
      if (O[key] === val) return;
      if (isFunction) _has(val, SRC) || _hide(val, SRC, O[key] ? '' + O[key] : TPL.join(String(key)));
      if (O === _global) {
        O[key] = val;
      } else if (!safe) {
        delete O[key];
        _hide(O, key, val);
      } else if (O[key]) {
        O[key] = val;
      } else {
        _hide(O, key, val);
      }
    // add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative
    })(Function.prototype, TO_STRING, function toString() {
      return typeof this == 'function' && this[SRC] || _functionToString.call(this);
    });
    });

    var _aFunction = function (it) {
      if (typeof it != 'function') throw TypeError(it + ' is not a function!');
      return it;
    };

    // optional / simple context binding

    var _ctx = function (fn, that, length) {
      _aFunction(fn);
      if (that === undefined) return fn;
      switch (length) {
        case 1: return function (a) {
          return fn.call(that, a);
        };
        case 2: return function (a, b) {
          return fn.call(that, a, b);
        };
        case 3: return function (a, b, c) {
          return fn.call(that, a, b, c);
        };
      }
      return function (/* ...args */) {
        return fn.apply(that, arguments);
      };
    };

    var PROTOTYPE = 'prototype';

    var $export = function (type, name, source) {
      var IS_FORCED = type & $export.F;
      var IS_GLOBAL = type & $export.G;
      var IS_STATIC = type & $export.S;
      var IS_PROTO = type & $export.P;
      var IS_BIND = type & $export.B;
      var target = IS_GLOBAL ? _global : IS_STATIC ? _global[name] || (_global[name] = {}) : (_global[name] || {})[PROTOTYPE];
      var exports = IS_GLOBAL ? _core : _core[name] || (_core[name] = {});
      var expProto = exports[PROTOTYPE] || (exports[PROTOTYPE] = {});
      var key, own, out, exp;
      if (IS_GLOBAL) source = name;
      for (key in source) {
        // contains in native
        own = !IS_FORCED && target && target[key] !== undefined;
        // export native or passed
        out = (own ? target : source)[key];
        // bind timers to global for call from export context
        exp = IS_BIND && own ? _ctx(out, _global) : IS_PROTO && typeof out == 'function' ? _ctx(Function.call, out) : out;
        // extend global
        if (target) _redefine(target, key, out, type & $export.U);
        // export
        if (exports[key] != out) _hide(exports, key, exp);
        if (IS_PROTO && expProto[key] != out) expProto[key] = out;
      }
    };
    _global.core = _core;
    // type bitmap
    $export.F = 1;   // forced
    $export.G = 2;   // global
    $export.S = 4;   // static
    $export.P = 8;   // proto
    $export.B = 16;  // bind
    $export.W = 32;  // wrap
    $export.U = 64;  // safe
    $export.R = 128; // real proto method for `library`
    var _export = $export;

    var _meta = createCommonjsModule(function (module) {
    var META = _uid('meta');


    var setDesc = _objectDp.f;
    var id = 0;
    var isExtensible = Object.isExtensible || function () {
      return true;
    };
    var FREEZE = !_fails(function () {
      return isExtensible(Object.preventExtensions({}));
    });
    var setMeta = function (it) {
      setDesc(it, META, { value: {
        i: 'O' + ++id, // object ID
        w: {}          // weak collections IDs
      } });
    };
    var fastKey = function (it, create) {
      // return primitive with prefix
      if (!_isObject(it)) return typeof it == 'symbol' ? it : (typeof it == 'string' ? 'S' : 'P') + it;
      if (!_has(it, META)) {
        // can't set metadata to uncaught frozen object
        if (!isExtensible(it)) return 'F';
        // not necessary to add metadata
        if (!create) return 'E';
        // add missing metadata
        setMeta(it);
      // return object ID
      } return it[META].i;
    };
    var getWeak = function (it, create) {
      if (!_has(it, META)) {
        // can't set metadata to uncaught frozen object
        if (!isExtensible(it)) return true;
        // not necessary to add metadata
        if (!create) return false;
        // add missing metadata
        setMeta(it);
      // return hash weak collections IDs
      } return it[META].w;
    };
    // add metadata on freeze-family methods calling
    var onFreeze = function (it) {
      if (FREEZE && meta.NEED && isExtensible(it) && !_has(it, META)) setMeta(it);
      return it;
    };
    var meta = module.exports = {
      KEY: META,
      NEED: false,
      fastKey: fastKey,
      getWeak: getWeak,
      onFreeze: onFreeze
    };
    });
    var _meta_1 = _meta.KEY;
    var _meta_2 = _meta.NEED;
    var _meta_3 = _meta.fastKey;
    var _meta_4 = _meta.getWeak;
    var _meta_5 = _meta.onFreeze;

    var _wks = createCommonjsModule(function (module) {
    var store = _shared('wks');

    var Symbol = _global.Symbol;
    var USE_SYMBOL = typeof Symbol == 'function';

    var $exports = module.exports = function (name) {
      return store[name] || (store[name] =
        USE_SYMBOL && Symbol[name] || (USE_SYMBOL ? Symbol : _uid)('Symbol.' + name));
    };

    $exports.store = store;
    });

    var def = _objectDp.f;

    var TAG = _wks('toStringTag');

    var _setToStringTag = function (it, tag, stat) {
      if (it && !_has(it = stat ? it : it.prototype, TAG)) def(it, TAG, { configurable: true, value: tag });
    };

    var f$1 = _wks;

    var _wksExt = {
    	f: f$1
    };

    var defineProperty = _objectDp.f;
    var _wksDefine = function (name) {
      var $Symbol = _core.Symbol || (_core.Symbol = _library ? {} : _global.Symbol || {});
      if (name.charAt(0) != '_' && !(name in $Symbol)) defineProperty($Symbol, name, { value: _wksExt.f(name) });
    };

    var toString = {}.toString;

    var _cof = function (it) {
      return toString.call(it).slice(8, -1);
    };

    // fallback for non-array-like ES3 and non-enumerable old V8 strings

    // eslint-disable-next-line no-prototype-builtins
    var _iobject = Object('z').propertyIsEnumerable(0) ? Object : function (it) {
      return _cof(it) == 'String' ? it.split('') : Object(it);
    };

    // 7.2.1 RequireObjectCoercible(argument)
    var _defined = function (it) {
      if (it == undefined) throw TypeError("Can't call method on  " + it);
      return it;
    };

    // to indexed object, toObject with fallback for non-array-like ES3 strings


    var _toIobject = function (it) {
      return _iobject(_defined(it));
    };

    // 7.1.4 ToInteger
    var ceil = Math.ceil;
    var floor = Math.floor;
    var _toInteger = function (it) {
      return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
    };

    // 7.1.15 ToLength

    var min = Math.min;
    var _toLength = function (it) {
      return it > 0 ? min(_toInteger(it), 0x1fffffffffffff) : 0; // pow(2, 53) - 1 == 9007199254740991
    };

    var max = Math.max;
    var min$1 = Math.min;
    var _toAbsoluteIndex = function (index, length) {
      index = _toInteger(index);
      return index < 0 ? max(index + length, 0) : min$1(index, length);
    };

    // false -> Array#indexOf
    // true  -> Array#includes



    var _arrayIncludes = function (IS_INCLUDES) {
      return function ($this, el, fromIndex) {
        var O = _toIobject($this);
        var length = _toLength(O.length);
        var index = _toAbsoluteIndex(fromIndex, length);
        var value;
        // Array#includes uses SameValueZero equality algorithm
        // eslint-disable-next-line no-self-compare
        if (IS_INCLUDES && el != el) while (length > index) {
          value = O[index++];
          // eslint-disable-next-line no-self-compare
          if (value != value) return true;
        // Array#indexOf ignores holes, Array#includes - not
        } else for (;length > index; index++) if (IS_INCLUDES || index in O) {
          if (O[index] === el) return IS_INCLUDES || index || 0;
        } return !IS_INCLUDES && -1;
      };
    };

    var shared = _shared('keys');

    var _sharedKey = function (key) {
      return shared[key] || (shared[key] = _uid(key));
    };

    var arrayIndexOf = _arrayIncludes(false);
    var IE_PROTO = _sharedKey('IE_PROTO');

    var _objectKeysInternal = function (object, names) {
      var O = _toIobject(object);
      var i = 0;
      var result = [];
      var key;
      for (key in O) if (key != IE_PROTO) _has(O, key) && result.push(key);
      // Don't enum bug & hidden keys
      while (names.length > i) if (_has(O, key = names[i++])) {
        ~arrayIndexOf(result, key) || result.push(key);
      }
      return result;
    };

    // IE 8- don't enum bug keys
    var _enumBugKeys = (
      'constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf'
    ).split(',');

    // 19.1.2.14 / 15.2.3.14 Object.keys(O)



    var _objectKeys = Object.keys || function keys(O) {
      return _objectKeysInternal(O, _enumBugKeys);
    };

    var f$2 = Object.getOwnPropertySymbols;

    var _objectGops = {
    	f: f$2
    };

    var f$3 = {}.propertyIsEnumerable;

    var _objectPie = {
    	f: f$3
    };

    // all enumerable object keys, includes symbols



    var _enumKeys = function (it) {
      var result = _objectKeys(it);
      var getSymbols = _objectGops.f;
      if (getSymbols) {
        var symbols = getSymbols(it);
        var isEnum = _objectPie.f;
        var i = 0;
        var key;
        while (symbols.length > i) if (isEnum.call(it, key = symbols[i++])) result.push(key);
      } return result;
    };

    // 7.2.2 IsArray(argument)

    var _isArray = Array.isArray || function isArray(arg) {
      return _cof(arg) == 'Array';
    };

    var _objectDps = _descriptors ? Object.defineProperties : function defineProperties(O, Properties) {
      _anObject(O);
      var keys = _objectKeys(Properties);
      var length = keys.length;
      var i = 0;
      var P;
      while (length > i) _objectDp.f(O, P = keys[i++], Properties[P]);
      return O;
    };

    var document$2 = _global.document;
    var _html = document$2 && document$2.documentElement;

    // 19.1.2.2 / 15.2.3.5 Object.create(O [, Properties])



    var IE_PROTO$1 = _sharedKey('IE_PROTO');
    var Empty = function () { /* empty */ };
    var PROTOTYPE$1 = 'prototype';

    // Create object with fake `null` prototype: use iframe Object with cleared prototype
    var createDict = function () {
      // Thrash, waste and sodomy: IE GC bug
      var iframe = _domCreate('iframe');
      var i = _enumBugKeys.length;
      var lt = '<';
      var gt = '>';
      var iframeDocument;
      iframe.style.display = 'none';
      _html.appendChild(iframe);
      iframe.src = 'javascript:'; // eslint-disable-line no-script-url
      // createDict = iframe.contentWindow.Object;
      // html.removeChild(iframe);
      iframeDocument = iframe.contentWindow.document;
      iframeDocument.open();
      iframeDocument.write(lt + 'script' + gt + 'document.F=Object' + lt + '/script' + gt);
      iframeDocument.close();
      createDict = iframeDocument.F;
      while (i--) delete createDict[PROTOTYPE$1][_enumBugKeys[i]];
      return createDict();
    };

    var _objectCreate = Object.create || function create(O, Properties) {
      var result;
      if (O !== null) {
        Empty[PROTOTYPE$1] = _anObject(O);
        result = new Empty();
        Empty[PROTOTYPE$1] = null;
        // add "__proto__" for Object.getPrototypeOf polyfill
        result[IE_PROTO$1] = O;
      } else result = createDict();
      return Properties === undefined ? result : _objectDps(result, Properties);
    };

    // 19.1.2.7 / 15.2.3.4 Object.getOwnPropertyNames(O)

    var hiddenKeys = _enumBugKeys.concat('length', 'prototype');

    var f$4 = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
      return _objectKeysInternal(O, hiddenKeys);
    };

    var _objectGopn = {
    	f: f$4
    };

    // fallback for IE11 buggy Object.getOwnPropertyNames with iframe and window

    var gOPN = _objectGopn.f;
    var toString$1 = {}.toString;

    var windowNames = typeof window == 'object' && window && Object.getOwnPropertyNames
      ? Object.getOwnPropertyNames(window) : [];

    var getWindowNames = function (it) {
      try {
        return gOPN(it);
      } catch (e) {
        return windowNames.slice();
      }
    };

    var f$5 = function getOwnPropertyNames(it) {
      return windowNames && toString$1.call(it) == '[object Window]' ? getWindowNames(it) : gOPN(_toIobject(it));
    };

    var _objectGopnExt = {
    	f: f$5
    };

    var gOPD = Object.getOwnPropertyDescriptor;

    var f$6 = _descriptors ? gOPD : function getOwnPropertyDescriptor(O, P) {
      O = _toIobject(O);
      P = _toPrimitive(P, true);
      if (_ie8DomDefine) try {
        return gOPD(O, P);
      } catch (e) { /* empty */ }
      if (_has(O, P)) return _propertyDesc(!_objectPie.f.call(O, P), O[P]);
    };

    var _objectGopd = {
    	f: f$6
    };

    // ECMAScript 6 symbols shim





    var META = _meta.KEY;



















    var gOPD$1 = _objectGopd.f;
    var dP$1 = _objectDp.f;
    var gOPN$1 = _objectGopnExt.f;
    var $Symbol = _global.Symbol;
    var $JSON = _global.JSON;
    var _stringify = $JSON && $JSON.stringify;
    var PROTOTYPE$2 = 'prototype';
    var HIDDEN = _wks('_hidden');
    var TO_PRIMITIVE = _wks('toPrimitive');
    var isEnum = {}.propertyIsEnumerable;
    var SymbolRegistry = _shared('symbol-registry');
    var AllSymbols = _shared('symbols');
    var OPSymbols = _shared('op-symbols');
    var ObjectProto = Object[PROTOTYPE$2];
    var USE_NATIVE = typeof $Symbol == 'function';
    var QObject = _global.QObject;
    // Don't use setters in Qt Script, https://github.com/zloirock/core-js/issues/173
    var setter = !QObject || !QObject[PROTOTYPE$2] || !QObject[PROTOTYPE$2].findChild;

    // fallback for old Android, https://code.google.com/p/v8/issues/detail?id=687
    var setSymbolDesc = _descriptors && _fails(function () {
      return _objectCreate(dP$1({}, 'a', {
        get: function () { return dP$1(this, 'a', { value: 7 }).a; }
      })).a != 7;
    }) ? function (it, key, D) {
      var protoDesc = gOPD$1(ObjectProto, key);
      if (protoDesc) delete ObjectProto[key];
      dP$1(it, key, D);
      if (protoDesc && it !== ObjectProto) dP$1(ObjectProto, key, protoDesc);
    } : dP$1;

    var wrap = function (tag) {
      var sym = AllSymbols[tag] = _objectCreate($Symbol[PROTOTYPE$2]);
      sym._k = tag;
      return sym;
    };

    var isSymbol = USE_NATIVE && typeof $Symbol.iterator == 'symbol' ? function (it) {
      return typeof it == 'symbol';
    } : function (it) {
      return it instanceof $Symbol;
    };

    var $defineProperty = function defineProperty(it, key, D) {
      if (it === ObjectProto) $defineProperty(OPSymbols, key, D);
      _anObject(it);
      key = _toPrimitive(key, true);
      _anObject(D);
      if (_has(AllSymbols, key)) {
        if (!D.enumerable) {
          if (!_has(it, HIDDEN)) dP$1(it, HIDDEN, _propertyDesc(1, {}));
          it[HIDDEN][key] = true;
        } else {
          if (_has(it, HIDDEN) && it[HIDDEN][key]) it[HIDDEN][key] = false;
          D = _objectCreate(D, { enumerable: _propertyDesc(0, false) });
        } return setSymbolDesc(it, key, D);
      } return dP$1(it, key, D);
    };
    var $defineProperties = function defineProperties(it, P) {
      _anObject(it);
      var keys = _enumKeys(P = _toIobject(P));
      var i = 0;
      var l = keys.length;
      var key;
      while (l > i) $defineProperty(it, key = keys[i++], P[key]);
      return it;
    };
    var $create = function create(it, P) {
      return P === undefined ? _objectCreate(it) : $defineProperties(_objectCreate(it), P);
    };
    var $propertyIsEnumerable = function propertyIsEnumerable(key) {
      var E = isEnum.call(this, key = _toPrimitive(key, true));
      if (this === ObjectProto && _has(AllSymbols, key) && !_has(OPSymbols, key)) return false;
      return E || !_has(this, key) || !_has(AllSymbols, key) || _has(this, HIDDEN) && this[HIDDEN][key] ? E : true;
    };
    var $getOwnPropertyDescriptor = function getOwnPropertyDescriptor(it, key) {
      it = _toIobject(it);
      key = _toPrimitive(key, true);
      if (it === ObjectProto && _has(AllSymbols, key) && !_has(OPSymbols, key)) return;
      var D = gOPD$1(it, key);
      if (D && _has(AllSymbols, key) && !(_has(it, HIDDEN) && it[HIDDEN][key])) D.enumerable = true;
      return D;
    };
    var $getOwnPropertyNames = function getOwnPropertyNames(it) {
      var names = gOPN$1(_toIobject(it));
      var result = [];
      var i = 0;
      var key;
      while (names.length > i) {
        if (!_has(AllSymbols, key = names[i++]) && key != HIDDEN && key != META) result.push(key);
      } return result;
    };
    var $getOwnPropertySymbols = function getOwnPropertySymbols(it) {
      var IS_OP = it === ObjectProto;
      var names = gOPN$1(IS_OP ? OPSymbols : _toIobject(it));
      var result = [];
      var i = 0;
      var key;
      while (names.length > i) {
        if (_has(AllSymbols, key = names[i++]) && (IS_OP ? _has(ObjectProto, key) : true)) result.push(AllSymbols[key]);
      } return result;
    };

    // 19.4.1.1 Symbol([description])
    if (!USE_NATIVE) {
      $Symbol = function Symbol() {
        if (this instanceof $Symbol) throw TypeError('Symbol is not a constructor!');
        var tag = _uid(arguments.length > 0 ? arguments[0] : undefined);
        var $set = function (value) {
          if (this === ObjectProto) $set.call(OPSymbols, value);
          if (_has(this, HIDDEN) && _has(this[HIDDEN], tag)) this[HIDDEN][tag] = false;
          setSymbolDesc(this, tag, _propertyDesc(1, value));
        };
        if (_descriptors && setter) setSymbolDesc(ObjectProto, tag, { configurable: true, set: $set });
        return wrap(tag);
      };
      _redefine($Symbol[PROTOTYPE$2], 'toString', function toString() {
        return this._k;
      });

      _objectGopd.f = $getOwnPropertyDescriptor;
      _objectDp.f = $defineProperty;
      _objectGopn.f = _objectGopnExt.f = $getOwnPropertyNames;
      _objectPie.f = $propertyIsEnumerable;
      _objectGops.f = $getOwnPropertySymbols;

      if (_descriptors && !_library) {
        _redefine(ObjectProto, 'propertyIsEnumerable', $propertyIsEnumerable, true);
      }

      _wksExt.f = function (name) {
        return wrap(_wks(name));
      };
    }

    _export(_export.G + _export.W + _export.F * !USE_NATIVE, { Symbol: $Symbol });

    for (var es6Symbols = (
      // 19.4.2.2, 19.4.2.3, 19.4.2.4, 19.4.2.6, 19.4.2.8, 19.4.2.9, 19.4.2.10, 19.4.2.11, 19.4.2.12, 19.4.2.13, 19.4.2.14
      'hasInstance,isConcatSpreadable,iterator,match,replace,search,species,split,toPrimitive,toStringTag,unscopables'
    ).split(','), j = 0; es6Symbols.length > j;)_wks(es6Symbols[j++]);

    for (var wellKnownSymbols = _objectKeys(_wks.store), k = 0; wellKnownSymbols.length > k;) _wksDefine(wellKnownSymbols[k++]);

    _export(_export.S + _export.F * !USE_NATIVE, 'Symbol', {
      // 19.4.2.1 Symbol.for(key)
      'for': function (key) {
        return _has(SymbolRegistry, key += '')
          ? SymbolRegistry[key]
          : SymbolRegistry[key] = $Symbol(key);
      },
      // 19.4.2.5 Symbol.keyFor(sym)
      keyFor: function keyFor(sym) {
        if (!isSymbol(sym)) throw TypeError(sym + ' is not a symbol!');
        for (var key in SymbolRegistry) if (SymbolRegistry[key] === sym) return key;
      },
      useSetter: function () { setter = true; },
      useSimple: function () { setter = false; }
    });

    _export(_export.S + _export.F * !USE_NATIVE, 'Object', {
      // 19.1.2.2 Object.create(O [, Properties])
      create: $create,
      // 19.1.2.4 Object.defineProperty(O, P, Attributes)
      defineProperty: $defineProperty,
      // 19.1.2.3 Object.defineProperties(O, Properties)
      defineProperties: $defineProperties,
      // 19.1.2.6 Object.getOwnPropertyDescriptor(O, P)
      getOwnPropertyDescriptor: $getOwnPropertyDescriptor,
      // 19.1.2.7 Object.getOwnPropertyNames(O)
      getOwnPropertyNames: $getOwnPropertyNames,
      // 19.1.2.8 Object.getOwnPropertySymbols(O)
      getOwnPropertySymbols: $getOwnPropertySymbols
    });

    // 24.3.2 JSON.stringify(value [, replacer [, space]])
    $JSON && _export(_export.S + _export.F * (!USE_NATIVE || _fails(function () {
      var S = $Symbol();
      // MS Edge converts symbol values to JSON as {}
      // WebKit converts symbol values to JSON as null
      // V8 throws on boxed symbols
      return _stringify([S]) != '[null]' || _stringify({ a: S }) != '{}' || _stringify(Object(S)) != '{}';
    })), 'JSON', {
      stringify: function stringify(it) {
        var args = [it];
        var i = 1;
        var replacer, $replacer;
        while (arguments.length > i) args.push(arguments[i++]);
        $replacer = replacer = args[1];
        if (!_isObject(replacer) && it === undefined || isSymbol(it)) return; // IE8 returns string on undefined
        if (!_isArray(replacer)) replacer = function (key, value) {
          if (typeof $replacer == 'function') value = $replacer.call(this, key, value);
          if (!isSymbol(value)) return value;
        };
        args[1] = replacer;
        return _stringify.apply($JSON, args);
      }
    });

    // 19.4.3.4 Symbol.prototype[@@toPrimitive](hint)
    $Symbol[PROTOTYPE$2][TO_PRIMITIVE] || _hide($Symbol[PROTOTYPE$2], TO_PRIMITIVE, $Symbol[PROTOTYPE$2].valueOf);
    // 19.4.3.5 Symbol.prototype[@@toStringTag]
    _setToStringTag($Symbol, 'Symbol');
    // 20.2.1.9 Math[@@toStringTag]
    _setToStringTag(Math, 'Math', true);
    // 24.3.3 JSON[@@toStringTag]
    _setToStringTag(_global.JSON, 'JSON', true);

    // 19.1.2.2 / 15.2.3.5 Object.create(O [, Properties])
    _export(_export.S, 'Object', { create: _objectCreate });

    // 19.1.2.4 / 15.2.3.6 Object.defineProperty(O, P, Attributes)
    _export(_export.S + _export.F * !_descriptors, 'Object', { defineProperty: _objectDp.f });

    // 19.1.2.3 / 15.2.3.7 Object.defineProperties(O, Properties)
    _export(_export.S + _export.F * !_descriptors, 'Object', { defineProperties: _objectDps });

    // most Object methods by ES6 should accept primitives



    var _objectSap = function (KEY, exec) {
      var fn = (_core.Object || {})[KEY] || Object[KEY];
      var exp = {};
      exp[KEY] = exec(fn);
      _export(_export.S + _export.F * _fails(function () { fn(1); }), 'Object', exp);
    };

    // 19.1.2.6 Object.getOwnPropertyDescriptor(O, P)

    var $getOwnPropertyDescriptor$1 = _objectGopd.f;

    _objectSap('getOwnPropertyDescriptor', function () {
      return function getOwnPropertyDescriptor(it, key) {
        return $getOwnPropertyDescriptor$1(_toIobject(it), key);
      };
    });

    // 7.1.13 ToObject(argument)

    var _toObject = function (it) {
      return Object(_defined(it));
    };

    // 19.1.2.9 / 15.2.3.2 Object.getPrototypeOf(O)


    var IE_PROTO$2 = _sharedKey('IE_PROTO');
    var ObjectProto$1 = Object.prototype;

    var _objectGpo = Object.getPrototypeOf || function (O) {
      O = _toObject(O);
      if (_has(O, IE_PROTO$2)) return O[IE_PROTO$2];
      if (typeof O.constructor == 'function' && O instanceof O.constructor) {
        return O.constructor.prototype;
      } return O instanceof Object ? ObjectProto$1 : null;
    };

    // 19.1.2.9 Object.getPrototypeOf(O)



    _objectSap('getPrototypeOf', function () {
      return function getPrototypeOf(it) {
        return _objectGpo(_toObject(it));
      };
    });

    // 19.1.2.14 Object.keys(O)



    _objectSap('keys', function () {
      return function keys(it) {
        return _objectKeys(_toObject(it));
      };
    });

    // 19.1.2.7 Object.getOwnPropertyNames(O)
    _objectSap('getOwnPropertyNames', function () {
      return _objectGopnExt.f;
    });

    // 19.1.2.5 Object.freeze(O)

    var meta = _meta.onFreeze;

    _objectSap('freeze', function ($freeze) {
      return function freeze(it) {
        return $freeze && _isObject(it) ? $freeze(meta(it)) : it;
      };
    });

    // 19.1.2.17 Object.seal(O)

    var meta$1 = _meta.onFreeze;

    _objectSap('seal', function ($seal) {
      return function seal(it) {
        return $seal && _isObject(it) ? $seal(meta$1(it)) : it;
      };
    });

    // 19.1.2.15 Object.preventExtensions(O)

    var meta$2 = _meta.onFreeze;

    _objectSap('preventExtensions', function ($preventExtensions) {
      return function preventExtensions(it) {
        return $preventExtensions && _isObject(it) ? $preventExtensions(meta$2(it)) : it;
      };
    });

    // 19.1.2.12 Object.isFrozen(O)


    _objectSap('isFrozen', function ($isFrozen) {
      return function isFrozen(it) {
        return _isObject(it) ? $isFrozen ? $isFrozen(it) : false : true;
      };
    });

    // 19.1.2.13 Object.isSealed(O)


    _objectSap('isSealed', function ($isSealed) {
      return function isSealed(it) {
        return _isObject(it) ? $isSealed ? $isSealed(it) : false : true;
      };
    });

    // 19.1.2.11 Object.isExtensible(O)


    _objectSap('isExtensible', function ($isExtensible) {
      return function isExtensible(it) {
        return _isObject(it) ? $isExtensible ? $isExtensible(it) : true : false;
      };
    });

    // 19.1.2.1 Object.assign(target, source, ...)





    var $assign = Object.assign;

    // should work with symbols and should have deterministic property order (V8 bug)
    var _objectAssign = !$assign || _fails(function () {
      var A = {};
      var B = {};
      // eslint-disable-next-line no-undef
      var S = Symbol();
      var K = 'abcdefghijklmnopqrst';
      A[S] = 7;
      K.split('').forEach(function (k) { B[k] = k; });
      return $assign({}, A)[S] != 7 || Object.keys($assign({}, B)).join('') != K;
    }) ? function assign(target, source) { // eslint-disable-line no-unused-vars
      var T = _toObject(target);
      var aLen = arguments.length;
      var index = 1;
      var getSymbols = _objectGops.f;
      var isEnum = _objectPie.f;
      while (aLen > index) {
        var S = _iobject(arguments[index++]);
        var keys = getSymbols ? _objectKeys(S).concat(getSymbols(S)) : _objectKeys(S);
        var length = keys.length;
        var j = 0;
        var key;
        while (length > j) if (isEnum.call(S, key = keys[j++])) T[key] = S[key];
      } return T;
    } : $assign;

    // 19.1.3.1 Object.assign(target, source)


    _export(_export.S + _export.F, 'Object', { assign: _objectAssign });

    // 7.2.9 SameValue(x, y)
    var _sameValue = Object.is || function is(x, y) {
      // eslint-disable-next-line no-self-compare
      return x === y ? x !== 0 || 1 / x === 1 / y : x != x && y != y;
    };

    // 19.1.3.10 Object.is(value1, value2)

    _export(_export.S, 'Object', { is: _sameValue });

    // Works with __proto__ only. Old v8 can't work with null proto objects.
    /* eslint-disable no-proto */


    var check = function (O, proto) {
      _anObject(O);
      if (!_isObject(proto) && proto !== null) throw TypeError(proto + ": can't set as prototype!");
    };
    var _setProto = {
      set: Object.setPrototypeOf || ('__proto__' in {} ? // eslint-disable-line
        function (test, buggy, set) {
          try {
            set = _ctx(Function.call, _objectGopd.f(Object.prototype, '__proto__').set, 2);
            set(test, []);
            buggy = !(test instanceof Array);
          } catch (e) { buggy = true; }
          return function setPrototypeOf(O, proto) {
            check(O, proto);
            if (buggy) O.__proto__ = proto;
            else set(O, proto);
            return O;
          };
        }({}, false) : undefined),
      check: check
    };

    // 19.1.3.19 Object.setPrototypeOf(O, proto)

    _export(_export.S, 'Object', { setPrototypeOf: _setProto.set });

    // getting tag from 19.1.3.6 Object.prototype.toString()

    var TAG$1 = _wks('toStringTag');
    // ES3 wrong here
    var ARG = _cof(function () { return arguments; }()) == 'Arguments';

    // fallback for IE11 Script Access Denied error
    var tryGet = function (it, key) {
      try {
        return it[key];
      } catch (e) { /* empty */ }
    };

    var _classof = function (it) {
      var O, T, B;
      return it === undefined ? 'Undefined' : it === null ? 'Null'
        // @@toStringTag case
        : typeof (T = tryGet(O = Object(it), TAG$1)) == 'string' ? T
        // builtinTag case
        : ARG ? _cof(O)
        // ES3 arguments fallback
        : (B = _cof(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : B;
    };

    // 19.1.3.6 Object.prototype.toString()

    var test = {};
    test[_wks('toStringTag')] = 'z';
    if (test + '' != '[object z]') {
      _redefine(Object.prototype, 'toString', function toString() {
        return '[object ' + _classof(this) + ']';
      }, true);
    }

    // fast apply, http://jsperf.lnkit.com/fast-apply/5
    var _invoke = function (fn, args, that) {
      var un = that === undefined;
      switch (args.length) {
        case 0: return un ? fn()
                          : fn.call(that);
        case 1: return un ? fn(args[0])
                          : fn.call(that, args[0]);
        case 2: return un ? fn(args[0], args[1])
                          : fn.call(that, args[0], args[1]);
        case 3: return un ? fn(args[0], args[1], args[2])
                          : fn.call(that, args[0], args[1], args[2]);
        case 4: return un ? fn(args[0], args[1], args[2], args[3])
                          : fn.call(that, args[0], args[1], args[2], args[3]);
      } return fn.apply(that, args);
    };

    var arraySlice = [].slice;
    var factories = {};

    var construct = function (F, len, args) {
      if (!(len in factories)) {
        for (var n = [], i = 0; i < len; i++) n[i] = 'a[' + i + ']';
        // eslint-disable-next-line no-new-func
        factories[len] = Function('F,a', 'return new F(' + n.join(',') + ')');
      } return factories[len](F, args);
    };

    var _bind = Function.bind || function bind(that /* , ...args */) {
      var fn = _aFunction(this);
      var partArgs = arraySlice.call(arguments, 1);
      var bound = function (/* args... */) {
        var args = partArgs.concat(arraySlice.call(arguments));
        return this instanceof bound ? construct(fn, args.length, args) : _invoke(fn, args, that);
      };
      if (_isObject(fn.prototype)) bound.prototype = fn.prototype;
      return bound;
    };

    // 19.2.3.2 / 15.3.4.5 Function.prototype.bind(thisArg, args...)


    _export(_export.P, 'Function', { bind: _bind });

    var dP$2 = _objectDp.f;
    var FProto = Function.prototype;
    var nameRE = /^\s*function ([^ (]*)/;
    var NAME = 'name';

    // 19.2.4.2 name
    NAME in FProto || _descriptors && dP$2(FProto, NAME, {
      configurable: true,
      get: function () {
        try {
          return ('' + this).match(nameRE)[1];
        } catch (e) {
          return '';
        }
      }
    });

    var HAS_INSTANCE = _wks('hasInstance');
    var FunctionProto = Function.prototype;
    // 19.2.3.6 Function.prototype[@@hasInstance](V)
    if (!(HAS_INSTANCE in FunctionProto)) _objectDp.f(FunctionProto, HAS_INSTANCE, { value: function (O) {
      if (typeof this != 'function' || !_isObject(O)) return false;
      if (!_isObject(this.prototype)) return O instanceof this;
      // for environment w/o native `@@hasInstance` logic enough `instanceof`, but add this:
      while (O = _objectGpo(O)) if (this.prototype === O) return true;
      return false;
    } });

    var _stringWs = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003' +
      '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

    var space = '[' + _stringWs + ']';
    var non = '\u200b\u0085';
    var ltrim = RegExp('^' + space + space + '*');
    var rtrim = RegExp(space + space + '*$');

    var exporter = function (KEY, exec, ALIAS) {
      var exp = {};
      var FORCE = _fails(function () {
        return !!_stringWs[KEY]() || non[KEY]() != non;
      });
      var fn = exp[KEY] = FORCE ? exec(trim) : _stringWs[KEY];
      if (ALIAS) exp[ALIAS] = fn;
      _export(_export.P + _export.F * FORCE, 'String', exp);
    };

    // 1 -> String#trimLeft
    // 2 -> String#trimRight
    // 3 -> String#trim
    var trim = exporter.trim = function (string, TYPE) {
      string = String(_defined(string));
      if (TYPE & 1) string = string.replace(ltrim, '');
      if (TYPE & 2) string = string.replace(rtrim, '');
      return string;
    };

    var _stringTrim = exporter;

    var $parseInt = _global.parseInt;
    var $trim = _stringTrim.trim;

    var hex = /^[-+]?0[xX]/;

    var _parseInt = $parseInt(_stringWs + '08') !== 8 || $parseInt(_stringWs + '0x16') !== 22 ? function parseInt(str, radix) {
      var string = $trim(String(str), 3);
      return $parseInt(string, (radix >>> 0) || (hex.test(string) ? 16 : 10));
    } : $parseInt;

    // 18.2.5 parseInt(string, radix)
    _export(_export.G + _export.F * (parseInt != _parseInt), { parseInt: _parseInt });

    var $parseFloat = _global.parseFloat;
    var $trim$1 = _stringTrim.trim;

    var _parseFloat = 1 / $parseFloat(_stringWs + '-0') !== -Infinity ? function parseFloat(str) {
      var string = $trim$1(String(str), 3);
      var result = $parseFloat(string);
      return result === 0 && string.charAt(0) == '-' ? -0 : result;
    } : $parseFloat;

    // 18.2.4 parseFloat(string)
    _export(_export.G + _export.F * (parseFloat != _parseFloat), { parseFloat: _parseFloat });

    var setPrototypeOf = _setProto.set;
    var _inheritIfRequired = function (that, target, C) {
      var S = target.constructor;
      var P;
      if (S !== C && typeof S == 'function' && (P = S.prototype) !== C.prototype && _isObject(P) && setPrototypeOf) {
        setPrototypeOf(that, P);
      } return that;
    };

    var gOPN$2 = _objectGopn.f;
    var gOPD$2 = _objectGopd.f;
    var dP$3 = _objectDp.f;
    var $trim$2 = _stringTrim.trim;
    var NUMBER = 'Number';
    var $Number = _global[NUMBER];
    var Base = $Number;
    var proto = $Number.prototype;
    // Opera ~12 has broken Object#toString
    var BROKEN_COF = _cof(_objectCreate(proto)) == NUMBER;
    var TRIM = 'trim' in String.prototype;

    // 7.1.3 ToNumber(argument)
    var toNumber = function (argument) {
      var it = _toPrimitive(argument, false);
      if (typeof it == 'string' && it.length > 2) {
        it = TRIM ? it.trim() : $trim$2(it, 3);
        var first = it.charCodeAt(0);
        var third, radix, maxCode;
        if (first === 43 || first === 45) {
          third = it.charCodeAt(2);
          if (third === 88 || third === 120) return NaN; // Number('+0x1') should be NaN, old V8 fix
        } else if (first === 48) {
          switch (it.charCodeAt(1)) {
            case 66: case 98: radix = 2; maxCode = 49; break; // fast equal /^0b[01]+$/i
            case 79: case 111: radix = 8; maxCode = 55; break; // fast equal /^0o[0-7]+$/i
            default: return +it;
          }
          for (var digits = it.slice(2), i = 0, l = digits.length, code; i < l; i++) {
            code = digits.charCodeAt(i);
            // parseInt parses a string to a first unavailable symbol
            // but ToNumber should return NaN if a string contains unavailable symbols
            if (code < 48 || code > maxCode) return NaN;
          } return parseInt(digits, radix);
        }
      } return +it;
    };

    if (!$Number(' 0o1') || !$Number('0b1') || $Number('+0x1')) {
      $Number = function Number(value) {
        var it = arguments.length < 1 ? 0 : value;
        var that = this;
        return that instanceof $Number
          // check on 1..constructor(foo) case
          && (BROKEN_COF ? _fails(function () { proto.valueOf.call(that); }) : _cof(that) != NUMBER)
            ? _inheritIfRequired(new Base(toNumber(it)), that, $Number) : toNumber(it);
      };
      for (var keys = _descriptors ? gOPN$2(Base) : (
        // ES3:
        'MAX_VALUE,MIN_VALUE,NaN,NEGATIVE_INFINITY,POSITIVE_INFINITY,' +
        // ES6 (in case, if modules with ES6 Number statics required before):
        'EPSILON,isFinite,isInteger,isNaN,isSafeInteger,MAX_SAFE_INTEGER,' +
        'MIN_SAFE_INTEGER,parseFloat,parseInt,isInteger'
      ).split(','), j$1 = 0, key; keys.length > j$1; j$1++) {
        if (_has(Base, key = keys[j$1]) && !_has($Number, key)) {
          dP$3($Number, key, gOPD$2(Base, key));
        }
      }
      $Number.prototype = proto;
      proto.constructor = $Number;
      _redefine(_global, NUMBER, $Number);
    }

    var _aNumberValue = function (it, msg) {
      if (typeof it != 'number' && _cof(it) != 'Number') throw TypeError(msg);
      return +it;
    };

    var _stringRepeat = function repeat(count) {
      var str = String(_defined(this));
      var res = '';
      var n = _toInteger(count);
      if (n < 0 || n == Infinity) throw RangeError("Count can't be negative");
      for (;n > 0; (n >>>= 1) && (str += str)) if (n & 1) res += str;
      return res;
    };

    var $toFixed = 1.0.toFixed;
    var floor$1 = Math.floor;
    var data = [0, 0, 0, 0, 0, 0];
    var ERROR = 'Number.toFixed: incorrect invocation!';
    var ZERO = '0';

    var multiply = function (n, c) {
      var i = -1;
      var c2 = c;
      while (++i < 6) {
        c2 += n * data[i];
        data[i] = c2 % 1e7;
        c2 = floor$1(c2 / 1e7);
      }
    };
    var divide = function (n) {
      var i = 6;
      var c = 0;
      while (--i >= 0) {
        c += data[i];
        data[i] = floor$1(c / n);
        c = (c % n) * 1e7;
      }
    };
    var numToString = function () {
      var i = 6;
      var s = '';
      while (--i >= 0) {
        if (s !== '' || i === 0 || data[i] !== 0) {
          var t = String(data[i]);
          s = s === '' ? t : s + _stringRepeat.call(ZERO, 7 - t.length) + t;
        }
      } return s;
    };
    var pow = function (x, n, acc) {
      return n === 0 ? acc : n % 2 === 1 ? pow(x, n - 1, acc * x) : pow(x * x, n / 2, acc);
    };
    var log = function (x) {
      var n = 0;
      var x2 = x;
      while (x2 >= 4096) {
        n += 12;
        x2 /= 4096;
      }
      while (x2 >= 2) {
        n += 1;
        x2 /= 2;
      } return n;
    };

    _export(_export.P + _export.F * (!!$toFixed && (
      0.00008.toFixed(3) !== '0.000' ||
      0.9.toFixed(0) !== '1' ||
      1.255.toFixed(2) !== '1.25' ||
      1000000000000000128.0.toFixed(0) !== '1000000000000000128'
    ) || !_fails(function () {
      // V8 ~ Android 4.3-
      $toFixed.call({});
    })), 'Number', {
      toFixed: function toFixed(fractionDigits) {
        var x = _aNumberValue(this, ERROR);
        var f = _toInteger(fractionDigits);
        var s = '';
        var m = ZERO;
        var e, z, j, k;
        if (f < 0 || f > 20) throw RangeError(ERROR);
        // eslint-disable-next-line no-self-compare
        if (x != x) return 'NaN';
        if (x <= -1e21 || x >= 1e21) return String(x);
        if (x < 0) {
          s = '-';
          x = -x;
        }
        if (x > 1e-21) {
          e = log(x * pow(2, 69, 1)) - 69;
          z = e < 0 ? x * pow(2, -e, 1) : x / pow(2, e, 1);
          z *= 0x10000000000000;
          e = 52 - e;
          if (e > 0) {
            multiply(0, z);
            j = f;
            while (j >= 7) {
              multiply(1e7, 0);
              j -= 7;
            }
            multiply(pow(10, j, 1), 0);
            j = e - 1;
            while (j >= 23) {
              divide(1 << 23);
              j -= 23;
            }
            divide(1 << j);
            multiply(1, 1);
            divide(2);
            m = numToString();
          } else {
            multiply(0, z);
            multiply(1 << -e, 0);
            m = numToString() + _stringRepeat.call(ZERO, f);
          }
        }
        if (f > 0) {
          k = m.length;
          m = s + (k <= f ? '0.' + _stringRepeat.call(ZERO, f - k) + m : m.slice(0, k - f) + '.' + m.slice(k - f));
        } else {
          m = s + m;
        } return m;
      }
    });

    var $toPrecision = 1.0.toPrecision;

    _export(_export.P + _export.F * (_fails(function () {
      // IE7-
      return $toPrecision.call(1, undefined) !== '1';
    }) || !_fails(function () {
      // V8 ~ Android 4.3-
      $toPrecision.call({});
    })), 'Number', {
      toPrecision: function toPrecision(precision) {
        var that = _aNumberValue(this, 'Number#toPrecision: incorrect invocation!');
        return precision === undefined ? $toPrecision.call(that) : $toPrecision.call(that, precision);
      }
    });

    // 20.1.2.1 Number.EPSILON


    _export(_export.S, 'Number', { EPSILON: Math.pow(2, -52) });

    // 20.1.2.2 Number.isFinite(number)

    var _isFinite = _global.isFinite;

    _export(_export.S, 'Number', {
      isFinite: function isFinite(it) {
        return typeof it == 'number' && _isFinite(it);
      }
    });

    // 20.1.2.3 Number.isInteger(number)

    var floor$2 = Math.floor;
    var _isInteger = function isInteger(it) {
      return !_isObject(it) && isFinite(it) && floor$2(it) === it;
    };

    // 20.1.2.3 Number.isInteger(number)


    _export(_export.S, 'Number', { isInteger: _isInteger });

    // 20.1.2.4 Number.isNaN(number)


    _export(_export.S, 'Number', {
      isNaN: function isNaN(number) {
        // eslint-disable-next-line no-self-compare
        return number != number;
      }
    });

    // 20.1.2.5 Number.isSafeInteger(number)


    var abs = Math.abs;

    _export(_export.S, 'Number', {
      isSafeInteger: function isSafeInteger(number) {
        return _isInteger(number) && abs(number) <= 0x1fffffffffffff;
      }
    });

    // 20.1.2.6 Number.MAX_SAFE_INTEGER


    _export(_export.S, 'Number', { MAX_SAFE_INTEGER: 0x1fffffffffffff });

    // 20.1.2.10 Number.MIN_SAFE_INTEGER


    _export(_export.S, 'Number', { MIN_SAFE_INTEGER: -0x1fffffffffffff });

    // 20.1.2.12 Number.parseFloat(string)
    _export(_export.S + _export.F * (Number.parseFloat != _parseFloat), 'Number', { parseFloat: _parseFloat });

    // 20.1.2.13 Number.parseInt(string, radix)
    _export(_export.S + _export.F * (Number.parseInt != _parseInt), 'Number', { parseInt: _parseInt });

    // 20.2.2.20 Math.log1p(x)
    var _mathLog1p = Math.log1p || function log1p(x) {
      return (x = +x) > -1e-8 && x < 1e-8 ? x - x * x / 2 : Math.log(1 + x);
    };

    // 20.2.2.3 Math.acosh(x)


    var sqrt = Math.sqrt;
    var $acosh = Math.acosh;

    _export(_export.S + _export.F * !($acosh
      // V8 bug: https://code.google.com/p/v8/issues/detail?id=3509
      && Math.floor($acosh(Number.MAX_VALUE)) == 710
      // Tor Browser bug: Math.acosh(Infinity) -> NaN
      && $acosh(Infinity) == Infinity
    ), 'Math', {
      acosh: function acosh(x) {
        return (x = +x) < 1 ? NaN : x > 94906265.62425156
          ? Math.log(x) + Math.LN2
          : _mathLog1p(x - 1 + sqrt(x - 1) * sqrt(x + 1));
      }
    });

    // 20.2.2.5 Math.asinh(x)

    var $asinh = Math.asinh;

    function asinh(x) {
      return !isFinite(x = +x) || x == 0 ? x : x < 0 ? -asinh(-x) : Math.log(x + Math.sqrt(x * x + 1));
    }

    // Tor Browser bug: Math.asinh(0) -> -0
    _export(_export.S + _export.F * !($asinh && 1 / $asinh(0) > 0), 'Math', { asinh: asinh });

    // 20.2.2.7 Math.atanh(x)

    var $atanh = Math.atanh;

    // Tor Browser bug: Math.atanh(-0) -> 0
    _export(_export.S + _export.F * !($atanh && 1 / $atanh(-0) < 0), 'Math', {
      atanh: function atanh(x) {
        return (x = +x) == 0 ? x : Math.log((1 + x) / (1 - x)) / 2;
      }
    });

    // 20.2.2.28 Math.sign(x)
    var _mathSign = Math.sign || function sign(x) {
      // eslint-disable-next-line no-self-compare
      return (x = +x) == 0 || x != x ? x : x < 0 ? -1 : 1;
    };

    // 20.2.2.9 Math.cbrt(x)



    _export(_export.S, 'Math', {
      cbrt: function cbrt(x) {
        return _mathSign(x = +x) * Math.pow(Math.abs(x), 1 / 3);
      }
    });

    // 20.2.2.11 Math.clz32(x)


    _export(_export.S, 'Math', {
      clz32: function clz32(x) {
        return (x >>>= 0) ? 31 - Math.floor(Math.log(x + 0.5) * Math.LOG2E) : 32;
      }
    });

    // 20.2.2.12 Math.cosh(x)

    var exp = Math.exp;

    _export(_export.S, 'Math', {
      cosh: function cosh(x) {
        return (exp(x = +x) + exp(-x)) / 2;
      }
    });

    // 20.2.2.14 Math.expm1(x)
    var $expm1 = Math.expm1;
    var _mathExpm1 = (!$expm1
      // Old FF bug
      || $expm1(10) > 22025.465794806719 || $expm1(10) < 22025.4657948067165168
      // Tor Browser bug
      || $expm1(-2e-17) != -2e-17
    ) ? function expm1(x) {
      return (x = +x) == 0 ? x : x > -1e-6 && x < 1e-6 ? x + x * x / 2 : Math.exp(x) - 1;
    } : $expm1;

    // 20.2.2.14 Math.expm1(x)



    _export(_export.S + _export.F * (_mathExpm1 != Math.expm1), 'Math', { expm1: _mathExpm1 });

    // 20.2.2.16 Math.fround(x)

    var pow$1 = Math.pow;
    var EPSILON = pow$1(2, -52);
    var EPSILON32 = pow$1(2, -23);
    var MAX32 = pow$1(2, 127) * (2 - EPSILON32);
    var MIN32 = pow$1(2, -126);

    var roundTiesToEven = function (n) {
      return n + 1 / EPSILON - 1 / EPSILON;
    };

    var _mathFround = Math.fround || function fround(x) {
      var $abs = Math.abs(x);
      var $sign = _mathSign(x);
      var a, result;
      if ($abs < MIN32) return $sign * roundTiesToEven($abs / MIN32 / EPSILON32) * MIN32 * EPSILON32;
      a = (1 + EPSILON32 / EPSILON) * $abs;
      result = a - (a - $abs);
      // eslint-disable-next-line no-self-compare
      if (result > MAX32 || result != result) return $sign * Infinity;
      return $sign * result;
    };

    // 20.2.2.16 Math.fround(x)


    _export(_export.S, 'Math', { fround: _mathFround });

    // 20.2.2.17 Math.hypot([value1[, value2[, … ]]])

    var abs$1 = Math.abs;

    _export(_export.S, 'Math', {
      hypot: function hypot(value1, value2) { // eslint-disable-line no-unused-vars
        var sum = 0;
        var i = 0;
        var aLen = arguments.length;
        var larg = 0;
        var arg, div;
        while (i < aLen) {
          arg = abs$1(arguments[i++]);
          if (larg < arg) {
            div = larg / arg;
            sum = sum * div * div + 1;
            larg = arg;
          } else if (arg > 0) {
            div = arg / larg;
            sum += div * div;
          } else sum += arg;
        }
        return larg === Infinity ? Infinity : larg * Math.sqrt(sum);
      }
    });

    // 20.2.2.18 Math.imul(x, y)

    var $imul = Math.imul;

    // some WebKit versions fails with big numbers, some has wrong arity
    _export(_export.S + _export.F * _fails(function () {
      return $imul(0xffffffff, 5) != -5 || $imul.length != 2;
    }), 'Math', {
      imul: function imul(x, y) {
        var UINT16 = 0xffff;
        var xn = +x;
        var yn = +y;
        var xl = UINT16 & xn;
        var yl = UINT16 & yn;
        return 0 | xl * yl + ((UINT16 & xn >>> 16) * yl + xl * (UINT16 & yn >>> 16) << 16 >>> 0);
      }
    });

    // 20.2.2.21 Math.log10(x)


    _export(_export.S, 'Math', {
      log10: function log10(x) {
        return Math.log(x) * Math.LOG10E;
      }
    });

    // 20.2.2.20 Math.log1p(x)


    _export(_export.S, 'Math', { log1p: _mathLog1p });

    // 20.2.2.22 Math.log2(x)


    _export(_export.S, 'Math', {
      log2: function log2(x) {
        return Math.log(x) / Math.LN2;
      }
    });

    // 20.2.2.28 Math.sign(x)


    _export(_export.S, 'Math', { sign: _mathSign });

    // 20.2.2.30 Math.sinh(x)


    var exp$1 = Math.exp;

    // V8 near Chromium 38 has a problem with very small numbers
    _export(_export.S + _export.F * _fails(function () {
      return !Math.sinh(-2e-17) != -2e-17;
    }), 'Math', {
      sinh: function sinh(x) {
        return Math.abs(x = +x) < 1
          ? (_mathExpm1(x) - _mathExpm1(-x)) / 2
          : (exp$1(x - 1) - exp$1(-x - 1)) * (Math.E / 2);
      }
    });

    // 20.2.2.33 Math.tanh(x)


    var exp$2 = Math.exp;

    _export(_export.S, 'Math', {
      tanh: function tanh(x) {
        var a = _mathExpm1(x = +x);
        var b = _mathExpm1(-x);
        return a == Infinity ? 1 : b == Infinity ? -1 : (a - b) / (exp$2(x) + exp$2(-x));
      }
    });

    // 20.2.2.34 Math.trunc(x)


    _export(_export.S, 'Math', {
      trunc: function trunc(it) {
        return (it > 0 ? Math.floor : Math.ceil)(it);
      }
    });

    var fromCharCode = String.fromCharCode;
    var $fromCodePoint = String.fromCodePoint;

    // length should be 1, old FF problem
    _export(_export.S + _export.F * (!!$fromCodePoint && $fromCodePoint.length != 1), 'String', {
      // 21.1.2.2 String.fromCodePoint(...codePoints)
      fromCodePoint: function fromCodePoint(x) { // eslint-disable-line no-unused-vars
        var res = [];
        var aLen = arguments.length;
        var i = 0;
        var code;
        while (aLen > i) {
          code = +arguments[i++];
          if (_toAbsoluteIndex(code, 0x10ffff) !== code) throw RangeError(code + ' is not a valid code point');
          res.push(code < 0x10000
            ? fromCharCode(code)
            : fromCharCode(((code -= 0x10000) >> 10) + 0xd800, code % 0x400 + 0xdc00)
          );
        } return res.join('');
      }
    });

    _export(_export.S, 'String', {
      // 21.1.2.4 String.raw(callSite, ...substitutions)
      raw: function raw(callSite) {
        var tpl = _toIobject(callSite.raw);
        var len = _toLength(tpl.length);
        var aLen = arguments.length;
        var res = [];
        var i = 0;
        while (len > i) {
          res.push(String(tpl[i++]));
          if (i < aLen) res.push(String(arguments[i]));
        } return res.join('');
      }
    });

    // 21.1.3.25 String.prototype.trim()
    _stringTrim('trim', function ($trim) {
      return function trim() {
        return $trim(this, 3);
      };
    });

    // true  -> String#at
    // false -> String#codePointAt
    var _stringAt = function (TO_STRING) {
      return function (that, pos) {
        var s = String(_defined(that));
        var i = _toInteger(pos);
        var l = s.length;
        var a, b;
        if (i < 0 || i >= l) return TO_STRING ? '' : undefined;
        a = s.charCodeAt(i);
        return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff
          ? TO_STRING ? s.charAt(i) : a
          : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
      };
    };

    var _iterators = {};

    var IteratorPrototype = {};

    // 25.1.2.1.1 %IteratorPrototype%[@@iterator]()
    _hide(IteratorPrototype, _wks('iterator'), function () { return this; });

    var _iterCreate = function (Constructor, NAME, next) {
      Constructor.prototype = _objectCreate(IteratorPrototype, { next: _propertyDesc(1, next) });
      _setToStringTag(Constructor, NAME + ' Iterator');
    };

    var ITERATOR = _wks('iterator');
    var BUGGY = !([].keys && 'next' in [].keys()); // Safari has buggy iterators w/o `next`
    var FF_ITERATOR = '@@iterator';
    var KEYS = 'keys';
    var VALUES = 'values';

    var returnThis = function () { return this; };

    var _iterDefine = function (Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCED) {
      _iterCreate(Constructor, NAME, next);
      var getMethod = function (kind) {
        if (!BUGGY && kind in proto) return proto[kind];
        switch (kind) {
          case KEYS: return function keys() { return new Constructor(this, kind); };
          case VALUES: return function values() { return new Constructor(this, kind); };
        } return function entries() { return new Constructor(this, kind); };
      };
      var TAG = NAME + ' Iterator';
      var DEF_VALUES = DEFAULT == VALUES;
      var VALUES_BUG = false;
      var proto = Base.prototype;
      var $native = proto[ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT];
      var $default = $native || getMethod(DEFAULT);
      var $entries = DEFAULT ? !DEF_VALUES ? $default : getMethod('entries') : undefined;
      var $anyNative = NAME == 'Array' ? proto.entries || $native : $native;
      var methods, key, IteratorPrototype;
      // Fix native
      if ($anyNative) {
        IteratorPrototype = _objectGpo($anyNative.call(new Base()));
        if (IteratorPrototype !== Object.prototype && IteratorPrototype.next) {
          // Set @@toStringTag to native iterators
          _setToStringTag(IteratorPrototype, TAG, true);
          // fix for some old engines
          if (!_library && typeof IteratorPrototype[ITERATOR] != 'function') _hide(IteratorPrototype, ITERATOR, returnThis);
        }
      }
      // fix Array#{values, @@iterator}.name in V8 / FF
      if (DEF_VALUES && $native && $native.name !== VALUES) {
        VALUES_BUG = true;
        $default = function values() { return $native.call(this); };
      }
      // Define iterator
      if ((!_library || FORCED) && (BUGGY || VALUES_BUG || !proto[ITERATOR])) {
        _hide(proto, ITERATOR, $default);
      }
      // Plug for library
      _iterators[NAME] = $default;
      _iterators[TAG] = returnThis;
      if (DEFAULT) {
        methods = {
          values: DEF_VALUES ? $default : getMethod(VALUES),
          keys: IS_SET ? $default : getMethod(KEYS),
          entries: $entries
        };
        if (FORCED) for (key in methods) {
          if (!(key in proto)) _redefine(proto, key, methods[key]);
        } else _export(_export.P + _export.F * (BUGGY || VALUES_BUG), NAME, methods);
      }
      return methods;
    };

    var $at = _stringAt(true);

    // 21.1.3.27 String.prototype[@@iterator]()
    _iterDefine(String, 'String', function (iterated) {
      this._t = String(iterated); // target
      this._i = 0;                // next index
    // 21.1.5.2.1 %StringIteratorPrototype%.next()
    }, function () {
      var O = this._t;
      var index = this._i;
      var point;
      if (index >= O.length) return { value: undefined, done: true };
      point = $at(O, index);
      this._i += point.length;
      return { value: point, done: false };
    });

    var $at$1 = _stringAt(false);
    _export(_export.P, 'String', {
      // 21.1.3.3 String.prototype.codePointAt(pos)
      codePointAt: function codePointAt(pos) {
        return $at$1(this, pos);
      }
    });

    // 7.2.8 IsRegExp(argument)


    var MATCH = _wks('match');
    var _isRegexp = function (it) {
      var isRegExp;
      return _isObject(it) && ((isRegExp = it[MATCH]) !== undefined ? !!isRegExp : _cof(it) == 'RegExp');
    };

    // helper for String#{startsWith, endsWith, includes}



    var _stringContext = function (that, searchString, NAME) {
      if (_isRegexp(searchString)) throw TypeError('String#' + NAME + " doesn't accept regex!");
      return String(_defined(that));
    };

    var MATCH$1 = _wks('match');
    var _failsIsRegexp = function (KEY) {
      var re = /./;
      try {
        '/./'[KEY](re);
      } catch (e) {
        try {
          re[MATCH$1] = false;
          return !'/./'[KEY](re);
        } catch (f) { /* empty */ }
      } return true;
    };

    var ENDS_WITH = 'endsWith';
    var $endsWith = ''[ENDS_WITH];

    _export(_export.P + _export.F * _failsIsRegexp(ENDS_WITH), 'String', {
      endsWith: function endsWith(searchString /* , endPosition = @length */) {
        var that = _stringContext(this, searchString, ENDS_WITH);
        var endPosition = arguments.length > 1 ? arguments[1] : undefined;
        var len = _toLength(that.length);
        var end = endPosition === undefined ? len : Math.min(_toLength(endPosition), len);
        var search = String(searchString);
        return $endsWith
          ? $endsWith.call(that, search, end)
          : that.slice(end - search.length, end) === search;
      }
    });

    var INCLUDES = 'includes';

    _export(_export.P + _export.F * _failsIsRegexp(INCLUDES), 'String', {
      includes: function includes(searchString /* , position = 0 */) {
        return !!~_stringContext(this, searchString, INCLUDES)
          .indexOf(searchString, arguments.length > 1 ? arguments[1] : undefined);
      }
    });

    _export(_export.P, 'String', {
      // 21.1.3.13 String.prototype.repeat(count)
      repeat: _stringRepeat
    });

    var STARTS_WITH = 'startsWith';
    var $startsWith = ''[STARTS_WITH];

    _export(_export.P + _export.F * _failsIsRegexp(STARTS_WITH), 'String', {
      startsWith: function startsWith(searchString /* , position = 0 */) {
        var that = _stringContext(this, searchString, STARTS_WITH);
        var index = _toLength(Math.min(arguments.length > 1 ? arguments[1] : undefined, that.length));
        var search = String(searchString);
        return $startsWith
          ? $startsWith.call(that, search, index)
          : that.slice(index, index + search.length) === search;
      }
    });

    var quot = /"/g;
    // B.2.3.2.1 CreateHTML(string, tag, attribute, value)
    var createHTML = function (string, tag, attribute, value) {
      var S = String(_defined(string));
      var p1 = '<' + tag;
      if (attribute !== '') p1 += ' ' + attribute + '="' + String(value).replace(quot, '&quot;') + '"';
      return p1 + '>' + S + '</' + tag + '>';
    };
    var _stringHtml = function (NAME, exec) {
      var O = {};
      O[NAME] = exec(createHTML);
      _export(_export.P + _export.F * _fails(function () {
        var test = ''[NAME]('"');
        return test !== test.toLowerCase() || test.split('"').length > 3;
      }), 'String', O);
    };

    // B.2.3.2 String.prototype.anchor(name)
    _stringHtml('anchor', function (createHTML) {
      return function anchor(name) {
        return createHTML(this, 'a', 'name', name);
      };
    });

    // B.2.3.3 String.prototype.big()
    _stringHtml('big', function (createHTML) {
      return function big() {
        return createHTML(this, 'big', '', '');
      };
    });

    // B.2.3.4 String.prototype.blink()
    _stringHtml('blink', function (createHTML) {
      return function blink() {
        return createHTML(this, 'blink', '', '');
      };
    });

    // B.2.3.5 String.prototype.bold()
    _stringHtml('bold', function (createHTML) {
      return function bold() {
        return createHTML(this, 'b', '', '');
      };
    });

    // B.2.3.6 String.prototype.fixed()
    _stringHtml('fixed', function (createHTML) {
      return function fixed() {
        return createHTML(this, 'tt', '', '');
      };
    });

    // B.2.3.7 String.prototype.fontcolor(color)
    _stringHtml('fontcolor', function (createHTML) {
      return function fontcolor(color) {
        return createHTML(this, 'font', 'color', color);
      };
    });

    // B.2.3.8 String.prototype.fontsize(size)
    _stringHtml('fontsize', function (createHTML) {
      return function fontsize(size) {
        return createHTML(this, 'font', 'size', size);
      };
    });

    // B.2.3.9 String.prototype.italics()
    _stringHtml('italics', function (createHTML) {
      return function italics() {
        return createHTML(this, 'i', '', '');
      };
    });

    // B.2.3.10 String.prototype.link(url)
    _stringHtml('link', function (createHTML) {
      return function link(url) {
        return createHTML(this, 'a', 'href', url);
      };
    });

    // B.2.3.11 String.prototype.small()
    _stringHtml('small', function (createHTML) {
      return function small() {
        return createHTML(this, 'small', '', '');
      };
    });

    // B.2.3.12 String.prototype.strike()
    _stringHtml('strike', function (createHTML) {
      return function strike() {
        return createHTML(this, 'strike', '', '');
      };
    });

    // B.2.3.13 String.prototype.sub()
    _stringHtml('sub', function (createHTML) {
      return function sub() {
        return createHTML(this, 'sub', '', '');
      };
    });

    // B.2.3.14 String.prototype.sup()
    _stringHtml('sup', function (createHTML) {
      return function sup() {
        return createHTML(this, 'sup', '', '');
      };
    });

    // 20.3.3.1 / 15.9.4.4 Date.now()


    _export(_export.S, 'Date', { now: function () { return new Date().getTime(); } });

    _export(_export.P + _export.F * _fails(function () {
      return new Date(NaN).toJSON() !== null
        || Date.prototype.toJSON.call({ toISOString: function () { return 1; } }) !== 1;
    }), 'Date', {
      // eslint-disable-next-line no-unused-vars
      toJSON: function toJSON(key) {
        var O = _toObject(this);
        var pv = _toPrimitive(O);
        return typeof pv == 'number' && !isFinite(pv) ? null : O.toISOString();
      }
    });

    // 20.3.4.36 / 15.9.5.43 Date.prototype.toISOString()

    var getTime = Date.prototype.getTime;
    var $toISOString = Date.prototype.toISOString;

    var lz = function (num) {
      return num > 9 ? num : '0' + num;
    };

    // PhantomJS / old WebKit has a broken implementations
    var _dateToIsoString = (_fails(function () {
      return $toISOString.call(new Date(-5e13 - 1)) != '0385-07-25T07:06:39.999Z';
    }) || !_fails(function () {
      $toISOString.call(new Date(NaN));
    })) ? function toISOString() {
      if (!isFinite(getTime.call(this))) throw RangeError('Invalid time value');
      var d = this;
      var y = d.getUTCFullYear();
      var m = d.getUTCMilliseconds();
      var s = y < 0 ? '-' : y > 9999 ? '+' : '';
      return s + ('00000' + Math.abs(y)).slice(s ? -6 : -4) +
        '-' + lz(d.getUTCMonth() + 1) + '-' + lz(d.getUTCDate()) +
        'T' + lz(d.getUTCHours()) + ':' + lz(d.getUTCMinutes()) +
        ':' + lz(d.getUTCSeconds()) + '.' + (m > 99 ? m : '0' + lz(m)) + 'Z';
    } : $toISOString;

    // 20.3.4.36 / 15.9.5.43 Date.prototype.toISOString()



    // PhantomJS / old WebKit has a broken implementations
    _export(_export.P + _export.F * (Date.prototype.toISOString !== _dateToIsoString), 'Date', {
      toISOString: _dateToIsoString
    });

    var DateProto = Date.prototype;
    var INVALID_DATE = 'Invalid Date';
    var TO_STRING = 'toString';
    var $toString = DateProto[TO_STRING];
    var getTime$1 = DateProto.getTime;
    if (new Date(NaN) + '' != INVALID_DATE) {
      _redefine(DateProto, TO_STRING, function toString() {
        var value = getTime$1.call(this);
        // eslint-disable-next-line no-self-compare
        return value === value ? $toString.call(this) : INVALID_DATE;
      });
    }

    var NUMBER$1 = 'number';

    var _dateToPrimitive = function (hint) {
      if (hint !== 'string' && hint !== NUMBER$1 && hint !== 'default') throw TypeError('Incorrect hint');
      return _toPrimitive(_anObject(this), hint != NUMBER$1);
    };

    var TO_PRIMITIVE$1 = _wks('toPrimitive');
    var proto$1 = Date.prototype;

    if (!(TO_PRIMITIVE$1 in proto$1)) _hide(proto$1, TO_PRIMITIVE$1, _dateToPrimitive);

    // 22.1.2.2 / 15.4.3.2 Array.isArray(arg)


    _export(_export.S, 'Array', { isArray: _isArray });

    // call something on iterator step with safe closing on error

    var _iterCall = function (iterator, fn, value, entries) {
      try {
        return entries ? fn(_anObject(value)[0], value[1]) : fn(value);
      // 7.4.6 IteratorClose(iterator, completion)
      } catch (e) {
        var ret = iterator['return'];
        if (ret !== undefined) _anObject(ret.call(iterator));
        throw e;
      }
    };

    // check on default Array iterator

    var ITERATOR$1 = _wks('iterator');
    var ArrayProto = Array.prototype;

    var _isArrayIter = function (it) {
      return it !== undefined && (_iterators.Array === it || ArrayProto[ITERATOR$1] === it);
    };

    var _createProperty = function (object, index, value) {
      if (index in object) _objectDp.f(object, index, _propertyDesc(0, value));
      else object[index] = value;
    };

    var ITERATOR$2 = _wks('iterator');

    var core_getIteratorMethod = _core.getIteratorMethod = function (it) {
      if (it != undefined) return it[ITERATOR$2]
        || it['@@iterator']
        || _iterators[_classof(it)];
    };

    var ITERATOR$3 = _wks('iterator');
    var SAFE_CLOSING = false;

    try {
      var riter = [7][ITERATOR$3]();
      riter['return'] = function () { SAFE_CLOSING = true; };
    } catch (e) { /* empty */ }

    var _iterDetect = function (exec, skipClosing) {
      if (!skipClosing && !SAFE_CLOSING) return false;
      var safe = false;
      try {
        var arr = [7];
        var iter = arr[ITERATOR$3]();
        iter.next = function () { return { done: safe = true }; };
        arr[ITERATOR$3] = function () { return iter; };
        exec(arr);
      } catch (e) { /* empty */ }
      return safe;
    };

    _export(_export.S + _export.F * !_iterDetect(function (iter) { }), 'Array', {
      // 22.1.2.1 Array.from(arrayLike, mapfn = undefined, thisArg = undefined)
      from: function from(arrayLike /* , mapfn = undefined, thisArg = undefined */) {
        var O = _toObject(arrayLike);
        var C = typeof this == 'function' ? this : Array;
        var aLen = arguments.length;
        var mapfn = aLen > 1 ? arguments[1] : undefined;
        var mapping = mapfn !== undefined;
        var index = 0;
        var iterFn = core_getIteratorMethod(O);
        var length, result, step, iterator;
        if (mapping) mapfn = _ctx(mapfn, aLen > 2 ? arguments[2] : undefined, 2);
        // if object isn't iterable or it's array with default iterator - use simple case
        if (iterFn != undefined && !(C == Array && _isArrayIter(iterFn))) {
          for (iterator = iterFn.call(O), result = new C(); !(step = iterator.next()).done; index++) {
            _createProperty(result, index, mapping ? _iterCall(iterator, mapfn, [step.value, index], true) : step.value);
          }
        } else {
          length = _toLength(O.length);
          for (result = new C(length); length > index; index++) {
            _createProperty(result, index, mapping ? mapfn(O[index], index) : O[index]);
          }
        }
        result.length = index;
        return result;
      }
    });

    // WebKit Array.of isn't generic
    _export(_export.S + _export.F * _fails(function () {
      function F() { /* empty */ }
      return !(Array.of.call(F) instanceof F);
    }), 'Array', {
      // 22.1.2.3 Array.of( ...items)
      of: function of(/* ...args */) {
        var index = 0;
        var aLen = arguments.length;
        var result = new (typeof this == 'function' ? this : Array)(aLen);
        while (aLen > index) _createProperty(result, index, arguments[index++]);
        result.length = aLen;
        return result;
      }
    });

    var _strictMethod = function (method, arg) {
      return !!method && _fails(function () {
        // eslint-disable-next-line no-useless-call
        arg ? method.call(null, function () { /* empty */ }, 1) : method.call(null);
      });
    };

    // 22.1.3.13 Array.prototype.join(separator)


    var arrayJoin = [].join;

    // fallback for not array-like strings
    _export(_export.P + _export.F * (_iobject != Object || !_strictMethod(arrayJoin)), 'Array', {
      join: function join(separator) {
        return arrayJoin.call(_toIobject(this), separator === undefined ? ',' : separator);
      }
    });

    var arraySlice$1 = [].slice;

    // fallback for not array-like ES3 strings and DOM objects
    _export(_export.P + _export.F * _fails(function () {
      if (_html) arraySlice$1.call(_html);
    }), 'Array', {
      slice: function slice(begin, end) {
        var len = _toLength(this.length);
        var klass = _cof(this);
        end = end === undefined ? len : end;
        if (klass == 'Array') return arraySlice$1.call(this, begin, end);
        var start = _toAbsoluteIndex(begin, len);
        var upTo = _toAbsoluteIndex(end, len);
        var size = _toLength(upTo - start);
        var cloned = new Array(size);
        var i = 0;
        for (; i < size; i++) cloned[i] = klass == 'String'
          ? this.charAt(start + i)
          : this[start + i];
        return cloned;
      }
    });

    var $sort = [].sort;
    var test$1 = [1, 2, 3];

    _export(_export.P + _export.F * (_fails(function () {
      // IE8-
      test$1.sort(undefined);
    }) || !_fails(function () {
      // V8 bug
      test$1.sort(null);
      // Old WebKit
    }) || !_strictMethod($sort)), 'Array', {
      // 22.1.3.25 Array.prototype.sort(comparefn)
      sort: function sort(comparefn) {
        return comparefn === undefined
          ? $sort.call(_toObject(this))
          : $sort.call(_toObject(this), _aFunction(comparefn));
      }
    });

    var SPECIES = _wks('species');

    var _arraySpeciesConstructor = function (original) {
      var C;
      if (_isArray(original)) {
        C = original.constructor;
        // cross-realm fallback
        if (typeof C == 'function' && (C === Array || _isArray(C.prototype))) C = undefined;
        if (_isObject(C)) {
          C = C[SPECIES];
          if (C === null) C = undefined;
        }
      } return C === undefined ? Array : C;
    };

    // 9.4.2.3 ArraySpeciesCreate(originalArray, length)


    var _arraySpeciesCreate = function (original, length) {
      return new (_arraySpeciesConstructor(original))(length);
    };

    // 0 -> Array#forEach
    // 1 -> Array#map
    // 2 -> Array#filter
    // 3 -> Array#some
    // 4 -> Array#every
    // 5 -> Array#find
    // 6 -> Array#findIndex





    var _arrayMethods = function (TYPE, $create) {
      var IS_MAP = TYPE == 1;
      var IS_FILTER = TYPE == 2;
      var IS_SOME = TYPE == 3;
      var IS_EVERY = TYPE == 4;
      var IS_FIND_INDEX = TYPE == 6;
      var NO_HOLES = TYPE == 5 || IS_FIND_INDEX;
      var create = $create || _arraySpeciesCreate;
      return function ($this, callbackfn, that) {
        var O = _toObject($this);
        var self = _iobject(O);
        var f = _ctx(callbackfn, that, 3);
        var length = _toLength(self.length);
        var index = 0;
        var result = IS_MAP ? create($this, length) : IS_FILTER ? create($this, 0) : undefined;
        var val, res;
        for (;length > index; index++) if (NO_HOLES || index in self) {
          val = self[index];
          res = f(val, index, O);
          if (TYPE) {
            if (IS_MAP) result[index] = res;   // map
            else if (res) switch (TYPE) {
              case 3: return true;             // some
              case 5: return val;              // find
              case 6: return index;            // findIndex
              case 2: result.push(val);        // filter
            } else if (IS_EVERY) return false; // every
          }
        }
        return IS_FIND_INDEX ? -1 : IS_SOME || IS_EVERY ? IS_EVERY : result;
      };
    };

    var $forEach = _arrayMethods(0);
    var STRICT = _strictMethod([].forEach, true);

    _export(_export.P + _export.F * !STRICT, 'Array', {
      // 22.1.3.10 / 15.4.4.18 Array.prototype.forEach(callbackfn [, thisArg])
      forEach: function forEach(callbackfn /* , thisArg */) {
        return $forEach(this, callbackfn, arguments[1]);
      }
    });

    var $map = _arrayMethods(1);

    _export(_export.P + _export.F * !_strictMethod([].map, true), 'Array', {
      // 22.1.3.15 / 15.4.4.19 Array.prototype.map(callbackfn [, thisArg])
      map: function map(callbackfn /* , thisArg */) {
        return $map(this, callbackfn, arguments[1]);
      }
    });

    var $filter = _arrayMethods(2);

    _export(_export.P + _export.F * !_strictMethod([].filter, true), 'Array', {
      // 22.1.3.7 / 15.4.4.20 Array.prototype.filter(callbackfn [, thisArg])
      filter: function filter(callbackfn /* , thisArg */) {
        return $filter(this, callbackfn, arguments[1]);
      }
    });

    var $some = _arrayMethods(3);

    _export(_export.P + _export.F * !_strictMethod([].some, true), 'Array', {
      // 22.1.3.23 / 15.4.4.17 Array.prototype.some(callbackfn [, thisArg])
      some: function some(callbackfn /* , thisArg */) {
        return $some(this, callbackfn, arguments[1]);
      }
    });

    var $every = _arrayMethods(4);

    _export(_export.P + _export.F * !_strictMethod([].every, true), 'Array', {
      // 22.1.3.5 / 15.4.4.16 Array.prototype.every(callbackfn [, thisArg])
      every: function every(callbackfn /* , thisArg */) {
        return $every(this, callbackfn, arguments[1]);
      }
    });

    var _arrayReduce = function (that, callbackfn, aLen, memo, isRight) {
      _aFunction(callbackfn);
      var O = _toObject(that);
      var self = _iobject(O);
      var length = _toLength(O.length);
      var index = isRight ? length - 1 : 0;
      var i = isRight ? -1 : 1;
      if (aLen < 2) for (;;) {
        if (index in self) {
          memo = self[index];
          index += i;
          break;
        }
        index += i;
        if (isRight ? index < 0 : length <= index) {
          throw TypeError('Reduce of empty array with no initial value');
        }
      }
      for (;isRight ? index >= 0 : length > index; index += i) if (index in self) {
        memo = callbackfn(memo, self[index], index, O);
      }
      return memo;
    };

    _export(_export.P + _export.F * !_strictMethod([].reduce, true), 'Array', {
      // 22.1.3.18 / 15.4.4.21 Array.prototype.reduce(callbackfn [, initialValue])
      reduce: function reduce(callbackfn /* , initialValue */) {
        return _arrayReduce(this, callbackfn, arguments.length, arguments[1], false);
      }
    });

    _export(_export.P + _export.F * !_strictMethod([].reduceRight, true), 'Array', {
      // 22.1.3.19 / 15.4.4.22 Array.prototype.reduceRight(callbackfn [, initialValue])
      reduceRight: function reduceRight(callbackfn /* , initialValue */) {
        return _arrayReduce(this, callbackfn, arguments.length, arguments[1], true);
      }
    });

    var $indexOf = _arrayIncludes(false);
    var $native = [].indexOf;
    var NEGATIVE_ZERO = !!$native && 1 / [1].indexOf(1, -0) < 0;

    _export(_export.P + _export.F * (NEGATIVE_ZERO || !_strictMethod($native)), 'Array', {
      // 22.1.3.11 / 15.4.4.14 Array.prototype.indexOf(searchElement [, fromIndex])
      indexOf: function indexOf(searchElement /* , fromIndex = 0 */) {
        return NEGATIVE_ZERO
          // convert -0 to +0
          ? $native.apply(this, arguments) || 0
          : $indexOf(this, searchElement, arguments[1]);
      }
    });

    var $native$1 = [].lastIndexOf;
    var NEGATIVE_ZERO$1 = !!$native$1 && 1 / [1].lastIndexOf(1, -0) < 0;

    _export(_export.P + _export.F * (NEGATIVE_ZERO$1 || !_strictMethod($native$1)), 'Array', {
      // 22.1.3.14 / 15.4.4.15 Array.prototype.lastIndexOf(searchElement [, fromIndex])
      lastIndexOf: function lastIndexOf(searchElement /* , fromIndex = @[*-1] */) {
        // convert -0 to +0
        if (NEGATIVE_ZERO$1) return $native$1.apply(this, arguments) || 0;
        var O = _toIobject(this);
        var length = _toLength(O.length);
        var index = length - 1;
        if (arguments.length > 1) index = Math.min(index, _toInteger(arguments[1]));
        if (index < 0) index = length + index;
        for (;index >= 0; index--) if (index in O) if (O[index] === searchElement) return index || 0;
        return -1;
      }
    });

    var _arrayCopyWithin = [].copyWithin || function copyWithin(target /* = 0 */, start /* = 0, end = @length */) {
      var O = _toObject(this);
      var len = _toLength(O.length);
      var to = _toAbsoluteIndex(target, len);
      var from = _toAbsoluteIndex(start, len);
      var end = arguments.length > 2 ? arguments[2] : undefined;
      var count = Math.min((end === undefined ? len : _toAbsoluteIndex(end, len)) - from, len - to);
      var inc = 1;
      if (from < to && to < from + count) {
        inc = -1;
        from += count - 1;
        to += count - 1;
      }
      while (count-- > 0) {
        if (from in O) O[to] = O[from];
        else delete O[to];
        to += inc;
        from += inc;
      } return O;
    };

    // 22.1.3.31 Array.prototype[@@unscopables]
    var UNSCOPABLES = _wks('unscopables');
    var ArrayProto$1 = Array.prototype;
    if (ArrayProto$1[UNSCOPABLES] == undefined) _hide(ArrayProto$1, UNSCOPABLES, {});
    var _addToUnscopables = function (key) {
      ArrayProto$1[UNSCOPABLES][key] = true;
    };

    // 22.1.3.3 Array.prototype.copyWithin(target, start, end = this.length)


    _export(_export.P, 'Array', { copyWithin: _arrayCopyWithin });

    _addToUnscopables('copyWithin');

    var _arrayFill = function fill(value /* , start = 0, end = @length */) {
      var O = _toObject(this);
      var length = _toLength(O.length);
      var aLen = arguments.length;
      var index = _toAbsoluteIndex(aLen > 1 ? arguments[1] : undefined, length);
      var end = aLen > 2 ? arguments[2] : undefined;
      var endPos = end === undefined ? length : _toAbsoluteIndex(end, length);
      while (endPos > index) O[index++] = value;
      return O;
    };

    // 22.1.3.6 Array.prototype.fill(value, start = 0, end = this.length)


    _export(_export.P, 'Array', { fill: _arrayFill });

    _addToUnscopables('fill');

    // 22.1.3.8 Array.prototype.find(predicate, thisArg = undefined)

    var $find = _arrayMethods(5);
    var KEY = 'find';
    var forced = true;
    // Shouldn't skip holes
    if (KEY in []) Array(1)[KEY](function () { forced = false; });
    _export(_export.P + _export.F * forced, 'Array', {
      find: function find(callbackfn /* , that = undefined */) {
        return $find(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
      }
    });
    _addToUnscopables(KEY);

    // 22.1.3.9 Array.prototype.findIndex(predicate, thisArg = undefined)

    var $find$1 = _arrayMethods(6);
    var KEY$1 = 'findIndex';
    var forced$1 = true;
    // Shouldn't skip holes
    if (KEY$1 in []) Array(1)[KEY$1](function () { forced$1 = false; });
    _export(_export.P + _export.F * forced$1, 'Array', {
      findIndex: function findIndex(callbackfn /* , that = undefined */) {
        return $find$1(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
      }
    });
    _addToUnscopables(KEY$1);

    var SPECIES$1 = _wks('species');

    var _setSpecies = function (KEY) {
      var C = _global[KEY];
      if (_descriptors && C && !C[SPECIES$1]) _objectDp.f(C, SPECIES$1, {
        configurable: true,
        get: function () { return this; }
      });
    };

    _setSpecies('Array');

    var _iterStep = function (done, value) {
      return { value: value, done: !!done };
    };

    // 22.1.3.4 Array.prototype.entries()
    // 22.1.3.13 Array.prototype.keys()
    // 22.1.3.29 Array.prototype.values()
    // 22.1.3.30 Array.prototype[@@iterator]()
    var es6_array_iterator = _iterDefine(Array, 'Array', function (iterated, kind) {
      this._t = _toIobject(iterated); // target
      this._i = 0;                   // next index
      this._k = kind;                // kind
    // 22.1.5.2.1 %ArrayIteratorPrototype%.next()
    }, function () {
      var O = this._t;
      var kind = this._k;
      var index = this._i++;
      if (!O || index >= O.length) {
        this._t = undefined;
        return _iterStep(1);
      }
      if (kind == 'keys') return _iterStep(0, index);
      if (kind == 'values') return _iterStep(0, O[index]);
      return _iterStep(0, [index, O[index]]);
    }, 'values');

    // argumentsList[@@iterator] is %ArrayProto_values% (9.4.4.6, 9.4.4.7)
    _iterators.Arguments = _iterators.Array;

    _addToUnscopables('keys');
    _addToUnscopables('values');
    _addToUnscopables('entries');

    // 21.2.5.3 get RegExp.prototype.flags

    var _flags = function () {
      var that = _anObject(this);
      var result = '';
      if (that.global) result += 'g';
      if (that.ignoreCase) result += 'i';
      if (that.multiline) result += 'm';
      if (that.unicode) result += 'u';
      if (that.sticky) result += 'y';
      return result;
    };

    var dP$4 = _objectDp.f;
    var gOPN$3 = _objectGopn.f;


    var $RegExp = _global.RegExp;
    var Base$1 = $RegExp;
    var proto$2 = $RegExp.prototype;
    var re1 = /a/g;
    var re2 = /a/g;
    // "new" creates a new object, old webkit buggy here
    var CORRECT_NEW = new $RegExp(re1) !== re1;

    if (_descriptors && (!CORRECT_NEW || _fails(function () {
      re2[_wks('match')] = false;
      // RegExp constructor can alter flags and IsRegExp works correct with @@match
      return $RegExp(re1) != re1 || $RegExp(re2) == re2 || $RegExp(re1, 'i') != '/a/i';
    }))) {
      $RegExp = function RegExp(p, f) {
        var tiRE = this instanceof $RegExp;
        var piRE = _isRegexp(p);
        var fiU = f === undefined;
        return !tiRE && piRE && p.constructor === $RegExp && fiU ? p
          : _inheritIfRequired(CORRECT_NEW
            ? new Base$1(piRE && !fiU ? p.source : p, f)
            : Base$1((piRE = p instanceof $RegExp) ? p.source : p, piRE && fiU ? _flags.call(p) : f)
          , tiRE ? this : proto$2, $RegExp);
      };
      var proxy = function (key) {
        key in $RegExp || dP$4($RegExp, key, {
          configurable: true,
          get: function () { return Base$1[key]; },
          set: function (it) { Base$1[key] = it; }
        });
      };
      for (var keys$1 = gOPN$3(Base$1), i = 0; keys$1.length > i;) proxy(keys$1[i++]);
      proto$2.constructor = $RegExp;
      $RegExp.prototype = proto$2;
      _redefine(_global, 'RegExp', $RegExp);
    }

    _setSpecies('RegExp');

    var nativeExec = RegExp.prototype.exec;
    // This always refers to the native implementation, because the
    // String#replace polyfill uses ./fix-regexp-well-known-symbol-logic.js,
    // which loads this file before patching the method.
    var nativeReplace = String.prototype.replace;

    var patchedExec = nativeExec;

    var LAST_INDEX = 'lastIndex';

    var UPDATES_LAST_INDEX_WRONG = (function () {
      var re1 = /a/,
          re2 = /b*/g;
      nativeExec.call(re1, 'a');
      nativeExec.call(re2, 'a');
      return re1[LAST_INDEX] !== 0 || re2[LAST_INDEX] !== 0;
    })();

    // nonparticipating capturing group, copied from es5-shim's String#split patch.
    var NPCG_INCLUDED = /()??/.exec('')[1] !== undefined;

    var PATCH = UPDATES_LAST_INDEX_WRONG || NPCG_INCLUDED;

    if (PATCH) {
      patchedExec = function exec(str) {
        var re = this;
        var lastIndex, reCopy, match, i;

        if (NPCG_INCLUDED) {
          reCopy = new RegExp('^' + re.source + '$(?!\\s)', _flags.call(re));
        }
        if (UPDATES_LAST_INDEX_WRONG) lastIndex = re[LAST_INDEX];

        match = nativeExec.call(re, str);

        if (UPDATES_LAST_INDEX_WRONG && match) {
          re[LAST_INDEX] = re.global ? match.index + match[0].length : lastIndex;
        }
        if (NPCG_INCLUDED && match && match.length > 1) {
          // Fix browsers whose `exec` methods don't consistently return `undefined`
          // for NPCG, like IE8. NOTE: This doesn' work for /(.?)?/
          // eslint-disable-next-line no-loop-func
          nativeReplace.call(match[0], reCopy, function () {
            for (i = 1; i < arguments.length - 2; i++) {
              if (arguments[i] === undefined) match[i] = undefined;
            }
          });
        }

        return match;
      };
    }

    var _regexpExec = patchedExec;

    _export({
      target: 'RegExp',
      proto: true,
      forced: _regexpExec !== /./.exec
    }, {
      exec: _regexpExec
    });

    // 21.2.5.3 get RegExp.prototype.flags()
    if (_descriptors && /./g.flags != 'g') _objectDp.f(RegExp.prototype, 'flags', {
      configurable: true,
      get: _flags
    });

    var TO_STRING$1 = 'toString';
    var $toString$1 = /./[TO_STRING$1];

    var define = function (fn) {
      _redefine(RegExp.prototype, TO_STRING$1, fn, true);
    };

    // 21.2.5.14 RegExp.prototype.toString()
    if (_fails(function () { return $toString$1.call({ source: 'a', flags: 'b' }) != '/a/b'; })) {
      define(function toString() {
        var R = _anObject(this);
        return '/'.concat(R.source, '/',
          'flags' in R ? R.flags : !_descriptors && R instanceof RegExp ? _flags.call(R) : undefined);
      });
    // FF44- RegExp#toString has a wrong name
    } else if ($toString$1.name != TO_STRING$1) {
      define(function toString() {
        return $toString$1.call(this);
      });
    }

    var at = _stringAt(true);

     // `AdvanceStringIndex` abstract operation
    // https://tc39.github.io/ecma262/#sec-advancestringindex
    var _advanceStringIndex = function (S, index, unicode) {
      return index + (unicode ? at(S, index).length : 1);
    };

    var builtinExec = RegExp.prototype.exec;

     // `RegExpExec` abstract operation
    // https://tc39.github.io/ecma262/#sec-regexpexec
    var _regexpExecAbstract = function (R, S) {
      var exec = R.exec;
      if (typeof exec === 'function') {
        var result = exec.call(R, S);
        if (typeof result !== 'object') {
          throw new TypeError('RegExp exec method returned something other than an Object or null');
        }
        return result;
      }
      if (_classof(R) !== 'RegExp') {
        throw new TypeError('RegExp#exec called on incompatible receiver');
      }
      return builtinExec.call(R, S);
    };

    var SPECIES$2 = _wks('species');

    var REPLACE_SUPPORTS_NAMED_GROUPS = !_fails(function () {
      // #replace needs built-in support for named groups.
      // #match works fine because it just return the exec results, even if it has
      // a "grops" property.
      var re = /./;
      re.exec = function () {
        var result = [];
        result.groups = { a: '7' };
        return result;
      };
      return ''.replace(re, '$<a>') !== '7';
    });

    var SPLIT_WORKS_WITH_OVERWRITTEN_EXEC = (function () {
      // Chrome 51 has a buggy "split" implementation when RegExp#exec !== nativeExec
      var re = /(?:)/;
      var originalExec = re.exec;
      re.exec = function () { return originalExec.apply(this, arguments); };
      var result = 'ab'.split(re);
      return result.length === 2 && result[0] === 'a' && result[1] === 'b';
    })();

    var _fixReWks = function (KEY, length, exec) {
      var SYMBOL = _wks(KEY);

      var DELEGATES_TO_SYMBOL = !_fails(function () {
        // String methods call symbol-named RegEp methods
        var O = {};
        O[SYMBOL] = function () { return 7; };
        return ''[KEY](O) != 7;
      });

      var DELEGATES_TO_EXEC = DELEGATES_TO_SYMBOL ? !_fails(function () {
        // Symbol-named RegExp methods call .exec
        var execCalled = false;
        var re = /a/;
        re.exec = function () { execCalled = true; return null; };
        if (KEY === 'split') {
          // RegExp[@@split] doesn't call the regex's exec method, but first creates
          // a new one. We need to return the patched regex when creating the new one.
          re.constructor = {};
          re.constructor[SPECIES$2] = function () { return re; };
        }
        re[SYMBOL]('');
        return !execCalled;
      }) : undefined;

      if (
        !DELEGATES_TO_SYMBOL ||
        !DELEGATES_TO_EXEC ||
        (KEY === 'replace' && !REPLACE_SUPPORTS_NAMED_GROUPS) ||
        (KEY === 'split' && !SPLIT_WORKS_WITH_OVERWRITTEN_EXEC)
      ) {
        var nativeRegExpMethod = /./[SYMBOL];
        var fns = exec(
          _defined,
          SYMBOL,
          ''[KEY],
          function maybeCallNative(nativeMethod, regexp, str, arg2, forceStringMethod) {
            if (regexp.exec === _regexpExec) {
              if (DELEGATES_TO_SYMBOL && !forceStringMethod) {
                // The native String method already delegates to @@method (this
                // polyfilled function), leasing to infinite recursion.
                // We avoid it by directly calling the native @@method method.
                return { done: true, value: nativeRegExpMethod.call(regexp, str, arg2) };
              }
              return { done: true, value: nativeMethod.call(str, regexp, arg2) };
            }
            return { done: false };
          }
        );
        var strfn = fns[0];
        var rxfn = fns[1];

        _redefine(String.prototype, KEY, strfn);
        _hide(RegExp.prototype, SYMBOL, length == 2
          // 21.2.5.8 RegExp.prototype[@@replace](string, replaceValue)
          // 21.2.5.11 RegExp.prototype[@@split](string, limit)
          ? function (string, arg) { return rxfn.call(string, this, arg); }
          // 21.2.5.6 RegExp.prototype[@@match](string)
          // 21.2.5.9 RegExp.prototype[@@search](string)
          : function (string) { return rxfn.call(string, this); }
        );
      }
    };

    // @@match logic
    _fixReWks('match', 1, function (defined, MATCH, $match, maybeCallNative) {
      return [
        // `String.prototype.match` method
        // https://tc39.github.io/ecma262/#sec-string.prototype.match
        function match(regexp) {
          var O = defined(this);
          var fn = regexp == undefined ? undefined : regexp[MATCH];
          return fn !== undefined ? fn.call(regexp, O) : new RegExp(regexp)[MATCH](String(O));
        },
        // `RegExp.prototype[@@match]` method
        // https://tc39.github.io/ecma262/#sec-regexp.prototype-@@match
        function (regexp) {
          var res = maybeCallNative($match, regexp, this);
          if (res.done) return res.value;
          var rx = _anObject(regexp);
          var S = String(this);
          if (!rx.global) return _regexpExecAbstract(rx, S);
          var fullUnicode = rx.unicode;
          rx.lastIndex = 0;
          var A = [];
          var n = 0;
          var result;
          while ((result = _regexpExecAbstract(rx, S)) !== null) {
            var matchStr = String(result[0]);
            A[n] = matchStr;
            if (matchStr === '') rx.lastIndex = _advanceStringIndex(S, _toLength(rx.lastIndex), fullUnicode);
            n++;
          }
          return n === 0 ? null : A;
        }
      ];
    });

    var max$1 = Math.max;
    var min$2 = Math.min;
    var floor$3 = Math.floor;
    var SUBSTITUTION_SYMBOLS = /\$([$&`']|\d\d?|<[^>]*>)/g;
    var SUBSTITUTION_SYMBOLS_NO_NAMED = /\$([$&`']|\d\d?)/g;

    var maybeToString = function (it) {
      return it === undefined ? it : String(it);
    };

    // @@replace logic
    _fixReWks('replace', 2, function (defined, REPLACE, $replace, maybeCallNative) {
      return [
        // `String.prototype.replace` method
        // https://tc39.github.io/ecma262/#sec-string.prototype.replace
        function replace(searchValue, replaceValue) {
          var O = defined(this);
          var fn = searchValue == undefined ? undefined : searchValue[REPLACE];
          return fn !== undefined
            ? fn.call(searchValue, O, replaceValue)
            : $replace.call(String(O), searchValue, replaceValue);
        },
        // `RegExp.prototype[@@replace]` method
        // https://tc39.github.io/ecma262/#sec-regexp.prototype-@@replace
        function (regexp, replaceValue) {
          var res = maybeCallNative($replace, regexp, this, replaceValue);
          if (res.done) return res.value;

          var rx = _anObject(regexp);
          var S = String(this);
          var functionalReplace = typeof replaceValue === 'function';
          if (!functionalReplace) replaceValue = String(replaceValue);
          var global = rx.global;
          if (global) {
            var fullUnicode = rx.unicode;
            rx.lastIndex = 0;
          }
          var results = [];
          while (true) {
            var result = _regexpExecAbstract(rx, S);
            if (result === null) break;
            results.push(result);
            if (!global) break;
            var matchStr = String(result[0]);
            if (matchStr === '') rx.lastIndex = _advanceStringIndex(S, _toLength(rx.lastIndex), fullUnicode);
          }
          var accumulatedResult = '';
          var nextSourcePosition = 0;
          for (var i = 0; i < results.length; i++) {
            result = results[i];
            var matched = String(result[0]);
            var position = max$1(min$2(_toInteger(result.index), S.length), 0);
            var captures = [];
            // NOTE: This is equivalent to
            //   captures = result.slice(1).map(maybeToString)
            // but for some reason `nativeSlice.call(result, 1, result.length)` (called in
            // the slice polyfill when slicing native arrays) "doesn't work" in safari 9 and
            // causes a crash (https://pastebin.com/N21QzeQA) when trying to debug it.
            for (var j = 1; j < result.length; j++) captures.push(maybeToString(result[j]));
            var namedCaptures = result.groups;
            if (functionalReplace) {
              var replacerArgs = [matched].concat(captures, position, S);
              if (namedCaptures !== undefined) replacerArgs.push(namedCaptures);
              var replacement = String(replaceValue.apply(undefined, replacerArgs));
            } else {
              replacement = getSubstitution(matched, S, position, captures, namedCaptures, replaceValue);
            }
            if (position >= nextSourcePosition) {
              accumulatedResult += S.slice(nextSourcePosition, position) + replacement;
              nextSourcePosition = position + matched.length;
            }
          }
          return accumulatedResult + S.slice(nextSourcePosition);
        }
      ];

        // https://tc39.github.io/ecma262/#sec-getsubstitution
      function getSubstitution(matched, str, position, captures, namedCaptures, replacement) {
        var tailPos = position + matched.length;
        var m = captures.length;
        var symbols = SUBSTITUTION_SYMBOLS_NO_NAMED;
        if (namedCaptures !== undefined) {
          namedCaptures = _toObject(namedCaptures);
          symbols = SUBSTITUTION_SYMBOLS;
        }
        return $replace.call(replacement, symbols, function (match, ch) {
          var capture;
          switch (ch.charAt(0)) {
            case '$': return '$';
            case '&': return matched;
            case '`': return str.slice(0, position);
            case "'": return str.slice(tailPos);
            case '<':
              capture = namedCaptures[ch.slice(1, -1)];
              break;
            default: // \d\d?
              var n = +ch;
              if (n === 0) return match;
              if (n > m) {
                var f = floor$3(n / 10);
                if (f === 0) return match;
                if (f <= m) return captures[f - 1] === undefined ? ch.charAt(1) : captures[f - 1] + ch.charAt(1);
                return match;
              }
              capture = captures[n - 1];
          }
          return capture === undefined ? '' : capture;
        });
      }
    });

    // @@search logic
    _fixReWks('search', 1, function (defined, SEARCH, $search, maybeCallNative) {
      return [
        // `String.prototype.search` method
        // https://tc39.github.io/ecma262/#sec-string.prototype.search
        function search(regexp) {
          var O = defined(this);
          var fn = regexp == undefined ? undefined : regexp[SEARCH];
          return fn !== undefined ? fn.call(regexp, O) : new RegExp(regexp)[SEARCH](String(O));
        },
        // `RegExp.prototype[@@search]` method
        // https://tc39.github.io/ecma262/#sec-regexp.prototype-@@search
        function (regexp) {
          var res = maybeCallNative($search, regexp, this);
          if (res.done) return res.value;
          var rx = _anObject(regexp);
          var S = String(this);
          var previousLastIndex = rx.lastIndex;
          if (!_sameValue(previousLastIndex, 0)) rx.lastIndex = 0;
          var result = _regexpExecAbstract(rx, S);
          if (!_sameValue(rx.lastIndex, previousLastIndex)) rx.lastIndex = previousLastIndex;
          return result === null ? -1 : result.index;
        }
      ];
    });

    // 7.3.20 SpeciesConstructor(O, defaultConstructor)


    var SPECIES$3 = _wks('species');
    var _speciesConstructor = function (O, D) {
      var C = _anObject(O).constructor;
      var S;
      return C === undefined || (S = _anObject(C)[SPECIES$3]) == undefined ? D : _aFunction(S);
    };

    var $min = Math.min;
    var $push = [].push;
    var $SPLIT = 'split';
    var LENGTH = 'length';
    var LAST_INDEX$1 = 'lastIndex';
    var MAX_UINT32 = 0xffffffff;

    // babel-minify transpiles RegExp('x', 'y') -> /x/y and it causes SyntaxError
    var SUPPORTS_Y = !_fails(function () { });

    // @@split logic
    _fixReWks('split', 2, function (defined, SPLIT, $split, maybeCallNative) {
      var internalSplit;
      if (
        'abbc'[$SPLIT](/(b)*/)[1] == 'c' ||
        'test'[$SPLIT](/(?:)/, -1)[LENGTH] != 4 ||
        'ab'[$SPLIT](/(?:ab)*/)[LENGTH] != 2 ||
        '.'[$SPLIT](/(.?)(.?)/)[LENGTH] != 4 ||
        '.'[$SPLIT](/()()/)[LENGTH] > 1 ||
        ''[$SPLIT](/.?/)[LENGTH]
      ) {
        // based on es5-shim implementation, need to rework it
        internalSplit = function (separator, limit) {
          var string = String(this);
          if (separator === undefined && limit === 0) return [];
          // If `separator` is not a regex, use native split
          if (!_isRegexp(separator)) return $split.call(string, separator, limit);
          var output = [];
          var flags = (separator.ignoreCase ? 'i' : '') +
                      (separator.multiline ? 'm' : '') +
                      (separator.unicode ? 'u' : '') +
                      (separator.sticky ? 'y' : '');
          var lastLastIndex = 0;
          var splitLimit = limit === undefined ? MAX_UINT32 : limit >>> 0;
          // Make `global` and avoid `lastIndex` issues by working with a copy
          var separatorCopy = new RegExp(separator.source, flags + 'g');
          var match, lastIndex, lastLength;
          while (match = _regexpExec.call(separatorCopy, string)) {
            lastIndex = separatorCopy[LAST_INDEX$1];
            if (lastIndex > lastLastIndex) {
              output.push(string.slice(lastLastIndex, match.index));
              if (match[LENGTH] > 1 && match.index < string[LENGTH]) $push.apply(output, match.slice(1));
              lastLength = match[0][LENGTH];
              lastLastIndex = lastIndex;
              if (output[LENGTH] >= splitLimit) break;
            }
            if (separatorCopy[LAST_INDEX$1] === match.index) separatorCopy[LAST_INDEX$1]++; // Avoid an infinite loop
          }
          if (lastLastIndex === string[LENGTH]) {
            if (lastLength || !separatorCopy.test('')) output.push('');
          } else output.push(string.slice(lastLastIndex));
          return output[LENGTH] > splitLimit ? output.slice(0, splitLimit) : output;
        };
      // Chakra, V8
      } else if ('0'[$SPLIT](undefined, 0)[LENGTH]) {
        internalSplit = function (separator, limit) {
          return separator === undefined && limit === 0 ? [] : $split.call(this, separator, limit);
        };
      } else {
        internalSplit = $split;
      }

      return [
        // `String.prototype.split` method
        // https://tc39.github.io/ecma262/#sec-string.prototype.split
        function split(separator, limit) {
          var O = defined(this);
          var splitter = separator == undefined ? undefined : separator[SPLIT];
          return splitter !== undefined
            ? splitter.call(separator, O, limit)
            : internalSplit.call(String(O), separator, limit);
        },
        // `RegExp.prototype[@@split]` method
        // https://tc39.github.io/ecma262/#sec-regexp.prototype-@@split
        //
        // NOTE: This cannot be properly polyfilled in engines that don't support
        // the 'y' flag.
        function (regexp, limit) {
          var res = maybeCallNative(internalSplit, regexp, this, limit, internalSplit !== $split);
          if (res.done) return res.value;

          var rx = _anObject(regexp);
          var S = String(this);
          var C = _speciesConstructor(rx, RegExp);

          var unicodeMatching = rx.unicode;
          var flags = (rx.ignoreCase ? 'i' : '') +
                      (rx.multiline ? 'm' : '') +
                      (rx.unicode ? 'u' : '') +
                      (SUPPORTS_Y ? 'y' : 'g');

          // ^(? + rx + ) is needed, in combination with some S slicing, to
          // simulate the 'y' flag.
          var splitter = new C(SUPPORTS_Y ? rx : '^(?:' + rx.source + ')', flags);
          var lim = limit === undefined ? MAX_UINT32 : limit >>> 0;
          if (lim === 0) return [];
          if (S.length === 0) return _regexpExecAbstract(splitter, S) === null ? [S] : [];
          var p = 0;
          var q = 0;
          var A = [];
          while (q < S.length) {
            splitter.lastIndex = SUPPORTS_Y ? q : 0;
            var z = _regexpExecAbstract(splitter, SUPPORTS_Y ? S : S.slice(q));
            var e;
            if (
              z === null ||
              (e = $min(_toLength(splitter.lastIndex + (SUPPORTS_Y ? 0 : q)), S.length)) === p
            ) {
              q = _advanceStringIndex(S, q, unicodeMatching);
            } else {
              A.push(S.slice(p, q));
              if (A.length === lim) return A;
              for (var i = 1; i <= z.length - 1; i++) {
                A.push(z[i]);
                if (A.length === lim) return A;
              }
              q = p = e;
            }
          }
          A.push(S.slice(p));
          return A;
        }
      ];
    });

    var _anInstance = function (it, Constructor, name, forbiddenField) {
      if (!(it instanceof Constructor) || (forbiddenField !== undefined && forbiddenField in it)) {
        throw TypeError(name + ': incorrect invocation!');
      } return it;
    };

    var _forOf = createCommonjsModule(function (module) {
    var BREAK = {};
    var RETURN = {};
    var exports = module.exports = function (iterable, entries, fn, that, ITERATOR) {
      var iterFn = ITERATOR ? function () { return iterable; } : core_getIteratorMethod(iterable);
      var f = _ctx(fn, that, entries ? 2 : 1);
      var index = 0;
      var length, step, iterator, result;
      if (typeof iterFn != 'function') throw TypeError(iterable + ' is not iterable!');
      // fast case for arrays with default iterator
      if (_isArrayIter(iterFn)) for (length = _toLength(iterable.length); length > index; index++) {
        result = entries ? f(_anObject(step = iterable[index])[0], step[1]) : f(iterable[index]);
        if (result === BREAK || result === RETURN) return result;
      } else for (iterator = iterFn.call(iterable); !(step = iterator.next()).done;) {
        result = _iterCall(iterator, f, step.value, entries);
        if (result === BREAK || result === RETURN) return result;
      }
    };
    exports.BREAK = BREAK;
    exports.RETURN = RETURN;
    });

    var process$1 = _global.process;
    var setTask = _global.setImmediate;
    var clearTask = _global.clearImmediate;
    var MessageChannel = _global.MessageChannel;
    var Dispatch = _global.Dispatch;
    var counter = 0;
    var queue = {};
    var ONREADYSTATECHANGE = 'onreadystatechange';
    var defer, channel, port;
    var run = function () {
      var id = +this;
      // eslint-disable-next-line no-prototype-builtins
      if (queue.hasOwnProperty(id)) {
        var fn = queue[id];
        delete queue[id];
        fn();
      }
    };
    var listener = function (event) {
      run.call(event.data);
    };
    // Node.js 0.9+ & IE10+ has setImmediate, otherwise:
    if (!setTask || !clearTask) {
      setTask = function setImmediate(fn) {
        var args = [];
        var i = 1;
        while (arguments.length > i) args.push(arguments[i++]);
        queue[++counter] = function () {
          // eslint-disable-next-line no-new-func
          _invoke(typeof fn == 'function' ? fn : Function(fn), args);
        };
        defer(counter);
        return counter;
      };
      clearTask = function clearImmediate(id) {
        delete queue[id];
      };
      // Node.js 0.8-
      if (_cof(process$1) == 'process') {
        defer = function (id) {
          process$1.nextTick(_ctx(run, id, 1));
        };
      // Sphere (JS game engine) Dispatch API
      } else if (Dispatch && Dispatch.now) {
        defer = function (id) {
          Dispatch.now(_ctx(run, id, 1));
        };
      // Browsers with MessageChannel, includes WebWorkers
      } else if (MessageChannel) {
        channel = new MessageChannel();
        port = channel.port2;
        channel.port1.onmessage = listener;
        defer = _ctx(port.postMessage, port, 1);
      // Browsers with postMessage, skip WebWorkers
      // IE8 has postMessage, but it's sync & typeof its postMessage is 'object'
      } else if (_global.addEventListener && typeof postMessage == 'function' && !_global.importScripts) {
        defer = function (id) {
          _global.postMessage(id + '', '*');
        };
        _global.addEventListener('message', listener, false);
      // IE8-
      } else if (ONREADYSTATECHANGE in _domCreate('script')) {
        defer = function (id) {
          _html.appendChild(_domCreate('script'))[ONREADYSTATECHANGE] = function () {
            _html.removeChild(this);
            run.call(id);
          };
        };
      // Rest old browsers
      } else {
        defer = function (id) {
          setTimeout(_ctx(run, id, 1), 0);
        };
      }
    }
    var _task = {
      set: setTask,
      clear: clearTask
    };

    var macrotask = _task.set;
    var Observer = _global.MutationObserver || _global.WebKitMutationObserver;
    var process$2 = _global.process;
    var Promise$1 = _global.Promise;
    var isNode = _cof(process$2) == 'process';

    var _microtask = function () {
      var head, last, notify;

      var flush = function () {
        var parent, fn;
        if (isNode && (parent = process$2.domain)) parent.exit();
        while (head) {
          fn = head.fn;
          head = head.next;
          try {
            fn();
          } catch (e) {
            if (head) notify();
            else last = undefined;
            throw e;
          }
        } last = undefined;
        if (parent) parent.enter();
      };

      // Node.js
      if (isNode) {
        notify = function () {
          process$2.nextTick(flush);
        };
      // browsers with MutationObserver, except iOS Safari - https://github.com/zloirock/core-js/issues/339
      } else if (Observer && !(_global.navigator && _global.navigator.standalone)) {
        var toggle = true;
        var node = document.createTextNode('');
        new Observer(flush).observe(node, { characterData: true }); // eslint-disable-line no-new
        notify = function () {
          node.data = toggle = !toggle;
        };
      // environments with maybe non-completely correct, but existent Promise
      } else if (Promise$1 && Promise$1.resolve) {
        // Promise.resolve without an argument throws an error in LG WebOS 2
        var promise = Promise$1.resolve(undefined);
        notify = function () {
          promise.then(flush);
        };
      // for other environments - macrotask based on:
      // - setImmediate
      // - MessageChannel
      // - window.postMessag
      // - onreadystatechange
      // - setTimeout
      } else {
        notify = function () {
          // strange IE + webpack dev server bug - use .call(global)
          macrotask.call(_global, flush);
        };
      }

      return function (fn) {
        var task = { fn: fn, next: undefined };
        if (last) last.next = task;
        if (!head) {
          head = task;
          notify();
        } last = task;
      };
    };

    // 25.4.1.5 NewPromiseCapability(C)


    function PromiseCapability(C) {
      var resolve, reject;
      this.promise = new C(function ($$resolve, $$reject) {
        if (resolve !== undefined || reject !== undefined) throw TypeError('Bad Promise constructor');
        resolve = $$resolve;
        reject = $$reject;
      });
      this.resolve = _aFunction(resolve);
      this.reject = _aFunction(reject);
    }

    var f$7 = function (C) {
      return new PromiseCapability(C);
    };

    var _newPromiseCapability = {
    	f: f$7
    };

    var _perform = function (exec) {
      try {
        return { e: false, v: exec() };
      } catch (e) {
        return { e: true, v: e };
      }
    };

    var navigator$1 = _global.navigator;

    var _userAgent = navigator$1 && navigator$1.userAgent || '';

    var _promiseResolve = function (C, x) {
      _anObject(C);
      if (_isObject(x) && x.constructor === C) return x;
      var promiseCapability = _newPromiseCapability.f(C);
      var resolve = promiseCapability.resolve;
      resolve(x);
      return promiseCapability.promise;
    };

    var _redefineAll = function (target, src, safe) {
      for (var key in src) _redefine(target, key, src[key], safe);
      return target;
    };

    var task = _task.set;
    var microtask = _microtask();




    var PROMISE = 'Promise';
    var TypeError$1 = _global.TypeError;
    var process$3 = _global.process;
    var versions = process$3 && process$3.versions;
    var v8 = versions && versions.v8 || '';
    var $Promise = _global[PROMISE];
    var isNode$1 = _classof(process$3) == 'process';
    var empty = function () { /* empty */ };
    var Internal, newGenericPromiseCapability, OwnPromiseCapability, Wrapper;
    var newPromiseCapability = newGenericPromiseCapability = _newPromiseCapability.f;

    var USE_NATIVE$1 = !!function () {
      try {
        // correct subclassing with @@species support
        var promise = $Promise.resolve(1);
        var FakePromise = (promise.constructor = {})[_wks('species')] = function (exec) {
          exec(empty, empty);
        };
        // unhandled rejections tracking support, NodeJS Promise without it fails @@species test
        return (isNode$1 || typeof PromiseRejectionEvent == 'function')
          && promise.then(empty) instanceof FakePromise
          // v8 6.6 (Node 10 and Chrome 66) have a bug with resolving custom thenables
          // https://bugs.chromium.org/p/chromium/issues/detail?id=830565
          // we can't detect it synchronously, so just check versions
          && v8.indexOf('6.6') !== 0
          && _userAgent.indexOf('Chrome/66') === -1;
      } catch (e) { /* empty */ }
    }();

    // helpers
    var isThenable = function (it) {
      var then;
      return _isObject(it) && typeof (then = it.then) == 'function' ? then : false;
    };
    var notify = function (promise, isReject) {
      if (promise._n) return;
      promise._n = true;
      var chain = promise._c;
      microtask(function () {
        var value = promise._v;
        var ok = promise._s == 1;
        var i = 0;
        var run = function (reaction) {
          var handler = ok ? reaction.ok : reaction.fail;
          var resolve = reaction.resolve;
          var reject = reaction.reject;
          var domain = reaction.domain;
          var result, then, exited;
          try {
            if (handler) {
              if (!ok) {
                if (promise._h == 2) onHandleUnhandled(promise);
                promise._h = 1;
              }
              if (handler === true) result = value;
              else {
                if (domain) domain.enter();
                result = handler(value); // may throw
                if (domain) {
                  domain.exit();
                  exited = true;
                }
              }
              if (result === reaction.promise) {
                reject(TypeError$1('Promise-chain cycle'));
              } else if (then = isThenable(result)) {
                then.call(result, resolve, reject);
              } else resolve(result);
            } else reject(value);
          } catch (e) {
            if (domain && !exited) domain.exit();
            reject(e);
          }
        };
        while (chain.length > i) run(chain[i++]); // variable length - can't use forEach
        promise._c = [];
        promise._n = false;
        if (isReject && !promise._h) onUnhandled(promise);
      });
    };
    var onUnhandled = function (promise) {
      task.call(_global, function () {
        var value = promise._v;
        var unhandled = isUnhandled(promise);
        var result, handler, console;
        if (unhandled) {
          result = _perform(function () {
            if (isNode$1) {
              process$3.emit('unhandledRejection', value, promise);
            } else if (handler = _global.onunhandledrejection) {
              handler({ promise: promise, reason: value });
            } else if ((console = _global.console) && console.error) {
              console.error('Unhandled promise rejection', value);
            }
          });
          // Browsers should not trigger `rejectionHandled` event if it was handled here, NodeJS - should
          promise._h = isNode$1 || isUnhandled(promise) ? 2 : 1;
        } promise._a = undefined;
        if (unhandled && result.e) throw result.v;
      });
    };
    var isUnhandled = function (promise) {
      return promise._h !== 1 && (promise._a || promise._c).length === 0;
    };
    var onHandleUnhandled = function (promise) {
      task.call(_global, function () {
        var handler;
        if (isNode$1) {
          process$3.emit('rejectionHandled', promise);
        } else if (handler = _global.onrejectionhandled) {
          handler({ promise: promise, reason: promise._v });
        }
      });
    };
    var $reject = function (value) {
      var promise = this;
      if (promise._d) return;
      promise._d = true;
      promise = promise._w || promise; // unwrap
      promise._v = value;
      promise._s = 2;
      if (!promise._a) promise._a = promise._c.slice();
      notify(promise, true);
    };
    var $resolve = function (value) {
      var promise = this;
      var then;
      if (promise._d) return;
      promise._d = true;
      promise = promise._w || promise; // unwrap
      try {
        if (promise === value) throw TypeError$1("Promise can't be resolved itself");
        if (then = isThenable(value)) {
          microtask(function () {
            var wrapper = { _w: promise, _d: false }; // wrap
            try {
              then.call(value, _ctx($resolve, wrapper, 1), _ctx($reject, wrapper, 1));
            } catch (e) {
              $reject.call(wrapper, e);
            }
          });
        } else {
          promise._v = value;
          promise._s = 1;
          notify(promise, false);
        }
      } catch (e) {
        $reject.call({ _w: promise, _d: false }, e); // wrap
      }
    };

    // constructor polyfill
    if (!USE_NATIVE$1) {
      // 25.4.3.1 Promise(executor)
      $Promise = function Promise(executor) {
        _anInstance(this, $Promise, PROMISE, '_h');
        _aFunction(executor);
        Internal.call(this);
        try {
          executor(_ctx($resolve, this, 1), _ctx($reject, this, 1));
        } catch (err) {
          $reject.call(this, err);
        }
      };
      // eslint-disable-next-line no-unused-vars
      Internal = function Promise(executor) {
        this._c = [];             // <- awaiting reactions
        this._a = undefined;      // <- checked in isUnhandled reactions
        this._s = 0;              // <- state
        this._d = false;          // <- done
        this._v = undefined;      // <- value
        this._h = 0;              // <- rejection state, 0 - default, 1 - handled, 2 - unhandled
        this._n = false;          // <- notify
      };
      Internal.prototype = _redefineAll($Promise.prototype, {
        // 25.4.5.3 Promise.prototype.then(onFulfilled, onRejected)
        then: function then(onFulfilled, onRejected) {
          var reaction = newPromiseCapability(_speciesConstructor(this, $Promise));
          reaction.ok = typeof onFulfilled == 'function' ? onFulfilled : true;
          reaction.fail = typeof onRejected == 'function' && onRejected;
          reaction.domain = isNode$1 ? process$3.domain : undefined;
          this._c.push(reaction);
          if (this._a) this._a.push(reaction);
          if (this._s) notify(this, false);
          return reaction.promise;
        },
        // 25.4.5.1 Promise.prototype.catch(onRejected)
        'catch': function (onRejected) {
          return this.then(undefined, onRejected);
        }
      });
      OwnPromiseCapability = function () {
        var promise = new Internal();
        this.promise = promise;
        this.resolve = _ctx($resolve, promise, 1);
        this.reject = _ctx($reject, promise, 1);
      };
      _newPromiseCapability.f = newPromiseCapability = function (C) {
        return C === $Promise || C === Wrapper
          ? new OwnPromiseCapability(C)
          : newGenericPromiseCapability(C);
      };
    }

    _export(_export.G + _export.W + _export.F * !USE_NATIVE$1, { Promise: $Promise });
    _setToStringTag($Promise, PROMISE);
    _setSpecies(PROMISE);
    Wrapper = _core[PROMISE];

    // statics
    _export(_export.S + _export.F * !USE_NATIVE$1, PROMISE, {
      // 25.4.4.5 Promise.reject(r)
      reject: function reject(r) {
        var capability = newPromiseCapability(this);
        var $$reject = capability.reject;
        $$reject(r);
        return capability.promise;
      }
    });
    _export(_export.S + _export.F * (_library || !USE_NATIVE$1), PROMISE, {
      // 25.4.4.6 Promise.resolve(x)
      resolve: function resolve(x) {
        return _promiseResolve(_library && this === Wrapper ? $Promise : this, x);
      }
    });
    _export(_export.S + _export.F * !(USE_NATIVE$1 && _iterDetect(function (iter) {
      $Promise.all(iter)['catch'](empty);
    })), PROMISE, {
      // 25.4.4.1 Promise.all(iterable)
      all: function all(iterable) {
        var C = this;
        var capability = newPromiseCapability(C);
        var resolve = capability.resolve;
        var reject = capability.reject;
        var result = _perform(function () {
          var values = [];
          var index = 0;
          var remaining = 1;
          _forOf(iterable, false, function (promise) {
            var $index = index++;
            var alreadyCalled = false;
            values.push(undefined);
            remaining++;
            C.resolve(promise).then(function (value) {
              if (alreadyCalled) return;
              alreadyCalled = true;
              values[$index] = value;
              --remaining || resolve(values);
            }, reject);
          });
          --remaining || resolve(values);
        });
        if (result.e) reject(result.v);
        return capability.promise;
      },
      // 25.4.4.4 Promise.race(iterable)
      race: function race(iterable) {
        var C = this;
        var capability = newPromiseCapability(C);
        var reject = capability.reject;
        var result = _perform(function () {
          _forOf(iterable, false, function (promise) {
            C.resolve(promise).then(capability.resolve, reject);
          });
        });
        if (result.e) reject(result.v);
        return capability.promise;
      }
    });

    var _validateCollection = function (it, TYPE) {
      if (!_isObject(it) || it._t !== TYPE) throw TypeError('Incompatible receiver, ' + TYPE + ' required!');
      return it;
    };

    var dP$5 = _objectDp.f;









    var fastKey = _meta.fastKey;

    var SIZE = _descriptors ? '_s' : 'size';

    var getEntry = function (that, key) {
      // fast case
      var index = fastKey(key);
      var entry;
      if (index !== 'F') return that._i[index];
      // frozen object case
      for (entry = that._f; entry; entry = entry.n) {
        if (entry.k == key) return entry;
      }
    };

    var _collectionStrong = {
      getConstructor: function (wrapper, NAME, IS_MAP, ADDER) {
        var C = wrapper(function (that, iterable) {
          _anInstance(that, C, NAME, '_i');
          that._t = NAME;         // collection type
          that._i = _objectCreate(null); // index
          that._f = undefined;    // first entry
          that._l = undefined;    // last entry
          that[SIZE] = 0;         // size
          if (iterable != undefined) _forOf(iterable, IS_MAP, that[ADDER], that);
        });
        _redefineAll(C.prototype, {
          // 23.1.3.1 Map.prototype.clear()
          // 23.2.3.2 Set.prototype.clear()
          clear: function clear() {
            for (var that = _validateCollection(this, NAME), data = that._i, entry = that._f; entry; entry = entry.n) {
              entry.r = true;
              if (entry.p) entry.p = entry.p.n = undefined;
              delete data[entry.i];
            }
            that._f = that._l = undefined;
            that[SIZE] = 0;
          },
          // 23.1.3.3 Map.prototype.delete(key)
          // 23.2.3.4 Set.prototype.delete(value)
          'delete': function (key) {
            var that = _validateCollection(this, NAME);
            var entry = getEntry(that, key);
            if (entry) {
              var next = entry.n;
              var prev = entry.p;
              delete that._i[entry.i];
              entry.r = true;
              if (prev) prev.n = next;
              if (next) next.p = prev;
              if (that._f == entry) that._f = next;
              if (that._l == entry) that._l = prev;
              that[SIZE]--;
            } return !!entry;
          },
          // 23.2.3.6 Set.prototype.forEach(callbackfn, thisArg = undefined)
          // 23.1.3.5 Map.prototype.forEach(callbackfn, thisArg = undefined)
          forEach: function forEach(callbackfn /* , that = undefined */) {
            _validateCollection(this, NAME);
            var f = _ctx(callbackfn, arguments.length > 1 ? arguments[1] : undefined, 3);
            var entry;
            while (entry = entry ? entry.n : this._f) {
              f(entry.v, entry.k, this);
              // revert to the last existing entry
              while (entry && entry.r) entry = entry.p;
            }
          },
          // 23.1.3.7 Map.prototype.has(key)
          // 23.2.3.7 Set.prototype.has(value)
          has: function has(key) {
            return !!getEntry(_validateCollection(this, NAME), key);
          }
        });
        if (_descriptors) dP$5(C.prototype, 'size', {
          get: function () {
            return _validateCollection(this, NAME)[SIZE];
          }
        });
        return C;
      },
      def: function (that, key, value) {
        var entry = getEntry(that, key);
        var prev, index;
        // change existing entry
        if (entry) {
          entry.v = value;
        // create new entry
        } else {
          that._l = entry = {
            i: index = fastKey(key, true), // <- index
            k: key,                        // <- key
            v: value,                      // <- value
            p: prev = that._l,             // <- previous entry
            n: undefined,                  // <- next entry
            r: false                       // <- removed
          };
          if (!that._f) that._f = entry;
          if (prev) prev.n = entry;
          that[SIZE]++;
          // add to index
          if (index !== 'F') that._i[index] = entry;
        } return that;
      },
      getEntry: getEntry,
      setStrong: function (C, NAME, IS_MAP) {
        // add .keys, .values, .entries, [@@iterator]
        // 23.1.3.4, 23.1.3.8, 23.1.3.11, 23.1.3.12, 23.2.3.5, 23.2.3.8, 23.2.3.10, 23.2.3.11
        _iterDefine(C, NAME, function (iterated, kind) {
          this._t = _validateCollection(iterated, NAME); // target
          this._k = kind;                     // kind
          this._l = undefined;                // previous
        }, function () {
          var that = this;
          var kind = that._k;
          var entry = that._l;
          // revert to the last existing entry
          while (entry && entry.r) entry = entry.p;
          // get next entry
          if (!that._t || !(that._l = entry = entry ? entry.n : that._t._f)) {
            // or finish the iteration
            that._t = undefined;
            return _iterStep(1);
          }
          // return step by kind
          if (kind == 'keys') return _iterStep(0, entry.k);
          if (kind == 'values') return _iterStep(0, entry.v);
          return _iterStep(0, [entry.k, entry.v]);
        }, IS_MAP ? 'entries' : 'values', !IS_MAP, true);

        // add [@@species], 23.1.2.2, 23.2.2.2
        _setSpecies(NAME);
      }
    };

    var _collection = function (NAME, wrapper, methods, common, IS_MAP, IS_WEAK) {
      var Base = _global[NAME];
      var C = Base;
      var ADDER = IS_MAP ? 'set' : 'add';
      var proto = C && C.prototype;
      var O = {};
      var fixMethod = function (KEY) {
        var fn = proto[KEY];
        _redefine(proto, KEY,
          KEY == 'delete' ? function (a) {
            return IS_WEAK && !_isObject(a) ? false : fn.call(this, a === 0 ? 0 : a);
          } : KEY == 'has' ? function has(a) {
            return IS_WEAK && !_isObject(a) ? false : fn.call(this, a === 0 ? 0 : a);
          } : KEY == 'get' ? function get(a) {
            return IS_WEAK && !_isObject(a) ? undefined : fn.call(this, a === 0 ? 0 : a);
          } : KEY == 'add' ? function add(a) { fn.call(this, a === 0 ? 0 : a); return this; }
            : function set(a, b) { fn.call(this, a === 0 ? 0 : a, b); return this; }
        );
      };
      if (typeof C != 'function' || !(IS_WEAK || proto.forEach && !_fails(function () {
        new C().entries().next();
      }))) {
        // create collection constructor
        C = common.getConstructor(wrapper, NAME, IS_MAP, ADDER);
        _redefineAll(C.prototype, methods);
        _meta.NEED = true;
      } else {
        var instance = new C();
        // early implementations not supports chaining
        var HASNT_CHAINING = instance[ADDER](IS_WEAK ? {} : -0, 1) != instance;
        // V8 ~  Chromium 40- weak-collections throws on primitives, but should return false
        var THROWS_ON_PRIMITIVES = _fails(function () { instance.has(1); });
        // most early implementations doesn't supports iterables, most modern - not close it correctly
        var ACCEPT_ITERABLES = _iterDetect(function (iter) { new C(iter); }); // eslint-disable-line no-new
        // for early implementations -0 and +0 not the same
        var BUGGY_ZERO = !IS_WEAK && _fails(function () {
          // V8 ~ Chromium 42- fails only with 5+ elements
          var $instance = new C();
          var index = 5;
          while (index--) $instance[ADDER](index, index);
          return !$instance.has(-0);
        });
        if (!ACCEPT_ITERABLES) {
          C = wrapper(function (target, iterable) {
            _anInstance(target, C, NAME);
            var that = _inheritIfRequired(new Base(), target, C);
            if (iterable != undefined) _forOf(iterable, IS_MAP, that[ADDER], that);
            return that;
          });
          C.prototype = proto;
          proto.constructor = C;
        }
        if (THROWS_ON_PRIMITIVES || BUGGY_ZERO) {
          fixMethod('delete');
          fixMethod('has');
          IS_MAP && fixMethod('get');
        }
        if (BUGGY_ZERO || HASNT_CHAINING) fixMethod(ADDER);
        // weak collections should not contains .clear method
        if (IS_WEAK && proto.clear) delete proto.clear;
      }

      _setToStringTag(C, NAME);

      O[NAME] = C;
      _export(_export.G + _export.W + _export.F * (C != Base), O);

      if (!IS_WEAK) common.setStrong(C, NAME, IS_MAP);

      return C;
    };

    var MAP = 'Map';

    // 23.1 Map Objects
    var es6_map = _collection(MAP, function (get) {
      return function Map() { return get(this, arguments.length > 0 ? arguments[0] : undefined); };
    }, {
      // 23.1.3.6 Map.prototype.get(key)
      get: function get(key) {
        var entry = _collectionStrong.getEntry(_validateCollection(this, MAP), key);
        return entry && entry.v;
      },
      // 23.1.3.9 Map.prototype.set(key, value)
      set: function set(key, value) {
        return _collectionStrong.def(_validateCollection(this, MAP), key === 0 ? 0 : key, value);
      }
    }, _collectionStrong, true);

    var SET = 'Set';

    // 23.2 Set Objects
    var es6_set = _collection(SET, function (get) {
      return function Set() { return get(this, arguments.length > 0 ? arguments[0] : undefined); };
    }, {
      // 23.2.3.1 Set.prototype.add(value)
      add: function add(value) {
        return _collectionStrong.def(_validateCollection(this, SET), value = value === 0 ? 0 : value, value);
      }
    }, _collectionStrong);

    var getWeak = _meta.getWeak;







    var arrayFind = _arrayMethods(5);
    var arrayFindIndex = _arrayMethods(6);
    var id$1 = 0;

    // fallback for uncaught frozen keys
    var uncaughtFrozenStore = function (that) {
      return that._l || (that._l = new UncaughtFrozenStore());
    };
    var UncaughtFrozenStore = function () {
      this.a = [];
    };
    var findUncaughtFrozen = function (store, key) {
      return arrayFind(store.a, function (it) {
        return it[0] === key;
      });
    };
    UncaughtFrozenStore.prototype = {
      get: function (key) {
        var entry = findUncaughtFrozen(this, key);
        if (entry) return entry[1];
      },
      has: function (key) {
        return !!findUncaughtFrozen(this, key);
      },
      set: function (key, value) {
        var entry = findUncaughtFrozen(this, key);
        if (entry) entry[1] = value;
        else this.a.push([key, value]);
      },
      'delete': function (key) {
        var index = arrayFindIndex(this.a, function (it) {
          return it[0] === key;
        });
        if (~index) this.a.splice(index, 1);
        return !!~index;
      }
    };

    var _collectionWeak = {
      getConstructor: function (wrapper, NAME, IS_MAP, ADDER) {
        var C = wrapper(function (that, iterable) {
          _anInstance(that, C, NAME, '_i');
          that._t = NAME;      // collection type
          that._i = id$1++;      // collection id
          that._l = undefined; // leak store for uncaught frozen objects
          if (iterable != undefined) _forOf(iterable, IS_MAP, that[ADDER], that);
        });
        _redefineAll(C.prototype, {
          // 23.3.3.2 WeakMap.prototype.delete(key)
          // 23.4.3.3 WeakSet.prototype.delete(value)
          'delete': function (key) {
            if (!_isObject(key)) return false;
            var data = getWeak(key);
            if (data === true) return uncaughtFrozenStore(_validateCollection(this, NAME))['delete'](key);
            return data && _has(data, this._i) && delete data[this._i];
          },
          // 23.3.3.4 WeakMap.prototype.has(key)
          // 23.4.3.4 WeakSet.prototype.has(value)
          has: function has(key) {
            if (!_isObject(key)) return false;
            var data = getWeak(key);
            if (data === true) return uncaughtFrozenStore(_validateCollection(this, NAME)).has(key);
            return data && _has(data, this._i);
          }
        });
        return C;
      },
      def: function (that, key, value) {
        var data = getWeak(_anObject(key), true);
        if (data === true) uncaughtFrozenStore(that).set(key, value);
        else data[that._i] = value;
        return that;
      },
      ufstore: uncaughtFrozenStore
    };

    var es6_weakMap = createCommonjsModule(function (module) {

    var each = _arrayMethods(0);






    var NATIVE_WEAK_MAP = _validateCollection;
    var IS_IE11 = !_global.ActiveXObject && 'ActiveXObject' in _global;
    var WEAK_MAP = 'WeakMap';
    var getWeak = _meta.getWeak;
    var isExtensible = Object.isExtensible;
    var uncaughtFrozenStore = _collectionWeak.ufstore;
    var InternalMap;

    var wrapper = function (get) {
      return function WeakMap() {
        return get(this, arguments.length > 0 ? arguments[0] : undefined);
      };
    };

    var methods = {
      // 23.3.3.3 WeakMap.prototype.get(key)
      get: function get(key) {
        if (_isObject(key)) {
          var data = getWeak(key);
          if (data === true) return uncaughtFrozenStore(_validateCollection(this, WEAK_MAP)).get(key);
          return data ? data[this._i] : undefined;
        }
      },
      // 23.3.3.5 WeakMap.prototype.set(key, value)
      set: function set(key, value) {
        return _collectionWeak.def(_validateCollection(this, WEAK_MAP), key, value);
      }
    };

    // 23.3 WeakMap Objects
    var $WeakMap = module.exports = _collection(WEAK_MAP, wrapper, methods, _collectionWeak, true, true);

    // IE11 WeakMap frozen keys fix
    if (NATIVE_WEAK_MAP && IS_IE11) {
      InternalMap = _collectionWeak.getConstructor(wrapper, WEAK_MAP);
      _objectAssign(InternalMap.prototype, methods);
      _meta.NEED = true;
      each(['delete', 'has', 'get', 'set'], function (key) {
        var proto = $WeakMap.prototype;
        var method = proto[key];
        _redefine(proto, key, function (a, b) {
          // store frozen objects on internal weakmap shim
          if (_isObject(a) && !isExtensible(a)) {
            if (!this._f) this._f = new InternalMap();
            var result = this._f[key](a, b);
            return key == 'set' ? this : result;
          // store all the rest on native weakmap
          } return method.call(this, a, b);
        });
      });
    }
    });

    var WEAK_SET = 'WeakSet';

    // 23.4 WeakSet Objects
    _collection(WEAK_SET, function (get) {
      return function WeakSet() { return get(this, arguments.length > 0 ? arguments[0] : undefined); };
    }, {
      // 23.4.3.1 WeakSet.prototype.add(value)
      add: function add(value) {
        return _collectionWeak.def(_validateCollection(this, WEAK_SET), value, true);
      }
    }, _collectionWeak, false, true);

    var TYPED = _uid('typed_array');
    var VIEW = _uid('view');
    var ABV = !!(_global.ArrayBuffer && _global.DataView);
    var CONSTR = ABV;
    var i$1 = 0;
    var l = 9;
    var Typed;

    var TypedArrayConstructors = (
      'Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array'
    ).split(',');

    while (i$1 < l) {
      if (Typed = _global[TypedArrayConstructors[i$1++]]) {
        _hide(Typed.prototype, TYPED, true);
        _hide(Typed.prototype, VIEW, true);
      } else CONSTR = false;
    }

    var _typed = {
      ABV: ABV,
      CONSTR: CONSTR,
      TYPED: TYPED,
      VIEW: VIEW
    };

    // https://tc39.github.io/ecma262/#sec-toindex


    var _toIndex = function (it) {
      if (it === undefined) return 0;
      var number = _toInteger(it);
      var length = _toLength(number);
      if (number !== length) throw RangeError('Wrong length!');
      return length;
    };

    var _typedBuffer = createCommonjsModule(function (module, exports) {











    var gOPN = _objectGopn.f;
    var dP = _objectDp.f;


    var ARRAY_BUFFER = 'ArrayBuffer';
    var DATA_VIEW = 'DataView';
    var PROTOTYPE = 'prototype';
    var WRONG_LENGTH = 'Wrong length!';
    var WRONG_INDEX = 'Wrong index!';
    var $ArrayBuffer = _global[ARRAY_BUFFER];
    var $DataView = _global[DATA_VIEW];
    var Math = _global.Math;
    var RangeError = _global.RangeError;
    // eslint-disable-next-line no-shadow-restricted-names
    var Infinity = _global.Infinity;
    var BaseBuffer = $ArrayBuffer;
    var abs = Math.abs;
    var pow = Math.pow;
    var floor = Math.floor;
    var log = Math.log;
    var LN2 = Math.LN2;
    var BUFFER = 'buffer';
    var BYTE_LENGTH = 'byteLength';
    var BYTE_OFFSET = 'byteOffset';
    var $BUFFER = _descriptors ? '_b' : BUFFER;
    var $LENGTH = _descriptors ? '_l' : BYTE_LENGTH;
    var $OFFSET = _descriptors ? '_o' : BYTE_OFFSET;

    // IEEE754 conversions based on https://github.com/feross/ieee754
    function packIEEE754(value, mLen, nBytes) {
      var buffer = new Array(nBytes);
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var rt = mLen === 23 ? pow(2, -24) - pow(2, -77) : 0;
      var i = 0;
      var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
      var e, m, c;
      value = abs(value);
      // eslint-disable-next-line no-self-compare
      if (value != value || value === Infinity) {
        // eslint-disable-next-line no-self-compare
        m = value != value ? 1 : 0;
        e = eMax;
      } else {
        e = floor(log(value) / LN2);
        if (value * (c = pow(2, -e)) < 1) {
          e--;
          c *= 2;
        }
        if (e + eBias >= 1) {
          value += rt / c;
        } else {
          value += rt * pow(2, 1 - eBias);
        }
        if (value * c >= 2) {
          e++;
          c /= 2;
        }
        if (e + eBias >= eMax) {
          m = 0;
          e = eMax;
        } else if (e + eBias >= 1) {
          m = (value * c - 1) * pow(2, mLen);
          e = e + eBias;
        } else {
          m = value * pow(2, eBias - 1) * pow(2, mLen);
          e = 0;
        }
      }
      for (; mLen >= 8; buffer[i++] = m & 255, m /= 256, mLen -= 8);
      e = e << mLen | m;
      eLen += mLen;
      for (; eLen > 0; buffer[i++] = e & 255, e /= 256, eLen -= 8);
      buffer[--i] |= s * 128;
      return buffer;
    }
    function unpackIEEE754(buffer, mLen, nBytes) {
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var nBits = eLen - 7;
      var i = nBytes - 1;
      var s = buffer[i--];
      var e = s & 127;
      var m;
      s >>= 7;
      for (; nBits > 0; e = e * 256 + buffer[i], i--, nBits -= 8);
      m = e & (1 << -nBits) - 1;
      e >>= -nBits;
      nBits += mLen;
      for (; nBits > 0; m = m * 256 + buffer[i], i--, nBits -= 8);
      if (e === 0) {
        e = 1 - eBias;
      } else if (e === eMax) {
        return m ? NaN : s ? -Infinity : Infinity;
      } else {
        m = m + pow(2, mLen);
        e = e - eBias;
      } return (s ? -1 : 1) * m * pow(2, e - mLen);
    }

    function unpackI32(bytes) {
      return bytes[3] << 24 | bytes[2] << 16 | bytes[1] << 8 | bytes[0];
    }
    function packI8(it) {
      return [it & 0xff];
    }
    function packI16(it) {
      return [it & 0xff, it >> 8 & 0xff];
    }
    function packI32(it) {
      return [it & 0xff, it >> 8 & 0xff, it >> 16 & 0xff, it >> 24 & 0xff];
    }
    function packF64(it) {
      return packIEEE754(it, 52, 8);
    }
    function packF32(it) {
      return packIEEE754(it, 23, 4);
    }

    function addGetter(C, key, internal) {
      dP(C[PROTOTYPE], key, { get: function () { return this[internal]; } });
    }

    function get(view, bytes, index, isLittleEndian) {
      var numIndex = +index;
      var intIndex = _toIndex(numIndex);
      if (intIndex + bytes > view[$LENGTH]) throw RangeError(WRONG_INDEX);
      var store = view[$BUFFER]._b;
      var start = intIndex + view[$OFFSET];
      var pack = store.slice(start, start + bytes);
      return isLittleEndian ? pack : pack.reverse();
    }
    function set(view, bytes, index, conversion, value, isLittleEndian) {
      var numIndex = +index;
      var intIndex = _toIndex(numIndex);
      if (intIndex + bytes > view[$LENGTH]) throw RangeError(WRONG_INDEX);
      var store = view[$BUFFER]._b;
      var start = intIndex + view[$OFFSET];
      var pack = conversion(+value);
      for (var i = 0; i < bytes; i++) store[start + i] = pack[isLittleEndian ? i : bytes - i - 1];
    }

    if (!_typed.ABV) {
      $ArrayBuffer = function ArrayBuffer(length) {
        _anInstance(this, $ArrayBuffer, ARRAY_BUFFER);
        var byteLength = _toIndex(length);
        this._b = _arrayFill.call(new Array(byteLength), 0);
        this[$LENGTH] = byteLength;
      };

      $DataView = function DataView(buffer, byteOffset, byteLength) {
        _anInstance(this, $DataView, DATA_VIEW);
        _anInstance(buffer, $ArrayBuffer, DATA_VIEW);
        var bufferLength = buffer[$LENGTH];
        var offset = _toInteger(byteOffset);
        if (offset < 0 || offset > bufferLength) throw RangeError('Wrong offset!');
        byteLength = byteLength === undefined ? bufferLength - offset : _toLength(byteLength);
        if (offset + byteLength > bufferLength) throw RangeError(WRONG_LENGTH);
        this[$BUFFER] = buffer;
        this[$OFFSET] = offset;
        this[$LENGTH] = byteLength;
      };

      if (_descriptors) {
        addGetter($ArrayBuffer, BYTE_LENGTH, '_l');
        addGetter($DataView, BUFFER, '_b');
        addGetter($DataView, BYTE_LENGTH, '_l');
        addGetter($DataView, BYTE_OFFSET, '_o');
      }

      _redefineAll($DataView[PROTOTYPE], {
        getInt8: function getInt8(byteOffset) {
          return get(this, 1, byteOffset)[0] << 24 >> 24;
        },
        getUint8: function getUint8(byteOffset) {
          return get(this, 1, byteOffset)[0];
        },
        getInt16: function getInt16(byteOffset /* , littleEndian */) {
          var bytes = get(this, 2, byteOffset, arguments[1]);
          return (bytes[1] << 8 | bytes[0]) << 16 >> 16;
        },
        getUint16: function getUint16(byteOffset /* , littleEndian */) {
          var bytes = get(this, 2, byteOffset, arguments[1]);
          return bytes[1] << 8 | bytes[0];
        },
        getInt32: function getInt32(byteOffset /* , littleEndian */) {
          return unpackI32(get(this, 4, byteOffset, arguments[1]));
        },
        getUint32: function getUint32(byteOffset /* , littleEndian */) {
          return unpackI32(get(this, 4, byteOffset, arguments[1])) >>> 0;
        },
        getFloat32: function getFloat32(byteOffset /* , littleEndian */) {
          return unpackIEEE754(get(this, 4, byteOffset, arguments[1]), 23, 4);
        },
        getFloat64: function getFloat64(byteOffset /* , littleEndian */) {
          return unpackIEEE754(get(this, 8, byteOffset, arguments[1]), 52, 8);
        },
        setInt8: function setInt8(byteOffset, value) {
          set(this, 1, byteOffset, packI8, value);
        },
        setUint8: function setUint8(byteOffset, value) {
          set(this, 1, byteOffset, packI8, value);
        },
        setInt16: function setInt16(byteOffset, value /* , littleEndian */) {
          set(this, 2, byteOffset, packI16, value, arguments[2]);
        },
        setUint16: function setUint16(byteOffset, value /* , littleEndian */) {
          set(this, 2, byteOffset, packI16, value, arguments[2]);
        },
        setInt32: function setInt32(byteOffset, value /* , littleEndian */) {
          set(this, 4, byteOffset, packI32, value, arguments[2]);
        },
        setUint32: function setUint32(byteOffset, value /* , littleEndian */) {
          set(this, 4, byteOffset, packI32, value, arguments[2]);
        },
        setFloat32: function setFloat32(byteOffset, value /* , littleEndian */) {
          set(this, 4, byteOffset, packF32, value, arguments[2]);
        },
        setFloat64: function setFloat64(byteOffset, value /* , littleEndian */) {
          set(this, 8, byteOffset, packF64, value, arguments[2]);
        }
      });
    } else {
      if (!_fails(function () {
        $ArrayBuffer(1);
      }) || !_fails(function () {
        new $ArrayBuffer(-1); // eslint-disable-line no-new
      }) || _fails(function () {
        new $ArrayBuffer(); // eslint-disable-line no-new
        new $ArrayBuffer(1.5); // eslint-disable-line no-new
        new $ArrayBuffer(NaN); // eslint-disable-line no-new
        return $ArrayBuffer.name != ARRAY_BUFFER;
      })) {
        $ArrayBuffer = function ArrayBuffer(length) {
          _anInstance(this, $ArrayBuffer);
          return new BaseBuffer(_toIndex(length));
        };
        var ArrayBufferProto = $ArrayBuffer[PROTOTYPE] = BaseBuffer[PROTOTYPE];
        for (var keys = gOPN(BaseBuffer), j = 0, key; keys.length > j;) {
          if (!((key = keys[j++]) in $ArrayBuffer)) _hide($ArrayBuffer, key, BaseBuffer[key]);
        }
        if (!_library) ArrayBufferProto.constructor = $ArrayBuffer;
      }
      // iOS Safari 7.x bug
      var view = new $DataView(new $ArrayBuffer(2));
      var $setInt8 = $DataView[PROTOTYPE].setInt8;
      view.setInt8(0, 2147483648);
      view.setInt8(1, 2147483649);
      if (view.getInt8(0) || !view.getInt8(1)) _redefineAll($DataView[PROTOTYPE], {
        setInt8: function setInt8(byteOffset, value) {
          $setInt8.call(this, byteOffset, value << 24 >> 24);
        },
        setUint8: function setUint8(byteOffset, value) {
          $setInt8.call(this, byteOffset, value << 24 >> 24);
        }
      }, true);
    }
    _setToStringTag($ArrayBuffer, ARRAY_BUFFER);
    _setToStringTag($DataView, DATA_VIEW);
    _hide($DataView[PROTOTYPE], _typed.VIEW, true);
    exports[ARRAY_BUFFER] = $ArrayBuffer;
    exports[DATA_VIEW] = $DataView;
    });

    var ArrayBuffer$1 = _global.ArrayBuffer;

    var $ArrayBuffer = _typedBuffer.ArrayBuffer;
    var $DataView = _typedBuffer.DataView;
    var $isView = _typed.ABV && ArrayBuffer$1.isView;
    var $slice = $ArrayBuffer.prototype.slice;
    var VIEW$1 = _typed.VIEW;
    var ARRAY_BUFFER = 'ArrayBuffer';

    _export(_export.G + _export.W + _export.F * (ArrayBuffer$1 !== $ArrayBuffer), { ArrayBuffer: $ArrayBuffer });

    _export(_export.S + _export.F * !_typed.CONSTR, ARRAY_BUFFER, {
      // 24.1.3.1 ArrayBuffer.isView(arg)
      isView: function isView(it) {
        return $isView && $isView(it) || _isObject(it) && VIEW$1 in it;
      }
    });

    _export(_export.P + _export.U + _export.F * _fails(function () {
      return !new $ArrayBuffer(2).slice(1, undefined).byteLength;
    }), ARRAY_BUFFER, {
      // 24.1.4.3 ArrayBuffer.prototype.slice(start, end)
      slice: function slice(start, end) {
        if ($slice !== undefined && end === undefined) return $slice.call(_anObject(this), start); // FF fix
        var len = _anObject(this).byteLength;
        var first = _toAbsoluteIndex(start, len);
        var fin = _toAbsoluteIndex(end === undefined ? len : end, len);
        var result = new (_speciesConstructor(this, $ArrayBuffer))(_toLength(fin - first));
        var viewS = new $DataView(this);
        var viewT = new $DataView(result);
        var index = 0;
        while (first < fin) {
          viewT.setUint8(index++, viewS.getUint8(first++));
        } return result;
      }
    });

    _setSpecies(ARRAY_BUFFER);

    _export(_export.G + _export.W + _export.F * !_typed.ABV, {
      DataView: _typedBuffer.DataView
    });

    var _typedArray = createCommonjsModule(function (module) {
    if (_descriptors) {
      var global = _global;
      var fails = _fails;
      var $export = _export;
      var $typed = _typed;
      var $buffer = _typedBuffer;
      var ctx = _ctx;
      var anInstance = _anInstance;
      var propertyDesc = _propertyDesc;
      var hide = _hide;
      var redefineAll = _redefineAll;
      var toInteger = _toInteger;
      var toLength = _toLength;
      var toIndex = _toIndex;
      var toAbsoluteIndex = _toAbsoluteIndex;
      var toPrimitive = _toPrimitive;
      var has = _has;
      var classof = _classof;
      var isObject = _isObject;
      var toObject = _toObject;
      var isArrayIter = _isArrayIter;
      var create = _objectCreate;
      var getPrototypeOf = _objectGpo;
      var gOPN = _objectGopn.f;
      var getIterFn = core_getIteratorMethod;
      var uid = _uid;
      var wks = _wks;
      var createArrayMethod = _arrayMethods;
      var createArrayIncludes = _arrayIncludes;
      var speciesConstructor = _speciesConstructor;
      var ArrayIterators = es6_array_iterator;
      var Iterators = _iterators;
      var $iterDetect = _iterDetect;
      var setSpecies = _setSpecies;
      var arrayFill = _arrayFill;
      var arrayCopyWithin = _arrayCopyWithin;
      var $DP = _objectDp;
      var $GOPD = _objectGopd;
      var dP = $DP.f;
      var gOPD = $GOPD.f;
      var RangeError = global.RangeError;
      var TypeError = global.TypeError;
      var Uint8Array = global.Uint8Array;
      var ARRAY_BUFFER = 'ArrayBuffer';
      var SHARED_BUFFER = 'Shared' + ARRAY_BUFFER;
      var BYTES_PER_ELEMENT = 'BYTES_PER_ELEMENT';
      var PROTOTYPE = 'prototype';
      var ArrayProto = Array[PROTOTYPE];
      var $ArrayBuffer = $buffer.ArrayBuffer;
      var $DataView = $buffer.DataView;
      var arrayForEach = createArrayMethod(0);
      var arrayFilter = createArrayMethod(2);
      var arraySome = createArrayMethod(3);
      var arrayEvery = createArrayMethod(4);
      var arrayFind = createArrayMethod(5);
      var arrayFindIndex = createArrayMethod(6);
      var arrayIncludes = createArrayIncludes(true);
      var arrayIndexOf = createArrayIncludes(false);
      var arrayValues = ArrayIterators.values;
      var arrayKeys = ArrayIterators.keys;
      var arrayEntries = ArrayIterators.entries;
      var arrayLastIndexOf = ArrayProto.lastIndexOf;
      var arrayReduce = ArrayProto.reduce;
      var arrayReduceRight = ArrayProto.reduceRight;
      var arrayJoin = ArrayProto.join;
      var arraySort = ArrayProto.sort;
      var arraySlice = ArrayProto.slice;
      var arrayToString = ArrayProto.toString;
      var arrayToLocaleString = ArrayProto.toLocaleString;
      var ITERATOR = wks('iterator');
      var TAG = wks('toStringTag');
      var TYPED_CONSTRUCTOR = uid('typed_constructor');
      var DEF_CONSTRUCTOR = uid('def_constructor');
      var ALL_CONSTRUCTORS = $typed.CONSTR;
      var TYPED_ARRAY = $typed.TYPED;
      var VIEW = $typed.VIEW;
      var WRONG_LENGTH = 'Wrong length!';

      var $map = createArrayMethod(1, function (O, length) {
        return allocate(speciesConstructor(O, O[DEF_CONSTRUCTOR]), length);
      });

      var LITTLE_ENDIAN = fails(function () {
        // eslint-disable-next-line no-undef
        return new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
      });

      var FORCED_SET = !!Uint8Array && !!Uint8Array[PROTOTYPE].set && fails(function () {
        new Uint8Array(1).set({});
      });

      var toOffset = function (it, BYTES) {
        var offset = toInteger(it);
        if (offset < 0 || offset % BYTES) throw RangeError('Wrong offset!');
        return offset;
      };

      var validate = function (it) {
        if (isObject(it) && TYPED_ARRAY in it) return it;
        throw TypeError(it + ' is not a typed array!');
      };

      var allocate = function (C, length) {
        if (!(isObject(C) && TYPED_CONSTRUCTOR in C)) {
          throw TypeError('It is not a typed array constructor!');
        } return new C(length);
      };

      var speciesFromList = function (O, list) {
        return fromList(speciesConstructor(O, O[DEF_CONSTRUCTOR]), list);
      };

      var fromList = function (C, list) {
        var index = 0;
        var length = list.length;
        var result = allocate(C, length);
        while (length > index) result[index] = list[index++];
        return result;
      };

      var addGetter = function (it, key, internal) {
        dP(it, key, { get: function () { return this._d[internal]; } });
      };

      var $from = function from(source /* , mapfn, thisArg */) {
        var O = toObject(source);
        var aLen = arguments.length;
        var mapfn = aLen > 1 ? arguments[1] : undefined;
        var mapping = mapfn !== undefined;
        var iterFn = getIterFn(O);
        var i, length, values, result, step, iterator;
        if (iterFn != undefined && !isArrayIter(iterFn)) {
          for (iterator = iterFn.call(O), values = [], i = 0; !(step = iterator.next()).done; i++) {
            values.push(step.value);
          } O = values;
        }
        if (mapping && aLen > 2) mapfn = ctx(mapfn, arguments[2], 2);
        for (i = 0, length = toLength(O.length), result = allocate(this, length); length > i; i++) {
          result[i] = mapping ? mapfn(O[i], i) : O[i];
        }
        return result;
      };

      var $of = function of(/* ...items */) {
        var index = 0;
        var length = arguments.length;
        var result = allocate(this, length);
        while (length > index) result[index] = arguments[index++];
        return result;
      };

      // iOS Safari 6.x fails here
      var TO_LOCALE_BUG = !!Uint8Array && fails(function () { arrayToLocaleString.call(new Uint8Array(1)); });

      var $toLocaleString = function toLocaleString() {
        return arrayToLocaleString.apply(TO_LOCALE_BUG ? arraySlice.call(validate(this)) : validate(this), arguments);
      };

      var proto = {
        copyWithin: function copyWithin(target, start /* , end */) {
          return arrayCopyWithin.call(validate(this), target, start, arguments.length > 2 ? arguments[2] : undefined);
        },
        every: function every(callbackfn /* , thisArg */) {
          return arrayEvery(validate(this), callbackfn, arguments.length > 1 ? arguments[1] : undefined);
        },
        fill: function fill(value /* , start, end */) { // eslint-disable-line no-unused-vars
          return arrayFill.apply(validate(this), arguments);
        },
        filter: function filter(callbackfn /* , thisArg */) {
          return speciesFromList(this, arrayFilter(validate(this), callbackfn,
            arguments.length > 1 ? arguments[1] : undefined));
        },
        find: function find(predicate /* , thisArg */) {
          return arrayFind(validate(this), predicate, arguments.length > 1 ? arguments[1] : undefined);
        },
        findIndex: function findIndex(predicate /* , thisArg */) {
          return arrayFindIndex(validate(this), predicate, arguments.length > 1 ? arguments[1] : undefined);
        },
        forEach: function forEach(callbackfn /* , thisArg */) {
          arrayForEach(validate(this), callbackfn, arguments.length > 1 ? arguments[1] : undefined);
        },
        indexOf: function indexOf(searchElement /* , fromIndex */) {
          return arrayIndexOf(validate(this), searchElement, arguments.length > 1 ? arguments[1] : undefined);
        },
        includes: function includes(searchElement /* , fromIndex */) {
          return arrayIncludes(validate(this), searchElement, arguments.length > 1 ? arguments[1] : undefined);
        },
        join: function join(separator) { // eslint-disable-line no-unused-vars
          return arrayJoin.apply(validate(this), arguments);
        },
        lastIndexOf: function lastIndexOf(searchElement /* , fromIndex */) { // eslint-disable-line no-unused-vars
          return arrayLastIndexOf.apply(validate(this), arguments);
        },
        map: function map(mapfn /* , thisArg */) {
          return $map(validate(this), mapfn, arguments.length > 1 ? arguments[1] : undefined);
        },
        reduce: function reduce(callbackfn /* , initialValue */) { // eslint-disable-line no-unused-vars
          return arrayReduce.apply(validate(this), arguments);
        },
        reduceRight: function reduceRight(callbackfn /* , initialValue */) { // eslint-disable-line no-unused-vars
          return arrayReduceRight.apply(validate(this), arguments);
        },
        reverse: function reverse() {
          var that = this;
          var length = validate(that).length;
          var middle = Math.floor(length / 2);
          var index = 0;
          var value;
          while (index < middle) {
            value = that[index];
            that[index++] = that[--length];
            that[length] = value;
          } return that;
        },
        some: function some(callbackfn /* , thisArg */) {
          return arraySome(validate(this), callbackfn, arguments.length > 1 ? arguments[1] : undefined);
        },
        sort: function sort(comparefn) {
          return arraySort.call(validate(this), comparefn);
        },
        subarray: function subarray(begin, end) {
          var O = validate(this);
          var length = O.length;
          var $begin = toAbsoluteIndex(begin, length);
          return new (speciesConstructor(O, O[DEF_CONSTRUCTOR]))(
            O.buffer,
            O.byteOffset + $begin * O.BYTES_PER_ELEMENT,
            toLength((end === undefined ? length : toAbsoluteIndex(end, length)) - $begin)
          );
        }
      };

      var $slice = function slice(start, end) {
        return speciesFromList(this, arraySlice.call(validate(this), start, end));
      };

      var $set = function set(arrayLike /* , offset */) {
        validate(this);
        var offset = toOffset(arguments[1], 1);
        var length = this.length;
        var src = toObject(arrayLike);
        var len = toLength(src.length);
        var index = 0;
        if (len + offset > length) throw RangeError(WRONG_LENGTH);
        while (index < len) this[offset + index] = src[index++];
      };

      var $iterators = {
        entries: function entries() {
          return arrayEntries.call(validate(this));
        },
        keys: function keys() {
          return arrayKeys.call(validate(this));
        },
        values: function values() {
          return arrayValues.call(validate(this));
        }
      };

      var isTAIndex = function (target, key) {
        return isObject(target)
          && target[TYPED_ARRAY]
          && typeof key != 'symbol'
          && key in target
          && String(+key) == String(key);
      };
      var $getDesc = function getOwnPropertyDescriptor(target, key) {
        return isTAIndex(target, key = toPrimitive(key, true))
          ? propertyDesc(2, target[key])
          : gOPD(target, key);
      };
      var $setDesc = function defineProperty(target, key, desc) {
        if (isTAIndex(target, key = toPrimitive(key, true))
          && isObject(desc)
          && has(desc, 'value')
          && !has(desc, 'get')
          && !has(desc, 'set')
          // TODO: add validation descriptor w/o calling accessors
          && !desc.configurable
          && (!has(desc, 'writable') || desc.writable)
          && (!has(desc, 'enumerable') || desc.enumerable)
        ) {
          target[key] = desc.value;
          return target;
        } return dP(target, key, desc);
      };

      if (!ALL_CONSTRUCTORS) {
        $GOPD.f = $getDesc;
        $DP.f = $setDesc;
      }

      $export($export.S + $export.F * !ALL_CONSTRUCTORS, 'Object', {
        getOwnPropertyDescriptor: $getDesc,
        defineProperty: $setDesc
      });

      if (fails(function () { arrayToString.call({}); })) {
        arrayToString = arrayToLocaleString = function toString() {
          return arrayJoin.call(this);
        };
      }

      var $TypedArrayPrototype$ = redefineAll({}, proto);
      redefineAll($TypedArrayPrototype$, $iterators);
      hide($TypedArrayPrototype$, ITERATOR, $iterators.values);
      redefineAll($TypedArrayPrototype$, {
        slice: $slice,
        set: $set,
        constructor: function () { /* noop */ },
        toString: arrayToString,
        toLocaleString: $toLocaleString
      });
      addGetter($TypedArrayPrototype$, 'buffer', 'b');
      addGetter($TypedArrayPrototype$, 'byteOffset', 'o');
      addGetter($TypedArrayPrototype$, 'byteLength', 'l');
      addGetter($TypedArrayPrototype$, 'length', 'e');
      dP($TypedArrayPrototype$, TAG, {
        get: function () { return this[TYPED_ARRAY]; }
      });

      // eslint-disable-next-line max-statements
      module.exports = function (KEY, BYTES, wrapper, CLAMPED) {
        CLAMPED = !!CLAMPED;
        var NAME = KEY + (CLAMPED ? 'Clamped' : '') + 'Array';
        var GETTER = 'get' + KEY;
        var SETTER = 'set' + KEY;
        var TypedArray = global[NAME];
        var Base = TypedArray || {};
        var TAC = TypedArray && getPrototypeOf(TypedArray);
        var FORCED = !TypedArray || !$typed.ABV;
        var O = {};
        var TypedArrayPrototype = TypedArray && TypedArray[PROTOTYPE];
        var getter = function (that, index) {
          var data = that._d;
          return data.v[GETTER](index * BYTES + data.o, LITTLE_ENDIAN);
        };
        var setter = function (that, index, value) {
          var data = that._d;
          if (CLAMPED) value = (value = Math.round(value)) < 0 ? 0 : value > 0xff ? 0xff : value & 0xff;
          data.v[SETTER](index * BYTES + data.o, value, LITTLE_ENDIAN);
        };
        var addElement = function (that, index) {
          dP(that, index, {
            get: function () {
              return getter(this, index);
            },
            set: function (value) {
              return setter(this, index, value);
            },
            enumerable: true
          });
        };
        if (FORCED) {
          TypedArray = wrapper(function (that, data, $offset, $length) {
            anInstance(that, TypedArray, NAME, '_d');
            var index = 0;
            var offset = 0;
            var buffer, byteLength, length, klass;
            if (!isObject(data)) {
              length = toIndex(data);
              byteLength = length * BYTES;
              buffer = new $ArrayBuffer(byteLength);
            } else if (data instanceof $ArrayBuffer || (klass = classof(data)) == ARRAY_BUFFER || klass == SHARED_BUFFER) {
              buffer = data;
              offset = toOffset($offset, BYTES);
              var $len = data.byteLength;
              if ($length === undefined) {
                if ($len % BYTES) throw RangeError(WRONG_LENGTH);
                byteLength = $len - offset;
                if (byteLength < 0) throw RangeError(WRONG_LENGTH);
              } else {
                byteLength = toLength($length) * BYTES;
                if (byteLength + offset > $len) throw RangeError(WRONG_LENGTH);
              }
              length = byteLength / BYTES;
            } else if (TYPED_ARRAY in data) {
              return fromList(TypedArray, data);
            } else {
              return $from.call(TypedArray, data);
            }
            hide(that, '_d', {
              b: buffer,
              o: offset,
              l: byteLength,
              e: length,
              v: new $DataView(buffer)
            });
            while (index < length) addElement(that, index++);
          });
          TypedArrayPrototype = TypedArray[PROTOTYPE] = create($TypedArrayPrototype$);
          hide(TypedArrayPrototype, 'constructor', TypedArray);
        } else if (!fails(function () {
          TypedArray(1);
        }) || !fails(function () {
          new TypedArray(-1); // eslint-disable-line no-new
        }) || !$iterDetect(function (iter) {
          new TypedArray(); // eslint-disable-line no-new
          new TypedArray(null); // eslint-disable-line no-new
          new TypedArray(1.5); // eslint-disable-line no-new
          new TypedArray(iter); // eslint-disable-line no-new
        }, true)) {
          TypedArray = wrapper(function (that, data, $offset, $length) {
            anInstance(that, TypedArray, NAME);
            var klass;
            // `ws` module bug, temporarily remove validation length for Uint8Array
            // https://github.com/websockets/ws/pull/645
            if (!isObject(data)) return new Base(toIndex(data));
            if (data instanceof $ArrayBuffer || (klass = classof(data)) == ARRAY_BUFFER || klass == SHARED_BUFFER) {
              return $length !== undefined
                ? new Base(data, toOffset($offset, BYTES), $length)
                : $offset !== undefined
                  ? new Base(data, toOffset($offset, BYTES))
                  : new Base(data);
            }
            if (TYPED_ARRAY in data) return fromList(TypedArray, data);
            return $from.call(TypedArray, data);
          });
          arrayForEach(TAC !== Function.prototype ? gOPN(Base).concat(gOPN(TAC)) : gOPN(Base), function (key) {
            if (!(key in TypedArray)) hide(TypedArray, key, Base[key]);
          });
          TypedArray[PROTOTYPE] = TypedArrayPrototype;
          TypedArrayPrototype.constructor = TypedArray;
        }
        var $nativeIterator = TypedArrayPrototype[ITERATOR];
        var CORRECT_ITER_NAME = !!$nativeIterator
          && ($nativeIterator.name == 'values' || $nativeIterator.name == undefined);
        var $iterator = $iterators.values;
        hide(TypedArray, TYPED_CONSTRUCTOR, true);
        hide(TypedArrayPrototype, TYPED_ARRAY, NAME);
        hide(TypedArrayPrototype, VIEW, true);
        hide(TypedArrayPrototype, DEF_CONSTRUCTOR, TypedArray);

        if (CLAMPED ? new TypedArray(1)[TAG] != NAME : !(TAG in TypedArrayPrototype)) {
          dP(TypedArrayPrototype, TAG, {
            get: function () { return NAME; }
          });
        }

        O[NAME] = TypedArray;

        $export($export.G + $export.W + $export.F * (TypedArray != Base), O);

        $export($export.S, NAME, {
          BYTES_PER_ELEMENT: BYTES
        });

        $export($export.S + $export.F * fails(function () { Base.of.call(TypedArray, 1); }), NAME, {
          from: $from,
          of: $of
        });

        if (!(BYTES_PER_ELEMENT in TypedArrayPrototype)) hide(TypedArrayPrototype, BYTES_PER_ELEMENT, BYTES);

        $export($export.P, NAME, proto);

        setSpecies(NAME);

        $export($export.P + $export.F * FORCED_SET, NAME, { set: $set });

        $export($export.P + $export.F * !CORRECT_ITER_NAME, NAME, $iterators);

        if (TypedArrayPrototype.toString != arrayToString) TypedArrayPrototype.toString = arrayToString;

        $export($export.P + $export.F * fails(function () {
          new TypedArray(1).slice();
        }), NAME, { slice: $slice });

        $export($export.P + $export.F * (fails(function () {
          return [1, 2].toLocaleString() != new TypedArray([1, 2]).toLocaleString();
        }) || !fails(function () {
          TypedArrayPrototype.toLocaleString.call([1, 2]);
        })), NAME, { toLocaleString: $toLocaleString });

        Iterators[NAME] = CORRECT_ITER_NAME ? $nativeIterator : $iterator;
        if (!CORRECT_ITER_NAME) hide(TypedArrayPrototype, ITERATOR, $iterator);
      };
    } else module.exports = function () { /* empty */ };
    });

    _typedArray('Int8', 1, function (init) {
      return function Int8Array(data, byteOffset, length) {
        return init(this, data, byteOffset, length);
      };
    });

    _typedArray('Uint8', 1, function (init) {
      return function Uint8Array(data, byteOffset, length) {
        return init(this, data, byteOffset, length);
      };
    });

    _typedArray('Uint8', 1, function (init) {
      return function Uint8ClampedArray(data, byteOffset, length) {
        return init(this, data, byteOffset, length);
      };
    }, true);

    _typedArray('Int16', 2, function (init) {
      return function Int16Array(data, byteOffset, length) {
        return init(this, data, byteOffset, length);
      };
    });

    _typedArray('Uint16', 2, function (init) {
      return function Uint16Array(data, byteOffset, length) {
        return init(this, data, byteOffset, length);
      };
    });

    _typedArray('Int32', 4, function (init) {
      return function Int32Array(data, byteOffset, length) {
        return init(this, data, byteOffset, length);
      };
    });

    _typedArray('Uint32', 4, function (init) {
      return function Uint32Array(data, byteOffset, length) {
        return init(this, data, byteOffset, length);
      };
    });

    _typedArray('Float32', 4, function (init) {
      return function Float32Array(data, byteOffset, length) {
        return init(this, data, byteOffset, length);
      };
    });

    _typedArray('Float64', 8, function (init) {
      return function Float64Array(data, byteOffset, length) {
        return init(this, data, byteOffset, length);
      };
    });

    // 26.1.1 Reflect.apply(target, thisArgument, argumentsList)



    var rApply = (_global.Reflect || {}).apply;
    var fApply = Function.apply;
    // MS Edge argumentsList argument is optional
    _export(_export.S + _export.F * !_fails(function () {
      rApply(function () { /* empty */ });
    }), 'Reflect', {
      apply: function apply(target, thisArgument, argumentsList) {
        var T = _aFunction(target);
        var L = _anObject(argumentsList);
        return rApply ? rApply(T, thisArgument, L) : fApply.call(T, thisArgument, L);
      }
    });

    // 26.1.2 Reflect.construct(target, argumentsList [, newTarget])







    var rConstruct = (_global.Reflect || {}).construct;

    // MS Edge supports only 2 arguments and argumentsList argument is optional
    // FF Nightly sets third argument as `new.target`, but does not create `this` from it
    var NEW_TARGET_BUG = _fails(function () {
      function F() { /* empty */ }
      return !(rConstruct(function () { /* empty */ }, [], F) instanceof F);
    });
    var ARGS_BUG = !_fails(function () {
      rConstruct(function () { /* empty */ });
    });

    _export(_export.S + _export.F * (NEW_TARGET_BUG || ARGS_BUG), 'Reflect', {
      construct: function construct(Target, args /* , newTarget */) {
        _aFunction(Target);
        _anObject(args);
        var newTarget = arguments.length < 3 ? Target : _aFunction(arguments[2]);
        if (ARGS_BUG && !NEW_TARGET_BUG) return rConstruct(Target, args, newTarget);
        if (Target == newTarget) {
          // w/o altered newTarget, optimization for 0-4 arguments
          switch (args.length) {
            case 0: return new Target();
            case 1: return new Target(args[0]);
            case 2: return new Target(args[0], args[1]);
            case 3: return new Target(args[0], args[1], args[2]);
            case 4: return new Target(args[0], args[1], args[2], args[3]);
          }
          // w/o altered newTarget, lot of arguments case
          var $args = [null];
          $args.push.apply($args, args);
          return new (_bind.apply(Target, $args))();
        }
        // with altered newTarget, not support built-in constructors
        var proto = newTarget.prototype;
        var instance = _objectCreate(_isObject(proto) ? proto : Object.prototype);
        var result = Function.apply.call(Target, instance, args);
        return _isObject(result) ? result : instance;
      }
    });

    // 26.1.3 Reflect.defineProperty(target, propertyKey, attributes)





    // MS Edge has broken Reflect.defineProperty - throwing instead of returning false
    _export(_export.S + _export.F * _fails(function () {
      // eslint-disable-next-line no-undef
      Reflect.defineProperty(_objectDp.f({}, 1, { value: 1 }), 1, { value: 2 });
    }), 'Reflect', {
      defineProperty: function defineProperty(target, propertyKey, attributes) {
        _anObject(target);
        propertyKey = _toPrimitive(propertyKey, true);
        _anObject(attributes);
        try {
          _objectDp.f(target, propertyKey, attributes);
          return true;
        } catch (e) {
          return false;
        }
      }
    });

    // 26.1.4 Reflect.deleteProperty(target, propertyKey)

    var gOPD$3 = _objectGopd.f;


    _export(_export.S, 'Reflect', {
      deleteProperty: function deleteProperty(target, propertyKey) {
        var desc = gOPD$3(_anObject(target), propertyKey);
        return desc && !desc.configurable ? false : delete target[propertyKey];
      }
    });

    // 26.1.5 Reflect.enumerate(target)


    var Enumerate = function (iterated) {
      this._t = _anObject(iterated); // target
      this._i = 0;                  // next index
      var keys = this._k = [];      // keys
      var key;
      for (key in iterated) keys.push(key);
    };
    _iterCreate(Enumerate, 'Object', function () {
      var that = this;
      var keys = that._k;
      var key;
      do {
        if (that._i >= keys.length) return { value: undefined, done: true };
      } while (!((key = keys[that._i++]) in that._t));
      return { value: key, done: false };
    });

    _export(_export.S, 'Reflect', {
      enumerate: function enumerate(target) {
        return new Enumerate(target);
      }
    });

    // 26.1.6 Reflect.get(target, propertyKey [, receiver])







    function get(target, propertyKey /* , receiver */) {
      var receiver = arguments.length < 3 ? target : arguments[2];
      var desc, proto;
      if (_anObject(target) === receiver) return target[propertyKey];
      if (desc = _objectGopd.f(target, propertyKey)) return _has(desc, 'value')
        ? desc.value
        : desc.get !== undefined
          ? desc.get.call(receiver)
          : undefined;
      if (_isObject(proto = _objectGpo(target))) return get(proto, propertyKey, receiver);
    }

    _export(_export.S, 'Reflect', { get: get });

    // 26.1.7 Reflect.getOwnPropertyDescriptor(target, propertyKey)




    _export(_export.S, 'Reflect', {
      getOwnPropertyDescriptor: function getOwnPropertyDescriptor(target, propertyKey) {
        return _objectGopd.f(_anObject(target), propertyKey);
      }
    });

    // 26.1.8 Reflect.getPrototypeOf(target)




    _export(_export.S, 'Reflect', {
      getPrototypeOf: function getPrototypeOf(target) {
        return _objectGpo(_anObject(target));
      }
    });

    // 26.1.9 Reflect.has(target, propertyKey)


    _export(_export.S, 'Reflect', {
      has: function has(target, propertyKey) {
        return propertyKey in target;
      }
    });

    // 26.1.10 Reflect.isExtensible(target)


    var $isExtensible = Object.isExtensible;

    _export(_export.S, 'Reflect', {
      isExtensible: function isExtensible(target) {
        _anObject(target);
        return $isExtensible ? $isExtensible(target) : true;
      }
    });

    // all object keys, includes non-enumerable and symbols



    var Reflect$1 = _global.Reflect;
    var _ownKeys = Reflect$1 && Reflect$1.ownKeys || function ownKeys(it) {
      var keys = _objectGopn.f(_anObject(it));
      var getSymbols = _objectGops.f;
      return getSymbols ? keys.concat(getSymbols(it)) : keys;
    };

    // 26.1.11 Reflect.ownKeys(target)


    _export(_export.S, 'Reflect', { ownKeys: _ownKeys });

    // 26.1.12 Reflect.preventExtensions(target)


    var $preventExtensions = Object.preventExtensions;

    _export(_export.S, 'Reflect', {
      preventExtensions: function preventExtensions(target) {
        _anObject(target);
        try {
          if ($preventExtensions) $preventExtensions(target);
          return true;
        } catch (e) {
          return false;
        }
      }
    });

    // 26.1.13 Reflect.set(target, propertyKey, V [, receiver])









    function set(target, propertyKey, V /* , receiver */) {
      var receiver = arguments.length < 4 ? target : arguments[3];
      var ownDesc = _objectGopd.f(_anObject(target), propertyKey);
      var existingDescriptor, proto;
      if (!ownDesc) {
        if (_isObject(proto = _objectGpo(target))) {
          return set(proto, propertyKey, V, receiver);
        }
        ownDesc = _propertyDesc(0);
      }
      if (_has(ownDesc, 'value')) {
        if (ownDesc.writable === false || !_isObject(receiver)) return false;
        if (existingDescriptor = _objectGopd.f(receiver, propertyKey)) {
          if (existingDescriptor.get || existingDescriptor.set || existingDescriptor.writable === false) return false;
          existingDescriptor.value = V;
          _objectDp.f(receiver, propertyKey, existingDescriptor);
        } else _objectDp.f(receiver, propertyKey, _propertyDesc(0, V));
        return true;
      }
      return ownDesc.set === undefined ? false : (ownDesc.set.call(receiver, V), true);
    }

    _export(_export.S, 'Reflect', { set: set });

    // 26.1.14 Reflect.setPrototypeOf(target, proto)



    if (_setProto) _export(_export.S, 'Reflect', {
      setPrototypeOf: function setPrototypeOf(target, proto) {
        _setProto.check(target, proto);
        try {
          _setProto.set(target, proto);
          return true;
        } catch (e) {
          return false;
        }
      }
    });

    // https://github.com/tc39/Array.prototype.includes

    var $includes = _arrayIncludes(true);

    _export(_export.P, 'Array', {
      includes: function includes(el /* , fromIndex = 0 */) {
        return $includes(this, el, arguments.length > 1 ? arguments[1] : undefined);
      }
    });

    _addToUnscopables('includes');

    // https://tc39.github.io/proposal-flatMap/#sec-FlattenIntoArray




    var IS_CONCAT_SPREADABLE = _wks('isConcatSpreadable');

    function flattenIntoArray(target, original, source, sourceLen, start, depth, mapper, thisArg) {
      var targetIndex = start;
      var sourceIndex = 0;
      var mapFn = mapper ? _ctx(mapper, thisArg, 3) : false;
      var element, spreadable;

      while (sourceIndex < sourceLen) {
        if (sourceIndex in source) {
          element = mapFn ? mapFn(source[sourceIndex], sourceIndex, original) : source[sourceIndex];

          spreadable = false;
          if (_isObject(element)) {
            spreadable = element[IS_CONCAT_SPREADABLE];
            spreadable = spreadable !== undefined ? !!spreadable : _isArray(element);
          }

          if (spreadable && depth > 0) {
            targetIndex = flattenIntoArray(target, original, element, _toLength(element.length), targetIndex, depth - 1) - 1;
          } else {
            if (targetIndex >= 0x1fffffffffffff) throw TypeError();
            target[targetIndex] = element;
          }

          targetIndex++;
        }
        sourceIndex++;
      }
      return targetIndex;
    }

    var _flattenIntoArray = flattenIntoArray;

    // https://tc39.github.io/proposal-flatMap/#sec-Array.prototype.flatMap







    _export(_export.P, 'Array', {
      flatMap: function flatMap(callbackfn /* , thisArg */) {
        var O = _toObject(this);
        var sourceLen, A;
        _aFunction(callbackfn);
        sourceLen = _toLength(O.length);
        A = _arraySpeciesCreate(O, 0);
        _flattenIntoArray(A, O, O, sourceLen, 0, 1, callbackfn, arguments[1]);
        return A;
      }
    });

    _addToUnscopables('flatMap');

    // https://tc39.github.io/proposal-flatMap/#sec-Array.prototype.flatten







    _export(_export.P, 'Array', {
      flatten: function flatten(/* depthArg = 1 */) {
        var depthArg = arguments[0];
        var O = _toObject(this);
        var sourceLen = _toLength(O.length);
        var A = _arraySpeciesCreate(O, 0);
        _flattenIntoArray(A, O, O, sourceLen, 0, depthArg === undefined ? 1 : _toInteger(depthArg));
        return A;
      }
    });

    _addToUnscopables('flatten');

    // https://github.com/mathiasbynens/String.prototype.at

    var $at$2 = _stringAt(true);

    _export(_export.P, 'String', {
      at: function at(pos) {
        return $at$2(this, pos);
      }
    });

    // https://github.com/tc39/proposal-string-pad-start-end




    var _stringPad = function (that, maxLength, fillString, left) {
      var S = String(_defined(that));
      var stringLength = S.length;
      var fillStr = fillString === undefined ? ' ' : String(fillString);
      var intMaxLength = _toLength(maxLength);
      if (intMaxLength <= stringLength || fillStr == '') return S;
      var fillLen = intMaxLength - stringLength;
      var stringFiller = _stringRepeat.call(fillStr, Math.ceil(fillLen / fillStr.length));
      if (stringFiller.length > fillLen) stringFiller = stringFiller.slice(0, fillLen);
      return left ? stringFiller + S : S + stringFiller;
    };

    // https://github.com/tc39/proposal-string-pad-start-end




    // https://github.com/zloirock/core-js/issues/280
    var WEBKIT_BUG = /Version\/10\.\d+(\.\d+)?( Mobile\/\w+)? Safari\//.test(_userAgent);

    _export(_export.P + _export.F * WEBKIT_BUG, 'String', {
      padStart: function padStart(maxLength /* , fillString = ' ' */) {
        return _stringPad(this, maxLength, arguments.length > 1 ? arguments[1] : undefined, true);
      }
    });

    // https://github.com/tc39/proposal-string-pad-start-end




    // https://github.com/zloirock/core-js/issues/280
    var WEBKIT_BUG$1 = /Version\/10\.\d+(\.\d+)?( Mobile\/\w+)? Safari\//.test(_userAgent);

    _export(_export.P + _export.F * WEBKIT_BUG$1, 'String', {
      padEnd: function padEnd(maxLength /* , fillString = ' ' */) {
        return _stringPad(this, maxLength, arguments.length > 1 ? arguments[1] : undefined, false);
      }
    });

    // https://github.com/sebmarkbage/ecmascript-string-left-right-trim
    _stringTrim('trimLeft', function ($trim) {
      return function trimLeft() {
        return $trim(this, 1);
      };
    }, 'trimStart');

    // https://github.com/sebmarkbage/ecmascript-string-left-right-trim
    _stringTrim('trimRight', function ($trim) {
      return function trimRight() {
        return $trim(this, 2);
      };
    }, 'trimEnd');

    // https://tc39.github.io/String.prototype.matchAll/





    var RegExpProto = RegExp.prototype;

    var $RegExpStringIterator = function (regexp, string) {
      this._r = regexp;
      this._s = string;
    };

    _iterCreate($RegExpStringIterator, 'RegExp String', function next() {
      var match = this._r.exec(this._s);
      return { value: match, done: match === null };
    });

    _export(_export.P, 'String', {
      matchAll: function matchAll(regexp) {
        _defined(this);
        if (!_isRegexp(regexp)) throw TypeError(regexp + ' is not a regexp!');
        var S = String(this);
        var flags = 'flags' in RegExpProto ? String(regexp.flags) : _flags.call(regexp);
        var rx = new RegExp(regexp.source, ~flags.indexOf('g') ? flags : 'g' + flags);
        rx.lastIndex = _toLength(regexp.lastIndex);
        return new $RegExpStringIterator(rx, S);
      }
    });

    _wksDefine('asyncIterator');

    _wksDefine('observable');

    // https://github.com/tc39/proposal-object-getownpropertydescriptors






    _export(_export.S, 'Object', {
      getOwnPropertyDescriptors: function getOwnPropertyDescriptors(object) {
        var O = _toIobject(object);
        var getDesc = _objectGopd.f;
        var keys = _ownKeys(O);
        var result = {};
        var i = 0;
        var key, desc;
        while (keys.length > i) {
          desc = getDesc(O, key = keys[i++]);
          if (desc !== undefined) _createProperty(result, key, desc);
        }
        return result;
      }
    });

    var isEnum$1 = _objectPie.f;
    var _objectToArray = function (isEntries) {
      return function (it) {
        var O = _toIobject(it);
        var keys = _objectKeys(O);
        var length = keys.length;
        var i = 0;
        var result = [];
        var key;
        while (length > i) if (isEnum$1.call(O, key = keys[i++])) {
          result.push(isEntries ? [key, O[key]] : O[key]);
        } return result;
      };
    };

    // https://github.com/tc39/proposal-object-values-entries

    var $values = _objectToArray(false);

    _export(_export.S, 'Object', {
      values: function values(it) {
        return $values(it);
      }
    });

    // https://github.com/tc39/proposal-object-values-entries

    var $entries = _objectToArray(true);

    _export(_export.S, 'Object', {
      entries: function entries(it) {
        return $entries(it);
      }
    });

    // Forced replacement prototype accessors methods
    var _objectForcedPam = _library || !_fails(function () {
      var K = Math.random();
      // In FF throws only define methods
      // eslint-disable-next-line no-undef, no-useless-call
      __defineSetter__.call(null, K, function () { /* empty */ });
      delete _global[K];
    });

    // B.2.2.2 Object.prototype.__defineGetter__(P, getter)
    _descriptors && _export(_export.P + _objectForcedPam, 'Object', {
      __defineGetter__: function __defineGetter__(P, getter) {
        _objectDp.f(_toObject(this), P, { get: _aFunction(getter), enumerable: true, configurable: true });
      }
    });

    // B.2.2.3 Object.prototype.__defineSetter__(P, setter)
    _descriptors && _export(_export.P + _objectForcedPam, 'Object', {
      __defineSetter__: function __defineSetter__(P, setter) {
        _objectDp.f(_toObject(this), P, { set: _aFunction(setter), enumerable: true, configurable: true });
      }
    });

    var getOwnPropertyDescriptor = _objectGopd.f;

    // B.2.2.4 Object.prototype.__lookupGetter__(P)
    _descriptors && _export(_export.P + _objectForcedPam, 'Object', {
      __lookupGetter__: function __lookupGetter__(P) {
        var O = _toObject(this);
        var K = _toPrimitive(P, true);
        var D;
        do {
          if (D = getOwnPropertyDescriptor(O, K)) return D.get;
        } while (O = _objectGpo(O));
      }
    });

    var getOwnPropertyDescriptor$1 = _objectGopd.f;

    // B.2.2.5 Object.prototype.__lookupSetter__(P)
    _descriptors && _export(_export.P + _objectForcedPam, 'Object', {
      __lookupSetter__: function __lookupSetter__(P) {
        var O = _toObject(this);
        var K = _toPrimitive(P, true);
        var D;
        do {
          if (D = getOwnPropertyDescriptor$1(O, K)) return D.set;
        } while (O = _objectGpo(O));
      }
    });

    var _arrayFromIterable = function (iter, ITERATOR) {
      var result = [];
      _forOf(iter, false, result.push, result, ITERATOR);
      return result;
    };

    // https://github.com/DavidBruant/Map-Set.prototype.toJSON


    var _collectionToJson = function (NAME) {
      return function toJSON() {
        if (_classof(this) != NAME) throw TypeError(NAME + "#toJSON isn't generic");
        return _arrayFromIterable(this);
      };
    };

    // https://github.com/DavidBruant/Map-Set.prototype.toJSON


    _export(_export.P + _export.R, 'Map', { toJSON: _collectionToJson('Map') });

    // https://github.com/DavidBruant/Map-Set.prototype.toJSON


    _export(_export.P + _export.R, 'Set', { toJSON: _collectionToJson('Set') });

    // https://tc39.github.io/proposal-setmap-offrom/


    var _setCollectionOf = function (COLLECTION) {
      _export(_export.S, COLLECTION, { of: function of() {
        var length = arguments.length;
        var A = new Array(length);
        while (length--) A[length] = arguments[length];
        return new this(A);
      } });
    };

    // https://tc39.github.io/proposal-setmap-offrom/#sec-map.of
    _setCollectionOf('Map');

    // https://tc39.github.io/proposal-setmap-offrom/#sec-set.of
    _setCollectionOf('Set');

    // https://tc39.github.io/proposal-setmap-offrom/#sec-weakmap.of
    _setCollectionOf('WeakMap');

    // https://tc39.github.io/proposal-setmap-offrom/#sec-weakset.of
    _setCollectionOf('WeakSet');

    // https://tc39.github.io/proposal-setmap-offrom/





    var _setCollectionFrom = function (COLLECTION) {
      _export(_export.S, COLLECTION, { from: function from(source /* , mapFn, thisArg */) {
        var mapFn = arguments[1];
        var mapping, A, n, cb;
        _aFunction(this);
        mapping = mapFn !== undefined;
        if (mapping) _aFunction(mapFn);
        if (source == undefined) return new this();
        A = [];
        if (mapping) {
          n = 0;
          cb = _ctx(mapFn, arguments[2], 2);
          _forOf(source, false, function (nextItem) {
            A.push(cb(nextItem, n++));
          });
        } else {
          _forOf(source, false, A.push, A);
        }
        return new this(A);
      } });
    };

    // https://tc39.github.io/proposal-setmap-offrom/#sec-map.from
    _setCollectionFrom('Map');

    // https://tc39.github.io/proposal-setmap-offrom/#sec-set.from
    _setCollectionFrom('Set');

    // https://tc39.github.io/proposal-setmap-offrom/#sec-weakmap.from
    _setCollectionFrom('WeakMap');

    // https://tc39.github.io/proposal-setmap-offrom/#sec-weakset.from
    _setCollectionFrom('WeakSet');

    // https://github.com/tc39/proposal-global


    _export(_export.G, { global: _global });

    // https://github.com/tc39/proposal-global


    _export(_export.S, 'System', { global: _global });

    // https://github.com/ljharb/proposal-is-error



    _export(_export.S, 'Error', {
      isError: function isError(it) {
        return _cof(it) === 'Error';
      }
    });

    // https://rwaldron.github.io/proposal-math-extensions/


    _export(_export.S, 'Math', {
      clamp: function clamp(x, lower, upper) {
        return Math.min(upper, Math.max(lower, x));
      }
    });

    // https://rwaldron.github.io/proposal-math-extensions/


    _export(_export.S, 'Math', { DEG_PER_RAD: Math.PI / 180 });

    // https://rwaldron.github.io/proposal-math-extensions/

    var RAD_PER_DEG = 180 / Math.PI;

    _export(_export.S, 'Math', {
      degrees: function degrees(radians) {
        return radians * RAD_PER_DEG;
      }
    });

    // https://rwaldron.github.io/proposal-math-extensions/
    var _mathScale = Math.scale || function scale(x, inLow, inHigh, outLow, outHigh) {
      if (
        arguments.length === 0
          // eslint-disable-next-line no-self-compare
          || x != x
          // eslint-disable-next-line no-self-compare
          || inLow != inLow
          // eslint-disable-next-line no-self-compare
          || inHigh != inHigh
          // eslint-disable-next-line no-self-compare
          || outLow != outLow
          // eslint-disable-next-line no-self-compare
          || outHigh != outHigh
      ) return NaN;
      if (x === Infinity || x === -Infinity) return x;
      return (x - inLow) * (outHigh - outLow) / (inHigh - inLow) + outLow;
    };

    // https://rwaldron.github.io/proposal-math-extensions/




    _export(_export.S, 'Math', {
      fscale: function fscale(x, inLow, inHigh, outLow, outHigh) {
        return _mathFround(_mathScale(x, inLow, inHigh, outLow, outHigh));
      }
    });

    // https://gist.github.com/BrendanEich/4294d5c212a6d2254703


    _export(_export.S, 'Math', {
      iaddh: function iaddh(x0, x1, y0, y1) {
        var $x0 = x0 >>> 0;
        var $x1 = x1 >>> 0;
        var $y0 = y0 >>> 0;
        return $x1 + (y1 >>> 0) + (($x0 & $y0 | ($x0 | $y0) & ~($x0 + $y0 >>> 0)) >>> 31) | 0;
      }
    });

    // https://gist.github.com/BrendanEich/4294d5c212a6d2254703


    _export(_export.S, 'Math', {
      isubh: function isubh(x0, x1, y0, y1) {
        var $x0 = x0 >>> 0;
        var $x1 = x1 >>> 0;
        var $y0 = y0 >>> 0;
        return $x1 - (y1 >>> 0) - ((~$x0 & $y0 | ~($x0 ^ $y0) & $x0 - $y0 >>> 0) >>> 31) | 0;
      }
    });

    // https://gist.github.com/BrendanEich/4294d5c212a6d2254703


    _export(_export.S, 'Math', {
      imulh: function imulh(u, v) {
        var UINT16 = 0xffff;
        var $u = +u;
        var $v = +v;
        var u0 = $u & UINT16;
        var v0 = $v & UINT16;
        var u1 = $u >> 16;
        var v1 = $v >> 16;
        var t = (u1 * v0 >>> 0) + (u0 * v0 >>> 16);
        return u1 * v1 + (t >> 16) + ((u0 * v1 >>> 0) + (t & UINT16) >> 16);
      }
    });

    // https://rwaldron.github.io/proposal-math-extensions/


    _export(_export.S, 'Math', { RAD_PER_DEG: 180 / Math.PI });

    // https://rwaldron.github.io/proposal-math-extensions/

    var DEG_PER_RAD = Math.PI / 180;

    _export(_export.S, 'Math', {
      radians: function radians(degrees) {
        return degrees * DEG_PER_RAD;
      }
    });

    // https://rwaldron.github.io/proposal-math-extensions/


    _export(_export.S, 'Math', { scale: _mathScale });

    // https://gist.github.com/BrendanEich/4294d5c212a6d2254703


    _export(_export.S, 'Math', {
      umulh: function umulh(u, v) {
        var UINT16 = 0xffff;
        var $u = +u;
        var $v = +v;
        var u0 = $u & UINT16;
        var v0 = $v & UINT16;
        var u1 = $u >>> 16;
        var v1 = $v >>> 16;
        var t = (u1 * v0 >>> 0) + (u0 * v0 >>> 16);
        return u1 * v1 + (t >>> 16) + ((u0 * v1 >>> 0) + (t & UINT16) >>> 16);
      }
    });

    // http://jfbastien.github.io/papers/Math.signbit.html


    _export(_export.S, 'Math', { signbit: function signbit(x) {
      // eslint-disable-next-line no-self-compare
      return (x = +x) != x ? x : x == 0 ? 1 / x == Infinity : x > 0;
    } });

    _export(_export.P + _export.R, 'Promise', { 'finally': function (onFinally) {
      var C = _speciesConstructor(this, _core.Promise || _global.Promise);
      var isFunction = typeof onFinally == 'function';
      return this.then(
        isFunction ? function (x) {
          return _promiseResolve(C, onFinally()).then(function () { return x; });
        } : onFinally,
        isFunction ? function (e) {
          return _promiseResolve(C, onFinally()).then(function () { throw e; });
        } : onFinally
      );
    } });

    // https://github.com/tc39/proposal-promise-try




    _export(_export.S, 'Promise', { 'try': function (callbackfn) {
      var promiseCapability = _newPromiseCapability.f(this);
      var result = _perform(callbackfn);
      (result.e ? promiseCapability.reject : promiseCapability.resolve)(result.v);
      return promiseCapability.promise;
    } });

    var shared$1 = _shared('metadata');
    var store = shared$1.store || (shared$1.store = new (es6_weakMap)());

    var getOrCreateMetadataMap = function (target, targetKey, create) {
      var targetMetadata = store.get(target);
      if (!targetMetadata) {
        if (!create) return undefined;
        store.set(target, targetMetadata = new es6_map());
      }
      var keyMetadata = targetMetadata.get(targetKey);
      if (!keyMetadata) {
        if (!create) return undefined;
        targetMetadata.set(targetKey, keyMetadata = new es6_map());
      } return keyMetadata;
    };
    var ordinaryHasOwnMetadata = function (MetadataKey, O, P) {
      var metadataMap = getOrCreateMetadataMap(O, P, false);
      return metadataMap === undefined ? false : metadataMap.has(MetadataKey);
    };
    var ordinaryGetOwnMetadata = function (MetadataKey, O, P) {
      var metadataMap = getOrCreateMetadataMap(O, P, false);
      return metadataMap === undefined ? undefined : metadataMap.get(MetadataKey);
    };
    var ordinaryDefineOwnMetadata = function (MetadataKey, MetadataValue, O, P) {
      getOrCreateMetadataMap(O, P, true).set(MetadataKey, MetadataValue);
    };
    var ordinaryOwnMetadataKeys = function (target, targetKey) {
      var metadataMap = getOrCreateMetadataMap(target, targetKey, false);
      var keys = [];
      if (metadataMap) metadataMap.forEach(function (_, key) { keys.push(key); });
      return keys;
    };
    var toMetaKey = function (it) {
      return it === undefined || typeof it == 'symbol' ? it : String(it);
    };
    var exp$3 = function (O) {
      _export(_export.S, 'Reflect', O);
    };

    var _metadata = {
      store: store,
      map: getOrCreateMetadataMap,
      has: ordinaryHasOwnMetadata,
      get: ordinaryGetOwnMetadata,
      set: ordinaryDefineOwnMetadata,
      keys: ordinaryOwnMetadataKeys,
      key: toMetaKey,
      exp: exp$3
    };

    var toMetaKey$1 = _metadata.key;
    var ordinaryDefineOwnMetadata$1 = _metadata.set;

    _metadata.exp({ defineMetadata: function defineMetadata(metadataKey, metadataValue, target, targetKey) {
      ordinaryDefineOwnMetadata$1(metadataKey, metadataValue, _anObject(target), toMetaKey$1(targetKey));
    } });

    var toMetaKey$2 = _metadata.key;
    var getOrCreateMetadataMap$1 = _metadata.map;
    var store$1 = _metadata.store;

    _metadata.exp({ deleteMetadata: function deleteMetadata(metadataKey, target /* , targetKey */) {
      var targetKey = arguments.length < 3 ? undefined : toMetaKey$2(arguments[2]);
      var metadataMap = getOrCreateMetadataMap$1(_anObject(target), targetKey, false);
      if (metadataMap === undefined || !metadataMap['delete'](metadataKey)) return false;
      if (metadataMap.size) return true;
      var targetMetadata = store$1.get(target);
      targetMetadata['delete'](targetKey);
      return !!targetMetadata.size || store$1['delete'](target);
    } });

    var ordinaryHasOwnMetadata$1 = _metadata.has;
    var ordinaryGetOwnMetadata$1 = _metadata.get;
    var toMetaKey$3 = _metadata.key;

    var ordinaryGetMetadata = function (MetadataKey, O, P) {
      var hasOwn = ordinaryHasOwnMetadata$1(MetadataKey, O, P);
      if (hasOwn) return ordinaryGetOwnMetadata$1(MetadataKey, O, P);
      var parent = _objectGpo(O);
      return parent !== null ? ordinaryGetMetadata(MetadataKey, parent, P) : undefined;
    };

    _metadata.exp({ getMetadata: function getMetadata(metadataKey, target /* , targetKey */) {
      return ordinaryGetMetadata(metadataKey, _anObject(target), arguments.length < 3 ? undefined : toMetaKey$3(arguments[2]));
    } });

    var ordinaryOwnMetadataKeys$1 = _metadata.keys;
    var toMetaKey$4 = _metadata.key;

    var ordinaryMetadataKeys = function (O, P) {
      var oKeys = ordinaryOwnMetadataKeys$1(O, P);
      var parent = _objectGpo(O);
      if (parent === null) return oKeys;
      var pKeys = ordinaryMetadataKeys(parent, P);
      return pKeys.length ? oKeys.length ? _arrayFromIterable(new es6_set(oKeys.concat(pKeys))) : pKeys : oKeys;
    };

    _metadata.exp({ getMetadataKeys: function getMetadataKeys(target /* , targetKey */) {
      return ordinaryMetadataKeys(_anObject(target), arguments.length < 2 ? undefined : toMetaKey$4(arguments[1]));
    } });

    var ordinaryGetOwnMetadata$2 = _metadata.get;
    var toMetaKey$5 = _metadata.key;

    _metadata.exp({ getOwnMetadata: function getOwnMetadata(metadataKey, target /* , targetKey */) {
      return ordinaryGetOwnMetadata$2(metadataKey, _anObject(target)
        , arguments.length < 3 ? undefined : toMetaKey$5(arguments[2]));
    } });

    var ordinaryOwnMetadataKeys$2 = _metadata.keys;
    var toMetaKey$6 = _metadata.key;

    _metadata.exp({ getOwnMetadataKeys: function getOwnMetadataKeys(target /* , targetKey */) {
      return ordinaryOwnMetadataKeys$2(_anObject(target), arguments.length < 2 ? undefined : toMetaKey$6(arguments[1]));
    } });

    var ordinaryHasOwnMetadata$2 = _metadata.has;
    var toMetaKey$7 = _metadata.key;

    var ordinaryHasMetadata = function (MetadataKey, O, P) {
      var hasOwn = ordinaryHasOwnMetadata$2(MetadataKey, O, P);
      if (hasOwn) return true;
      var parent = _objectGpo(O);
      return parent !== null ? ordinaryHasMetadata(MetadataKey, parent, P) : false;
    };

    _metadata.exp({ hasMetadata: function hasMetadata(metadataKey, target /* , targetKey */) {
      return ordinaryHasMetadata(metadataKey, _anObject(target), arguments.length < 3 ? undefined : toMetaKey$7(arguments[2]));
    } });

    var ordinaryHasOwnMetadata$3 = _metadata.has;
    var toMetaKey$8 = _metadata.key;

    _metadata.exp({ hasOwnMetadata: function hasOwnMetadata(metadataKey, target /* , targetKey */) {
      return ordinaryHasOwnMetadata$3(metadataKey, _anObject(target)
        , arguments.length < 3 ? undefined : toMetaKey$8(arguments[2]));
    } });

    var toMetaKey$9 = _metadata.key;
    var ordinaryDefineOwnMetadata$2 = _metadata.set;

    _metadata.exp({ metadata: function metadata(metadataKey, metadataValue) {
      return function decorator(target, targetKey) {
        ordinaryDefineOwnMetadata$2(
          metadataKey, metadataValue,
          (targetKey !== undefined ? _anObject : _aFunction)(target),
          toMetaKey$9(targetKey)
        );
      };
    } });

    // https://github.com/rwaldron/tc39-notes/blob/master/es6/2014-09/sept-25.md#510-globalasap-for-enqueuing-a-microtask

    var microtask$1 = _microtask();
    var process$4 = _global.process;
    var isNode$2 = _cof(process$4) == 'process';

    _export(_export.G, {
      asap: function asap(fn) {
        var domain = isNode$2 && process$4.domain;
        microtask$1(domain ? domain.bind(fn) : fn);
      }
    });

    // https://github.com/zenparsing/es-observable



    var microtask$2 = _microtask();
    var OBSERVABLE = _wks('observable');






    var RETURN = _forOf.RETURN;

    var getMethod = function (fn) {
      return fn == null ? undefined : _aFunction(fn);
    };

    var cleanupSubscription = function (subscription) {
      var cleanup = subscription._c;
      if (cleanup) {
        subscription._c = undefined;
        cleanup();
      }
    };

    var subscriptionClosed = function (subscription) {
      return subscription._o === undefined;
    };

    var closeSubscription = function (subscription) {
      if (!subscriptionClosed(subscription)) {
        subscription._o = undefined;
        cleanupSubscription(subscription);
      }
    };

    var Subscription = function (observer, subscriber) {
      _anObject(observer);
      this._c = undefined;
      this._o = observer;
      observer = new SubscriptionObserver(this);
      try {
        var cleanup = subscriber(observer);
        var subscription = cleanup;
        if (cleanup != null) {
          if (typeof cleanup.unsubscribe === 'function') cleanup = function () { subscription.unsubscribe(); };
          else _aFunction(cleanup);
          this._c = cleanup;
        }
      } catch (e) {
        observer.error(e);
        return;
      } if (subscriptionClosed(this)) cleanupSubscription(this);
    };

    Subscription.prototype = _redefineAll({}, {
      unsubscribe: function unsubscribe() { closeSubscription(this); }
    });

    var SubscriptionObserver = function (subscription) {
      this._s = subscription;
    };

    SubscriptionObserver.prototype = _redefineAll({}, {
      next: function next(value) {
        var subscription = this._s;
        if (!subscriptionClosed(subscription)) {
          var observer = subscription._o;
          try {
            var m = getMethod(observer.next);
            if (m) return m.call(observer, value);
          } catch (e) {
            try {
              closeSubscription(subscription);
            } finally {
              throw e;
            }
          }
        }
      },
      error: function error(value) {
        var subscription = this._s;
        if (subscriptionClosed(subscription)) throw value;
        var observer = subscription._o;
        subscription._o = undefined;
        try {
          var m = getMethod(observer.error);
          if (!m) throw value;
          value = m.call(observer, value);
        } catch (e) {
          try {
            cleanupSubscription(subscription);
          } finally {
            throw e;
          }
        } cleanupSubscription(subscription);
        return value;
      },
      complete: function complete(value) {
        var subscription = this._s;
        if (!subscriptionClosed(subscription)) {
          var observer = subscription._o;
          subscription._o = undefined;
          try {
            var m = getMethod(observer.complete);
            value = m ? m.call(observer, value) : undefined;
          } catch (e) {
            try {
              cleanupSubscription(subscription);
            } finally {
              throw e;
            }
          } cleanupSubscription(subscription);
          return value;
        }
      }
    });

    var $Observable = function Observable(subscriber) {
      _anInstance(this, $Observable, 'Observable', '_f')._f = _aFunction(subscriber);
    };

    _redefineAll($Observable.prototype, {
      subscribe: function subscribe(observer) {
        return new Subscription(observer, this._f);
      },
      forEach: function forEach(fn) {
        var that = this;
        return new (_core.Promise || _global.Promise)(function (resolve, reject) {
          _aFunction(fn);
          var subscription = that.subscribe({
            next: function (value) {
              try {
                return fn(value);
              } catch (e) {
                reject(e);
                subscription.unsubscribe();
              }
            },
            error: reject,
            complete: resolve
          });
        });
      }
    });

    _redefineAll($Observable, {
      from: function from(x) {
        var C = typeof this === 'function' ? this : $Observable;
        var method = getMethod(_anObject(x)[OBSERVABLE]);
        if (method) {
          var observable = _anObject(method.call(x));
          return observable.constructor === C ? observable : new C(function (observer) {
            return observable.subscribe(observer);
          });
        }
        return new C(function (observer) {
          var done = false;
          microtask$2(function () {
            if (!done) {
              try {
                if (_forOf(x, false, function (it) {
                  observer.next(it);
                  if (done) return RETURN;
                }) === RETURN) return;
              } catch (e) {
                if (done) throw e;
                observer.error(e);
                return;
              } observer.complete();
            }
          });
          return function () { done = true; };
        });
      },
      of: function of() {
        for (var i = 0, l = arguments.length, items = new Array(l); i < l;) items[i] = arguments[i++];
        return new (typeof this === 'function' ? this : $Observable)(function (observer) {
          var done = false;
          microtask$2(function () {
            if (!done) {
              for (var j = 0; j < items.length; ++j) {
                observer.next(items[j]);
                if (done) return;
              } observer.complete();
            }
          });
          return function () { done = true; };
        });
      }
    });

    _hide($Observable.prototype, OBSERVABLE, function () { return this; });

    _export(_export.G, { Observable: $Observable });

    _setSpecies('Observable');

    // ie9- setTimeout & setInterval additional parameters fix



    var slice = [].slice;
    var MSIE = /MSIE .\./.test(_userAgent); // <- dirty ie9- check
    var wrap$1 = function (set) {
      return function (fn, time /* , ...args */) {
        var boundArgs = arguments.length > 2;
        var args = boundArgs ? slice.call(arguments, 2) : false;
        return set(boundArgs ? function () {
          // eslint-disable-next-line no-new-func
          (typeof fn == 'function' ? fn : Function(fn)).apply(this, args);
        } : fn, time);
      };
    };
    _export(_export.G + _export.B + _export.F * MSIE, {
      setTimeout: wrap$1(_global.setTimeout),
      setInterval: wrap$1(_global.setInterval)
    });

    _export(_export.G + _export.B, {
      setImmediate: _task.set,
      clearImmediate: _task.clear
    });

    var ITERATOR$4 = _wks('iterator');
    var TO_STRING_TAG = _wks('toStringTag');
    var ArrayValues = _iterators.Array;

    var DOMIterables = {
      CSSRuleList: true, // TODO: Not spec compliant, should be false.
      CSSStyleDeclaration: false,
      CSSValueList: false,
      ClientRectList: false,
      DOMRectList: false,
      DOMStringList: false,
      DOMTokenList: true,
      DataTransferItemList: false,
      FileList: false,
      HTMLAllCollection: false,
      HTMLCollection: false,
      HTMLFormElement: false,
      HTMLSelectElement: false,
      MediaList: true, // TODO: Not spec compliant, should be false.
      MimeTypeArray: false,
      NamedNodeMap: false,
      NodeList: true,
      PaintRequestList: false,
      Plugin: false,
      PluginArray: false,
      SVGLengthList: false,
      SVGNumberList: false,
      SVGPathSegList: false,
      SVGPointList: false,
      SVGStringList: false,
      SVGTransformList: false,
      SourceBufferList: false,
      StyleSheetList: true, // TODO: Not spec compliant, should be false.
      TextTrackCueList: false,
      TextTrackList: false,
      TouchList: false
    };

    for (var collections = _objectKeys(DOMIterables), i$2 = 0; i$2 < collections.length; i$2++) {
      var NAME$1 = collections[i$2];
      var explicit = DOMIterables[NAME$1];
      var Collection = _global[NAME$1];
      var proto$3 = Collection && Collection.prototype;
      var key$1;
      if (proto$3) {
        if (!proto$3[ITERATOR$4]) _hide(proto$3, ITERATOR$4, ArrayValues);
        if (!proto$3[TO_STRING_TAG]) _hide(proto$3, TO_STRING_TAG, NAME$1);
        _iterators[NAME$1] = ArrayValues;
        if (explicit) for (key$1 in es6_array_iterator) if (!proto$3[key$1]) _redefine(proto$3, key$1, es6_array_iterator[key$1], true);
      }
    }

    var runtime = createCommonjsModule(function (module) {
    /**
     * Copyright (c) 2014, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * https://raw.github.com/facebook/regenerator/master/LICENSE file. An
     * additional grant of patent rights can be found in the PATENTS file in
     * the same directory.
     */

    !(function(global) {

      var Op = Object.prototype;
      var hasOwn = Op.hasOwnProperty;
      var undefined; // More compressible than void 0.
      var $Symbol = typeof Symbol === "function" ? Symbol : {};
      var iteratorSymbol = $Symbol.iterator || "@@iterator";
      var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
      var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";
      var runtime = global.regeneratorRuntime;
      if (runtime) {
        {
          // If regeneratorRuntime is defined globally and we're in a module,
          // make the exports object identical to regeneratorRuntime.
          module.exports = runtime;
        }
        // Don't bother evaluating the rest of this file if the runtime was
        // already defined globally.
        return;
      }

      // Define the runtime globally (as expected by generated code) as either
      // module.exports (if we're in a module) or a new, empty object.
      runtime = global.regeneratorRuntime = module.exports;

      function wrap(innerFn, outerFn, self, tryLocsList) {
        // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
        var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
        var generator = Object.create(protoGenerator.prototype);
        var context = new Context(tryLocsList || []);

        // The ._invoke method unifies the implementations of the .next,
        // .throw, and .return methods.
        generator._invoke = makeInvokeMethod(innerFn, self, context);

        return generator;
      }
      runtime.wrap = wrap;

      // Try/catch helper to minimize deoptimizations. Returns a completion
      // record like context.tryEntries[i].completion. This interface could
      // have been (and was previously) designed to take a closure to be
      // invoked without arguments, but in all the cases we care about we
      // already have an existing method we want to call, so there's no need
      // to create a new function object. We can even get away with assuming
      // the method takes exactly one argument, since that happens to be true
      // in every case, so we don't have to touch the arguments object. The
      // only additional allocation required is the completion record, which
      // has a stable shape and so hopefully should be cheap to allocate.
      function tryCatch(fn, obj, arg) {
        try {
          return { type: "normal", arg: fn.call(obj, arg) };
        } catch (err) {
          return { type: "throw", arg: err };
        }
      }

      var GenStateSuspendedStart = "suspendedStart";
      var GenStateSuspendedYield = "suspendedYield";
      var GenStateExecuting = "executing";
      var GenStateCompleted = "completed";

      // Returning this object from the innerFn has the same effect as
      // breaking out of the dispatch switch statement.
      var ContinueSentinel = {};

      // Dummy constructor functions that we use as the .constructor and
      // .constructor.prototype properties for functions that return Generator
      // objects. For full spec compliance, you may wish to configure your
      // minifier not to mangle the names of these two functions.
      function Generator() {}
      function GeneratorFunction() {}
      function GeneratorFunctionPrototype() {}

      // This is a polyfill for %IteratorPrototype% for environments that
      // don't natively support it.
      var IteratorPrototype = {};
      IteratorPrototype[iteratorSymbol] = function () {
        return this;
      };

      var getProto = Object.getPrototypeOf;
      var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
      if (NativeIteratorPrototype &&
          NativeIteratorPrototype !== Op &&
          hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
        // This environment has a native %IteratorPrototype%; use it instead
        // of the polyfill.
        IteratorPrototype = NativeIteratorPrototype;
      }

      var Gp = GeneratorFunctionPrototype.prototype =
        Generator.prototype = Object.create(IteratorPrototype);
      GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
      GeneratorFunctionPrototype.constructor = GeneratorFunction;
      GeneratorFunctionPrototype[toStringTagSymbol] =
        GeneratorFunction.displayName = "GeneratorFunction";

      // Helper for defining the .next, .throw, and .return methods of the
      // Iterator interface in terms of a single ._invoke method.
      function defineIteratorMethods(prototype) {
        ["next", "throw", "return"].forEach(function(method) {
          prototype[method] = function(arg) {
            return this._invoke(method, arg);
          };
        });
      }

      runtime.isGeneratorFunction = function(genFun) {
        var ctor = typeof genFun === "function" && genFun.constructor;
        return ctor
          ? ctor === GeneratorFunction ||
            // For the native GeneratorFunction constructor, the best we can
            // do is to check its .name property.
            (ctor.displayName || ctor.name) === "GeneratorFunction"
          : false;
      };

      runtime.mark = function(genFun) {
        if (Object.setPrototypeOf) {
          Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
        } else {
          genFun.__proto__ = GeneratorFunctionPrototype;
          if (!(toStringTagSymbol in genFun)) {
            genFun[toStringTagSymbol] = "GeneratorFunction";
          }
        }
        genFun.prototype = Object.create(Gp);
        return genFun;
      };

      // Within the body of any async function, `await x` is transformed to
      // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
      // `hasOwn.call(value, "__await")` to determine if the yielded value is
      // meant to be awaited.
      runtime.awrap = function(arg) {
        return { __await: arg };
      };

      function AsyncIterator(generator) {
        function invoke(method, arg, resolve, reject) {
          var record = tryCatch(generator[method], generator, arg);
          if (record.type === "throw") {
            reject(record.arg);
          } else {
            var result = record.arg;
            var value = result.value;
            if (value &&
                typeof value === "object" &&
                hasOwn.call(value, "__await")) {
              return Promise.resolve(value.__await).then(function(value) {
                invoke("next", value, resolve, reject);
              }, function(err) {
                invoke("throw", err, resolve, reject);
              });
            }

            return Promise.resolve(value).then(function(unwrapped) {
              // When a yielded Promise is resolved, its final value becomes
              // the .value of the Promise<{value,done}> result for the
              // current iteration. If the Promise is rejected, however, the
              // result for this iteration will be rejected with the same
              // reason. Note that rejections of yielded Promises are not
              // thrown back into the generator function, as is the case
              // when an awaited Promise is rejected. This difference in
              // behavior between yield and await is important, because it
              // allows the consumer to decide what to do with the yielded
              // rejection (swallow it and continue, manually .throw it back
              // into the generator, abandon iteration, whatever). With
              // await, by contrast, there is no opportunity to examine the
              // rejection reason outside the generator function, so the
              // only option is to throw it from the await expression, and
              // let the generator function handle the exception.
              result.value = unwrapped;
              resolve(result);
            }, reject);
          }
        }

        if (typeof global.process === "object" && global.process.domain) {
          invoke = global.process.domain.bind(invoke);
        }

        var previousPromise;

        function enqueue(method, arg) {
          function callInvokeWithMethodAndArg() {
            return new Promise(function(resolve, reject) {
              invoke(method, arg, resolve, reject);
            });
          }

          return previousPromise =
            // If enqueue has been called before, then we want to wait until
            // all previous Promises have been resolved before calling invoke,
            // so that results are always delivered in the correct order. If
            // enqueue has not been called before, then it is important to
            // call invoke immediately, without waiting on a callback to fire,
            // so that the async generator function has the opportunity to do
            // any necessary setup in a predictable way. This predictability
            // is why the Promise constructor synchronously invokes its
            // executor callback, and why async functions synchronously
            // execute code before the first await. Since we implement simple
            // async functions in terms of async generators, it is especially
            // important to get this right, even though it requires care.
            previousPromise ? previousPromise.then(
              callInvokeWithMethodAndArg,
              // Avoid propagating failures to Promises returned by later
              // invocations of the iterator.
              callInvokeWithMethodAndArg
            ) : callInvokeWithMethodAndArg();
        }

        // Define the unified helper method that is used to implement .next,
        // .throw, and .return (see defineIteratorMethods).
        this._invoke = enqueue;
      }

      defineIteratorMethods(AsyncIterator.prototype);
      AsyncIterator.prototype[asyncIteratorSymbol] = function () {
        return this;
      };
      runtime.AsyncIterator = AsyncIterator;

      // Note that simple async functions are implemented on top of
      // AsyncIterator objects; they just return a Promise for the value of
      // the final result produced by the iterator.
      runtime.async = function(innerFn, outerFn, self, tryLocsList) {
        var iter = new AsyncIterator(
          wrap(innerFn, outerFn, self, tryLocsList)
        );

        return runtime.isGeneratorFunction(outerFn)
          ? iter // If outerFn is a generator, return the full iterator.
          : iter.next().then(function(result) {
              return result.done ? result.value : iter.next();
            });
      };

      function makeInvokeMethod(innerFn, self, context) {
        var state = GenStateSuspendedStart;

        return function invoke(method, arg) {
          if (state === GenStateExecuting) {
            throw new Error("Generator is already running");
          }

          if (state === GenStateCompleted) {
            if (method === "throw") {
              throw arg;
            }

            // Be forgiving, per 25.3.3.3.3 of the spec:
            // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
            return doneResult();
          }

          context.method = method;
          context.arg = arg;

          while (true) {
            var delegate = context.delegate;
            if (delegate) {
              var delegateResult = maybeInvokeDelegate(delegate, context);
              if (delegateResult) {
                if (delegateResult === ContinueSentinel) continue;
                return delegateResult;
              }
            }

            if (context.method === "next") {
              // Setting context._sent for legacy support of Babel's
              // function.sent implementation.
              context.sent = context._sent = context.arg;

            } else if (context.method === "throw") {
              if (state === GenStateSuspendedStart) {
                state = GenStateCompleted;
                throw context.arg;
              }

              context.dispatchException(context.arg);

            } else if (context.method === "return") {
              context.abrupt("return", context.arg);
            }

            state = GenStateExecuting;

            var record = tryCatch(innerFn, self, context);
            if (record.type === "normal") {
              // If an exception is thrown from innerFn, we leave state ===
              // GenStateExecuting and loop back for another invocation.
              state = context.done
                ? GenStateCompleted
                : GenStateSuspendedYield;

              if (record.arg === ContinueSentinel) {
                continue;
              }

              return {
                value: record.arg,
                done: context.done
              };

            } else if (record.type === "throw") {
              state = GenStateCompleted;
              // Dispatch the exception by looping back around to the
              // context.dispatchException(context.arg) call above.
              context.method = "throw";
              context.arg = record.arg;
            }
          }
        };
      }

      // Call delegate.iterator[context.method](context.arg) and handle the
      // result, either by returning a { value, done } result from the
      // delegate iterator, or by modifying context.method and context.arg,
      // setting context.delegate to null, and returning the ContinueSentinel.
      function maybeInvokeDelegate(delegate, context) {
        var method = delegate.iterator[context.method];
        if (method === undefined) {
          // A .throw or .return when the delegate iterator has no .throw
          // method always terminates the yield* loop.
          context.delegate = null;

          if (context.method === "throw") {
            if (delegate.iterator.return) {
              // If the delegate iterator has a return method, give it a
              // chance to clean up.
              context.method = "return";
              context.arg = undefined;
              maybeInvokeDelegate(delegate, context);

              if (context.method === "throw") {
                // If maybeInvokeDelegate(context) changed context.method from
                // "return" to "throw", let that override the TypeError below.
                return ContinueSentinel;
              }
            }

            context.method = "throw";
            context.arg = new TypeError(
              "The iterator does not provide a 'throw' method");
          }

          return ContinueSentinel;
        }

        var record = tryCatch(method, delegate.iterator, context.arg);

        if (record.type === "throw") {
          context.method = "throw";
          context.arg = record.arg;
          context.delegate = null;
          return ContinueSentinel;
        }

        var info = record.arg;

        if (! info) {
          context.method = "throw";
          context.arg = new TypeError("iterator result is not an object");
          context.delegate = null;
          return ContinueSentinel;
        }

        if (info.done) {
          // Assign the result of the finished delegate to the temporary
          // variable specified by delegate.resultName (see delegateYield).
          context[delegate.resultName] = info.value;

          // Resume execution at the desired location (see delegateYield).
          context.next = delegate.nextLoc;

          // If context.method was "throw" but the delegate handled the
          // exception, let the outer generator proceed normally. If
          // context.method was "next", forget context.arg since it has been
          // "consumed" by the delegate iterator. If context.method was
          // "return", allow the original .return call to continue in the
          // outer generator.
          if (context.method !== "return") {
            context.method = "next";
            context.arg = undefined;
          }

        } else {
          // Re-yield the result returned by the delegate method.
          return info;
        }

        // The delegate iterator is finished, so forget it and continue with
        // the outer generator.
        context.delegate = null;
        return ContinueSentinel;
      }

      // Define Generator.prototype.{next,throw,return} in terms of the
      // unified ._invoke helper method.
      defineIteratorMethods(Gp);

      Gp[toStringTagSymbol] = "Generator";

      // A Generator should always return itself as the iterator object when the
      // @@iterator function is called on it. Some browsers' implementations of the
      // iterator prototype chain incorrectly implement this, causing the Generator
      // object to not be returned from this call. This ensures that doesn't happen.
      // See https://github.com/facebook/regenerator/issues/274 for more details.
      Gp[iteratorSymbol] = function() {
        return this;
      };

      Gp.toString = function() {
        return "[object Generator]";
      };

      function pushTryEntry(locs) {
        var entry = { tryLoc: locs[0] };

        if (1 in locs) {
          entry.catchLoc = locs[1];
        }

        if (2 in locs) {
          entry.finallyLoc = locs[2];
          entry.afterLoc = locs[3];
        }

        this.tryEntries.push(entry);
      }

      function resetTryEntry(entry) {
        var record = entry.completion || {};
        record.type = "normal";
        delete record.arg;
        entry.completion = record;
      }

      function Context(tryLocsList) {
        // The root entry object (effectively a try statement without a catch
        // or a finally block) gives us a place to store values thrown from
        // locations where there is no enclosing try statement.
        this.tryEntries = [{ tryLoc: "root" }];
        tryLocsList.forEach(pushTryEntry, this);
        this.reset(true);
      }

      runtime.keys = function(object) {
        var keys = [];
        for (var key in object) {
          keys.push(key);
        }
        keys.reverse();

        // Rather than returning an object with a next method, we keep
        // things simple and return the next function itself.
        return function next() {
          while (keys.length) {
            var key = keys.pop();
            if (key in object) {
              next.value = key;
              next.done = false;
              return next;
            }
          }

          // To avoid creating an additional object, we just hang the .value
          // and .done properties off the next function object itself. This
          // also ensures that the minifier will not anonymize the function.
          next.done = true;
          return next;
        };
      };

      function values(iterable) {
        if (iterable) {
          var iteratorMethod = iterable[iteratorSymbol];
          if (iteratorMethod) {
            return iteratorMethod.call(iterable);
          }

          if (typeof iterable.next === "function") {
            return iterable;
          }

          if (!isNaN(iterable.length)) {
            var i = -1, next = function next() {
              while (++i < iterable.length) {
                if (hasOwn.call(iterable, i)) {
                  next.value = iterable[i];
                  next.done = false;
                  return next;
                }
              }

              next.value = undefined;
              next.done = true;

              return next;
            };

            return next.next = next;
          }
        }

        // Return an iterator with no values.
        return { next: doneResult };
      }
      runtime.values = values;

      function doneResult() {
        return { value: undefined, done: true };
      }

      Context.prototype = {
        constructor: Context,

        reset: function(skipTempReset) {
          this.prev = 0;
          this.next = 0;
          // Resetting context._sent for legacy support of Babel's
          // function.sent implementation.
          this.sent = this._sent = undefined;
          this.done = false;
          this.delegate = null;

          this.method = "next";
          this.arg = undefined;

          this.tryEntries.forEach(resetTryEntry);

          if (!skipTempReset) {
            for (var name in this) {
              // Not sure about the optimal order of these conditions:
              if (name.charAt(0) === "t" &&
                  hasOwn.call(this, name) &&
                  !isNaN(+name.slice(1))) {
                this[name] = undefined;
              }
            }
          }
        },

        stop: function() {
          this.done = true;

          var rootEntry = this.tryEntries[0];
          var rootRecord = rootEntry.completion;
          if (rootRecord.type === "throw") {
            throw rootRecord.arg;
          }

          return this.rval;
        },

        dispatchException: function(exception) {
          if (this.done) {
            throw exception;
          }

          var context = this;
          function handle(loc, caught) {
            record.type = "throw";
            record.arg = exception;
            context.next = loc;

            if (caught) {
              // If the dispatched exception was caught by a catch block,
              // then let that catch block handle the exception normally.
              context.method = "next";
              context.arg = undefined;
            }

            return !! caught;
          }

          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            var record = entry.completion;

            if (entry.tryLoc === "root") {
              // Exception thrown outside of any try block that could handle
              // it, so set the completion value of the entire function to
              // throw the exception.
              return handle("end");
            }

            if (entry.tryLoc <= this.prev) {
              var hasCatch = hasOwn.call(entry, "catchLoc");
              var hasFinally = hasOwn.call(entry, "finallyLoc");

              if (hasCatch && hasFinally) {
                if (this.prev < entry.catchLoc) {
                  return handle(entry.catchLoc, true);
                } else if (this.prev < entry.finallyLoc) {
                  return handle(entry.finallyLoc);
                }

              } else if (hasCatch) {
                if (this.prev < entry.catchLoc) {
                  return handle(entry.catchLoc, true);
                }

              } else if (hasFinally) {
                if (this.prev < entry.finallyLoc) {
                  return handle(entry.finallyLoc);
                }

              } else {
                throw new Error("try statement without catch or finally");
              }
            }
          }
        },

        abrupt: function(type, arg) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            if (entry.tryLoc <= this.prev &&
                hasOwn.call(entry, "finallyLoc") &&
                this.prev < entry.finallyLoc) {
              var finallyEntry = entry;
              break;
            }
          }

          if (finallyEntry &&
              (type === "break" ||
               type === "continue") &&
              finallyEntry.tryLoc <= arg &&
              arg <= finallyEntry.finallyLoc) {
            // Ignore the finally entry if control is not jumping to a
            // location outside the try/catch block.
            finallyEntry = null;
          }

          var record = finallyEntry ? finallyEntry.completion : {};
          record.type = type;
          record.arg = arg;

          if (finallyEntry) {
            this.method = "next";
            this.next = finallyEntry.finallyLoc;
            return ContinueSentinel;
          }

          return this.complete(record);
        },

        complete: function(record, afterLoc) {
          if (record.type === "throw") {
            throw record.arg;
          }

          if (record.type === "break" ||
              record.type === "continue") {
            this.next = record.arg;
          } else if (record.type === "return") {
            this.rval = this.arg = record.arg;
            this.method = "return";
            this.next = "end";
          } else if (record.type === "normal" && afterLoc) {
            this.next = afterLoc;
          }

          return ContinueSentinel;
        },

        finish: function(finallyLoc) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            if (entry.finallyLoc === finallyLoc) {
              this.complete(entry.completion, entry.afterLoc);
              resetTryEntry(entry);
              return ContinueSentinel;
            }
          }
        },

        "catch": function(tryLoc) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            if (entry.tryLoc === tryLoc) {
              var record = entry.completion;
              if (record.type === "throw") {
                var thrown = record.arg;
                resetTryEntry(entry);
              }
              return thrown;
            }
          }

          // The context.catch method must only be called with a location
          // argument that corresponds to a known catch block.
          throw new Error("illegal catch attempt");
        },

        delegateYield: function(iterable, resultName, nextLoc) {
          this.delegate = {
            iterator: values(iterable),
            resultName: resultName,
            nextLoc: nextLoc
          };

          if (this.method === "next") {
            // Deliberately forget the last sent value so that we don't
            // accidentally pass it on to the delegate.
            this.arg = undefined;
          }

          return ContinueSentinel;
        }
      };
    })(
      // Among the various tricks for obtaining a reference to the global
      // object, this seems to be the most reliable technique that does not
      // use indirect eval (which violates Content Security Policy).
      typeof commonjsGlobal === "object" ? commonjsGlobal :
      typeof window === "object" ? window :
      typeof self === "object" ? self : commonjsGlobal
    );
    });

    var _replacer = function (regExp, replace) {
      var replacer = replace === Object(replace) ? function (part) {
        return replace[part];
      } : replace;
      return function (it) {
        return String(it).replace(regExp, replacer);
      };
    };

    // https://github.com/benjamingr/RexExp.escape

    var $re = _replacer(/[\\^$*+?.()|[\]{}]/g, '\\$&');

    _export(_export.S, 'RegExp', { escape: function escape(it) { return $re(it); } });

    var _escape = _core.RegExp.escape;

    if (commonjsGlobal._babelPolyfill) {
      throw new Error("only one instance of babel-polyfill is allowed");
    }
    commonjsGlobal._babelPolyfill = true;

    var DEFINE_PROPERTY = "defineProperty";
    function define$1(O, key, value) {
      O[key] || Object[DEFINE_PROPERTY](O, key, {
        writable: true,
        configurable: true,
        value: value
      });
    }

    define$1(String.prototype, "padLeft", "".padStart);
    define$1(String.prototype, "padRight", "".padEnd);

    "pop,reverse,shift,keys,values,entries,indexOf,every,some,forEach,map,filter,find,findIndex,includes,join,slice,concat,push,splice,unshift,sort,lastIndexOf,reduce,reduceRight,copyWithin,fill".split(",").forEach(function (key) {
      [][key] && define$1(Array, key, Function.call.bind([][key]));
    });

    var Path = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var PATH = exports.PATH = {
        VECTOR: 0,
        BEZIER_CURVE: 1,
        CIRCLE: 2
    };
    });

    unwrapExports(Path);
    var Path_1 = Path.PATH;

    var Color_1 = createCommonjsModule(function (module, exports) {

    // http://dev.w3.org/csswg/css-color/

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var HEX3 = /^#([a-f0-9]{3})$/i;
    var hex3 = function hex3(value) {
        var match = value.match(HEX3);
        if (match) {
            return [parseInt(match[1][0] + match[1][0], 16), parseInt(match[1][1] + match[1][1], 16), parseInt(match[1][2] + match[1][2], 16), null];
        }
        return false;
    };

    var HEX6 = /^#([a-f0-9]{6})$/i;
    var hex6 = function hex6(value) {
        var match = value.match(HEX6);
        if (match) {
            return [parseInt(match[1].substring(0, 2), 16), parseInt(match[1].substring(2, 4), 16), parseInt(match[1].substring(4, 6), 16), null];
        }
        return false;
    };

    var RGB = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
    var rgb = function rgb(value) {
        var match = value.match(RGB);
        if (match) {
            return [Number(match[1]), Number(match[2]), Number(match[3]), null];
        }
        return false;
    };

    var RGBA = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d?\.?\d+)\s*\)$/;
    var rgba = function rgba(value) {
        var match = value.match(RGBA);
        if (match && match.length > 4) {
            return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
        }
        return false;
    };

    var fromArray = function fromArray(array) {
        return [Math.min(array[0], 255), Math.min(array[1], 255), Math.min(array[2], 255), array.length > 3 ? array[3] : null];
    };

    var namedColor = function namedColor(name) {
        var color = NAMED_COLORS[name.toLowerCase()];
        return color ? color : false;
    };

    var Color = function () {
        function Color(value) {
            _classCallCheck(this, Color);

            var _ref = Array.isArray(value) ? fromArray(value) : hex3(value) || rgb(value) || rgba(value) || namedColor(value) || hex6(value) || [0, 0, 0, null],
                _ref2 = _slicedToArray(_ref, 4),
                r = _ref2[0],
                g = _ref2[1],
                b = _ref2[2],
                a = _ref2[3];

            this.r = r;
            this.g = g;
            this.b = b;
            this.a = a;
        }

        _createClass(Color, [{
            key: 'isTransparent',
            value: function isTransparent() {
                return this.a === 0;
            }
        }, {
            key: 'toString',
            value: function toString() {
                return this.a !== null && this.a !== 1 ? 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + this.a + ')' : 'rgb(' + this.r + ',' + this.g + ',' + this.b + ')';
            }
        }]);

        return Color;
    }();

    exports.default = Color;


    var NAMED_COLORS = {
        transparent: [0, 0, 0, 0],
        aliceblue: [240, 248, 255, null],
        antiquewhite: [250, 235, 215, null],
        aqua: [0, 255, 255, null],
        aquamarine: [127, 255, 212, null],
        azure: [240, 255, 255, null],
        beige: [245, 245, 220, null],
        bisque: [255, 228, 196, null],
        black: [0, 0, 0, null],
        blanchedalmond: [255, 235, 205, null],
        blue: [0, 0, 255, null],
        blueviolet: [138, 43, 226, null],
        brown: [165, 42, 42, null],
        burlywood: [222, 184, 135, null],
        cadetblue: [95, 158, 160, null],
        chartreuse: [127, 255, 0, null],
        chocolate: [210, 105, 30, null],
        coral: [255, 127, 80, null],
        cornflowerblue: [100, 149, 237, null],
        cornsilk: [255, 248, 220, null],
        crimson: [220, 20, 60, null],
        cyan: [0, 255, 255, null],
        darkblue: [0, 0, 139, null],
        darkcyan: [0, 139, 139, null],
        darkgoldenrod: [184, 134, 11, null],
        darkgray: [169, 169, 169, null],
        darkgreen: [0, 100, 0, null],
        darkgrey: [169, 169, 169, null],
        darkkhaki: [189, 183, 107, null],
        darkmagenta: [139, 0, 139, null],
        darkolivegreen: [85, 107, 47, null],
        darkorange: [255, 140, 0, null],
        darkorchid: [153, 50, 204, null],
        darkred: [139, 0, 0, null],
        darksalmon: [233, 150, 122, null],
        darkseagreen: [143, 188, 143, null],
        darkslateblue: [72, 61, 139, null],
        darkslategray: [47, 79, 79, null],
        darkslategrey: [47, 79, 79, null],
        darkturquoise: [0, 206, 209, null],
        darkviolet: [148, 0, 211, null],
        deeppink: [255, 20, 147, null],
        deepskyblue: [0, 191, 255, null],
        dimgray: [105, 105, 105, null],
        dimgrey: [105, 105, 105, null],
        dodgerblue: [30, 144, 255, null],
        firebrick: [178, 34, 34, null],
        floralwhite: [255, 250, 240, null],
        forestgreen: [34, 139, 34, null],
        fuchsia: [255, 0, 255, null],
        gainsboro: [220, 220, 220, null],
        ghostwhite: [248, 248, 255, null],
        gold: [255, 215, 0, null],
        goldenrod: [218, 165, 32, null],
        gray: [128, 128, 128, null],
        green: [0, 128, 0, null],
        greenyellow: [173, 255, 47, null],
        grey: [128, 128, 128, null],
        honeydew: [240, 255, 240, null],
        hotpink: [255, 105, 180, null],
        indianred: [205, 92, 92, null],
        indigo: [75, 0, 130, null],
        ivory: [255, 255, 240, null],
        khaki: [240, 230, 140, null],
        lavender: [230, 230, 250, null],
        lavenderblush: [255, 240, 245, null],
        lawngreen: [124, 252, 0, null],
        lemonchiffon: [255, 250, 205, null],
        lightblue: [173, 216, 230, null],
        lightcoral: [240, 128, 128, null],
        lightcyan: [224, 255, 255, null],
        lightgoldenrodyellow: [250, 250, 210, null],
        lightgray: [211, 211, 211, null],
        lightgreen: [144, 238, 144, null],
        lightgrey: [211, 211, 211, null],
        lightpink: [255, 182, 193, null],
        lightsalmon: [255, 160, 122, null],
        lightseagreen: [32, 178, 170, null],
        lightskyblue: [135, 206, 250, null],
        lightslategray: [119, 136, 153, null],
        lightslategrey: [119, 136, 153, null],
        lightsteelblue: [176, 196, 222, null],
        lightyellow: [255, 255, 224, null],
        lime: [0, 255, 0, null],
        limegreen: [50, 205, 50, null],
        linen: [250, 240, 230, null],
        magenta: [255, 0, 255, null],
        maroon: [128, 0, 0, null],
        mediumaquamarine: [102, 205, 170, null],
        mediumblue: [0, 0, 205, null],
        mediumorchid: [186, 85, 211, null],
        mediumpurple: [147, 112, 219, null],
        mediumseagreen: [60, 179, 113, null],
        mediumslateblue: [123, 104, 238, null],
        mediumspringgreen: [0, 250, 154, null],
        mediumturquoise: [72, 209, 204, null],
        mediumvioletred: [199, 21, 133, null],
        midnightblue: [25, 25, 112, null],
        mintcream: [245, 255, 250, null],
        mistyrose: [255, 228, 225, null],
        moccasin: [255, 228, 181, null],
        navajowhite: [255, 222, 173, null],
        navy: [0, 0, 128, null],
        oldlace: [253, 245, 230, null],
        olive: [128, 128, 0, null],
        olivedrab: [107, 142, 35, null],
        orange: [255, 165, 0, null],
        orangered: [255, 69, 0, null],
        orchid: [218, 112, 214, null],
        palegoldenrod: [238, 232, 170, null],
        palegreen: [152, 251, 152, null],
        paleturquoise: [175, 238, 238, null],
        palevioletred: [219, 112, 147, null],
        papayawhip: [255, 239, 213, null],
        peachpuff: [255, 218, 185, null],
        peru: [205, 133, 63, null],
        pink: [255, 192, 203, null],
        plum: [221, 160, 221, null],
        powderblue: [176, 224, 230, null],
        purple: [128, 0, 128, null],
        rebeccapurple: [102, 51, 153, null],
        red: [255, 0, 0, null],
        rosybrown: [188, 143, 143, null],
        royalblue: [65, 105, 225, null],
        saddlebrown: [139, 69, 19, null],
        salmon: [250, 128, 114, null],
        sandybrown: [244, 164, 96, null],
        seagreen: [46, 139, 87, null],
        seashell: [255, 245, 238, null],
        sienna: [160, 82, 45, null],
        silver: [192, 192, 192, null],
        skyblue: [135, 206, 235, null],
        slateblue: [106, 90, 205, null],
        slategray: [112, 128, 144, null],
        slategrey: [112, 128, 144, null],
        snow: [255, 250, 250, null],
        springgreen: [0, 255, 127, null],
        steelblue: [70, 130, 180, null],
        tan: [210, 180, 140, null],
        teal: [0, 128, 128, null],
        thistle: [216, 191, 216, null],
        tomato: [255, 99, 71, null],
        turquoise: [64, 224, 208, null],
        violet: [238, 130, 238, null],
        wheat: [245, 222, 179, null],
        white: [255, 255, 255, null],
        whitesmoke: [245, 245, 245, null],
        yellow: [255, 255, 0, null],
        yellowgreen: [154, 205, 50, null]
    };

    var TRANSPARENT = exports.TRANSPARENT = new Color([0, 0, 0, 0]);
    });

    unwrapExports(Color_1);
    var Color_2 = Color_1.TRANSPARENT;

    var textDecoration = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parseTextDecoration = exports.TEXT_DECORATION_LINE = exports.TEXT_DECORATION = exports.TEXT_DECORATION_STYLE = undefined;



    var _Color2 = _interopRequireDefault(Color_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var TEXT_DECORATION_STYLE = exports.TEXT_DECORATION_STYLE = {
        SOLID: 0,
        DOUBLE: 1,
        DOTTED: 2,
        DASHED: 3,
        WAVY: 4
    };

    var TEXT_DECORATION = exports.TEXT_DECORATION = {
        NONE: null
    };

    var TEXT_DECORATION_LINE = exports.TEXT_DECORATION_LINE = {
        UNDERLINE: 1,
        OVERLINE: 2,
        LINE_THROUGH: 3,
        BLINK: 4
    };

    var parseLine = function parseLine(line) {
        switch (line) {
            case 'underline':
                return TEXT_DECORATION_LINE.UNDERLINE;
            case 'overline':
                return TEXT_DECORATION_LINE.OVERLINE;
            case 'line-through':
                return TEXT_DECORATION_LINE.LINE_THROUGH;
        }
        return TEXT_DECORATION_LINE.BLINK;
    };

    var parseTextDecorationLine = function parseTextDecorationLine(line) {
        if (line === 'none') {
            return null;
        }

        return line.split(' ').map(parseLine);
    };

    var parseTextDecorationStyle = function parseTextDecorationStyle(style) {
        switch (style) {
            case 'double':
                return TEXT_DECORATION_STYLE.DOUBLE;
            case 'dotted':
                return TEXT_DECORATION_STYLE.DOTTED;
            case 'dashed':
                return TEXT_DECORATION_STYLE.DASHED;
            case 'wavy':
                return TEXT_DECORATION_STYLE.WAVY;
        }
        return TEXT_DECORATION_STYLE.SOLID;
    };

    var parseTextDecoration = exports.parseTextDecoration = function parseTextDecoration(style) {
        var textDecorationLine = parseTextDecorationLine(style.textDecorationLine ? style.textDecorationLine : style.textDecoration);
        if (textDecorationLine === null) {
            return TEXT_DECORATION.NONE;
        }

        var textDecorationColor = style.textDecorationColor ? new _Color2.default(style.textDecorationColor) : null;
        var textDecorationStyle = parseTextDecorationStyle(style.textDecorationStyle);

        return {
            textDecorationLine: textDecorationLine,
            textDecorationColor: textDecorationColor,
            textDecorationStyle: textDecorationStyle
        };
    };
    });

    unwrapExports(textDecoration);
    var textDecoration_1 = textDecoration.parseTextDecoration;
    var textDecoration_2 = textDecoration.TEXT_DECORATION_LINE;
    var textDecoration_3 = textDecoration.TEXT_DECORATION;
    var textDecoration_4 = textDecoration.TEXT_DECORATION_STYLE;

    var CanvasRenderer_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();





    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var addColorStops = function addColorStops(gradient, canvasGradient) {
        var maxStop = Math.max.apply(null, gradient.colorStops.map(function (colorStop) {
            return colorStop.stop;
        }));
        var f = 1 / Math.max(1, maxStop);
        gradient.colorStops.forEach(function (colorStop) {
            canvasGradient.addColorStop(f * colorStop.stop, colorStop.color.toString());
        });
    };

    var CanvasRenderer = function () {
        function CanvasRenderer(canvas) {
            _classCallCheck(this, CanvasRenderer);

            this.canvas = canvas ? canvas : document.createElement('canvas');
        }

        _createClass(CanvasRenderer, [{
            key: 'render',
            value: function render(options) {
                this.ctx = this.canvas.getContext('2d');
                this.options = options;
                this.canvas.width = Math.floor(options.width * options.scale);
                this.canvas.height = Math.floor(options.height * options.scale);
                this.canvas.style.width = options.width + 'px';
                this.canvas.style.height = options.height + 'px';

                this.ctx.scale(this.options.scale, this.options.scale);
                this.ctx.translate(-options.x, -options.y);
                this.ctx.textBaseline = 'bottom';
                options.logger.log('Canvas renderer initialized (' + options.width + 'x' + options.height + ' at ' + options.x + ',' + options.y + ') with scale ' + this.options.scale);
            }
        }, {
            key: 'clip',
            value: function clip(clipPaths, callback) {
                var _this = this;

                if (clipPaths.length) {
                    this.ctx.save();
                    clipPaths.forEach(function (path) {
                        _this.path(path);
                        _this.ctx.clip();
                    });
                }

                callback();

                if (clipPaths.length) {
                    this.ctx.restore();
                }
            }
        }, {
            key: 'drawImage',
            value: function drawImage(image, source, destination) {
                this.ctx.drawImage(image, source.left, source.top, source.width, source.height, destination.left, destination.top, destination.width, destination.height);
            }
        }, {
            key: 'drawShape',
            value: function drawShape(path, color) {
                this.path(path);
                this.ctx.fillStyle = color.toString();
                this.ctx.fill();
            }
        }, {
            key: 'fill',
            value: function fill(color) {
                this.ctx.fillStyle = color.toString();
                this.ctx.fill();
            }
        }, {
            key: 'getTarget',
            value: function getTarget() {
                this.canvas.getContext('2d').setTransform(1, 0, 0, 1, 0, 0);
                return Promise.resolve(this.canvas);
            }
        }, {
            key: 'path',
            value: function path(_path) {
                var _this2 = this;

                this.ctx.beginPath();
                if (Array.isArray(_path)) {
                    _path.forEach(function (point, index) {
                        var start = point.type === Path.PATH.VECTOR ? point : point.start;
                        if (index === 0) {
                            _this2.ctx.moveTo(start.x, start.y);
                        } else {
                            _this2.ctx.lineTo(start.x, start.y);
                        }

                        if (point.type === Path.PATH.BEZIER_CURVE) {
                            _this2.ctx.bezierCurveTo(point.startControl.x, point.startControl.y, point.endControl.x, point.endControl.y, point.end.x, point.end.y);
                        }
                    });
                } else {
                    this.ctx.arc(_path.x + _path.radius, _path.y + _path.radius, _path.radius, 0, Math.PI * 2, true);
                }

                this.ctx.closePath();
            }
        }, {
            key: 'rectangle',
            value: function rectangle(x, y, width, height, color) {
                this.ctx.fillStyle = color.toString();
                this.ctx.fillRect(x, y, width, height);
            }
        }, {
            key: 'renderLinearGradient',
            value: function renderLinearGradient(bounds, gradient) {
                var linearGradient = this.ctx.createLinearGradient(bounds.left + gradient.direction.x1, bounds.top + gradient.direction.y1, bounds.left + gradient.direction.x0, bounds.top + gradient.direction.y0);

                addColorStops(gradient, linearGradient);
                this.ctx.fillStyle = linearGradient;
                this.ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
            }
        }, {
            key: 'renderRadialGradient',
            value: function renderRadialGradient(bounds, gradient) {
                var _this3 = this;

                var x = bounds.left + gradient.center.x;
                var y = bounds.top + gradient.center.y;

                var radialGradient = this.ctx.createRadialGradient(x, y, 0, x, y, gradient.radius.x);
                if (!radialGradient) {
                    return;
                }

                addColorStops(gradient, radialGradient);
                this.ctx.fillStyle = radialGradient;

                if (gradient.radius.x !== gradient.radius.y) {
                    // transforms for elliptical radial gradient
                    var midX = bounds.left + 0.5 * bounds.width;
                    var midY = bounds.top + 0.5 * bounds.height;
                    var f = gradient.radius.y / gradient.radius.x;
                    var invF = 1 / f;

                    this.transform(midX, midY, [1, 0, 0, f, 0, 0], function () {
                        return _this3.ctx.fillRect(bounds.left, invF * (bounds.top - midY) + midY, bounds.width, bounds.height * invF);
                    });
                } else {
                    this.ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
                }
            }
        }, {
            key: 'renderRepeat',
            value: function renderRepeat(path, image, imageSize, offsetX, offsetY) {
                this.path(path);
                this.ctx.fillStyle = this.ctx.createPattern(this.resizeImage(image, imageSize), 'repeat');
                this.ctx.translate(offsetX, offsetY);
                this.ctx.fill();
                this.ctx.translate(-offsetX, -offsetY);
            }
        }, {
            key: 'renderTextNode',
            value: function renderTextNode(textBounds, color, font, textDecoration$$1, textShadows) {
                var _this4 = this;

                this.ctx.font = [font.fontStyle, font.fontVariant, font.fontWeight, font.fontSize, font.fontFamily].join(' ');

                textBounds.forEach(function (text) {
                    _this4.ctx.fillStyle = color.toString();
                    if (textShadows && text.text.trim().length) {
                        textShadows.slice(0).reverse().forEach(function (textShadow) {
                            _this4.ctx.shadowColor = textShadow.color.toString();
                            _this4.ctx.shadowOffsetX = textShadow.offsetX * _this4.options.scale;
                            _this4.ctx.shadowOffsetY = textShadow.offsetY * _this4.options.scale;
                            _this4.ctx.shadowBlur = textShadow.blur;

                            _this4.ctx.fillText(text.text, text.bounds.left, text.bounds.top + text.bounds.height);
                        });
                    } else {
                        _this4.ctx.fillText(text.text, text.bounds.left, text.bounds.top + text.bounds.height);
                    }

                    if (textDecoration$$1 !== null) {
                        var textDecorationColor = textDecoration$$1.textDecorationColor || color;
                        textDecoration$$1.textDecorationLine.forEach(function (textDecorationLine) {
                            switch (textDecorationLine) {
                                case textDecoration.TEXT_DECORATION_LINE.UNDERLINE:
                                    // Draws a line at the baseline of the font
                                    // TODO As some browsers display the line as more than 1px if the font-size is big,
                                    // need to take that into account both in position and size
                                    var _options$fontMetrics$ = _this4.options.fontMetrics.getMetrics(font),
                                        baseline = _options$fontMetrics$.baseline;

                                    _this4.rectangle(text.bounds.left, Math.round(text.bounds.top + baseline), text.bounds.width, 1, textDecorationColor);
                                    break;
                                case textDecoration.TEXT_DECORATION_LINE.OVERLINE:
                                    _this4.rectangle(text.bounds.left, Math.round(text.bounds.top), text.bounds.width, 1, textDecorationColor);
                                    break;
                                case textDecoration.TEXT_DECORATION_LINE.LINE_THROUGH:
                                    // TODO try and find exact position for line-through
                                    var _options$fontMetrics$2 = _this4.options.fontMetrics.getMetrics(font),
                                        middle = _options$fontMetrics$2.middle;

                                    _this4.rectangle(text.bounds.left, Math.ceil(text.bounds.top + middle), text.bounds.width, 1, textDecorationColor);
                                    break;
                            }
                        });
                    }
                });
            }
        }, {
            key: 'resizeImage',
            value: function resizeImage(image, size) {
                if (image.width === size.width && image.height === size.height) {
                    return image;
                }

                var canvas = this.canvas.ownerDocument.createElement('canvas');
                canvas.width = size.width;
                canvas.height = size.height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, size.width, size.height);
                return canvas;
            }
        }, {
            key: 'setOpacity',
            value: function setOpacity(opacity) {
                this.ctx.globalAlpha = opacity;
            }
        }, {
            key: 'transform',
            value: function transform(offsetX, offsetY, matrix, callback) {
                this.ctx.save();
                this.ctx.translate(offsetX, offsetY);
                this.ctx.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
                this.ctx.translate(-offsetX, -offsetY);

                callback();

                this.ctx.restore();
            }
        }]);

        return CanvasRenderer;
    }();

    exports.default = CanvasRenderer;
    });

    var CanvasRenderer = unwrapExports(CanvasRenderer_1);

    var Logger_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var Logger = function () {
        function Logger(enabled, id, start) {
            _classCallCheck(this, Logger);

            this.enabled = typeof window !== 'undefined' && enabled;
            this.start = start ? start : Date.now();
            this.id = id;
        }

        _createClass(Logger, [{
            key: 'child',
            value: function child(id) {
                return new Logger(this.enabled, id, this.start);
            }

            // eslint-disable-next-line flowtype/no-weak-types

        }, {
            key: 'log',
            value: function log() {
                if (this.enabled && window.console && window.console.log) {
                    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                        args[_key] = arguments[_key];
                    }

                    Function.prototype.bind.call(window.console.log, window.console).apply(window.console, [Date.now() - this.start + 'ms', this.id ? 'html2canvas (' + this.id + '):' : 'html2canvas:'].concat([].slice.call(args, 0)));
                }
            }

            // eslint-disable-next-line flowtype/no-weak-types

        }, {
            key: 'error',
            value: function error() {
                if (this.enabled && window.console && window.console.error) {
                    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                        args[_key2] = arguments[_key2];
                    }

                    Function.prototype.bind.call(window.console.error, window.console).apply(window.console, [Date.now() - this.start + 'ms', this.id ? 'html2canvas (' + this.id + '):' : 'html2canvas:'].concat([].slice.call(args, 0)));
                }
            }
        }]);

        return Logger;
    }();

    exports.default = Logger;
    });

    var Logger = unwrapExports(Logger_1);

    var Util = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var contains = exports.contains = function contains(bit, value) {
        return (bit & value) !== 0;
    };

    var distance = exports.distance = function distance(a, b) {
        return Math.sqrt(a * a + b * b);
    };

    var copyCSSStyles = exports.copyCSSStyles = function copyCSSStyles(style, target) {
        // Edge does not provide value for cssText
        for (var i = style.length - 1; i >= 0; i--) {
            var property = style.item(i);
            // Safari shows pseudoelements if content is set
            if (property !== 'content') {
                target.style.setProperty(property, style.getPropertyValue(property));
            }
        }
        return target;
    };

    var SMALL_IMAGE = exports.SMALL_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    });

    unwrapExports(Util);
    var Util_1 = Util.contains;
    var Util_2 = Util.distance;
    var Util_3 = Util.copyCSSStyles;
    var Util_4 = Util.SMALL_IMAGE;

    var Length_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var LENGTH_TYPE = exports.LENGTH_TYPE = {
        PX: 0,
        PERCENTAGE: 1
    };

    var Length = function () {
        function Length(value) {
            _classCallCheck(this, Length);

            this.type = value.substr(value.length - 1) === '%' ? LENGTH_TYPE.PERCENTAGE : LENGTH_TYPE.PX;
            var parsedValue = parseFloat(value);
            if (process.env.NODE_ENV !== 'production' && isNaN(parsedValue)) {
                console.error('Invalid value given for Length: "' + value + '"');
            }
            this.value = isNaN(parsedValue) ? 0 : parsedValue;
        }

        _createClass(Length, [{
            key: 'isPercentage',
            value: function isPercentage() {
                return this.type === LENGTH_TYPE.PERCENTAGE;
            }
        }, {
            key: 'getAbsoluteValue',
            value: function getAbsoluteValue(parentLength) {
                return this.isPercentage() ? parentLength * (this.value / 100) : this.value;
            }
        }], [{
            key: 'create',
            value: function create(v) {
                return new Length(v);
            }
        }]);

        return Length;
    }();

    exports.default = Length;


    var getRootFontSize = function getRootFontSize(container) {
        var parent = container.parent;
        return parent ? getRootFontSize(parent) : parseFloat(container.style.font.fontSize);
    };

    var calculateLengthFromValueWithUnit = exports.calculateLengthFromValueWithUnit = function calculateLengthFromValueWithUnit(container, value, unit) {
        switch (unit) {
            case 'px':
            case '%':
                return new Length(value + unit);
            case 'em':
            case 'rem':
                var length = new Length(value);
                length.value *= unit === 'em' ? parseFloat(container.style.font.fontSize) : getRootFontSize(container);
                return length;
            default:
                // TODO: handle correctly if unknown unit is used
                return new Length('0');
        }
    };
    });

    unwrapExports(Length_1);
    var Length_2 = Length_1.LENGTH_TYPE;
    var Length_3 = Length_1.calculateLengthFromValueWithUnit;

    var Size_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var Size = function Size(width, height) {
        _classCallCheck(this, Size);

        this.width = width;
        this.height = height;
    };

    exports.default = Size;
    });

    unwrapExports(Size_1);

    var Vector_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });



    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var Vector = function Vector(x, y) {
        _classCallCheck(this, Vector);

        this.type = Path.PATH.VECTOR;
        this.x = x;
        this.y = y;
        if (process.env.NODE_ENV !== 'production') {
            if (isNaN(x)) {
                console.error('Invalid x value given for Vector');
            }
            if (isNaN(y)) {
                console.error('Invalid y value given for Vector');
            }
        }
    };

    exports.default = Vector;
    });

    unwrapExports(Vector_1);

    var BezierCurve_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();





    var _Vector2 = _interopRequireDefault(Vector_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var lerp = function lerp(a, b, t) {
        return new _Vector2.default(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    };

    var BezierCurve = function () {
        function BezierCurve(start, startControl, endControl, end) {
            _classCallCheck(this, BezierCurve);

            this.type = Path.PATH.BEZIER_CURVE;
            this.start = start;
            this.startControl = startControl;
            this.endControl = endControl;
            this.end = end;
        }

        _createClass(BezierCurve, [{
            key: 'subdivide',
            value: function subdivide(t, firstHalf) {
                var ab = lerp(this.start, this.startControl, t);
                var bc = lerp(this.startControl, this.endControl, t);
                var cd = lerp(this.endControl, this.end, t);
                var abbc = lerp(ab, bc, t);
                var bccd = lerp(bc, cd, t);
                var dest = lerp(abbc, bccd, t);
                return firstHalf ? new BezierCurve(this.start, ab, abbc, dest) : new BezierCurve(dest, bccd, cd, this.end);
            }
        }, {
            key: 'reverse',
            value: function reverse() {
                return new BezierCurve(this.end, this.endControl, this.startControl, this.start);
            }
        }]);

        return BezierCurve;
    }();

    exports.default = BezierCurve;
    });

    unwrapExports(BezierCurve_1);

    var Bounds_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parseBoundCurves = exports.calculatePaddingBoxPath = exports.calculateBorderBoxPath = exports.parsePathForBorder = exports.parseDocumentSize = exports.calculateContentBox = exports.calculatePaddingBox = exports.parseBounds = exports.Bounds = undefined;

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();



    var _Vector2 = _interopRequireDefault(Vector_1);



    var _BezierCurve2 = _interopRequireDefault(BezierCurve_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var TOP = 0;
    var RIGHT = 1;
    var BOTTOM = 2;
    var LEFT = 3;

    var H = 0;
    var V = 1;

    var Bounds = exports.Bounds = function () {
        function Bounds(x, y, w, h) {
            _classCallCheck(this, Bounds);

            this.left = x;
            this.top = y;
            this.width = w;
            this.height = h;
        }

        _createClass(Bounds, null, [{
            key: 'fromClientRect',
            value: function fromClientRect(clientRect, scrollX, scrollY) {
                return new Bounds(clientRect.left + scrollX, clientRect.top + scrollY, clientRect.width, clientRect.height);
            }
        }]);

        return Bounds;
    }();

    var parseBounds = exports.parseBounds = function parseBounds(node, scrollX, scrollY) {
        return Bounds.fromClientRect(node.getBoundingClientRect(), scrollX, scrollY);
    };

    var calculatePaddingBox = exports.calculatePaddingBox = function calculatePaddingBox(bounds, borders) {
        return new Bounds(bounds.left + borders[LEFT].borderWidth, bounds.top + borders[TOP].borderWidth, bounds.width - (borders[RIGHT].borderWidth + borders[LEFT].borderWidth), bounds.height - (borders[TOP].borderWidth + borders[BOTTOM].borderWidth));
    };

    var calculateContentBox = exports.calculateContentBox = function calculateContentBox(bounds, padding, borders) {
        // TODO support percentage paddings
        var paddingTop = padding[TOP].value;
        var paddingRight = padding[RIGHT].value;
        var paddingBottom = padding[BOTTOM].value;
        var paddingLeft = padding[LEFT].value;

        return new Bounds(bounds.left + paddingLeft + borders[LEFT].borderWidth, bounds.top + paddingTop + borders[TOP].borderWidth, bounds.width - (borders[RIGHT].borderWidth + borders[LEFT].borderWidth + paddingLeft + paddingRight), bounds.height - (borders[TOP].borderWidth + borders[BOTTOM].borderWidth + paddingTop + paddingBottom));
    };

    var parseDocumentSize = exports.parseDocumentSize = function parseDocumentSize(document) {
        var body = document.body;
        var documentElement = document.documentElement;

        if (!body || !documentElement) {
            throw new Error(process.env.NODE_ENV !== 'production' ? 'Unable to get document size' : '');
        }
        var width = Math.max(Math.max(body.scrollWidth, documentElement.scrollWidth), Math.max(body.offsetWidth, documentElement.offsetWidth), Math.max(body.clientWidth, documentElement.clientWidth));

        var height = Math.max(Math.max(body.scrollHeight, documentElement.scrollHeight), Math.max(body.offsetHeight, documentElement.offsetHeight), Math.max(body.clientHeight, documentElement.clientHeight));

        return new Bounds(0, 0, width, height);
    };

    var parsePathForBorder = exports.parsePathForBorder = function parsePathForBorder(curves, borderSide) {
        switch (borderSide) {
            case TOP:
                return createPathFromCurves(curves.topLeftOuter, curves.topLeftInner, curves.topRightOuter, curves.topRightInner);
            case RIGHT:
                return createPathFromCurves(curves.topRightOuter, curves.topRightInner, curves.bottomRightOuter, curves.bottomRightInner);
            case BOTTOM:
                return createPathFromCurves(curves.bottomRightOuter, curves.bottomRightInner, curves.bottomLeftOuter, curves.bottomLeftInner);
            case LEFT:
            default:
                return createPathFromCurves(curves.bottomLeftOuter, curves.bottomLeftInner, curves.topLeftOuter, curves.topLeftInner);
        }
    };

    var createPathFromCurves = function createPathFromCurves(outer1, inner1, outer2, inner2) {
        var path = [];
        if (outer1 instanceof _BezierCurve2.default) {
            path.push(outer1.subdivide(0.5, false));
        } else {
            path.push(outer1);
        }

        if (outer2 instanceof _BezierCurve2.default) {
            path.push(outer2.subdivide(0.5, true));
        } else {
            path.push(outer2);
        }

        if (inner2 instanceof _BezierCurve2.default) {
            path.push(inner2.subdivide(0.5, true).reverse());
        } else {
            path.push(inner2);
        }

        if (inner1 instanceof _BezierCurve2.default) {
            path.push(inner1.subdivide(0.5, false).reverse());
        } else {
            path.push(inner1);
        }

        return path;
    };

    var calculateBorderBoxPath = exports.calculateBorderBoxPath = function calculateBorderBoxPath(curves) {
        return [curves.topLeftOuter, curves.topRightOuter, curves.bottomRightOuter, curves.bottomLeftOuter];
    };

    var calculatePaddingBoxPath = exports.calculatePaddingBoxPath = function calculatePaddingBoxPath(curves) {
        return [curves.topLeftInner, curves.topRightInner, curves.bottomRightInner, curves.bottomLeftInner];
    };

    var parseBoundCurves = exports.parseBoundCurves = function parseBoundCurves(bounds, borders, borderRadius) {
        var tlh = borderRadius[CORNER.TOP_LEFT][H].getAbsoluteValue(bounds.width);
        var tlv = borderRadius[CORNER.TOP_LEFT][V].getAbsoluteValue(bounds.height);
        var trh = borderRadius[CORNER.TOP_RIGHT][H].getAbsoluteValue(bounds.width);
        var trv = borderRadius[CORNER.TOP_RIGHT][V].getAbsoluteValue(bounds.height);
        var brh = borderRadius[CORNER.BOTTOM_RIGHT][H].getAbsoluteValue(bounds.width);
        var brv = borderRadius[CORNER.BOTTOM_RIGHT][V].getAbsoluteValue(bounds.height);
        var blh = borderRadius[CORNER.BOTTOM_LEFT][H].getAbsoluteValue(bounds.width);
        var blv = borderRadius[CORNER.BOTTOM_LEFT][V].getAbsoluteValue(bounds.height);

        var factors = [];
        factors.push((tlh + trh) / bounds.width);
        factors.push((blh + brh) / bounds.width);
        factors.push((tlv + blv) / bounds.height);
        factors.push((trv + brv) / bounds.height);
        var maxFactor = Math.max.apply(Math, factors);

        if (maxFactor > 1) {
            tlh /= maxFactor;
            tlv /= maxFactor;
            trh /= maxFactor;
            trv /= maxFactor;
            brh /= maxFactor;
            brv /= maxFactor;
            blh /= maxFactor;
            blv /= maxFactor;
        }

        var topWidth = bounds.width - trh;
        var rightHeight = bounds.height - brv;
        var bottomWidth = bounds.width - brh;
        var leftHeight = bounds.height - blv;

        return {
            topLeftOuter: tlh > 0 || tlv > 0 ? getCurvePoints(bounds.left, bounds.top, tlh, tlv, CORNER.TOP_LEFT) : new _Vector2.default(bounds.left, bounds.top),
            topLeftInner: tlh > 0 || tlv > 0 ? getCurvePoints(bounds.left + borders[LEFT].borderWidth, bounds.top + borders[TOP].borderWidth, Math.max(0, tlh - borders[LEFT].borderWidth), Math.max(0, tlv - borders[TOP].borderWidth), CORNER.TOP_LEFT) : new _Vector2.default(bounds.left + borders[LEFT].borderWidth, bounds.top + borders[TOP].borderWidth),
            topRightOuter: trh > 0 || trv > 0 ? getCurvePoints(bounds.left + topWidth, bounds.top, trh, trv, CORNER.TOP_RIGHT) : new _Vector2.default(bounds.left + bounds.width, bounds.top),
            topRightInner: trh > 0 || trv > 0 ? getCurvePoints(bounds.left + Math.min(topWidth, bounds.width + borders[LEFT].borderWidth), bounds.top + borders[TOP].borderWidth, topWidth > bounds.width + borders[LEFT].borderWidth ? 0 : trh - borders[LEFT].borderWidth, trv - borders[TOP].borderWidth, CORNER.TOP_RIGHT) : new _Vector2.default(bounds.left + bounds.width - borders[RIGHT].borderWidth, bounds.top + borders[TOP].borderWidth),
            bottomRightOuter: brh > 0 || brv > 0 ? getCurvePoints(bounds.left + bottomWidth, bounds.top + rightHeight, brh, brv, CORNER.BOTTOM_RIGHT) : new _Vector2.default(bounds.left + bounds.width, bounds.top + bounds.height),
            bottomRightInner: brh > 0 || brv > 0 ? getCurvePoints(bounds.left + Math.min(bottomWidth, bounds.width - borders[LEFT].borderWidth), bounds.top + Math.min(rightHeight, bounds.height + borders[TOP].borderWidth), Math.max(0, brh - borders[RIGHT].borderWidth), brv - borders[BOTTOM].borderWidth, CORNER.BOTTOM_RIGHT) : new _Vector2.default(bounds.left + bounds.width - borders[RIGHT].borderWidth, bounds.top + bounds.height - borders[BOTTOM].borderWidth),
            bottomLeftOuter: blh > 0 || blv > 0 ? getCurvePoints(bounds.left, bounds.top + leftHeight, blh, blv, CORNER.BOTTOM_LEFT) : new _Vector2.default(bounds.left, bounds.top + bounds.height),
            bottomLeftInner: blh > 0 || blv > 0 ? getCurvePoints(bounds.left + borders[LEFT].borderWidth, bounds.top + leftHeight, Math.max(0, blh - borders[LEFT].borderWidth), blv - borders[BOTTOM].borderWidth, CORNER.BOTTOM_LEFT) : new _Vector2.default(bounds.left + borders[LEFT].borderWidth, bounds.top + bounds.height - borders[BOTTOM].borderWidth)
        };
    };

    var CORNER = {
        TOP_LEFT: 0,
        TOP_RIGHT: 1,
        BOTTOM_RIGHT: 2,
        BOTTOM_LEFT: 3
    };

    var getCurvePoints = function getCurvePoints(x, y, r1, r2, position) {
        var kappa = 4 * ((Math.sqrt(2) - 1) / 3);
        var ox = r1 * kappa; // control point offset horizontal
        var oy = r2 * kappa; // control point offset vertical
        var xm = x + r1; // x-middle
        var ym = y + r2; // y-middle

        switch (position) {
            case CORNER.TOP_LEFT:
                return new _BezierCurve2.default(new _Vector2.default(x, ym), new _Vector2.default(x, ym - oy), new _Vector2.default(xm - ox, y), new _Vector2.default(xm, y));
            case CORNER.TOP_RIGHT:
                return new _BezierCurve2.default(new _Vector2.default(x, y), new _Vector2.default(x + ox, y), new _Vector2.default(xm, ym - oy), new _Vector2.default(xm, ym));
            case CORNER.BOTTOM_RIGHT:
                return new _BezierCurve2.default(new _Vector2.default(xm, y), new _Vector2.default(xm, y + oy), new _Vector2.default(x + ox, ym), new _Vector2.default(x, ym));
            case CORNER.BOTTOM_LEFT:
            default:
                return new _BezierCurve2.default(new _Vector2.default(xm, ym), new _Vector2.default(xm - ox, ym), new _Vector2.default(x, y + oy), new _Vector2.default(x, y));
        }
    };
    });

    unwrapExports(Bounds_1);
    var Bounds_2 = Bounds_1.parseBoundCurves;
    var Bounds_3 = Bounds_1.calculatePaddingBoxPath;
    var Bounds_4 = Bounds_1.calculateBorderBoxPath;
    var Bounds_5 = Bounds_1.parsePathForBorder;
    var Bounds_6 = Bounds_1.parseDocumentSize;
    var Bounds_7 = Bounds_1.calculateContentBox;
    var Bounds_8 = Bounds_1.calculatePaddingBox;
    var Bounds_9 = Bounds_1.parseBounds;
    var Bounds_10 = Bounds_1.Bounds;

    var padding = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parsePadding = exports.PADDING_SIDES = undefined;



    var _Length2 = _interopRequireDefault(Length_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var PADDING_SIDES = exports.PADDING_SIDES = {
        TOP: 0,
        RIGHT: 1,
        BOTTOM: 2,
        LEFT: 3
    };

    var SIDES = ['top', 'right', 'bottom', 'left'];

    var parsePadding = exports.parsePadding = function parsePadding(style) {
        return SIDES.map(function (side) {
            return new _Length2.default(style.getPropertyValue('padding-' + side));
        });
    };
    });

    unwrapExports(padding);
    var padding_1 = padding.parsePadding;
    var padding_2 = padding.PADDING_SIDES;

    var background = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parseBackgroundImage = exports.parseBackground = exports.calculateBackgroundRepeatPath = exports.calculateBackgroundPosition = exports.calculateBackgroungPositioningArea = exports.calculateBackgroungPaintingArea = exports.calculateGradientBackgroundSize = exports.calculateBackgroundSize = exports.BACKGROUND_ORIGIN = exports.BACKGROUND_CLIP = exports.BACKGROUND_SIZE = exports.BACKGROUND_REPEAT = undefined;



    var _Color2 = _interopRequireDefault(Color_1);



    var _Length2 = _interopRequireDefault(Length_1);



    var _Size2 = _interopRequireDefault(Size_1);



    var _Vector2 = _interopRequireDefault(Vector_1);





    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var BACKGROUND_REPEAT = exports.BACKGROUND_REPEAT = {
        REPEAT: 0,
        NO_REPEAT: 1,
        REPEAT_X: 2,
        REPEAT_Y: 3
    };

    var BACKGROUND_SIZE = exports.BACKGROUND_SIZE = {
        AUTO: 0,
        CONTAIN: 1,
        COVER: 2,
        LENGTH: 3
    };

    var BACKGROUND_CLIP = exports.BACKGROUND_CLIP = {
        BORDER_BOX: 0,
        PADDING_BOX: 1,
        CONTENT_BOX: 2
    };

    var BACKGROUND_ORIGIN = exports.BACKGROUND_ORIGIN = BACKGROUND_CLIP;

    var AUTO = 'auto';

    var BackgroundSize = function BackgroundSize(size) {
        _classCallCheck(this, BackgroundSize);

        switch (size) {
            case 'contain':
                this.size = BACKGROUND_SIZE.CONTAIN;
                break;
            case 'cover':
                this.size = BACKGROUND_SIZE.COVER;
                break;
            case 'auto':
                this.size = BACKGROUND_SIZE.AUTO;
                break;
            default:
                this.value = new _Length2.default(size);
        }
    };

    var calculateBackgroundSize = exports.calculateBackgroundSize = function calculateBackgroundSize(backgroundImage, image, bounds) {
        var width = 0;
        var height = 0;
        var size = backgroundImage.size;
        if (size[0].size === BACKGROUND_SIZE.CONTAIN || size[0].size === BACKGROUND_SIZE.COVER) {
            var targetRatio = bounds.width / bounds.height;
            var currentRatio = image.width / image.height;
            return targetRatio < currentRatio !== (size[0].size === BACKGROUND_SIZE.COVER) ? new _Size2.default(bounds.width, bounds.width / currentRatio) : new _Size2.default(bounds.height * currentRatio, bounds.height);
        }

        if (size[0].value) {
            width = size[0].value.getAbsoluteValue(bounds.width);
        }

        if (size[0].size === BACKGROUND_SIZE.AUTO && size[1].size === BACKGROUND_SIZE.AUTO) {
            height = image.height;
        } else if (size[1].size === BACKGROUND_SIZE.AUTO) {
            height = width / image.width * image.height;
        } else if (size[1].value) {
            height = size[1].value.getAbsoluteValue(bounds.height);
        }

        if (size[0].size === BACKGROUND_SIZE.AUTO) {
            width = height / image.height * image.width;
        }

        return new _Size2.default(width, height);
    };

    var calculateGradientBackgroundSize = exports.calculateGradientBackgroundSize = function calculateGradientBackgroundSize(backgroundImage, bounds) {
        var size = backgroundImage.size;
        var width = size[0].value ? size[0].value.getAbsoluteValue(bounds.width) : bounds.width;
        var height = size[1].value ? size[1].value.getAbsoluteValue(bounds.height) : size[0].value ? width : bounds.height;

        return new _Size2.default(width, height);
    };

    var AUTO_SIZE = new BackgroundSize(AUTO);

    var calculateBackgroungPaintingArea = exports.calculateBackgroungPaintingArea = function calculateBackgroungPaintingArea(curves, clip) {
        switch (clip) {
            case BACKGROUND_CLIP.BORDER_BOX:
                return (0, Bounds_1.calculateBorderBoxPath)(curves);
            case BACKGROUND_CLIP.PADDING_BOX:
            default:
                return (0, Bounds_1.calculatePaddingBoxPath)(curves);
        }
    };

    var calculateBackgroungPositioningArea = exports.calculateBackgroungPositioningArea = function calculateBackgroungPositioningArea(backgroundOrigin, bounds, padding$$1, border) {
        var paddingBox = (0, Bounds_1.calculatePaddingBox)(bounds, border);

        switch (backgroundOrigin) {
            case BACKGROUND_ORIGIN.BORDER_BOX:
                return bounds;
            case BACKGROUND_ORIGIN.CONTENT_BOX:
                var paddingLeft = padding$$1[padding.PADDING_SIDES.LEFT].getAbsoluteValue(bounds.width);
                var paddingRight = padding$$1[padding.PADDING_SIDES.RIGHT].getAbsoluteValue(bounds.width);
                var paddingTop = padding$$1[padding.PADDING_SIDES.TOP].getAbsoluteValue(bounds.width);
                var paddingBottom = padding$$1[padding.PADDING_SIDES.BOTTOM].getAbsoluteValue(bounds.width);
                return new Bounds_1.Bounds(paddingBox.left + paddingLeft, paddingBox.top + paddingTop, paddingBox.width - paddingLeft - paddingRight, paddingBox.height - paddingTop - paddingBottom);
            case BACKGROUND_ORIGIN.PADDING_BOX:
            default:
                return paddingBox;
        }
    };

    var calculateBackgroundPosition = exports.calculateBackgroundPosition = function calculateBackgroundPosition(position, size, bounds) {
        return new _Vector2.default(position[0].getAbsoluteValue(bounds.width - size.width), position[1].getAbsoluteValue(bounds.height - size.height));
    };

    var calculateBackgroundRepeatPath = exports.calculateBackgroundRepeatPath = function calculateBackgroundRepeatPath(background, position, size, backgroundPositioningArea, bounds) {
        var repeat = background.repeat;
        switch (repeat) {
            case BACKGROUND_REPEAT.REPEAT_X:
                return [new _Vector2.default(Math.round(bounds.left), Math.round(backgroundPositioningArea.top + position.y)), new _Vector2.default(Math.round(bounds.left + bounds.width), Math.round(backgroundPositioningArea.top + position.y)), new _Vector2.default(Math.round(bounds.left + bounds.width), Math.round(size.height + backgroundPositioningArea.top + position.y)), new _Vector2.default(Math.round(bounds.left), Math.round(size.height + backgroundPositioningArea.top + position.y))];
            case BACKGROUND_REPEAT.REPEAT_Y:
                return [new _Vector2.default(Math.round(backgroundPositioningArea.left + position.x), Math.round(bounds.top)), new _Vector2.default(Math.round(backgroundPositioningArea.left + position.x + size.width), Math.round(bounds.top)), new _Vector2.default(Math.round(backgroundPositioningArea.left + position.x + size.width), Math.round(bounds.height + bounds.top)), new _Vector2.default(Math.round(backgroundPositioningArea.left + position.x), Math.round(bounds.height + bounds.top))];
            case BACKGROUND_REPEAT.NO_REPEAT:
                return [new _Vector2.default(Math.round(backgroundPositioningArea.left + position.x), Math.round(backgroundPositioningArea.top + position.y)), new _Vector2.default(Math.round(backgroundPositioningArea.left + position.x + size.width), Math.round(backgroundPositioningArea.top + position.y)), new _Vector2.default(Math.round(backgroundPositioningArea.left + position.x + size.width), Math.round(backgroundPositioningArea.top + position.y + size.height)), new _Vector2.default(Math.round(backgroundPositioningArea.left + position.x), Math.round(backgroundPositioningArea.top + position.y + size.height))];
            default:
                return [new _Vector2.default(Math.round(bounds.left), Math.round(bounds.top)), new _Vector2.default(Math.round(bounds.left + bounds.width), Math.round(bounds.top)), new _Vector2.default(Math.round(bounds.left + bounds.width), Math.round(bounds.height + bounds.top)), new _Vector2.default(Math.round(bounds.left), Math.round(bounds.height + bounds.top))];
        }
    };

    var parseBackground = exports.parseBackground = function parseBackground(style, resourceLoader) {
        return {
            backgroundColor: new _Color2.default(style.backgroundColor),
            backgroundImage: parseBackgroundImages(style, resourceLoader),
            backgroundClip: parseBackgroundClip(style.backgroundClip),
            backgroundOrigin: parseBackgroundOrigin(style.backgroundOrigin)
        };
    };

    var parseBackgroundClip = function parseBackgroundClip(backgroundClip) {
        switch (backgroundClip) {
            case 'padding-box':
                return BACKGROUND_CLIP.PADDING_BOX;
            case 'content-box':
                return BACKGROUND_CLIP.CONTENT_BOX;
        }
        return BACKGROUND_CLIP.BORDER_BOX;
    };

    var parseBackgroundOrigin = function parseBackgroundOrigin(backgroundOrigin) {
        switch (backgroundOrigin) {
            case 'padding-box':
                return BACKGROUND_ORIGIN.PADDING_BOX;
            case 'content-box':
                return BACKGROUND_ORIGIN.CONTENT_BOX;
        }
        return BACKGROUND_ORIGIN.BORDER_BOX;
    };

    var parseBackgroundRepeat = function parseBackgroundRepeat(backgroundRepeat) {
        switch (backgroundRepeat.trim()) {
            case 'no-repeat':
                return BACKGROUND_REPEAT.NO_REPEAT;
            case 'repeat-x':
            case 'repeat no-repeat':
                return BACKGROUND_REPEAT.REPEAT_X;
            case 'repeat-y':
            case 'no-repeat repeat':
                return BACKGROUND_REPEAT.REPEAT_Y;
            case 'repeat':
                return BACKGROUND_REPEAT.REPEAT;
        }

        if (process.env.NODE_ENV !== 'production') {
            console.error('Invalid background-repeat value "' + backgroundRepeat + '"');
        }

        return BACKGROUND_REPEAT.REPEAT;
    };

    var parseBackgroundImages = function parseBackgroundImages(style, resourceLoader) {
        var sources = parseBackgroundImage(style.backgroundImage).map(function (backgroundImage) {
            if (backgroundImage.method === 'url') {
                var key = resourceLoader.loadImage(backgroundImage.args[0]);
                backgroundImage.args = key ? [key] : [];
            }
            return backgroundImage;
        });
        var positions = style.backgroundPosition.split(',');
        var repeats = style.backgroundRepeat.split(',');
        var sizes = style.backgroundSize.split(',');

        return sources.map(function (source, index) {
            var size = (sizes[index] || AUTO).trim().split(' ').map(parseBackgroundSize);
            var position = (positions[index] || AUTO).trim().split(' ').map(parseBackgoundPosition);

            return {
                source: source,
                repeat: parseBackgroundRepeat(typeof repeats[index] === 'string' ? repeats[index] : repeats[0]),
                size: size.length < 2 ? [size[0], AUTO_SIZE] : [size[0], size[1]],
                position: position.length < 2 ? [position[0], position[0]] : [position[0], position[1]]
            };
        });
    };

    var parseBackgroundSize = function parseBackgroundSize(size) {
        return size === 'auto' ? AUTO_SIZE : new BackgroundSize(size);
    };

    var parseBackgoundPosition = function parseBackgoundPosition(position) {
        switch (position) {
            case 'bottom':
            case 'right':
                return new _Length2.default('100%');
            case 'left':
            case 'top':
                return new _Length2.default('0%');
            case 'auto':
                return new _Length2.default('0');
        }
        return new _Length2.default(position);
    };

    var parseBackgroundImage = exports.parseBackgroundImage = function parseBackgroundImage(image) {
        var whitespace = /^\s$/;
        var results = [];

        var args = [];
        var method = '';
        var quote = null;
        var definition = '';
        var mode = 0;
        var numParen = 0;

        var appendResult = function appendResult() {
            var prefix = '';
            if (method) {
                if (definition.substr(0, 1) === '"') {
                    definition = definition.substr(1, definition.length - 2);
                }

                if (definition) {
                    args.push(definition.trim());
                }

                var prefix_i = method.indexOf('-', 1) + 1;
                if (method.substr(0, 1) === '-' && prefix_i > 0) {
                    prefix = method.substr(0, prefix_i).toLowerCase();
                    method = method.substr(prefix_i);
                }
                method = method.toLowerCase();
                if (method !== 'none') {
                    results.push({
                        prefix: prefix,
                        method: method,
                        args: args
                    });
                }
            }
            args = [];
            method = definition = '';
        };

        image.split('').forEach(function (c) {
            if (mode === 0 && whitespace.test(c)) {
                return;
            }
            switch (c) {
                case '"':
                    if (!quote) {
                        quote = c;
                    } else if (quote === c) {
                        quote = null;
                    }
                    break;
                case '(':
                    if (quote) {
                        break;
                    } else if (mode === 0) {
                        mode = 1;
                        return;
                    } else {
                        numParen++;
                    }
                    break;
                case ')':
                    if (quote) {
                        break;
                    } else if (mode === 1) {
                        if (numParen === 0) {
                            mode = 0;
                            appendResult();
                            return;
                        } else {
                            numParen--;
                        }
                    }
                    break;

                case ',':
                    if (quote) {
                        break;
                    } else if (mode === 0) {
                        appendResult();
                        return;
                    } else if (mode === 1) {
                        if (numParen === 0 && !method.match(/^url$/i)) {
                            args.push(definition.trim());
                            definition = '';
                            return;
                        }
                    }
                    break;
            }

            if (mode === 0) {
                method += c;
            } else {
                definition += c;
            }
        });

        appendResult();
        return results;
    };
    });

    unwrapExports(background);
    var background_1 = background.parseBackgroundImage;
    var background_2 = background.parseBackground;
    var background_3 = background.calculateBackgroundRepeatPath;
    var background_4 = background.calculateBackgroundPosition;
    var background_5 = background.calculateBackgroungPositioningArea;
    var background_6 = background.calculateBackgroungPaintingArea;
    var background_7 = background.calculateGradientBackgroundSize;
    var background_8 = background.calculateBackgroundSize;
    var background_9 = background.BACKGROUND_ORIGIN;
    var background_10 = background.BACKGROUND_CLIP;
    var background_11 = background.BACKGROUND_SIZE;
    var background_12 = background.BACKGROUND_REPEAT;

    var border = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parseBorder = exports.BORDER_SIDES = exports.BORDER_STYLE = undefined;



    var _Color2 = _interopRequireDefault(Color_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var BORDER_STYLE = exports.BORDER_STYLE = {
        NONE: 0,
        SOLID: 1
    };

    var BORDER_SIDES = exports.BORDER_SIDES = {
        TOP: 0,
        RIGHT: 1,
        BOTTOM: 2,
        LEFT: 3
    };

    var SIDES = Object.keys(BORDER_SIDES).map(function (s) {
        return s.toLowerCase();
    });

    var parseBorderStyle = function parseBorderStyle(style) {
        switch (style) {
            case 'none':
                return BORDER_STYLE.NONE;
        }
        return BORDER_STYLE.SOLID;
    };

    var parseBorder = exports.parseBorder = function parseBorder(style) {
        return SIDES.map(function (side) {
            var borderColor = new _Color2.default(style.getPropertyValue('border-' + side + '-color'));
            var borderStyle = parseBorderStyle(style.getPropertyValue('border-' + side + '-style'));
            var borderWidth = parseFloat(style.getPropertyValue('border-' + side + '-width'));
            return {
                borderColor: borderColor,
                borderStyle: borderStyle,
                borderWidth: isNaN(borderWidth) ? 0 : borderWidth
            };
        });
    };
    });

    unwrapExports(border);
    var border_1 = border.parseBorder;
    var border_2 = border.BORDER_SIDES;
    var border_3 = border.BORDER_STYLE;

    var borderRadius = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parseBorderRadius = undefined;

    var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();



    var _Length2 = _interopRequireDefault(Length_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var SIDES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

    var parseBorderRadius = exports.parseBorderRadius = function parseBorderRadius(style) {
        return SIDES.map(function (side) {
            var value = style.getPropertyValue('border-' + side + '-radius');

            var _value$split$map = value.split(' ').map(_Length2.default.create),
                _value$split$map2 = _slicedToArray(_value$split$map, 2),
                horizontal = _value$split$map2[0],
                vertical = _value$split$map2[1];

            return typeof vertical === 'undefined' ? [horizontal, horizontal] : [horizontal, vertical];
        });
    };
    });

    unwrapExports(borderRadius);
    var borderRadius_1 = borderRadius.parseBorderRadius;

    var display = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var DISPLAY = exports.DISPLAY = {
        NONE: 1 << 0,
        BLOCK: 1 << 1,
        INLINE: 1 << 2,
        RUN_IN: 1 << 3,
        FLOW: 1 << 4,
        FLOW_ROOT: 1 << 5,
        TABLE: 1 << 6,
        FLEX: 1 << 7,
        GRID: 1 << 8,
        RUBY: 1 << 9,
        SUBGRID: 1 << 10,
        LIST_ITEM: 1 << 11,
        TABLE_ROW_GROUP: 1 << 12,
        TABLE_HEADER_GROUP: 1 << 13,
        TABLE_FOOTER_GROUP: 1 << 14,
        TABLE_ROW: 1 << 15,
        TABLE_CELL: 1 << 16,
        TABLE_COLUMN_GROUP: 1 << 17,
        TABLE_COLUMN: 1 << 18,
        TABLE_CAPTION: 1 << 19,
        RUBY_BASE: 1 << 20,
        RUBY_TEXT: 1 << 21,
        RUBY_BASE_CONTAINER: 1 << 22,
        RUBY_TEXT_CONTAINER: 1 << 23,
        CONTENTS: 1 << 24,
        INLINE_BLOCK: 1 << 25,
        INLINE_LIST_ITEM: 1 << 26,
        INLINE_TABLE: 1 << 27,
        INLINE_FLEX: 1 << 28,
        INLINE_GRID: 1 << 29
    };

    var parseDisplayValue = function parseDisplayValue(display) {
        switch (display) {
            case 'block':
                return DISPLAY.BLOCK;
            case 'inline':
                return DISPLAY.INLINE;
            case 'run-in':
                return DISPLAY.RUN_IN;
            case 'flow':
                return DISPLAY.FLOW;
            case 'flow-root':
                return DISPLAY.FLOW_ROOT;
            case 'table':
                return DISPLAY.TABLE;
            case 'flex':
                return DISPLAY.FLEX;
            case 'grid':
                return DISPLAY.GRID;
            case 'ruby':
                return DISPLAY.RUBY;
            case 'subgrid':
                return DISPLAY.SUBGRID;
            case 'list-item':
                return DISPLAY.LIST_ITEM;
            case 'table-row-group':
                return DISPLAY.TABLE_ROW_GROUP;
            case 'table-header-group':
                return DISPLAY.TABLE_HEADER_GROUP;
            case 'table-footer-group':
                return DISPLAY.TABLE_FOOTER_GROUP;
            case 'table-row':
                return DISPLAY.TABLE_ROW;
            case 'table-cell':
                return DISPLAY.TABLE_CELL;
            case 'table-column-group':
                return DISPLAY.TABLE_COLUMN_GROUP;
            case 'table-column':
                return DISPLAY.TABLE_COLUMN;
            case 'table-caption':
                return DISPLAY.TABLE_CAPTION;
            case 'ruby-base':
                return DISPLAY.RUBY_BASE;
            case 'ruby-text':
                return DISPLAY.RUBY_TEXT;
            case 'ruby-base-container':
                return DISPLAY.RUBY_BASE_CONTAINER;
            case 'ruby-text-container':
                return DISPLAY.RUBY_TEXT_CONTAINER;
            case 'contents':
                return DISPLAY.CONTENTS;
            case 'inline-block':
                return DISPLAY.INLINE_BLOCK;
            case 'inline-list-item':
                return DISPLAY.INLINE_LIST_ITEM;
            case 'inline-table':
                return DISPLAY.INLINE_TABLE;
            case 'inline-flex':
                return DISPLAY.INLINE_FLEX;
            case 'inline-grid':
                return DISPLAY.INLINE_GRID;
        }

        return DISPLAY.NONE;
    };

    var setDisplayBit = function setDisplayBit(bit, display) {
        return bit | parseDisplayValue(display);
    };

    var parseDisplay = exports.parseDisplay = function parseDisplay(display) {
        return display.split(' ').reduce(setDisplayBit, 0);
    };
    });

    unwrapExports(display);
    var display_1 = display.DISPLAY;
    var display_2 = display.parseDisplay;

    var float_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var FLOAT = exports.FLOAT = {
        NONE: 0,
        LEFT: 1,
        RIGHT: 2,
        INLINE_START: 3,
        INLINE_END: 4
    };

    var parseCSSFloat = exports.parseCSSFloat = function parseCSSFloat(float) {
        switch (float) {
            case 'left':
                return FLOAT.LEFT;
            case 'right':
                return FLOAT.RIGHT;
            case 'inline-start':
                return FLOAT.INLINE_START;
            case 'inline-end':
                return FLOAT.INLINE_END;
        }
        return FLOAT.NONE;
    };
    });

    unwrapExports(float_1);
    var float_2 = float_1.FLOAT;
    var float_3 = float_1.parseCSSFloat;

    var font = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });


    var parseFontWeight = function parseFontWeight(weight) {
        switch (weight) {
            case 'normal':
                return 400;
            case 'bold':
                return 700;
        }

        var value = parseInt(weight, 10);
        return isNaN(value) ? 400 : value;
    };

    var parseFont = exports.parseFont = function parseFont(style) {
        var fontFamily = style.fontFamily;
        var fontSize = style.fontSize;
        var fontStyle = style.fontStyle;
        var fontVariant = style.fontVariant;
        var fontWeight = parseFontWeight(style.fontWeight);

        return {
            fontFamily: fontFamily,
            fontSize: fontSize,
            fontStyle: fontStyle,
            fontVariant: fontVariant,
            fontWeight: fontWeight
        };
    };
    });

    unwrapExports(font);
    var font_1 = font.parseFont;

    var letterSpacing = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var parseLetterSpacing = exports.parseLetterSpacing = function parseLetterSpacing(letterSpacing) {
        if (letterSpacing === 'normal') {
            return 0;
        }
        var value = parseFloat(letterSpacing);
        return isNaN(value) ? 0 : value;
    };
    });

    unwrapExports(letterSpacing);
    var letterSpacing_1 = letterSpacing.parseLetterSpacing;

    var lineBreak = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var LINE_BREAK = exports.LINE_BREAK = {
        NORMAL: 'normal',
        STRICT: 'strict'
    };

    var parseLineBreak = exports.parseLineBreak = function parseLineBreak(wordBreak) {
        switch (wordBreak) {
            case 'strict':
                return LINE_BREAK.STRICT;
            case 'normal':
            default:
                return LINE_BREAK.NORMAL;
        }
    };
    });

    unwrapExports(lineBreak);
    var lineBreak_1 = lineBreak.LINE_BREAK;
    var lineBreak_2 = lineBreak.parseLineBreak;

    var listStyle = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parseListStyle = exports.parseListStyleType = exports.LIST_STYLE_TYPE = exports.LIST_STYLE_POSITION = undefined;



    var LIST_STYLE_POSITION = exports.LIST_STYLE_POSITION = {
        INSIDE: 0,
        OUTSIDE: 1
    };

    var LIST_STYLE_TYPE = exports.LIST_STYLE_TYPE = {
        NONE: -1,
        DISC: 0,
        CIRCLE: 1,
        SQUARE: 2,
        DECIMAL: 3,
        CJK_DECIMAL: 4,
        DECIMAL_LEADING_ZERO: 5,
        LOWER_ROMAN: 6,
        UPPER_ROMAN: 7,
        LOWER_GREEK: 8,
        LOWER_ALPHA: 9,
        UPPER_ALPHA: 10,
        ARABIC_INDIC: 11,
        ARMENIAN: 12,
        BENGALI: 13,
        CAMBODIAN: 14,
        CJK_EARTHLY_BRANCH: 15,
        CJK_HEAVENLY_STEM: 16,
        CJK_IDEOGRAPHIC: 17,
        DEVANAGARI: 18,
        ETHIOPIC_NUMERIC: 19,
        GEORGIAN: 20,
        GUJARATI: 21,
        GURMUKHI: 22,
        HEBREW: 22,
        HIRAGANA: 23,
        HIRAGANA_IROHA: 24,
        JAPANESE_FORMAL: 25,
        JAPANESE_INFORMAL: 26,
        KANNADA: 27,
        KATAKANA: 28,
        KATAKANA_IROHA: 29,
        KHMER: 30,
        KOREAN_HANGUL_FORMAL: 31,
        KOREAN_HANJA_FORMAL: 32,
        KOREAN_HANJA_INFORMAL: 33,
        LAO: 34,
        LOWER_ARMENIAN: 35,
        MALAYALAM: 36,
        MONGOLIAN: 37,
        MYANMAR: 38,
        ORIYA: 39,
        PERSIAN: 40,
        SIMP_CHINESE_FORMAL: 41,
        SIMP_CHINESE_INFORMAL: 42,
        TAMIL: 43,
        TELUGU: 44,
        THAI: 45,
        TIBETAN: 46,
        TRAD_CHINESE_FORMAL: 47,
        TRAD_CHINESE_INFORMAL: 48,
        UPPER_ARMENIAN: 49,
        DISCLOSURE_OPEN: 50,
        DISCLOSURE_CLOSED: 51
    };

    var parseListStyleType = exports.parseListStyleType = function parseListStyleType(type) {
        switch (type) {
            case 'disc':
                return LIST_STYLE_TYPE.DISC;
            case 'circle':
                return LIST_STYLE_TYPE.CIRCLE;
            case 'square':
                return LIST_STYLE_TYPE.SQUARE;
            case 'decimal':
                return LIST_STYLE_TYPE.DECIMAL;
            case 'cjk-decimal':
                return LIST_STYLE_TYPE.CJK_DECIMAL;
            case 'decimal-leading-zero':
                return LIST_STYLE_TYPE.DECIMAL_LEADING_ZERO;
            case 'lower-roman':
                return LIST_STYLE_TYPE.LOWER_ROMAN;
            case 'upper-roman':
                return LIST_STYLE_TYPE.UPPER_ROMAN;
            case 'lower-greek':
                return LIST_STYLE_TYPE.LOWER_GREEK;
            case 'lower-alpha':
                return LIST_STYLE_TYPE.LOWER_ALPHA;
            case 'upper-alpha':
                return LIST_STYLE_TYPE.UPPER_ALPHA;
            case 'arabic-indic':
                return LIST_STYLE_TYPE.ARABIC_INDIC;
            case 'armenian':
                return LIST_STYLE_TYPE.ARMENIAN;
            case 'bengali':
                return LIST_STYLE_TYPE.BENGALI;
            case 'cambodian':
                return LIST_STYLE_TYPE.CAMBODIAN;
            case 'cjk-earthly-branch':
                return LIST_STYLE_TYPE.CJK_EARTHLY_BRANCH;
            case 'cjk-heavenly-stem':
                return LIST_STYLE_TYPE.CJK_HEAVENLY_STEM;
            case 'cjk-ideographic':
                return LIST_STYLE_TYPE.CJK_IDEOGRAPHIC;
            case 'devanagari':
                return LIST_STYLE_TYPE.DEVANAGARI;
            case 'ethiopic-numeric':
                return LIST_STYLE_TYPE.ETHIOPIC_NUMERIC;
            case 'georgian':
                return LIST_STYLE_TYPE.GEORGIAN;
            case 'gujarati':
                return LIST_STYLE_TYPE.GUJARATI;
            case 'gurmukhi':
                return LIST_STYLE_TYPE.GURMUKHI;
            case 'hebrew':
                return LIST_STYLE_TYPE.HEBREW;
            case 'hiragana':
                return LIST_STYLE_TYPE.HIRAGANA;
            case 'hiragana-iroha':
                return LIST_STYLE_TYPE.HIRAGANA_IROHA;
            case 'japanese-formal':
                return LIST_STYLE_TYPE.JAPANESE_FORMAL;
            case 'japanese-informal':
                return LIST_STYLE_TYPE.JAPANESE_INFORMAL;
            case 'kannada':
                return LIST_STYLE_TYPE.KANNADA;
            case 'katakana':
                return LIST_STYLE_TYPE.KATAKANA;
            case 'katakana-iroha':
                return LIST_STYLE_TYPE.KATAKANA_IROHA;
            case 'khmer':
                return LIST_STYLE_TYPE.KHMER;
            case 'korean-hangul-formal':
                return LIST_STYLE_TYPE.KOREAN_HANGUL_FORMAL;
            case 'korean-hanja-formal':
                return LIST_STYLE_TYPE.KOREAN_HANJA_FORMAL;
            case 'korean-hanja-informal':
                return LIST_STYLE_TYPE.KOREAN_HANJA_INFORMAL;
            case 'lao':
                return LIST_STYLE_TYPE.LAO;
            case 'lower-armenian':
                return LIST_STYLE_TYPE.LOWER_ARMENIAN;
            case 'malayalam':
                return LIST_STYLE_TYPE.MALAYALAM;
            case 'mongolian':
                return LIST_STYLE_TYPE.MONGOLIAN;
            case 'myanmar':
                return LIST_STYLE_TYPE.MYANMAR;
            case 'oriya':
                return LIST_STYLE_TYPE.ORIYA;
            case 'persian':
                return LIST_STYLE_TYPE.PERSIAN;
            case 'simp-chinese-formal':
                return LIST_STYLE_TYPE.SIMP_CHINESE_FORMAL;
            case 'simp-chinese-informal':
                return LIST_STYLE_TYPE.SIMP_CHINESE_INFORMAL;
            case 'tamil':
                return LIST_STYLE_TYPE.TAMIL;
            case 'telugu':
                return LIST_STYLE_TYPE.TELUGU;
            case 'thai':
                return LIST_STYLE_TYPE.THAI;
            case 'tibetan':
                return LIST_STYLE_TYPE.TIBETAN;
            case 'trad-chinese-formal':
                return LIST_STYLE_TYPE.TRAD_CHINESE_FORMAL;
            case 'trad-chinese-informal':
                return LIST_STYLE_TYPE.TRAD_CHINESE_INFORMAL;
            case 'upper-armenian':
                return LIST_STYLE_TYPE.UPPER_ARMENIAN;
            case 'disclosure-open':
                return LIST_STYLE_TYPE.DISCLOSURE_OPEN;
            case 'disclosure-closed':
                return LIST_STYLE_TYPE.DISCLOSURE_CLOSED;
            case 'none':
            default:
                return LIST_STYLE_TYPE.NONE;
        }
    };

    var parseListStyle = exports.parseListStyle = function parseListStyle(style) {
        var listStyleImage = (0, background.parseBackgroundImage)(style.getPropertyValue('list-style-image'));
        return {
            listStyleType: parseListStyleType(style.getPropertyValue('list-style-type')),
            listStyleImage: listStyleImage.length ? listStyleImage[0] : null,
            listStylePosition: parseListStylePosition(style.getPropertyValue('list-style-position'))
        };
    };

    var parseListStylePosition = function parseListStylePosition(position) {
        switch (position) {
            case 'inside':
                return LIST_STYLE_POSITION.INSIDE;
            case 'outside':
            default:
                return LIST_STYLE_POSITION.OUTSIDE;
        }
    };
    });

    unwrapExports(listStyle);
    var listStyle_1 = listStyle.parseListStyle;
    var listStyle_2 = listStyle.parseListStyleType;
    var listStyle_3 = listStyle.LIST_STYLE_TYPE;
    var listStyle_4 = listStyle.LIST_STYLE_POSITION;

    var margin = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parseMargin = undefined;



    var _Length2 = _interopRequireDefault(Length_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var SIDES = ['top', 'right', 'bottom', 'left'];

    var parseMargin = exports.parseMargin = function parseMargin(style) {
        return SIDES.map(function (side) {
            return new _Length2.default(style.getPropertyValue('margin-' + side));
        });
    };
    });

    unwrapExports(margin);
    var margin_1 = margin.parseMargin;

    var overflow = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var OVERFLOW = exports.OVERFLOW = {
        VISIBLE: 0,
        HIDDEN: 1,
        SCROLL: 2,
        AUTO: 3
    };

    var parseOverflow = exports.parseOverflow = function parseOverflow(overflow) {
        switch (overflow) {
            case 'hidden':
                return OVERFLOW.HIDDEN;
            case 'scroll':
                return OVERFLOW.SCROLL;
            case 'auto':
                return OVERFLOW.AUTO;
            case 'visible':
            default:
                return OVERFLOW.VISIBLE;
        }
    };
    });

    unwrapExports(overflow);
    var overflow_1 = overflow.OVERFLOW;
    var overflow_2 = overflow.parseOverflow;

    var overflowWrap = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var OVERFLOW_WRAP = exports.OVERFLOW_WRAP = {
        NORMAL: 0,
        BREAK_WORD: 1
    };

    var parseOverflowWrap = exports.parseOverflowWrap = function parseOverflowWrap(overflow) {
        switch (overflow) {
            case 'break-word':
                return OVERFLOW_WRAP.BREAK_WORD;
            case 'normal':
            default:
                return OVERFLOW_WRAP.NORMAL;
        }
    };
    });

    unwrapExports(overflowWrap);
    var overflowWrap_1 = overflowWrap.OVERFLOW_WRAP;
    var overflowWrap_2 = overflowWrap.parseOverflowWrap;

    var position = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var POSITION = exports.POSITION = {
        STATIC: 0,
        RELATIVE: 1,
        ABSOLUTE: 2,
        FIXED: 3,
        STICKY: 4
    };

    var parsePosition = exports.parsePosition = function parsePosition(position) {
        switch (position) {
            case 'relative':
                return POSITION.RELATIVE;
            case 'absolute':
                return POSITION.ABSOLUTE;
            case 'fixed':
                return POSITION.FIXED;
            case 'sticky':
                return POSITION.STICKY;
        }

        return POSITION.STATIC;
    };
    });

    unwrapExports(position);
    var position_1 = position.POSITION;
    var position_2 = position.parsePosition;

    var textShadow = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parseTextShadow = undefined;



    var _Color2 = _interopRequireDefault(Color_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var NUMBER = /^([+-]|\d|\.)$/i;

    var parseTextShadow = exports.parseTextShadow = function parseTextShadow(textShadow) {
        if (textShadow === 'none' || typeof textShadow !== 'string') {
            return null;
        }

        var currentValue = '';
        var isLength = false;
        var values = [];
        var shadows = [];
        var numParens = 0;
        var color = null;

        var appendValue = function appendValue() {
            if (currentValue.length) {
                if (isLength) {
                    values.push(parseFloat(currentValue));
                } else {
                    color = new _Color2.default(currentValue);
                }
            }
            isLength = false;
            currentValue = '';
        };

        var appendShadow = function appendShadow() {
            if (values.length && color !== null) {
                shadows.push({
                    color: color,
                    offsetX: values[0] || 0,
                    offsetY: values[1] || 0,
                    blur: values[2] || 0
                });
            }
            values.splice(0, values.length);
            color = null;
        };

        for (var i = 0; i < textShadow.length; i++) {
            var c = textShadow[i];
            switch (c) {
                case '(':
                    currentValue += c;
                    numParens++;
                    break;
                case ')':
                    currentValue += c;
                    numParens--;
                    break;
                case ',':
                    if (numParens === 0) {
                        appendValue();
                        appendShadow();
                    } else {
                        currentValue += c;
                    }
                    break;
                case ' ':
                    if (numParens === 0) {
                        appendValue();
                    } else {
                        currentValue += c;
                    }
                    break;
                default:
                    if (currentValue.length === 0 && NUMBER.test(c)) {
                        isLength = true;
                    }
                    currentValue += c;
            }
        }

        appendValue();
        appendShadow();

        if (shadows.length === 0) {
            return null;
        }

        return shadows;
    };
    });

    unwrapExports(textShadow);
    var textShadow_1 = textShadow.parseTextShadow;

    var textTransform = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var TEXT_TRANSFORM = exports.TEXT_TRANSFORM = {
        NONE: 0,
        LOWERCASE: 1,
        UPPERCASE: 2,
        CAPITALIZE: 3
    };

    var parseTextTransform = exports.parseTextTransform = function parseTextTransform(textTransform) {
        switch (textTransform) {
            case 'uppercase':
                return TEXT_TRANSFORM.UPPERCASE;
            case 'lowercase':
                return TEXT_TRANSFORM.LOWERCASE;
            case 'capitalize':
                return TEXT_TRANSFORM.CAPITALIZE;
        }

        return TEXT_TRANSFORM.NONE;
    };
    });

    unwrapExports(textTransform);
    var textTransform_1 = textTransform.TEXT_TRANSFORM;
    var textTransform_2 = textTransform.parseTextTransform;

    var transform = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parseTransform = undefined;



    var _Length2 = _interopRequireDefault(Length_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var toFloat = function toFloat(s) {
        return parseFloat(s.trim());
    };

    var MATRIX = /(matrix|matrix3d)\((.+)\)/;

    var parseTransform = exports.parseTransform = function parseTransform(style) {
        var transform = parseTransformMatrix(style.transform || style.webkitTransform || style.mozTransform ||
        // $FlowFixMe
        style.msTransform ||
        // $FlowFixMe
        style.oTransform);
        if (transform === null) {
            return null;
        }

        return {
            transform: transform,
            transformOrigin: parseTransformOrigin(style.transformOrigin || style.webkitTransformOrigin || style.mozTransformOrigin ||
            // $FlowFixMe
            style.msTransformOrigin ||
            // $FlowFixMe
            style.oTransformOrigin)
        };
    };

    // $FlowFixMe
    var parseTransformOrigin = function parseTransformOrigin(origin) {
        if (typeof origin !== 'string') {
            var v = new _Length2.default('0');
            return [v, v];
        }
        var values = origin.split(' ').map(_Length2.default.create);
        return [values[0], values[1]];
    };

    // $FlowFixMe
    var parseTransformMatrix = function parseTransformMatrix(transform) {
        if (transform === 'none' || typeof transform !== 'string') {
            return null;
        }

        var match = transform.match(MATRIX);
        if (match) {
            if (match[1] === 'matrix') {
                var matrix = match[2].split(',').map(toFloat);
                return [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]];
            } else {
                var matrix3d = match[2].split(',').map(toFloat);
                return [matrix3d[0], matrix3d[1], matrix3d[4], matrix3d[5], matrix3d[12], matrix3d[13]];
            }
        }
        return null;
    };
    });

    unwrapExports(transform);
    var transform_1 = transform.parseTransform;

    var visibility = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var VISIBILITY = exports.VISIBILITY = {
        VISIBLE: 0,
        HIDDEN: 1,
        COLLAPSE: 2
    };

    var parseVisibility = exports.parseVisibility = function parseVisibility(visibility) {
        switch (visibility) {
            case 'hidden':
                return VISIBILITY.HIDDEN;
            case 'collapse':
                return VISIBILITY.COLLAPSE;
            case 'visible':
            default:
                return VISIBILITY.VISIBLE;
        }
    };
    });

    unwrapExports(visibility);
    var visibility_1 = visibility.VISIBILITY;
    var visibility_2 = visibility.parseVisibility;

    var wordBreak = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var WORD_BREAK = exports.WORD_BREAK = {
        NORMAL: 'normal',
        BREAK_ALL: 'break-all',
        KEEP_ALL: 'keep-all'
    };

    var parseWordBreak = exports.parseWordBreak = function parseWordBreak(wordBreak) {
        switch (wordBreak) {
            case 'break-all':
                return WORD_BREAK.BREAK_ALL;
            case 'keep-all':
                return WORD_BREAK.KEEP_ALL;
            case 'normal':
            default:
                return WORD_BREAK.NORMAL;
        }
    };
    });

    unwrapExports(wordBreak);
    var wordBreak_1 = wordBreak.WORD_BREAK;
    var wordBreak_2 = wordBreak.parseWordBreak;

    var zIndex = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var parseZIndex = exports.parseZIndex = function parseZIndex(zIndex) {
        var auto = zIndex === 'auto';
        return {
            auto: auto,
            order: auto ? 0 : parseInt(zIndex, 10)
        };
    };
    });

    unwrapExports(zIndex);
    var zIndex_1 = zIndex.parseZIndex;

    var ForeignObjectRenderer_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var ForeignObjectRenderer = function () {
        function ForeignObjectRenderer(element) {
            _classCallCheck(this, ForeignObjectRenderer);

            this.element = element;
        }

        _createClass(ForeignObjectRenderer, [{
            key: 'render',
            value: function render(options) {
                var _this = this;

                this.options = options;
                this.canvas = document.createElement('canvas');
                this.ctx = this.canvas.getContext('2d');
                this.canvas.width = Math.floor(options.width) * options.scale;
                this.canvas.height = Math.floor(options.height) * options.scale;
                this.canvas.style.width = options.width + 'px';
                this.canvas.style.height = options.height + 'px';

                options.logger.log('ForeignObject renderer initialized (' + options.width + 'x' + options.height + ' at ' + options.x + ',' + options.y + ') with scale ' + options.scale);
                var svg = createForeignObjectSVG(Math.max(options.windowWidth, options.width) * options.scale, Math.max(options.windowHeight, options.height) * options.scale, options.scrollX * options.scale, options.scrollY * options.scale, this.element);

                return loadSerializedSVG(svg).then(function (img) {
                    if (options.backgroundColor) {
                        _this.ctx.fillStyle = options.backgroundColor.toString();
                        _this.ctx.fillRect(0, 0, options.width * options.scale, options.height * options.scale);
                    }

                    _this.ctx.drawImage(img, -options.x * options.scale, -options.y * options.scale);
                    return _this.canvas;
                });
            }
        }]);

        return ForeignObjectRenderer;
    }();

    exports.default = ForeignObjectRenderer;
    var createForeignObjectSVG = exports.createForeignObjectSVG = function createForeignObjectSVG(width, height, x, y, node) {
        var xmlns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(xmlns, 'svg');
        var foreignObject = document.createElementNS(xmlns, 'foreignObject');
        svg.setAttributeNS(null, 'width', width);
        svg.setAttributeNS(null, 'height', height);

        foreignObject.setAttributeNS(null, 'width', '100%');
        foreignObject.setAttributeNS(null, 'height', '100%');
        foreignObject.setAttributeNS(null, 'x', x);
        foreignObject.setAttributeNS(null, 'y', y);
        foreignObject.setAttributeNS(null, 'externalResourcesRequired', 'true');
        svg.appendChild(foreignObject);

        foreignObject.appendChild(node);

        return svg;
    };

    var loadSerializedSVG = exports.loadSerializedSVG = function loadSerializedSVG(svg) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () {
                return resolve(img);
            };
            img.onerror = reject;

            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
        });
    };
    });

    unwrapExports(ForeignObjectRenderer_1);
    var ForeignObjectRenderer_2 = ForeignObjectRenderer_1.createForeignObjectSVG;
    var ForeignObjectRenderer_3 = ForeignObjectRenderer_1.loadSerializedSVG;

    var Feature = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });



    var testRangeBounds = function testRangeBounds(document) {
        var TEST_HEIGHT = 123;

        if (document.createRange) {
            var range = document.createRange();
            if (range.getBoundingClientRect) {
                var testElement = document.createElement('boundtest');
                testElement.style.height = TEST_HEIGHT + 'px';
                testElement.style.display = 'block';
                document.body.appendChild(testElement);

                range.selectNode(testElement);
                var rangeBounds = range.getBoundingClientRect();
                var rangeHeight = Math.round(rangeBounds.height);
                document.body.removeChild(testElement);
                if (rangeHeight === TEST_HEIGHT) {
                    return true;
                }
            }
        }

        return false;
    };

    // iOS 10.3 taints canvas with base64 images unless crossOrigin = 'anonymous'
    var testBase64 = function testBase64(document, src) {
        var img = new Image();
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');

        return new Promise(function (resolve) {
            // Single pixel base64 image renders fine on iOS 10.3???
            img.src = src;

            var onload = function onload() {
                try {
                    ctx.drawImage(img, 0, 0);
                    canvas.toDataURL();
                } catch (e) {
                    return resolve(false);
                }

                return resolve(true);
            };

            img.onload = onload;
            img.onerror = function () {
                return resolve(false);
            };

            if (img.complete === true) {
                setTimeout(function () {
                    onload();
                }, 500);
            }
        });
    };

    var testCORS = function testCORS() {
        return typeof new Image().crossOrigin !== 'undefined';
    };

    var testResponseType = function testResponseType() {
        return typeof new XMLHttpRequest().responseType === 'string';
    };

    var testSVG = function testSVG(document) {
        var img = new Image();
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        img.src = 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'></svg>';

        try {
            ctx.drawImage(img, 0, 0);
            canvas.toDataURL();
        } catch (e) {
            return false;
        }
        return true;
    };

    var isGreenPixel = function isGreenPixel(data) {
        return data[0] === 0 && data[1] === 255 && data[2] === 0 && data[3] === 255;
    };

    var testForeignObject = function testForeignObject(document) {
        var canvas = document.createElement('canvas');
        var size = 100;
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgb(0, 255, 0)';
        ctx.fillRect(0, 0, size, size);

        var img = new Image();
        var greenImageSrc = canvas.toDataURL();
        img.src = greenImageSrc;
        var svg = (0, ForeignObjectRenderer_1.createForeignObjectSVG)(size, size, 0, 0, img);
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, size, size);

        return (0, ForeignObjectRenderer_1.loadSerializedSVG)(svg).then(function (img) {
            ctx.drawImage(img, 0, 0);
            var data = ctx.getImageData(0, 0, size, size).data;
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, size, size);

            var node = document.createElement('div');
            node.style.backgroundImage = 'url(' + greenImageSrc + ')';
            node.style.height = size + 'px';
            // Firefox 55 does not render inline <img /> tags
            return isGreenPixel(data) ? (0, ForeignObjectRenderer_1.loadSerializedSVG)((0, ForeignObjectRenderer_1.createForeignObjectSVG)(size, size, 0, 0, node)) : Promise.reject(false);
        }).then(function (img) {
            ctx.drawImage(img, 0, 0);
            // Edge does not render background-images
            return isGreenPixel(ctx.getImageData(0, 0, size, size).data);
        }).catch(function (e) {
            return false;
        });
    };

    var FEATURES = {
        // $FlowFixMe - get/set properties not yet supported
        get SUPPORT_RANGE_BOUNDS() {

            var value = testRangeBounds(document);
            Object.defineProperty(FEATURES, 'SUPPORT_RANGE_BOUNDS', { value: value });
            return value;
        },
        // $FlowFixMe - get/set properties not yet supported
        get SUPPORT_SVG_DRAWING() {

            var value = testSVG(document);
            Object.defineProperty(FEATURES, 'SUPPORT_SVG_DRAWING', { value: value });
            return value;
        },
        // $FlowFixMe - get/set properties not yet supported
        get SUPPORT_BASE64_DRAWING() {

            return function (src) {
                var _value = testBase64(document, src);
                Object.defineProperty(FEATURES, 'SUPPORT_BASE64_DRAWING', { value: function value() {
                        return _value;
                    } });
                return _value;
            };
        },
        // $FlowFixMe - get/set properties not yet supported
        get SUPPORT_FOREIGNOBJECT_DRAWING() {

            var value = typeof Array.from === 'function' && typeof window.fetch === 'function' ? testForeignObject(document) : Promise.resolve(false);
            Object.defineProperty(FEATURES, 'SUPPORT_FOREIGNOBJECT_DRAWING', { value: value });
            return value;
        },
        // $FlowFixMe - get/set properties not yet supported
        get SUPPORT_CORS_IMAGES() {

            var value = testCORS();
            Object.defineProperty(FEATURES, 'SUPPORT_CORS_IMAGES', { value: value });
            return value;
        },
        // $FlowFixMe - get/set properties not yet supported
        get SUPPORT_RESPONSE_TYPE() {

            var value = testResponseType();
            Object.defineProperty(FEATURES, 'SUPPORT_RESPONSE_TYPE', { value: value });
            return value;
        },
        // $FlowFixMe - get/set properties not yet supported
        get SUPPORT_CORS_XHR() {

            var value = 'withCredentials' in new XMLHttpRequest();
            Object.defineProperty(FEATURES, 'SUPPORT_CORS_XHR', { value: value });
            return value;
        }
    };

    exports.default = FEATURES;
    });

    unwrapExports(Feature);

    var Util$2 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var toCodePoints = exports.toCodePoints = function toCodePoints(str) {
        var codePoints = [];
        var i = 0;
        var length = str.length;
        while (i < length) {
            var value = str.charCodeAt(i++);
            if (value >= 0xd800 && value <= 0xdbff && i < length) {
                var extra = str.charCodeAt(i++);
                if ((extra & 0xfc00) === 0xdc00) {
                    codePoints.push(((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000);
                } else {
                    codePoints.push(value);
                    i--;
                }
            } else {
                codePoints.push(value);
            }
        }
        return codePoints;
    };

    var fromCodePoint = exports.fromCodePoint = function fromCodePoint() {
        if (String.fromCodePoint) {
            return String.fromCodePoint.apply(String, arguments);
        }

        var length = arguments.length;
        if (!length) {
            return '';
        }

        var codeUnits = [];

        var index = -1;
        var result = '';
        while (++index < length) {
            var codePoint = arguments.length <= index ? undefined : arguments[index];
            if (codePoint <= 0xffff) {
                codeUnits.push(codePoint);
            } else {
                codePoint -= 0x10000;
                codeUnits.push((codePoint >> 10) + 0xd800, codePoint % 0x400 + 0xdc00);
            }
            if (index + 1 === length || codeUnits.length > 0x4000) {
                result += String.fromCharCode.apply(String, codeUnits);
                codeUnits.length = 0;
            }
        }
        return result;
    };

    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    // Use a lookup table to find the index.
    var lookup = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
    for (var i = 0; i < chars.length; i++) {
        lookup[chars.charCodeAt(i)] = i;
    }

    var decode = exports.decode = function decode(base64) {
        var bufferLength = base64.length * 0.75,
            len = base64.length,
            i = void 0,
            p = 0,
            encoded1 = void 0,
            encoded2 = void 0,
            encoded3 = void 0,
            encoded4 = void 0;

        if (base64[base64.length - 1] === '=') {
            bufferLength--;
            if (base64[base64.length - 2] === '=') {
                bufferLength--;
            }
        }

        var buffer = typeof ArrayBuffer !== 'undefined' && typeof Uint8Array !== 'undefined' && typeof Uint8Array.prototype.slice !== 'undefined' ? new ArrayBuffer(bufferLength) : new Array(bufferLength);
        var bytes = Array.isArray(buffer) ? buffer : new Uint8Array(buffer);

        for (i = 0; i < len; i += 4) {
            encoded1 = lookup[base64.charCodeAt(i)];
            encoded2 = lookup[base64.charCodeAt(i + 1)];
            encoded3 = lookup[base64.charCodeAt(i + 2)];
            encoded4 = lookup[base64.charCodeAt(i + 3)];

            bytes[p++] = encoded1 << 2 | encoded2 >> 4;
            bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
            bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
        }

        return buffer;
    };

    var polyUint16Array = exports.polyUint16Array = function polyUint16Array(buffer) {
        var length = buffer.length;
        var bytes = [];
        for (var _i = 0; _i < length; _i += 2) {
            bytes.push(buffer[_i + 1] << 8 | buffer[_i]);
        }
        return bytes;
    };

    var polyUint32Array = exports.polyUint32Array = function polyUint32Array(buffer) {
        var length = buffer.length;
        var bytes = [];
        for (var _i2 = 0; _i2 < length; _i2 += 4) {
            bytes.push(buffer[_i2 + 3] << 24 | buffer[_i2 + 2] << 16 | buffer[_i2 + 1] << 8 | buffer[_i2]);
        }
        return bytes;
    };
    });

    unwrapExports(Util$2);
    var Util_1$1 = Util$2.toCodePoints;
    var Util_2$1 = Util$2.fromCodePoint;
    var Util_3$1 = Util$2.decode;
    var Util_4$1 = Util$2.polyUint16Array;
    var Util_5 = Util$2.polyUint32Array;

    var Trie_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.Trie = exports.createTrieFromBase64 = exports.UTRIE2_INDEX_2_MASK = exports.UTRIE2_INDEX_2_BLOCK_LENGTH = exports.UTRIE2_OMITTED_BMP_INDEX_1_LENGTH = exports.UTRIE2_INDEX_1_OFFSET = exports.UTRIE2_UTF8_2B_INDEX_2_LENGTH = exports.UTRIE2_UTF8_2B_INDEX_2_OFFSET = exports.UTRIE2_INDEX_2_BMP_LENGTH = exports.UTRIE2_LSCP_INDEX_2_LENGTH = exports.UTRIE2_DATA_MASK = exports.UTRIE2_DATA_BLOCK_LENGTH = exports.UTRIE2_LSCP_INDEX_2_OFFSET = exports.UTRIE2_SHIFT_1_2 = exports.UTRIE2_INDEX_SHIFT = exports.UTRIE2_SHIFT_1 = exports.UTRIE2_SHIFT_2 = undefined;

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();



    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    /** Shift size for getting the index-2 table offset. */
    var UTRIE2_SHIFT_2 = exports.UTRIE2_SHIFT_2 = 5;

    /** Shift size for getting the index-1 table offset. */
    var UTRIE2_SHIFT_1 = exports.UTRIE2_SHIFT_1 = 6 + 5;

    /**
     * Shift size for shifting left the index array values.
     * Increases possible data size with 16-bit index values at the cost
     * of compactability.
     * This requires data blocks to be aligned by UTRIE2_DATA_GRANULARITY.
     */
    var UTRIE2_INDEX_SHIFT = exports.UTRIE2_INDEX_SHIFT = 2;

    /**
     * Difference between the two shift sizes,
     * for getting an index-1 offset from an index-2 offset. 6=11-5
     */
    var UTRIE2_SHIFT_1_2 = exports.UTRIE2_SHIFT_1_2 = UTRIE2_SHIFT_1 - UTRIE2_SHIFT_2;

    /**
     * The part of the index-2 table for U+D800..U+DBFF stores values for
     * lead surrogate code _units_ not code _points_.
     * Values for lead surrogate code _points_ are indexed with this portion of the table.
     * Length=32=0x20=0x400>>UTRIE2_SHIFT_2. (There are 1024=0x400 lead surrogates.)
     */
    var UTRIE2_LSCP_INDEX_2_OFFSET = exports.UTRIE2_LSCP_INDEX_2_OFFSET = 0x10000 >> UTRIE2_SHIFT_2;

    /** Number of entries in a data block. 32=0x20 */
    var UTRIE2_DATA_BLOCK_LENGTH = exports.UTRIE2_DATA_BLOCK_LENGTH = 1 << UTRIE2_SHIFT_2;
    /** Mask for getting the lower bits for the in-data-block offset. */
    var UTRIE2_DATA_MASK = exports.UTRIE2_DATA_MASK = UTRIE2_DATA_BLOCK_LENGTH - 1;

    var UTRIE2_LSCP_INDEX_2_LENGTH = exports.UTRIE2_LSCP_INDEX_2_LENGTH = 0x400 >> UTRIE2_SHIFT_2;
    /** Count the lengths of both BMP pieces. 2080=0x820 */
    var UTRIE2_INDEX_2_BMP_LENGTH = exports.UTRIE2_INDEX_2_BMP_LENGTH = UTRIE2_LSCP_INDEX_2_OFFSET + UTRIE2_LSCP_INDEX_2_LENGTH;
    /**
     * The 2-byte UTF-8 version of the index-2 table follows at offset 2080=0x820.
     * Length 32=0x20 for lead bytes C0..DF, regardless of UTRIE2_SHIFT_2.
     */
    var UTRIE2_UTF8_2B_INDEX_2_OFFSET = exports.UTRIE2_UTF8_2B_INDEX_2_OFFSET = UTRIE2_INDEX_2_BMP_LENGTH;
    var UTRIE2_UTF8_2B_INDEX_2_LENGTH = exports.UTRIE2_UTF8_2B_INDEX_2_LENGTH = 0x800 >> 6; /* U+0800 is the first code point after 2-byte UTF-8 */
    /**
     * The index-1 table, only used for supplementary code points, at offset 2112=0x840.
     * Variable length, for code points up to highStart, where the last single-value range starts.
     * Maximum length 512=0x200=0x100000>>UTRIE2_SHIFT_1.
     * (For 0x100000 supplementary code points U+10000..U+10ffff.)
     *
     * The part of the index-2 table for supplementary code points starts
     * after this index-1 table.
     *
     * Both the index-1 table and the following part of the index-2 table
     * are omitted completely if there is only BMP data.
     */
    var UTRIE2_INDEX_1_OFFSET = exports.UTRIE2_INDEX_1_OFFSET = UTRIE2_UTF8_2B_INDEX_2_OFFSET + UTRIE2_UTF8_2B_INDEX_2_LENGTH;

    /**
     * Number of index-1 entries for the BMP. 32=0x20
     * This part of the index-1 table is omitted from the serialized form.
     */
    var UTRIE2_OMITTED_BMP_INDEX_1_LENGTH = exports.UTRIE2_OMITTED_BMP_INDEX_1_LENGTH = 0x10000 >> UTRIE2_SHIFT_1;

    /** Number of entries in an index-2 block. 64=0x40 */
    var UTRIE2_INDEX_2_BLOCK_LENGTH = exports.UTRIE2_INDEX_2_BLOCK_LENGTH = 1 << UTRIE2_SHIFT_1_2;
    /** Mask for getting the lower bits for the in-index-2-block offset. */
    var UTRIE2_INDEX_2_MASK = exports.UTRIE2_INDEX_2_MASK = UTRIE2_INDEX_2_BLOCK_LENGTH - 1;

    var createTrieFromBase64 = exports.createTrieFromBase64 = function createTrieFromBase64(base64) {
        var buffer = (0, Util$2.decode)(base64);
        var view32 = Array.isArray(buffer) ? (0, Util$2.polyUint32Array)(buffer) : new Uint32Array(buffer);
        var view16 = Array.isArray(buffer) ? (0, Util$2.polyUint16Array)(buffer) : new Uint16Array(buffer);
        var headerLength = 24;

        var index = view16.slice(headerLength / 2, view32[4] / 2);
        var data = view32[5] === 2 ? view16.slice((headerLength + view32[4]) / 2) : view32.slice(Math.ceil((headerLength + view32[4]) / 4));

        return new Trie(view32[0], view32[1], view32[2], view32[3], index, data);
    };

    var Trie = exports.Trie = function () {
        function Trie(initialValue, errorValue, highStart, highValueIndex, index, data) {
            _classCallCheck(this, Trie);

            this.initialValue = initialValue;
            this.errorValue = errorValue;
            this.highStart = highStart;
            this.highValueIndex = highValueIndex;
            this.index = index;
            this.data = data;
        }

        /**
         * Get the value for a code point as stored in the Trie.
         *
         * @param codePoint the code point
         * @return the value
         */


        _createClass(Trie, [{
            key: 'get',
            value: function get(codePoint) {
                var ix = void 0;
                if (codePoint >= 0) {
                    if (codePoint < 0x0d800 || codePoint > 0x0dbff && codePoint <= 0x0ffff) {
                        // Ordinary BMP code point, excluding leading surrogates.
                        // BMP uses a single level lookup.  BMP index starts at offset 0 in the Trie2 index.
                        // 16 bit data is stored in the index array itself.
                        ix = this.index[codePoint >> UTRIE2_SHIFT_2];
                        ix = (ix << UTRIE2_INDEX_SHIFT) + (codePoint & UTRIE2_DATA_MASK);
                        return this.data[ix];
                    }

                    if (codePoint <= 0xffff) {
                        // Lead Surrogate Code Point.  A Separate index section is stored for
                        // lead surrogate code units and code points.
                        //   The main index has the code unit data.
                        //   For this function, we need the code point data.
                        // Note: this expression could be refactored for slightly improved efficiency, but
                        //       surrogate code points will be so rare in practice that it's not worth it.
                        ix = this.index[UTRIE2_LSCP_INDEX_2_OFFSET + (codePoint - 0xd800 >> UTRIE2_SHIFT_2)];
                        ix = (ix << UTRIE2_INDEX_SHIFT) + (codePoint & UTRIE2_DATA_MASK);
                        return this.data[ix];
                    }

                    if (codePoint < this.highStart) {
                        // Supplemental code point, use two-level lookup.
                        ix = UTRIE2_INDEX_1_OFFSET - UTRIE2_OMITTED_BMP_INDEX_1_LENGTH + (codePoint >> UTRIE2_SHIFT_1);
                        ix = this.index[ix];
                        ix += codePoint >> UTRIE2_SHIFT_2 & UTRIE2_INDEX_2_MASK;
                        ix = this.index[ix];
                        ix = (ix << UTRIE2_INDEX_SHIFT) + (codePoint & UTRIE2_DATA_MASK);
                        return this.data[ix];
                    }
                    if (codePoint <= 0x10ffff) {
                        return this.data[this.highValueIndex];
                    }
                }

                // Fall through.  The code point is outside of the legal range of 0..0x10ffff.
                return this.errorValue;
            }
        }]);

        return Trie;
    }();
    });

    unwrapExports(Trie_1);
    var Trie_2 = Trie_1.Trie;
    var Trie_3 = Trie_1.createTrieFromBase64;
    var Trie_4 = Trie_1.UTRIE2_INDEX_2_MASK;
    var Trie_5 = Trie_1.UTRIE2_INDEX_2_BLOCK_LENGTH;
    var Trie_6 = Trie_1.UTRIE2_OMITTED_BMP_INDEX_1_LENGTH;
    var Trie_7 = Trie_1.UTRIE2_INDEX_1_OFFSET;
    var Trie_8 = Trie_1.UTRIE2_UTF8_2B_INDEX_2_LENGTH;
    var Trie_9 = Trie_1.UTRIE2_UTF8_2B_INDEX_2_OFFSET;
    var Trie_10 = Trie_1.UTRIE2_INDEX_2_BMP_LENGTH;
    var Trie_11 = Trie_1.UTRIE2_LSCP_INDEX_2_LENGTH;
    var Trie_12 = Trie_1.UTRIE2_DATA_MASK;
    var Trie_13 = Trie_1.UTRIE2_DATA_BLOCK_LENGTH;
    var Trie_14 = Trie_1.UTRIE2_LSCP_INDEX_2_OFFSET;
    var Trie_15 = Trie_1.UTRIE2_SHIFT_1_2;
    var Trie_16 = Trie_1.UTRIE2_INDEX_SHIFT;
    var Trie_17 = Trie_1.UTRIE2_SHIFT_1;
    var Trie_18 = Trie_1.UTRIE2_SHIFT_2;

    var linebreakTrie = 'KwAAAAAAAAAACA4AIDoAAPAfAAACAAAAAAAIABAAGABAAEgAUABYAF4AZgBeAGYAYABoAHAAeABeAGYAfACEAIAAiACQAJgAoACoAK0AtQC9AMUAXgBmAF4AZgBeAGYAzQDVAF4AZgDRANkA3gDmAOwA9AD8AAQBDAEUARoBIgGAAIgAJwEvATcBPwFFAU0BTAFUAVwBZAFsAXMBewGDATAAiwGTAZsBogGkAawBtAG8AcIBygHSAdoB4AHoAfAB+AH+AQYCDgIWAv4BHgImAi4CNgI+AkUCTQJTAlsCYwJrAnECeQKBAk0CiQKRApkCoQKoArACuALAAsQCzAIwANQC3ALkAjAA7AL0AvwCAQMJAxADGAMwACADJgMuAzYDPgOAAEYDSgNSA1IDUgNaA1oDYANiA2IDgACAAGoDgAByA3YDfgOAAIQDgACKA5IDmgOAAIAAogOqA4AAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAK8DtwOAAIAAvwPHA88D1wPfAyAD5wPsA/QD/AOAAIAABAQMBBIEgAAWBB4EJgQuBDMEIAM7BEEEXgBJBCADUQRZBGEEaQQwADAAcQQ+AXkEgQSJBJEEgACYBIAAoASoBK8EtwQwAL8ExQSAAIAAgACAAIAAgACgAM0EXgBeAF4AXgBeAF4AXgBeANUEXgDZBOEEXgDpBPEE+QQBBQkFEQUZBSEFKQUxBTUFPQVFBUwFVAVcBV4AYwVeAGsFcwV7BYMFiwWSBV4AmgWgBacFXgBeAF4AXgBeAKsFXgCyBbEFugW7BcIFwgXIBcIFwgXQBdQF3AXkBesF8wX7BQMGCwYTBhsGIwYrBjMGOwZeAD8GRwZNBl4AVAZbBl4AXgBeAF4AXgBeAF4AXgBeAF4AXgBeAGMGXgBqBnEGXgBeAF4AXgBeAF4AXgBeAF4AXgB5BoAG4wSGBo4GkwaAAIADHgR5AF4AXgBeAJsGgABGA4AAowarBrMGswagALsGwwbLBjAA0wbaBtoG3QbaBtoG2gbaBtoG2gblBusG8wb7BgMHCwcTBxsHCwcjBysHMAc1BzUHOgdCB9oGSgdSB1oHYAfaBloHaAfaBlIH2gbaBtoG2gbaBtoG2gbaBjUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHbQdeAF4ANQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQd1B30HNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B4MH2gaKB68EgACAAIAAgACAAIAAgACAAI8HlwdeAJ8HpweAAIAArwe3B14AXgC/B8UHygcwANAH2AfgB4AA6AfwBz4B+AcACFwBCAgPCBcIogEYAR8IJwiAAC8INwg/CCADRwhPCFcIXwhnCEoDGgSAAIAAgABvCHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIhAiLCI4IMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlggwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAANQc1BzUHNQc1BzUHNQc1BzUHNQc1B54INQc1B6II2gaqCLIIugiAAIAAvgjGCIAAgACAAIAAgACAAIAAgACAAIAAywiHAYAA0wiAANkI3QjlCO0I9Aj8CIAAgACAAAIJCgkSCRoJIgknCTYHLwk3CZYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiAAIAAAAFAAXgBeAGAAcABeAHwAQACQAKAArQC9AJ4AXgBeAE0A3gBRAN4A7AD8AMwBGgEAAKcBNwEFAUwBXAF4QkhCmEKnArcCgAHHAsABz4LAAcABwAHAAd+C6ABoAG+C/4LAAcABwAHAAc+DF4MAAcAB54M3gweDV4Nng3eDaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAEeDqABVg6WDqABoQ6gAaABoAHXDvcONw/3DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DncPAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcAB7cPPwlGCU4JMACAAIAAgABWCV4JYQmAAGkJcAl4CXwJgAkwADAAMAAwAIgJgACLCZMJgACZCZ8JowmrCYAAswkwAF4AXgB8AIAAuwkABMMJyQmAAM4JgADVCTAAMAAwADAAgACAAIAAgACAAIAAgACAAIAAqwYWBNkIMAAwADAAMADdCeAJ6AnuCR4E9gkwAP4JBQoNCjAAMACAABUK0wiAAB0KJAosCjQKgAAwADwKQwqAAEsKvQmdCVMKWwowADAAgACAALcEMACAAGMKgABrCjAAMAAwADAAMAAwADAAMAAwADAAMAAeBDAAMAAwADAAMAAwADAAMAAwADAAMAAwAIkEPQFzCnoKiQSCCooKkAqJBJgKoAqkCokEGAGsCrQKvArBCjAAMADJCtEKFQHZCuEK/gHpCvEKMAAwADAAMACAAIwE+QowAIAAPwEBCzAAMAAwADAAMACAAAkLEQswAIAAPwEZCyELgAAOCCkLMAAxCzkLMAAwADAAMAAwADAAXgBeAEELMAAwADAAMAAwADAAMAAwAEkLTQtVC4AAXAtkC4AAiQkwADAAMAAwADAAMAAwADAAbAtxC3kLgAuFC4sLMAAwAJMLlwufCzAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAApwswADAAMACAAIAAgACvC4AAgACAAIAAgACAALcLMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAvwuAAMcLgACAAIAAgACAAIAAyguAAIAAgACAAIAA0QswADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAANkLgACAAIAA4AswADAAMAAwADAAMAAwADAAMAAwADAAMAAwAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACJCR4E6AswADAAhwHwC4AA+AsADAgMEAwwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMACAAIAAGAwdDCUMMAAwAC0MNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQw1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHPQwwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADUHNQc1BzUHNQc1BzUHNQc2BzAAMAA5DDUHNQc1BzUHNQc1BzUHNQc1BzUHNQdFDDAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAgACAAIAATQxSDFoMMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAF4AXgBeAF4AXgBeAF4AYgxeAGoMXgBxDHkMfwxeAIUMXgBeAI0MMAAwADAAMAAwAF4AXgCVDJ0MMAAwADAAMABeAF4ApQxeAKsMswy7DF4Awgy9DMoMXgBeAF4AXgBeAF4AXgBeAF4AXgDRDNkMeQBqCeAM3Ax8AOYM7Az0DPgMXgBeAF4AXgBeAF4AXgBeAF4AXgBeAF4AXgBeAF4AXgCgAAANoAAHDQ4NFg0wADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAeDSYNMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAIAAgACAAIAAgACAAC4NMABeAF4ANg0wADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAD4NRg1ODVYNXg1mDTAAbQ0wADAAMAAwADAAMAAwADAA2gbaBtoG2gbaBtoG2gbaBnUNeg3CBYANwgWFDdoGjA3aBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gaUDZwNpA2oDdoG2gawDbcNvw3HDdoG2gbPDdYN3A3fDeYN2gbsDfMN2gbaBvoN/g3aBgYODg7aBl4AXgBeABYOXgBeACUG2gYeDl4AJA5eACwO2w3aBtoGMQ45DtoG2gbaBtoGQQ7aBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gZJDjUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B1EO2gY1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQdZDjUHNQc1BzUHNQc1B2EONQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHaA41BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B3AO2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gY1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B2EO2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gZJDtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBkkOeA6gAKAAoAAwADAAMAAwAKAAoACgAKAAoACgAKAAgA4wADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAD//wQABAAEAAQABAAEAAQABAAEAA0AAwABAAEAAgAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAKABMAFwAeABsAGgAeABcAFgASAB4AGwAYAA8AGAAcAEsASwBLAEsASwBLAEsASwBLAEsAGAAYAB4AHgAeABMAHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAFgAbABIAHgAeAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQABYADQARAB4ABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAUABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAkAFgAaABsAGwAbAB4AHQAdAB4ATwAXAB4ADQAeAB4AGgAbAE8ATwAOAFAAHQAdAB0ATwBPABcATwBPAE8AFgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAB4AHgAeAB4AUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AHgAeAFAATwBAAE8ATwBPAEAATwBQAFAATwBQAB4AHgAeAB4AHgAeAB0AHQAdAB0AHgAdAB4ADgBQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgBQAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAJAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAkACQAJAAkACQAJAAkABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAeAB4AHgAeAFAAHgAeAB4AKwArAFAAUABQAFAAGABQACsAKwArACsAHgAeAFAAHgBQAFAAUAArAFAAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAAQABAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAUAAeAB4AHgAeAB4AHgArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwAYAA0AKwArAB4AHgAbACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQADQAEAB4ABAAEAB4ABAAEABMABAArACsAKwArACsAKwArACsAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAKwArACsAKwArAFYAVgBWAB4AHgArACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AGgAaABoAGAAYAB4AHgAEAAQABAAEAAQABAAEAAQABAAEAAQAEwAEACsAEwATAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABLAEsASwBLAEsASwBLAEsASwBLABoAGQAZAB4AUABQAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQABMAUAAEAAQABAAEAAQABAAEAB4AHgAEAAQABAAEAAQABABQAFAABAAEAB4ABAAEAAQABABQAFAASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUAAeAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAFAABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQAUABQAB4AHgAYABMAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAFAABAAEAAQABAAEAFAABAAEAAQAUAAEAAQABAAEAAQAKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAArACsAHgArAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAeAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAFAABAAEAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAAQABAANAA0ASwBLAEsASwBLAEsASwBLAEsASwAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQAKwBQAFAAUABQAFAAUABQAFAAKwArAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAKwArACsAUABQAFAAUAArACsABABQAAQABAAEAAQABAAEAAQAKwArAAQABAArACsABAAEAAQAUAArACsAKwArACsAKwArACsABAArACsAKwArAFAAUAArAFAAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwBQAFAAGgAaAFAAUABQAFAAUABMAB4AGwBQAB4AKwArACsABAAEAAQAKwBQAFAAUABQAFAAUAArACsAKwArAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAUAArAFAAUAArAFAAUAArACsABAArAAQABAAEAAQABAArACsAKwArAAQABAArACsABAAEAAQAKwArACsABAArACsAKwArACsAKwArAFAAUABQAFAAKwBQACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwAEAAQAUABQAFAABAArACsAKwArACsAKwArACsAKwArACsABAAEAAQAKwBQAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAUAArAFAAUABQAFAAUAArACsABABQAAQABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQAKwArAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwAeABsAKwArACsAKwArACsAKwBQAAQABAAEAAQABAAEACsABAAEAAQAKwBQAFAAUABQAFAAUABQAFAAKwArAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQAKwArAAQABAArACsABAAEAAQAKwArACsAKwArACsAKwArAAQABAArACsAKwArAFAAUAArAFAAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwAeAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwAEAFAAKwBQAFAAUABQAFAAUAArACsAKwBQAFAAUAArAFAAUABQAFAAKwArACsAUABQACsAUAArAFAAUAArACsAKwBQAFAAKwArACsAUABQAFAAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwAEAAQABAAEAAQAKwArACsABAAEAAQAKwAEAAQABAAEACsAKwBQACsAKwArACsAKwArAAQAKwArACsAKwArACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLAFAAUABQAB4AHgAeAB4AHgAeABsAHgArACsAKwArACsABAAEAAQABAArAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAFAABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQABAArACsAKwArACsAKwArAAQABAArAFAAUABQACsAKwArACsAKwBQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAB4AUAAEAAQABAArAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQACsAKwAEAFAABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQABAArACsAKwArACsAKwArAAQABAArACsAKwArACsAKwArAFAAKwBQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAFAABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQABABQAB4AKwArACsAKwBQAFAAUAAEAFAAUABQAFAAUABQAFAAUABQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLAFAAUABQAFAAUABQAFAAUABQABoAUABQAFAAUABQAFAAKwArAAQABAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQACsAUAArACsAUABQAFAAUABQAFAAUAArACsAKwAEACsAKwArACsABAAEAAQABAAEAAQAKwAEACsABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArAAQABAAeACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAAqAFwAXAAqACoAKgAqACoAKgAqACsAKwArACsAGwBcAFwAXABcAFwAXABcACoAKgAqACoAKgAqACoAKgAeAEsASwBLAEsASwBLAEsASwBLAEsADQANACsAKwArACsAKwBcAFwAKwBcACsAKwBcAFwAKwBcACsAKwBcACsAKwArACsAKwArAFwAXABcAFwAKwBcAFwAXABcAFwAXABcACsAXABcAFwAKwBcACsAXAArACsAXABcACsAXABcAFwAXAAqAFwAXAAqACoAKgAqACoAKgArACoAKgBcACsAKwBcAFwAXABcAFwAKwBcACsAKgAqACoAKgAqACoAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArAFwAXABcAFwAUAAOAA4ADgAOAB4ADgAOAAkADgAOAA0ACQATABMAEwATABMACQAeABMAHgAeAB4ABAAEAB4AHgAeAB4AHgAeAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAUABQAFAAUABQAFAAUAANAAQAHgAEAB4ABAAWABEAFgARAAQABABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAANAAQABAAEAAQABAANAAQABABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsADQANAB4AHgAeAB4AHgAeAAQAHgAeAB4AHgAeAB4AKwAeAB4ADgAOAA0ADgAeAB4AHgAeAB4ACQAJACsAKwArACsAKwBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqAFwASwBLAEsASwBLAEsASwBLAEsASwANAA0AHgAeAB4AHgBcAFwAXABcAFwAXAAqACoAKgAqAFwAXABcAFwAKgAqACoAXAAqACoAKgBcAFwAKgAqACoAKgAqACoAKgBcAFwAXAAqACoAKgAqAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAKgAqACoAKgAqACoAKgAqACoAXAAqAEsASwBLAEsASwBLAEsASwBLAEsAKgAqACoAKgAqACoAUABQAFAAUABQAFAAKwBQACsAKwArACsAKwBQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAFAAUABQAFAAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQACsAKwBQAFAAUABQAFAAUABQACsAUAArAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUAArACsAUABQAFAAUABQAFAAUAArAFAAKwBQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwAEAAQABAAeAA0AHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQACsAKwANAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQABYAEQArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAADQANAA0AUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAABAAEAAQAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAA0ADQArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsABAAEACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoADQANABUAXAANAB4ADQAbAFwAKgArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArAB4AHgATABMADQANAA4AHgATABMAHgAEAAQABAAJACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAUABQAFAAUABQAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABABQACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwAeACsAKwArABMAEwBLAEsASwBLAEsASwBLAEsASwBLAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcACsAKwBcAFwAXABcAFwAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcACsAKwArACsAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwBcACsAKwArACoAKgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEACsAKwAeAB4AXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAKgAqACoAKgAqACoAKgArACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgArACsABABLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAKgAqACoAKgAqACoAKgBcACoAKgAqACoAKgAqACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQAUABQAFAAUABQAFAAUAArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsADQANAB4ADQANAA0ADQAeAB4AHgAeAB4AHgAeAB4AHgAeAAQABAAEAAQABAAEAAQABAAEAB4AHgAeAB4AHgAeAB4AHgAeACsAKwArAAQABAAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAUABQAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArACsAKwArACsAHgAeAB4AHgBQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwANAA0ADQANAA0ASwBLAEsASwBLAEsASwBLAEsASwArACsAKwBQAFAAUABLAEsASwBLAEsASwBLAEsASwBLAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAANAA0AUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsABAAEAAQAHgAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAFAAUABQAFAABABQAFAAUABQAAQABAAEAFAAUAAEAAQABAArACsAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwAEAAQABAAEAAQAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUAArAFAAKwBQACsAUAArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAHgAeAB4AHgAeAB4AHgAeAFAAHgAeAB4AUABQAFAAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAKwArAB4AHgAeAB4AHgAeACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAUABQAFAAKwAeAB4AHgAeAB4AHgAeAA4AHgArAA0ADQANAA0ADQANAA0ACQANAA0ADQAIAAQACwAEAAQADQAJAA0ADQAMAB0AHQAeABcAFwAWABcAFwAXABYAFwAdAB0AHgAeABQAFAAUAA0AAQABAAQABAAEAAQABAAJABoAGgAaABoAGgAaABoAGgAeABcAFwAdABUAFQAeAB4AHgAeAB4AHgAYABYAEQAVABUAFQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgANAB4ADQANAA0ADQAeAA0ADQANAAcAHgAeAB4AHgArAAQABAAEAAQABAAEAAQABAAEAAQAUABQACsAKwBPAFAAUABQAFAAUAAeAB4AHgAWABEATwBQAE8ATwBPAE8AUABQAFAAUABQAB4AHgAeABYAEQArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAGwAbABsAGwAbABsAGwAaABsAGwAbABsAGwAbABsAGwAbABsAGwAbABsAGwAaABsAGwAbABsAGgAbABsAGgAbABsAGwAbABsAGwAbABsAGwAbABsAGwAbABsAGwAbABsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgBQABoAHgAdAB4AUAAeABoAHgAeAB4AHgAeAB4AHgAeAB4ATwAeAFAAGwAeAB4AUABQAFAAUABQAB4AHgAeAB0AHQAeAFAAHgBQAB4AUAAeAFAATwBQAFAAHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAB4AUABQAFAAUABPAE8AUABQAFAAUABQAE8AUABQAE8AUABPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBQAFAAUABQAE8ATwBPAE8ATwBPAE8ATwBPAE8AUABQAFAAUABQAFAAUABQAFAAHgAeAFAAUABQAFAATwAeAB4AKwArACsAKwAdAB0AHQAdAB0AHQAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAeAB0AHQAeAB4AHgAdAB0AHgAeAB0AHgAeAB4AHQAeAB0AGwAbAB4AHQAeAB4AHgAeAB0AHgAeAB0AHQAdAB0AHgAeAB0AHgAdAB4AHQAdAB0AHQAdAB0AHgAdAB4AHgAeAB4AHgAdAB0AHQAdAB4AHgAeAB4AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAeAB4AHgAdAB4AHgAeAB4AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB4AHgAdAB0AHQAdAB4AHgAdAB0AHgAeAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB0AHgAeAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AHQAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABQAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAWABEAFgARAB4AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAlACUAHgAeAB4AHgAeAB4AHgAeAB4AFgARAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBQAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB4AHgAeAB4AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeAB0AHQAdAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB0AHgAdAB0AHQAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAdAB0AHgAeAB0AHQAeAB4AHgAeAB0AHQAeAB4AHgAeAB0AHQAdAB4AHgAdAB4AHgAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAeAB0AHQAeAB4AHQAeAB4AHgAeAB0AHQAeAB4AHgAeACUAJQAdAB0AJQAeACUAJQAlACAAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAHgAeAB4AHgAdAB4AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB4AHQAdAB0AHgAdACUAHQAdAB4AHQAdAB4AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAHQAdAB0AHQAlAB4AJQAlACUAHQAlACUAHQAdAB0AJQAlAB0AHQAlAB0AHQAlACUAJQAeAB0AHgAeAB4AHgAdAB0AJQAdAB0AHQAdAB0AHQAlACUAJQAlACUAHQAlACUAIAAlAB0AHQAlACUAJQAlACUAJQAlACUAHgAeAB4AJQAlACAAIAAgACAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHgAeABcAFwAXABcAFwAXAB4AEwATACUAHgAeAB4AFgARABYAEQAWABEAFgARABYAEQAWABEAFgARAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAWABEAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFgARABYAEQAWABEAFgARABYAEQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABYAEQAWABEAFgARABYAEQAWABEAFgARABYAEQAWABEAFgARABYAEQAWABEAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFgARABYAEQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABYAEQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAEAAQABAAeAB4AKwArACsAKwArABMADQANAA0AUAATAA0AUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAUAANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAA0ADQANAA0ADQANAA0ADQAeAA0AFgANAB4AHgAXABcAHgAeABcAFwAWABEAFgARABYAEQAWABEADQANAA0ADQATAFAADQANAB4ADQANAB4AHgAeAB4AHgAMAAwADQANAA0AHgANAA0AFgANAA0ADQANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAKwArACsAKwArACsAKwArACsAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArAA0AEQARACUAJQBHAFcAVwAWABEAFgARABYAEQAWABEAFgARACUAJQAWABEAFgARABYAEQAWABEAFQAWABEAEQAlAFcAVwBXAFcAVwBXAFcAVwBXAAQABAAEAAQABAAEACUAVwBXAFcAVwA2ACUAJQBXAFcAVwBHAEcAJQAlACUAKwBRAFcAUQBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFEAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBRAFcAUQBXAFEAVwBXAFcAVwBXAFcAUQBXAFcAVwBXAFcAVwBRAFEAKwArAAQABAAVABUARwBHAFcAFQBRAFcAUQBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBRAFcAVwBXAFcAVwBXAFEAUQBXAFcAVwBXABUAUQBHAEcAVwArACsAKwArACsAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwArACUAJQBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArACsAKwArACUAJQAlACUAKwArACsAKwArACsAKwArACsAKwArACsAUQBRAFEAUQBRAFEAUQBRAFEAUQBRAFEAUQBRAFEAUQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACsAVwBXAFcAVwBXAFcAVwBXAFcAVwAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAE8ATwBPAE8ATwBPAE8ATwAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAEcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAADQATAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABLAEsASwBLAEsASwBLAEsASwBLAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAABAAEAAQABAAeAAQABAAEAAQABAAEAAQABAAEAAQAHgBQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AUABQAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAeAA0ADQANAA0ADQArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAB4AHgAeAB4AHgAeAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAAQAUABQAFAABABQAFAAUABQAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAeAB4AHgAeACsAKwArACsAUABQAFAAUABQAFAAHgAeABoAHgArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAADgAOABMAEwArACsAKwArACsAKwArACsABAAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwANAA0ASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAFAAUAAeAB4AHgBQAA4AUAArACsAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAA0ADQBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwArACsAKwArACsAKwArAB4AWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYACsAKwArAAQAHgAeAB4AHgAeAB4ADQANAA0AHgAeAB4AHgArAFAASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArAB4AHgBcAFwAXABcAFwAKgBcAFwAXABcAFwAXABcAFwAXABcAEsASwBLAEsASwBLAEsASwBLAEsAXABcAFwAXABcACsAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArAFAAUABQAAQAUABQAFAAUABQAFAAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAHgANAA0ADQBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAXAAqACoAKgBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAAqAFwAKgAqACoAXABcACoAKgBcAFwAXABcAFwAKgAqAFwAKgBcACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcACoAKgBQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAA0ADQBQAFAAUAAEAAQAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUAArACsAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQADQAEAAQAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAVABVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBUAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVACsAKwArACsAKwArACsAKwArACsAKwArAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAKwArACsAKwBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAKwArACsAKwAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAKwArACsAKwArAFYABABWAFYAVgBWAFYAVgBWAFYAVgBWAB4AVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgArAFYAVgBWAFYAVgArAFYAKwBWAFYAKwBWAFYAKwBWAFYAVgBWAFYAVgBWAFYAVgBWAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAEQAWAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUAAaAB4AKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAGAARABEAGAAYABMAEwAWABEAFAArACsAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACUAJQAlACUAJQAWABEAFgARABYAEQAWABEAFgARABYAEQAlACUAFgARACUAJQAlACUAJQAlACUAEQAlABEAKwAVABUAEwATACUAFgARABYAEQAWABEAJQAlACUAJQAlACUAJQAlACsAJQAbABoAJQArACsAKwArAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAcAKwATACUAJQAbABoAJQAlABYAEQAlACUAEQAlABEAJQBXAFcAVwBXAFcAVwBXAFcAVwBXABUAFQAlACUAJQATACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXABYAJQARACUAJQAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwAWACUAEQAlABYAEQARABYAEQARABUAVwBRAFEAUQBRAFEAUQBRAFEAUQBRAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAEcARwArACsAVwBXAFcAVwBXAFcAKwArAFcAVwBXAFcAVwBXACsAKwBXAFcAVwBXAFcAVwArACsAVwBXAFcAKwArACsAGgAbACUAJQAlABsAGwArAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwAEAAQABAAQAB0AKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsADQANAA0AKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAFAAHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsADQBQAFAAUABQACsAKwArACsAUABQAFAAUABQAFAAUABQAA0AUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUAArACsAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQACsAKwArAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AHgBQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsADQBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwBQAFAAUABQAFAABAAEAAQAKwAEAAQAKwArACsAKwArAAQABAAEAAQAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsABAAEAAQAKwArACsAKwAEAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsADQANAA0ADQANAA0ADQANAB4AKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AUABQAFAAUABQAFAAUABQAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEACsAKwArACsAUABQAFAAUABQAA0ADQANAA0ADQANABQAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwANAA0ADQANAA0ADQANAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwBQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAA0ADQAeAB4AHgAeAB4AKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAeAB4AHgANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsASwBLAEsASwBLAEsASwBLAEsASwANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAeAA4AUAArACsAKwArACsAKwArACsAKwAEAFAAUABQAFAADQANAB4ADQAeAAQABAAEAB4AKwArAEsASwBLAEsASwBLAEsASwBLAEsAUAAOAFAADQANAA0AKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAANAA0AHgANAA0AHgAEACsAUABQAFAAUABQAFAAUAArAFAAKwBQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAA0AKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsABAAEAAQABAArAFAAUABQAFAAUABQAFAAUAArACsAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAArACsABAAEACsAKwAEAAQABAArACsAUAArACsAKwArACsAKwAEACsAKwArACsAKwBQAFAAUABQAFAABAAEACsAKwAEAAQABAAEAAQABAAEACsAKwArAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAQABABQAFAAUABQAA0ADQANAA0AHgBLAEsASwBLAEsASwBLAEsASwBLACsADQArAB4AKwArAAQABAAEAAQAUABQAB4AUAArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEACsAKwAEAAQABAAEAAQABAAEAAQABAAOAA0ADQATABMAHgAeAB4ADQANAA0ADQANAA0ADQANAA0ADQANAA0ADQANAA0AUABQAFAAUAAEAAQAKwArAAQADQANAB4AUAArACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAArACsAKwAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAXABcAA0ADQANACoASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwBQAFAABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAFAABAAEAAQABAAOAB4ADQANAA0ADQAOAB4ABAArACsAKwArACsAKwArACsAUAAEAAQABAAEAAQABAAEAAQABAAEAAQAUABQAFAAUAArACsAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAA0ADQANACsADgAOAA4ADQANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEACsABAAEAAQABAAEAAQABAAEAFAADQANAA0ADQANACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwAOABMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQACsAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAArACsAKwAEACsABAAEACsABAAEAAQABAAEAAQABABQAAQAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsADQANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAASABIAEgAQwBDAEMAUABQAFAAUABDAFAAUABQAEgAQwBIAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAASABDAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABIAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwANAA0AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAQABAAEAAQABAANACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAA0ADQANAB4AHgAeAB4AHgAeAFAAUABQAFAADQAeACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAEcARwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwArACsAKwArACsAKwArACsAKwArACsAKwArAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQACsAKwAeAAQABAANAAQABAAEAAQAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAB4AHgAeAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAHgAeAAQABAAEAAQABAAEAAQAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAEAAQABAAEAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAEAAQABAAeACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAFAAUAArACsAUAArACsAUABQACsAKwBQAFAAUABQACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwBQACsAUABQAFAAUABQAFAAUAArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAKwAeAB4AUABQAFAAUABQACsAUAArACsAKwBQAFAAUABQAFAAUABQACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AKwArAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAB4AHgAeAB4ABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAB4AHgAeAB4AHgAeAB4AHgAEAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAeAB4ADQANAA0ADQAeACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQABAAEAAQABAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAQABAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsABAAEAAQABAAEAAQABAArAAQABAArAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAEAAQABAAEAAQABAAEACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAFgAWAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUAArAFAAKwArAFAAKwBQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUAArAFAAKwBQACsAKwArACsAKwArAFAAKwArACsAKwBQACsAUAArAFAAKwBQAFAAUAArAFAAUAArAFAAKwArAFAAKwBQACsAUAArAFAAKwBQACsAUABQACsAUAArACsAUABQAFAAUAArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQACsAUABQAFAAUAArAFAAKwBQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwBQAFAAUAArAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArACsATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwAlACUAJQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAeACUAHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeACUAJQAlACUAHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQAlACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAHgAeACUAJQAlACUAJQAeACUAJQAlACUAJQAgACAAIAAlACUAIAAlACUAIAAgACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIQAhACEAIQAhACUAJQAgACAAJQAlACAAIAAgACAAIAAgACAAIAAgACAAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAgACAAIAAlACUAJQAlACAAJQAgACAAIAAgACAAIAAgACAAIAAlACUAJQAgACUAJQAlACUAIAAgACAAJQAgACAAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeACUAHgAlAB4AJQAlACUAJQAlACAAJQAlACUAJQAeACUAHgAeACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAHgAeAB4AHgAeAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAgACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAlACUAJQAlACAAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAIAAgACAAJQAlACUAIAAgACAAIAAgAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFwAXABcAFQAVABUAHgAeAB4AHgAlACUAJQAgACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAgACAAJQAlACUAJQAlACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAlACUAJQAlACAAIAAgACAAIAAlACAAIAAlACUAJQAlACUAJQAgACUAJQAlACUAJQAlACUAJQAlACAAIAAgACAAIAAgACAAIAAgACAAJQAlACUAIAAgACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACsAKwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAJQAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArAAQAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsA';

    var LineBreak = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.LineBreaker = exports.inlineBreakOpportunities = exports.lineBreakAtIndex = exports.codePointsToCharacterClasses = exports.UnicodeTrie = exports.BREAK_ALLOWED = exports.BREAK_NOT_ALLOWED = exports.BREAK_MANDATORY = exports.classes = exports.LETTER_NUMBER_MODIFIER = undefined;

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

    var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();





    var _linebreakTrie2 = _interopRequireDefault(linebreakTrie);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var LETTER_NUMBER_MODIFIER = exports.LETTER_NUMBER_MODIFIER = 50;

    // Non-tailorable Line Breaking Classes
    var BK = 1; //  Cause a line break (after)
    var CR = 2; //  Cause a line break (after), except between CR and LF
    var LF = 3; //  Cause a line break (after)
    var CM = 4; //  Prohibit a line break between the character and the preceding character
    var NL = 5; //  Cause a line break (after)
    var SG = 6; //  Do not occur in well-formed text
    var WJ = 7; //  Prohibit line breaks before and after
    var ZW = 8; //  Provide a break opportunity
    var GL = 9; //  Prohibit line breaks before and after
    var SP = 10; // Enable indirect line breaks
    var ZWJ = 11; // Prohibit line breaks within joiner sequences
    // Break Opportunities
    var B2 = 12; //  Provide a line break opportunity before and after the character
    var BA = 13; //  Generally provide a line break opportunity after the character
    var BB = 14; //  Generally provide a line break opportunity before the character
    var HY = 15; //  Provide a line break opportunity after the character, except in numeric context
    var CB = 16; //   Provide a line break opportunity contingent on additional information
    // Characters Prohibiting Certain Breaks
    var CL = 17; //  Prohibit line breaks before
    var CP = 18; //  Prohibit line breaks before
    var EX = 19; //  Prohibit line breaks before
    var IN = 20; //  Allow only indirect line breaks between pairs
    var NS = 21; //  Allow only indirect line breaks before
    var OP = 22; //  Prohibit line breaks after
    var QU = 23; //  Act like they are both opening and closing
    // Numeric Context
    var IS = 24; //  Prevent breaks after any and before numeric
    var NU = 25; //  Form numeric expressions for line breaking purposes
    var PO = 26; //  Do not break following a numeric expression
    var PR = 27; //  Do not break in front of a numeric expression
    var SY = 28; //  Prevent a break before; and allow a break after
    // Other Characters
    var AI = 29; //  Act like AL when the resolvedEAW is N; otherwise; act as ID
    var AL = 30; //  Are alphabetic characters or symbols that are used with alphabetic characters
    var CJ = 31; //  Treat as NS or ID for strict or normal breaking.
    var EB = 32; //  Do not break from following Emoji Modifier
    var EM = 33; //  Do not break from preceding Emoji Base
    var H2 = 34; //  Form Korean syllable blocks
    var H3 = 35; //  Form Korean syllable blocks
    var HL = 36; //  Do not break around a following hyphen; otherwise act as Alphabetic
    var ID = 37; //  Break before or after; except in some numeric context
    var JL = 38; //  Form Korean syllable blocks
    var JV = 39; //  Form Korean syllable blocks
    var JT = 40; //  Form Korean syllable blocks
    var RI = 41; //  Keep pairs together. For pairs; break before and after other classes
    var SA = 42; //  Provide a line break opportunity contingent on additional, language-specific context analysis
    var XX = 43; //  Have as yet unknown line breaking behavior or unassigned code positions

    var classes = exports.classes = {
        BK: BK,
        CR: CR,
        LF: LF,
        CM: CM,
        NL: NL,
        SG: SG,
        WJ: WJ,
        ZW: ZW,
        GL: GL,
        SP: SP,
        ZWJ: ZWJ,
        B2: B2,
        BA: BA,
        BB: BB,
        HY: HY,
        CB: CB,
        CL: CL,
        CP: CP,
        EX: EX,
        IN: IN,
        NS: NS,
        OP: OP,
        QU: QU,
        IS: IS,
        NU: NU,
        PO: PO,
        PR: PR,
        SY: SY,
        AI: AI,
        AL: AL,
        CJ: CJ,
        EB: EB,
        EM: EM,
        H2: H2,
        H3: H3,
        HL: HL,
        ID: ID,
        JL: JL,
        JV: JV,
        JT: JT,
        RI: RI,
        SA: SA,
        XX: XX
    };

    var BREAK_MANDATORY = exports.BREAK_MANDATORY = '!';
    var BREAK_NOT_ALLOWED = exports.BREAK_NOT_ALLOWED = '×';
    var BREAK_ALLOWED = exports.BREAK_ALLOWED = '÷';
    var UnicodeTrie = exports.UnicodeTrie = (0, Trie_1.createTrieFromBase64)(_linebreakTrie2.default);

    var ALPHABETICS = [AL, HL];
    var HARD_LINE_BREAKS = [BK, CR, LF, NL];
    var SPACE = [SP, ZW];
    var PREFIX_POSTFIX = [PR, PO];
    var LINE_BREAKS = HARD_LINE_BREAKS.concat(SPACE);
    var KOREAN_SYLLABLE_BLOCK = [JL, JV, JT, H2, H3];
    var HYPHEN = [HY, BA];

    var codePointsToCharacterClasses = exports.codePointsToCharacterClasses = function codePointsToCharacterClasses(codePoints) {
        var lineBreak = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'strict';

        var types = [];
        var indicies = [];
        var categories = [];
        codePoints.forEach(function (codePoint, index) {
            var classType = UnicodeTrie.get(codePoint);
            if (classType > LETTER_NUMBER_MODIFIER) {
                categories.push(true);
                classType -= LETTER_NUMBER_MODIFIER;
            } else {
                categories.push(false);
            }

            if (['normal', 'auto', 'loose'].indexOf(lineBreak) !== -1) {
                // U+2010, – U+2013, 〜 U+301C, ゠ U+30A0
                if ([0x2010, 0x2013, 0x301c, 0x30a0].indexOf(codePoint) !== -1) {
                    indicies.push(index);
                    return types.push(CB);
                }
            }

            if (classType === CM || classType === ZWJ) {
                // LB10 Treat any remaining combining mark or ZWJ as AL.
                if (index === 0) {
                    indicies.push(index);
                    return types.push(AL);
                }

                // LB9 Do not break a combining character sequence; treat it as if it has the line breaking class of
                // the base character in all of the following rules. Treat ZWJ as if it were CM.
                var prev = types[index - 1];
                if (LINE_BREAKS.indexOf(prev) === -1) {
                    indicies.push(indicies[index - 1]);
                    return types.push(prev);
                }
                indicies.push(index);
                return types.push(AL);
            }

            indicies.push(index);

            if (classType === CJ) {
                return types.push(lineBreak === 'strict' ? NS : ID);
            }

            if (classType === SA) {
                return types.push(AL);
            }

            if (classType === AI) {
                return types.push(AL);
            }

            // For supplementary characters, a useful default is to treat characters in the range 10000..1FFFD as AL
            // and characters in the ranges 20000..2FFFD and 30000..3FFFD as ID, until the implementation can be revised
            // to take into account the actual line breaking properties for these characters.
            if (classType === XX) {
                if (codePoint >= 0x20000 && codePoint <= 0x2fffd || codePoint >= 0x30000 && codePoint <= 0x3fffd) {
                    return types.push(ID);
                } else {
                    return types.push(AL);
                }
            }

            types.push(classType);
        });

        return [indicies, types, categories];
    };

    var isAdjacentWithSpaceIgnored = function isAdjacentWithSpaceIgnored(a, b, currentIndex, classTypes) {
        var current = classTypes[currentIndex];
        if (Array.isArray(a) ? a.indexOf(current) !== -1 : a === current) {
            var i = currentIndex;
            while (i <= classTypes.length) {
                i++;
                var next = classTypes[i];

                if (next === b) {
                    return true;
                }

                if (next !== SP) {
                    break;
                }
            }
        }

        if (current === SP) {
            var _i = currentIndex;

            while (_i > 0) {
                _i--;
                var prev = classTypes[_i];

                if (Array.isArray(a) ? a.indexOf(prev) !== -1 : a === prev) {
                    var n = currentIndex;
                    while (n <= classTypes.length) {
                        n++;
                        var _next = classTypes[n];

                        if (_next === b) {
                            return true;
                        }

                        if (_next !== SP) {
                            break;
                        }
                    }
                }

                if (prev !== SP) {
                    break;
                }
            }
        }
        return false;
    };

    var previousNonSpaceClassType = function previousNonSpaceClassType(currentIndex, classTypes) {
        var i = currentIndex;
        while (i >= 0) {
            var type = classTypes[i];
            if (type === SP) {
                i--;
            } else {
                return type;
            }
        }
        return 0;
    };

    var _lineBreakAtIndex = function _lineBreakAtIndex(codePoints, classTypes, indicies, index, forbiddenBreaks) {
        if (indicies[index] === 0) {
            return BREAK_NOT_ALLOWED;
        }

        var currentIndex = index - 1;
        if (Array.isArray(forbiddenBreaks) && forbiddenBreaks[currentIndex] === true) {
            return BREAK_NOT_ALLOWED;
        }

        var beforeIndex = currentIndex - 1;
        var afterIndex = currentIndex + 1;
        var current = classTypes[currentIndex];

        // LB4 Always break after hard line breaks.
        // LB5 Treat CR followed by LF, as well as CR, LF, and NL as hard line breaks.
        var before = beforeIndex >= 0 ? classTypes[beforeIndex] : 0;
        var next = classTypes[afterIndex];

        if (current === CR && next === LF) {
            return BREAK_NOT_ALLOWED;
        }

        if (HARD_LINE_BREAKS.indexOf(current) !== -1) {
            return BREAK_MANDATORY;
        }

        // LB6 Do not break before hard line breaks.
        if (HARD_LINE_BREAKS.indexOf(next) !== -1) {
            return BREAK_NOT_ALLOWED;
        }

        // LB7 Do not break before spaces or zero width space.
        if (SPACE.indexOf(next) !== -1) {
            return BREAK_NOT_ALLOWED;
        }

        // LB8 Break before any character following a zero-width space, even if one or more spaces intervene.
        if (previousNonSpaceClassType(currentIndex, classTypes) === ZW) {
            return BREAK_ALLOWED;
        }

        // LB8a Do not break between a zero width joiner and an ideograph, emoji base or emoji modifier.
        if (UnicodeTrie.get(codePoints[currentIndex]) === ZWJ && (next === ID || next === EB || next === EM)) {
            return BREAK_NOT_ALLOWED;
        }

        // LB11 Do not break before or after Word joiner and related characters.
        if (current === WJ || next === WJ) {
            return BREAK_NOT_ALLOWED;
        }

        // LB12 Do not break after NBSP and related characters.
        if (current === GL) {
            return BREAK_NOT_ALLOWED;
        }

        // LB12a Do not break before NBSP and related characters, except after spaces and hyphens.
        if ([SP, BA, HY].indexOf(current) === -1 && next === GL) {
            return BREAK_NOT_ALLOWED;
        }

        // LB13 Do not break before ‘]’ or ‘!’ or ‘;’ or ‘/’, even after spaces.
        if ([CL, CP, EX, IS, SY].indexOf(next) !== -1) {
            return BREAK_NOT_ALLOWED;
        }

        // LB14 Do not break after ‘[’, even after spaces.
        if (previousNonSpaceClassType(currentIndex, classTypes) === OP) {
            return BREAK_NOT_ALLOWED;
        }

        // LB15 Do not break within ‘”[’, even with intervening spaces.
        if (isAdjacentWithSpaceIgnored(QU, OP, currentIndex, classTypes)) {
            return BREAK_NOT_ALLOWED;
        }

        // LB16 Do not break between closing punctuation and a nonstarter (lb=NS), even with intervening spaces.
        if (isAdjacentWithSpaceIgnored([CL, CP], NS, currentIndex, classTypes)) {
            return BREAK_NOT_ALLOWED;
        }

        // LB17 Do not break within ‘——’, even with intervening spaces.
        if (isAdjacentWithSpaceIgnored(B2, B2, currentIndex, classTypes)) {
            return BREAK_NOT_ALLOWED;
        }

        // LB18 Break after spaces.
        if (current === SP) {
            return BREAK_ALLOWED;
        }

        // LB19 Do not break before or after quotation marks, such as ‘ ” ’.
        if (current === QU || next === QU) {
            return BREAK_NOT_ALLOWED;
        }

        // LB20 Break before and after unresolved CB.
        if (next === CB || current === CB) {
            return BREAK_ALLOWED;
        }

        // LB21 Do not break before hyphen-minus, other hyphens, fixed-width spaces, small kana, and other non-starters, or after acute accents.
        if ([BA, HY, NS].indexOf(next) !== -1 || current === BB) {
            return BREAK_NOT_ALLOWED;
        }

        // LB21a Don't break after Hebrew + Hyphen.
        if (before === HL && HYPHEN.indexOf(current) !== -1) {
            return BREAK_NOT_ALLOWED;
        }

        // LB21b Don’t break between Solidus and Hebrew letters.
        if (current === SY && next === HL) {
            return BREAK_NOT_ALLOWED;
        }

        // LB22 Do not break between two ellipses, or between letters, numbers or exclamations and ellipsis.
        if (next === IN && ALPHABETICS.concat(IN, EX, NU, ID, EB, EM).indexOf(current) !== -1) {
            return BREAK_NOT_ALLOWED;
        }

        // LB23 Do not break between digits and letters.
        if (ALPHABETICS.indexOf(next) !== -1 && current === NU || ALPHABETICS.indexOf(current) !== -1 && next === NU) {
            return BREAK_NOT_ALLOWED;
        }

        // LB23a Do not break between numeric prefixes and ideographs, or between ideographs and numeric postfixes.
        if (current === PR && [ID, EB, EM].indexOf(next) !== -1 || [ID, EB, EM].indexOf(current) !== -1 && next === PO) {
            return BREAK_NOT_ALLOWED;
        }

        // LB24 Do not break between numeric prefix/postfix and letters, or between letters and prefix/postfix.
        if (ALPHABETICS.indexOf(current) !== -1 && PREFIX_POSTFIX.indexOf(next) !== -1 || PREFIX_POSTFIX.indexOf(current) !== -1 && ALPHABETICS.indexOf(next) !== -1) {
            return BREAK_NOT_ALLOWED;
        }

        // LB25 Do not break between the following pairs of classes relevant to numbers:
        if (
        // (PR | PO) × ( OP | HY )? NU
        [PR, PO].indexOf(current) !== -1 && (next === NU || [OP, HY].indexOf(next) !== -1 && classTypes[afterIndex + 1] === NU) ||
        // ( OP | HY ) × NU
        [OP, HY].indexOf(current) !== -1 && next === NU ||
        // NU ×	(NU | SY | IS)
        current === NU && [NU, SY, IS].indexOf(next) !== -1) {
            return BREAK_NOT_ALLOWED;
        }

        // NU (NU | SY | IS)* × (NU | SY | IS | CL | CP)
        if ([NU, SY, IS, CL, CP].indexOf(next) !== -1) {
            var prevIndex = currentIndex;
            while (prevIndex >= 0) {
                var type = classTypes[prevIndex];
                if (type === NU) {
                    return BREAK_NOT_ALLOWED;
                } else if ([SY, IS].indexOf(type) !== -1) {
                    prevIndex--;
                } else {
                    break;
                }
            }
        }

        // NU (NU | SY | IS)* (CL | CP)? × (PO | PR))
        if ([PR, PO].indexOf(next) !== -1) {
            var _prevIndex = [CL, CP].indexOf(current) !== -1 ? beforeIndex : currentIndex;
            while (_prevIndex >= 0) {
                var _type = classTypes[_prevIndex];
                if (_type === NU) {
                    return BREAK_NOT_ALLOWED;
                } else if ([SY, IS].indexOf(_type) !== -1) {
                    _prevIndex--;
                } else {
                    break;
                }
            }
        }

        // LB26 Do not break a Korean syllable.
        if (JL === current && [JL, JV, H2, H3].indexOf(next) !== -1 || [JV, H2].indexOf(current) !== -1 && [JV, JT].indexOf(next) !== -1 || [JT, H3].indexOf(current) !== -1 && next === JT) {
            return BREAK_NOT_ALLOWED;
        }

        // LB27 Treat a Korean Syllable Block the same as ID.
        if (KOREAN_SYLLABLE_BLOCK.indexOf(current) !== -1 && [IN, PO].indexOf(next) !== -1 || KOREAN_SYLLABLE_BLOCK.indexOf(next) !== -1 && current === PR) {
            return BREAK_NOT_ALLOWED;
        }

        // LB28 Do not break between alphabetics (“at”).
        if (ALPHABETICS.indexOf(current) !== -1 && ALPHABETICS.indexOf(next) !== -1) {
            return BREAK_NOT_ALLOWED;
        }

        // LB29 Do not break between numeric punctuation and alphabetics (“e.g.”).
        if (current === IS && ALPHABETICS.indexOf(next) !== -1) {
            return BREAK_NOT_ALLOWED;
        }

        // LB30 Do not break between letters, numbers, or ordinary symbols and opening or closing parentheses.
        if (ALPHABETICS.concat(NU).indexOf(current) !== -1 && next === OP || ALPHABETICS.concat(NU).indexOf(next) !== -1 && current === CP) {
            return BREAK_NOT_ALLOWED;
        }

        // LB30a Break between two regional indicator symbols if and only if there are an even number of regional
        // indicators preceding the position of the break.
        if (current === RI && next === RI) {
            var i = indicies[currentIndex];
            var count = 1;
            while (i > 0) {
                i--;
                if (classTypes[i] === RI) {
                    count++;
                } else {
                    break;
                }
            }
            if (count % 2 !== 0) {
                return BREAK_NOT_ALLOWED;
            }
        }

        // LB30b Do not break between an emoji base and an emoji modifier.
        if (current === EB && next === EM) {
            return BREAK_NOT_ALLOWED;
        }

        return BREAK_ALLOWED;
    };

    var lineBreakAtIndex = exports.lineBreakAtIndex = function lineBreakAtIndex(codePoints, index) {
        // LB2 Never break at the start of text.
        if (index === 0) {
            return BREAK_NOT_ALLOWED;
        }

        // LB3 Always break at the end of text.
        if (index >= codePoints.length) {
            return BREAK_MANDATORY;
        }

        var _codePointsToCharacte = codePointsToCharacterClasses(codePoints),
            _codePointsToCharacte2 = _slicedToArray(_codePointsToCharacte, 2),
            indicies = _codePointsToCharacte2[0],
            classTypes = _codePointsToCharacte2[1];

        return _lineBreakAtIndex(codePoints, classTypes, indicies, index);
    };

    var cssFormattedClasses = function cssFormattedClasses(codePoints, options) {
        if (!options) {
            options = { lineBreak: 'normal', wordBreak: 'normal' };
        }

        var _codePointsToCharacte3 = codePointsToCharacterClasses(codePoints, options.lineBreak),
            _codePointsToCharacte4 = _slicedToArray(_codePointsToCharacte3, 3),
            indicies = _codePointsToCharacte4[0],
            classTypes = _codePointsToCharacte4[1],
            isLetterNumber = _codePointsToCharacte4[2];

        if (options.wordBreak === 'break-all' || options.wordBreak === 'break-word') {
            classTypes = classTypes.map(function (type) {
                return [NU, AL, SA].indexOf(type) !== -1 ? ID : type;
            });
        }

        var forbiddenBreakpoints = options.wordBreak === 'keep-all' ? isLetterNumber.map(function (isLetterNumber, i) {
            return isLetterNumber && codePoints[i] >= 0x4e00 && codePoints[i] <= 0x9fff;
        }) : null;

        return [indicies, classTypes, forbiddenBreakpoints];
    };

    var inlineBreakOpportunities = exports.inlineBreakOpportunities = function inlineBreakOpportunities(str, options) {
        var codePoints = (0, Util$2.toCodePoints)(str);
        var output = BREAK_NOT_ALLOWED;

        var _cssFormattedClasses = cssFormattedClasses(codePoints, options),
            _cssFormattedClasses2 = _slicedToArray(_cssFormattedClasses, 3),
            indicies = _cssFormattedClasses2[0],
            classTypes = _cssFormattedClasses2[1],
            forbiddenBreakpoints = _cssFormattedClasses2[2];

        codePoints.forEach(function (codePoint, i) {
            output += (0, Util$2.fromCodePoint)(codePoint) + (i >= codePoints.length - 1 ? BREAK_MANDATORY : _lineBreakAtIndex(codePoints, classTypes, indicies, i + 1, forbiddenBreakpoints));
        });

        return output;
    };

    var Break = function () {
        function Break(codePoints, lineBreak, start, end) {
            _classCallCheck(this, Break);

            this._codePoints = codePoints;
            this.required = lineBreak === BREAK_MANDATORY;
            this.start = start;
            this.end = end;
        }

        _createClass(Break, [{
            key: 'slice',
            value: function slice() {
                return Util$2.fromCodePoint.apply(undefined, _toConsumableArray(this._codePoints.slice(this.start, this.end)));
            }
        }]);

        return Break;
    }();

    var LineBreaker = exports.LineBreaker = function LineBreaker(str, options) {
        var codePoints = (0, Util$2.toCodePoints)(str);

        var _cssFormattedClasses3 = cssFormattedClasses(codePoints, options),
            _cssFormattedClasses4 = _slicedToArray(_cssFormattedClasses3, 3),
            indicies = _cssFormattedClasses4[0],
            classTypes = _cssFormattedClasses4[1],
            forbiddenBreakpoints = _cssFormattedClasses4[2];

        var length = codePoints.length;
        var lastEnd = 0;
        var nextIndex = 0;

        return {
            next: function next() {
                if (nextIndex >= length) {
                    return { done: true };
                }
                var lineBreak = BREAK_NOT_ALLOWED;
                while (nextIndex < length && (lineBreak = _lineBreakAtIndex(codePoints, classTypes, indicies, ++nextIndex, forbiddenBreakpoints)) === BREAK_NOT_ALLOWED) {}

                if (lineBreak !== BREAK_NOT_ALLOWED || nextIndex === length) {
                    var value = new Break(codePoints, lineBreak, lastEnd, nextIndex);
                    lastEnd = nextIndex;
                    return { value: value, done: false };
                }

                return { done: true };
            }
        };
    };
    });

    unwrapExports(LineBreak);
    var LineBreak_1 = LineBreak.LineBreaker;
    var LineBreak_2 = LineBreak.inlineBreakOpportunities;
    var LineBreak_3 = LineBreak.lineBreakAtIndex;
    var LineBreak_4 = LineBreak.codePointsToCharacterClasses;
    var LineBreak_5 = LineBreak.UnicodeTrie;
    var LineBreak_6 = LineBreak.BREAK_ALLOWED;
    var LineBreak_7 = LineBreak.BREAK_NOT_ALLOWED;
    var LineBreak_8 = LineBreak.BREAK_MANDATORY;
    var LineBreak_9 = LineBreak.classes;
    var LineBreak_10 = LineBreak.LETTER_NUMBER_MODIFIER;

    var dist = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });



    Object.defineProperty(exports, 'toCodePoints', {
      enumerable: true,
      get: function get() {
        return Util$2.toCodePoints;
      }
    });
    Object.defineProperty(exports, 'fromCodePoint', {
      enumerable: true,
      get: function get() {
        return Util$2.fromCodePoint;
      }
    });



    Object.defineProperty(exports, 'LineBreaker', {
      enumerable: true,
      get: function get() {
        return LineBreak.LineBreaker;
      }
    });
    });

    unwrapExports(dist);

    var Unicode = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.breakWords = exports.fromCodePoint = exports.toCodePoints = undefined;



    Object.defineProperty(exports, 'toCodePoints', {
        enumerable: true,
        get: function get() {
            return dist.toCodePoints;
        }
    });
    Object.defineProperty(exports, 'fromCodePoint', {
        enumerable: true,
        get: function get() {
            return dist.fromCodePoint;
        }
    });



    var breakWords = exports.breakWords = function breakWords(str, parent) {
        var breaker = (0, dist.LineBreaker)(str, {
            lineBreak: parent.style.lineBreak,
            wordBreak: parent.style.overflowWrap === overflowWrap.OVERFLOW_WRAP.BREAK_WORD ? 'break-word' : parent.style.wordBreak
        });

        var words = [];
        var bk = void 0;

        while (!(bk = breaker.next()).done) {
            words.push(bk.value.slice());
        }

        return words;
    };
    });

    unwrapExports(Unicode);
    var Unicode_1 = Unicode.breakWords;
    var Unicode_2 = Unicode.fromCodePoint;
    var Unicode_3 = Unicode.toCodePoints;

    var TextBounds_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parseTextBounds = exports.TextBounds = undefined;







    var _Feature2 = _interopRequireDefault(Feature);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var TextBounds = exports.TextBounds = function TextBounds(text, bounds) {
        _classCallCheck(this, TextBounds);

        this.text = text;
        this.bounds = bounds;
    };

    var parseTextBounds = exports.parseTextBounds = function parseTextBounds(value, parent, node) {
        var letterRendering = parent.style.letterSpacing !== 0;
        var textList = letterRendering ? (0, Unicode.toCodePoints)(value).map(function (i) {
            return (0, Unicode.fromCodePoint)(i);
        }) : (0, Unicode.breakWords)(value, parent);
        var length = textList.length;
        var defaultView = node.parentNode ? node.parentNode.ownerDocument.defaultView : null;
        var scrollX = defaultView ? defaultView.pageXOffset : 0;
        var scrollY = defaultView ? defaultView.pageYOffset : 0;
        var textBounds = [];
        var offset = 0;
        for (var i = 0; i < length; i++) {
            var text = textList[i];
            if (parent.style.textDecoration !== textDecoration.TEXT_DECORATION.NONE || text.trim().length > 0) {
                if (_Feature2.default.SUPPORT_RANGE_BOUNDS) {
                    textBounds.push(new TextBounds(text, getRangeBounds(node, offset, text.length, scrollX, scrollY)));
                } else {
                    var replacementNode = node.splitText(text.length);
                    textBounds.push(new TextBounds(text, getWrapperBounds(node, scrollX, scrollY)));
                    node = replacementNode;
                }
            } else if (!_Feature2.default.SUPPORT_RANGE_BOUNDS) {
                node = node.splitText(text.length);
            }
            offset += text.length;
        }
        return textBounds;
    };

    var getWrapperBounds = function getWrapperBounds(node, scrollX, scrollY) {
        var wrapper = node.ownerDocument.createElement('html2canvaswrapper');
        wrapper.appendChild(node.cloneNode(true));
        var parentNode = node.parentNode;
        if (parentNode) {
            parentNode.replaceChild(wrapper, node);
            var bounds = (0, Bounds_1.parseBounds)(wrapper, scrollX, scrollY);
            if (wrapper.firstChild) {
                parentNode.replaceChild(wrapper.firstChild, wrapper);
            }
            return bounds;
        }
        return new Bounds_1.Bounds(0, 0, 0, 0);
    };

    var getRangeBounds = function getRangeBounds(node, offset, length, scrollX, scrollY) {
        var range = node.ownerDocument.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + length);
        return Bounds_1.Bounds.fromClientRect(range.getBoundingClientRect(), scrollX, scrollY);
    };
    });

    unwrapExports(TextBounds_1);
    var TextBounds_2 = TextBounds_1.parseTextBounds;
    var TextBounds_3 = TextBounds_1.TextBounds;

    var TextContainer_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();





    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var TextContainer = function () {
        function TextContainer(text, parent, bounds) {
            _classCallCheck(this, TextContainer);

            this.text = text;
            this.parent = parent;
            this.bounds = bounds;
        }

        _createClass(TextContainer, null, [{
            key: 'fromTextNode',
            value: function fromTextNode(node, parent) {
                var text = transform(node.data, parent.style.textTransform);
                return new TextContainer(text, parent, (0, TextBounds_1.parseTextBounds)(text, parent, node));
            }
        }]);

        return TextContainer;
    }();

    exports.default = TextContainer;


    var CAPITALIZE = /(^|\s|:|-|\(|\))([a-z])/g;

    var transform = function transform(text, _transform) {
        switch (_transform) {
            case textTransform.TEXT_TRANSFORM.LOWERCASE:
                return text.toLowerCase();
            case textTransform.TEXT_TRANSFORM.CAPITALIZE:
                return text.replace(CAPITALIZE, capitalize);
            case textTransform.TEXT_TRANSFORM.UPPERCASE:
                return text.toUpperCase();
            default:
                return text;
        }
    };

    function capitalize(m, p1, p2) {
        if (m.length > 0) {
            return p1 + p2.toUpperCase();
        }

        return m;
    }
    });

    unwrapExports(TextContainer_1);

    var Circle_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });



    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var Circle = function Circle(x, y, radius) {
        _classCallCheck(this, Circle);

        this.type = Path.PATH.CIRCLE;
        this.x = x;
        this.y = y;
        this.radius = radius;
        if (process.env.NODE_ENV !== 'production') {
            if (isNaN(x)) {
                console.error('Invalid x value given for Circle');
            }
            if (isNaN(y)) {
                console.error('Invalid y value given for Circle');
            }
            if (isNaN(radius)) {
                console.error('Invalid radius value given for Circle');
            }
        }
    };

    exports.default = Circle;
    });

    unwrapExports(Circle_1);

    var Input = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.reformatInputBounds = exports.inlineSelectElement = exports.inlineTextAreaElement = exports.inlineInputElement = exports.getInputBorderRadius = exports.INPUT_BACKGROUND = exports.INPUT_BORDERS = exports.INPUT_COLOR = undefined;



    var _TextContainer2 = _interopRequireDefault(TextContainer_1);







    var _Circle2 = _interopRequireDefault(Circle_1);



    var _Vector2 = _interopRequireDefault(Vector_1);



    var _Color2 = _interopRequireDefault(Color_1);



    var _Length2 = _interopRequireDefault(Length_1);







    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var INPUT_COLOR = exports.INPUT_COLOR = new _Color2.default([42, 42, 42]);
    var INPUT_BORDER_COLOR = new _Color2.default([165, 165, 165]);
    var INPUT_BACKGROUND_COLOR = new _Color2.default([222, 222, 222]);
    var INPUT_BORDER = {
        borderWidth: 1,
        borderColor: INPUT_BORDER_COLOR,
        borderStyle: border.BORDER_STYLE.SOLID
    };
    var INPUT_BORDERS = exports.INPUT_BORDERS = [INPUT_BORDER, INPUT_BORDER, INPUT_BORDER, INPUT_BORDER];
    var INPUT_BACKGROUND = exports.INPUT_BACKGROUND = {
        backgroundColor: INPUT_BACKGROUND_COLOR,
        backgroundImage: [],
        backgroundClip: background.BACKGROUND_CLIP.PADDING_BOX,
        backgroundOrigin: background.BACKGROUND_ORIGIN.PADDING_BOX
    };

    var RADIO_BORDER_RADIUS = new _Length2.default('50%');
    var RADIO_BORDER_RADIUS_TUPLE = [RADIO_BORDER_RADIUS, RADIO_BORDER_RADIUS];
    var INPUT_RADIO_BORDER_RADIUS = [RADIO_BORDER_RADIUS_TUPLE, RADIO_BORDER_RADIUS_TUPLE, RADIO_BORDER_RADIUS_TUPLE, RADIO_BORDER_RADIUS_TUPLE];

    var CHECKBOX_BORDER_RADIUS = new _Length2.default('3px');
    var CHECKBOX_BORDER_RADIUS_TUPLE = [CHECKBOX_BORDER_RADIUS, CHECKBOX_BORDER_RADIUS];
    var INPUT_CHECKBOX_BORDER_RADIUS = [CHECKBOX_BORDER_RADIUS_TUPLE, CHECKBOX_BORDER_RADIUS_TUPLE, CHECKBOX_BORDER_RADIUS_TUPLE, CHECKBOX_BORDER_RADIUS_TUPLE];

    var getInputBorderRadius = exports.getInputBorderRadius = function getInputBorderRadius(node) {
        return node.type === 'radio' ? INPUT_RADIO_BORDER_RADIUS : INPUT_CHECKBOX_BORDER_RADIUS;
    };

    var inlineInputElement = exports.inlineInputElement = function inlineInputElement(node, container) {
        if (node.type === 'radio' || node.type === 'checkbox') {
            if (node.checked) {
                var size = Math.min(container.bounds.width, container.bounds.height);
                container.childNodes.push(node.type === 'checkbox' ? [new _Vector2.default(container.bounds.left + size * 0.39363, container.bounds.top + size * 0.79), new _Vector2.default(container.bounds.left + size * 0.16, container.bounds.top + size * 0.5549), new _Vector2.default(container.bounds.left + size * 0.27347, container.bounds.top + size * 0.44071), new _Vector2.default(container.bounds.left + size * 0.39694, container.bounds.top + size * 0.5649), new _Vector2.default(container.bounds.left + size * 0.72983, container.bounds.top + size * 0.23), new _Vector2.default(container.bounds.left + size * 0.84, container.bounds.top + size * 0.34085), new _Vector2.default(container.bounds.left + size * 0.39363, container.bounds.top + size * 0.79)] : new _Circle2.default(container.bounds.left + size / 4, container.bounds.top + size / 4, size / 4));
            }
        } else {
            inlineFormElement(getInputValue(node), node, container, false);
        }
    };

    var inlineTextAreaElement = exports.inlineTextAreaElement = function inlineTextAreaElement(node, container) {
        inlineFormElement(node.value, node, container, true);
    };

    var inlineSelectElement = exports.inlineSelectElement = function inlineSelectElement(node, container) {
        var option = node.options[node.selectedIndex || 0];
        inlineFormElement(option ? option.text || '' : '', node, container, false);
    };

    var reformatInputBounds = exports.reformatInputBounds = function reformatInputBounds(bounds) {
        if (bounds.width > bounds.height) {
            bounds.left += (bounds.width - bounds.height) / 2;
            bounds.width = bounds.height;
        } else if (bounds.width < bounds.height) {
            bounds.top += (bounds.height - bounds.width) / 2;
            bounds.height = bounds.width;
        }
        return bounds;
    };

    var inlineFormElement = function inlineFormElement(value, node, container, allowLinebreak) {
        var body = node.ownerDocument.body;
        if (value.length > 0 && body) {
            var wrapper = node.ownerDocument.createElement('html2canvaswrapper');
            (0, Util.copyCSSStyles)(node.ownerDocument.defaultView.getComputedStyle(node, null), wrapper);
            wrapper.style.position = 'absolute';
            wrapper.style.left = container.bounds.left + 'px';
            wrapper.style.top = container.bounds.top + 'px';
            if (!allowLinebreak) {
                wrapper.style.whiteSpace = 'nowrap';
            }
            var text = node.ownerDocument.createTextNode(value);
            wrapper.appendChild(text);
            body.appendChild(wrapper);
            container.childNodes.push(_TextContainer2.default.fromTextNode(text, container));
            body.removeChild(wrapper);
        }
    };

    var getInputValue = function getInputValue(node) {
        var value = node.type === 'password' ? new Array(node.value.length + 1).join('\u2022') : node.value;

        return value.length === 0 ? node.placeholder || '' : value;
    };
    });

    unwrapExports(Input);
    var Input_1 = Input.reformatInputBounds;
    var Input_2 = Input.inlineSelectElement;
    var Input_3 = Input.inlineTextAreaElement;
    var Input_4 = Input.inlineInputElement;
    var Input_5 = Input.getInputBorderRadius;
    var Input_6 = Input.INPUT_BACKGROUND;
    var Input_7 = Input.INPUT_BORDERS;
    var Input_8 = Input.INPUT_COLOR;

    var ListItem = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.createCounterText = exports.inlineListItemElement = exports.getListOwner = undefined;





    var _NodeContainer2 = _interopRequireDefault(NodeContainer_1);



    var _TextContainer2 = _interopRequireDefault(TextContainer_1);





    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    // Margin between the enumeration and the list item content
    var MARGIN_RIGHT = 7;

    var ancestorTypes = ['OL', 'UL', 'MENU'];

    var getListOwner = exports.getListOwner = function getListOwner(container) {
        var parent = container.parent;
        if (!parent) {
            return null;
        }

        do {
            var isAncestor = ancestorTypes.indexOf(parent.tagName) !== -1;
            if (isAncestor) {
                return parent;
            }
            parent = parent.parent;
        } while (parent);

        return container.parent;
    };

    var inlineListItemElement = exports.inlineListItemElement = function inlineListItemElement(node, container, resourceLoader) {
        var listStyle$$1 = container.style.listStyle;

        if (!listStyle$$1) {
            return;
        }

        var style = node.ownerDocument.defaultView.getComputedStyle(node, null);
        var wrapper = node.ownerDocument.createElement('html2canvaswrapper');
        (0, Util.copyCSSStyles)(style, wrapper);

        wrapper.style.position = 'absolute';
        wrapper.style.bottom = 'auto';
        wrapper.style.display = 'block';
        wrapper.style.letterSpacing = 'normal';

        switch (listStyle$$1.listStylePosition) {
            case listStyle.LIST_STYLE_POSITION.OUTSIDE:
                wrapper.style.left = 'auto';
                wrapper.style.right = node.ownerDocument.defaultView.innerWidth - container.bounds.left - container.style.margin[1].getAbsoluteValue(container.bounds.width) + MARGIN_RIGHT + 'px';
                wrapper.style.textAlign = 'right';
                break;
            case listStyle.LIST_STYLE_POSITION.INSIDE:
                wrapper.style.left = container.bounds.left - container.style.margin[3].getAbsoluteValue(container.bounds.width) + 'px';
                wrapper.style.right = 'auto';
                wrapper.style.textAlign = 'left';
                break;
        }

        var text = void 0;
        var MARGIN_TOP = container.style.margin[0].getAbsoluteValue(container.bounds.width);
        var styleImage = listStyle$$1.listStyleImage;
        if (styleImage) {
            if (styleImage.method === 'url') {
                var image = node.ownerDocument.createElement('img');
                image.src = styleImage.args[0];
                wrapper.style.top = container.bounds.top - MARGIN_TOP + 'px';
                wrapper.style.width = 'auto';
                wrapper.style.height = 'auto';
                wrapper.appendChild(image);
            } else {
                var size = parseFloat(container.style.font.fontSize) * 0.5;
                wrapper.style.top = container.bounds.top - MARGIN_TOP + container.bounds.height - 1.5 * size + 'px';
                wrapper.style.width = size + 'px';
                wrapper.style.height = size + 'px';
                wrapper.style.backgroundImage = style.listStyleImage;
            }
        } else if (typeof container.listIndex === 'number') {
            text = node.ownerDocument.createTextNode(createCounterText(container.listIndex, listStyle$$1.listStyleType, true));
            wrapper.appendChild(text);
            wrapper.style.top = container.bounds.top - MARGIN_TOP + 'px';
        }

        // $FlowFixMe
        var body = node.ownerDocument.body;
        body.appendChild(wrapper);

        if (text) {
            container.childNodes.push(_TextContainer2.default.fromTextNode(text, container));
            body.removeChild(wrapper);
        } else {
            // $FlowFixMe
            container.childNodes.push(new _NodeContainer2.default(wrapper, container, resourceLoader, 0));
        }
    };

    var ROMAN_UPPER = {
        integers: [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1],
        values: ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']
    };

    var ARMENIAN = {
        integers: [9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        values: ['Ք', 'Փ', 'Ւ', 'Ց', 'Ր', 'Տ', 'Վ', 'Ս', 'Ռ', 'Ջ', 'Պ', 'Չ', 'Ո', 'Շ', 'Ն', 'Յ', 'Մ', 'Ճ', 'Ղ', 'Ձ', 'Հ', 'Կ', 'Ծ', 'Խ', 'Լ', 'Ի', 'Ժ', 'Թ', 'Ը', 'Է', 'Զ', 'Ե', 'Դ', 'Գ', 'Բ', 'Ա']
    };

    var HEBREW = {
        integers: [10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 400, 300, 200, 100, 90, 80, 70, 60, 50, 40, 30, 20, 19, 18, 17, 16, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        values: ['י׳', 'ט׳', 'ח׳', 'ז׳', 'ו׳', 'ה׳', 'ד׳', 'ג׳', 'ב׳', 'א׳', 'ת', 'ש', 'ר', 'ק', 'צ', 'פ', 'ע', 'ס', 'נ', 'מ', 'ל', 'כ', 'יט', 'יח', 'יז', 'טז', 'טו', 'י', 'ט', 'ח', 'ז', 'ו', 'ה', 'ד', 'ג', 'ב', 'א']
    };

    var GEORGIAN = {
        integers: [10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        values: ['ჵ', 'ჰ', 'ჯ', 'ჴ', 'ხ', 'ჭ', 'წ', 'ძ', 'ც', 'ჩ', 'შ', 'ყ', 'ღ', 'ქ', 'ფ', 'ჳ', 'ტ', 'ს', 'რ', 'ჟ', 'პ', 'ო', 'ჲ', 'ნ', 'მ', 'ლ', 'კ', 'ი', 'თ', 'ჱ', 'ზ', 'ვ', 'ე', 'დ', 'გ', 'ბ', 'ა']
    };

    var createAdditiveCounter = function createAdditiveCounter(value, min, max, symbols, fallback, suffix) {
        if (value < min || value > max) {
            return createCounterText(value, fallback, suffix.length > 0);
        }

        return symbols.integers.reduce(function (string, integer, index) {
            while (value >= integer) {
                value -= integer;
                string += symbols.values[index];
            }
            return string;
        }, '') + suffix;
    };

    var createCounterStyleWithSymbolResolver = function createCounterStyleWithSymbolResolver(value, codePointRangeLength, isNumeric, resolver) {
        var string = '';

        do {
            if (!isNumeric) {
                value--;
            }
            string = resolver(value) + string;
            value /= codePointRangeLength;
        } while (value * codePointRangeLength >= codePointRangeLength);

        return string;
    };

    var createCounterStyleFromRange = function createCounterStyleFromRange(value, codePointRangeStart, codePointRangeEnd, isNumeric, suffix) {
        var codePointRangeLength = codePointRangeEnd - codePointRangeStart + 1;

        return (value < 0 ? '-' : '') + (createCounterStyleWithSymbolResolver(Math.abs(value), codePointRangeLength, isNumeric, function (codePoint) {
            return (0, Unicode.fromCodePoint)(Math.floor(codePoint % codePointRangeLength) + codePointRangeStart);
        }) + suffix);
    };

    var createCounterStyleFromSymbols = function createCounterStyleFromSymbols(value, symbols) {
        var suffix = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '. ';

        var codePointRangeLength = symbols.length;
        return createCounterStyleWithSymbolResolver(Math.abs(value), codePointRangeLength, false, function (codePoint) {
            return symbols[Math.floor(codePoint % codePointRangeLength)];
        }) + suffix;
    };

    var CJK_ZEROS = 1 << 0;
    var CJK_TEN_COEFFICIENTS = 1 << 1;
    var CJK_TEN_HIGH_COEFFICIENTS = 1 << 2;
    var CJK_HUNDRED_COEFFICIENTS = 1 << 3;

    var createCJKCounter = function createCJKCounter(value, numbers, multipliers, negativeSign, suffix, flags) {
        if (value < -9999 || value > 9999) {
            return createCounterText(value, listStyle.LIST_STYLE_TYPE.CJK_DECIMAL, suffix.length > 0);
        }
        var tmp = Math.abs(value);
        var string = suffix;

        if (tmp === 0) {
            return numbers[0] + string;
        }

        for (var digit = 0; tmp > 0 && digit <= 4; digit++) {
            var coefficient = tmp % 10;

            if (coefficient === 0 && (0, Util.contains)(flags, CJK_ZEROS) && string !== '') {
                string = numbers[coefficient] + string;
            } else if (coefficient > 1 || coefficient === 1 && digit === 0 || coefficient === 1 && digit === 1 && (0, Util.contains)(flags, CJK_TEN_COEFFICIENTS) || coefficient === 1 && digit === 1 && (0, Util.contains)(flags, CJK_TEN_HIGH_COEFFICIENTS) && value > 100 || coefficient === 1 && digit > 1 && (0, Util.contains)(flags, CJK_HUNDRED_COEFFICIENTS)) {
                string = numbers[coefficient] + (digit > 0 ? multipliers[digit - 1] : '') + string;
            } else if (coefficient === 1 && digit > 0) {
                string = multipliers[digit - 1] + string;
            }
            tmp = Math.floor(tmp / 10);
        }

        return (value < 0 ? negativeSign : '') + string;
    };

    var CHINESE_INFORMAL_MULTIPLIERS = '十百千萬';
    var CHINESE_FORMAL_MULTIPLIERS = '拾佰仟萬';
    var JAPANESE_NEGATIVE = 'マイナス';
    var KOREAN_NEGATIVE = '마이너스';

    var createCounterText = exports.createCounterText = function createCounterText(value, type, appendSuffix) {
        var defaultSuffix = appendSuffix ? '. ' : '';
        var cjkSuffix = appendSuffix ? '、' : '';
        var koreanSuffix = appendSuffix ? ', ' : '';
        switch (type) {
            case listStyle.LIST_STYLE_TYPE.DISC:
                return '•';
            case listStyle.LIST_STYLE_TYPE.CIRCLE:
                return '◦';
            case listStyle.LIST_STYLE_TYPE.SQUARE:
                return '◾';
            case listStyle.LIST_STYLE_TYPE.DECIMAL_LEADING_ZERO:
                var string = createCounterStyleFromRange(value, 48, 57, true, defaultSuffix);
                return string.length < 4 ? '0' + string : string;
            case listStyle.LIST_STYLE_TYPE.CJK_DECIMAL:
                return createCounterStyleFromSymbols(value, '〇一二三四五六七八九', cjkSuffix);
            case listStyle.LIST_STYLE_TYPE.LOWER_ROMAN:
                return createAdditiveCounter(value, 1, 3999, ROMAN_UPPER, listStyle.LIST_STYLE_TYPE.DECIMAL, defaultSuffix).toLowerCase();
            case listStyle.LIST_STYLE_TYPE.UPPER_ROMAN:
                return createAdditiveCounter(value, 1, 3999, ROMAN_UPPER, listStyle.LIST_STYLE_TYPE.DECIMAL, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.LOWER_GREEK:
                return createCounterStyleFromRange(value, 945, 969, false, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.LOWER_ALPHA:
                return createCounterStyleFromRange(value, 97, 122, false, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.UPPER_ALPHA:
                return createCounterStyleFromRange(value, 65, 90, false, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.ARABIC_INDIC:
                return createCounterStyleFromRange(value, 1632, 1641, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.ARMENIAN:
            case listStyle.LIST_STYLE_TYPE.UPPER_ARMENIAN:
                return createAdditiveCounter(value, 1, 9999, ARMENIAN, listStyle.LIST_STYLE_TYPE.DECIMAL, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.LOWER_ARMENIAN:
                return createAdditiveCounter(value, 1, 9999, ARMENIAN, listStyle.LIST_STYLE_TYPE.DECIMAL, defaultSuffix).toLowerCase();
            case listStyle.LIST_STYLE_TYPE.BENGALI:
                return createCounterStyleFromRange(value, 2534, 2543, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.CAMBODIAN:
            case listStyle.LIST_STYLE_TYPE.KHMER:
                return createCounterStyleFromRange(value, 6112, 6121, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.CJK_EARTHLY_BRANCH:
                return createCounterStyleFromSymbols(value, '子丑寅卯辰巳午未申酉戌亥', cjkSuffix);
            case listStyle.LIST_STYLE_TYPE.CJK_HEAVENLY_STEM:
                return createCounterStyleFromSymbols(value, '甲乙丙丁戊己庚辛壬癸', cjkSuffix);
            case listStyle.LIST_STYLE_TYPE.CJK_IDEOGRAPHIC:
            case listStyle.LIST_STYLE_TYPE.TRAD_CHINESE_INFORMAL:
                return createCJKCounter(value, '零一二三四五六七八九', CHINESE_INFORMAL_MULTIPLIERS, '負', cjkSuffix, CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
            case listStyle.LIST_STYLE_TYPE.TRAD_CHINESE_FORMAL:
                return createCJKCounter(value, '零壹貳參肆伍陸柒捌玖', CHINESE_FORMAL_MULTIPLIERS, '負', cjkSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
            case listStyle.LIST_STYLE_TYPE.SIMP_CHINESE_INFORMAL:
                return createCJKCounter(value, '零一二三四五六七八九', CHINESE_INFORMAL_MULTIPLIERS, '负', cjkSuffix, CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
            case listStyle.LIST_STYLE_TYPE.SIMP_CHINESE_FORMAL:
                return createCJKCounter(value, '零壹贰叁肆伍陆柒捌玖', CHINESE_FORMAL_MULTIPLIERS, '负', cjkSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
            case listStyle.LIST_STYLE_TYPE.JAPANESE_INFORMAL:
                return createCJKCounter(value, '〇一二三四五六七八九', '十百千万', JAPANESE_NEGATIVE, cjkSuffix, 0);
            case listStyle.LIST_STYLE_TYPE.JAPANESE_FORMAL:
                return createCJKCounter(value, '零壱弐参四伍六七八九', '拾百千万', JAPANESE_NEGATIVE, cjkSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS);
            case listStyle.LIST_STYLE_TYPE.KOREAN_HANGUL_FORMAL:
                return createCJKCounter(value, '영일이삼사오육칠팔구', '십백천만', KOREAN_NEGATIVE, koreanSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS);
            case listStyle.LIST_STYLE_TYPE.KOREAN_HANJA_INFORMAL:
                return createCJKCounter(value, '零一二三四五六七八九', '十百千萬', KOREAN_NEGATIVE, koreanSuffix, 0);
            case listStyle.LIST_STYLE_TYPE.KOREAN_HANJA_FORMAL:
                return createCJKCounter(value, '零壹貳參四五六七八九', '拾百千', KOREAN_NEGATIVE, koreanSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS);
            case listStyle.LIST_STYLE_TYPE.DEVANAGARI:
                return createCounterStyleFromRange(value, 0x966, 0x96f, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.GEORGIAN:
                return createAdditiveCounter(value, 1, 19999, GEORGIAN, listStyle.LIST_STYLE_TYPE.DECIMAL, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.GUJARATI:
                return createCounterStyleFromRange(value, 0xae6, 0xaef, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.GURMUKHI:
                return createCounterStyleFromRange(value, 0xa66, 0xa6f, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.HEBREW:
                return createAdditiveCounter(value, 1, 10999, HEBREW, listStyle.LIST_STYLE_TYPE.DECIMAL, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.HIRAGANA:
                return createCounterStyleFromSymbols(value, 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをん');
            case listStyle.LIST_STYLE_TYPE.HIRAGANA_IROHA:
                return createCounterStyleFromSymbols(value, 'いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえてあさきゆめみしゑひもせす');
            case listStyle.LIST_STYLE_TYPE.KANNADA:
                return createCounterStyleFromRange(value, 0xce6, 0xcef, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.KATAKANA:
                return createCounterStyleFromSymbols(value, 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲン', cjkSuffix);
            case listStyle.LIST_STYLE_TYPE.KATAKANA_IROHA:
                return createCounterStyleFromSymbols(value, 'イロハニホヘトチリヌルヲワカヨタレソツネナラムウヰノオクヤマケフコエテアサキユメミシヱヒモセス', cjkSuffix);
            case listStyle.LIST_STYLE_TYPE.LAO:
                return createCounterStyleFromRange(value, 0xed0, 0xed9, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.MONGOLIAN:
                return createCounterStyleFromRange(value, 0x1810, 0x1819, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.MYANMAR:
                return createCounterStyleFromRange(value, 0x1040, 0x1049, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.ORIYA:
                return createCounterStyleFromRange(value, 0xb66, 0xb6f, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.PERSIAN:
                return createCounterStyleFromRange(value, 0x6f0, 0x6f9, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.TAMIL:
                return createCounterStyleFromRange(value, 0xbe6, 0xbef, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.TELUGU:
                return createCounterStyleFromRange(value, 0xc66, 0xc6f, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.THAI:
                return createCounterStyleFromRange(value, 0xe50, 0xe59, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.TIBETAN:
                return createCounterStyleFromRange(value, 0xf20, 0xf29, true, defaultSuffix);
            case listStyle.LIST_STYLE_TYPE.DECIMAL:
            default:
                return createCounterStyleFromRange(value, 48, 57, true, defaultSuffix);
        }
    };
    });

    unwrapExports(ListItem);
    var ListItem_1 = ListItem.createCounterText;
    var ListItem_2 = ListItem.inlineListItemElement;
    var ListItem_3 = ListItem.getListOwner;

    var NodeContainer_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();



    var _Color2 = _interopRequireDefault(Color_1);



















































    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var INPUT_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

    var NodeContainer = function () {
        function NodeContainer(node, parent, resourceLoader, index) {
            var _this = this;

            _classCallCheck(this, NodeContainer);

            this.parent = parent;
            this.tagName = node.tagName;
            this.index = index;
            this.childNodes = [];
            this.listItems = [];
            if (typeof node.start === 'number') {
                this.listStart = node.start;
            }
            var defaultView = node.ownerDocument.defaultView;
            var scrollX = defaultView.pageXOffset;
            var scrollY = defaultView.pageYOffset;
            var style = defaultView.getComputedStyle(node, null);
            var display$$1 = (0, display.parseDisplay)(style.display);

            var IS_INPUT = node.type === 'radio' || node.type === 'checkbox';

            var position$$1 = (0, position.parsePosition)(style.position);

            this.style = {
                background: IS_INPUT ? Input.INPUT_BACKGROUND : (0, background.parseBackground)(style, resourceLoader),
                border: IS_INPUT ? Input.INPUT_BORDERS : (0, border.parseBorder)(style),
                borderRadius: (node instanceof defaultView.HTMLInputElement || node instanceof HTMLInputElement) && IS_INPUT ? (0, Input.getInputBorderRadius)(node) : (0, borderRadius.parseBorderRadius)(style),
                color: IS_INPUT ? Input.INPUT_COLOR : new _Color2.default(style.color),
                display: display$$1,
                float: (0, float_1.parseCSSFloat)(style.float),
                font: (0, font.parseFont)(style),
                letterSpacing: (0, letterSpacing.parseLetterSpacing)(style.letterSpacing),
                listStyle: display$$1 === display.DISPLAY.LIST_ITEM ? (0, listStyle.parseListStyle)(style) : null,
                lineBreak: (0, lineBreak.parseLineBreak)(style.lineBreak),
                margin: (0, margin.parseMargin)(style),
                opacity: parseFloat(style.opacity),
                overflow: INPUT_TAGS.indexOf(node.tagName) === -1 ? (0, overflow.parseOverflow)(style.overflow) : overflow.OVERFLOW.HIDDEN,
                overflowWrap: (0, overflowWrap.parseOverflowWrap)(style.overflowWrap ? style.overflowWrap : style.wordWrap),
                padding: (0, padding.parsePadding)(style),
                position: position$$1,
                textDecoration: (0, textDecoration.parseTextDecoration)(style),
                textShadow: (0, textShadow.parseTextShadow)(style.textShadow),
                textTransform: (0, textTransform.parseTextTransform)(style.textTransform),
                transform: (0, transform.parseTransform)(style),
                visibility: (0, visibility.parseVisibility)(style.visibility),
                wordBreak: (0, wordBreak.parseWordBreak)(style.wordBreak),
                zIndex: (0, zIndex.parseZIndex)(position$$1 !== position.POSITION.STATIC ? style.zIndex : 'auto')
            };

            if (this.isTransformed()) {
                // getBoundingClientRect provides values post-transform, we want them without the transformation
                node.style.transform = 'matrix(1,0,0,1,0,0)';
            }

            if (display$$1 === display.DISPLAY.LIST_ITEM) {
                var listOwner = (0, ListItem.getListOwner)(this);
                if (listOwner) {
                    var listIndex = listOwner.listItems.length;
                    listOwner.listItems.push(this);
                    this.listIndex = node.hasAttribute('value') && typeof node.value === 'number' ? node.value : listIndex === 0 ? typeof listOwner.listStart === 'number' ? listOwner.listStart : 1 : listOwner.listItems[listIndex - 1].listIndex + 1;
                }
            }

            // TODO move bound retrieval for all nodes to a later stage?
            if (node.tagName === 'IMG') {
                node.addEventListener('load', function () {
                    _this.bounds = (0, Bounds_1.parseBounds)(node, scrollX, scrollY);
                    _this.curvedBounds = (0, Bounds_1.parseBoundCurves)(_this.bounds, _this.style.border, _this.style.borderRadius);
                });
            }
            this.image = getImage(node, resourceLoader);
            this.bounds = IS_INPUT ? (0, Input.reformatInputBounds)((0, Bounds_1.parseBounds)(node, scrollX, scrollY)) : (0, Bounds_1.parseBounds)(node, scrollX, scrollY);
            this.curvedBounds = (0, Bounds_1.parseBoundCurves)(this.bounds, this.style.border, this.style.borderRadius);

            if (process.env.NODE_ENV !== 'production') {
                this.name = '' + node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + node.className.toString().split(' ').map(function (s) {
                    return s.length ? '.' + s : '';
                }).join('');
            }
        }

        _createClass(NodeContainer, [{
            key: 'getClipPaths',
            value: function getClipPaths() {
                var parentClips = this.parent ? this.parent.getClipPaths() : [];
                var isClipped = this.style.overflow !== overflow.OVERFLOW.VISIBLE;

                return isClipped ? parentClips.concat([(0, Bounds_1.calculatePaddingBoxPath)(this.curvedBounds)]) : parentClips;
            }
        }, {
            key: 'isInFlow',
            value: function isInFlow() {
                return this.isRootElement() && !this.isFloating() && !this.isAbsolutelyPositioned();
            }
        }, {
            key: 'isVisible',
            value: function isVisible() {
                return !(0, Util.contains)(this.style.display, display.DISPLAY.NONE) && this.style.opacity > 0 && this.style.visibility === visibility.VISIBILITY.VISIBLE;
            }
        }, {
            key: 'isAbsolutelyPositioned',
            value: function isAbsolutelyPositioned() {
                return this.style.position !== position.POSITION.STATIC && this.style.position !== position.POSITION.RELATIVE;
            }
        }, {
            key: 'isPositioned',
            value: function isPositioned() {
                return this.style.position !== position.POSITION.STATIC;
            }
        }, {
            key: 'isFloating',
            value: function isFloating() {
                return this.style.float !== float_1.FLOAT.NONE;
            }
        }, {
            key: 'isRootElement',
            value: function isRootElement() {
                return this.parent === null;
            }
        }, {
            key: 'isTransformed',
            value: function isTransformed() {
                return this.style.transform !== null;
            }
        }, {
            key: 'isPositionedWithZIndex',
            value: function isPositionedWithZIndex() {
                return this.isPositioned() && !this.style.zIndex.auto;
            }
        }, {
            key: 'isInlineLevel',
            value: function isInlineLevel() {
                return (0, Util.contains)(this.style.display, display.DISPLAY.INLINE) || (0, Util.contains)(this.style.display, display.DISPLAY.INLINE_BLOCK) || (0, Util.contains)(this.style.display, display.DISPLAY.INLINE_FLEX) || (0, Util.contains)(this.style.display, display.DISPLAY.INLINE_GRID) || (0, Util.contains)(this.style.display, display.DISPLAY.INLINE_LIST_ITEM) || (0, Util.contains)(this.style.display, display.DISPLAY.INLINE_TABLE);
            }
        }, {
            key: 'isInlineBlockOrInlineTable',
            value: function isInlineBlockOrInlineTable() {
                return (0, Util.contains)(this.style.display, display.DISPLAY.INLINE_BLOCK) || (0, Util.contains)(this.style.display, display.DISPLAY.INLINE_TABLE);
            }
        }]);

        return NodeContainer;
    }();

    exports.default = NodeContainer;


    var getImage = function getImage(node, resourceLoader) {
        if (node instanceof node.ownerDocument.defaultView.SVGSVGElement || node instanceof SVGSVGElement) {
            var s = new XMLSerializer();
            return resourceLoader.loadImage('data:image/svg+xml,' + encodeURIComponent(s.serializeToString(node)));
        }
        switch (node.tagName) {
            case 'IMG':
                // $FlowFixMe
                var img = node;
                return resourceLoader.loadImage(img.currentSrc || img.src);
            case 'CANVAS':
                // $FlowFixMe
                var canvas = node;
                return resourceLoader.loadCanvas(canvas);
            case 'IFRAME':
                var iframeKey = node.getAttribute('data-html2canvas-internal-iframe-key');
                if (iframeKey) {
                    return iframeKey;
                }
                break;
        }

        return null;
    };
    });

    unwrapExports(NodeContainer_1);

    var StackingContext_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();



    var _NodeContainer2 = _interopRequireDefault(NodeContainer_1);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var StackingContext = function () {
        function StackingContext(container, parent, treatAsRealStackingContext) {
            _classCallCheck(this, StackingContext);

            this.container = container;
            this.parent = parent;
            this.contexts = [];
            this.children = [];
            this.treatAsRealStackingContext = treatAsRealStackingContext;
        }

        _createClass(StackingContext, [{
            key: 'getOpacity',
            value: function getOpacity() {
                return this.parent ? this.container.style.opacity * this.parent.getOpacity() : this.container.style.opacity;
            }
        }, {
            key: 'getRealParentStackingContext',
            value: function getRealParentStackingContext() {
                return !this.parent || this.treatAsRealStackingContext ? this : this.parent.getRealParentStackingContext();
            }
        }]);

        return StackingContext;
    }();

    exports.default = StackingContext;
    });

    unwrapExports(StackingContext_1);

    var NodeParser_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.NodeParser = undefined;



    var _StackingContext2 = _interopRequireDefault(StackingContext_1);



    var _NodeContainer2 = _interopRequireDefault(NodeContainer_1);



    var _TextContainer2 = _interopRequireDefault(TextContainer_1);







    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var NodeParser = exports.NodeParser = function NodeParser(node, resourceLoader, logger) {
        if (process.env.NODE_ENV !== 'production') {
            logger.log('Starting node parsing');
        }

        var index = 0;

        var container = new _NodeContainer2.default(node, null, resourceLoader, index++);
        var stack = new _StackingContext2.default(container, null, true);

        parseNodeTree(node, container, stack, resourceLoader, index);

        if (process.env.NODE_ENV !== 'production') {
            logger.log('Finished parsing node tree');
        }

        return stack;
    };

    var IGNORED_NODE_NAMES = ['SCRIPT', 'HEAD', 'TITLE', 'OBJECT', 'BR', 'OPTION'];

    var parseNodeTree = function parseNodeTree(node, parent, stack, resourceLoader, index) {
        if (process.env.NODE_ENV !== 'production' && index > 50000) {
            throw new Error('Recursion error while parsing node tree');
        }

        for (var childNode = node.firstChild, nextNode; childNode; childNode = nextNode) {
            nextNode = childNode.nextSibling;
            var defaultView = childNode.ownerDocument.defaultView;
            if (childNode instanceof defaultView.Text || childNode instanceof Text || defaultView.parent && childNode instanceof defaultView.parent.Text) {
                if (childNode.data.trim().length > 0) {
                    parent.childNodes.push(_TextContainer2.default.fromTextNode(childNode, parent));
                }
            } else if (childNode instanceof defaultView.HTMLElement || childNode instanceof HTMLElement || defaultView.parent && childNode instanceof defaultView.parent.HTMLElement) {
                if (IGNORED_NODE_NAMES.indexOf(childNode.nodeName) === -1) {
                    var container = new _NodeContainer2.default(childNode, parent, resourceLoader, index++);
                    if (container.isVisible()) {
                        if (childNode.tagName === 'INPUT') {
                            // $FlowFixMe
                            (0, Input.inlineInputElement)(childNode, container);
                        } else if (childNode.tagName === 'TEXTAREA') {
                            // $FlowFixMe
                            (0, Input.inlineTextAreaElement)(childNode, container);
                        } else if (childNode.tagName === 'SELECT') {
                            // $FlowFixMe
                            (0, Input.inlineSelectElement)(childNode, container);
                        } else if (container.style.listStyle && container.style.listStyle.listStyleType !== listStyle.LIST_STYLE_TYPE.NONE) {
                            (0, ListItem.inlineListItemElement)(childNode, container, resourceLoader);
                        }

                        var SHOULD_TRAVERSE_CHILDREN = childNode.tagName !== 'TEXTAREA';
                        var treatAsRealStackingContext = createsRealStackingContext(container, childNode);
                        if (treatAsRealStackingContext || createsStackingContext(container)) {
                            // for treatAsRealStackingContext:false, any positioned descendants and descendants
                            // which actually create a new stacking context should be considered part of the parent stacking context
                            var parentStack = treatAsRealStackingContext || container.isPositioned() ? stack.getRealParentStackingContext() : stack;
                            var childStack = new _StackingContext2.default(container, parentStack, treatAsRealStackingContext);
                            parentStack.contexts.push(childStack);
                            if (SHOULD_TRAVERSE_CHILDREN) {
                                parseNodeTree(childNode, container, childStack, resourceLoader, index);
                            }
                        } else {
                            stack.children.push(container);
                            if (SHOULD_TRAVERSE_CHILDREN) {
                                parseNodeTree(childNode, container, stack, resourceLoader, index);
                            }
                        }
                    }
                }
            } else if (childNode instanceof defaultView.SVGSVGElement || childNode instanceof SVGSVGElement || defaultView.parent && childNode instanceof defaultView.parent.SVGSVGElement) {
                var _container = new _NodeContainer2.default(childNode, parent, resourceLoader, index++);
                var _treatAsRealStackingContext = createsRealStackingContext(_container, childNode);
                if (_treatAsRealStackingContext || createsStackingContext(_container)) {
                    // for treatAsRealStackingContext:false, any positioned descendants and descendants
                    // which actually create a new stacking context should be considered part of the parent stacking context
                    var _parentStack = _treatAsRealStackingContext || _container.isPositioned() ? stack.getRealParentStackingContext() : stack;
                    var _childStack = new _StackingContext2.default(_container, _parentStack, _treatAsRealStackingContext);
                    _parentStack.contexts.push(_childStack);
                } else {
                    stack.children.push(_container);
                }
            }
        }
    };

    var createsRealStackingContext = function createsRealStackingContext(container, node) {
        return container.isRootElement() || container.isPositionedWithZIndex() || container.style.opacity < 1 || container.isTransformed() || isBodyWithTransparentRoot(container, node);
    };

    var createsStackingContext = function createsStackingContext(container) {
        return container.isPositioned() || container.isFloating();
    };

    var isBodyWithTransparentRoot = function isBodyWithTransparentRoot(container, node) {
        return node.nodeName === 'BODY' && container.parent instanceof _NodeContainer2.default && container.parent.style.background.backgroundColor.isTransparent();
    };
    });

    unwrapExports(NodeParser_1);
    var NodeParser_2 = NodeParser_1.NodeParser;

    var Font = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.FontMetrics = undefined;

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();



    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var SAMPLE_TEXT = 'Hidden Text';

    var FontMetrics = exports.FontMetrics = function () {
        function FontMetrics(document) {
            _classCallCheck(this, FontMetrics);

            this._data = {};
            this._document = document;
        }

        _createClass(FontMetrics, [{
            key: '_parseMetrics',
            value: function _parseMetrics(font) {
                var container = this._document.createElement('div');
                var img = this._document.createElement('img');
                var span = this._document.createElement('span');

                var body = this._document.body;
                if (!body) {
                    throw new Error(process.env.NODE_ENV !== 'production' ? 'No document found for font metrics' : '');
                }

                container.style.visibility = 'hidden';
                container.style.fontFamily = font.fontFamily;
                container.style.fontSize = font.fontSize;
                container.style.margin = '0';
                container.style.padding = '0';

                body.appendChild(container);

                img.src = Util.SMALL_IMAGE;
                img.width = 1;
                img.height = 1;

                img.style.margin = '0';
                img.style.padding = '0';
                img.style.verticalAlign = 'baseline';

                span.style.fontFamily = font.fontFamily;
                span.style.fontSize = font.fontSize;
                span.style.margin = '0';
                span.style.padding = '0';

                span.appendChild(this._document.createTextNode(SAMPLE_TEXT));
                container.appendChild(span);
                container.appendChild(img);
                var baseline = img.offsetTop - span.offsetTop + 2;

                container.removeChild(span);
                container.appendChild(this._document.createTextNode(SAMPLE_TEXT));

                container.style.lineHeight = 'normal';
                img.style.verticalAlign = 'super';

                var middle = img.offsetTop - container.offsetTop + 2;

                body.removeChild(container);

                return { baseline: baseline, middle: middle };
            }
        }, {
            key: 'getMetrics',
            value: function getMetrics(font) {
                var key = font.fontFamily + ' ' + font.fontSize;
                if (this._data[key] === undefined) {
                    this._data[key] = this._parseMetrics(font);
                }

                return this._data[key];
            }
        }]);

        return FontMetrics;
    }();
    });

    unwrapExports(Font);
    var Font_1 = Font.FontMetrics;

    var Angle = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    var ANGLE = /([+-]?\d*\.?\d+)(deg|grad|rad|turn)/i;

    var parseAngle = exports.parseAngle = function parseAngle(angle) {
        var match = angle.match(ANGLE);

        if (match) {
            var value = parseFloat(match[1]);
            switch (match[2].toLowerCase()) {
                case 'deg':
                    return Math.PI * value / 180;
                case 'grad':
                    return Math.PI / 200 * value;
                case 'rad':
                    return value;
                case 'turn':
                    return Math.PI * 2 * value;
            }
        }

        return null;
    };
    });

    unwrapExports(Angle);
    var Angle_1 = Angle.parseAngle;

    var Gradient = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.transformWebkitRadialGradientArgs = exports.parseGradient = exports.RadialGradient = exports.LinearGradient = exports.RADIAL_GRADIENT_SHAPE = exports.GRADIENT_TYPE = undefined;

    var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();



    var _NodeContainer2 = _interopRequireDefault(NodeContainer_1);





    var _Color2 = _interopRequireDefault(Color_1);



    var _Length2 = _interopRequireDefault(Length_1);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var SIDE_OR_CORNER = /^(to )?(left|top|right|bottom)( (left|top|right|bottom))?$/i;
    var PERCENTAGE_ANGLES = /^([+-]?\d*\.?\d+)% ([+-]?\d*\.?\d+)%$/i;
    var ENDS_WITH_LENGTH = /(px)|%|( 0)$/i;
    var FROM_TO_COLORSTOP = /^(from|to|color-stop)\((?:([\d.]+)(%)?,\s*)?(.+?)\)$/i;
    var RADIAL_SHAPE_DEFINITION = /^\s*(circle|ellipse)?\s*((?:([\d.]+)(px|r?em|%)\s*(?:([\d.]+)(px|r?em|%))?)|closest-side|closest-corner|farthest-side|farthest-corner)?\s*(?:at\s*(?:(left|center|right)|([\d.]+)(px|r?em|%))\s+(?:(top|center|bottom)|([\d.]+)(px|r?em|%)))?(?:\s|$)/i;

    var GRADIENT_TYPE = exports.GRADIENT_TYPE = {
        LINEAR_GRADIENT: 0,
        RADIAL_GRADIENT: 1
    };

    var RADIAL_GRADIENT_SHAPE = exports.RADIAL_GRADIENT_SHAPE = {
        CIRCLE: 0,
        ELLIPSE: 1
    };

    var LENGTH_FOR_POSITION = {
        left: new _Length2.default('0%'),
        top: new _Length2.default('0%'),
        center: new _Length2.default('50%'),
        right: new _Length2.default('100%'),
        bottom: new _Length2.default('100%')
    };

    var LinearGradient = exports.LinearGradient = function LinearGradient(colorStops, direction) {
        _classCallCheck(this, LinearGradient);

        this.type = GRADIENT_TYPE.LINEAR_GRADIENT;
        this.colorStops = colorStops;
        this.direction = direction;
    };

    var RadialGradient = exports.RadialGradient = function RadialGradient(colorStops, shape, center, radius) {
        _classCallCheck(this, RadialGradient);

        this.type = GRADIENT_TYPE.RADIAL_GRADIENT;
        this.colorStops = colorStops;
        this.shape = shape;
        this.center = center;
        this.radius = radius;
    };

    var parseGradient = exports.parseGradient = function parseGradient(container, _ref, bounds) {
        var args = _ref.args,
            method = _ref.method,
            prefix = _ref.prefix;

        if (method === 'linear-gradient') {
            return parseLinearGradient(args, bounds, !!prefix);
        } else if (method === 'gradient' && args[0] === 'linear') {
            // TODO handle correct angle
            return parseLinearGradient(['to bottom'].concat(transformObsoleteColorStops(args.slice(3))), bounds, !!prefix);
        } else if (method === 'radial-gradient') {
            return parseRadialGradient(container, prefix === '-webkit-' ? transformWebkitRadialGradientArgs(args) : args, bounds);
        } else if (method === 'gradient' && args[0] === 'radial') {
            return parseRadialGradient(container, transformObsoleteColorStops(transformWebkitRadialGradientArgs(args.slice(1))), bounds);
        }
    };

    var parseColorStops = function parseColorStops(args, firstColorStopIndex, lineLength) {
        var colorStops = [];

        for (var i = firstColorStopIndex; i < args.length; i++) {
            var value = args[i];
            var HAS_LENGTH = ENDS_WITH_LENGTH.test(value);
            var lastSpaceIndex = value.lastIndexOf(' ');
            var _color = new _Color2.default(HAS_LENGTH ? value.substring(0, lastSpaceIndex) : value);
            var _stop = HAS_LENGTH ? new _Length2.default(value.substring(lastSpaceIndex + 1)) : i === firstColorStopIndex ? new _Length2.default('0%') : i === args.length - 1 ? new _Length2.default('100%') : null;
            colorStops.push({ color: _color, stop: _stop });
        }

        var absoluteValuedColorStops = colorStops.map(function (_ref2) {
            var color = _ref2.color,
                stop = _ref2.stop;

            var absoluteStop = lineLength === 0 ? 0 : stop ? stop.getAbsoluteValue(lineLength) / lineLength : null;

            return {
                color: color,
                // $FlowFixMe
                stop: absoluteStop
            };
        });

        var previousColorStop = absoluteValuedColorStops[0].stop;
        for (var _i = 0; _i < absoluteValuedColorStops.length; _i++) {
            if (previousColorStop !== null) {
                var _stop2 = absoluteValuedColorStops[_i].stop;
                if (_stop2 === null) {
                    var n = _i;
                    while (absoluteValuedColorStops[n].stop === null) {
                        n++;
                    }
                    var steps = n - _i + 1;
                    var nextColorStep = absoluteValuedColorStops[n].stop;
                    var stepSize = (nextColorStep - previousColorStop) / steps;
                    for (; _i < n; _i++) {
                        previousColorStop = absoluteValuedColorStops[_i].stop = previousColorStop + stepSize;
                    }
                } else {
                    previousColorStop = _stop2;
                }
            }
        }

        return absoluteValuedColorStops;
    };

    var parseLinearGradient = function parseLinearGradient(args, bounds, hasPrefix) {
        var angle = (0, Angle.parseAngle)(args[0]);
        var HAS_SIDE_OR_CORNER = SIDE_OR_CORNER.test(args[0]);
        var HAS_DIRECTION = HAS_SIDE_OR_CORNER || angle !== null || PERCENTAGE_ANGLES.test(args[0]);
        var direction = HAS_DIRECTION ? angle !== null ? calculateGradientDirection(
        // if there is a prefix, the 0° angle points due East (instead of North per W3C)
        hasPrefix ? angle - Math.PI * 0.5 : angle, bounds) : HAS_SIDE_OR_CORNER ? parseSideOrCorner(args[0], bounds) : parsePercentageAngle(args[0], bounds) : calculateGradientDirection(Math.PI, bounds);
        var firstColorStopIndex = HAS_DIRECTION ? 1 : 0;

        // TODO: Fix some inaccuracy with color stops with px values
        var lineLength = Math.min((0, Util.distance)(Math.abs(direction.x0) + Math.abs(direction.x1), Math.abs(direction.y0) + Math.abs(direction.y1)), bounds.width * 2, bounds.height * 2);

        return new LinearGradient(parseColorStops(args, firstColorStopIndex, lineLength), direction);
    };

    var parseRadialGradient = function parseRadialGradient(container, args, bounds) {
        var m = args[0].match(RADIAL_SHAPE_DEFINITION);
        var shape = m && (m[1] === 'circle' || // explicit shape specification
        m[3] !== undefined && m[5] === undefined) // only one radius coordinate
        ? RADIAL_GRADIENT_SHAPE.CIRCLE : RADIAL_GRADIENT_SHAPE.ELLIPSE;
        var radius = {};
        var center = {};

        if (m) {
            // Radius
            if (m[3] !== undefined) {
                radius.x = (0, Length_1.calculateLengthFromValueWithUnit)(container, m[3], m[4]).getAbsoluteValue(bounds.width);
            }

            if (m[5] !== undefined) {
                radius.y = (0, Length_1.calculateLengthFromValueWithUnit)(container, m[5], m[6]).getAbsoluteValue(bounds.height);
            }

            // Position
            if (m[7]) {
                center.x = LENGTH_FOR_POSITION[m[7].toLowerCase()];
            } else if (m[8] !== undefined) {
                center.x = (0, Length_1.calculateLengthFromValueWithUnit)(container, m[8], m[9]);
            }

            if (m[10]) {
                center.y = LENGTH_FOR_POSITION[m[10].toLowerCase()];
            } else if (m[11] !== undefined) {
                center.y = (0, Length_1.calculateLengthFromValueWithUnit)(container, m[11], m[12]);
            }
        }

        var gradientCenter = {
            x: center.x === undefined ? bounds.width / 2 : center.x.getAbsoluteValue(bounds.width),
            y: center.y === undefined ? bounds.height / 2 : center.y.getAbsoluteValue(bounds.height)
        };
        var gradientRadius = calculateRadius(m && m[2] || 'farthest-corner', shape, gradientCenter, radius, bounds);

        return new RadialGradient(parseColorStops(args, m ? 1 : 0, Math.min(gradientRadius.x, gradientRadius.y)), shape, gradientCenter, gradientRadius);
    };

    var calculateGradientDirection = function calculateGradientDirection(radian, bounds) {
        var width = bounds.width;
        var height = bounds.height;
        var HALF_WIDTH = width * 0.5;
        var HALF_HEIGHT = height * 0.5;
        var lineLength = Math.abs(width * Math.sin(radian)) + Math.abs(height * Math.cos(radian));
        var HALF_LINE_LENGTH = lineLength / 2;

        var x0 = HALF_WIDTH + Math.sin(radian) * HALF_LINE_LENGTH;
        var y0 = HALF_HEIGHT - Math.cos(radian) * HALF_LINE_LENGTH;
        var x1 = width - x0;
        var y1 = height - y0;

        return { x0: x0, x1: x1, y0: y0, y1: y1 };
    };

    var parseTopRight = function parseTopRight(bounds) {
        return Math.acos(bounds.width / 2 / ((0, Util.distance)(bounds.width, bounds.height) / 2));
    };

    var parseSideOrCorner = function parseSideOrCorner(side, bounds) {
        switch (side) {
            case 'bottom':
            case 'to top':
                return calculateGradientDirection(0, bounds);
            case 'left':
            case 'to right':
                return calculateGradientDirection(Math.PI / 2, bounds);
            case 'right':
            case 'to left':
                return calculateGradientDirection(3 * Math.PI / 2, bounds);
            case 'top right':
            case 'right top':
            case 'to bottom left':
            case 'to left bottom':
                return calculateGradientDirection(Math.PI + parseTopRight(bounds), bounds);
            case 'top left':
            case 'left top':
            case 'to bottom right':
            case 'to right bottom':
                return calculateGradientDirection(Math.PI - parseTopRight(bounds), bounds);
            case 'bottom left':
            case 'left bottom':
            case 'to top right':
            case 'to right top':
                return calculateGradientDirection(parseTopRight(bounds), bounds);
            case 'bottom right':
            case 'right bottom':
            case 'to top left':
            case 'to left top':
                return calculateGradientDirection(2 * Math.PI - parseTopRight(bounds), bounds);
            case 'top':
            case 'to bottom':
            default:
                return calculateGradientDirection(Math.PI, bounds);
        }
    };

    var parsePercentageAngle = function parsePercentageAngle(angle, bounds) {
        var _angle$split$map = angle.split(' ').map(parseFloat),
            _angle$split$map2 = _slicedToArray(_angle$split$map, 2),
            left = _angle$split$map2[0],
            top = _angle$split$map2[1];

        var ratio = left / 100 * bounds.width / (top / 100 * bounds.height);

        return calculateGradientDirection(Math.atan(isNaN(ratio) ? 1 : ratio) + Math.PI / 2, bounds);
    };

    var findCorner = function findCorner(bounds, x, y, closest) {
        var corners = [{ x: 0, y: 0 }, { x: 0, y: bounds.height }, { x: bounds.width, y: 0 }, { x: bounds.width, y: bounds.height }];

        // $FlowFixMe
        return corners.reduce(function (stat, corner) {
            var d = (0, Util.distance)(x - corner.x, y - corner.y);
            if (closest ? d < stat.optimumDistance : d > stat.optimumDistance) {
                return {
                    optimumCorner: corner,
                    optimumDistance: d
                };
            }

            return stat;
        }, {
            optimumDistance: closest ? Infinity : -Infinity,
            optimumCorner: null
        }).optimumCorner;
    };

    var calculateRadius = function calculateRadius(extent, shape, center, radius, bounds) {
        var x = center.x;
        var y = center.y;
        var rx = 0;
        var ry = 0;

        switch (extent) {
            case 'closest-side':
                // The ending shape is sized so that that it exactly meets the side of the gradient box closest to the gradient’s center.
                // If the shape is an ellipse, it exactly meets the closest side in each dimension.
                if (shape === RADIAL_GRADIENT_SHAPE.CIRCLE) {
                    rx = ry = Math.min(Math.abs(x), Math.abs(x - bounds.width), Math.abs(y), Math.abs(y - bounds.height));
                } else if (shape === RADIAL_GRADIENT_SHAPE.ELLIPSE) {
                    rx = Math.min(Math.abs(x), Math.abs(x - bounds.width));
                    ry = Math.min(Math.abs(y), Math.abs(y - bounds.height));
                }
                break;

            case 'closest-corner':
                // The ending shape is sized so that that it passes through the corner of the gradient box closest to the gradient’s center.
                // If the shape is an ellipse, the ending shape is given the same aspect-ratio it would have if closest-side were specified.
                if (shape === RADIAL_GRADIENT_SHAPE.CIRCLE) {
                    rx = ry = Math.min((0, Util.distance)(x, y), (0, Util.distance)(x, y - bounds.height), (0, Util.distance)(x - bounds.width, y), (0, Util.distance)(x - bounds.width, y - bounds.height));
                } else if (shape === RADIAL_GRADIENT_SHAPE.ELLIPSE) {
                    // Compute the ratio ry/rx (which is to be the same as for "closest-side")
                    var c = Math.min(Math.abs(y), Math.abs(y - bounds.height)) / Math.min(Math.abs(x), Math.abs(x - bounds.width));
                    var corner = findCorner(bounds, x, y, true);
                    rx = (0, Util.distance)(corner.x - x, (corner.y - y) / c);
                    ry = c * rx;
                }
                break;

            case 'farthest-side':
                // Same as closest-side, except the ending shape is sized based on the farthest side(s)
                if (shape === RADIAL_GRADIENT_SHAPE.CIRCLE) {
                    rx = ry = Math.max(Math.abs(x), Math.abs(x - bounds.width), Math.abs(y), Math.abs(y - bounds.height));
                } else if (shape === RADIAL_GRADIENT_SHAPE.ELLIPSE) {
                    rx = Math.max(Math.abs(x), Math.abs(x - bounds.width));
                    ry = Math.max(Math.abs(y), Math.abs(y - bounds.height));
                }
                break;

            case 'farthest-corner':
                // Same as closest-corner, except the ending shape is sized based on the farthest corner.
                // If the shape is an ellipse, the ending shape is given the same aspect ratio it would have if farthest-side were specified.
                if (shape === RADIAL_GRADIENT_SHAPE.CIRCLE) {
                    rx = ry = Math.max((0, Util.distance)(x, y), (0, Util.distance)(x, y - bounds.height), (0, Util.distance)(x - bounds.width, y), (0, Util.distance)(x - bounds.width, y - bounds.height));
                } else if (shape === RADIAL_GRADIENT_SHAPE.ELLIPSE) {
                    // Compute the ratio ry/rx (which is to be the same as for "farthest-side")
                    var _c = Math.max(Math.abs(y), Math.abs(y - bounds.height)) / Math.max(Math.abs(x), Math.abs(x - bounds.width));
                    var _corner = findCorner(bounds, x, y, false);
                    rx = (0, Util.distance)(_corner.x - x, (_corner.y - y) / _c);
                    ry = _c * rx;
                }
                break;

            default:
                // pixel or percentage values
                rx = radius.x || 0;
                ry = radius.y !== undefined ? radius.y : rx;
                break;
        }

        return {
            x: rx,
            y: ry
        };
    };

    var transformWebkitRadialGradientArgs = exports.transformWebkitRadialGradientArgs = function transformWebkitRadialGradientArgs(args) {
        var shape = '';
        var radius = '';
        var extent = '';
        var position = '';
        var idx = 0;

        var POSITION = /^(left|center|right|\d+(?:px|r?em|%)?)(?:\s+(top|center|bottom|\d+(?:px|r?em|%)?))?$/i;
        var SHAPE_AND_EXTENT = /^(circle|ellipse)?\s*(closest-side|closest-corner|farthest-side|farthest-corner|contain|cover)?$/i;
        var RADIUS = /^\d+(px|r?em|%)?(?:\s+\d+(px|r?em|%)?)?$/i;

        var matchStartPosition = args[idx].match(POSITION);
        if (matchStartPosition) {
            idx++;
        }

        var matchShapeExtent = args[idx].match(SHAPE_AND_EXTENT);
        if (matchShapeExtent) {
            shape = matchShapeExtent[1] || '';
            extent = matchShapeExtent[2] || '';
            if (extent === 'contain') {
                extent = 'closest-side';
            } else if (extent === 'cover') {
                extent = 'farthest-corner';
            }
            idx++;
        }

        var matchStartRadius = args[idx].match(RADIUS);
        if (matchStartRadius) {
            idx++;
        }

        var matchEndPosition = args[idx].match(POSITION);
        if (matchEndPosition) {
            idx++;
        }

        var matchEndRadius = args[idx].match(RADIUS);
        if (matchEndRadius) {
            idx++;
        }

        var matchPosition = matchEndPosition || matchStartPosition;
        if (matchPosition && matchPosition[1]) {
            position = matchPosition[1] + (/^\d+$/.test(matchPosition[1]) ? 'px' : '');
            if (matchPosition[2]) {
                position += ' ' + matchPosition[2] + (/^\d+$/.test(matchPosition[2]) ? 'px' : '');
            }
        }

        var matchRadius = matchEndRadius || matchStartRadius;
        if (matchRadius) {
            radius = matchRadius[0];
            if (!matchRadius[1]) {
                radius += 'px';
            }
        }

        if (position && !shape && !radius && !extent) {
            radius = position;
            position = '';
        }

        if (position) {
            position = 'at ' + position;
        }

        return [[shape, extent, radius, position].filter(function (s) {
            return !!s;
        }).join(' ')].concat(args.slice(idx));
    };

    var transformObsoleteColorStops = function transformObsoleteColorStops(args) {
        return args.map(function (color) {
            return color.match(FROM_TO_COLORSTOP);
        })
        // $FlowFixMe
        .map(function (v, index) {
            if (!v) {
                return args[index];
            }

            switch (v[1]) {
                case 'from':
                    return v[4] + ' 0%';
                case 'to':
                    return v[4] + ' 100%';
                case 'color-stop':
                    if (v[3] === '%') {
                        return v[4] + ' ' + v[2];
                    }
                    return v[4] + ' ' + parseFloat(v[2]) * 100 + '%';
            }
        });
    };
    });

    unwrapExports(Gradient);
    var Gradient_1 = Gradient.transformWebkitRadialGradientArgs;
    var Gradient_2 = Gradient.parseGradient;
    var Gradient_3 = Gradient.RadialGradient;
    var Gradient_4 = Gradient.LinearGradient;
    var Gradient_5 = Gradient.RADIAL_GRADIENT_SHAPE;
    var Gradient_6 = Gradient.GRADIENT_TYPE;

    var Renderer_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();









    var _TextContainer2 = _interopRequireDefault(TextContainer_1);





    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var Renderer = function () {
        function Renderer(target, options) {
            _classCallCheck(this, Renderer);

            this.target = target;
            this.options = options;
            target.render(options);
        }

        _createClass(Renderer, [{
            key: 'renderNode',
            value: function renderNode(container) {
                if (container.isVisible()) {
                    this.renderNodeBackgroundAndBorders(container);
                    this.renderNodeContent(container);
                }
            }
        }, {
            key: 'renderNodeContent',
            value: function renderNodeContent(container) {
                var _this = this;

                var callback = function callback() {
                    if (container.childNodes.length) {
                        container.childNodes.forEach(function (child) {
                            if (child instanceof _TextContainer2.default) {
                                var style = child.parent.style;
                                _this.target.renderTextNode(child.bounds, style.color, style.font, style.textDecoration, style.textShadow);
                            } else {
                                _this.target.drawShape(child, container.style.color);
                            }
                        });
                    }

                    if (container.image) {
                        var _image = _this.options.imageStore.get(container.image);
                        if (_image) {
                            var contentBox = (0, Bounds_1.calculateContentBox)(container.bounds, container.style.padding, container.style.border);
                            var _width = typeof _image.width === 'number' && _image.width > 0 ? _image.width : contentBox.width;
                            var _height = typeof _image.height === 'number' && _image.height > 0 ? _image.height : contentBox.height;
                            if (_width > 0 && _height > 0) {
                                _this.target.clip([(0, Bounds_1.calculatePaddingBoxPath)(container.curvedBounds)], function () {
                                    _this.target.drawImage(_image, new Bounds_1.Bounds(0, 0, _width, _height), contentBox);
                                });
                            }
                        }
                    }
                };
                var paths = container.getClipPaths();
                if (paths.length) {
                    this.target.clip(paths, callback);
                } else {
                    callback();
                }
            }
        }, {
            key: 'renderNodeBackgroundAndBorders',
            value: function renderNodeBackgroundAndBorders(container) {
                var _this2 = this;

                var HAS_BACKGROUND = !container.style.background.backgroundColor.isTransparent() || container.style.background.backgroundImage.length;

                var hasRenderableBorders = container.style.border.some(function (border$$1) {
                    return border$$1.borderStyle !== border.BORDER_STYLE.NONE && !border$$1.borderColor.isTransparent();
                });

                var callback = function callback() {
                    var backgroundPaintingArea = (0, background.calculateBackgroungPaintingArea)(container.curvedBounds, container.style.background.backgroundClip);

                    if (HAS_BACKGROUND) {
                        _this2.target.clip([backgroundPaintingArea], function () {
                            if (!container.style.background.backgroundColor.isTransparent()) {
                                _this2.target.fill(container.style.background.backgroundColor);
                            }

                            _this2.renderBackgroundImage(container);
                        });
                    }

                    container.style.border.forEach(function (border$$1, side) {
                        if (border$$1.borderStyle !== border.BORDER_STYLE.NONE && !border$$1.borderColor.isTransparent()) {
                            _this2.renderBorder(border$$1, side, container.curvedBounds);
                        }
                    });
                };

                if (HAS_BACKGROUND || hasRenderableBorders) {
                    var paths = container.parent ? container.parent.getClipPaths() : [];
                    if (paths.length) {
                        this.target.clip(paths, callback);
                    } else {
                        callback();
                    }
                }
            }
        }, {
            key: 'renderBackgroundImage',
            value: function renderBackgroundImage(container) {
                var _this3 = this;

                container.style.background.backgroundImage.slice(0).reverse().forEach(function (backgroundImage) {
                    if (backgroundImage.source.method === 'url' && backgroundImage.source.args.length) {
                        _this3.renderBackgroundRepeat(container, backgroundImage);
                    } else if (/gradient/i.test(backgroundImage.source.method)) {
                        _this3.renderBackgroundGradient(container, backgroundImage);
                    }
                });
            }
        }, {
            key: 'renderBackgroundRepeat',
            value: function renderBackgroundRepeat(container, background$$1) {
                var image = this.options.imageStore.get(background$$1.source.args[0]);
                if (image) {
                    var backgroundPositioningArea = (0, background.calculateBackgroungPositioningArea)(container.style.background.backgroundOrigin, container.bounds, container.style.padding, container.style.border);
                    var backgroundImageSize = (0, background.calculateBackgroundSize)(background$$1, image, backgroundPositioningArea);
                    var position = (0, background.calculateBackgroundPosition)(background$$1.position, backgroundImageSize, backgroundPositioningArea);
                    var _path = (0, background.calculateBackgroundRepeatPath)(background$$1, position, backgroundImageSize, backgroundPositioningArea, container.bounds);

                    var _offsetX = Math.round(backgroundPositioningArea.left + position.x);
                    var _offsetY = Math.round(backgroundPositioningArea.top + position.y);
                    this.target.renderRepeat(_path, image, backgroundImageSize, _offsetX, _offsetY);
                }
            }
        }, {
            key: 'renderBackgroundGradient',
            value: function renderBackgroundGradient(container, background$$1) {
                var backgroundPositioningArea = (0, background.calculateBackgroungPositioningArea)(container.style.background.backgroundOrigin, container.bounds, container.style.padding, container.style.border);
                var backgroundImageSize = (0, background.calculateGradientBackgroundSize)(background$$1, backgroundPositioningArea);
                var position = (0, background.calculateBackgroundPosition)(background$$1.position, backgroundImageSize, backgroundPositioningArea);
                var gradientBounds = new Bounds_1.Bounds(Math.round(backgroundPositioningArea.left + position.x), Math.round(backgroundPositioningArea.top + position.y), backgroundImageSize.width, backgroundImageSize.height);

                var gradient = (0, Gradient.parseGradient)(container, background$$1.source, gradientBounds);
                if (gradient) {
                    switch (gradient.type) {
                        case Gradient.GRADIENT_TYPE.LINEAR_GRADIENT:
                            // $FlowFixMe
                            this.target.renderLinearGradient(gradientBounds, gradient);
                            break;
                        case Gradient.GRADIENT_TYPE.RADIAL_GRADIENT:
                            // $FlowFixMe
                            this.target.renderRadialGradient(gradientBounds, gradient);
                            break;
                    }
                }
            }
        }, {
            key: 'renderBorder',
            value: function renderBorder(border$$1, side, curvePoints) {
                this.target.drawShape((0, Bounds_1.parsePathForBorder)(curvePoints, side), border$$1.borderColor);
            }
        }, {
            key: 'renderStack',
            value: function renderStack(stack) {
                var _this4 = this;

                if (stack.container.isVisible()) {
                    var _opacity = stack.getOpacity();
                    if (_opacity !== this._opacity) {
                        this.target.setOpacity(stack.getOpacity());
                        this._opacity = _opacity;
                    }

                    var _transform = stack.container.style.transform;
                    if (_transform !== null) {
                        this.target.transform(stack.container.bounds.left + _transform.transformOrigin[0].value, stack.container.bounds.top + _transform.transformOrigin[1].value, _transform.transform, function () {
                            return _this4.renderStackContent(stack);
                        });
                    } else {
                        this.renderStackContent(stack);
                    }
                }
            }
        }, {
            key: 'renderStackContent',
            value: function renderStackContent(stack) {
                var _splitStackingContext = splitStackingContexts(stack),
                    _splitStackingContext2 = _slicedToArray(_splitStackingContext, 5),
                    negativeZIndex = _splitStackingContext2[0],
                    zeroOrAutoZIndexOrTransformedOrOpacity = _splitStackingContext2[1],
                    positiveZIndex = _splitStackingContext2[2],
                    nonPositionedFloats = _splitStackingContext2[3],
                    nonPositionedInlineLevel = _splitStackingContext2[4];

                var _splitDescendants = splitDescendants(stack),
                    _splitDescendants2 = _slicedToArray(_splitDescendants, 2),
                    inlineLevel = _splitDescendants2[0],
                    nonInlineLevel = _splitDescendants2[1];

                // https://www.w3.org/TR/css-position-3/#painting-order
                // 1. the background and borders of the element forming the stacking context.


                this.renderNodeBackgroundAndBorders(stack.container);
                // 2. the child stacking contexts with negative stack levels (most negative first).
                negativeZIndex.sort(sortByZIndex).forEach(this.renderStack, this);
                // 3. For all its in-flow, non-positioned, block-level descendants in tree order:
                this.renderNodeContent(stack.container);
                nonInlineLevel.forEach(this.renderNode, this);
                // 4. All non-positioned floating descendants, in tree order. For each one of these,
                // treat the element as if it created a new stacking context, but any positioned descendants and descendants
                // which actually create a new stacking context should be considered part of the parent stacking context,
                // not this new one.
                nonPositionedFloats.forEach(this.renderStack, this);
                // 5. the in-flow, inline-level, non-positioned descendants, including inline tables and inline blocks.
                nonPositionedInlineLevel.forEach(this.renderStack, this);
                inlineLevel.forEach(this.renderNode, this);
                // 6. All positioned, opacity or transform descendants, in tree order that fall into the following categories:
                //  All positioned descendants with 'z-index: auto' or 'z-index: 0', in tree order.
                //  For those with 'z-index: auto', treat the element as if it created a new stacking context,
                //  but any positioned descendants and descendants which actually create a new stacking context should be
                //  considered part of the parent stacking context, not this new one. For those with 'z-index: 0',
                //  treat the stacking context generated atomically.
                //
                //  All opacity descendants with opacity less than 1
                //
                //  All transform descendants with transform other than none
                zeroOrAutoZIndexOrTransformedOrOpacity.forEach(this.renderStack, this);
                // 7. Stacking contexts formed by positioned descendants with z-indices greater than or equal to 1 in z-index
                // order (smallest first) then tree order.
                positiveZIndex.sort(sortByZIndex).forEach(this.renderStack, this);
            }
        }, {
            key: 'render',
            value: function render(stack) {
                var _this5 = this;

                if (this.options.backgroundColor) {
                    this.target.rectangle(this.options.x, this.options.y, this.options.width, this.options.height, this.options.backgroundColor);
                }
                this.renderStack(stack);
                var target = this.target.getTarget();
                if (process.env.NODE_ENV !== 'production') {
                    return target.then(function (output) {
                        _this5.options.logger.log('Render completed');
                        return output;
                    });
                }
                return target;
            }
        }]);

        return Renderer;
    }();

    exports.default = Renderer;


    var splitDescendants = function splitDescendants(stack) {
        var inlineLevel = [];
        var nonInlineLevel = [];

        var length = stack.children.length;
        for (var i = 0; i < length; i++) {
            var child = stack.children[i];
            if (child.isInlineLevel()) {
                inlineLevel.push(child);
            } else {
                nonInlineLevel.push(child);
            }
        }
        return [inlineLevel, nonInlineLevel];
    };

    var splitStackingContexts = function splitStackingContexts(stack) {
        var negativeZIndex = [];
        var zeroOrAutoZIndexOrTransformedOrOpacity = [];
        var positiveZIndex = [];
        var nonPositionedFloats = [];
        var nonPositionedInlineLevel = [];
        var length = stack.contexts.length;
        for (var i = 0; i < length; i++) {
            var child = stack.contexts[i];
            if (child.container.isPositioned() || child.container.style.opacity < 1 || child.container.isTransformed()) {
                if (child.container.style.zIndex.order < 0) {
                    negativeZIndex.push(child);
                } else if (child.container.style.zIndex.order > 0) {
                    positiveZIndex.push(child);
                } else {
                    zeroOrAutoZIndexOrTransformedOrOpacity.push(child);
                }
            } else {
                if (child.container.isFloating()) {
                    nonPositionedFloats.push(child);
                } else {
                    nonPositionedInlineLevel.push(child);
                }
            }
        }
        return [negativeZIndex, zeroOrAutoZIndexOrTransformedOrOpacity, positiveZIndex, nonPositionedFloats, nonPositionedInlineLevel];
    };

    var sortByZIndex = function sortByZIndex(a, b) {
        if (a.container.style.zIndex.order > b.container.style.zIndex.order) {
            return 1;
        } else if (a.container.style.zIndex.order < b.container.style.zIndex.order) {
            return -1;
        }

        return a.container.index > b.container.index ? 1 : -1;
    };
    });

    var Renderer = unwrapExports(Renderer_1);

    var _Proxy = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.Proxy = undefined;



    var _Feature2 = _interopRequireDefault(Feature);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var Proxy = exports.Proxy = function Proxy(src, options) {
        if (!options.proxy) {
            return Promise.reject(process.env.NODE_ENV !== 'production' ? 'No proxy defined' : null);
        }
        var proxy = options.proxy;

        return new Promise(function (resolve, reject) {
            var responseType = _Feature2.default.SUPPORT_CORS_XHR && _Feature2.default.SUPPORT_RESPONSE_TYPE ? 'blob' : 'text';
            var xhr = _Feature2.default.SUPPORT_CORS_XHR ? new XMLHttpRequest() : new XDomainRequest();
            xhr.onload = function () {
                if (xhr instanceof XMLHttpRequest) {
                    if (xhr.status === 200) {
                        if (responseType === 'text') {
                            resolve(xhr.response);
                        } else {
                            var reader = new FileReader();
                            // $FlowFixMe
                            reader.addEventListener('load', function () {
                                return resolve(reader.result);
                            }, false);
                            // $FlowFixMe
                            reader.addEventListener('error', function (e) {
                                return reject(e);
                            }, false);
                            reader.readAsDataURL(xhr.response);
                        }
                    } else {
                        reject(process.env.NODE_ENV !== 'production' ? 'Failed to proxy resource ' + src.substring(0, 256) + ' with status code ' + xhr.status : '');
                    }
                } else {
                    resolve(xhr.responseText);
                }
            };

            xhr.onerror = reject;
            xhr.open('GET', proxy + '?url=' + encodeURIComponent(src) + '&responseType=' + responseType);

            if (responseType !== 'text' && xhr instanceof XMLHttpRequest) {
                xhr.responseType = responseType;
            }

            if (options.imageTimeout) {
                var timeout = options.imageTimeout;
                xhr.timeout = timeout;
                xhr.ontimeout = function () {
                    return reject(process.env.NODE_ENV !== 'production' ? 'Timed out (' + timeout + 'ms) proxying ' + src.substring(0, 256) : '');
                };
            }

            xhr.send();
        });
    };
    });

    unwrapExports(_Proxy);
    var _Proxy_1 = _Proxy.Proxy;

    var ResourceLoader_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.ResourceStore = undefined;

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();



    var _Feature2 = _interopRequireDefault(Feature);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var ResourceLoader = function () {
        function ResourceLoader(options, logger, window) {
            _classCallCheck(this, ResourceLoader);

            this.options = options;
            this._window = window;
            this.origin = this.getOrigin(window.location.href);
            this.cache = {};
            this.logger = logger;
            this._index = 0;
        }

        _createClass(ResourceLoader, [{
            key: 'loadImage',
            value: function loadImage(src) {
                var _this = this;

                if (this.hasResourceInCache(src)) {
                    return src;
                }
                if (isBlobImage(src)) {
                    this.cache[src] = _loadImage(src, this.options.imageTimeout || 0);
                    return src;
                }

                if (!isSVG(src) || _Feature2.default.SUPPORT_SVG_DRAWING) {
                    if (this.options.allowTaint === true || isInlineImage(src) || this.isSameOrigin(src)) {
                        return this.addImage(src, src, false);
                    } else if (!this.isSameOrigin(src)) {
                        if (typeof this.options.proxy === 'string') {
                            this.cache[src] = (0, _Proxy.Proxy)(src, this.options).then(function (src) {
                                return _loadImage(src, _this.options.imageTimeout || 0);
                            });
                            return src;
                        } else if (this.options.useCORS === true && _Feature2.default.SUPPORT_CORS_IMAGES) {
                            return this.addImage(src, src, true);
                        }
                    }
                }
            }
        }, {
            key: 'inlineImage',
            value: function inlineImage(src) {
                var _this2 = this;

                if (isInlineImage(src)) {
                    return _loadImage(src, this.options.imageTimeout || 0);
                }
                if (this.hasResourceInCache(src)) {
                    return this.cache[src];
                }
                if (!this.isSameOrigin(src) && typeof this.options.proxy === 'string') {
                    return this.cache[src] = (0, _Proxy.Proxy)(src, this.options).then(function (src) {
                        return _loadImage(src, _this2.options.imageTimeout || 0);
                    });
                }

                return this.xhrImage(src);
            }
        }, {
            key: 'xhrImage',
            value: function xhrImage(src) {
                var _this3 = this;

                this.cache[src] = new Promise(function (resolve, reject) {
                    var xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState === 4) {
                            if (xhr.status !== 200) {
                                reject('Failed to fetch image ' + src.substring(0, 256) + ' with status code ' + xhr.status);
                            } else {
                                var reader = new FileReader();
                                reader.addEventListener('load', function () {
                                    // $FlowFixMe
                                    var result = reader.result;
                                    resolve(result);
                                }, false);
                                reader.addEventListener('error', function (e) {
                                    return reject(e);
                                }, false);
                                reader.readAsDataURL(xhr.response);
                            }
                        }
                    };
                    xhr.responseType = 'blob';
                    if (_this3.options.imageTimeout) {
                        var timeout = _this3.options.imageTimeout;
                        xhr.timeout = timeout;
                        xhr.ontimeout = function () {
                            return reject(process.env.NODE_ENV !== 'production' ? 'Timed out (' + timeout + 'ms) fetching ' + src.substring(0, 256) : '');
                        };
                    }
                    xhr.open('GET', src, true);
                    xhr.send();
                }).then(function (src) {
                    return _loadImage(src, _this3.options.imageTimeout || 0);
                });

                return this.cache[src];
            }
        }, {
            key: 'loadCanvas',
            value: function loadCanvas(node) {
                var key = String(this._index++);
                this.cache[key] = Promise.resolve(node);
                return key;
            }
        }, {
            key: 'hasResourceInCache',
            value: function hasResourceInCache(key) {
                return typeof this.cache[key] !== 'undefined';
            }
        }, {
            key: 'addImage',
            value: function addImage(key, src, useCORS) {
                var _this4 = this;

                if (process.env.NODE_ENV !== 'production') {
                    this.logger.log('Added image ' + key.substring(0, 256));
                }

                var imageLoadHandler = function imageLoadHandler(supportsDataImages) {
                    return new Promise(function (resolve, reject) {
                        var img = new Image();
                        img.onload = function () {
                            return resolve(img);
                        };
                        //ios safari 10.3 taints canvas with data urls unless crossOrigin is set to anonymous
                        if (!supportsDataImages || useCORS) {
                            img.crossOrigin = 'anonymous';
                        }

                        img.onerror = reject;
                        img.src = src;
                        if (img.complete === true) {
                            // Inline XML images may fail to parse, throwing an Error later on
                            setTimeout(function () {
                                resolve(img);
                            }, 500);
                        }
                        if (_this4.options.imageTimeout) {
                            var timeout = _this4.options.imageTimeout;
                            setTimeout(function () {
                                return reject(process.env.NODE_ENV !== 'production' ? 'Timed out (' + timeout + 'ms) fetching ' + src.substring(0, 256) : '');
                            }, timeout);
                        }
                    });
                };

                this.cache[key] = isInlineBase64Image(src) && !isSVG(src) ? // $FlowFixMe
                _Feature2.default.SUPPORT_BASE64_DRAWING(src).then(imageLoadHandler) : imageLoadHandler(true);
                return key;
            }
        }, {
            key: 'isSameOrigin',
            value: function isSameOrigin(url) {
                return this.getOrigin(url) === this.origin;
            }
        }, {
            key: 'getOrigin',
            value: function getOrigin(url) {
                var link = this._link || (this._link = this._window.document.createElement('a'));
                link.href = url;
                link.href = link.href; // IE9, LOL! - http://jsfiddle.net/niklasvh/2e48b/
                return link.protocol + link.hostname + link.port;
            }
        }, {
            key: 'ready',
            value: function ready() {
                var _this5 = this;

                var keys = Object.keys(this.cache);
                var values = keys.map(function (str) {
                    return _this5.cache[str].catch(function (e) {
                        if (process.env.NODE_ENV !== 'production') {
                            _this5.logger.log('Unable to load image', e);
                        }
                        return null;
                    });
                });
                return Promise.all(values).then(function (images) {
                    if (process.env.NODE_ENV !== 'production') {
                        _this5.logger.log('Finished loading ' + images.length + ' images', images);
                    }
                    return new ResourceStore(keys, images);
                });
            }
        }]);

        return ResourceLoader;
    }();

    exports.default = ResourceLoader;

    var ResourceStore = exports.ResourceStore = function () {
        function ResourceStore(keys, resources) {
            _classCallCheck(this, ResourceStore);

            this._keys = keys;
            this._resources = resources;
        }

        _createClass(ResourceStore, [{
            key: 'get',
            value: function get(key) {
                var index = this._keys.indexOf(key);
                return index === -1 ? null : this._resources[index];
            }
        }]);

        return ResourceStore;
    }();

    var INLINE_SVG = /^data:image\/svg\+xml/i;
    var INLINE_BASE64 = /^data:image\/.*;base64,/i;
    var INLINE_IMG = /^data:image\/.*/i;

    var isInlineImage = function isInlineImage(src) {
        return INLINE_IMG.test(src);
    };
    var isInlineBase64Image = function isInlineBase64Image(src) {
        return INLINE_BASE64.test(src);
    };
    var isBlobImage = function isBlobImage(src) {
        return src.substr(0, 4) === 'blob';
    };

    var isSVG = function isSVG(src) {
        return src.substr(-3).toLowerCase() === 'svg' || INLINE_SVG.test(src);
    };

    var _loadImage = function _loadImage(src, timeout) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () {
                return resolve(img);
            };
            img.onerror = reject;
            img.src = src;
            if (img.complete === true) {
                // Inline XML images may fail to parse, throwing an Error later on
                setTimeout(function () {
                    resolve(img);
                }, 500);
            }
            if (timeout) {
                setTimeout(function () {
                    return reject(process.env.NODE_ENV !== 'production' ? 'Timed out (' + timeout + 'ms) loading image' : '');
                }, timeout);
            }
        });
    };
    });

    var ResourceLoader = unwrapExports(ResourceLoader_1);
    var ResourceLoader_2 = ResourceLoader_1.ResourceStore;

    var PseudoNodeContent = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.parseContent = exports.resolvePseudoContent = exports.popCounters = exports.parseCounterReset = exports.TOKEN_TYPE = exports.PSEUDO_CONTENT_ITEM_TYPE = undefined;

    var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();





    var PSEUDO_CONTENT_ITEM_TYPE = exports.PSEUDO_CONTENT_ITEM_TYPE = {
        TEXT: 0,
        IMAGE: 1
    };

    var TOKEN_TYPE = exports.TOKEN_TYPE = {
        STRING: 0,
        ATTRIBUTE: 1,
        URL: 2,
        COUNTER: 3,
        COUNTERS: 4,
        OPENQUOTE: 5,
        CLOSEQUOTE: 6
    };

    var parseCounterReset = exports.parseCounterReset = function parseCounterReset(style, data) {
        if (!style || !style.counterReset || style.counterReset === 'none') {
            return [];
        }

        var counterNames = [];
        var counterResets = style.counterReset.split(/\s*,\s*/);
        var lenCounterResets = counterResets.length;

        for (var i = 0; i < lenCounterResets; i++) {
            var _counterResets$i$spli = counterResets[i].split(/\s+/),
                _counterResets$i$spli2 = _slicedToArray(_counterResets$i$spli, 2),
                counterName = _counterResets$i$spli2[0],
                initialValue = _counterResets$i$spli2[1];

            counterNames.push(counterName);
            var counter = data.counters[counterName];
            if (!counter) {
                counter = data.counters[counterName] = [];
            }
            counter.push(parseInt(initialValue || 0, 10));
        }

        return counterNames;
    };

    var popCounters = exports.popCounters = function popCounters(counterNames, data) {
        var lenCounters = counterNames.length;
        for (var i = 0; i < lenCounters; i++) {
            data.counters[counterNames[i]].pop();
        }
    };

    var resolvePseudoContent = exports.resolvePseudoContent = function resolvePseudoContent(node, style, data) {
        if (!style || !style.content || style.content === 'none' || style.content === '-moz-alt-content' || style.display === 'none') {
            return null;
        }

        var tokens = parseContent(style.content);

        var len = tokens.length;
        var contentItems = [];
        var s = '';

        // increment the counter (if there is a "counter-increment" declaration)
        var counterIncrement = style.counterIncrement;
        if (counterIncrement && counterIncrement !== 'none') {
            var _counterIncrement$spl = counterIncrement.split(/\s+/),
                _counterIncrement$spl2 = _slicedToArray(_counterIncrement$spl, 2),
                counterName = _counterIncrement$spl2[0],
                incrementValue = _counterIncrement$spl2[1];

            var counter = data.counters[counterName];
            if (counter) {
                counter[counter.length - 1] += incrementValue === undefined ? 1 : parseInt(incrementValue, 10);
            }
        }

        // build the content string
        for (var i = 0; i < len; i++) {
            var token = tokens[i];
            switch (token.type) {
                case TOKEN_TYPE.STRING:
                    s += token.value || '';
                    break;

                case TOKEN_TYPE.ATTRIBUTE:
                    if (node instanceof HTMLElement && token.value) {
                        s += node.getAttribute(token.value) || '';
                    }
                    break;

                case TOKEN_TYPE.COUNTER:
                    var _counter = data.counters[token.name || ''];
                    if (_counter) {
                        s += formatCounterValue([_counter[_counter.length - 1]], '', token.format);
                    }
                    break;

                case TOKEN_TYPE.COUNTERS:
                    var _counters = data.counters[token.name || ''];
                    if (_counters) {
                        s += formatCounterValue(_counters, token.glue, token.format);
                    }
                    break;

                case TOKEN_TYPE.OPENQUOTE:
                    s += getQuote(style, true, data.quoteDepth);
                    data.quoteDepth++;
                    break;

                case TOKEN_TYPE.CLOSEQUOTE:
                    data.quoteDepth--;
                    s += getQuote(style, false, data.quoteDepth);
                    break;

                case TOKEN_TYPE.URL:
                    if (s) {
                        contentItems.push({ type: PSEUDO_CONTENT_ITEM_TYPE.TEXT, value: s });
                        s = '';
                    }
                    contentItems.push({ type: PSEUDO_CONTENT_ITEM_TYPE.IMAGE, value: token.value || '' });
                    break;
            }
        }

        if (s) {
            contentItems.push({ type: PSEUDO_CONTENT_ITEM_TYPE.TEXT, value: s });
        }

        return contentItems;
    };

    var parseContent = exports.parseContent = function parseContent(content, cache) {
        if (cache && cache[content]) {
            return cache[content];
        }

        var tokens = [];
        var len = content.length;

        var isString = false;
        var isEscaped = false;
        var isFunction = false;
        var str = '';
        var functionName = '';
        var args = [];

        for (var i = 0; i < len; i++) {
            var c = content.charAt(i);

            switch (c) {
                case "'":
                case '"':
                    if (isEscaped) {
                        str += c;
                    } else {
                        isString = !isString;
                        if (!isFunction && !isString) {
                            tokens.push({ type: TOKEN_TYPE.STRING, value: str });
                            str = '';
                        }
                    }
                    break;

                case '\\':
                    if (isEscaped) {
                        str += c;
                        isEscaped = false;
                    } else {
                        isEscaped = true;
                    }
                    break;

                case '(':
                    if (isString) {
                        str += c;
                    } else {
                        isFunction = true;
                        functionName = str;
                        str = '';
                        args = [];
                    }
                    break;

                case ')':
                    if (isString) {
                        str += c;
                    } else if (isFunction) {
                        if (str) {
                            args.push(str);
                        }

                        switch (functionName) {
                            case 'attr':
                                if (args.length > 0) {
                                    tokens.push({ type: TOKEN_TYPE.ATTRIBUTE, value: args[0] });
                                }
                                break;

                            case 'counter':
                                if (args.length > 0) {
                                    var counter = {
                                        type: TOKEN_TYPE.COUNTER,
                                        name: args[0]
                                    };
                                    if (args.length > 1) {
                                        counter.format = args[1];
                                    }
                                    tokens.push(counter);
                                }
                                break;

                            case 'counters':
                                if (args.length > 0) {
                                    var _counters2 = {
                                        type: TOKEN_TYPE.COUNTERS,
                                        name: args[0]
                                    };
                                    if (args.length > 1) {
                                        _counters2.glue = args[1];
                                    }
                                    if (args.length > 2) {
                                        _counters2.format = args[2];
                                    }
                                    tokens.push(_counters2);
                                }
                                break;

                            case 'url':
                                if (args.length > 0) {
                                    tokens.push({ type: TOKEN_TYPE.URL, value: args[0] });
                                }
                                break;
                        }

                        isFunction = false;
                        str = '';
                    }
                    break;

                case ',':
                    if (isString) {
                        str += c;
                    } else if (isFunction) {
                        args.push(str);
                        str = '';
                    }
                    break;

                case ' ':
                case '\t':
                    if (isString) {
                        str += c;
                    } else if (str) {
                        addOtherToken(tokens, str);
                        str = '';
                    }
                    break;

                default:
                    str += c;
            }

            if (c !== '\\') {
                isEscaped = false;
            }
        }

        if (str) {
            addOtherToken(tokens, str);
        }

        if (cache) {
            cache[content] = tokens;
        }

        return tokens;
    };

    var addOtherToken = function addOtherToken(tokens, identifier) {
        switch (identifier) {
            case 'open-quote':
                tokens.push({ type: TOKEN_TYPE.OPENQUOTE });
                break;
            case 'close-quote':
                tokens.push({ type: TOKEN_TYPE.CLOSEQUOTE });
                break;
            default:
                tokens.push({ type: TOKEN_TYPE.STRING, value: identifier });
        }
    };

    var getQuote = function getQuote(style, isOpening, quoteDepth) {
        var quotes = style.quotes ? style.quotes.split(/\s+/) : ["'\"'", "'\"'"];
        var idx = quoteDepth * 2;
        if (idx >= quotes.length) {
            idx = quotes.length - 2;
        }
        if (!isOpening) {
            ++idx;
        }
        return quotes[idx].replace(/^["']|["']$/g, '');
    };

    var formatCounterValue = function formatCounterValue(counter, glue, format) {
        var len = counter.length;
        var result = '';

        for (var i = 0; i < len; i++) {
            if (i > 0) {
                result += glue || '';
            }
            result += (0, ListItem.createCounterText)(counter[i], (0, listStyle.parseListStyleType)(format || 'decimal'), false);
        }

        return result;
    };
    });

    unwrapExports(PseudoNodeContent);
    var PseudoNodeContent_1 = PseudoNodeContent.parseContent;
    var PseudoNodeContent_2 = PseudoNodeContent.resolvePseudoContent;
    var PseudoNodeContent_3 = PseudoNodeContent.popCounters;
    var PseudoNodeContent_4 = PseudoNodeContent.parseCounterReset;
    var PseudoNodeContent_5 = PseudoNodeContent.TOKEN_TYPE;
    var PseudoNodeContent_6 = PseudoNodeContent.PSEUDO_CONTENT_ITEM_TYPE;

    var Clone = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.cloneWindow = exports.DocumentCloner = undefined;

    var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();







    var _ResourceLoader2 = _interopRequireDefault(ResourceLoader_1);







    var _CanvasRenderer2 = _interopRequireDefault(CanvasRenderer_1);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    var IGNORE_ATTRIBUTE = 'data-html2canvas-ignore';

    var DocumentCloner = exports.DocumentCloner = function () {
        function DocumentCloner(element, options, logger, copyInline, renderer) {
            _classCallCheck(this, DocumentCloner);

            this.referenceElement = element;
            this.scrolledElements = [];
            this.copyStyles = copyInline;
            this.inlineImages = copyInline;
            this.logger = logger;
            this.options = options;
            this.renderer = renderer;
            this.resourceLoader = new _ResourceLoader2.default(options, logger, window);
            this.pseudoContentData = {
                counters: {},
                quoteDepth: 0
            };
            // $FlowFixMe
            this.documentElement = this.cloneNode(element.ownerDocument.documentElement);
        }

        _createClass(DocumentCloner, [{
            key: 'inlineAllImages',
            value: function inlineAllImages(node) {
                var _this = this;

                if (this.inlineImages && node) {
                    var style = node.style;
                    Promise.all((0, background.parseBackgroundImage)(style.backgroundImage).map(function (backgroundImage) {
                        if (backgroundImage.method === 'url') {
                            return _this.resourceLoader.inlineImage(backgroundImage.args[0]).then(function (img) {
                                return img && typeof img.src === 'string' ? 'url("' + img.src + '")' : 'none';
                            }).catch(function (e) {
                                if (process.env.NODE_ENV !== 'production') {
                                    _this.logger.log('Unable to load image', e);
                                }
                            });
                        }
                        return Promise.resolve('' + backgroundImage.prefix + backgroundImage.method + '(' + backgroundImage.args.join(',') + ')');
                    })).then(function (backgroundImages) {
                        if (backgroundImages.length > 1) {
                            // TODO Multiple backgrounds somehow broken in Chrome
                            style.backgroundColor = '';
                        }
                        style.backgroundImage = backgroundImages.join(',');
                    });

                    if (node instanceof HTMLImageElement) {
                        this.resourceLoader.inlineImage(node.src).then(function (img) {
                            if (img && node instanceof HTMLImageElement && node.parentNode) {
                                var parentNode = node.parentNode;
                                var clonedChild = (0, Util.copyCSSStyles)(node.style, img.cloneNode(false));
                                parentNode.replaceChild(clonedChild, node);
                            }
                        }).catch(function (e) {
                            if (process.env.NODE_ENV !== 'production') {
                                _this.logger.log('Unable to load image', e);
                            }
                        });
                    }
                }
            }
        }, {
            key: 'inlineFonts',
            value: function inlineFonts(document) {
                var _this2 = this;

                return Promise.all(Array.from(document.styleSheets).map(function (sheet) {
                    if (sheet.href) {
                        return fetch(sheet.href).then(function (res) {
                            return res.text();
                        }).then(function (text) {
                            return createStyleSheetFontsFromText(text, sheet.href);
                        }).catch(function (e) {
                            if (process.env.NODE_ENV !== 'production') {
                                _this2.logger.log('Unable to load stylesheet', e);
                            }
                            return [];
                        });
                    }
                    return getSheetFonts(sheet, document);
                })).then(function (fonts) {
                    return fonts.reduce(function (acc, font) {
                        return acc.concat(font);
                    }, []);
                }).then(function (fonts) {
                    return Promise.all(fonts.map(function (font) {
                        return fetch(font.formats[0].src).then(function (response) {
                            return response.blob();
                        }).then(function (blob) {
                            return new Promise(function (resolve, reject) {
                                var reader = new FileReader();
                                reader.onerror = reject;
                                reader.onload = function () {
                                    // $FlowFixMe
                                    var result = reader.result;
                                    resolve(result);
                                };
                                reader.readAsDataURL(blob);
                            });
                        }).then(function (dataUri) {
                            font.fontFace.setProperty('src', 'url("' + dataUri + '")');
                            return '@font-face {' + font.fontFace.cssText + ' ';
                        });
                    }));
                }).then(function (fontCss) {
                    var style = document.createElement('style');
                    style.textContent = fontCss.join('\n');
                    _this2.documentElement.appendChild(style);
                });
            }
        }, {
            key: 'createElementClone',
            value: function createElementClone(node) {
                var _this3 = this;

                if (this.copyStyles && node instanceof HTMLCanvasElement) {
                    var img = node.ownerDocument.createElement('img');
                    try {
                        img.src = node.toDataURL();
                        return img;
                    } catch (e) {
                        if (process.env.NODE_ENV !== 'production') {
                            this.logger.log('Unable to clone canvas contents, canvas is tainted');
                        }
                    }
                }

                if (node instanceof HTMLIFrameElement) {
                    var tempIframe = node.cloneNode(false);
                    var iframeKey = generateIframeKey();
                    tempIframe.setAttribute('data-html2canvas-internal-iframe-key', iframeKey);

                    var _parseBounds = (0, Bounds_1.parseBounds)(node, 0, 0),
                        width = _parseBounds.width,
                        height = _parseBounds.height;

                    this.resourceLoader.cache[iframeKey] = getIframeDocumentElement(node, this.options).then(function (documentElement) {
                        return _this3.renderer(documentElement, {
                            async: _this3.options.async,
                            allowTaint: _this3.options.allowTaint,
                            backgroundColor: '#ffffff',
                            canvas: null,
                            imageTimeout: _this3.options.imageTimeout,
                            logging: _this3.options.logging,
                            proxy: _this3.options.proxy,
                            removeContainer: _this3.options.removeContainer,
                            scale: _this3.options.scale,
                            foreignObjectRendering: _this3.options.foreignObjectRendering,
                            useCORS: _this3.options.useCORS,
                            target: new _CanvasRenderer2.default(),
                            width: width,
                            height: height,
                            x: 0,
                            y: 0,
                            windowWidth: documentElement.ownerDocument.defaultView.innerWidth,
                            windowHeight: documentElement.ownerDocument.defaultView.innerHeight,
                            scrollX: documentElement.ownerDocument.defaultView.pageXOffset,
                            scrollY: documentElement.ownerDocument.defaultView.pageYOffset
                        }, _this3.logger.child(iframeKey));
                    }).then(function (canvas) {
                        return new Promise(function (resolve, reject) {
                            var iframeCanvas = document.createElement('img');
                            iframeCanvas.onload = function () {
                                return resolve(canvas);
                            };
                            iframeCanvas.onerror = reject;
                            iframeCanvas.src = canvas.toDataURL();
                            if (tempIframe.parentNode) {
                                tempIframe.parentNode.replaceChild((0, Util.copyCSSStyles)(node.ownerDocument.defaultView.getComputedStyle(node), iframeCanvas), tempIframe);
                            }
                        });
                    });
                    return tempIframe;
                }

                if (node instanceof HTMLStyleElement && node.sheet && node.sheet.cssRules) {
                    var css = [].slice.call(node.sheet.cssRules, 0).reduce(function (css, rule) {
                        try {
                            if (rule && rule.cssText) {
                                return css + rule.cssText;
                            }
                            return css;
                        } catch (err) {
                            _this3.logger.log('Unable to access cssText property', rule.name);
                            return css;
                        }
                    }, '');
                    var style = node.cloneNode(false);
                    style.textContent = css;
                    return style;
                }

                return node.cloneNode(false);
            }
        }, {
            key: 'cloneNode',
            value: function cloneNode(node) {
                var clone = node.nodeType === Node.TEXT_NODE ? document.createTextNode(node.nodeValue) : this.createElementClone(node);

                var window = node.ownerDocument.defaultView;
                var style = node instanceof window.HTMLElement || node instanceof window.SVGElement ? window.getComputedStyle(node) : null;
                var styleBefore = node instanceof window.HTMLElement ? window.getComputedStyle(node, ':before') : null;
                var styleAfter = node instanceof window.HTMLElement ? window.getComputedStyle(node, ':after') : null;

                if (this.referenceElement === node && clone instanceof window.HTMLElement) {
                    this.clonedReferenceElement = clone;
                }

                if (clone instanceof window.HTMLBodyElement) {
                    createPseudoHideStyles(clone);
                }

                var counters = (0, PseudoNodeContent.parseCounterReset)(style, this.pseudoContentData);
                var contentBefore = (0, PseudoNodeContent.resolvePseudoContent)(node, styleBefore, this.pseudoContentData);

                for (var child = node.firstChild; child; child = child.nextSibling) {
                    if (child.nodeType !== Node.ELEMENT_NODE || child.nodeName !== 'SCRIPT' &&
                    // $FlowFixMe
                    !child.hasAttribute(IGNORE_ATTRIBUTE) && (typeof this.options.ignoreElements !== 'function' ||
                    // $FlowFixMe
                    !this.options.ignoreElements(child))) {
                        if (!this.copyStyles || child.nodeName !== 'STYLE') {
                            clone.appendChild(this.cloneNode(child));
                        }
                    }
                }

                var contentAfter = (0, PseudoNodeContent.resolvePseudoContent)(node, styleAfter, this.pseudoContentData);
                (0, PseudoNodeContent.popCounters)(counters, this.pseudoContentData);

                if (node instanceof window.HTMLElement && clone instanceof window.HTMLElement) {
                    if (styleBefore) {
                        this.inlineAllImages(inlinePseudoElement(node, clone, styleBefore, contentBefore, PSEUDO_BEFORE));
                    }
                    if (styleAfter) {
                        this.inlineAllImages(inlinePseudoElement(node, clone, styleAfter, contentAfter, PSEUDO_AFTER));
                    }
                    if (style && this.copyStyles && !(node instanceof HTMLIFrameElement)) {
                        (0, Util.copyCSSStyles)(style, clone);
                    }
                    this.inlineAllImages(clone);
                    if (node.scrollTop !== 0 || node.scrollLeft !== 0) {
                        this.scrolledElements.push([clone, node.scrollLeft, node.scrollTop]);
                    }
                    switch (node.nodeName) {
                        case 'CANVAS':
                            if (!this.copyStyles) {
                                cloneCanvasContents(node, clone);
                            }
                            break;
                        case 'TEXTAREA':
                        case 'SELECT':
                            clone.value = node.value;
                            break;
                    }
                } else if (node instanceof window.SVGElement && clone instanceof window.SVGElement && style) {
                    (0, Util.copyCSSStyles)(style, clone);
                }
                return clone;
            }
        }]);

        return DocumentCloner;
    }();

    var getSheetFonts = function getSheetFonts(sheet, document) {
        // $FlowFixMe
        return (sheet.cssRules ? Array.from(sheet.cssRules) : []).filter(function (rule) {
            return rule.type === CSSRule.FONT_FACE_RULE;
        }).map(function (rule) {
            var src = (0, background.parseBackgroundImage)(rule.style.getPropertyValue('src'));
            var formats = [];
            for (var i = 0; i < src.length; i++) {
                if (src[i].method === 'url' && src[i + 1] && src[i + 1].method === 'format') {
                    var a = document.createElement('a');
                    a.href = src[i].args[0];
                    if (document.body) {
                        document.body.appendChild(a);
                    }

                    var font = {
                        src: a.href,
                        format: src[i + 1].args[0]
                    };
                    formats.push(font);
                }
            }

            return {
                // TODO select correct format for browser),

                formats: formats.filter(function (font) {
                    return (/^woff/i.test(font.format)
                    );
                }),
                fontFace: rule.style
            };
        }).filter(function (font) {
            return font.formats.length;
        });
    };

    var createStyleSheetFontsFromText = function createStyleSheetFontsFromText(text, baseHref) {
        var doc = document.implementation.createHTMLDocument('');
        var base = document.createElement('base');
        // $FlowFixMe
        base.href = baseHref;
        var style = document.createElement('style');

        style.textContent = text;
        if (doc.head) {
            doc.head.appendChild(base);
        }
        if (doc.body) {
            doc.body.appendChild(style);
        }

        return style.sheet ? getSheetFonts(style.sheet, doc) : [];
    };

    var restoreOwnerScroll = function restoreOwnerScroll(ownerDocument, x, y) {
        if (ownerDocument.defaultView && (x !== ownerDocument.defaultView.pageXOffset || y !== ownerDocument.defaultView.pageYOffset)) {
            ownerDocument.defaultView.scrollTo(x, y);
        }
    };

    var cloneCanvasContents = function cloneCanvasContents(canvas, clonedCanvas) {
        try {
            if (clonedCanvas) {
                clonedCanvas.width = canvas.width;
                clonedCanvas.height = canvas.height;
                var ctx = canvas.getContext('2d');
                var clonedCtx = clonedCanvas.getContext('2d');
                if (ctx) {
                    clonedCtx.putImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);
                } else {
                    clonedCtx.drawImage(canvas, 0, 0);
                }
            }
        } catch (e) {}
    };

    var inlinePseudoElement = function inlinePseudoElement(node, clone, style, contentItems, pseudoElt) {
        if (!style || !style.content || style.content === 'none' || style.content === '-moz-alt-content' || style.display === 'none') {
            return;
        }

        var anonymousReplacedElement = clone.ownerDocument.createElement('html2canvaspseudoelement');
        (0, Util.copyCSSStyles)(style, anonymousReplacedElement);

        if (contentItems) {
            var len = contentItems.length;
            for (var i = 0; i < len; i++) {
                var item = contentItems[i];
                switch (item.type) {
                    case PseudoNodeContent.PSEUDO_CONTENT_ITEM_TYPE.IMAGE:
                        var img = clone.ownerDocument.createElement('img');
                        img.src = (0, background.parseBackgroundImage)('url(' + item.value + ')')[0].args[0];
                        img.style.opacity = '1';
                        anonymousReplacedElement.appendChild(img);
                        break;
                    case PseudoNodeContent.PSEUDO_CONTENT_ITEM_TYPE.TEXT:
                        anonymousReplacedElement.appendChild(clone.ownerDocument.createTextNode(item.value));
                        break;
                }
            }
        }

        anonymousReplacedElement.className = PSEUDO_HIDE_ELEMENT_CLASS_BEFORE + ' ' + PSEUDO_HIDE_ELEMENT_CLASS_AFTER;
        clone.className += pseudoElt === PSEUDO_BEFORE ? ' ' + PSEUDO_HIDE_ELEMENT_CLASS_BEFORE : ' ' + PSEUDO_HIDE_ELEMENT_CLASS_AFTER;
        if (pseudoElt === PSEUDO_BEFORE) {
            clone.insertBefore(anonymousReplacedElement, clone.firstChild);
        } else {
            clone.appendChild(anonymousReplacedElement);
        }

        return anonymousReplacedElement;
    };
    var PSEUDO_BEFORE = ':before';
    var PSEUDO_AFTER = ':after';
    var PSEUDO_HIDE_ELEMENT_CLASS_BEFORE = '___html2canvas___pseudoelement_before';
    var PSEUDO_HIDE_ELEMENT_CLASS_AFTER = '___html2canvas___pseudoelement_after';

    var PSEUDO_HIDE_ELEMENT_STYLE = '{\n    content: "" !important;\n    display: none !important;\n}';

    var createPseudoHideStyles = function createPseudoHideStyles(body) {
        createStyles(body, '.' + PSEUDO_HIDE_ELEMENT_CLASS_BEFORE + PSEUDO_BEFORE + PSEUDO_HIDE_ELEMENT_STYLE + '\n         .' + PSEUDO_HIDE_ELEMENT_CLASS_AFTER + PSEUDO_AFTER + PSEUDO_HIDE_ELEMENT_STYLE);
    };

    var createStyles = function createStyles(body, styles) {
        var style = body.ownerDocument.createElement('style');
        style.innerHTML = styles;
        body.appendChild(style);
    };

    var initNode = function initNode(_ref) {
        var _ref2 = _slicedToArray(_ref, 3),
            element = _ref2[0],
            x = _ref2[1],
            y = _ref2[2];

        element.scrollLeft = x;
        element.scrollTop = y;
    };

    var generateIframeKey = function generateIframeKey() {
        return Math.ceil(Date.now() + Math.random() * 10000000).toString(16);
    };

    var DATA_URI_REGEXP = /^data:text\/(.+);(base64)?,(.*)$/i;

    var getIframeDocumentElement = function getIframeDocumentElement(node, options) {
        try {
            return Promise.resolve(node.contentWindow.document.documentElement);
        } catch (e) {
            return options.proxy ? (0, _Proxy.Proxy)(node.src, options).then(function (html) {
                var match = html.match(DATA_URI_REGEXP);
                if (!match) {
                    return Promise.reject();
                }

                return match[2] === 'base64' ? window.atob(decodeURIComponent(match[3])) : decodeURIComponent(match[3]);
            }).then(function (html) {
                return createIframeContainer(node.ownerDocument, (0, Bounds_1.parseBounds)(node, 0, 0)).then(function (cloneIframeContainer) {
                    var cloneWindow = cloneIframeContainer.contentWindow;
                    var documentClone = cloneWindow.document;

                    documentClone.open();
                    documentClone.write(html);
                    var iframeLoad = iframeLoader(cloneIframeContainer).then(function () {
                        return documentClone.documentElement;
                    });

                    documentClone.close();
                    return iframeLoad;
                });
            }) : Promise.reject();
        }
    };

    var createIframeContainer = function createIframeContainer(ownerDocument, bounds) {
        var cloneIframeContainer = ownerDocument.createElement('iframe');

        cloneIframeContainer.className = 'html2canvas-container';
        cloneIframeContainer.style.visibility = 'hidden';
        cloneIframeContainer.style.position = 'fixed';
        cloneIframeContainer.style.left = '-10000px';
        cloneIframeContainer.style.top = '0px';
        cloneIframeContainer.style.border = '0';
        cloneIframeContainer.width = bounds.width.toString();
        cloneIframeContainer.height = bounds.height.toString();
        cloneIframeContainer.scrolling = 'no'; // ios won't scroll without it
        cloneIframeContainer.setAttribute(IGNORE_ATTRIBUTE, 'true');
        if (!ownerDocument.body) {
            return Promise.reject(process.env.NODE_ENV !== 'production' ? 'Body element not found in Document that is getting rendered' : '');
        }

        ownerDocument.body.appendChild(cloneIframeContainer);

        return Promise.resolve(cloneIframeContainer);
    };

    var iframeLoader = function iframeLoader(cloneIframeContainer) {
        var cloneWindow = cloneIframeContainer.contentWindow;
        var documentClone = cloneWindow.document;

        return new Promise(function (resolve, reject) {
            cloneWindow.onload = cloneIframeContainer.onload = documentClone.onreadystatechange = function () {
                var interval = setInterval(function () {
                    if (documentClone.body.childNodes.length > 0 && documentClone.readyState === 'complete') {
                        clearInterval(interval);
                        resolve(cloneIframeContainer);
                    }
                }, 50);
            };
        });
    };

    var cloneWindow = exports.cloneWindow = function cloneWindow(ownerDocument, bounds, referenceElement, options, logger, renderer) {
        var cloner = new DocumentCloner(referenceElement, options, logger, false, renderer);
        var scrollX = ownerDocument.defaultView.pageXOffset;
        var scrollY = ownerDocument.defaultView.pageYOffset;

        return createIframeContainer(ownerDocument, bounds).then(function (cloneIframeContainer) {
            var cloneWindow = cloneIframeContainer.contentWindow;
            var documentClone = cloneWindow.document;

            /* Chrome doesn't detect relative background-images assigned in inline <style> sheets when fetched through getComputedStyle
                 if window url is about:blank, we can assign the url to current by writing onto the document
                 */

            var iframeLoad = iframeLoader(cloneIframeContainer).then(function () {
                cloner.scrolledElements.forEach(initNode);
                cloneWindow.scrollTo(bounds.left, bounds.top);
                if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent) && (cloneWindow.scrollY !== bounds.top || cloneWindow.scrollX !== bounds.left)) {
                    documentClone.documentElement.style.top = -bounds.top + 'px';
                    documentClone.documentElement.style.left = -bounds.left + 'px';
                    documentClone.documentElement.style.position = 'absolute';
                }

                var result = Promise.resolve([cloneIframeContainer, cloner.clonedReferenceElement, cloner.resourceLoader]);

                var onclone = options.onclone;

                return cloner.clonedReferenceElement instanceof cloneWindow.HTMLElement || cloner.clonedReferenceElement instanceof ownerDocument.defaultView.HTMLElement || cloner.clonedReferenceElement instanceof HTMLElement ? typeof onclone === 'function' ? Promise.resolve().then(function () {
                    return onclone(documentClone);
                }).then(function () {
                    return result;
                }) : result : Promise.reject(process.env.NODE_ENV !== 'production' ? 'Error finding the ' + referenceElement.nodeName + ' in the cloned document' : '');
            });

            documentClone.open();
            documentClone.write(serializeDoctype(document.doctype) + '<html></html>');
            // Chrome scrolls the parent document for some reason after the write to the cloned window???
            restoreOwnerScroll(referenceElement.ownerDocument, scrollX, scrollY);
            documentClone.replaceChild(documentClone.adoptNode(cloner.documentElement), documentClone.documentElement);
            documentClone.close();

            return iframeLoad;
        });
    };

    var serializeDoctype = function serializeDoctype(doctype) {
        var str = '';
        if (doctype) {
            str += '<!DOCTYPE ';
            if (doctype.name) {
                str += doctype.name;
            }

            if (doctype.internalSubset) {
                str += doctype.internalSubset;
            }

            if (doctype.publicId) {
                str += '"' + doctype.publicId + '"';
            }

            if (doctype.systemId) {
                str += '"' + doctype.systemId + '"';
            }

            str += '>';
        }

        return str;
    };
    });

    unwrapExports(Clone);
    var Clone_1 = Clone.cloneWindow;
    var Clone_2 = Clone.DocumentCloner;

    var Window = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.renderElement = undefined;

    var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();



    var _Logger2 = _interopRequireDefault(Logger_1);





    var _Renderer2 = _interopRequireDefault(Renderer_1);



    var _ForeignObjectRenderer2 = _interopRequireDefault(ForeignObjectRenderer_1);



    var _Feature2 = _interopRequireDefault(Feature);









    var _Color2 = _interopRequireDefault(Color_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var renderElement = exports.renderElement = function renderElement(element, options, logger) {
        var ownerDocument = element.ownerDocument;

        var windowBounds = new Bounds_1.Bounds(options.scrollX, options.scrollY, options.windowWidth, options.windowHeight);

        // http://www.w3.org/TR/css3-background/#special-backgrounds
        var documentBackgroundColor = ownerDocument.documentElement ? new _Color2.default(getComputedStyle(ownerDocument.documentElement).backgroundColor) : Color_1.TRANSPARENT;
        var bodyBackgroundColor = ownerDocument.body ? new _Color2.default(getComputedStyle(ownerDocument.body).backgroundColor) : Color_1.TRANSPARENT;

        var backgroundColor = element === ownerDocument.documentElement ? documentBackgroundColor.isTransparent() ? bodyBackgroundColor.isTransparent() ? options.backgroundColor ? new _Color2.default(options.backgroundColor) : null : bodyBackgroundColor : documentBackgroundColor : options.backgroundColor ? new _Color2.default(options.backgroundColor) : null;

        return (options.foreignObjectRendering ? // $FlowFixMe
        _Feature2.default.SUPPORT_FOREIGNOBJECT_DRAWING : Promise.resolve(false)).then(function (supportForeignObject) {
            return supportForeignObject ? function (cloner) {
                if (process.env.NODE_ENV !== 'production') {
                    logger.log('Document cloned, using foreignObject rendering');
                }

                return cloner.inlineFonts(ownerDocument).then(function () {
                    return cloner.resourceLoader.ready();
                }).then(function () {
                    var renderer = new _ForeignObjectRenderer2.default(cloner.documentElement);

                    var defaultView = ownerDocument.defaultView;
                    var scrollX = defaultView.pageXOffset;
                    var scrollY = defaultView.pageYOffset;

                    var isDocument = element.tagName === 'HTML' || element.tagName === 'BODY';

                    var _ref = isDocument ? (0, Bounds_1.parseDocumentSize)(ownerDocument) : (0, Bounds_1.parseBounds)(element, scrollX, scrollY),
                        width = _ref.width,
                        height = _ref.height,
                        left = _ref.left,
                        top = _ref.top;

                    return renderer.render({
                        backgroundColor: backgroundColor,
                        logger: logger,
                        scale: options.scale,
                        x: typeof options.x === 'number' ? options.x : left,
                        y: typeof options.y === 'number' ? options.y : top,
                        width: typeof options.width === 'number' ? options.width : Math.ceil(width),
                        height: typeof options.height === 'number' ? options.height : Math.ceil(height),
                        windowWidth: options.windowWidth,
                        windowHeight: options.windowHeight,
                        scrollX: options.scrollX,
                        scrollY: options.scrollY
                    });
                });
            }(new Clone.DocumentCloner(element, options, logger, true, renderElement)) : (0, Clone.cloneWindow)(ownerDocument, windowBounds, element, options, logger, renderElement).then(function (_ref2) {
                var _ref3 = _slicedToArray(_ref2, 3),
                    container = _ref3[0],
                    clonedElement = _ref3[1],
                    resourceLoader = _ref3[2];

                if (process.env.NODE_ENV !== 'production') {
                    logger.log('Document cloned, using computed rendering');
                }

                var stack = (0, NodeParser_1.NodeParser)(clonedElement, resourceLoader, logger);
                var clonedDocument = clonedElement.ownerDocument;

                if (backgroundColor === stack.container.style.background.backgroundColor) {
                    stack.container.style.background.backgroundColor = Color_1.TRANSPARENT;
                }

                return resourceLoader.ready().then(function (imageStore) {
                    var fontMetrics = new Font.FontMetrics(clonedDocument);
                    if (process.env.NODE_ENV !== 'production') {
                        logger.log('Starting renderer');
                    }

                    var defaultView = clonedDocument.defaultView;
                    var scrollX = defaultView.pageXOffset;
                    var scrollY = defaultView.pageYOffset;

                    var isDocument = clonedElement.tagName === 'HTML' || clonedElement.tagName === 'BODY';

                    var _ref4 = isDocument ? (0, Bounds_1.parseDocumentSize)(ownerDocument) : (0, Bounds_1.parseBounds)(clonedElement, scrollX, scrollY),
                        width = _ref4.width,
                        height = _ref4.height,
                        left = _ref4.left,
                        top = _ref4.top;

                    var renderOptions = {
                        backgroundColor: backgroundColor,
                        fontMetrics: fontMetrics,
                        imageStore: imageStore,
                        logger: logger,
                        scale: options.scale,
                        x: typeof options.x === 'number' ? options.x : left,
                        y: typeof options.y === 'number' ? options.y : top,
                        width: typeof options.width === 'number' ? options.width : Math.ceil(width),
                        height: typeof options.height === 'number' ? options.height : Math.ceil(height)
                    };

                    if (Array.isArray(options.target)) {
                        return Promise.all(options.target.map(function (target) {
                            var renderer = new _Renderer2.default(target, renderOptions);
                            return renderer.render(stack);
                        }));
                    } else {
                        var renderer = new _Renderer2.default(options.target, renderOptions);
                        var canvas = renderer.render(stack);
                        if (options.removeContainer === true) {
                            if (container.parentNode) {
                                container.parentNode.removeChild(container);
                            } else if (process.env.NODE_ENV !== 'production') {
                                logger.log('Cannot detach cloned iframe as it is not in the DOM anymore');
                            }
                        }

                        return canvas;
                    }
                });
            });
        });
    };
    });

    unwrapExports(Window);
    var Window_1 = Window.renderElement;

    var npm = createCommonjsModule(function (module) {

    var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };



    var _CanvasRenderer2 = _interopRequireDefault(CanvasRenderer_1);



    var _Logger2 = _interopRequireDefault(Logger_1);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var html2canvas = function html2canvas(element, conf) {
        var config = conf || {};
        var logger = new _Logger2.default(typeof config.logging === 'boolean' ? config.logging : true);
        logger.log('html2canvas ' + "$npm_package_version");

        if (process.env.NODE_ENV !== 'production' && typeof config.onrendered === 'function') {
            logger.error('onrendered option is deprecated, html2canvas returns a Promise with the canvas as the value');
        }

        var ownerDocument = element.ownerDocument;
        if (!ownerDocument) {
            return Promise.reject('Provided element is not within a Document');
        }
        var defaultView = ownerDocument.defaultView;

        var defaultOptions = {
            async: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            imageTimeout: 15000,
            logging: true,
            proxy: null,
            removeContainer: true,
            foreignObjectRendering: false,
            scale: defaultView.devicePixelRatio || 1,
            target: new _CanvasRenderer2.default(config.canvas),
            useCORS: false,
            windowWidth: defaultView.innerWidth,
            windowHeight: defaultView.innerHeight,
            scrollX: defaultView.pageXOffset,
            scrollY: defaultView.pageYOffset
        };

        var result = (0, Window.renderElement)(element, _extends({}, defaultOptions, config), logger);

        if (process.env.NODE_ENV !== 'production') {
            return result.catch(function (e) {
                logger.error(e);
                throw e;
            });
        }
        return result;
    };

    html2canvas.CanvasRenderer = _CanvasRenderer2.default;

    module.exports = html2canvas;
    });

    var html2canvas = unwrapExports(npm);

    var pad = function pad (num, size) {
      var s = '000000000' + num;
      return s.substr(s.length - size);
    };

    var padding$2 = 2,
        pid = pad(process.pid.toString(36), padding$2),
        hostname = os.hostname(),
        length = hostname.length,
        hostId = pad(hostname
          .split('')
          .reduce(function (prev, char) {
            return +prev + char.charCodeAt(0);
          }, +length + 36)
          .toString(36),
        padding$2);

    var fingerprint = function fingerprint () {
      return pid + hostId;
    };

    var lim = Math.pow(2, 32) - 1;

    var getRandomValue = function random () {
      return Math.abs(crypto.randomBytes(4)
        .readInt32BE() / lim);
    };

    /**
     * cuid.js
     * Collision-resistant UID generator for browsers and node.
     * Sequential for fast db lookups and recency sorting.
     * Safe for element IDs and server-side lookups.
     *
     * Extracted from CLCTR
     *
     * Copyright (c) Eric Elliott 2012
     * MIT License
     */





    var c = 0,
      blockSize = 4,
      base = 36,
      discreteValues = Math.pow(base, blockSize);

    function randomBlock () {
      return pad((getRandomValue() *
        discreteValues << 0)
        .toString(base), blockSize);
    }

    function safeCounter () {
      c = c < discreteValues ? c : 0;
      c++; // this is not subliminal
      return c - 1;
    }

    function cuid () {
      // Starting with a lowercase letter makes
      // it HTML element ID friendly.
      var letter = 'c', // hard-coded allows for sequential access

        // timestamp
        // warning: this exposes the exact date and time
        // that the uid was created.
        timestamp = (new Date().getTime()).toString(base),

        // Prevent same-machine collisions.
        counter = pad(safeCounter().toString(base), blockSize),

        // A few chars to generate distinct ids for different
        // clients (so different computers are far less
        // likely to generate the same id)
        print = fingerprint(),

        // Grab some more chars from Math.random()
        random = randomBlock() + randomBlock();

      return letter + timestamp + counter + print + random;
    }

    cuid.slug = function slug () {
      var date = new Date().getTime().toString(36),
        counter = safeCounter().toString(36).slice(-4),
        print = fingerprint().slice(0, 1) +
          fingerprint().slice(-1),
        random = randomBlock().slice(-2);

      return date.slice(-2) +
        counter + print + random;
    };

    cuid.isCuid = function isCuid (stringToCheck) {
      if (typeof stringToCheck !== 'string') return false;
      if (stringToCheck.startsWith('c')) return true;
      return false;
    };

    cuid.isSlug = function isSlug (stringToCheck) {
      if (typeof stringToCheck !== 'string') return false;
      var stringLength = stringToCheck.length;
      if (stringLength >= 7 && stringLength <= 10) return true;
      return false;
    };

    cuid.fingerprint = fingerprint;

    var cuid_1 = cuid;

    /**
     * Transform a DOM tree into 3D layers.
     *
     * When an instance is created, a `layer` data-attribute is set on the
     * the passed DOM element to match this instance's Object3D id.
     * If the passed DOM element has an `id` attribute, this instance's Object3D name
     * will be set to match the element id.
     *
     * Child WebLayer3D instances can be specified with an empty `layer` data-attribute,
     * which will be set when the child WebLayer3D instance is created automatically.
     * The data-attribute can be specified added in HTML or dynamically:
     *  - `<div data-layer></div>`
     *  - `element.dataset.layer = ''`
     *
     * Additionally, the pixel ratio can be adjusted on each layer, individually:
     *  - `<div data-layer data-layer-pixel-ratio="0.5"></div>`
     *  - `element.dataset.layerPixelRatio = '0.5'`
     *
     * Finally, each layer can prerender multipe states specified as CSS classes delimited by spaces:
     *  - `<div data-layer data-layer-states="near far"></div>`
     *  - `element.dataset.layerStates = 'near far'`
     *
     * Each WebLayer3D will render each of its states with the corresponding CSS class applied to the element.
     * Every layer has a `default` state. The texture can be changed with `layer.setState(state)`,
     * without requiring the DOM to be re-rendered. Setting a state on a parent layer does
     * not affect the state of a child layer.
     *
     * Default dimensions: 1px = 0.001 world dimensions = 1mm (assuming meters)
     *     e.g., 500px width means 0.5meters
     */
    class WebLayer3D extends THREE.Object3D {
        constructor(element, options = {}, rootLayer = undefined, level = 0) {
            super();
            this.options = options;
            this.rootLayer = rootLayer;
            this.level = level;
            this.content = new THREE.Object3D();
            this.mesh = new THREE.Mesh(WebLayer3D.GEOMETRY, new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide
            }));
            this.childLayers = [];
            this.boundingRect = new DOMRect();
            this.defaultContentPosition = new THREE.Vector3();
            this.defaultContentScale = new THREE.Vector3();
            this.textures = {
                default: new THREE.Texture(document.createElement('canvas'))
            };
            this._needsRemoval = false;
            this._pixelRatio = 1;
            this._currentState = 'default';
            this.element = element;
            this.element.setAttribute(WebLayer3D.LAYER_ATTRIBUTE, this.id.toString());
            this.element.setAttribute(WebLayer3D.UID_ATTRIBUTE, cuid_1.slug());
            this.rootLayer = rootLayer || this;
            this.name = element.id;
            if (this.rootLayer === this) {
                this._logger = new Logger(false);
                this._resourceLoader = new ResourceLoader({
                    imageTimeout: 15000,
                    allowTaint: options.allowTaint || false
                }, this._logger, window);
            }
            if (!document.contains(element)) {
                ensureElementIsInDocument(element, options);
            }
            this.add(this.content);
            this.mesh.visible = false;
            if (this.rootLayer === this) {
                this.refresh(true);
                const getClosestLayer = (target) => {
                    const closestLayerElement = target.closest(`[${WebLayer3D.LAYER_ATTRIBUTE}]`);
                    const id = parseInt(closestLayerElement.getAttribute(WebLayer3D.LAYER_ATTRIBUTE) || '', 10);
                    return this.id === id ? this : this.getObjectById(id);
                };
                const refreshOnChange = (e) => {
                    if (!this._updateTargetInClonedDocument(e.target)) {
                        return this.refresh(true);
                    }
                    getClosestLayer(e.target).refresh();
                };
                element.addEventListener('input', refreshOnChange, { capture: true });
                element.addEventListener('change', refreshOnChange, { capture: true });
                element.addEventListener('focus', refreshOnChange, { capture: true });
                element.addEventListener('blue', refreshOnChange, { capture: true });
                const layersToRefresh = new Set();
                this._mutationObserver = new MutationObserver((records, observer) => {
                    for (const record of records) {
                        const target = record.target.nodeType === Node.ELEMENT_NODE
                            ? record.target
                            : record.target.parentElement;
                        if (record.type === 'attributes' &&
                            target.getAttribute(record.attributeName) === record.oldValue)
                            continue;
                        if (record.type === 'characterData' &&
                            record.target.data === record.oldValue)
                            continue;
                        const addedItem = record.addedNodes.item(0);
                        if (addedItem &&
                            addedItem.classList &&
                            addedItem.classList.contains('html2canvas-container'))
                            continue;
                        const removedItem = record.removedNodes.item(0);
                        if (removedItem &&
                            removedItem.classList &&
                            removedItem.classList.contains('html2canvas-container'))
                            continue;
                        if (record.type === 'childList') {
                            return this.refresh(true);
                        }
                        if (!this._updateTargetInClonedDocument(target, record.type === 'characterData')) {
                            return this.refresh(true);
                        }
                        layersToRefresh.add(getClosestLayer(target));
                    }
                    for (const layer of layersToRefresh) {
                        layer.refresh();
                    }
                    layersToRefresh.clear();
                });
                this._mutationObserver.observe(element, {
                    characterData: true,
                    characterDataOldValue: true,
                    attributes: true,
                    attributeOldValue: true,
                    childList: true,
                    subtree: true
                });
            }
            this._resizeObserver = new index((records, observer) => {
                this.refresh();
            });
            this._resizeObserver.observe(element);
        }
        get currentState() {
            return this._currentState;
        }
        get needsRemoval() {
            return this._needsRemoval;
        }
        /**
         * Change the texture state.
         * Note: if a state is not available, the `default` state will be rendered.
         */
        setState(state) {
            this._currentState = state;
            this._updateMesh();
        }
        /**
         * Update the pose and opacity of this layer (does not rerender the DOM)
         *
         * @param alpha lerp value
         * @param transition transition function (by default, this is WebLayer3D.TRANSITION_DEFAULT)
         * @param children if true, also update child layers
         */
        update(alpha = 1, transition = WebLayer3D.TRANSITION_DEFAULT, children = true) {
            transition(this, alpha);
            if (children)
                this.traverseLayers(transition, alpha);
        }
        transitionLayout(alpha) {
            this.content.position.lerp(this.defaultContentPosition, alpha);
            this.content.scale.lerp(this.defaultContentScale, alpha);
        }
        transitionEntryExit(alpha) {
            const material = this.mesh.material;
            if (this.needsRemoval) {
                if ('opacity' in material && material.opacity > 0.001) {
                    material.opacity = THREE.Math.lerp(material.opacity, 0, alpha);
                    material.needsUpdate = true;
                }
                else {
                    if (this.parent)
                        this.parent.remove(this);
                    this.dispose();
                }
            }
            else {
                if ('opacity' in material && material.opacity < 1) {
                    material.opacity = THREE.Math.lerp(material.opacity, 1, alpha);
                    material.needsUpdate = true;
                }
            }
        }
        traverseLayers(each, ...params) {
            for (const child of this.children) {
                if (child instanceof WebLayer3D) {
                    each(child, ...params);
                    child.traverseLayers(each, ...params);
                }
            }
            return params;
        }
        async refresh(forceClone = false) {
            const isRootLayer = this.rootLayer === this;
            if (!this.rootLayer._clonedDocument && !this.rootLayer._clonedDocumentPromise)
                forceClone = true;
            if (forceClone && !isRootLayer)
                return this.rootLayer.refresh(true);
            const element = this.element;
            const options = this.options;
            const window = element.ownerDocument.defaultView;
            const pixelRatioDefault = options.pixelRatio && options.pixelRatio > 0
                ? options.pixelRatio
                : window.devicePixelRatio || 1;
            const pixelRatioAttribute = parseFloat(element.getAttribute(WebLayer3D.PIXEL_RATIO_ATTRIBUTE) || '1');
            const pixelRatio = isFinite(pixelRatioAttribute) && pixelRatioAttribute > 0
                ? pixelRatioAttribute * pixelRatioDefault
                : pixelRatioDefault;
            this._pixelRatio = Math.max(pixelRatio, 10e-6);
            this._states = (element.getAttribute(WebLayer3D.STATES_ATTRIBUTE) || '')
                .trim()
                .split(/\s+/)
                .filter(Boolean);
            this._states.push('default');
            for (const state of this._states) {
                if (!this.textures[state]) {
                    this.textures[state] = new THREE.Texture(document.createElement('canvas'));
                }
            }
            this._updateChildLayers();
            this._updateBoundingRect();
            if (isRootLayer && forceClone && !this._clonedDocumentPromise) {
                const oldClonedDocument = this._clonedDocument;
                if (oldClonedDocument && oldClonedDocument.defaultView) {
                    const container = oldClonedDocument.defaultView.frameElement;
                    container.remove();
                }
                this._clonedDocument = undefined;
                const boundingRect = this.boundingRect;
                const clonedPromise = (this._clonedDocumentPromise = new Promise((resolve, reject) => {
                    let cloned;
                    html2canvas(element, {
                        logging: false,
                        target: [new CanvasRenderer(this.textures.default.image)],
                        width: boundingRect.width,
                        height: boundingRect.height,
                        windowWidth: 'windowWidth' in options ? options.windowWidth : window.innerWidth,
                        windowHeight: 'windowHeight' in options ? options.windowHeight : window.innerHeight,
                        scale: this._pixelRatio,
                        backgroundColor: null,
                        allowTaint: options.allowTaint || false,
                        onclone: (document) => {
                            const clonedRootEl = document.querySelector(`[${WebLayer3D.LAYER_ATTRIBUTE}="${this.rootLayer.id}"]`);
                            clonedRootEl.style.visibility = 'visible';
                            this._hideChildLayers(document);
                            cloned = document;
                        }
                    })
                        .then(([canvas]) => {
                        this._showChildLayers(cloned);
                        this._updateTexture(canvas, 'default');
                        if (clonedPromise !== this._clonedDocumentPromise && cloned.defaultView) {
                            cloned.defaultView.frameElement.remove();
                        }
                        else {
                            this._clonedDocument = cloned;
                            this._clonedDocumentPromise = undefined;
                        }
                        resolve(cloned);
                    })
                        .catch(reject);
                }));
            }
            // if cloned document is not attached to the DOM, the root element was refreshed,
            // so wait for the next cloned document
            let clonedDocument = this.rootLayer._clonedDocument;
            while (!clonedDocument || clonedDocument.defaultView === null) {
                clonedDocument =
                    this.rootLayer._clonedDocument || (await this.rootLayer._clonedDocumentPromise);
            }
            const childrenRefreshing = [];
            this.traverseLayers(child => {
                childrenRefreshing.push(child.refresh());
            });
            await this._renderTextures(clonedDocument, forceClone ? { ...this.textures, default: null } : this.textures);
            this._updateMesh();
            if (!this.mesh.parent) {
                this.mesh.visible = true;
                this.content.position.copy(this.defaultContentPosition);
                this.content.scale.copy(this.defaultContentScale);
                this.content.add(this.mesh);
            }
            return Promise.all(childrenRefreshing).then(() => { });
        }
        dispose() {
            if (this._mutationObserver)
                this._mutationObserver.disconnect();
            if (this._resizeObserver)
                this._resizeObserver.disconnect();
            for (const child of this.childLayers)
                child.dispose();
        }
        _hideChildLayers(clonedDocument) {
            for (const child of this.childLayers) {
                const clonedEl = clonedDocument.querySelector(`[${WebLayer3D.LAYER_ATTRIBUTE}="${child.id}"]`);
                if (clonedEl && clonedEl.style) {
                    clonedEl.style.visibility = 'hidden';
                }
            }
        }
        _showChildLayers(clonedDocument) {
            for (const child of this.childLayers) {
                const clonedEl = clonedDocument.querySelector(`[${WebLayer3D.LAYER_ATTRIBUTE}="${child.id}"]`);
                if (clonedEl && clonedEl.style) {
                    clonedEl.style.visibility = 'visible';
                }
            }
        }
        _markForRemoval() {
            this._needsRemoval = true;
            for (const child of this.children) {
                if (child instanceof WebLayer3D)
                    child._markForRemoval();
            }
        }
        _updateChildLayers() {
            const element = this.element;
            const childLayers = this.childLayers;
            const oldChildLayers = childLayers.slice();
            childLayers.length = 0;
            traverseDOM(element, this._tryConvertToWebLayer3D, this);
            for (const child of oldChildLayers) {
                if (childLayers.indexOf(child) === -1)
                    child._markForRemoval();
            }
        }
        _tryConvertToWebLayer3D(el) {
            const uid = el.getAttribute(WebLayer3D.UID_ATTRIBUTE);
            if (!uid)
                el.setAttribute(WebLayer3D.UID_ATTRIBUTE, cuid_1.slug());
            const id = el.getAttribute(WebLayer3D.LAYER_ATTRIBUTE);
            if (id !== null) {
                let child = this.getObjectById(parseInt(id, 10));
                if (!child) {
                    child = new WebLayer3D(el, this.options, this.rootLayer, this.level + 1);
                    this.add(child);
                }
                this.childLayers.push(child);
                return true; // stop traversing this subtree
            }
            return false;
        }
        async _renderTextures(clonedDocument, textures) {
            if (Object.keys(textures).length === 0) {
                return;
            }
            const clonedElement = clonedDocument.querySelector(`[${WebLayer3D.LAYER_ATTRIBUTE}="${this.id}"]`);
            if (!clonedElement)
                return; // has been removed
            this._hideChildLayers(clonedDocument);
            const renderFunctions = [];
            for (const state in textures) {
                const texture = textures[state];
                if (!texture) {
                    continue;
                }
                clonedElement.classList.add(state);
                const stack = NodeParser_2(clonedElement, this.rootLayer._resourceLoader, this.rootLayer._logger);
                // stack.container.style.background.backgroundColor = TRANSPARENT
                clonedElement.classList.remove(state);
                renderFunctions.push(() => {
                    const canvas = texture.image;
                    const context = canvas.getContext('2d');
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    const renderer = new Renderer(new CanvasRenderer(canvas), renderOptions);
                    renderer.render(stack);
                    this._updateTexture(canvas, state);
                });
            }
            const boundingRect = this.boundingRect;
            this._showChildLayers(clonedDocument);
            const fontMetrics = new Font_1(clonedDocument);
            const imageStore = await this.rootLayer._resourceLoader.ready();
            const renderOptions = {
                backgroundColor: null,
                fontMetrics,
                imageStore,
                logger: this.rootLayer._logger,
                scale: this._pixelRatio,
                x: boundingRect.left,
                y: boundingRect.top,
                width: boundingRect.width,
                height: boundingRect.height,
                allowTaint: this.options.allowTaint || false
            };
            for (const render of renderFunctions)
                render();
        }
        _updateBoundingRect() {
            const boundingRect = (this.boundingRect = this.element.getBoundingClientRect());
            const pixelSize = WebLayer3D.DEFAULT_PIXEL_DIMENSIONS;
            if (this.rootLayer !== this) {
                const layerSeparation = this.options.layerSeparation || WebLayer3D.DEFAULT_LAYER_SEPARATION;
                const rootBoundingRect = this.rootLayer.boundingRect;
                const rootOriginX = pixelSize * (-rootBoundingRect.width / 2);
                const rootOriginY = pixelSize * (rootBoundingRect.height / 2);
                const myLeft = pixelSize * (boundingRect.left + boundingRect.width / 2);
                const myTop = pixelSize * (boundingRect.top + boundingRect.height / 2);
                this.defaultContentPosition.set(rootOriginX + myLeft, rootOriginY - myTop, layerSeparation * this.level);
            }
            this.defaultContentScale.set(Math.max(pixelSize * boundingRect.width, 10e-6), Math.max(pixelSize * boundingRect.height, 10e-6), 1);
        }
        _updateTexture(canvas, state = 'default') {
            const stateTexture = this.textures[state];
            if (!stateTexture) {
                throw new Error(`Missing texture for state: ${state}`);
            }
            stateTexture.image = canvas;
            stateTexture.minFilter = THREE.LinearFilter;
            stateTexture.needsUpdate = true;
        }
        _updateTargetInClonedDocument(target, updateTextContent = false) {
            if (!target)
                return false;
            const targetElement = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
            if (!targetElement)
                return false;
            const clonedTarget = this._getClonedElement(targetElement);
            const document = clonedTarget && clonedTarget.ownerDocument;
            if (clonedTarget &&
                clonedTarget.parentNode &&
                document &&
                document.defaultView &&
                targetElement.style) {
                for (const id of Object.keys(targetElement.attributes)) {
                    const attr = targetElement.attributes[id];
                    clonedTarget.setAttribute(attr.name, attr.value);
                }
                // clonedTarget.style.cssText = targetElement.ownerDocument!.defaultView!.getComputedStyle(targetElement).cssText
                if (clonedTarget.nodeName === 'INPUT' || clonedTarget.nodeName === 'TEXTAREA') {
                    const targetInput = targetElement;
                    const clonedInput = clonedTarget;
                    clonedInput.value = targetInput.value;
                    clonedInput.checked = targetInput.checked;
                }
                if (updateTextContent)
                    clonedTarget.innerHTML = target.innerHTML;
                return true;
            }
            else {
                return false;
            }
        }
        _getUniqueSelector(target) {
            return `[${WebLayer3D.UID_ATTRIBUTE}="${target.getAttribute(WebLayer3D.UID_ATTRIBUTE)}"]`;
        }
        _getClonedElement(target) {
            if (!this.rootLayer._clonedDocument)
                return null;
            return this.rootLayer._clonedDocument.querySelector(this._getUniqueSelector(target));
        }
        _updateMesh() {
            // cleanup unused textures
            const states = this._states;
            for (const state in this.textures) {
                if (!states.includes(state)) {
                    this.textures[state].dispose();
                    delete this.textures[state];
                }
            }
            const mesh = this.mesh;
            const texture = this.textures[this._currentState] || this.textures.default;
            const material = mesh.material;
            material.map = texture;
            material.needsUpdate = true;
        }
    }
    WebLayer3D.LAYER_ATTRIBUTE = 'data-layer';
    WebLayer3D.UID_ATTRIBUTE = 'data-layer-uid';
    WebLayer3D.LAYER_CONTAINER_ATTRIBUTE = 'data-layer-container';
    WebLayer3D.PIXEL_RATIO_ATTRIBUTE = 'data-layer-pixel-ratio';
    WebLayer3D.STATES_ATTRIBUTE = 'data-layer-states';
    WebLayer3D.DEFAULT_LAYER_SEPARATION = 0.005;
    WebLayer3D.DEFAULT_PIXEL_DIMENSIONS = 0.001;
    WebLayer3D.GEOMETRY = new THREE.PlaneGeometry(1, 1, 2, 2);
    WebLayer3D.TRANSITION_DEFAULT = function (layer, alpha) {
        layer.transitionLayout(alpha);
        layer.transitionEntryExit(alpha);
    };
    function ensureElementIsInDocument(element, options) {
        const document = element.ownerDocument;
        if (document.contains(element)) {
            return element;
        }
        const container = document.createElement('div');
        container.setAttribute(WebLayer3D.LAYER_CONTAINER_ATTRIBUTE, '');
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        container.style.position = 'absolute';
        container.style.width = 'windowWidth' in options ? options.windowWidth + 'px' : '550px';
        container.style.height = 'windowHeight' in options ? options.windowHeight + 'px' : '150px';
        container.style.top = '0';
        container.style.left = '0';
        container.appendChild(element);
        document.body
            ? document.body.appendChild(container)
            : document.documentElement.appendChild(container);
        return element;
    }
    function traverseDOM(node, each, bind) {
        for (let child = node.firstChild; child; child = child.nextSibling) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const el = child;
                if (!each.call(bind, el)) {
                    traverseDOM(el, each, bind);
                }
            }
        }
    }
    // const getUniqueSelector = (() => {
    //   let sSel : string
    //   let aSel: string[]
    //   // Derive selector from element
    //   function getSelector(el: HTMLElement) {
    //     // 1. Check ID first
    //     // NOTE: ID must be unique amongst all IDs in an HTML5 document.
    //     // https://www.w3.org/TR/html5/dom.html#the-id-attribute
    //     if (el.id) {
    //       aSel.unshift('#' + el.id)
    //       return true
    //     }
    //     aSel.unshift(sSel = el.nodeName.toLowerCase())
    //     // Try to select by nth-of-type() as a fallback for generic elements
    //     var elChild: Element|null = el, n = 1
    //     while (elChild = elChild.previousElementSibling) {
    //       if (elChild.nodeName===el.nodeName) ++n
    //     }
    //     aSel[0] = sSel += ':nth-of-type(' + n + ')'
    //     if (uniqueQuery()) return true
    //     // Try to select by nth-child() as a last resort
    //     elChild = el
    //     n = 1
    //     while (elChild = elChild.previousElementSibling) ++n
    //     aSel[0] = sSel = sSel.replace(/:nth-of-type\(\d+\)/, n>1 ? ':nth-child(' + n + ')' : ':first-child')
    //     if (uniqueQuery()) return true
    //     return false
    //   }
    //   // Test query to see if it returns one element
    //   function uniqueQuery() {
    //     const query = aSel.join('>')
    //     return query ? document.querySelectorAll(query).length===1 : false
    //   }
    //   // Walk up the DOM tree to compile a unique selector
    //   return function getUniqueSelector(elSrc: Node) {
    //     if (!(elSrc instanceof Element)) return
    //     aSel = []
    //     while (elSrc.parentNode) {
    //       if (getSelector(elSrc as HTMLElement)) return aSel.join(' > ')
    //       elSrc = elSrc.parentNode
    //     }
    //   }
    // })()

    return WebLayer3D;

})));
//# sourceMappingURL=three-web-layer.umd.js.map
