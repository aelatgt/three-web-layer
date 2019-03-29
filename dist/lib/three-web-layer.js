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
 * The texture state can be changed with `layer.setState(state)`, without requiring the DOM to be re-rendered.
 * Setting a state on a parent layer does not affect the state of a child layer.
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
    constructor(element, options = {}, rootLayer = undefined, _level = 0) {
        super();
        this.options = options;
        this.rootLayer = rootLayer;
        this._level = _level;
        this.content = new THREE.Object3D();
        this.mesh = new THREE.Mesh(WebLayer3D.GEOMETRY, new THREE.MeshBasicMaterial({
            depthTest: false,
            transparent: true,
            opacity: 0
        }));
        this.depthMaterial = new THREE.MeshDepthMaterial({
            depthPacking: THREE.RGBADepthPacking,
            alphaTest: 0.1
        });
        this.childLayers = [];
        this.targetContentPosition = new THREE.Vector3();
        this.targetContentScale = new THREE.Vector3(0.1, 0.1, 0.1);
        this.cursor = new THREE.Object3D();
        this.needsRasterize = true;
        this._lastTargetContentPosition = new THREE.Vector3();
        this._lastTargetContentScale = new THREE.Vector3(0.1, 0.1, 0.1);
        this._isUpdating = false; // true while in WebLayer3D#update() function
        this._needsRemoval = false;
        this._needsHiding = false;
        this._hover = 0;
        this._hoverDepth = 0;
        this._states = {};
        this._pixelRatio = 1;
        this._state = '';
        this._raycaster = new THREE.Raycaster();
        this._hitIntersections = this._raycaster.intersectObjects([]); // for type inference
        // the following properties are meant to be accessed on the root layer
        this._rasterizationQueue = [];
        this._meshMap = new WeakMap();
        this._interactionRays = [];
        this.element = element;
        this.element.setAttribute(WebLayer3D.LAYER_ATTRIBUTE, this.id.toString());
        this.rootLayer = rootLayer || this;
        this.name = element.id;
        if (!document.contains(element) && this.rootLayer === this) {
            ensureElementIsInDocument(element, options);
        }
        if (!WebLayer3D._didInstallStyleSheet) {
            const style = document.createElement('style');
            document.head.append(style);
            addCSSRule(style.sheet, `[${WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE}] *`, 'transform: none !important;', 0);
            WebLayer3D._didInstallStyleSheet = true;
        }
        this.add(this.content);
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
            // element.addEventListener('focus', this._triggerRefresh, { capture: true })
            element.addEventListener('transitionend', this._triggerRefresh, { capture: true });
            let target;
            const setLayerNeedsRasterize = (layer) => {
                if (target.contains(layer.element))
                    layer.needsRasterize = true;
            };
            this._processMutations = (records) => {
                if (this._isUpdating)
                    return;
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
                            if (c === 'hover') {
                                continue;
                            }
                            if (layer._states[c]) {
                                layer.state = '';
                                continue;
                            }
                            needsRasterize = true;
                        }
                        for (const c of addedClasses) {
                            if (c === 'hover') {
                                continue;
                            }
                            if (layer._states[c]) {
                                layer.state = c;
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
                if (layer.element.offsetWidth !== layer.bounds.width ||
                    layer.element.offsetHeight !== layer.bounds.height)
                    layer.needsRasterize = true;
            }
        });
        this._resizeObserver.observe(element);
        if (this.options.onLayerCreate)
            this.options.onLayerCreate(this);
    }
    static transitionLayout(layer, alpha) {
        layer.content.position.lerp(layer.targetContentPosition, alpha);
        layer.content.scale.lerp(layer.targetContentScale, alpha);
    }
    static transitionVisibility(layer, alpha) {
        const material = layer.mesh.material;
        if (layer.needsRemoval) {
            if ('opacity' in material && material.opacity > 0.001) {
                material.opacity = THREE.Math.lerp(material.opacity, 0, alpha);
                material.needsUpdate = true;
            }
            else {
                if (layer.parent)
                    layer.parent.remove(layer);
                layer.dispose();
            }
        }
        else {
            if ('opacity' in material) {
                const opacity = !layer.mesh.parent || layer.needsHiding ? 0 : 1;
                material.opacity = Math.min(THREE.Math.lerp(material.opacity, opacity, alpha), 1);
                material.needsUpdate = true;
            }
        }
    }
    static _updateInteractions(rootLayer) {
        rootLayer.updateWorldMatrix(true, true);
        rootLayer.traverseLayers(WebLayer3D._clearHover);
        WebLayer3D._hoverLayers.clear();
        for (const ray of rootLayer._interactionRays) {
            rootLayer._hitIntersections.length = 0;
            rootLayer._raycaster.ray.copy(ray);
            rootLayer._raycaster.intersectObject(rootLayer, true, rootLayer._hitIntersections);
            for (const intersection of rootLayer._hitIntersections) {
                const layer = rootLayer._meshMap.get(intersection.object);
                if (layer && !layer.needsHiding) {
                    WebLayer3D._hoverLayers.add(layer);
                    layer._hover = 1;
                    WebLayer3D._updateInteraction(layer, intersection.point);
                }
            }
        }
        rootLayer.traverseLayers(WebLayer3D._setHover);
        traverseDOM(rootLayer.element, WebLayer3D._setHoverClass);
    }
    static async _scheduleRasterizations(rootLayer) {
        const queue = rootLayer._rasterizationQueue;
        if (window.requestIdleCallback) {
            if (queue.length)
                window.requestIdleCallback(idleDeadline => {
                    if (!queue.length)
                        return;
                    if (WebLayer3D.DEBUG)
                        performance.mark('rasterize queue start');
                    while (queue.length && idleDeadline.timeRemaining() > 0) {
                        if (WebLayer3D.DEBUG)
                            performance.mark('rasterize start');
                        queue.shift()._rasterize();
                        if (WebLayer3D.DEBUG)
                            performance.mark('rasterize end');
                        if (WebLayer3D.DEBUG)
                            performance.measure('rasterize', 'rasterize start', 'rasterize end');
                    }
                    if (WebLayer3D.DEBUG)
                        performance.mark('rasterize queue end');
                    if (WebLayer3D.DEBUG)
                        performance.measure('rasterize queue', 'rasterize queue start', 'rasterize queue end');
                });
        }
        else {
            await null; // wait for render to complete
            if (!queue.length)
                return;
            const startTime = performance.now();
            if (WebLayer3D.DEBUG)
                performance.mark('rasterize queue start');
            while (queue.length && performance.now() - startTime < 5) {
                if (WebLayer3D.DEBUG)
                    performance.mark('rasterize start');
                queue.shift()._rasterize();
                if (WebLayer3D.DEBUG)
                    performance.mark('rasterize end');
                if (WebLayer3D.DEBUG)
                    performance.measure('rasterize', 'rasterize start', 'rasterize end');
            }
            if (WebLayer3D.DEBUG)
                performance.mark('rasterize queue end');
            if (WebLayer3D.DEBUG)
                performance.measure('rasterize queue', 'rasterize queue start', 'rasterize queue end');
        }
    }
    /**
     * Change the texture state.
     * Note: if a state is not available, the `default` state will be rendered.
     */
    set state(state) {
        this._state = state;
    }
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
    get needsHiding() {
        return this._needsHiding;
    }
    /**
     * Update the pose and opacity of this layer (does not rerender the DOM).
     * This should be called each frame, and can only be called on a root WebLayer3D instance.
     *
     * @param alpha lerp value
     * @param transition transition function. Default is WebLayer3D.TRANSITION_DEFAULT
     */
    update(alpha = 1, transition = WebLayer3D.TRANSITION_DEFAULT) {
        if (WebLayer3D.DEBUG)
            performance.mark('update start');
        alpha = Math.min(alpha, 1);
        this._isUpdating = true;
        this._checkRoot();
        WebLayer3D._updateInteractions(this);
        if (WebLayer3D.DEBUG)
            performance.mark('update interactions end');
        if (WebLayer3D.DEBUG)
            performance.mark('update refresh start');
        this.refresh();
        if (WebLayer3D.DEBUG)
            performance.mark('update refresh end');
        if (WebLayer3D.DEBUG)
            performance.mark('update transitions start');
        this.traverseLayers(transition, alpha);
        if (WebLayer3D.DEBUG)
            performance.mark('update transitions end');
        this._isUpdating = false;
        WebLayer3D._scheduleRasterizations(this);
        if (WebLayer3D.DEBUG)
            performance.mark('update end');
        if (WebLayer3D.DEBUG)
            performance.measure('update refresh', 'update refresh start', 'update refresh end');
        if (WebLayer3D.DEBUG)
            performance.measure('update transitions', 'update transitions start', 'update transitions end');
        if (WebLayer3D.DEBUG)
            performance.measure('update', 'update start', 'update end');
    }
    traverseLayers(each, ...params) {
        each(this, ...params);
        this.traverseChildLayers(each, ...params);
    }
    traverseChildLayers(each, ...params) {
        for (const child of this.children) {
            if (child instanceof WebLayer3D)
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
        if (!closestLayerElement)
            return undefined;
        const id = parseInt(closestLayerElement.getAttribute(WebLayer3D.LAYER_ATTRIBUTE) || '', 10);
        return this.id === id ? this : this.getObjectById(id);
    }
    hitTest(ray) {
        this._checkRoot();
        this._raycaster.ray.copy(ray);
        this._hitIntersections.length = 0;
        const intersections = this._raycaster.intersectObject(this, true, this._hitIntersections);
        for (const intersection of intersections) {
            const layer = this.rootLayer._meshMap.get(intersection.object);
            if (!layer)
                continue;
            const layerBoundingRect = layer.bounds;
            if (!layerBoundingRect.width || !layerBoundingRect.height)
                continue;
            let target = layer.element;
            const clientX = intersection.uv.x * layerBoundingRect.width;
            const clientY = (1 - intersection.uv.y) * layerBoundingRect.height;
            traverseDOM(layer.element, el => {
                if (!target.contains(el))
                    return false;
                const elementBoundingRect = getBounds(el);
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
        this._updateState();
        this._updateBounds();
        if (this.needsRasterize || forceRasterize) {
            this.needsRasterize = false;
            this._updateChildLayers();
            if (this.rootLayer._rasterizationQueue.indexOf(this) === -1) {
                this.rootLayer._rasterizationQueue.push(this);
            }
        }
        for (const child of this.children) {
            if (child instanceof WebLayer3D)
                child.refresh(forceRasterize);
        }
        this._updateTargetLayout();
        this._updateMesh();
    }
    dispose() {
        if (this._mutationObserver)
            this._mutationObserver.disconnect();
        if (this._resizeObserver)
            this._resizeObserver.disconnect();
        for (const child of this.childLayers)
            child.dispose();
    }
    _updateState() {
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
                        bounds: {}
                    };
                }
            }
        }
    }
    _checkRoot() {
        if (this.rootLayer !== this)
            throw new Error('Only call `update` on a root WebLayer3D instance');
    }
    _updateBounds() {
        getBounds(this.element, this.bounds);
    }
    _updateTargetLayout() {
        this.targetContentPosition.copy(this._lastTargetContentPosition);
        this.targetContentScale.copy(this._lastTargetContentScale);
        if (this.needsRemoval) {
            this._needsHiding = true;
            return;
        }
        const boundingRect = this.bounds;
        if (boundingRect.width === 0 ||
            boundingRect.height === 0 ||
            (this.parent instanceof WebLayer3D && this.parent._needsHiding)) {
            this._needsHiding = true;
            return;
        }
        this._needsHiding = false;
        const rootBoundingRect = this.rootLayer.bounds;
        const left = boundingRect.left - rootBoundingRect.left;
        const top = boundingRect.top - rootBoundingRect.top;
        const pixelSize = WebLayer3D.DEFAULT_PIXEL_DIMENSIONS;
        if (this.rootLayer !== this) {
            let layerSeparation = this.options.layerSeparation || WebLayer3D.DEFAULT_LAYER_SEPARATION;
            const rootOriginX = pixelSize * (-rootBoundingRect.width / 2);
            const rootOriginY = pixelSize * (rootBoundingRect.height / 2);
            const myLeft = pixelSize * (left + boundingRect.width / 2);
            const myTop = pixelSize * (top + boundingRect.height / 2);
            this.targetContentPosition.set(rootOriginX + myLeft, rootOriginY - myTop, layerSeparation * this.level);
        }
        this.targetContentScale.set(Math.max(pixelSize * boundingRect.width, 10e-6), Math.max(pixelSize * boundingRect.height, 10e-6), 1);
        this._lastTargetContentPosition.copy(this.targetContentPosition);
        this._lastTargetContentScale.copy(this.targetContentScale);
    }
    _updateMesh() {
        const mesh = this.mesh;
        const texture = this.texture;
        if (!texture)
            return;
        const material = mesh.material;
        material.map = texture;
        material.needsUpdate = true;
        this.depthMaterial['map'] = texture;
        this.depthMaterial.needsUpdate = true;
        if (!this.needsHiding && !mesh.parent) {
            this.content.add(mesh);
            this._updateTargetLayout();
            this.content.position.copy(this.targetContentPosition);
            this.content.scale.copy(this.targetContentScale);
        }
        if (this.needsHiding && mesh.material.opacity < 0.05) {
            mesh.visible = false;
        }
        else {
            mesh.visible = true;
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
            this.rootLayer._processMutations(this.rootLayer._mutationObserver.takeRecords());
            document.documentElement.setAttribute(WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE, '');
        }
        else {
            document.documentElement.removeAttribute(WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE);
            this.rootLayer._mutationObserver.takeRecords();
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
        traverseDOM(element, this._tryConvertToWebLayer3D, this, this.level);
        for (const child of oldChildLayers) {
            if (childLayers.indexOf(child) === -1)
                child._markForRemoval();
        }
    }
    _tryConvertToWebLayer3D(el, level) {
        const id = el.getAttribute(WebLayer3D.LAYER_ATTRIBUTE);
        if (id !== null || el.nodeName === 'video') {
            let child = this.getObjectById(parseInt(id + '', 10));
            if (!child) {
                child = new WebLayer3D(el, this.options, this.rootLayer, level);
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
        if (element.nodeName === 'video') {
            const state = states[''][0];
            state.bounds = getBounds(element);
            state.texture = state.texture || new THREE.VideoTexture(element);
            return;
        }
        this._disableTransforms(true);
        this._showChildLayers(false);
        for (const stateKey in states) {
            const hoverStates = states[stateKey];
            let hoverDepth = this._hoverDepth;
            for (let hover = 0; hover <= hoverDepth; hover++) {
                const state = hoverStates[hover];
                const texture = state.texture || new THREE.Texture(document.createElement('canvas'));
                if (stateKey)
                    element.classList.add(stateKey);
                this._setHoverClasses(hover);
                const bounds = getBounds(element);
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
        this._showChildLayers(true);
        this._disableTransforms(false);
        const imageStore = await this.rootLayer._resourceLoader.ready();
        for (const render of renderFunctions)
            render();
    }
}
WebLayer3D.DEBUG = false;
WebLayer3D.LAYER_ATTRIBUTE = 'data-layer';
WebLayer3D.LAYER_CONTAINER_ATTRIBUTE = 'data-layer-container';
WebLayer3D.PIXEL_RATIO_ATTRIBUTE = 'data-layer-pixel-ratio';
WebLayer3D.STATES_ATTRIBUTE = 'data-layer-states';
WebLayer3D.HOVER_DEPTH_ATTRIBUTE = 'data-layer-hover-depth';
WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE = 'data-layer-disable-transforms';
WebLayer3D.DEFAULT_LAYER_SEPARATION = 0.005;
WebLayer3D.DEFAULT_PIXEL_DIMENSIONS = 0.001;
WebLayer3D.GEOMETRY = new THREE.PlaneGeometry(1, 1, 2, 2);
WebLayer3D.TRANSITION_DEFAULT = function (layer, alpha = 1) {
    WebLayer3D.transitionLayout(layer, alpha);
    WebLayer3D.transitionVisibility(layer, alpha);
};
WebLayer3D._hoverLayers = new Set();
WebLayer3D._clearHover = function (layer) {
    layer._hover = 0;
    layer.remove(layer.cursor);
};
WebLayer3D._setHover = function (layer) {
    layer._hover =
        layer._hover === 0 && layer.parent instanceof WebLayer3D && layer.parent._hover > 0
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
WebLayer3D._updateInteraction = function (layer, point) {
    if (layer.hover === 1) {
        layer.cursor.position.copy(point);
        layer.worldToLocal(layer.cursor.position);
        layer.add(layer.cursor);
    }
    else {
        layer.remove(layer.cursor);
    }
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
function traverseDOM(node, each, bind, level = 0) {
    level++;
    for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child;
            if (each.call(bind, el, level)) {
                traverseDOM(el, each, bind, level);
            }
        }
    }
}
function getBounds(element, bounds = { left: 0, top: 0, width: 0, height: 0 }) {
    const window = element.ownerDocument.defaultView;
    let el = element;
    let left = el.offsetLeft;
    let top = el.offsetTop;
    let offsetParent = el.offsetParent;
    while (el && el.nodeType !== Node.DOCUMENT_NODE) {
        left -= el.scrollLeft;
        top -= el.scrollTop;
        if (el === offsetParent) {
            const style = window.getComputedStyle(el);
            left += el.offsetLeft + parseFloat(style.borderLeftWidth) || 0;
            top += el.offsetTop + parseFloat(style.borderTopWidth) || 0;
            offsetParent = el.offsetParent;
        }
        el = el.offsetParent;
    }
    bounds.left = left + window.pageXOffset;
    bounds.top = top + window.pageYOffset;
    bounds.width = element.offsetWidth;
    bounds.height = element.offsetHeight;
    return bounds;
}
function addCSSRule(sheet, selector, rules, index) {
    if ('insertRule' in sheet) {
        sheet.insertRule(selector + '{' + rules + '}', index);
    }
    else if ('addRule' in sheet) {
        sheet.addRule(selector, rules, index);
    }
}
function arraySubtract(a, b) {
    const result = [];
    for (const item of a) {
        if (!b.includes(item))
            result.push(item);
    }
    return result;
}
//# sourceMappingURL=three-web-layer.js.map