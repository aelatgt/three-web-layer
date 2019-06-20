"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const THREE = require("three");
const resize_observer_polyfill_1 = require("resize-observer-polyfill");
const NodeParser_1 = require("@speigg/html2canvas/dist/npm/NodeParser");
const Logger_1 = require("@speigg/html2canvas/dist/npm/Logger");
const CanvasRenderer_1 = require("@speigg/html2canvas/dist/npm/renderer/CanvasRenderer");
const Renderer_1 = require("@speigg/html2canvas/dist/npm/Renderer");
const ResourceLoader_1 = require("@speigg/html2canvas/dist/npm/ResourceLoader");
const Font_1 = require("@speigg/html2canvas/dist/npm/Font");
const domUtils = require("./dom-utils");
const scratchVector = new THREE.Vector3();
const scratchVector2 = new THREE.Vector3();
const microtask = Promise.resolve();
const scratchBounds = { top: 0, left: 0, width: 0, height: 0 };
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
class WebLayer3D extends THREE.Object3D {
    constructor(element, options = {}, parentLayer = null, _level = 0) {
        super();
        this.options = options;
        this.parentLayer = parentLayer;
        this._level = _level;
        this.content = new THREE.Object3D();
        this.mesh = new THREE.Mesh(WebLayer3D.GEOMETRY, new THREE.MeshBasicMaterial({
            transparent: true,
            alphaTest: 0.001,
            opacity: 0
        }));
        this.depthMaterial = new THREE.MeshDepthMaterial({
            depthPacking: THREE.RGBADepthPacking,
            alphaTest: 0.01
        });
        this.childLayers = [];
        this.target = new THREE.Object3D();
        this.contentTarget = new THREE.Object3D();
        this.contentTargetOpacity = 0;
        this.cursor = new THREE.Object3D();
        this.needsRasterize = true;
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
        this._lastContentTargetScale = new THREE.Vector3(0.1, 0.1, 0.1);
        this._hover = 0;
        this._hoverDepth = 0;
        this._states = {};
        this._pixelRatio = 1;
        this._state = '';
        this._needsRemoval = false;
        // the following properties are meant to be accessed on the root layer
        this._rasterizationQueue = [];
        this._meshMap = new WeakMap();
        this._interactionRays = [];
        this._raycaster = new THREE.Raycaster();
        this._hitIntersections = this._raycaster.intersectObjects([]); // for type inference
        this._layersByElement = new WeakMap();
        this._normalizedBounds = { left: 0, top: 0, width: 0, height: 0 };
        this.element = element;
        this.element.setAttribute(WebLayer3D.LAYER_ATTRIBUTE, this.id.toString());
        this.rootLayer = this.parentLayer ? this.parentLayer.rootLayer : this;
        this.name = element.id;
        this.layersByElement.set(element, this);
        if (!document.contains(element) && this.rootLayer === this) {
            ensureElementIsInDocument(element, options);
        }
        if (!WebLayer3D._didInstallStyleSheet) {
            const style = document.createElement('style');
            document.head.append(style);
            domUtils.addCSSRule(style.sheet, `[${WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE}] *`, 'transform: none !important;', 0);
            WebLayer3D._didInstallStyleSheet = true;
        }
        this.add(this.content);
        this.add(this.cursor);
        this.cursor.visible = false;
        this.mesh.visible = false;
        this.mesh['customDepthMaterial'] = this.depthMaterial;
        this.rootLayer._meshMap.set(this.mesh, this);
        if (this.rootLayer === this) {
            this._triggerRefresh = (e) => {
                const layer = this.getLayerForElement(e.target);
                if (layer) {
                    layer.needsRasterize = true;
                }
            };
            element.addEventListener('input', this._triggerRefresh, { capture: true });
            element.addEventListener('change', this._triggerRefresh, { capture: true });
            element.addEventListener('focus', this._triggerRefresh, { capture: true });
            element.addEventListener('blur', this._triggerRefresh, { capture: true });
            element.addEventListener('transitionend', this._triggerRefresh, { capture: true });
            let target;
            const setLayerNeedsRasterize = (layer) => {
                if (target.contains(layer.element))
                    layer.needsRasterize = true;
            };
            this._processMutations = (records) => {
                for (const record of records) {
                    if (record.type === 'attributes' &&
                        record.target.getAttribute(record.attributeName) === record.oldValue)
                        continue;
                    if (record.type === 'characterData' &&
                        record.target.data === record.oldValue)
                        continue;
                    target =
                        record.target.nodeType === Node.ELEMENT_NODE
                            ? record.target
                            : record.target.parentElement;
                    if (!target)
                        continue;
                    const layer = this.getLayerForElement(target);
                    if (!layer)
                        continue;
                    if (record.type === 'attributes' && record.attributeName === 'class') {
                        const oldClasses = record.oldValue ? record.oldValue.split(/\s+/) : [];
                        const currentClasses = record.target.className.split(/\s+/);
                        const addedClasses = arraySubtract(currentClasses, oldClasses);
                        const removedClasses = arraySubtract(oldClasses, currentClasses);
                        let needsRasterize = false;
                        for (const c of removedClasses) {
                            if (c === 'hover' || layer._states[c]) {
                                continue;
                            }
                            needsRasterize = true;
                        }
                        for (const c of addedClasses) {
                            if (c === 'hover' || layer._states[c]) {
                                continue;
                            }
                            needsRasterize = true;
                        }
                        if (!needsRasterize)
                            continue;
                    }
                    layer.needsRasterize = true;
                    layer.traverseLayers(setLayerNeedsRasterize);
                }
            };
            this._mutationObserver = new MutationObserver(this._processMutations);
            this._mutationObserver.observe(element, {
                characterData: true,
                characterDataOldValue: true,
                attributes: true,
                attributeOldValue: true,
                childList: true,
                subtree: true
            });
            // stuff for rendering with html2canvas ¯\_(ツ)_/¯
            this._logger = new Logger_1.default(false);
            this._fontMetrics = new Font_1.FontMetrics(document);
            this._resourceLoader = new ResourceLoader_1.default({
                imageTimeout: 15000,
                allowTaint: options.allowTaint || false
            }, this._logger, window);
        }
        // technically this should only be needed in the root layer,
        // however the polyfill seems to miss resizes that happen in child
        // elements unless observing each layer
        this._resizeObserver = new resize_observer_polyfill_1.default(records => {
            for (const record of records) {
                const layer = this.getLayerForElement(record.target);
                layer.needsRasterize = true;
            }
        });
        this._resizeObserver.observe(element);
        if (this.options.onLayerCreate)
            this.options.onLayerCreate(this);
        this.refresh();
    }
    static computeNaturalDistance(projection, renderer) {
        let projectionMatrix = projection;
        if (projection.isCamera) {
            projectionMatrix = projection.projectionMatrix;
        }
        const pixelRatio = renderer.getPixelRatio();
        const widthPixels = renderer.domElement.width / pixelRatio;
        const width = WebLayer3D.PIXEL_SIZE * widthPixels;
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
        if (should === 'auto' && layer.parent === layer.parentLayer)
            return true;
        return false;
    }
    static updateLayout(layer, lerp) {
        if (WebLayer3D.shouldApplyTargetLayout(layer)) {
            layer.position.lerp(layer.target.position, lerp);
            layer.scale.lerp(layer.target.scale, lerp);
            layer.quaternion.slerp(layer.target.quaternion, lerp);
        }
        if (layer.shouldApplyContentTargetLayout) {
            layer.content.position.lerp(layer.contentTarget.position, lerp);
            layer.content.scale.lerp(layer.contentTarget.scale, lerp);
            layer.content.quaternion.slerp(layer.contentTarget.quaternion, lerp);
        }
    }
    static updateVisibility(layer, lerp) {
        const material = layer.mesh.material;
        if ('opacity' in material) {
            const targetOpacity = layer.contentTargetOpacity;
            material.opacity = Math.min(THREE.Math.lerp(material.opacity, targetOpacity, lerp), 1);
            material.needsUpdate = true;
        }
    }
    static _updateInteractions(rootLayer) {
        rootLayer.updateWorldMatrix(true, true);
        rootLayer.traverseLayers(WebLayer3D._clearHover);
        WebLayer3D._hoverLayers.clear();
        for (const ray of rootLayer._interactionRays) {
            rootLayer._hitIntersections.length = 0;
            if (ray instanceof THREE.Ray)
                rootLayer._raycaster.ray.copy(ray);
            else
                rootLayer._raycaster.ray.set(ray.getWorldPosition(scratchVector), ray.getWorldDirection(scratchVector2));
            rootLayer._raycaster.intersectObject(rootLayer, true, rootLayer._hitIntersections);
            for (const intersection of rootLayer._hitIntersections) {
                let layer = rootLayer._meshMap.get(intersection.object);
                if (layer && layer.contentTargetOpacity !== 0) {
                    layer.cursor.position.copy(intersection.point);
                    layer.worldToLocal(layer.cursor.position);
                    layer.cursor.visible = true;
                    while (layer instanceof WebLayer3D) {
                        WebLayer3D._hoverLayers.add(layer);
                        layer = layer.parent;
                    }
                    break;
                }
            }
        }
        rootLayer.traverseLayers(WebLayer3D._setHover);
        domUtils.traverseDOM(rootLayer.element, WebLayer3D._setHoverClass);
    }
    static async _scheduleRefresh(rootLayer) {
        await microtask; // wait for render to complete
        rootLayer.refresh();
    }
    static async _scheduleRasterizations(rootLayer) {
        await microtask; // wait for render to complete
        const queue = rootLayer._rasterizationQueue;
        if (queue.length === 0)
            return;
        if (window.requestIdleCallback) {
            window.requestIdleCallback(idleDeadline => {
                if (!queue.length)
                    return;
                if (WebLayer3D.DEBUG_PERFORMANCE)
                    performance.mark('rasterize queue start');
                while (queue.length && idleDeadline.timeRemaining() > 0) {
                    if (WebLayer3D.DEBUG_PERFORMANCE)
                        performance.mark('rasterize start');
                    queue.shift()._rasterize();
                    if (WebLayer3D.DEBUG_PERFORMANCE)
                        performance.mark('rasterize end');
                    if (WebLayer3D.DEBUG_PERFORMANCE)
                        performance.measure('rasterize', 'rasterize start', 'rasterize end');
                }
                if (WebLayer3D.DEBUG_PERFORMANCE)
                    performance.mark('rasterize queue end');
                if (WebLayer3D.DEBUG_PERFORMANCE)
                    performance.measure('rasterize queue', 'rasterize queue start', 'rasterize queue end');
            });
        }
        else {
            const startTime = performance.now();
            if (WebLayer3D.DEBUG_PERFORMANCE)
                performance.mark('rasterize queue start');
            while (queue.length && performance.now() - startTime < 5) {
                if (WebLayer3D.DEBUG_PERFORMANCE)
                    performance.mark('rasterize start');
                queue.shift()._rasterize();
                if (WebLayer3D.DEBUG_PERFORMANCE)
                    performance.mark('rasterize end');
                if (WebLayer3D.DEBUG_PERFORMANCE)
                    performance.measure('rasterize', 'rasterize start', 'rasterize end');
            }
            if (WebLayer3D.DEBUG_PERFORMANCE)
                performance.mark('rasterize queue end');
            if (WebLayer3D.DEBUG_PERFORMANCE)
                performance.measure('rasterize queue', 'rasterize queue start', 'rasterize queue end');
        }
    }
    /**
     * Get the texture state.
     * Note: if a state is not available, the `default` state will be rendered.
     */
    get state() {
        return this._state;
    }
    get texture() {
        const state = this._states[this.state] || this._states[''];
        return (state[this.hover] || state[0]).texture;
    }
    get bounds() {
        const state = this._states[this.state] || this._states[''];
        return (state[this.hover] || state[0]).bounds;
    }
    get layersByElement() {
        return this.rootLayer._layersByElement;
    }
    get normalizedBounds() {
        const viewportBounds = domUtils.getViewportBounds(this._normalizedBounds);
        const viewportWidth = viewportBounds.width;
        const viewportHeight = viewportBounds.height;
        const bounds = this.bounds;
        const normalizedBounds = this._normalizedBounds;
        normalizedBounds.left = bounds.left / viewportWidth;
        normalizedBounds.top = bounds.top / viewportHeight;
        normalizedBounds.width = bounds.width / viewportWidth;
        normalizedBounds.height = bounds.height / viewportHeight;
        return normalizedBounds;
    }
    /**
     * A list of Rays to be used for interaction.
     * Can only be set on a root WebLayer3D instance.
     * @param rays
     */
    set interactionRays(rays) {
        this._checkRoot();
        this._interactionRays = rays;
    }
    get interactionRays() {
        return this._interactionRays;
    }
    /**
     * Get the hover state
     */
    get hover() {
        return this._hover;
    }
    /**
     * Get the layer level
     */
    get level() {
        return this._level;
    }
    /** If true, this layer needs to be removed from the scene */
    get needsRemoval() {
        return this._needsRemoval;
    }
    /**
     * Update the pose and opacity of this layer (does not rerender the DOM).
     * This should be called each frame, and can only be called on a root WebLayer3D instance.
     *
     * @param lerp lerp value
     * @param updateCallback update callback called for each layer. Default is WebLayer3D.UDPATE_DEFAULT
     */
    update(lerp = 1, updateCallback = WebLayer3D.UPDATE_DEFAULT) {
        if (WebLayer3D.DEBUG_PERFORMANCE)
            performance.mark('update start');
        lerp = Math.min(lerp, 1);
        this._checkRoot();
        WebLayer3D._updateInteractions(this);
        this.traverseLayers(updateCallback, lerp);
        WebLayer3D._scheduleRefresh(this);
        WebLayer3D._scheduleRasterizations(this);
        if (WebLayer3D.DEBUG_PERFORMANCE)
            performance.mark('update end');
        if (WebLayer3D.DEBUG_PERFORMANCE)
            performance.measure('update', 'update start', 'update end');
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
    getLayerForQuery(selector) {
        const element = this.element.querySelector(selector);
        if (element) {
            return this.getLayerForElement(element);
        }
        return undefined;
    }
    getLayerForElement(element) {
        const closestLayerElement = element.closest(`[${WebLayer3D.LAYER_ATTRIBUTE}]`);
        return this.layersByElement.get(closestLayerElement);
    }
    hitTest(ray) {
        const raycaster = this.rootLayer._raycaster;
        const intersections = this.rootLayer._hitIntersections;
        const meshMap = this.rootLayer._meshMap;
        raycaster.ray.copy(ray);
        intersections.length = 0;
        raycaster.intersectObject(this, true, intersections);
        for (const intersection of intersections) {
            const layer = meshMap.get(intersection.object);
            if (!layer)
                continue;
            const layerBoundingRect = layer.bounds;
            if (!layerBoundingRect.width || !layerBoundingRect.height)
                continue;
            let target = layer.element;
            const clientX = intersection.uv.x * layerBoundingRect.width;
            const clientY = (1 - intersection.uv.y) * layerBoundingRect.height;
            domUtils.traverseDOM(layer.element, el => {
                if (!target.contains(el))
                    return false;
                const elementBoundingRect = domUtils.getBounds(el, scratchBounds);
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
    refresh(forceRasterize = false) {
        this._refreshState();
        this._refreshBounds();
        if (this.needsRasterize || forceRasterize) {
            this.needsRasterize = false;
            if (this.rootLayer._rasterizationQueue.indexOf(this) === -1) {
                this.rootLayer._rasterizationQueue.push(this);
            }
            this._refreshChildLayers();
        }
        for (const child of this.childLayers) {
            child.refresh(forceRasterize);
        }
        this._refreshTargetLayout();
        this._refreshMesh();
        const childMaterial = this.mesh.material;
        const isHidden = childMaterial.opacity < 0.005;
        if (isHidden)
            this.mesh.visible = false;
        else
            this.mesh.visible = true;
        if (this.needsRemoval && isHidden) {
            if (this.parent)
                this.parent.remove(this);
            this.dispose();
        }
    }
    dispose() {
        if (this._mutationObserver)
            this._mutationObserver.disconnect();
        if (this._resizeObserver)
            this._resizeObserver.disconnect();
        for (const child of this.childLayers)
            child.dispose();
    }
    _refreshState() {
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
        this._hoverDepth = parseInt(element.getAttribute(WebLayer3D.HOVER_DEPTH_ATTRIBUTE) || '0');
        const states = (element.getAttribute(WebLayer3D.STATES_ATTRIBUTE) || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        states.push('');
        // set the current state from classlist
        const classes = element.classList;
        let state = '';
        for (const c of classes) {
            if (states.indexOf(c) > -1) {
                state = c;
                break;
            }
        }
        this._state = state;
        // cleanup unused textures
        for (const stateKey in this._states) {
            if (states.indexOf(stateKey) === -1) {
                const hoverStates = this._states[stateKey];
                for (const hoverState of hoverStates) {
                    hoverState.texture.dispose();
                }
                delete this._states[stateKey];
            }
        }
        for (const stateKey of states) {
            if (this._states[stateKey] === undefined) {
                const hoverStates = (this._states[stateKey] = []);
                for (let i = 0; i <= this._hoverDepth; i++) {
                    hoverStates[i] = hoverStates[i] || {
                        texture: null,
                        bounds: { left: 0, top: 0, width: 0, height: 0 }
                    };
                }
            }
        }
    }
    _checkRoot() {
        if (this.rootLayer !== this)
            throw new Error('Only call `update` on a root WebLayer3D instance');
    }
    _refreshBounds() {
        domUtils.getBounds(this.element, this.bounds);
    }
    _refreshTargetLayout() {
        this.target.position.copy(this._lastTargetPosition);
        this.target.scale.set(1, 1, 1);
        this.target.quaternion.set(0, 0, 0, 1);
        this.contentTarget.position.set(0, 0, 0);
        this.contentTarget.scale.copy(this._lastContentTargetScale);
        this.contentTarget.quaternion.set(0, 0, 0, 1);
        if (this.needsRemoval) {
            this.contentTargetOpacity = 0;
            return;
        }
        const boundingRect = this.bounds;
        if (boundingRect.width === 0 || boundingRect.height === 0) {
            this.contentTargetOpacity = 0;
            return;
        }
        this.contentTargetOpacity = 1;
        const pixelSize = WebLayer3D.PIXEL_SIZE;
        const parentBoundingRect = this.parentLayer instanceof WebLayer3D
            ? this.parentLayer.bounds
            : domUtils.getViewportBounds(scratchBounds);
        const left = boundingRect.left - parentBoundingRect.left;
        const top = boundingRect.top - parentBoundingRect.top;
        const parentOriginX = pixelSize * (-parentBoundingRect.width / 2);
        const parentOriginY = pixelSize * (parentBoundingRect.height / 2);
        const layerSeparation = this.options.layerSeparation || WebLayer3D.DEFAULT_LAYER_SEPARATION;
        const myLeft = pixelSize * (left + boundingRect.width / 2);
        const myTop = pixelSize * (top + boundingRect.height / 2);
        this.target.position.set(parentOriginX + myLeft, parentOriginY - myTop, layerSeparation * this.level);
        this.contentTarget.scale.set(Math.max(pixelSize * boundingRect.width, 10e-6), Math.max(pixelSize * boundingRect.height, 10e-6), 1);
        this._lastTargetPosition.copy(this.target.position);
        this._lastContentTargetScale.copy(this.contentTarget.scale);
    }
    _refreshMesh() {
        const mesh = this.mesh;
        const texture = this.texture;
        if (!texture)
            return;
        const material = mesh.material;
        material.map = texture;
        material.needsUpdate = true;
        this.depthMaterial['map'] = texture;
        this.depthMaterial.needsUpdate = true;
        if (!mesh.parent) {
            this.content.add(mesh);
            this._refreshTargetLayout();
            this.content.position.copy(this.contentTarget.position);
            this.content.scale.copy(this.contentTarget.scale);
        }
        mesh.renderOrder = this.level;
    }
    _showChildLayers(show) {
        for (const child of this.childLayers) {
            const childEl = child.element;
            if (childEl && childEl.style) {
                childEl.style.opacity = show ? '1' : '0';
            }
        }
    }
    _disableTransforms(disabled) {
        if (disabled) {
            document.documentElement.setAttribute(WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE, '');
        }
        else {
            document.documentElement.removeAttribute(WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE);
        }
    }
    _setHoverClasses(hover) {
        let el = this.element;
        let skip = hover - 1;
        while (el) {
            if (hover === 0) {
                if (el.classList.contains('hover'))
                    el.classList.remove('hover');
            }
            else if (skip === 0) {
                if (!el.classList.contains('hover'))
                    el.classList.add('hover');
            }
            else {
                skip--;
                el = this.parent && this.parent instanceof WebLayer3D ? this.parent.element : null;
                continue;
            }
            el = el.parentElement;
        }
    }
    _markForRemoval() {
        this._needsRemoval = true;
        for (const child of this.childLayers) {
            child._markForRemoval();
        }
    }
    _refreshChildLayers() {
        const element = this.element;
        const childLayers = this.childLayers;
        const oldChildLayers = childLayers.slice();
        childLayers.length = 0;
        domUtils.traverseDOM(element, this._tryConvertToWebLayer3D, this, this.level);
        for (const child of oldChildLayers) {
            if (childLayers.indexOf(child) === -1) {
                child._markForRemoval();
                childLayers.push(child);
            }
        }
    }
    _tryConvertToWebLayer3D(el, level) {
        const id = el.getAttribute(WebLayer3D.LAYER_ATTRIBUTE);
        if (id !== null || el.nodeName === 'VIDEO') {
            let child = this.layersByElement.get(el);
            if (!child) {
                child = new WebLayer3D(el, this.options, this, level);
                this.add(child);
            }
            this.childLayers.push(child);
            return false; // stop traversing this subtree
        }
        return true;
    }
    async _rasterize() {
        const element = this.element;
        const states = this._states;
        const renderFunctions = [];
        this.rootLayer._processMutations(this.rootLayer._mutationObserver.takeRecords());
        if (this.options.onBeforeRasterize) {
            this.options.onBeforeRasterize.call(null, this);
        }
        const onAfterRasterize = this.options.onAfterRasterize;
        if (element.nodeName === 'VIDEO') {
            const state = states[''][0];
            domUtils.getBounds(element, state.bounds);
            state.texture = state.texture || new THREE.VideoTexture(element);
            if (onAfterRasterize)
                onAfterRasterize(this);
            this.rootLayer._mutationObserver.takeRecords();
            return;
        }
        this._disableTransforms(true);
        this._showChildLayers(false);
        const classValue = element.className;
        for (const stateKey in states) {
            const hoverStates = states[stateKey];
            let hoverDepth = this._hoverDepth;
            for (let hover = 0; hover <= hoverDepth; hover++) {
                const state = hoverStates[hover];
                const texture = state.texture || new THREE.Texture(document.createElement('canvas'));
                if (stateKey)
                    element.classList.add(stateKey);
                this._setHoverClasses(hover);
                const bounds = domUtils.getBounds(element);
                const stack = NodeParser_1.NodeParser(element, this.rootLayer._resourceLoader, this.rootLayer._logger);
                if (stateKey)
                    element.classList.remove(stateKey);
                this._setHoverClasses(0);
                if (!bounds.width || !bounds.height)
                    continue;
                state.bounds = bounds;
                renderFunctions.push(() => {
                    const canvas = texture.image;
                    const context = canvas.getContext('2d');
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    const renderer = new Renderer_1.default(new CanvasRenderer_1.default(canvas), {
                        backgroundColor: null,
                        fontMetrics: this.rootLayer._fontMetrics,
                        imageStore,
                        logger: this.rootLayer._logger,
                        scale: this._pixelRatio,
                        x: bounds.left,
                        y: bounds.top,
                        width: bounds.width,
                        height: bounds.height,
                        allowTaint: this.options.allowTaint || false
                    });
                    renderer.render(stack);
                    if (!canvas.width || !canvas.height) {
                        canvas.width = 1;
                        canvas.height = 1;
                    }
                    texture.image = canvas;
                    texture.minFilter = THREE.LinearFilter;
                    texture.needsUpdate = true;
                    state.texture = texture;
                });
            }
        }
        element.className = classValue;
        this._showChildLayers(true);
        this._disableTransforms(false);
        if (onAfterRasterize)
            onAfterRasterize(this);
        this.rootLayer._mutationObserver.takeRecords();
        const imageStore = await this.rootLayer._resourceLoader.ready();
        for (const render of renderFunctions)
            render();
    }
}
WebLayer3D.domUtils = domUtils;
WebLayer3D.DEBUG_PERFORMANCE = false;
WebLayer3D.LAYER_ATTRIBUTE = 'data-layer';
WebLayer3D.LAYER_CONTAINER_ATTRIBUTE = 'data-layer-container';
WebLayer3D.PIXEL_RATIO_ATTRIBUTE = 'data-layer-pixel-ratio';
WebLayer3D.STATES_ATTRIBUTE = 'data-layer-states';
WebLayer3D.HOVER_DEPTH_ATTRIBUTE = 'data-layer-hover-depth';
WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE = 'data-layer-disable-transforms';
WebLayer3D.DEFAULT_LAYER_SEPARATION = 0.005;
WebLayer3D.PIXEL_SIZE = 0.001;
WebLayer3D.GEOMETRY = new THREE.PlaneGeometry(1, 1, 2, 2);
WebLayer3D.UPDATE_DEFAULT = function (layer, lerp = 1) {
    WebLayer3D.updateLayout(layer, lerp);
    WebLayer3D.updateVisibility(layer, lerp);
};
WebLayer3D._hoverLayers = new Set();
WebLayer3D._clearHover = function (layer) {
    layer._hover = 0;
    layer.cursor.visible = false;
};
WebLayer3D._setHover = function (layer) {
    layer._hover = WebLayer3D._hoverLayers.has(layer)
        ? 1
        : layer.parent instanceof WebLayer3D && layer.parent._hover > 0
            ? layer.parent._hover + 1
            : layer._hover;
};
WebLayer3D._setHoverClass = function (element) {
    const hoverLayers = WebLayer3D._hoverLayers;
    let hover = false;
    for (const layer of hoverLayers) {
        if (element.contains(layer.element)) {
            hover = true;
            break;
        }
    }
    if (hover && !element.classList.contains('hover'))
        element.classList.add('hover');
    if (!hover && element.classList.contains('hover'))
        element.classList.remove('hover');
    return true;
};
WebLayer3D._didInstallStyleSheet = false;
exports.default = WebLayer3D;
function ensureElementIsInDocument(element, options) {
    const document = element.ownerDocument;
    if (document.contains(element)) {
        return element;
    }
    const container = document.createElement('div');
    container.setAttribute(WebLayer3D.LAYER_CONTAINER_ATTRIBUTE, '');
    container.style.position = 'fixed';
    container.style.width = options && 'windowWidth' in options ? options.windowWidth + 'px' : '550px';
    container.style.height =
        options && 'windowHeight' in options ? options.windowHeight + 'px' : '150px';
    // top -100000px allows html2canvas to render input boxes more accurately
    // on mobile safari than left -10000px
    // my guess is this has something to do with safari trying to move the viewport
    // when a text field is focussed
    container.style.top = '-100000px';
    container.appendChild(element);
    document.documentElement.appendChild(container);
    return element;
}
function arraySubtract(a, b) {
    const result = [];
    for (const item of a) {
        if (!b.includes(item))
            result.push(item);
    }
    return result;
}
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
//# sourceMappingURL=three-web-layer.js.map