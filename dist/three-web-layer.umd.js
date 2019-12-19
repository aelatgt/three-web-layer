(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three'), require('ethereal')) :
    typeof define === 'function' && define.amd ? define(['exports', 'three', 'ethereal'], factory) :
    (global = global || self, factory(global.WebLayer3D = {}, global.THREE, global.ethereal));
}(this, (function (exports, THREE, ethereal) { 'use strict';

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

    /**
     * @author alteredq / http://alteredqualia.com/
     * @author mrdoob / http://mrdoob.com/
     */

    var _lut = [];

    for ( var i = 0; i < 256; i ++ ) {

    	_lut[ i ] = ( i < 16 ? '0' : '' ) + ( i ).toString( 16 );

    }

    var _Math = {

    	DEG2RAD: Math.PI / 180,
    	RAD2DEG: 180 / Math.PI,

    	generateUUID: function () {

    		// http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136

    		var d0 = Math.random() * 0xffffffff | 0;
    		var d1 = Math.random() * 0xffffffff | 0;
    		var d2 = Math.random() * 0xffffffff | 0;
    		var d3 = Math.random() * 0xffffffff | 0;
    		var uuid = _lut[ d0 & 0xff ] + _lut[ d0 >> 8 & 0xff ] + _lut[ d0 >> 16 & 0xff ] + _lut[ d0 >> 24 & 0xff ] + '-' +
    			_lut[ d1 & 0xff ] + _lut[ d1 >> 8 & 0xff ] + '-' + _lut[ d1 >> 16 & 0x0f | 0x40 ] + _lut[ d1 >> 24 & 0xff ] + '-' +
    			_lut[ d2 & 0x3f | 0x80 ] + _lut[ d2 >> 8 & 0xff ] + '-' + _lut[ d2 >> 16 & 0xff ] + _lut[ d2 >> 24 & 0xff ] +
    			_lut[ d3 & 0xff ] + _lut[ d3 >> 8 & 0xff ] + _lut[ d3 >> 16 & 0xff ] + _lut[ d3 >> 24 & 0xff ];

    		// .toUpperCase() here flattens concatenated strings to save heap memory space.
    		return uuid.toUpperCase();

    	},

    	clamp: function ( value, min, max ) {

    		return Math.max( min, Math.min( max, value ) );

    	},

    	// compute euclidian modulo of m % n
    	// https://en.wikipedia.org/wiki/Modulo_operation

    	euclideanModulo: function ( n, m ) {

    		return ( ( n % m ) + m ) % m;

    	},

    	// Linear mapping from range <a1, a2> to range <b1, b2>

    	mapLinear: function ( x, a1, a2, b1, b2 ) {

    		return b1 + ( x - a1 ) * ( b2 - b1 ) / ( a2 - a1 );

    	},

    	// https://en.wikipedia.org/wiki/Linear_interpolation

    	lerp: function ( x, y, t ) {

    		return ( 1 - t ) * x + t * y;

    	},

    	// http://en.wikipedia.org/wiki/Smoothstep

    	smoothstep: function ( x, min, max ) {

    		if ( x <= min ) return 0;
    		if ( x >= max ) return 1;

    		x = ( x - min ) / ( max - min );

    		return x * x * ( 3 - 2 * x );

    	},

    	smootherstep: function ( x, min, max ) {

    		if ( x <= min ) return 0;
    		if ( x >= max ) return 1;

    		x = ( x - min ) / ( max - min );

    		return x * x * x * ( x * ( x * 6 - 15 ) + 10 );

    	},

    	// Random integer from <low, high> interval

    	randInt: function ( low, high ) {

    		return low + Math.floor( Math.random() * ( high - low + 1 ) );

    	},

    	// Random float from <low, high> interval

    	randFloat: function ( low, high ) {

    		return low + Math.random() * ( high - low );

    	},

    	// Random float from <-range/2, range/2> interval

    	randFloatSpread: function ( range ) {

    		return range * ( 0.5 - Math.random() );

    	},

    	degToRad: function ( degrees ) {

    		return degrees * _Math.DEG2RAD;

    	},

    	radToDeg: function ( radians ) {

    		return radians * _Math.RAD2DEG;

    	},

    	isPowerOfTwo: function ( value ) {

    		return ( value & ( value - 1 ) ) === 0 && value !== 0;

    	},

    	ceilPowerOfTwo: function ( value ) {

    		return Math.pow( 2, Math.ceil( Math.log( value ) / Math.LN2 ) );

    	},

    	floorPowerOfTwo: function ( value ) {

    		return Math.pow( 2, Math.floor( Math.log( value ) / Math.LN2 ) );

    	}

    };

    /**
     * @author mikael emtinger / http://gomo.se/
     * @author alteredq / http://alteredqualia.com/
     * @author WestLangley / http://github.com/WestLangley
     * @author bhouston / http://clara.io
     */

    function Quaternion( x, y, z, w ) {

    	this._x = x || 0;
    	this._y = y || 0;
    	this._z = z || 0;
    	this._w = ( w !== undefined ) ? w : 1;

    }

    Object.assign( Quaternion, {

    	slerp: function ( qa, qb, qm, t ) {

    		return qm.copy( qa ).slerp( qb, t );

    	},

    	slerpFlat: function ( dst, dstOffset, src0, srcOffset0, src1, srcOffset1, t ) {

    		// fuzz-free, array-based Quaternion SLERP operation

    		var x0 = src0[ srcOffset0 + 0 ],
    			y0 = src0[ srcOffset0 + 1 ],
    			z0 = src0[ srcOffset0 + 2 ],
    			w0 = src0[ srcOffset0 + 3 ],

    			x1 = src1[ srcOffset1 + 0 ],
    			y1 = src1[ srcOffset1 + 1 ],
    			z1 = src1[ srcOffset1 + 2 ],
    			w1 = src1[ srcOffset1 + 3 ];

    		if ( w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1 ) {

    			var s = 1 - t,

    				cos = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1,

    				dir = ( cos >= 0 ? 1 : - 1 ),
    				sqrSin = 1 - cos * cos;

    			// Skip the Slerp for tiny steps to avoid numeric problems:
    			if ( sqrSin > Number.EPSILON ) {

    				var sin = Math.sqrt( sqrSin ),
    					len = Math.atan2( sin, cos * dir );

    				s = Math.sin( s * len ) / sin;
    				t = Math.sin( t * len ) / sin;

    			}

    			var tDir = t * dir;

    			x0 = x0 * s + x1 * tDir;
    			y0 = y0 * s + y1 * tDir;
    			z0 = z0 * s + z1 * tDir;
    			w0 = w0 * s + w1 * tDir;

    			// Normalize in case we just did a lerp:
    			if ( s === 1 - t ) {

    				var f = 1 / Math.sqrt( x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0 );

    				x0 *= f;
    				y0 *= f;
    				z0 *= f;
    				w0 *= f;

    			}

    		}

    		dst[ dstOffset ] = x0;
    		dst[ dstOffset + 1 ] = y0;
    		dst[ dstOffset + 2 ] = z0;
    		dst[ dstOffset + 3 ] = w0;

    	}

    } );

    Object.defineProperties( Quaternion.prototype, {

    	x: {

    		get: function () {

    			return this._x;

    		},

    		set: function ( value ) {

    			this._x = value;
    			this._onChangeCallback();

    		}

    	},

    	y: {

    		get: function () {

    			return this._y;

    		},

    		set: function ( value ) {

    			this._y = value;
    			this._onChangeCallback();

    		}

    	},

    	z: {

    		get: function () {

    			return this._z;

    		},

    		set: function ( value ) {

    			this._z = value;
    			this._onChangeCallback();

    		}

    	},

    	w: {

    		get: function () {

    			return this._w;

    		},

    		set: function ( value ) {

    			this._w = value;
    			this._onChangeCallback();

    		}

    	}

    } );

    Object.assign( Quaternion.prototype, {

    	isQuaternion: true,

    	set: function ( x, y, z, w ) {

    		this._x = x;
    		this._y = y;
    		this._z = z;
    		this._w = w;

    		this._onChangeCallback();

    		return this;

    	},

    	clone: function () {

    		return new this.constructor( this._x, this._y, this._z, this._w );

    	},

    	copy: function ( quaternion ) {

    		this._x = quaternion.x;
    		this._y = quaternion.y;
    		this._z = quaternion.z;
    		this._w = quaternion.w;

    		this._onChangeCallback();

    		return this;

    	},

    	setFromEuler: function ( euler, update ) {

    		if ( ! ( euler && euler.isEuler ) ) {

    			throw new Error( 'THREE.Quaternion: .setFromEuler() now expects an Euler rotation rather than a Vector3 and order.' );

    		}

    		var x = euler._x, y = euler._y, z = euler._z, order = euler.order;

    		// http://www.mathworks.com/matlabcentral/fileexchange/
    		// 	20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/
    		//	content/SpinCalc.m

    		var cos = Math.cos;
    		var sin = Math.sin;

    		var c1 = cos( x / 2 );
    		var c2 = cos( y / 2 );
    		var c3 = cos( z / 2 );

    		var s1 = sin( x / 2 );
    		var s2 = sin( y / 2 );
    		var s3 = sin( z / 2 );

    		if ( order === 'XYZ' ) {

    			this._x = s1 * c2 * c3 + c1 * s2 * s3;
    			this._y = c1 * s2 * c3 - s1 * c2 * s3;
    			this._z = c1 * c2 * s3 + s1 * s2 * c3;
    			this._w = c1 * c2 * c3 - s1 * s2 * s3;

    		} else if ( order === 'YXZ' ) {

    			this._x = s1 * c2 * c3 + c1 * s2 * s3;
    			this._y = c1 * s2 * c3 - s1 * c2 * s3;
    			this._z = c1 * c2 * s3 - s1 * s2 * c3;
    			this._w = c1 * c2 * c3 + s1 * s2 * s3;

    		} else if ( order === 'ZXY' ) {

    			this._x = s1 * c2 * c3 - c1 * s2 * s3;
    			this._y = c1 * s2 * c3 + s1 * c2 * s3;
    			this._z = c1 * c2 * s3 + s1 * s2 * c3;
    			this._w = c1 * c2 * c3 - s1 * s2 * s3;

    		} else if ( order === 'ZYX' ) {

    			this._x = s1 * c2 * c3 - c1 * s2 * s3;
    			this._y = c1 * s2 * c3 + s1 * c2 * s3;
    			this._z = c1 * c2 * s3 - s1 * s2 * c3;
    			this._w = c1 * c2 * c3 + s1 * s2 * s3;

    		} else if ( order === 'YZX' ) {

    			this._x = s1 * c2 * c3 + c1 * s2 * s3;
    			this._y = c1 * s2 * c3 + s1 * c2 * s3;
    			this._z = c1 * c2 * s3 - s1 * s2 * c3;
    			this._w = c1 * c2 * c3 - s1 * s2 * s3;

    		} else if ( order === 'XZY' ) {

    			this._x = s1 * c2 * c3 - c1 * s2 * s3;
    			this._y = c1 * s2 * c3 - s1 * c2 * s3;
    			this._z = c1 * c2 * s3 + s1 * s2 * c3;
    			this._w = c1 * c2 * c3 + s1 * s2 * s3;

    		}

    		if ( update !== false ) this._onChangeCallback();

    		return this;

    	},

    	setFromAxisAngle: function ( axis, angle ) {

    		// http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm

    		// assumes axis is normalized

    		var halfAngle = angle / 2, s = Math.sin( halfAngle );

    		this._x = axis.x * s;
    		this._y = axis.y * s;
    		this._z = axis.z * s;
    		this._w = Math.cos( halfAngle );

    		this._onChangeCallback();

    		return this;

    	},

    	setFromRotationMatrix: function ( m ) {

    		// http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm

    		// assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

    		var te = m.elements,

    			m11 = te[ 0 ], m12 = te[ 4 ], m13 = te[ 8 ],
    			m21 = te[ 1 ], m22 = te[ 5 ], m23 = te[ 9 ],
    			m31 = te[ 2 ], m32 = te[ 6 ], m33 = te[ 10 ],

    			trace = m11 + m22 + m33,
    			s;

    		if ( trace > 0 ) {

    			s = 0.5 / Math.sqrt( trace + 1.0 );

    			this._w = 0.25 / s;
    			this._x = ( m32 - m23 ) * s;
    			this._y = ( m13 - m31 ) * s;
    			this._z = ( m21 - m12 ) * s;

    		} else if ( m11 > m22 && m11 > m33 ) {

    			s = 2.0 * Math.sqrt( 1.0 + m11 - m22 - m33 );

    			this._w = ( m32 - m23 ) / s;
    			this._x = 0.25 * s;
    			this._y = ( m12 + m21 ) / s;
    			this._z = ( m13 + m31 ) / s;

    		} else if ( m22 > m33 ) {

    			s = 2.0 * Math.sqrt( 1.0 + m22 - m11 - m33 );

    			this._w = ( m13 - m31 ) / s;
    			this._x = ( m12 + m21 ) / s;
    			this._y = 0.25 * s;
    			this._z = ( m23 + m32 ) / s;

    		} else {

    			s = 2.0 * Math.sqrt( 1.0 + m33 - m11 - m22 );

    			this._w = ( m21 - m12 ) / s;
    			this._x = ( m13 + m31 ) / s;
    			this._y = ( m23 + m32 ) / s;
    			this._z = 0.25 * s;

    		}

    		this._onChangeCallback();

    		return this;

    	},

    	setFromUnitVectors: function ( vFrom, vTo ) {

    		// assumes direction vectors vFrom and vTo are normalized

    		var EPS = 0.000001;

    		var r = vFrom.dot( vTo ) + 1;

    		if ( r < EPS ) {

    			r = 0;

    			if ( Math.abs( vFrom.x ) > Math.abs( vFrom.z ) ) {

    				this._x = - vFrom.y;
    				this._y = vFrom.x;
    				this._z = 0;
    				this._w = r;

    			} else {

    				this._x = 0;
    				this._y = - vFrom.z;
    				this._z = vFrom.y;
    				this._w = r;

    			}

    		} else {

    			// crossVectors( vFrom, vTo ); // inlined to avoid cyclic dependency on Vector3

    			this._x = vFrom.y * vTo.z - vFrom.z * vTo.y;
    			this._y = vFrom.z * vTo.x - vFrom.x * vTo.z;
    			this._z = vFrom.x * vTo.y - vFrom.y * vTo.x;
    			this._w = r;

    		}

    		return this.normalize();

    	},

    	angleTo: function ( q ) {

    		return 2 * Math.acos( Math.abs( _Math.clamp( this.dot( q ), - 1, 1 ) ) );

    	},

    	rotateTowards: function ( q, step ) {

    		var angle = this.angleTo( q );

    		if ( angle === 0 ) return this;

    		var t = Math.min( 1, step / angle );

    		this.slerp( q, t );

    		return this;

    	},

    	inverse: function () {

    		// quaternion is assumed to have unit length

    		return this.conjugate();

    	},

    	conjugate: function () {

    		this._x *= - 1;
    		this._y *= - 1;
    		this._z *= - 1;

    		this._onChangeCallback();

    		return this;

    	},

    	dot: function ( v ) {

    		return this._x * v._x + this._y * v._y + this._z * v._z + this._w * v._w;

    	},

    	lengthSq: function () {

    		return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;

    	},

    	length: function () {

    		return Math.sqrt( this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w );

    	},

    	normalize: function () {

    		var l = this.length();

    		if ( l === 0 ) {

    			this._x = 0;
    			this._y = 0;
    			this._z = 0;
    			this._w = 1;

    		} else {

    			l = 1 / l;

    			this._x = this._x * l;
    			this._y = this._y * l;
    			this._z = this._z * l;
    			this._w = this._w * l;

    		}

    		this._onChangeCallback();

    		return this;

    	},

    	multiply: function ( q, p ) {

    		if ( p !== undefined ) {

    			console.warn( 'THREE.Quaternion: .multiply() now only accepts one argument. Use .multiplyQuaternions( a, b ) instead.' );
    			return this.multiplyQuaternions( q, p );

    		}

    		return this.multiplyQuaternions( this, q );

    	},

    	premultiply: function ( q ) {

    		return this.multiplyQuaternions( q, this );

    	},

    	multiplyQuaternions: function ( a, b ) {

    		// from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm

    		var qax = a._x, qay = a._y, qaz = a._z, qaw = a._w;
    		var qbx = b._x, qby = b._y, qbz = b._z, qbw = b._w;

    		this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    		this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    		this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    		this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

    		this._onChangeCallback();

    		return this;

    	},

    	slerp: function ( qb, t ) {

    		if ( t === 0 ) return this;
    		if ( t === 1 ) return this.copy( qb );

    		var x = this._x, y = this._y, z = this._z, w = this._w;

    		// http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/

    		var cosHalfTheta = w * qb._w + x * qb._x + y * qb._y + z * qb._z;

    		if ( cosHalfTheta < 0 ) {

    			this._w = - qb._w;
    			this._x = - qb._x;
    			this._y = - qb._y;
    			this._z = - qb._z;

    			cosHalfTheta = - cosHalfTheta;

    		} else {

    			this.copy( qb );

    		}

    		if ( cosHalfTheta >= 1.0 ) {

    			this._w = w;
    			this._x = x;
    			this._y = y;
    			this._z = z;

    			return this;

    		}

    		var sqrSinHalfTheta = 1.0 - cosHalfTheta * cosHalfTheta;

    		if ( sqrSinHalfTheta <= Number.EPSILON ) {

    			var s = 1 - t;
    			this._w = s * w + t * this._w;
    			this._x = s * x + t * this._x;
    			this._y = s * y + t * this._y;
    			this._z = s * z + t * this._z;

    			this.normalize();
    			this._onChangeCallback();

    			return this;

    		}

    		var sinHalfTheta = Math.sqrt( sqrSinHalfTheta );
    		var halfTheta = Math.atan2( sinHalfTheta, cosHalfTheta );
    		var ratioA = Math.sin( ( 1 - t ) * halfTheta ) / sinHalfTheta,
    			ratioB = Math.sin( t * halfTheta ) / sinHalfTheta;

    		this._w = ( w * ratioA + this._w * ratioB );
    		this._x = ( x * ratioA + this._x * ratioB );
    		this._y = ( y * ratioA + this._y * ratioB );
    		this._z = ( z * ratioA + this._z * ratioB );

    		this._onChangeCallback();

    		return this;

    	},

    	equals: function ( quaternion ) {

    		return ( quaternion._x === this._x ) && ( quaternion._y === this._y ) && ( quaternion._z === this._z ) && ( quaternion._w === this._w );

    	},

    	fromArray: function ( array, offset ) {

    		if ( offset === undefined ) offset = 0;

    		this._x = array[ offset ];
    		this._y = array[ offset + 1 ];
    		this._z = array[ offset + 2 ];
    		this._w = array[ offset + 3 ];

    		this._onChangeCallback();

    		return this;

    	},

    	toArray: function ( array, offset ) {

    		if ( array === undefined ) array = [];
    		if ( offset === undefined ) offset = 0;

    		array[ offset ] = this._x;
    		array[ offset + 1 ] = this._y;
    		array[ offset + 2 ] = this._z;
    		array[ offset + 3 ] = this._w;

    		return array;

    	},

    	_onChange: function ( callback ) {

    		this._onChangeCallback = callback;

    		return this;

    	},

    	_onChangeCallback: function () {}

    } );

    /**
     * @author mrdoob / http://mrdoob.com/
     * @author kile / http://kile.stravaganza.org/
     * @author philogb / http://blog.thejit.org/
     * @author mikael emtinger / http://gomo.se/
     * @author egraether / http://egraether.com/
     * @author WestLangley / http://github.com/WestLangley
     */

    var _vector = new Vector3();
    var _quaternion = new Quaternion();

    function Vector3( x, y, z ) {

    	this.x = x || 0;
    	this.y = y || 0;
    	this.z = z || 0;

    }

    Object.assign( Vector3.prototype, {

    	isVector3: true,

    	set: function ( x, y, z ) {

    		this.x = x;
    		this.y = y;
    		this.z = z;

    		return this;

    	},

    	setScalar: function ( scalar ) {

    		this.x = scalar;
    		this.y = scalar;
    		this.z = scalar;

    		return this;

    	},

    	setX: function ( x ) {

    		this.x = x;

    		return this;

    	},

    	setY: function ( y ) {

    		this.y = y;

    		return this;

    	},

    	setZ: function ( z ) {

    		this.z = z;

    		return this;

    	},

    	setComponent: function ( index, value ) {

    		switch ( index ) {

    			case 0: this.x = value; break;
    			case 1: this.y = value; break;
    			case 2: this.z = value; break;
    			default: throw new Error( 'index is out of range: ' + index );

    		}

    		return this;

    	},

    	getComponent: function ( index ) {

    		switch ( index ) {

    			case 0: return this.x;
    			case 1: return this.y;
    			case 2: return this.z;
    			default: throw new Error( 'index is out of range: ' + index );

    		}

    	},

    	clone: function () {

    		return new this.constructor( this.x, this.y, this.z );

    	},

    	copy: function ( v ) {

    		this.x = v.x;
    		this.y = v.y;
    		this.z = v.z;

    		return this;

    	},

    	add: function ( v, w ) {

    		if ( w !== undefined ) {

    			console.warn( 'THREE.Vector3: .add() now only accepts one argument. Use .addVectors( a, b ) instead.' );
    			return this.addVectors( v, w );

    		}

    		this.x += v.x;
    		this.y += v.y;
    		this.z += v.z;

    		return this;

    	},

    	addScalar: function ( s ) {

    		this.x += s;
    		this.y += s;
    		this.z += s;

    		return this;

    	},

    	addVectors: function ( a, b ) {

    		this.x = a.x + b.x;
    		this.y = a.y + b.y;
    		this.z = a.z + b.z;

    		return this;

    	},

    	addScaledVector: function ( v, s ) {

    		this.x += v.x * s;
    		this.y += v.y * s;
    		this.z += v.z * s;

    		return this;

    	},

    	sub: function ( v, w ) {

    		if ( w !== undefined ) {

    			console.warn( 'THREE.Vector3: .sub() now only accepts one argument. Use .subVectors( a, b ) instead.' );
    			return this.subVectors( v, w );

    		}

    		this.x -= v.x;
    		this.y -= v.y;
    		this.z -= v.z;

    		return this;

    	},

    	subScalar: function ( s ) {

    		this.x -= s;
    		this.y -= s;
    		this.z -= s;

    		return this;

    	},

    	subVectors: function ( a, b ) {

    		this.x = a.x - b.x;
    		this.y = a.y - b.y;
    		this.z = a.z - b.z;

    		return this;

    	},

    	multiply: function ( v, w ) {

    		if ( w !== undefined ) {

    			console.warn( 'THREE.Vector3: .multiply() now only accepts one argument. Use .multiplyVectors( a, b ) instead.' );
    			return this.multiplyVectors( v, w );

    		}

    		this.x *= v.x;
    		this.y *= v.y;
    		this.z *= v.z;

    		return this;

    	},

    	multiplyScalar: function ( scalar ) {

    		this.x *= scalar;
    		this.y *= scalar;
    		this.z *= scalar;

    		return this;

    	},

    	multiplyVectors: function ( a, b ) {

    		this.x = a.x * b.x;
    		this.y = a.y * b.y;
    		this.z = a.z * b.z;

    		return this;

    	},

    	applyEuler: function ( euler ) {

    		if ( ! ( euler && euler.isEuler ) ) {

    			console.error( 'THREE.Vector3: .applyEuler() now expects an Euler rotation rather than a Vector3 and order.' );

    		}

    		return this.applyQuaternion( _quaternion.setFromEuler( euler ) );

    	},

    	applyAxisAngle: function ( axis, angle ) {

    		return this.applyQuaternion( _quaternion.setFromAxisAngle( axis, angle ) );

    	},

    	applyMatrix3: function ( m ) {

    		var x = this.x, y = this.y, z = this.z;
    		var e = m.elements;

    		this.x = e[ 0 ] * x + e[ 3 ] * y + e[ 6 ] * z;
    		this.y = e[ 1 ] * x + e[ 4 ] * y + e[ 7 ] * z;
    		this.z = e[ 2 ] * x + e[ 5 ] * y + e[ 8 ] * z;

    		return this;

    	},

    	applyMatrix4: function ( m ) {

    		var x = this.x, y = this.y, z = this.z;
    		var e = m.elements;

    		var w = 1 / ( e[ 3 ] * x + e[ 7 ] * y + e[ 11 ] * z + e[ 15 ] );

    		this.x = ( e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z + e[ 12 ] ) * w;
    		this.y = ( e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z + e[ 13 ] ) * w;
    		this.z = ( e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z + e[ 14 ] ) * w;

    		return this;

    	},

    	applyQuaternion: function ( q ) {

    		var x = this.x, y = this.y, z = this.z;
    		var qx = q.x, qy = q.y, qz = q.z, qw = q.w;

    		// calculate quat * vector

    		var ix = qw * x + qy * z - qz * y;
    		var iy = qw * y + qz * x - qx * z;
    		var iz = qw * z + qx * y - qy * x;
    		var iw = - qx * x - qy * y - qz * z;

    		// calculate result * inverse quat

    		this.x = ix * qw + iw * - qx + iy * - qz - iz * - qy;
    		this.y = iy * qw + iw * - qy + iz * - qx - ix * - qz;
    		this.z = iz * qw + iw * - qz + ix * - qy - iy * - qx;

    		return this;

    	},

    	project: function ( camera ) {

    		return this.applyMatrix4( camera.matrixWorldInverse ).applyMatrix4( camera.projectionMatrix );

    	},

    	unproject: function ( camera ) {

    		return this.applyMatrix4( camera.projectionMatrixInverse ).applyMatrix4( camera.matrixWorld );

    	},

    	transformDirection: function ( m ) {

    		// input: THREE.Matrix4 affine matrix
    		// vector interpreted as a direction

    		var x = this.x, y = this.y, z = this.z;
    		var e = m.elements;

    		this.x = e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z;
    		this.y = e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z;
    		this.z = e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z;

    		return this.normalize();

    	},

    	divide: function ( v ) {

    		this.x /= v.x;
    		this.y /= v.y;
    		this.z /= v.z;

    		return this;

    	},

    	divideScalar: function ( scalar ) {

    		return this.multiplyScalar( 1 / scalar );

    	},

    	min: function ( v ) {

    		this.x = Math.min( this.x, v.x );
    		this.y = Math.min( this.y, v.y );
    		this.z = Math.min( this.z, v.z );

    		return this;

    	},

    	max: function ( v ) {

    		this.x = Math.max( this.x, v.x );
    		this.y = Math.max( this.y, v.y );
    		this.z = Math.max( this.z, v.z );

    		return this;

    	},

    	clamp: function ( min, max ) {

    		// assumes min < max, componentwise

    		this.x = Math.max( min.x, Math.min( max.x, this.x ) );
    		this.y = Math.max( min.y, Math.min( max.y, this.y ) );
    		this.z = Math.max( min.z, Math.min( max.z, this.z ) );

    		return this;

    	},

    	clampScalar: function ( minVal, maxVal ) {

    		this.x = Math.max( minVal, Math.min( maxVal, this.x ) );
    		this.y = Math.max( minVal, Math.min( maxVal, this.y ) );
    		this.z = Math.max( minVal, Math.min( maxVal, this.z ) );

    		return this;

    	},

    	clampLength: function ( min, max ) {

    		var length = this.length();

    		return this.divideScalar( length || 1 ).multiplyScalar( Math.max( min, Math.min( max, length ) ) );

    	},

    	floor: function () {

    		this.x = Math.floor( this.x );
    		this.y = Math.floor( this.y );
    		this.z = Math.floor( this.z );

    		return this;

    	},

    	ceil: function () {

    		this.x = Math.ceil( this.x );
    		this.y = Math.ceil( this.y );
    		this.z = Math.ceil( this.z );

    		return this;

    	},

    	round: function () {

    		this.x = Math.round( this.x );
    		this.y = Math.round( this.y );
    		this.z = Math.round( this.z );

    		return this;

    	},

    	roundToZero: function () {

    		this.x = ( this.x < 0 ) ? Math.ceil( this.x ) : Math.floor( this.x );
    		this.y = ( this.y < 0 ) ? Math.ceil( this.y ) : Math.floor( this.y );
    		this.z = ( this.z < 0 ) ? Math.ceil( this.z ) : Math.floor( this.z );

    		return this;

    	},

    	negate: function () {

    		this.x = - this.x;
    		this.y = - this.y;
    		this.z = - this.z;

    		return this;

    	},

    	dot: function ( v ) {

    		return this.x * v.x + this.y * v.y + this.z * v.z;

    	},

    	// TODO lengthSquared?

    	lengthSq: function () {

    		return this.x * this.x + this.y * this.y + this.z * this.z;

    	},

    	length: function () {

    		return Math.sqrt( this.x * this.x + this.y * this.y + this.z * this.z );

    	},

    	manhattanLength: function () {

    		return Math.abs( this.x ) + Math.abs( this.y ) + Math.abs( this.z );

    	},

    	normalize: function () {

    		return this.divideScalar( this.length() || 1 );

    	},

    	setLength: function ( length ) {

    		return this.normalize().multiplyScalar( length );

    	},

    	lerp: function ( v, alpha ) {

    		this.x += ( v.x - this.x ) * alpha;
    		this.y += ( v.y - this.y ) * alpha;
    		this.z += ( v.z - this.z ) * alpha;

    		return this;

    	},

    	lerpVectors: function ( v1, v2, alpha ) {

    		return this.subVectors( v2, v1 ).multiplyScalar( alpha ).add( v1 );

    	},

    	cross: function ( v, w ) {

    		if ( w !== undefined ) {

    			console.warn( 'THREE.Vector3: .cross() now only accepts one argument. Use .crossVectors( a, b ) instead.' );
    			return this.crossVectors( v, w );

    		}

    		return this.crossVectors( this, v );

    	},

    	crossVectors: function ( a, b ) {

    		var ax = a.x, ay = a.y, az = a.z;
    		var bx = b.x, by = b.y, bz = b.z;

    		this.x = ay * bz - az * by;
    		this.y = az * bx - ax * bz;
    		this.z = ax * by - ay * bx;

    		return this;

    	},

    	projectOnVector: function ( v ) {

    		// v cannot be the zero v

    		var scalar = v.dot( this ) / v.lengthSq();

    		return this.copy( v ).multiplyScalar( scalar );

    	},

    	projectOnPlane: function ( planeNormal ) {

    		_vector.copy( this ).projectOnVector( planeNormal );

    		return this.sub( _vector );

    	},

    	reflect: function ( normal ) {

    		// reflect incident vector off plane orthogonal to normal
    		// normal is assumed to have unit length

    		return this.sub( _vector.copy( normal ).multiplyScalar( 2 * this.dot( normal ) ) );

    	},

    	angleTo: function ( v ) {

    		var denominator = Math.sqrt( this.lengthSq() * v.lengthSq() );

    		if ( denominator === 0 ) console.error( 'THREE.Vector3: angleTo() can\'t handle zero length vectors.' );

    		var theta = this.dot( v ) / denominator;

    		// clamp, to handle numerical problems

    		return Math.acos( _Math.clamp( theta, - 1, 1 ) );

    	},

    	distanceTo: function ( v ) {

    		return Math.sqrt( this.distanceToSquared( v ) );

    	},

    	distanceToSquared: function ( v ) {

    		var dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;

    		return dx * dx + dy * dy + dz * dz;

    	},

    	manhattanDistanceTo: function ( v ) {

    		return Math.abs( this.x - v.x ) + Math.abs( this.y - v.y ) + Math.abs( this.z - v.z );

    	},

    	setFromSpherical: function ( s ) {

    		return this.setFromSphericalCoords( s.radius, s.phi, s.theta );

    	},

    	setFromSphericalCoords: function ( radius, phi, theta ) {

    		var sinPhiRadius = Math.sin( phi ) * radius;

    		this.x = sinPhiRadius * Math.sin( theta );
    		this.y = Math.cos( phi ) * radius;
    		this.z = sinPhiRadius * Math.cos( theta );

    		return this;

    	},

    	setFromCylindrical: function ( c ) {

    		return this.setFromCylindricalCoords( c.radius, c.theta, c.y );

    	},

    	setFromCylindricalCoords: function ( radius, theta, y ) {

    		this.x = radius * Math.sin( theta );
    		this.y = y;
    		this.z = radius * Math.cos( theta );

    		return this;

    	},

    	setFromMatrixPosition: function ( m ) {

    		var e = m.elements;

    		this.x = e[ 12 ];
    		this.y = e[ 13 ];
    		this.z = e[ 14 ];

    		return this;

    	},

    	setFromMatrixScale: function ( m ) {

    		var sx = this.setFromMatrixColumn( m, 0 ).length();
    		var sy = this.setFromMatrixColumn( m, 1 ).length();
    		var sz = this.setFromMatrixColumn( m, 2 ).length();

    		this.x = sx;
    		this.y = sy;
    		this.z = sz;

    		return this;

    	},

    	setFromMatrixColumn: function ( m, index ) {

    		return this.fromArray( m.elements, index * 4 );

    	},

    	equals: function ( v ) {

    		return ( ( v.x === this.x ) && ( v.y === this.y ) && ( v.z === this.z ) );

    	},

    	fromArray: function ( array, offset ) {

    		if ( offset === undefined ) offset = 0;

    		this.x = array[ offset ];
    		this.y = array[ offset + 1 ];
    		this.z = array[ offset + 2 ];

    		return this;

    	},

    	toArray: function ( array, offset ) {

    		if ( array === undefined ) array = [];
    		if ( offset === undefined ) offset = 0;

    		array[ offset ] = this.x;
    		array[ offset + 1 ] = this.y;
    		array[ offset + 2 ] = this.z;

    		return array;

    	},

    	fromBufferAttribute: function ( attribute, index, offset ) {

    		if ( offset !== undefined ) {

    			console.warn( 'THREE.Vector3: offset has been removed from .fromBufferAttribute().' );

    		}

    		this.x = attribute.getX( index );
    		this.y = attribute.getY( index );
    		this.z = attribute.getZ( index );

    		return this;

    	}

    } );

    var _v1 = new Vector3();
    var _m1 = new Matrix4();
    var _zero = new Vector3( 0, 0, 0 );
    var _one = new Vector3( 1, 1, 1 );
    var _x = new Vector3();
    var _y = new Vector3();
    var _z = new Vector3();

    /**
     * @author mrdoob / http://mrdoob.com/
     * @author supereggbert / http://www.paulbrunt.co.uk/
     * @author philogb / http://blog.thejit.org/
     * @author jordi_ros / http://plattsoft.com
     * @author D1plo1d / http://github.com/D1plo1d
     * @author alteredq / http://alteredqualia.com/
     * @author mikael emtinger / http://gomo.se/
     * @author timknip / http://www.floorplanner.com/
     * @author bhouston / http://clara.io
     * @author WestLangley / http://github.com/WestLangley
     */

    function Matrix4() {

    	this.elements = [

    		1, 0, 0, 0,
    		0, 1, 0, 0,
    		0, 0, 1, 0,
    		0, 0, 0, 1

    	];

    	if ( arguments.length > 0 ) {

    		console.error( 'THREE.Matrix4: the constructor no longer reads arguments. use .set() instead.' );

    	}

    }

    Object.assign( Matrix4.prototype, {

    	isMatrix4: true,

    	set: function ( n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44 ) {

    		var te = this.elements;

    		te[ 0 ] = n11; te[ 4 ] = n12; te[ 8 ] = n13; te[ 12 ] = n14;
    		te[ 1 ] = n21; te[ 5 ] = n22; te[ 9 ] = n23; te[ 13 ] = n24;
    		te[ 2 ] = n31; te[ 6 ] = n32; te[ 10 ] = n33; te[ 14 ] = n34;
    		te[ 3 ] = n41; te[ 7 ] = n42; te[ 11 ] = n43; te[ 15 ] = n44;

    		return this;

    	},

    	identity: function () {

    		this.set(

    			1, 0, 0, 0,
    			0, 1, 0, 0,
    			0, 0, 1, 0,
    			0, 0, 0, 1

    		);

    		return this;

    	},

    	clone: function () {

    		return new Matrix4().fromArray( this.elements );

    	},

    	copy: function ( m ) {

    		var te = this.elements;
    		var me = m.elements;

    		te[ 0 ] = me[ 0 ]; te[ 1 ] = me[ 1 ]; te[ 2 ] = me[ 2 ]; te[ 3 ] = me[ 3 ];
    		te[ 4 ] = me[ 4 ]; te[ 5 ] = me[ 5 ]; te[ 6 ] = me[ 6 ]; te[ 7 ] = me[ 7 ];
    		te[ 8 ] = me[ 8 ]; te[ 9 ] = me[ 9 ]; te[ 10 ] = me[ 10 ]; te[ 11 ] = me[ 11 ];
    		te[ 12 ] = me[ 12 ]; te[ 13 ] = me[ 13 ]; te[ 14 ] = me[ 14 ]; te[ 15 ] = me[ 15 ];

    		return this;

    	},

    	copyPosition: function ( m ) {

    		var te = this.elements, me = m.elements;

    		te[ 12 ] = me[ 12 ];
    		te[ 13 ] = me[ 13 ];
    		te[ 14 ] = me[ 14 ];

    		return this;

    	},

    	extractBasis: function ( xAxis, yAxis, zAxis ) {

    		xAxis.setFromMatrixColumn( this, 0 );
    		yAxis.setFromMatrixColumn( this, 1 );
    		zAxis.setFromMatrixColumn( this, 2 );

    		return this;

    	},

    	makeBasis: function ( xAxis, yAxis, zAxis ) {

    		this.set(
    			xAxis.x, yAxis.x, zAxis.x, 0,
    			xAxis.y, yAxis.y, zAxis.y, 0,
    			xAxis.z, yAxis.z, zAxis.z, 0,
    			0, 0, 0, 1
    		);

    		return this;

    	},

    	extractRotation: function ( m ) {

    		// this method does not support reflection matrices

    		var te = this.elements;
    		var me = m.elements;

    		var scaleX = 1 / _v1.setFromMatrixColumn( m, 0 ).length();
    		var scaleY = 1 / _v1.setFromMatrixColumn( m, 1 ).length();
    		var scaleZ = 1 / _v1.setFromMatrixColumn( m, 2 ).length();

    		te[ 0 ] = me[ 0 ] * scaleX;
    		te[ 1 ] = me[ 1 ] * scaleX;
    		te[ 2 ] = me[ 2 ] * scaleX;
    		te[ 3 ] = 0;

    		te[ 4 ] = me[ 4 ] * scaleY;
    		te[ 5 ] = me[ 5 ] * scaleY;
    		te[ 6 ] = me[ 6 ] * scaleY;
    		te[ 7 ] = 0;

    		te[ 8 ] = me[ 8 ] * scaleZ;
    		te[ 9 ] = me[ 9 ] * scaleZ;
    		te[ 10 ] = me[ 10 ] * scaleZ;
    		te[ 11 ] = 0;

    		te[ 12 ] = 0;
    		te[ 13 ] = 0;
    		te[ 14 ] = 0;
    		te[ 15 ] = 1;

    		return this;

    	},

    	makeRotationFromEuler: function ( euler ) {

    		if ( ! ( euler && euler.isEuler ) ) {

    			console.error( 'THREE.Matrix4: .makeRotationFromEuler() now expects a Euler rotation rather than a Vector3 and order.' );

    		}

    		var te = this.elements;

    		var x = euler.x, y = euler.y, z = euler.z;
    		var a = Math.cos( x ), b = Math.sin( x );
    		var c = Math.cos( y ), d = Math.sin( y );
    		var e = Math.cos( z ), f = Math.sin( z );

    		if ( euler.order === 'XYZ' ) {

    			var ae = a * e, af = a * f, be = b * e, bf = b * f;

    			te[ 0 ] = c * e;
    			te[ 4 ] = - c * f;
    			te[ 8 ] = d;

    			te[ 1 ] = af + be * d;
    			te[ 5 ] = ae - bf * d;
    			te[ 9 ] = - b * c;

    			te[ 2 ] = bf - ae * d;
    			te[ 6 ] = be + af * d;
    			te[ 10 ] = a * c;

    		} else if ( euler.order === 'YXZ' ) {

    			var ce = c * e, cf = c * f, de = d * e, df = d * f;

    			te[ 0 ] = ce + df * b;
    			te[ 4 ] = de * b - cf;
    			te[ 8 ] = a * d;

    			te[ 1 ] = a * f;
    			te[ 5 ] = a * e;
    			te[ 9 ] = - b;

    			te[ 2 ] = cf * b - de;
    			te[ 6 ] = df + ce * b;
    			te[ 10 ] = a * c;

    		} else if ( euler.order === 'ZXY' ) {

    			var ce = c * e, cf = c * f, de = d * e, df = d * f;

    			te[ 0 ] = ce - df * b;
    			te[ 4 ] = - a * f;
    			te[ 8 ] = de + cf * b;

    			te[ 1 ] = cf + de * b;
    			te[ 5 ] = a * e;
    			te[ 9 ] = df - ce * b;

    			te[ 2 ] = - a * d;
    			te[ 6 ] = b;
    			te[ 10 ] = a * c;

    		} else if ( euler.order === 'ZYX' ) {

    			var ae = a * e, af = a * f, be = b * e, bf = b * f;

    			te[ 0 ] = c * e;
    			te[ 4 ] = be * d - af;
    			te[ 8 ] = ae * d + bf;

    			te[ 1 ] = c * f;
    			te[ 5 ] = bf * d + ae;
    			te[ 9 ] = af * d - be;

    			te[ 2 ] = - d;
    			te[ 6 ] = b * c;
    			te[ 10 ] = a * c;

    		} else if ( euler.order === 'YZX' ) {

    			var ac = a * c, ad = a * d, bc = b * c, bd = b * d;

    			te[ 0 ] = c * e;
    			te[ 4 ] = bd - ac * f;
    			te[ 8 ] = bc * f + ad;

    			te[ 1 ] = f;
    			te[ 5 ] = a * e;
    			te[ 9 ] = - b * e;

    			te[ 2 ] = - d * e;
    			te[ 6 ] = ad * f + bc;
    			te[ 10 ] = ac - bd * f;

    		} else if ( euler.order === 'XZY' ) {

    			var ac = a * c, ad = a * d, bc = b * c, bd = b * d;

    			te[ 0 ] = c * e;
    			te[ 4 ] = - f;
    			te[ 8 ] = d * e;

    			te[ 1 ] = ac * f + bd;
    			te[ 5 ] = a * e;
    			te[ 9 ] = ad * f - bc;

    			te[ 2 ] = bc * f - ad;
    			te[ 6 ] = b * e;
    			te[ 10 ] = bd * f + ac;

    		}

    		// bottom row
    		te[ 3 ] = 0;
    		te[ 7 ] = 0;
    		te[ 11 ] = 0;

    		// last column
    		te[ 12 ] = 0;
    		te[ 13 ] = 0;
    		te[ 14 ] = 0;
    		te[ 15 ] = 1;

    		return this;

    	},

    	makeRotationFromQuaternion: function ( q ) {

    		return this.compose( _zero, q, _one );

    	},

    	lookAt: function ( eye, target, up ) {

    		var te = this.elements;

    		_z.subVectors( eye, target );

    		if ( _z.lengthSq() === 0 ) {

    			// eye and target are in the same position

    			_z.z = 1;

    		}

    		_z.normalize();
    		_x.crossVectors( up, _z );

    		if ( _x.lengthSq() === 0 ) {

    			// up and z are parallel

    			if ( Math.abs( up.z ) === 1 ) {

    				_z.x += 0.0001;

    			} else {

    				_z.z += 0.0001;

    			}

    			_z.normalize();
    			_x.crossVectors( up, _z );

    		}

    		_x.normalize();
    		_y.crossVectors( _z, _x );

    		te[ 0 ] = _x.x; te[ 4 ] = _y.x; te[ 8 ] = _z.x;
    		te[ 1 ] = _x.y; te[ 5 ] = _y.y; te[ 9 ] = _z.y;
    		te[ 2 ] = _x.z; te[ 6 ] = _y.z; te[ 10 ] = _z.z;

    		return this;

    	},

    	multiply: function ( m, n ) {

    		if ( n !== undefined ) {

    			console.warn( 'THREE.Matrix4: .multiply() now only accepts one argument. Use .multiplyMatrices( a, b ) instead.' );
    			return this.multiplyMatrices( m, n );

    		}

    		return this.multiplyMatrices( this, m );

    	},

    	premultiply: function ( m ) {

    		return this.multiplyMatrices( m, this );

    	},

    	multiplyMatrices: function ( a, b ) {

    		var ae = a.elements;
    		var be = b.elements;
    		var te = this.elements;

    		var a11 = ae[ 0 ], a12 = ae[ 4 ], a13 = ae[ 8 ], a14 = ae[ 12 ];
    		var a21 = ae[ 1 ], a22 = ae[ 5 ], a23 = ae[ 9 ], a24 = ae[ 13 ];
    		var a31 = ae[ 2 ], a32 = ae[ 6 ], a33 = ae[ 10 ], a34 = ae[ 14 ];
    		var a41 = ae[ 3 ], a42 = ae[ 7 ], a43 = ae[ 11 ], a44 = ae[ 15 ];

    		var b11 = be[ 0 ], b12 = be[ 4 ], b13 = be[ 8 ], b14 = be[ 12 ];
    		var b21 = be[ 1 ], b22 = be[ 5 ], b23 = be[ 9 ], b24 = be[ 13 ];
    		var b31 = be[ 2 ], b32 = be[ 6 ], b33 = be[ 10 ], b34 = be[ 14 ];
    		var b41 = be[ 3 ], b42 = be[ 7 ], b43 = be[ 11 ], b44 = be[ 15 ];

    		te[ 0 ] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    		te[ 4 ] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    		te[ 8 ] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    		te[ 12 ] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

    		te[ 1 ] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    		te[ 5 ] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    		te[ 9 ] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    		te[ 13 ] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

    		te[ 2 ] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    		te[ 6 ] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    		te[ 10 ] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    		te[ 14 ] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

    		te[ 3 ] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    		te[ 7 ] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    		te[ 11 ] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    		te[ 15 ] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

    		return this;

    	},

    	multiplyScalar: function ( s ) {

    		var te = this.elements;

    		te[ 0 ] *= s; te[ 4 ] *= s; te[ 8 ] *= s; te[ 12 ] *= s;
    		te[ 1 ] *= s; te[ 5 ] *= s; te[ 9 ] *= s; te[ 13 ] *= s;
    		te[ 2 ] *= s; te[ 6 ] *= s; te[ 10 ] *= s; te[ 14 ] *= s;
    		te[ 3 ] *= s; te[ 7 ] *= s; te[ 11 ] *= s; te[ 15 ] *= s;

    		return this;

    	},

    	applyToBufferAttribute: function ( attribute ) {

    		for ( var i = 0, l = attribute.count; i < l; i ++ ) {

    			_v1.x = attribute.getX( i );
    			_v1.y = attribute.getY( i );
    			_v1.z = attribute.getZ( i );

    			_v1.applyMatrix4( this );

    			attribute.setXYZ( i, _v1.x, _v1.y, _v1.z );

    		}

    		return attribute;

    	},

    	determinant: function () {

    		var te = this.elements;

    		var n11 = te[ 0 ], n12 = te[ 4 ], n13 = te[ 8 ], n14 = te[ 12 ];
    		var n21 = te[ 1 ], n22 = te[ 5 ], n23 = te[ 9 ], n24 = te[ 13 ];
    		var n31 = te[ 2 ], n32 = te[ 6 ], n33 = te[ 10 ], n34 = te[ 14 ];
    		var n41 = te[ 3 ], n42 = te[ 7 ], n43 = te[ 11 ], n44 = te[ 15 ];

    		//TODO: make this more efficient
    		//( based on http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm )

    		return (
    			n41 * (
    				+ n14 * n23 * n32
    				 - n13 * n24 * n32
    				 - n14 * n22 * n33
    				 + n12 * n24 * n33
    				 + n13 * n22 * n34
    				 - n12 * n23 * n34
    			) +
    			n42 * (
    				+ n11 * n23 * n34
    				 - n11 * n24 * n33
    				 + n14 * n21 * n33
    				 - n13 * n21 * n34
    				 + n13 * n24 * n31
    				 - n14 * n23 * n31
    			) +
    			n43 * (
    				+ n11 * n24 * n32
    				 - n11 * n22 * n34
    				 - n14 * n21 * n32
    				 + n12 * n21 * n34
    				 + n14 * n22 * n31
    				 - n12 * n24 * n31
    			) +
    			n44 * (
    				- n13 * n22 * n31
    				 - n11 * n23 * n32
    				 + n11 * n22 * n33
    				 + n13 * n21 * n32
    				 - n12 * n21 * n33
    				 + n12 * n23 * n31
    			)

    		);

    	},

    	transpose: function () {

    		var te = this.elements;
    		var tmp;

    		tmp = te[ 1 ]; te[ 1 ] = te[ 4 ]; te[ 4 ] = tmp;
    		tmp = te[ 2 ]; te[ 2 ] = te[ 8 ]; te[ 8 ] = tmp;
    		tmp = te[ 6 ]; te[ 6 ] = te[ 9 ]; te[ 9 ] = tmp;

    		tmp = te[ 3 ]; te[ 3 ] = te[ 12 ]; te[ 12 ] = tmp;
    		tmp = te[ 7 ]; te[ 7 ] = te[ 13 ]; te[ 13 ] = tmp;
    		tmp = te[ 11 ]; te[ 11 ] = te[ 14 ]; te[ 14 ] = tmp;

    		return this;

    	},

    	setPosition: function ( x, y, z ) {

    		var te = this.elements;

    		if ( x.isVector3 ) {

    			te[ 12 ] = x.x;
    			te[ 13 ] = x.y;
    			te[ 14 ] = x.z;

    		} else {

    			te[ 12 ] = x;
    			te[ 13 ] = y;
    			te[ 14 ] = z;

    		}

    		return this;

    	},

    	getInverse: function ( m, throwOnDegenerate ) {

    		// based on http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm
    		var te = this.elements,
    			me = m.elements,

    			n11 = me[ 0 ], n21 = me[ 1 ], n31 = me[ 2 ], n41 = me[ 3 ],
    			n12 = me[ 4 ], n22 = me[ 5 ], n32 = me[ 6 ], n42 = me[ 7 ],
    			n13 = me[ 8 ], n23 = me[ 9 ], n33 = me[ 10 ], n43 = me[ 11 ],
    			n14 = me[ 12 ], n24 = me[ 13 ], n34 = me[ 14 ], n44 = me[ 15 ],

    			t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44,
    			t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44,
    			t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44,
    			t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

    		var det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;

    		if ( det === 0 ) {

    			var msg = "THREE.Matrix4: .getInverse() can't invert matrix, determinant is 0";

    			if ( throwOnDegenerate === true ) {

    				throw new Error( msg );

    			} else {

    				console.warn( msg );

    			}

    			return this.identity();

    		}

    		var detInv = 1 / det;

    		te[ 0 ] = t11 * detInv;
    		te[ 1 ] = ( n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44 ) * detInv;
    		te[ 2 ] = ( n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44 ) * detInv;
    		te[ 3 ] = ( n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43 ) * detInv;

    		te[ 4 ] = t12 * detInv;
    		te[ 5 ] = ( n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44 ) * detInv;
    		te[ 6 ] = ( n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44 ) * detInv;
    		te[ 7 ] = ( n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43 ) * detInv;

    		te[ 8 ] = t13 * detInv;
    		te[ 9 ] = ( n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44 ) * detInv;
    		te[ 10 ] = ( n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44 ) * detInv;
    		te[ 11 ] = ( n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43 ) * detInv;

    		te[ 12 ] = t14 * detInv;
    		te[ 13 ] = ( n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34 ) * detInv;
    		te[ 14 ] = ( n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34 ) * detInv;
    		te[ 15 ] = ( n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33 ) * detInv;

    		return this;

    	},

    	scale: function ( v ) {

    		var te = this.elements;
    		var x = v.x, y = v.y, z = v.z;

    		te[ 0 ] *= x; te[ 4 ] *= y; te[ 8 ] *= z;
    		te[ 1 ] *= x; te[ 5 ] *= y; te[ 9 ] *= z;
    		te[ 2 ] *= x; te[ 6 ] *= y; te[ 10 ] *= z;
    		te[ 3 ] *= x; te[ 7 ] *= y; te[ 11 ] *= z;

    		return this;

    	},

    	getMaxScaleOnAxis: function () {

    		var te = this.elements;

    		var scaleXSq = te[ 0 ] * te[ 0 ] + te[ 1 ] * te[ 1 ] + te[ 2 ] * te[ 2 ];
    		var scaleYSq = te[ 4 ] * te[ 4 ] + te[ 5 ] * te[ 5 ] + te[ 6 ] * te[ 6 ];
    		var scaleZSq = te[ 8 ] * te[ 8 ] + te[ 9 ] * te[ 9 ] + te[ 10 ] * te[ 10 ];

    		return Math.sqrt( Math.max( scaleXSq, scaleYSq, scaleZSq ) );

    	},

    	makeTranslation: function ( x, y, z ) {

    		this.set(

    			1, 0, 0, x,
    			0, 1, 0, y,
    			0, 0, 1, z,
    			0, 0, 0, 1

    		);

    		return this;

    	},

    	makeRotationX: function ( theta ) {

    		var c = Math.cos( theta ), s = Math.sin( theta );

    		this.set(

    			1, 0, 0, 0,
    			0, c, - s, 0,
    			0, s, c, 0,
    			0, 0, 0, 1

    		);

    		return this;

    	},

    	makeRotationY: function ( theta ) {

    		var c = Math.cos( theta ), s = Math.sin( theta );

    		this.set(

    			 c, 0, s, 0,
    			 0, 1, 0, 0,
    			- s, 0, c, 0,
    			 0, 0, 0, 1

    		);

    		return this;

    	},

    	makeRotationZ: function ( theta ) {

    		var c = Math.cos( theta ), s = Math.sin( theta );

    		this.set(

    			c, - s, 0, 0,
    			s, c, 0, 0,
    			0, 0, 1, 0,
    			0, 0, 0, 1

    		);

    		return this;

    	},

    	makeRotationAxis: function ( axis, angle ) {

    		// Based on http://www.gamedev.net/reference/articles/article1199.asp

    		var c = Math.cos( angle );
    		var s = Math.sin( angle );
    		var t = 1 - c;
    		var x = axis.x, y = axis.y, z = axis.z;
    		var tx = t * x, ty = t * y;

    		this.set(

    			tx * x + c, tx * y - s * z, tx * z + s * y, 0,
    			tx * y + s * z, ty * y + c, ty * z - s * x, 0,
    			tx * z - s * y, ty * z + s * x, t * z * z + c, 0,
    			0, 0, 0, 1

    		);

    		 return this;

    	},

    	makeScale: function ( x, y, z ) {

    		this.set(

    			x, 0, 0, 0,
    			0, y, 0, 0,
    			0, 0, z, 0,
    			0, 0, 0, 1

    		);

    		return this;

    	},

    	makeShear: function ( x, y, z ) {

    		this.set(

    			1, y, z, 0,
    			x, 1, z, 0,
    			x, y, 1, 0,
    			0, 0, 0, 1

    		);

    		return this;

    	},

    	compose: function ( position, quaternion, scale ) {

    		var te = this.elements;

    		var x = quaternion._x, y = quaternion._y, z = quaternion._z, w = quaternion._w;
    		var x2 = x + x,	y2 = y + y, z2 = z + z;
    		var xx = x * x2, xy = x * y2, xz = x * z2;
    		var yy = y * y2, yz = y * z2, zz = z * z2;
    		var wx = w * x2, wy = w * y2, wz = w * z2;

    		var sx = scale.x, sy = scale.y, sz = scale.z;

    		te[ 0 ] = ( 1 - ( yy + zz ) ) * sx;
    		te[ 1 ] = ( xy + wz ) * sx;
    		te[ 2 ] = ( xz - wy ) * sx;
    		te[ 3 ] = 0;

    		te[ 4 ] = ( xy - wz ) * sy;
    		te[ 5 ] = ( 1 - ( xx + zz ) ) * sy;
    		te[ 6 ] = ( yz + wx ) * sy;
    		te[ 7 ] = 0;

    		te[ 8 ] = ( xz + wy ) * sz;
    		te[ 9 ] = ( yz - wx ) * sz;
    		te[ 10 ] = ( 1 - ( xx + yy ) ) * sz;
    		te[ 11 ] = 0;

    		te[ 12 ] = position.x;
    		te[ 13 ] = position.y;
    		te[ 14 ] = position.z;
    		te[ 15 ] = 1;

    		return this;

    	},

    	decompose: function ( position, quaternion, scale ) {

    		var te = this.elements;

    		var sx = _v1.set( te[ 0 ], te[ 1 ], te[ 2 ] ).length();
    		var sy = _v1.set( te[ 4 ], te[ 5 ], te[ 6 ] ).length();
    		var sz = _v1.set( te[ 8 ], te[ 9 ], te[ 10 ] ).length();

    		// if determine is negative, we need to invert one scale
    		var det = this.determinant();
    		if ( det < 0 ) sx = - sx;

    		position.x = te[ 12 ];
    		position.y = te[ 13 ];
    		position.z = te[ 14 ];

    		// scale the rotation part
    		_m1.copy( this );

    		var invSX = 1 / sx;
    		var invSY = 1 / sy;
    		var invSZ = 1 / sz;

    		_m1.elements[ 0 ] *= invSX;
    		_m1.elements[ 1 ] *= invSX;
    		_m1.elements[ 2 ] *= invSX;

    		_m1.elements[ 4 ] *= invSY;
    		_m1.elements[ 5 ] *= invSY;
    		_m1.elements[ 6 ] *= invSY;

    		_m1.elements[ 8 ] *= invSZ;
    		_m1.elements[ 9 ] *= invSZ;
    		_m1.elements[ 10 ] *= invSZ;

    		quaternion.setFromRotationMatrix( _m1 );

    		scale.x = sx;
    		scale.y = sy;
    		scale.z = sz;

    		return this;

    	},

    	makePerspective: function ( left, right, top, bottom, near, far ) {

    		if ( far === undefined ) {

    			console.warn( 'THREE.Matrix4: .makePerspective() has been redefined and has a new signature. Please check the docs.' );

    		}

    		var te = this.elements;
    		var x = 2 * near / ( right - left );
    		var y = 2 * near / ( top - bottom );

    		var a = ( right + left ) / ( right - left );
    		var b = ( top + bottom ) / ( top - bottom );
    		var c = - ( far + near ) / ( far - near );
    		var d = - 2 * far * near / ( far - near );

    		te[ 0 ] = x;	te[ 4 ] = 0;	te[ 8 ] = a;	te[ 12 ] = 0;
    		te[ 1 ] = 0;	te[ 5 ] = y;	te[ 9 ] = b;	te[ 13 ] = 0;
    		te[ 2 ] = 0;	te[ 6 ] = 0;	te[ 10 ] = c;	te[ 14 ] = d;
    		te[ 3 ] = 0;	te[ 7 ] = 0;	te[ 11 ] = - 1;	te[ 15 ] = 0;

    		return this;

    	},

    	makeOrthographic: function ( left, right, top, bottom, near, far ) {

    		var te = this.elements;
    		var w = 1.0 / ( right - left );
    		var h = 1.0 / ( top - bottom );
    		var p = 1.0 / ( far - near );

    		var x = ( right + left ) * w;
    		var y = ( top + bottom ) * h;
    		var z = ( far + near ) * p;

    		te[ 0 ] = 2 * w;	te[ 4 ] = 0;	te[ 8 ] = 0;	te[ 12 ] = - x;
    		te[ 1 ] = 0;	te[ 5 ] = 2 * h;	te[ 9 ] = 0;	te[ 13 ] = - y;
    		te[ 2 ] = 0;	te[ 6 ] = 0;	te[ 10 ] = - 2 * p;	te[ 14 ] = - z;
    		te[ 3 ] = 0;	te[ 7 ] = 0;	te[ 11 ] = 0;	te[ 15 ] = 1;

    		return this;

    	},

    	equals: function ( matrix ) {

    		var te = this.elements;
    		var me = matrix.elements;

    		for ( var i = 0; i < 16; i ++ ) {

    			if ( te[ i ] !== me[ i ] ) return false;

    		}

    		return true;

    	},

    	fromArray: function ( array, offset ) {

    		if ( offset === undefined ) offset = 0;

    		for ( var i = 0; i < 16; i ++ ) {

    			this.elements[ i ] = array[ i + offset ];

    		}

    		return this;

    	},

    	toArray: function ( array, offset ) {

    		if ( array === undefined ) array = [];
    		if ( offset === undefined ) offset = 0;

    		var te = this.elements;

    		array[ offset ] = te[ 0 ];
    		array[ offset + 1 ] = te[ 1 ];
    		array[ offset + 2 ] = te[ 2 ];
    		array[ offset + 3 ] = te[ 3 ];

    		array[ offset + 4 ] = te[ 4 ];
    		array[ offset + 5 ] = te[ 5 ];
    		array[ offset + 6 ] = te[ 6 ];
    		array[ offset + 7 ] = te[ 7 ];

    		array[ offset + 8 ] = te[ 8 ];
    		array[ offset + 9 ] = te[ 9 ];
    		array[ offset + 10 ] = te[ 10 ];
    		array[ offset + 11 ] = te[ 11 ];

    		array[ offset + 12 ] = te[ 12 ];
    		array[ offset + 13 ] = te[ 13 ];
    		array[ offset + 14 ] = te[ 14 ];
    		array[ offset + 15 ] = te[ 15 ];

    		return array;

    	}

    } );

    function id(element) {
        return element.id ? `#${element.id}` : '';
    }
    function classes(element) {
        let classSelector = '';
        const classList = element.classList;
        for (const c of classList) {
            classSelector += '.' + c;
        }
        return classSelector;
    }
    function nthChild(element) {
        let childNumber = 0;
        const childNodes = element.parentNode.childNodes;
        for (const node of childNodes) {
            if (node.nodeType === Node.ELEMENT_NODE)
                ++childNumber;
            if (node === element)
                return `:nth-child('${childNumber}')`;
        }
    }
    function attributes(element) {
        let attributes = '';
        for (const attr of element.attributes) {
            attributes += `[${attr.name}="${attr.value}"]`;
        }
        return attributes;
    }
    function path(el, rootNode = document.documentElement) {
        const selector = el.tagName.toLowerCase() + id(el) + classes(el) + attributes(el) + nthChild(el);
        const hasParent = el.parentNode && el.parentNode !== rootNode && el.parentNode.tagName;
        return hasParent ? path(el.parentNode, rootNode) + ' > ' + selector : selector;
    }
    function hash(el) {
        const cssPath = path(el);
        const type = el.type;
        const checked = el.checked;
        const value = el.value;
        const textContent = el.textContent;
    }
    function traverseChildElements(node, each, bind, level = 0) {
        level++;
        for (let child = node.firstChild; child; child = child.nextSibling) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const el = child;
                if (each.call(bind, el, level)) {
                    traverseChildElements(el, each, bind, level);
                }
            }
        }
    }
    function addCSSRule(sheet, selector, rules, index) {
        if ('insertRule' in sheet) {
            sheet.insertRule(selector + '{' + rules + '}', index);
        }
        else if ('addRule' in sheet) {
            sheet.addRule(selector, rules, index);
        }
    }
    class Bounds {
        constructor() {
            this.left = 0;
            this.top = 0;
            this.width = 0;
            this.height = 0;
        }
        copy(rect) {
            this.top = rect.top;
            this.left = rect.left;
            this.width = rect.width;
            this.height = rect.height;
            return this;
        }
    }
    class Edges {
        constructor() {
            this.left = 0;
            this.top = 0;
            this.right = 0;
            this.bottom = 0;
        }
        copy(rect) {
            this.top = rect.top;
            this.left = rect.left;
            this.right = rect.right;
            this.bottom = rect.bottom;
            return this;
        }
    }
    function getBounds(element, bounds = new Bounds(), referenceElement) {
        const doc = element.ownerDocument;
        const defaultView = element.ownerDocument.defaultView;
        const docEl = doc.documentElement;
        const body = doc.body;
        if (element === docEl) {
            return getDocumentBounds(doc, bounds);
        }
        if (referenceElement === element) {
            bounds.left = 0;
            bounds.top = 0;
            bounds.width = element.offsetWidth;
            bounds.height = element.offsetHeight;
            return;
        }
        let el = element;
        let computedStyle;
        let offsetParent = el.offsetParent;
        let prevComputedStyle = defaultView.getComputedStyle(el, null);
        let top = el.offsetTop;
        let left = el.offsetLeft;
        if (offsetParent &&
            referenceElement &&
            offsetParent.contains(referenceElement) &&
            offsetParent !== referenceElement) {
            getBounds(referenceElement, bounds, offsetParent);
            left -= bounds.left;
            top -= bounds.top;
        }
        while ((el = el.parentNode) &&
            el !== body &&
            el !== docEl &&
            el !== referenceElement) {
            if (prevComputedStyle.position === 'fixed') {
                break;
            }
            computedStyle = defaultView.getComputedStyle(el, null);
            top -= el.scrollTop;
            left -= el.scrollLeft;
            if (el === offsetParent) {
                top += el.offsetTop;
                left += el.offsetLeft;
                top += parseFloat(computedStyle.borderTopWidth) || 0;
                left += parseFloat(computedStyle.borderLeftWidth) || 0;
                offsetParent = el.offsetParent;
            }
            prevComputedStyle = computedStyle;
        }
        // if (prevComputedStyle.position === 'relative' || prevComputedStyle.position === 'static') {
        //   getDocumentBounds(doc, bounds)
        //   top += bounds.top
        //   left += bounds.left
        // }
        if (prevComputedStyle.position === 'fixed') {
            top += Math.max(docEl.scrollTop, body.scrollTop);
            left += Math.max(docEl.scrollLeft, body.scrollLeft);
        }
        // let el = element
        // let left = el.offsetLeft
        // let top = el.offsetTop
        // let offsetParent = el.offsetParent
        // while (el && el.nodeType !== Node.DOCUMENT_NODE) {
        //   left -= el.scrollLeft
        //   top -= el.scrollTop
        //   if (el === offsetParent) {
        //     const style = window.getComputedStyle(el)
        //     left += el.offsetLeft + parseFloat(style.borderLeftWidth!) || 0
        //     top += el.offsetTop + parseFloat(style.borderTopWidth!) || 0
        //     offsetParent = el.offsetParent
        //   }
        //   el = el.offsetParent as any
        // }
        bounds.left = left;
        bounds.top = top;
        bounds.width = element.offsetWidth;
        bounds.height = element.offsetHeight;
        return bounds;
    }
    function getMargin(element, margin) {
        let style = getComputedStyle(element);
        margin.left = parseFloat(style.marginLeft) || 0;
        margin.right = parseFloat(style.marginRight) || 0;
        margin.top = parseFloat(style.marginTop) || 0;
        margin.bottom = parseFloat(style.marginBottom) || 0;
    }
    function getBorder(element, border) {
        let style = getComputedStyle(element);
        border.left = parseFloat(style.borderLeftWidth) || 0;
        border.right = parseFloat(style.borderRightWidth) || 0;
        border.top = parseFloat(style.borderTopWidth) || 0;
        border.bottom = parseFloat(style.borderBottomWidth) || 0;
    }
    function getPadding(element, padding) {
        let style = getComputedStyle(element);
        padding.left = parseFloat(style.paddingLeft) || 0;
        padding.right = parseFloat(style.paddingRight) || 0;
        padding.top = parseFloat(style.paddingTop) || 0;
        padding.bottom = parseFloat(style.paddingBottom) || 0;
    }
    /*
     * On some mobile browsers, the value reported by window.innerHeight
     * is not the true viewport height. This method returns
     * the actual viewport.
     */
    function getViewportBounds(bounds) {
        if (!viewportTester.parentNode)
            document.documentElement.append(viewportTester);
        bounds.left = pageXOffset;
        bounds.top = pageYOffset;
        bounds.width = viewportTester.offsetWidth;
        bounds.height = viewportTester.offsetHeight;
        return bounds;
    }
    const viewportTester = document.createElement('div');
    viewportTester.id = 'VIEWPORT';
    viewportTester.style.position = 'fixed';
    viewportTester.style.width = '100vw';
    viewportTester.style.height = '100vh';
    viewportTester.style.visibility = 'hidden';
    viewportTester.style.pointerEvents = 'none';
    function getDocumentBounds(document, bounds) {
        const documentElement = document.documentElement;
        const body = document.body;
        const documentElementStyle = getComputedStyle(documentElement);
        const bodyStyle = getComputedStyle(body);
        bounds.top =
            body.offsetTop + parseFloat(documentElementStyle.marginTop) ||
                0 + parseFloat(bodyStyle.marginTop) ||
                0;
        bounds.left =
            body.offsetLeft + parseFloat(documentElementStyle.marginLeft) ||
                0 + parseFloat(bodyStyle.marginLeft) ||
                0;
        bounds.width = Math.max(Math.max(body.scrollWidth, documentElement.scrollWidth), Math.max(body.offsetWidth, documentElement.offsetWidth), Math.max(body.clientWidth, documentElement.clientWidth));
        bounds.height = Math.max(Math.max(body.scrollHeight, documentElement.scrollHeight), Math.max(body.offsetHeight, documentElement.offsetHeight), Math.max(body.clientHeight, documentElement.clientHeight));
        return bounds;
    }

    var domUtils = /*#__PURE__*/Object.freeze({
        __proto__: null,
        path: path,
        hash: hash,
        traverseChildElements: traverseChildElements,
        addCSSRule: addCSSRule,
        Bounds: Bounds,
        Edges: Edges,
        getBounds: getBounds,
        getMargin: getMargin,
        getBorder: getBorder,
        getPadding: getPadding,
        getViewportBounds: getViewportBounds,
        getDocumentBounds: getDocumentBounds
    });

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var lru = createCommonjsModule(function (module, exports) {
    /**
     * A doubly linked list-based Least Recently Used (LRU) cache. Will keep most
     * recently used items while discarding least recently used items when its limit
     * is reached.
     *
     * Licensed under MIT. Copyright (c) 2010 Rasmus Andersson <http://hunch.se/>
     * See README.md for details.
     *
     * Illustration of the design:
     *
     *       entry             entry             entry             entry
     *       ______            ______            ______            ______
     *      | head |.newer => |      |.newer => |      |.newer => | tail |
     *      |  A   |          |  B   |          |  C   |          |  D   |
     *      |______| <= older.|______| <= older.|______| <= older.|______|
     *
     *  removed  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  added
     */
    (function(g,f){
      const e =  exports ;
      f(e);
    })(commonjsGlobal, function(exports) {

    const NEWER = Symbol('newer');
    const OLDER = Symbol('older');

    function LRUMap(limit, entries) {
      if (typeof limit !== 'number') {
        // called as (entries)
        entries = limit;
        limit = 0;
      }

      this.size = 0;
      this.limit = limit;
      this.oldest = this.newest = undefined;
      this._keymap = new Map();

      if (entries) {
        this.assign(entries);
        if (limit < 1) {
          this.limit = this.size;
        }
      }
    }

    exports.LRUMap = LRUMap;

    function Entry(key, value) {
      this.key = key;
      this.value = value;
      this[NEWER] = undefined;
      this[OLDER] = undefined;
    }


    LRUMap.prototype._markEntryAsUsed = function(entry) {
      if (entry === this.newest) {
        // Already the most recenlty used entry, so no need to update the list
        return;
      }
      // HEAD--------------TAIL
      //   <.older   .newer>
      //  <--- add direction --
      //   A  B  C  <D>  E
      if (entry[NEWER]) {
        if (entry === this.oldest) {
          this.oldest = entry[NEWER];
        }
        entry[NEWER][OLDER] = entry[OLDER]; // C <-- E.
      }
      if (entry[OLDER]) {
        entry[OLDER][NEWER] = entry[NEWER]; // C. --> E
      }
      entry[NEWER] = undefined; // D --x
      entry[OLDER] = this.newest; // D. --> E
      if (this.newest) {
        this.newest[NEWER] = entry; // E. <-- D
      }
      this.newest = entry;
    };

    LRUMap.prototype.assign = function(entries) {
      let entry, limit = this.limit || Number.MAX_VALUE;
      this._keymap.clear();
      let it = entries[Symbol.iterator]();
      for (let itv = it.next(); !itv.done; itv = it.next()) {
        let e = new Entry(itv.value[0], itv.value[1]);
        this._keymap.set(e.key, e);
        if (!entry) {
          this.oldest = e;
        } else {
          entry[NEWER] = e;
          e[OLDER] = entry;
        }
        entry = e;
        if (limit-- == 0) {
          throw new Error('overflow');
        }
      }
      this.newest = entry;
      this.size = this._keymap.size;
    };

    LRUMap.prototype.get = function(key) {
      // First, find our cache entry
      var entry = this._keymap.get(key);
      if (!entry) return; // Not cached. Sorry.
      // As <key> was found in the cache, register it as being requested recently
      this._markEntryAsUsed(entry);
      return entry.value;
    };

    LRUMap.prototype.set = function(key, value) {
      var entry = this._keymap.get(key);

      if (entry) {
        // update existing
        entry.value = value;
        this._markEntryAsUsed(entry);
        return this;
      }

      // new entry
      this._keymap.set(key, (entry = new Entry(key, value)));

      if (this.newest) {
        // link previous tail to the new tail (entry)
        this.newest[NEWER] = entry;
        entry[OLDER] = this.newest;
      } else {
        // we're first in -- yay
        this.oldest = entry;
      }

      // add new entry to the end of the linked list -- it's now the freshest entry.
      this.newest = entry;
      ++this.size;
      if (this.size > this.limit) {
        // we hit the limit -- remove the head
        this.shift();
      }

      return this;
    };

    LRUMap.prototype.shift = function() {
      // todo: handle special case when limit == 1
      var entry = this.oldest;
      if (entry) {
        if (this.oldest[NEWER]) {
          // advance the list
          this.oldest = this.oldest[NEWER];
          this.oldest[OLDER] = undefined;
        } else {
          // the cache is exhausted
          this.oldest = undefined;
          this.newest = undefined;
        }
        // Remove last strong reference to <entry> and remove links from the purged
        // entry being returned:
        entry[NEWER] = entry[OLDER] = undefined;
        this._keymap.delete(entry.key);
        --this.size;
        return [entry.key, entry.value];
      }
    };

    // ----------------------------------------------------------------------------
    // Following code is optional and can be removed without breaking the core
    // functionality.

    LRUMap.prototype.find = function(key) {
      let e = this._keymap.get(key);
      return e ? e.value : undefined;
    };

    LRUMap.prototype.has = function(key) {
      return this._keymap.has(key);
    };

    LRUMap.prototype['delete'] = function(key) {
      var entry = this._keymap.get(key);
      if (!entry) return;
      this._keymap.delete(entry.key);
      if (entry[NEWER] && entry[OLDER]) {
        // relink the older entry with the newer entry
        entry[OLDER][NEWER] = entry[NEWER];
        entry[NEWER][OLDER] = entry[OLDER];
      } else if (entry[NEWER]) {
        // remove the link to us
        entry[NEWER][OLDER] = undefined;
        // link the newer entry to head
        this.oldest = entry[NEWER];
      } else if (entry[OLDER]) {
        // remove the link to us
        entry[OLDER][NEWER] = undefined;
        // link the newer entry to head
        this.newest = entry[OLDER];
      } else {// if(entry[OLDER] === undefined && entry.newer === undefined) {
        this.oldest = this.newest = undefined;
      }

      this.size--;
      return entry.value;
    };

    LRUMap.prototype.clear = function() {
      // Not clearing links should be safe, as we don't expose live links to user
      this.oldest = this.newest = undefined;
      this.size = 0;
      this._keymap.clear();
    };


    function EntryIterator(oldestEntry) { this.entry = oldestEntry; }
    EntryIterator.prototype[Symbol.iterator] = function() { return this; };
    EntryIterator.prototype.next = function() {
      let ent = this.entry;
      if (ent) {
        this.entry = ent[NEWER];
        return { done: false, value: [ent.key, ent.value] };
      } else {
        return { done: true, value: undefined };
      }
    };


    function KeyIterator(oldestEntry) { this.entry = oldestEntry; }
    KeyIterator.prototype[Symbol.iterator] = function() { return this; };
    KeyIterator.prototype.next = function() {
      let ent = this.entry;
      if (ent) {
        this.entry = ent[NEWER];
        return { done: false, value: ent.key };
      } else {
        return { done: true, value: undefined };
      }
    };

    function ValueIterator(oldestEntry) { this.entry = oldestEntry; }
    ValueIterator.prototype[Symbol.iterator] = function() { return this; };
    ValueIterator.prototype.next = function() {
      let ent = this.entry;
      if (ent) {
        this.entry = ent[NEWER];
        return { done: false, value: ent.value };
      } else {
        return { done: true, value: undefined };
      }
    };


    LRUMap.prototype.keys = function() {
      return new KeyIterator(this.oldest);
    };

    LRUMap.prototype.values = function() {
      return new ValueIterator(this.oldest);
    };

    LRUMap.prototype.entries = function() {
      return this;
    };

    LRUMap.prototype[Symbol.iterator] = function() {
      return new EntryIterator(this.oldest);
    };

    LRUMap.prototype.forEach = function(fun, thisObj) {
      if (typeof thisObj !== 'object') {
        thisObj = this;
      }
      let entry = this.oldest;
      while (entry) {
        fun.call(thisObj, entry.value, entry.key, this);
        entry = entry[NEWER];
      }
    };

    /** Returns a JSON (array) representation */
    LRUMap.prototype.toJSON = function() {
      var s = new Array(this.size), i = 0, entry = this.oldest;
      while (entry) {
        s[i++] = { key: entry.key, value: entry.value };
        entry = entry[NEWER];
      }
      return s;
    };

    /** Returns a String representation */
    LRUMap.prototype.toString = function() {
      var s = '', entry = this.oldest;
      while (entry) {
        s += String(entry.key)+':'+entry.value;
        entry = entry[NEWER];
        if (entry) {
          s += ' < ';
        }
      }
      return s;
    };

    });
    });
    var lru_1 = lru.LRUMap;

    var sha256 = createCommonjsModule(function (module) {
    (function (root, factory) {
        // Hack to make all exports of this module sha256 function object properties.
        var exports = {};
        factory(exports);
        var sha256 = exports["default"];
        for (var k in exports) {
            sha256[k] = exports[k];
        }
            
        {
            module.exports = sha256;
        }
    })(commonjsGlobal, function(exports) {
    exports.__esModule = true;
    // SHA-256 (+ HMAC and PBKDF2) for JavaScript.
    //
    // Written in 2014-2016 by Dmitry Chestnykh.
    // Public domain, no warranty.
    //
    // Functions (accept and return Uint8Arrays):
    //
    //   sha256(message) -> hash
    //   sha256.hmac(key, message) -> mac
    //   sha256.pbkdf2(password, salt, rounds, dkLen) -> dk
    //
    //  Classes:
    //
    //   new sha256.Hash()
    //   new sha256.HMAC(key)
    //
    exports.digestLength = 32;
    exports.blockSize = 64;
    // SHA-256 constants
    var K = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
        0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
        0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
        0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
        0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
        0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
        0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
        0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
        0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    function hashBlocks(w, v, p, pos, len) {
        var a, b, c, d, e, f, g, h, u, i, j, t1, t2;
        while (len >= 64) {
            a = v[0];
            b = v[1];
            c = v[2];
            d = v[3];
            e = v[4];
            f = v[5];
            g = v[6];
            h = v[7];
            for (i = 0; i < 16; i++) {
                j = pos + i * 4;
                w[i] = (((p[j] & 0xff) << 24) | ((p[j + 1] & 0xff) << 16) |
                    ((p[j + 2] & 0xff) << 8) | (p[j + 3] & 0xff));
            }
            for (i = 16; i < 64; i++) {
                u = w[i - 2];
                t1 = (u >>> 17 | u << (32 - 17)) ^ (u >>> 19 | u << (32 - 19)) ^ (u >>> 10);
                u = w[i - 15];
                t2 = (u >>> 7 | u << (32 - 7)) ^ (u >>> 18 | u << (32 - 18)) ^ (u >>> 3);
                w[i] = (t1 + w[i - 7] | 0) + (t2 + w[i - 16] | 0);
            }
            for (i = 0; i < 64; i++) {
                t1 = (((((e >>> 6 | e << (32 - 6)) ^ (e >>> 11 | e << (32 - 11)) ^
                    (e >>> 25 | e << (32 - 25))) + ((e & f) ^ (~e & g))) | 0) +
                    ((h + ((K[i] + w[i]) | 0)) | 0)) | 0;
                t2 = (((a >>> 2 | a << (32 - 2)) ^ (a >>> 13 | a << (32 - 13)) ^
                    (a >>> 22 | a << (32 - 22))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
                h = g;
                g = f;
                f = e;
                e = (d + t1) | 0;
                d = c;
                c = b;
                b = a;
                a = (t1 + t2) | 0;
            }
            v[0] += a;
            v[1] += b;
            v[2] += c;
            v[3] += d;
            v[4] += e;
            v[5] += f;
            v[6] += g;
            v[7] += h;
            pos += 64;
            len -= 64;
        }
        return pos;
    }
    // Hash implements SHA256 hash algorithm.
    var Hash = /** @class */ (function () {
        function Hash() {
            this.digestLength = exports.digestLength;
            this.blockSize = exports.blockSize;
            // Note: Int32Array is used instead of Uint32Array for performance reasons.
            this.state = new Int32Array(8); // hash state
            this.temp = new Int32Array(64); // temporary state
            this.buffer = new Uint8Array(128); // buffer for data to hash
            this.bufferLength = 0; // number of bytes in buffer
            this.bytesHashed = 0; // number of total bytes hashed
            this.finished = false; // indicates whether the hash was finalized
            this.reset();
        }
        // Resets hash state making it possible
        // to re-use this instance to hash other data.
        Hash.prototype.reset = function () {
            this.state[0] = 0x6a09e667;
            this.state[1] = 0xbb67ae85;
            this.state[2] = 0x3c6ef372;
            this.state[3] = 0xa54ff53a;
            this.state[4] = 0x510e527f;
            this.state[5] = 0x9b05688c;
            this.state[6] = 0x1f83d9ab;
            this.state[7] = 0x5be0cd19;
            this.bufferLength = 0;
            this.bytesHashed = 0;
            this.finished = false;
            return this;
        };
        // Cleans internal buffers and re-initializes hash state.
        Hash.prototype.clean = function () {
            for (var i = 0; i < this.buffer.length; i++) {
                this.buffer[i] = 0;
            }
            for (var i = 0; i < this.temp.length; i++) {
                this.temp[i] = 0;
            }
            this.reset();
        };
        // Updates hash state with the given data.
        //
        // Optionally, length of the data can be specified to hash
        // fewer bytes than data.length.
        //
        // Throws error when trying to update already finalized hash:
        // instance must be reset to use it again.
        Hash.prototype.update = function (data, dataLength) {
            if (dataLength === void 0) { dataLength = data.length; }
            if (this.finished) {
                throw new Error("SHA256: can't update because hash was finished.");
            }
            var dataPos = 0;
            this.bytesHashed += dataLength;
            if (this.bufferLength > 0) {
                while (this.bufferLength < 64 && dataLength > 0) {
                    this.buffer[this.bufferLength++] = data[dataPos++];
                    dataLength--;
                }
                if (this.bufferLength === 64) {
                    hashBlocks(this.temp, this.state, this.buffer, 0, 64);
                    this.bufferLength = 0;
                }
            }
            if (dataLength >= 64) {
                dataPos = hashBlocks(this.temp, this.state, data, dataPos, dataLength);
                dataLength %= 64;
            }
            while (dataLength > 0) {
                this.buffer[this.bufferLength++] = data[dataPos++];
                dataLength--;
            }
            return this;
        };
        // Finalizes hash state and puts hash into out.
        //
        // If hash was already finalized, puts the same value.
        Hash.prototype.finish = function (out) {
            if (!this.finished) {
                var bytesHashed = this.bytesHashed;
                var left = this.bufferLength;
                var bitLenHi = (bytesHashed / 0x20000000) | 0;
                var bitLenLo = bytesHashed << 3;
                var padLength = (bytesHashed % 64 < 56) ? 64 : 128;
                this.buffer[left] = 0x80;
                for (var i = left + 1; i < padLength - 8; i++) {
                    this.buffer[i] = 0;
                }
                this.buffer[padLength - 8] = (bitLenHi >>> 24) & 0xff;
                this.buffer[padLength - 7] = (bitLenHi >>> 16) & 0xff;
                this.buffer[padLength - 6] = (bitLenHi >>> 8) & 0xff;
                this.buffer[padLength - 5] = (bitLenHi >>> 0) & 0xff;
                this.buffer[padLength - 4] = (bitLenLo >>> 24) & 0xff;
                this.buffer[padLength - 3] = (bitLenLo >>> 16) & 0xff;
                this.buffer[padLength - 2] = (bitLenLo >>> 8) & 0xff;
                this.buffer[padLength - 1] = (bitLenLo >>> 0) & 0xff;
                hashBlocks(this.temp, this.state, this.buffer, 0, padLength);
                this.finished = true;
            }
            for (var i = 0; i < 8; i++) {
                out[i * 4 + 0] = (this.state[i] >>> 24) & 0xff;
                out[i * 4 + 1] = (this.state[i] >>> 16) & 0xff;
                out[i * 4 + 2] = (this.state[i] >>> 8) & 0xff;
                out[i * 4 + 3] = (this.state[i] >>> 0) & 0xff;
            }
            return this;
        };
        // Returns the final hash digest.
        Hash.prototype.digest = function () {
            var out = new Uint8Array(this.digestLength);
            this.finish(out);
            return out;
        };
        // Internal function for use in HMAC for optimization.
        Hash.prototype._saveState = function (out) {
            for (var i = 0; i < this.state.length; i++) {
                out[i] = this.state[i];
            }
        };
        // Internal function for use in HMAC for optimization.
        Hash.prototype._restoreState = function (from, bytesHashed) {
            for (var i = 0; i < this.state.length; i++) {
                this.state[i] = from[i];
            }
            this.bytesHashed = bytesHashed;
            this.finished = false;
            this.bufferLength = 0;
        };
        return Hash;
    }());
    exports.Hash = Hash;
    // HMAC implements HMAC-SHA256 message authentication algorithm.
    var HMAC = /** @class */ (function () {
        function HMAC(key) {
            this.inner = new Hash();
            this.outer = new Hash();
            this.blockSize = this.inner.blockSize;
            this.digestLength = this.inner.digestLength;
            var pad = new Uint8Array(this.blockSize);
            if (key.length > this.blockSize) {
                (new Hash()).update(key).finish(pad).clean();
            }
            else {
                for (var i = 0; i < key.length; i++) {
                    pad[i] = key[i];
                }
            }
            for (var i = 0; i < pad.length; i++) {
                pad[i] ^= 0x36;
            }
            this.inner.update(pad);
            for (var i = 0; i < pad.length; i++) {
                pad[i] ^= 0x36 ^ 0x5c;
            }
            this.outer.update(pad);
            this.istate = new Uint32Array(8);
            this.ostate = new Uint32Array(8);
            this.inner._saveState(this.istate);
            this.outer._saveState(this.ostate);
            for (var i = 0; i < pad.length; i++) {
                pad[i] = 0;
            }
        }
        // Returns HMAC state to the state initialized with key
        // to make it possible to run HMAC over the other data with the same
        // key without creating a new instance.
        HMAC.prototype.reset = function () {
            this.inner._restoreState(this.istate, this.inner.blockSize);
            this.outer._restoreState(this.ostate, this.outer.blockSize);
            return this;
        };
        // Cleans HMAC state.
        HMAC.prototype.clean = function () {
            for (var i = 0; i < this.istate.length; i++) {
                this.ostate[i] = this.istate[i] = 0;
            }
            this.inner.clean();
            this.outer.clean();
        };
        // Updates state with provided data.
        HMAC.prototype.update = function (data) {
            this.inner.update(data);
            return this;
        };
        // Finalizes HMAC and puts the result in out.
        HMAC.prototype.finish = function (out) {
            if (this.outer.finished) {
                this.outer.finish(out);
            }
            else {
                this.inner.finish(out);
                this.outer.update(out, this.digestLength).finish(out);
            }
            return this;
        };
        // Returns message authentication code.
        HMAC.prototype.digest = function () {
            var out = new Uint8Array(this.digestLength);
            this.finish(out);
            return out;
        };
        return HMAC;
    }());
    exports.HMAC = HMAC;
    // Returns SHA256 hash of data.
    function hash(data) {
        var h = (new Hash()).update(data);
        var digest = h.digest();
        h.clean();
        return digest;
    }
    exports.hash = hash;
    // Function hash is both available as module.hash and as default export.
    exports["default"] = hash;
    // Returns HMAC-SHA256 of data under the key.
    function hmac(key, data) {
        var h = (new HMAC(key)).update(data);
        var digest = h.digest();
        h.clean();
        return digest;
    }
    exports.hmac = hmac;
    // Derives a key from password and salt using PBKDF2-HMAC-SHA256
    // with the given number of iterations.
    //
    // The number of bytes returned is equal to dkLen.
    //
    // (For better security, avoid dkLen greater than hash length - 32 bytes).
    function pbkdf2(password, salt, iterations, dkLen) {
        var prf = new HMAC(password);
        var len = prf.digestLength;
        var ctr = new Uint8Array(4);
        var t = new Uint8Array(len);
        var u = new Uint8Array(len);
        var dk = new Uint8Array(dkLen);
        for (var i = 0; i * len < dkLen; i++) {
            var c = i + 1;
            ctr[0] = (c >>> 24) & 0xff;
            ctr[1] = (c >>> 16) & 0xff;
            ctr[2] = (c >>> 8) & 0xff;
            ctr[3] = (c >>> 0) & 0xff;
            prf.reset();
            prf.update(salt);
            prf.update(ctr);
            prf.finish(u);
            for (var j = 0; j < len; j++) {
                t[j] = u[j];
            }
            for (var j = 2; j <= iterations; j++) {
                prf.reset();
                prf.update(u).finish(u);
                for (var k = 0; k < len; k++) {
                    t[k] ^= u[k];
                }
            }
            for (var j = 0; j < len && i * len + j < dkLen; j++) {
                dk[i * len + j] = t[j];
            }
        }
        for (var i = 0; i < len; i++) {
            t[i] = u[i] = 0;
        }
        for (var i = 0; i < 4; i++) {
            ctr[i] = 0;
        }
        prf.clean();
        return dk;
    }
    exports.pbkdf2 = pbkdf2;
    });
    });

    unwrapExports(sha256);
    var sha256_1 = sha256.hash;

    function ensureElementIsInDocument(element) {
        const document = element.ownerDocument;
        if (document.contains(element)) {
            return element;
        }
        const container = document.createElement('div');
        container.setAttribute(WebRenderer.CONTAINER_ATTRIBUTE, '');
        container.style.position = 'fixed';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.top = '-100000px';
        container.style['contain'] = 'strict';
        container.appendChild(element);
        document.documentElement.appendChild(container);
        // document.body.appendChild(container)
        return element;
    }
    const scratchMat1 = new Matrix4();
    const scratchMat2 = new Matrix4();
    const textDecoder = new TextDecoder();
    const microtask = Promise.resolve();
    class WebLayer {
        constructor(element, eventCallback) {
            this.element = element;
            this.eventCallback = eventCallback;
            this.id = WebLayer._nextID++;
            this.needsRefresh = true;
            this.needsRemoval = false;
            this.svg = new Image();
            this.bounds = new Bounds();
            this._previousBounds = new Bounds();
            this.padding = new Edges();
            this.margin = new Edges();
            this.border = new Edges();
            this.childLayers = [];
            this.cssTransform = new Matrix4();
            this.cachedBounds = new Map();
            this.cachedMargin = new Map();
            this._dynamicAttributes = '';
            this._svgDocument = '';
            this._svgSrc = '';
            this._hashingCanvas = document.createElement('canvas');
            WebRenderer.layers.set(element, this);
            element.setAttribute(WebRenderer.LAYER_ATTRIBUTE, '' + this.id);
            this.parentLayer = WebRenderer.getClosestLayer(this.element.parentElement);
            this.eventCallback('layercreated', { target: element });
            WebLayer.cachedCanvases.limit = WebRenderer.layers.size * WebLayer.DEFAULT_CACHE_SIZE;
        }
        set canvas(val) {
            if (this._canvas !== val) {
                this._canvas = val;
                if (this.eventCallback)
                    this.eventCallback('layerpainted', { target: this.element });
            }
        }
        get canvas() {
            return this._canvas;
        }
        get depth() {
            const parentLayer = this.parentLayer;
            let depth = 0;
            if (parentLayer) {
                let el = this.element;
                while (el !== parentLayer.element) {
                    el = el.parentElement;
                    depth++;
                }
            }
            return depth;
        }
        get rootLayer() {
            let rootLayer = this;
            while (rootLayer.parentLayer)
                rootLayer = rootLayer.parentLayer;
            return rootLayer;
        }
        traverseParentLayers(each, ...params) {
            const parentLayer = this.parentLayer;
            if (parentLayer) {
                parentLayer.traverseParentLayers(each, ...params);
                each(parentLayer, ...params);
            }
        }
        traverseLayers(each, ...params) {
            each(this, ...params);
            this.traverseChildLayers(each, ...params);
        }
        traverseChildLayers(each, ...params) {
            for (const child of this.childLayers) {
                child.traverseLayers(each, ...params);
            }
        }
        static _setNeedsRefresh(layer) {
            layer.needsRefresh = true;
        }
        refresh() {
            const dynamicAttributes = WebRenderer.getDynamicAttributes(this.element);
            getBounds(this.element, this.bounds, this.parentLayer && this.parentLayer.element);
            if (this._dynamicAttributes !== dynamicAttributes ||
                this.bounds.width !== this._previousBounds.width ||
                this.bounds.height !== this._previousBounds.height) {
                this._dynamicAttributes = dynamicAttributes;
                this.traverseLayers(WebLayer._setNeedsRefresh);
            }
            this._previousBounds.copy(this.bounds);
            if (this.needsRefresh) {
                this._refreshParentAndChildLayers();
                WebRenderer.addToSerializeQueue(this);
                this.needsRefresh = false;
            }
            if (WebRenderer.rootLayers.has(this.element)) {
                WebRenderer.scheduleTasks();
            }
        }
        _refreshParentAndChildLayers() {
            const element = this.element;
            const childLayers = this.childLayers;
            const oldChildLayers = childLayers.slice();
            const previousParentLayer = this.parentLayer;
            this.parentLayer = WebRenderer.getClosestLayer(this.element.parentElement);
            if (previousParentLayer !== this.parentLayer) {
                this.parentLayer && this.parentLayer.childLayers.push(this);
                this.eventCallback('parentchanged', { target: element });
            }
            childLayers.length = 0;
            traverseChildElements(element, this._tryConvertElementToWebLayer, this);
            for (const child of oldChildLayers) {
                const parentLayer = WebRenderer.getClosestLayer(child.element.parentElement);
                if (!parentLayer) {
                    child.needsRemoval = true;
                    childLayers.push(child);
                }
            }
        }
        _tryConvertElementToWebLayer(el) {
            const styles = getComputedStyle(el);
            const id = el.getAttribute(WebRenderer.LAYER_ATTRIBUTE);
            if (id !== null || el.nodeName === 'VIDEO' || styles.transform !== 'none') {
                let child = WebRenderer.layers.get(el);
                if (!child) {
                    child = new WebLayer(el, this.eventCallback);
                }
                child.needsRemoval = this.needsRemoval;
                this.childLayers.push(child);
                return false; // stop traversing this subtree
            }
            return true;
        }
        async serialize() {
            if (this.element.nodeName === 'VIDEO')
                return;
            const [svgPageCSS] = await Promise.all([
                WebRenderer.getEmbeddedPageCSS(),
                WebRenderer.embedExternalResources(this.element)
            ]);
            let { width, height } = this.bounds;
            if (width * height > 0) {
                getPadding(this.element, this.padding);
                getMargin(this.element, this.margin);
                getBorder(this.element, this.border);
                // add margins
                width += Math.max(this.margin.left, 0) + Math.max(this.margin.right, 0);
                height += Math.max(this.margin.top, 0) + Math.max(this.margin.bottom, 0);
                // width += Math.max(this.border.left,0) + Math.max(this.border.right,0)
                // height += Math.max(this.border.top,0) + Math.max(this.border.bottom,0)
                // create svg markup
                const layerAttribute = `data-layer="${this.id}"`;
                const layerElement = this.element;
                const needsInlineBlock = getComputedStyle(layerElement).display === 'inline';
                const layerHTML = WebRenderer.serializer
                    .serializeToString(layerElement)
                    .replace(layerAttribute, `data-layer="" ${WebRenderer.RENDERING_ATTRIBUTE}="" ` +
                    `${needsInlineBlock ? 'data-layer-rendering-inline="" ' : ' '} ` +
                    WebRenderer.getDynamicAttributes(layerElement));
                const parentsHTML = this._getParentsHTML(layerElement);
                parentsHTML[0] = parentsHTML[0].replace('html', 'html ' + WebRenderer.RENDERING_DOCUMENT_ATTRIBUTE + '="" ');
                const docString = '<svg width="' +
                    width +
                    '" height="' +
                    height +
                    '" xmlns="http://www.w3.org/2000/svg"><defs><style type="text/css"><![CDATA[a[href]{color:#0000EE;text-decoration:underline;}' +
                    svgPageCSS.join('') +
                    ']]></style></defs><foreignObject x="0" y="0" width="' +
                    width +
                    '" height="' +
                    height +
                    '">' +
                    parentsHTML[0] +
                    layerHTML +
                    parentsHTML[1] +
                    '</foreignObject></svg>';
                this._svgDocument = docString;
                const svgSrc = (this._svgSrc = 'data:image/svg+xml;utf8,' + encodeURIComponent(docString));
                // check for existing canvas
                const canvasHash = WebLayer.canvasHashes.get(svgSrc);
                if (canvasHash && WebLayer.cachedCanvases.has(canvasHash)) {
                    this.canvas = WebLayer.cachedCanvases.get(canvasHash);
                    return;
                }
                // rasterize the svg document if no existing canvas matches
                this.cachedBounds.set(svgSrc, new Bounds().copy(this.bounds));
                this.cachedMargin.set(svgSrc, new Edges().copy(this.margin));
                WebRenderer.addToRasterizeQueue(this);
            }
        }
        async rasterize() {
            return new Promise(resolve => {
                this.svg.onload = () => {
                    WebRenderer.addToRenderQueue(this);
                    resolve();
                };
                this.svg.src = this._svgSrc;
                if (this.svg.complete && this.svg.currentSrc === this.svg.src) {
                    WebRenderer.addToRenderQueue(this);
                    this.svg.onload = undefined;
                    resolve();
                }
            });
        }
        render() {
            const src = this.svg.currentSrc;
            if (!this.svg.complete || !this.cachedBounds.has(src) || !this.cachedMargin.has(src)) {
                this.needsRefresh = true;
                return;
            }
            let { width, height } = this.cachedBounds.get(src);
            let { left, top } = this.cachedMargin.get(src);
            const hashingCanvas = this._hashingCanvas;
            let hw = (hashingCanvas.width = Math.max(width * 0.05, 40));
            let hh = (hashingCanvas.height = Math.max(height * 0.05, 40));
            const hctx = hashingCanvas.getContext('2d');
            hctx.clearRect(0, 0, hw, hh);
            hctx.drawImage(this.svg, left, top, width, height, 0, 0, hw, hh);
            const hashData = hctx.getImageData(0, 0, hw, hh).data;
            const newHash = WebRenderer.arrayBufferToBase64(sha256_1(new Uint8Array(hashData))) +
                '?w=' +
                width +
                ';h=' +
                height;
            WebLayer.canvasHashes.set(src, newHash);
            if (WebLayer.cachedCanvases.has(newHash)) {
                this.canvas = WebLayer.cachedCanvases.get(newHash);
                return;
            }
            const pixelRatio = this.pixelRatio ||
                parseFloat(this.element.getAttribute(WebRenderer.PIXEL_RATIO_ATTRIBUTE)) ||
                window.devicePixelRatio;
            const newCanvas = WebLayer.cachedCanvases.size === WebLayer.cachedCanvases.limit
                ? WebLayer.cachedCanvases.shift()[1]
                : document.createElement('canvas');
            let w = (newCanvas.width = width * pixelRatio);
            let h = (newCanvas.height = height * pixelRatio);
            const ctx = newCanvas.getContext('2d');
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(this.svg, left, top, width, height, 0, 0, w, h);
            WebLayer.cachedCanvases.set(newHash, newCanvas);
            this.canvas = newCanvas;
        }
        // Get all parents of the embeded html as these can effect the resulting styles
        _getParentsHTML(element) {
            const opens = [];
            const closes = [];
            let parent = element.parentElement;
            do {
                let tag = parent.tagName.toLowerCase();
                let attributes = ' ';
                for (const a of parent.attributes) {
                    if (a.name === 'style')
                        continue;
                    if (a.name === 'data-layer') {
                        attributes += 'data-layer="" '; // remove layer id to increase cache hits for similar element heirarchies
                        continue;
                    }
                    attributes += `${a.name}="${a.value}" `;
                }
                const open = '<' +
                    tag +
                    (tag === 'html'
                        ? ` xmlns="http://www.w3.org/1999/xhtml" style="--x-width:${this.bounds.width +
                        0.5}px;--x-height:${this.bounds.height}px;--x-inline-top:${this.border.top +
                        this.margin.top +
                        this.padding.top}px" `
                        : '') +
                    attributes +
                    'data-layer-rendering-parent="" ' +
                    WebRenderer.getDynamicAttributes(parent) +
                    ' >';
                opens.unshift(open);
                const close = '</' + tag + '>';
                closes.push(close);
                if (tag == 'html')
                    break;
            } while ((parent = parent.parentElement));
            return [opens.join(''), closes.join('')];
        }
    }
    WebLayer.DEFAULT_CACHE_SIZE = 4;
    WebLayer.canvasHashes = new lru_1(1000);
    WebLayer.cachedCanvases = new lru_1(WebLayer.DEFAULT_CACHE_SIZE);
    WebLayer._nextID = 0;
    class WebRenderer {
        static _init() {
            if (this._didInit)
                return;
            this._didInit = true;
            // const inputStyles = document.createElement("style")
            // inputStyles.innerHTML = "input, select,textarea{border: 1px solid #000000;margin: 0;background-color: #ffffff;-webkit-appearance: none;}:-webkit-autofill {color: #fff !important;}input[type='checkbox']{width: 20px;height: 20px;display: inline-block;}input[type='radio']{width: 20px;height: 20px;display: inline-block;border-radius: 50%;}input[type='checkbox'][checked],input[type='radio'][checked]{background-color: #555555;}"
            // document.head.insertBefore(inputStyles, document.head.firstChild)
            const style = document.createElement('style');
            document.head.append(style);
            const sheet = style.sheet;
            let i = 0;
            addCSSRule(sheet, `[${WebRenderer.RENDERING_DOCUMENT_ATTRIBUTE}] *`, 'transform: none !important;', i++);
            addCSSRule(sheet, `[${WebRenderer.RENDERING_ATTRIBUTE}], [${WebRenderer.RENDERING_ATTRIBUTE}] *`, 'visibility: visible !important;', i++);
            addCSSRule(sheet, `[${WebRenderer.RENDERING_ATTRIBUTE}] [${WebRenderer.LAYER_ATTRIBUTE}], [${WebRenderer.RENDERING_ATTRIBUTE}] [${WebRenderer.LAYER_ATTRIBUTE}] *`, 'visibility: hidden !important;', i++);
            addCSSRule(sheet, `[${WebRenderer.RENDERING_ATTRIBUTE}]`, 'position: relative; top: 0 !important; left: 0 !important; float: none; box-sizing:border-box; width:var(--x-width); height:var(--x-height);', i++);
            addCSSRule(sheet, `[data-layer-rendering-inline]`, 'top: var(--x-inline-top) !important; width:auto !important', i++);
            addCSSRule(sheet, `[data-layer-rendering-parent]`, 'transform: none !important; left: 0 !important; top: 0 !important; margin: 0 !important; border:0 !important; border-radius:0 !important; height:100% !important; padding:0 !important; position:static !important; text-align:left !important; display:block !important; background: rgba(0,0,0,0) none !important; box-shadow:none !important', i++);
            addCSSRule(sheet, `[data-layer-rendering-parent]::before, [data-layer-rendering-parent]::after`, 'content:none !important; box-shadow:none !important;', i++);
            let previousHash = '';
            const onHashChange = () => {
                if (previousHash != window.location.hash) {
                    if (window.location.hash) {
                        try {
                            this.targetElement = document.querySelector(window.location.hash);
                        }
                        catch { }
                    }
                }
                previousHash = window.location.hash;
            };
            window.addEventListener('hashchange', onHashChange, false);
            onHashChange();
        }
        static addToSerializeQueue(layer) {
            if (this.serializeQueue.indexOf(layer) === -1)
                this.serializeQueue.push(layer);
        }
        static addToRasterizeQueue(layer) {
            if (this.rasterizeQueue.indexOf(layer) === -1)
                this.rasterizeQueue.push(layer);
        }
        static addToRenderQueue(layer) {
            if (this.renderQueue.indexOf(layer) === -1)
                this.renderQueue.push(layer);
        }
        static async scheduleTasks() {
            await microtask;
            const serializeQueue = WebRenderer.serializeQueue;
            const rasterizeQueue = WebRenderer.rasterizeQueue;
            const renderQueue = WebRenderer.renderQueue;
            let startTime = performance.now();
            // while (renderQueue.length && performance.now() - startTime < this.TASK_RENDER_MAX_TIME/2) {
            //     renderQueue.shift()!.render()
            // }
            // startTime = performance.now()
            while (serializeQueue.length && performance.now() - startTime < this.TASK_SERIALIZE_MAX_TIME) {
                serializeQueue.shift().serialize();
            }
            startTime = performance.now();
            while (rasterizeQueue.length &&
                performance.now() - startTime < this.TASK_RASTERIZE_MAX_TIME &&
                this.rasterizeTaskCount < this.TASK_RASTERIZE_MAX_SIMULTANEOUS) {
                this.rasterizeTaskCount++;
                rasterizeQueue
                    .shift()
                    .rasterize()
                    .then(() => {
                    this.rasterizeTaskCount--;
                });
            }
            startTime = performance.now();
            while (renderQueue.length && performance.now() - startTime < this.TASK_RENDER_MAX_TIME / 2) {
                renderQueue.shift().render();
            }
        }
        static setLayerNeedsUpdate(layer) {
            layer.needsRefresh = true;
        }
        static createLayerTree(element, eventCallback) {
            if (WebRenderer.getClosestLayer(element))
                throw new Error('A root WebLayer for the given element already exists');
            WebRenderer._init();
            ensureElementIsInDocument(element);
            const observer = new MutationObserver(WebRenderer.handleMutations);
            this.mutationObservers.set(element, observer);
            this.startMutationObserver(element);
            const resizeObserver = new index(records => {
                for (const record of records) {
                    const layer = this.getClosestLayer(record.target);
                    layer.needsRefresh = true;
                }
            });
            resizeObserver.observe(element);
            this.resizeObservers.set(element, resizeObserver);
            element.addEventListener('input', this._triggerRefresh, { capture: true });
            element.addEventListener('keydown', this._triggerRefresh, { capture: true });
            element.addEventListener('submit', this._triggerRefresh, { capture: true });
            element.addEventListener('change', this._triggerRefresh, { capture: true });
            element.addEventListener('focus', this._triggerRefresh, { capture: true });
            element.addEventListener('blur', this._triggerRefresh, { capture: true });
            element.addEventListener('transitionend', this._triggerRefresh, { capture: true });
            const layer = new WebLayer(element, eventCallback);
            this.rootLayers.set(element, layer);
            return layer;
        }
        static disposeLayer(layer) {
            if (this.rootLayers.has(layer.element)) {
                this.rootLayers.delete(layer.element);
                const observer = this.mutationObservers.get(layer.element);
                observer.disconnect();
                this.mutationObservers.delete(layer.element);
                const resizeObserver = this.resizeObservers.get(layer.element);
                resizeObserver.disconnect();
                this.resizeObservers.delete(layer.element);
                layer.element.removeEventListener('input', this._triggerRefresh, { capture: true });
                layer.element.removeEventListener('change', this._triggerRefresh, { capture: true });
                layer.element.removeEventListener('focus', this._triggerRefresh, { capture: true });
                layer.element.removeEventListener('blur', this._triggerRefresh, { capture: true });
                layer.element.removeEventListener('transitionend', this._triggerRefresh, { capture: true });
            }
        }
        static getClosestLayer(element) {
            const closestLayerElement = element && element.closest(`[${WebRenderer.LAYER_ATTRIBUTE}]`);
            return this.layers.get(closestLayerElement);
        }
        static getCSSTransformForElement(element, out = new Matrix4()) {
            const styles = getComputedStyle(element);
            var transformcss = styles['transform'];
            if (transformcss.indexOf('matrix(') == 0) {
                out.identity();
                var mat = transformcss
                    .substring(7, transformcss.length - 1)
                    .split(', ')
                    .map(parseFloat);
                out.elements[0] = mat[0];
                out.elements[1] = mat[1];
                out.elements[4] = mat[2];
                out.elements[5] = mat[3];
                out.elements[12] = mat[4];
                out.elements[13] = mat[5];
            }
            else if (transformcss.indexOf('matrix3d(') == 0) {
                var mat = transformcss
                    .substring(9, transformcss.length - 1)
                    .split(', ')
                    .map(parseFloat);
                out.fromArray(mat);
            }
            else {
                return out.identity();
            }
            var origincss = styles['transform-origin'];
            origincss = origincss.split(' ').map(parseFloat);
            var ox = origincss[0];
            var oy = origincss[1];
            var oz = origincss[2] || 0;
            var T1 = scratchMat1.identity().makeTranslation(-ox, -oy, -oz);
            var T2 = scratchMat2.identity().makeTranslation(ox, oy, oz);
            return out.premultiply(T2).multiply(T1);
        }
        static async embedExternalResources(element) {
            const promises = [];
            const elements = element.querySelectorAll('*');
            for (const element of elements) {
                const link = element.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                if (link) {
                    promises.push(WebRenderer.getDataURL(link).then(dataURL => {
                        element.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
                        element.setAttribute('href', dataURL);
                    }));
                }
                const imgElement = element;
                if (element.tagName == 'IMG' && imgElement.src.substr(0, 4) != 'data') {
                    promises.push(WebRenderer.getDataURL(imgElement.src).then(dataURL => {
                        element.setAttribute('src', dataURL);
                    }));
                }
                if (element.namespaceURI == 'http://www.w3.org/1999/xhtml' && element.hasAttribute('style')) {
                    const style = element.getAttribute('style');
                    promises.push(WebRenderer.generateEmbeddedCSS(window.location, style).then(css => {
                        if (style != css)
                            element.setAttribute('style', css);
                    }));
                }
            }
            const styles = element.querySelectorAll('style');
            for (const style of styles) {
                promises.push(WebRenderer.generateEmbeddedCSS(window.location, style.innerHTML).then(css => {
                    if (style.innerHTML != css)
                        style.innerHTML = css;
                }));
            }
            return Promise.all(promises);
        }
        static pauseMutationObservers() {
            const mutationObservers = WebRenderer.mutationObservers.values();
            for (const m of mutationObservers) {
                WebRenderer.handleMutations(m.takeRecords());
                m.disconnect();
            }
        }
        static resumeMutationObservers() {
            for (const [e] of WebRenderer.mutationObservers) {
                this.startMutationObserver(e);
            }
        }
        static startMutationObserver(element) {
            const observer = WebRenderer.mutationObservers.get(element);
            observer.observe(element, {
                attributes: true,
                childList: true,
                subtree: true,
                characterData: true,
                characterDataOldValue: true,
                attributeOldValue: true
            });
        }
        static _addDynamicPseudoClassRulesToPage() {
            const sheets = document.styleSheets;
            for (let i = 0; i < sheets.length; i++) {
                try {
                    const sheet = sheets[i];
                    const rules = sheet.cssRules;
                    if (!rules)
                        continue;
                    const newRules = [];
                    for (var j = 0; j < rules.length; j++) {
                        if (rules[j].cssText.indexOf(':hover') > -1) {
                            newRules.push(rules[j].cssText.replace(new RegExp(':hover', 'g'), '[data-layer-hover]'));
                        }
                        if (rules[j].cssText.indexOf(':active') > -1) {
                            newRules.push(rules[j].cssText.replace(new RegExp(':active', 'g'), '[data-layer-active]'));
                        }
                        if (rules[j].cssText.indexOf(':focus') > -1) {
                            newRules.push(rules[j].cssText.replace(new RegExp(':focus', 'g'), '[data-layer-focus]'));
                        }
                        if (rules[j].cssText.indexOf(':target') > -1) {
                            newRules.push(rules[j].cssText.replace(new RegExp(':target', 'g'), '[data-layer-target]'));
                        }
                        var idx = newRules.indexOf(rules[j].cssText);
                        if (idx > -1) {
                            newRules.splice(idx, 1);
                        }
                    }
                    for (var j = 0; j < newRules.length; j++) {
                        sheet.insertRule(newRules[j]);
                    }
                }
                catch (e) { }
            }
        }
        static arrayBufferToBase64(bytes) {
            var binary = '';
            var len = bytes.byteLength;
            for (var i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        }
        static async generateEmbeddedCSS(url, css) {
            let found;
            const promises = [];
            // Add classes for psuedo-classes
            css = css.replace(new RegExp(':hover', 'g'), '[data-layer-hover]');
            css = css.replace(new RegExp(':active', 'g'), '[data-layer-active]');
            css = css.replace(new RegExp(':focus', 'g'), '[data-layer-focus]');
            css = css.replace(new RegExp(':target', 'g'), '[data-layer-target]');
            // Replace all urls in the css
            const regEx = RegExp(/url\((?!['"]?(?:data):)['"]?([^'"\)]*)['"]?\)/gi);
            while ((found = regEx.exec(css))) {
                const resourceURL = found[1];
                promises.push(this.getDataURL(new URL(resourceURL, url)).then(dataURL => {
                    css = css.replace(resourceURL, dataURL);
                }));
            }
            await Promise.all(promises);
            return css;
        }
        static async getURL(url) {
            url = new URL(url, window.location.href).href;
            return new Promise(resolve => {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'arraybuffer';
                xhr.onload = () => {
                    resolve(xhr);
                };
                xhr.onerror = () => {
                    resolve(xhr);
                };
                xhr.send();
            });
        }
        static async getEmbeddedPageCSS() {
            const embedded = this._embeddedPageCSS;
            const styleElements = Array.from(document.querySelectorAll("style, link[type='text/css'], link[rel='stylesheet']"));
            let foundNewStyles = false;
            for (const element of styleElements) {
                if (!embedded.has(element)) {
                    foundNewStyles = true;
                    if (element.tagName == 'STYLE') {
                        const sheet = element.sheet;
                        let cssText = '';
                        for (const rule of sheet.cssRules) {
                            cssText += rule.cssText + '\n';
                        }
                        embedded.set(element, this.generateEmbeddedCSS(window.location, cssText));
                    }
                    else {
                        embedded.set(element, this.getURL(element.getAttribute('href')).then(xhr => {
                            if (!xhr.response)
                                return '';
                            this._addDynamicPseudoClassRulesToPage();
                            var css = textDecoder.decode(xhr.response);
                            return this.generateEmbeddedCSS(window.location, css);
                        }));
                    }
                }
            }
            if (foundNewStyles)
                this._addDynamicPseudoClassRulesToPage();
            return Promise.all(embedded.values());
        }
        // Generate and returns a dataurl for the given url
        static async getDataURL(url) {
            const xhr = await this.getURL(url);
            const arr = new Uint8Array(xhr.response);
            const contentType = xhr.getResponseHeader('Content-Type').split(';')[0];
            if (contentType == 'text/css') {
                let css = textDecoder.decode(arr);
                css = await this.generateEmbeddedCSS(url, css);
                const base64 = window.btoa(css);
                if (base64.length > 0) {
                    return 'data:' + contentType + ';base64,' + base64;
                }
                else {
                    return '';
                }
            }
            else {
                return 'data:' + contentType + ';base64,' + this.arrayBufferToBase64(arr);
            }
        }
        static updateInputAttributes(element) {
            if (element.matches('input'))
                this._updateInputAttribute(element);
            for (const e of element.getElementsByTagName('input'))
                this._updateInputAttribute(e);
        }
        static _updateInputAttribute(inputElement) {
            if (inputElement.hasAttribute('checked')) {
                if (!inputElement.checked)
                    inputElement.removeAttribute('checked');
            }
            else {
                if (inputElement.checked)
                    inputElement.setAttribute('checked', '');
            }
            inputElement.setAttribute('value', inputElement.value);
        }
        static setFocus(ele) {
            ele.dispatchEvent(new FocusEvent('focus'));
            ele.dispatchEvent(new CustomEvent('focusin', {
                bubbles: true,
                cancelable: false
            }));
            this.focusElement = ele;
        }
        static setBlur() {
            if (this.focusElement) {
                this.focusElement.dispatchEvent(new FocusEvent('blur'));
                this.focusElement.dispatchEvent(new CustomEvent('focusout', {
                    bubbles: true,
                    cancelable: false
                }));
                this.focusElement = null;
            }
        }
        static containsHover(element) {
            for (const t of this.hoverTargetElements) {
                if (element.contains(t))
                    return true;
            }
            return false;
        }
        static getDynamicAttributes(element) {
            const layer = this.layers.get(element);
            return (`${this.containsHover(element) ? 'data-layer-hover="" ' : ' '}` +
                `${this.getClosestLayer(this.focusElement) === layer ? 'data-layer-focus="" ' : ' '}` +
                `${this.getClosestLayer(this.activeElement) === layer ? 'data-layer-active="" ' : ' '}` +
                `${this.getClosestLayer(this.targetElement) === layer ? 'data-layer-target="" ' : ' '}`);
        }
    }
    WebRenderer.LAYER_ATTRIBUTE = 'data-layer';
    WebRenderer.CONTAINER_ATTRIBUTE = 'data-layer-container';
    WebRenderer.RENDERING_ATTRIBUTE = 'data-layer-rendering';
    WebRenderer.PIXEL_RATIO_ATTRIBUTE = 'data-layer-pixel-ratio';
    WebRenderer.RENDERING_DOCUMENT_ATTRIBUTE = 'data-layer-rendering-document';
    WebRenderer.serializer = new XMLSerializer();
    WebRenderer.rootLayers = new Map();
    WebRenderer.layers = new Map();
    WebRenderer.mutationObservers = new Map();
    WebRenderer.resizeObservers = new Map();
    WebRenderer.serializeQueue = [];
    WebRenderer.rasterizeQueue = [];
    WebRenderer.renderQueue = [];
    WebRenderer.hoverTargetElements = new Set();
    WebRenderer.focusElement = null; // i.e., element is ready to receive input
    WebRenderer.activeElement = null; // i.e., button element is being "pressed down"
    WebRenderer.targetElement = null; // i.e., the element whose ID matches the url #hash
    WebRenderer._didInit = false;
    WebRenderer.TASK_SERIALIZE_MAX_TIME = 200; // serialization is synchronous
    WebRenderer.TASK_RASTERIZE_MAX_TIME = 200; // processing of data:svg is async
    WebRenderer.TASK_RASTERIZE_MAX_SIMULTANEOUS = 2; // since rasterization is async, limit simultaneous rasterizations
    WebRenderer.TASK_RENDER_MAX_TIME = 300; // rendering to canvas is synchronous
    WebRenderer.rasterizeTaskCount = 0;
    WebRenderer.handleMutations = (records) => {
        for (const record of records) {
            if (record.type === 'attributes') {
                const target = record.target;
                if (target.getAttribute(record.attributeName) === record.oldValue) {
                    continue;
                }
            }
            if (record.type === 'characterData') {
                const target = record.target;
                if (target.data === record.oldValue) {
                    continue;
                }
            }
            const target = record.target.nodeType === Node.ELEMENT_NODE
                ? record.target
                : record.target.parentElement;
            if (!target)
                continue;
            const layer = WebRenderer.getClosestLayer(target);
            if (!layer)
                continue;
            if (record.type === 'attributes' && record.attributeName === 'class') {
                const oldClasses = record.oldValue ? record.oldValue : '';
                const currentClasses = record.target.className;
                if (oldClasses === currentClasses)
                    continue;
            }
            // layer.traverseParentLayers(WebRenderer.setLayerNeedsRasterize) // may be needed to support :focus-within() and future :has() selector support
            layer.parentLayer
                ? layer.parentLayer.traverseChildLayers(WebRenderer.setLayerNeedsUpdate)
                : layer.traverseLayers(WebRenderer.setLayerNeedsUpdate);
        }
    };
    WebRenderer._triggerRefresh = async (e) => {
        await microtask; // allow other handlers to run first
        const layer = WebRenderer.getClosestLayer(e.target);
        WebRenderer.updateInputAttributes(e.target);
        if (layer) {
            // layer.traverseParentLayers(WebRenderer.setLayerNeedsRasterize) // may be needed to support :focus-within() and future :has() selector support
            layer.parentLayer
                ? layer.parentLayer.traverseChildLayers(WebRenderer.setLayerNeedsUpdate)
                : layer.traverseLayers(WebRenderer.setLayerNeedsUpdate);
        }
    };
    WebRenderer._embeddedPageCSS = new Map();

    const scratchVector = new THREE.Vector3();
    const scratchVector2 = new THREE.Vector3();
    const microtask$1 = Promise.resolve();
    const scratchBounds = new Bounds();
    const scratchBounds2 = new Bounds();
    class WebLayer3DBase extends THREE.Object3D {
        constructor(element, options = {}) {
            super();
            this.element = element;
            this.options = options;
            this._webLayer = WebRenderer.getClosestLayer(this.element);
            this.textures = new Map();
            this.content = new THREE.Object3D();
            this.contentMesh = new THREE.Mesh(WebLayer3D.GEOMETRY, new THREE.MeshBasicMaterial({
                transparent: true,
                alphaTest: 0.001,
                opacity: 0
            }));
            this.cursor = new THREE.Object3D();
            this.depthMaterial = new THREE.MeshDepthMaterial({
                depthPacking: THREE.RGBADepthPacking,
                alphaTest: 0.01
            });
            this.target = new THREE.Object3D();
            this.contentTarget = new THREE.Object3D();
            this.contentOpacity = this.transitioner.add(new ethereal.Transitionable({
                target: 0,
                path: 'contentMesh.material.opacity'
            }));
            this.childLayers = [];
            /**
             * Specifies whether or not this layer's layout
             * should match the layout stored in the `target` object
             *
             * When set to `true`, the target layout should always be applied.
             * When set to `false`, the target layout should never be applied.
             * When set to `'auto'`, the target layout should only be applied
             * when the `parentLayer` is the same as the `parent` object.
             *
             * It is the responsibiltiy of the update callback
             * to follow these rules.
             *
             * Defaults to `auto`
             */
            this.shouldApplyTargetLayout = 'auto';
            /**
             * Specifies whether or not the update callback should update
             * the `content` layout to match the layout stored in
             * the `contentTarget` object
             *
             * It is the responsibiltiy of the update callback
             * to follow these rules.
             *
             * Defaults to `true`
             */
            this.shouldApplyContentTargetLayout = true;
            this._lastTargetPosition = new THREE.Vector3();
            this._lastContentTargetScale = new THREE.Vector3(0.01, 0.01, 0.01);
            this.name = element.id;
            this.layout.forceBoundsExclusion = true;
            this.transitioner.duration = 1.2;
            this.transitioner.easing = ethereal.easing.easeInOut;
            // this.transitioner.matrixLocal.scale.start.setScalar(0.0001)
            this.content.transitioner.duration = 1.2;
            this.content.transitioner.easing = ethereal.easing.easeInOut;
            this.content.transitioner.matrixLocal.scale.start.setScalar(0.0001);
            this.add(this.content);
            this.add(this.cursor);
            this.cursor.visible = false;
            this.contentMesh.visible = false;
            this.contentMesh['customDepthMaterial'] = this.depthMaterial;
            WebLayer3D.layersByElement.set(this.element, this);
            WebLayer3D.layersByMesh.set(this.contentMesh, this);
        }
        get currentTexture() {
            if (this._webLayer.element.tagName === 'VIDEO') {
                const video = this._webLayer.element;
                let t = this.textures.get(video);
                if (!t) {
                    t = new THREE.VideoTexture(video);
                    t.wrapS = THREE.ClampToEdgeWrapping;
                    t.wrapT = THREE.ClampToEdgeWrapping;
                    t.minFilter = THREE.LinearFilter;
                    this.textures.set(video, t);
                }
                return t;
            }
            const canvas = this._webLayer.canvas;
            let t = this.textures.get(canvas);
            if (!t) {
                t = new THREE.Texture(canvas);
                t.wrapS = THREE.ClampToEdgeWrapping;
                t.wrapT = THREE.ClampToEdgeWrapping;
                t.minFilter = THREE.LinearFilter;
                this.textures.set(canvas, t);
            }
            return t;
        }
        get needsRefresh() {
            return this._webLayer.needsRefresh;
        }
        set needsRefresh(value) {
            this._webLayer.needsRefresh = value;
        }
        /**
         * Get the hover state
         */
        get hover() {
            return WebRenderer.containsHover(this.element);
        }
        /**
         * Get the layer depth (distance from this layer's element and the parent layer's element)
         */
        get depth() {
            return this._webLayer.depth;
        }
        /**
         *
         */
        get index() {
            return this.parentLayer ? this.parentLayer.childLayers.indexOf(this) : 0;
        }
        /** If true, this layer needs to be removed from the scene */
        get needsRemoval() {
            return this._webLayer.needsRemoval;
        }
        get bounds() {
            return this._webLayer.bounds;
        }
        get parentLayer() {
            return (this._webLayer.parentLayer &&
                WebLayer3D.layersByElement.get(this._webLayer.parentLayer.element));
        }
        refresh(forceRefresh = false) {
            if (forceRefresh)
                this._webLayer.needsRefresh = true;
            this._webLayer.refresh();
            this.childLayers.length = 0;
            for (const c of this._webLayer.childLayers) {
                const child = WebLayer3D.getClosestLayerForElement(c.element);
                this.childLayers.push(child);
                child.refresh(forceRefresh);
            }
            this._refreshVideoBounds();
            this._refreshTargetLayout();
            this._refreshMesh();
            const childMaterial = this.contentMesh.material;
            const isHidden = childMaterial.opacity < 0.005;
            if (isHidden)
                this.contentMesh.visible = false;
            else
                this.contentMesh.visible = true;
            if (this.needsRemoval && isHidden) {
                if (this.parent)
                    this.parent.remove(this);
                this.dispose();
            }
            if (WebLayer3D.shouldApplyTargetLayout(this)) {
                this.position.copy(this.target.position);
                this.quaternion.copy(this.target.quaternion);
                this.scale.copy(this.target.scale);
            }
            if (this.shouldApplyContentTargetLayout) {
                this.content.position.copy(this.contentTarget.position);
                this.content.quaternion.copy(this.contentTarget.quaternion);
                this.content.scale.copy(this.contentTarget.scale);
            }
        }
        querySelector(selector) {
            const element = this.element.querySelector(selector);
            if (element) {
                return WebLayer3D.layersByElement.get(element);
            }
            return undefined;
        }
        traverseParentLayers(each, ...params) {
            const parentLayer = this.parentLayer;
            if (parentLayer) {
                parentLayer.traverseParentLayers(each, ...params);
                each(parentLayer, ...params);
            }
        }
        traverseLayers(each, ...params) {
            each(this, ...params);
            this.traverseChildLayers(each, ...params);
        }
        traverseChildLayers(each, ...params) {
            for (const child of this.childLayers) {
                child.traverseLayers(each, ...params);
            }
            return params;
        }
        dispose() {
            for (const t of this.textures.values()) {
                t.dispose();
            }
            this.contentMesh.geometry.dispose();
            WebRenderer.disposeLayer(this._webLayer);
            for (const child of this.childLayers)
                child.dispose();
        }
        _refreshVideoBounds() {
            if (this.element.nodeName === 'VIDEO') {
                const video = this.element;
                const texture = this.currentTexture;
                const computedStyle = getComputedStyle(this.element);
                const { objectFit } = computedStyle;
                const { width: viewWidth, height: viewHeight } = this.bounds;
                const { videoWidth, videoHeight } = video;
                const videoRatio = videoWidth / videoHeight;
                const viewRatio = viewWidth / viewHeight;
                texture.center.set(0.5, 0.5);
                switch (objectFit) {
                    case 'none':
                        texture.repeat.set(viewWidth / videoWidth, viewHeight / videoHeight).clampScalar(0, 1);
                        break;
                    case 'contain':
                    case 'scale-down':
                        texture.repeat.set(1, 1);
                        if (viewRatio > videoRatio) {
                            const width = this.bounds.height * videoRatio || 0;
                            this.bounds.left += (this.bounds.width - width) / 2;
                            this.bounds.width = width;
                        }
                        else {
                            const height = this.bounds.width / videoRatio || 0;
                            this.bounds.top += (this.bounds.height - height) / 2;
                            this.bounds.height = height;
                        }
                        break;
                    case 'cover':
                        texture.repeat.set(viewWidth / videoWidth, viewHeight / videoHeight);
                        if (viewRatio < videoRatio) {
                            const width = this.bounds.height * videoRatio || 0;
                            this.bounds.left += (this.bounds.width - width) / 2;
                            this.bounds.width = width;
                        }
                        else {
                            const height = this.bounds.width / videoRatio || 0;
                            this.bounds.top += (this.bounds.height - height) / 2;
                            this.bounds.height = height;
                        }
                        break;
                    default:
                    case 'fill':
                        texture.repeat.set(1, 1);
                        break;
                }
            }
        }
        _refreshTargetLayout() {
            this.target.position.copy(this._lastTargetPosition);
            this.target.scale.set(1, 1, 1);
            this.target.quaternion.set(0, 0, 0, 1);
            this.contentTarget.position.set(0, 0, 0);
            this.contentTarget.scale.copy(this._lastContentTargetScale);
            this.contentTarget.quaternion.set(0, 0, 0, 1);
            if (this.needsRemoval) {
                this.contentOpacity.target = 0;
                return;
            }
            const bounds = this.bounds;
            if (bounds.width === 0 || bounds.height === 0 || !this.currentTexture.image) {
                this.contentOpacity.target = 0;
                return;
            }
            this.contentOpacity.target = 1;
            const width = bounds.width;
            const height = bounds.height;
            const parentBounds = this.parentLayer instanceof WebLayer3DBase
                ? this.parentLayer.bounds
                : getViewportBounds(scratchBounds);
            const parentWidth = parentBounds.width;
            const parentHeight = parentBounds.height;
            const leftEdge = -parentWidth / 2 + width / 2;
            const topEdge = parentHeight / 2 - height / 2;
            const pixelSize = 1 / WebLayer3D.DEFAULT_PIXELS_PER_UNIT;
            const sep = this.options.layerSeparation || WebLayer3D.DEFAULT_LAYER_SEPARATION;
            this.target.position.set(pixelSize * (leftEdge + bounds.left), pixelSize * (topEdge - bounds.top), this.depth * sep +
                (this.parentLayer ? this.parentLayer.index * sep * 0.01 : 0) +
                this.index * sep * 0.001);
            this.contentTarget.scale.set(Math.max(pixelSize * width, 10e-6), Math.max(pixelSize * height, 10e-6), 1);
            this._lastTargetPosition.copy(this.target.position);
            this._lastContentTargetScale.copy(this.contentTarget.scale);
        }
        _refreshMesh() {
            const mesh = this.contentMesh;
            const texture = this.currentTexture;
            if (!texture.image)
                return;
            const material = mesh.material;
            if (material.map !== texture) {
                material.map = texture;
                material.needsUpdate = true;
                this.depthMaterial['map'] = texture;
                this.depthMaterial.needsUpdate = true;
            }
            if (!mesh.parent) {
                this.content.add(mesh);
                this._refreshTargetLayout();
                this.content.position.copy(this.contentTarget.position);
                this.content.scale.copy(this.contentTarget.scale);
            }
            mesh.renderOrder = this.depth + this.index * 0.001;
        }
    }
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
     * The texture state can be changed by alternating between the specified classes,
     * without requiring the DOM to be re-rendered. Setting a state on a parent layer does
     * not affect the state of a child layer.
     *
     * Every layer has an implicit `hover` state which can be mixed with any other declared state,
     * by using the appropriate CSS selector: `.near.hover` or `.far.hover`. Besides than the
     * `hover` state. The hover state is controlled by interaction rays, which can be provided
     * with the `interactionRays` property.
     *
     * Default dimensions: 1px = 0.001 world dimensions = 1mm (assuming meters)
     *     e.g., 500px width means 0.5meters
     */
    class WebLayer3D extends WebLayer3DBase {
        constructor(element, options = {}) {
            super(element, options);
            this.element = element;
            this.options = options;
            // private static _setHover = function(layer: WebLayer3DBase) {
            //   layer._hover = WebLayer3D._hoverLayers.has(layer)
            //     ? 1
            //     : layer.parentLayer && layer.parentLayer._hover > 0
            //       ? layer.parentLayer._hover + 1
            //       : layer._hover
            // }
            // private static _setHoverClass = function(element: Element) {
            //   // const hover = WebLayer3D._hoverLayers.has(WebLayer3D.layersByElement.get(element))
            //   // if (hover && !element.classList.contains('hover')) element.classList.add('hover')
            //   // if (!hover && element.classList.contains('hover')) element.classList.remove('hover')
            //   // return true
            //   const hoverLayers = WebRenderer.hoverTargets
            //   let hover = false
            //   for (const layer of hoverLayers) {
            //     if (element.contains(layer.element)) {
            //       hover = true
            //       break
            //     }
            //   }
            //   if (hover && !element.classList.contains('hover')) element.classList.add('hover')
            //   if (!hover && element.classList.contains('hover')) element.classList.remove('hover')
            //   return true
            // }
            this._interactionRays = [];
            this._raycaster = new THREE.Raycaster();
            this._hitIntersections = this._raycaster.intersectObjects([]); // for type inference
            this._webLayer = WebRenderer.createLayerTree(element, (event, { target }) => {
                if (event === 'layercreated') {
                    if (target === this.element)
                        return;
                    const layer = new WebLayer3DBase(target, this.options);
                    layer.parentLayer.add(layer);
                    if (this.options.onLayerCreate)
                        this.options.onLayerCreate(layer);
                }
                else if (event === 'layerpainted') {
                    const layer = WebRenderer.layers.get(target);
                    const canvas = layer.canvas;
                    if (!canvas)
                        throw new Error('missing canvas');
                    const texture = WebLayer3D.layersByElement.get(layer.element).currentTexture;
                    texture.image = canvas;
                    texture.needsUpdate = true;
                }
                else if (event === 'parentchanged') {
                    const layer = WebLayer3D.layersByElement.get(target);
                    layer.transitioner.parentTarget = layer.parentLayer;
                }
            });
            if (this.options.onLayerCreate)
                this.options.onLayerCreate(this);
            this.refresh(true);
            // if (!WebLayer3D._didInstallStyleSheet) {
            //   const style = document.createElement('style')
            //   document.head.append(style)
            //   domUtils.addCSSRule(
            //     style.sheet as CSSStyleSheet,
            //     `[${WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE}] *`,
            //     'transform: none !important;',
            //     0
            //   )
            //   WebLayer3D._didInstallStyleSheet = true
            // }
            // if (this.rootLayer === this) {
            //   this._triggerRefresh = (e: Event) => {
            //     const layer = WebLayer3D.getLayerForElement(e.target as any)!
            //     if (layer) {
            //       layer.needsRasterize = true
            //     }
            //   }
            //   element.addEventListener('input', this._triggerRefresh, { capture: true })
            //   element.addEventListener('change', this._triggerRefresh, { capture: true })
            //   element.addEventListener('focus', this._triggerRefresh, { capture: true })
            //   element.addEventListener('blur', this._triggerRefresh, { capture: true })
            //   element.addEventListener('transitionend', this._triggerRefresh, { capture: true })
            //   let target: HTMLElement | null
            //   const setLayerNeedsRasterize = (layer: WebLayer3D) => {
            //     if (target!.contains(layer.element)) layer.needsRasterize = true
            //   }
            // this._processMutations = (records: MutationRecord[]) => {
            //   for (const record of records) {
            //     if (
            //       record.type === 'attributes' &&
            //       (record.target as HTMLElement).getAttribute(record.attributeName!) === record.oldValue
            //     )
            //       continue
            //     if (
            //       record.type === 'characterData' &&
            //       (record.target as CharacterData).data === record.oldValue
            //     )
            //       continue
            //     target =
            //       record.target.nodeType === Node.ELEMENT_NODE
            //         ? (record.target as HTMLElement)
            //         : record.target.parentElement
            //     if (!target) continue
            //     const layer = WebLayer3D.getLayerForElement(target)
            //     if (!layer) continue
            //     if (record.type === 'attributes' && record.attributeName === 'class') {
            //       const oldClasses = record.oldValue ? record.oldValue.split(/\s+/) : []
            //       const currentClasses = (record.target as HTMLElement).className.split(/\s+/)
            //       const addedClasses = arraySubtract(currentClasses, oldClasses)
            //       const removedClasses = arraySubtract(oldClasses, currentClasses)
            //       let needsRasterize = false
            //       for (const c of removedClasses) {
            //         if (c === 'hover' || layer._states[c]) {
            //           continue
            //         }
            //         needsRasterize = true
            //       }
            //       for (const c of addedClasses) {
            //         if (c === 'hover' || layer._states[c]) {
            //           continue
            //         }
            //         needsRasterize = true
            //       }
            //       if (!needsRasterize) continue
            //     }
            //     layer.needsRasterize = true
            //     layer.traverseLayers(setLayerNeedsRasterize)
            //   }
            // }
            // this._mutationObserver = new MutationObserver(this._processMutations)
            // this._mutationObserver.observe(element, {
            //   characterData: true,
            //   characterDataOldValue: true,
            //   attributes: true,
            //   attributeOldValue: true,
            //   childList: true,
            //   subtree: true
            // })
            // stuff for rendering with html2canvas ¯\_(ツ)_/¯
            // this._logger = new Logger(false)
            // this._fontMetrics = new FontMetrics(document)
            // this._resourceLoader = new ResourceLoader(
            //   {
            //     imageTimeout: 15000,
            //     allowTaint: options.allowTaint || false
            //   },
            //   this._logger,
            //   window
            // )
            // }
            // technically this should only be needed in the root layer,
            // however the polyfill seems to miss resizes that happen in child
            // elements unless observing each layer
            // this._resizeObserver = new ResizeObserver(records => {
            //   for (const record of records) {
            //     const layer = this.getLayerForElement(record.target)!
            //     layer.needsRasterize = true
            //   }
            // })
            // this._resizeObserver.observe(element)
        }
        static computeNaturalDistance(projection, renderer) {
            let projectionMatrix = projection;
            if (projection.isCamera) {
                projectionMatrix = projection.projectionMatrix;
            }
            const pixelRatio = renderer.getPixelRatio();
            const widthPixels = renderer.domElement.width / pixelRatio;
            const width = WebLayer3D.DEFAULT_PIXELS_PER_UNIT * widthPixels;
            const horizontalFOV = getFovs(projectionMatrix).horizontal;
            const naturalDistance = width / 2 / Math.tan(horizontalFOV / 2);
            return naturalDistance;
        }
        static shouldApplyTargetLayout(layer) {
            const should = layer.shouldApplyTargetLayout;
            if (should === 'always' || should === true)
                return true;
            if (should === 'never' || should === false)
                return false;
            if (should === 'auto' && layer.parentLayer && layer.parent === layer.parentLayer)
                return true;
            return false;
        }
        // static hoverTargets = new Set<Element>()
        static _updateInteractions(rootLayer) {
            rootLayer.updateWorldMatrix(true, true);
            rootLayer.traverseLayers(WebLayer3D._hideCursor);
            WebRenderer.hoverTargetElements.clear();
            for (const ray of rootLayer._interactionRays) {
                rootLayer._hitIntersections.length = 0;
                if (ray instanceof THREE.Ray)
                    rootLayer._raycaster.ray.copy(ray);
                else
                    rootLayer._raycaster.ray.set(ray.getWorldPosition(scratchVector), ray.getWorldDirection(scratchVector2));
                rootLayer._raycaster.intersectObject(rootLayer, true, rootLayer._hitIntersections);
                for (const intersection of rootLayer._hitIntersections) {
                    let layer = WebLayer3D.layersByMesh.get(intersection.object);
                    if (layer && layer.contentOpacity.current !== 0) {
                        layer.cursor.position.copy(intersection.point);
                        layer.worldToLocal(layer.cursor.position);
                        layer.cursor.visible = true;
                        while (layer instanceof WebLayer3DBase) {
                            WebRenderer.hoverTargetElements.add(layer.element);
                            layer = layer.parent;
                        }
                        break;
                    }
                }
            }
            // rootLayer.traverseLayers(WebLayer3D._setHover)
            // WebLayer3D._setHoverClass(rootLayer.element)
            // domUtils.traverseChildElements(rootLayer.element, WebLayer3D._setHoverClass)
        }
        static async _scheduleRefresh(rootLayer) {
            await microtask$1;
            rootLayer.refresh();
        }
        /**
         * A list of Rays to be used for interaction.
         * Can only be set on a root WebLayer3D instance.
         * @param rays
         */
        set interactionRays(rays) {
            this._interactionRays = rays;
        }
        get interactionRays() {
            return this._interactionRays;
        }
        // refresh(forceRasterize=false) {
        //   if (WebLayer3D.DEBUG_PERFORMANCE) performance.mark('refresh start')
        //   super.refresh(forceRasterize)
        //   // WebLayer3D._scheduleRefresh(this)
        //   if (WebLayer3D.DEBUG_PERFORMANCE) performance.mark('refresh end')
        //   if (WebLayer3D.DEBUG_PERFORMANCE) performance.measure('refresh', 'refresh start', 'refresh end')
        // }
        /**
         * Update the pose and opacity of this layer (does not rerender the DOM).
         * This should be called each frame, and can only be called on a root WebLayer3D instance.
         *
         * @param lerp lerp value
         * @param updateCallback update callback called for each layer. Default is WebLayer3D.UDPATE_DEFAULT
         */
        update(lerp = 1, updateCallback = WebLayer3D.UPDATE_DEFAULT) {
            if (this.options.autoRefresh !== false)
                WebLayer3D._scheduleRefresh(this);
            this.updateWorldMatrix(true, true);
            this.traverseLayers(updateCallback, lerp);
            WebLayer3D._updateInteractions(this);
        }
        static getLayerForQuery(selector) {
            const element = document.querySelector(selector);
            return WebLayer3D.layersByElement.get(element);
        }
        static getClosestLayerForElement(element) {
            const closestLayerElement = element && element.closest(`[${WebLayer3D.LAYER_ATTRIBUTE}]`);
            return WebLayer3D.layersByElement.get(closestLayerElement);
        }
        hitTest(ray) {
            const raycaster = this._raycaster;
            const intersections = this._hitIntersections;
            const meshMap = WebLayer3D.layersByMesh;
            raycaster.ray.copy(ray);
            intersections.length = 0;
            raycaster.intersectObject(this, true, intersections);
            for (const intersection of intersections) {
                const layer = meshMap.get(intersection.object);
                if (!layer)
                    continue;
                const layerBoundingRect = getBounds(layer.element, scratchBounds);
                if (!layerBoundingRect.width || !layerBoundingRect.height)
                    continue;
                let target = layer.element;
                const clientX = intersection.uv.x * layerBoundingRect.width;
                const clientY = (1 - intersection.uv.y) * layerBoundingRect.height;
                traverseChildElements(layer.element, el => {
                    if (!target.contains(el))
                        return false;
                    const elementBoundingRect = getBounds(el, scratchBounds2);
                    const offsetLeft = elementBoundingRect.left - layerBoundingRect.left;
                    const offsetTop = elementBoundingRect.top - layerBoundingRect.top;
                    const { width, height } = elementBoundingRect;
                    const offsetRight = offsetLeft + width;
                    const offsetBottom = offsetTop + height;
                    if (clientX > offsetLeft &&
                        clientX < offsetRight &&
                        clientY > offsetTop &&
                        clientY < offsetBottom) {
                        target = el;
                        return true;
                    }
                    return false; // stop traversal down this path
                });
                return { layer, intersection, target };
            }
            return undefined;
        }
    }
    WebLayer3D.domUtils = domUtils;
    WebLayer3D.layersByElement = new WeakMap();
    WebLayer3D.layersByMesh = new WeakMap();
    WebLayer3D.DEBUG_PERFORMANCE = false;
    WebLayer3D.LAYER_ATTRIBUTE = 'data-layer';
    WebLayer3D.PIXEL_RATIO_ATTRIBUTE = 'data-layer-pixel-ratio';
    WebLayer3D.STATES_ATTRIBUTE = 'data-layer-states';
    WebLayer3D.HOVER_DEPTH_ATTRIBUTE = 'data-layer-hover-depth';
    WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE = 'data-layer-disable-transforms';
    WebLayer3D.DEFAULT_LAYER_SEPARATION = 0.001;
    WebLayer3D.DEFAULT_PIXELS_PER_UNIT = 1000;
    WebLayer3D.GEOMETRY = new THREE.PlaneGeometry(1, 1, 2, 2);
    WebLayer3D.UPDATE_DEFAULT = function (layer, deltaTime = 1) {
        layer.transitioner.active = true;
        layer.content.transitioner.active = true;
        layer.transitioner.update(deltaTime, false);
        layer.content.transitioner.update(deltaTime, false);
    };
    // private static refreshBoundsQueue = [] as WebLayer3DBase[]
    // private static async _scheduleRefreshBounds(rootLayer: WebLayer3D) {
    //   rootLayer.traverseLayers((layer) => {
    //     if (this.refreshBoundsQueue.indexOf(layer) === -1) this.refreshBoundsQueue.push(layer)
    //   })
    //   await microtask // wait for current frame to complete
    //   const queue = this.refreshBoundsQueue
    //   if (queue.length === 0 || rootLayer.options.autoRasterize === false) return
    //   if (window.requestIdleCallback) {
    //     window.requestIdleCallback(idleDeadline => {
    //       if (!queue.length) return
    //       if (WebLayer3D.DEBUG_PERFORMANCE) performance.mark('rasterize queue start')
    //       while (queue.length && idleDeadline.timeRemaining() > 0) {
    //         if (WebLayer3D.DEBUG_PERFORMANCE) performance.mark('rasterize start')
    //         queue.shift()!.rasterize()
    //         if (WebLayer3D.DEBUG_PERFORMANCE) performance.mark('rasterize end')
    //         if (WebLayer3D.DEBUG_PERFORMANCE)
    //           performance.measure('rasterize', 'rasterize start', 'rasterize end')
    //       }
    //       if (WebLayer3D.DEBUG_PERFORMANCE) performance.mark('rasterize queue end')
    //       if (WebLayer3D.DEBUG_PERFORMANCE)
    //         performance.measure('rasterize queue', 'rasterize queue start', 'rasterize queue end')
    //     })
    //   } else {
    //     const startTime = performance.now()
    //     if (WebLayer3D.DEBUG_PERFORMANCE) performance.mark('rasterize queue start')
    //     while (queue.length && performance.now() - startTime < 5) {
    //       if (WebLayer3D.DEBUG_PERFORMANCE) performance.mark('rasterize start')
    //       queue.shift()!.rasterize()
    //       if (WebLayer3D.DEBUG_PERFORMANCE) performance.mark('rasterize end')
    //       if (WebLayer3D.DEBUG_PERFORMANCE)
    //         performance.measure('rasterize', 'rasterize start', 'rasterize end')
    //     }
    //     if (WebLayer3D.DEBUG_PERFORMANCE) performance.mark('rasterize queue end')
    //     if (WebLayer3D.DEBUG_PERFORMANCE)
    //       performance.measure('rasterize queue', 'rasterize queue start', 'rasterize queue end')
    //   }
    // }
    WebLayer3D._hideCursor = function (layer) {
        layer.cursor.visible = false;
    };
    class CameraFOVs {
        constructor() {
            this.top = 0;
            this.left = 0;
            this.bottom = 0;
            this.right = 0;
            this.horizontal = 0;
            this.vertical = 0;
        }
    }
    const _fovs = new CameraFOVs();
    const _getFovsMatrix = new THREE.Matrix4();
    const _getFovsVector = new THREE.Vector3();
    const FORWARD = new THREE.Vector3(0, 0, -1);
    function getFovs(projectionMatrix) {
        const out = _fovs;
        const invProjection = _getFovsMatrix.getInverse(projectionMatrix, true);
        const vec = _getFovsVector;
        out.left = vec
            .set(-1, 0, -1)
            .applyMatrix4(invProjection)
            .angleTo(FORWARD);
        out.right = vec
            .set(1, 0, -1)
            .applyMatrix4(invProjection)
            .angleTo(FORWARD);
        out.top = vec
            .set(0, 1, -1)
            .applyMatrix4(invProjection)
            .angleTo(FORWARD);
        out.bottom = vec
            .set(0, -1, -1)
            .applyMatrix4(invProjection)
            .angleTo(FORWARD);
        out.horizontal = out.right + out.left;
        out.vertical = out.top + out.bottom;
        return out;
    }

    exports.WebLayer3D = WebLayer3D;
    exports.WebLayer3DBase = WebLayer3DBase;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=three-web-layer.umd.js.map
