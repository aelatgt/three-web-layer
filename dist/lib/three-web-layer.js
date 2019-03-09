"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const THREE = require("three");
const resize_observer_polyfill_1 = require("resize-observer-polyfill");
require("babel-polyfill");
// import html2canvas from '@speigg/html2canvas/dist/npm/index'
const NodeParser_1 = require("@speigg/html2canvas/dist/npm/NodeParser");
const Logger_1 = require("@speigg/html2canvas/dist/npm/Logger");
const CanvasRenderer_1 = require("@speigg/html2canvas/dist/npm/renderer/CanvasRenderer");
const Renderer_1 = require("@speigg/html2canvas/dist/npm/Renderer");
const ResourceLoader_1 = require("@speigg/html2canvas/dist/npm/ResourceLoader");
const Font_1 = require("@speigg/html2canvas/dist/npm/Font");
const Bounds_1 = require("@speigg/html2canvas/dist/npm/Bounds");
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
        this.textures = {};
        this.mesh = new THREE.Mesh(WebLayer3D.GEOMETRY, new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0
        }));
        this.depthMaterial = new THREE.MeshDepthMaterial({
            // depthPacking: THREE.RGBADepthPacking,
            alphaTest: 0.5
        });
        this.childLayers = [];
        this.targetContentPosition = new THREE.Vector3();
        this.targetContentScale = new THREE.Vector3(0.1, 0.1, 0.1);
        this.boundingRect = { left: 0, top: 0, width: 0, height: 0 };
        this.cursor = new THREE.Object3D();
        this.needsRefresh = true;
        this._lastTargetContentPosition = new THREE.Vector3();
        this._lastTargetContentScale = new THREE.Vector3(0.1, 0.1, 0.1);
        this._isRefreshing = false;
        this._isUpdating = false;
        this._needsRemoval = false;
        this._needsHiding = false;
        this._hover = false;
        this._pixelRatio = 1;
        this._state = '';
        this._raycaster = new THREE.Raycaster();
        this._hitIntersections = this._raycaster.intersectObjects([]); // for type inference
        this._meshMap = new WeakMap();
        this._interactionMap = new Map();
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
            addCSSRule(style.sheet, `[${WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE}], [${WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE}] *`, 'transform: none !important;', 0);
            WebLayer3D._didInstallStyleSheet = true;
        }
        this.add(this.content);
        this.mesh.renderOrder = this.level;
        this.mesh.visible = false;
        this.mesh['customDepthMaterial'] = new THREE.MeshDepthMaterial();
        this.rootLayer._meshMap.set(this.mesh, this);
        if (this.rootLayer === this) {
            this._triggerRefresh = (e) => {
                const layer = this.getLayerForElement(e.target);
                if (layer) {
                    layer.needsRefresh = true;
                    layer.refresh();
                }
            };
            const setLayerNeedsRefresh = layer => (layer.needsRefresh = true);
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
                    const target = record.target.nodeType === Node.ELEMENT_NODE
                        ? record.target
                        : record.target.parentElement;
                    if (!target) {
                        continue;
                    }
                    const layer = this.getLayerForElement(target);
                    if (layer) {
                        if (record.type === 'childList') {
                            layer.traverse(setLayerNeedsRefresh);
                        }
                        else
                            layer.needsRefresh = true;
                    }
                }
                this.refresh();
            };
            element.addEventListener('input', this._triggerRefresh, { capture: true });
            element.addEventListener('change', this._triggerRefresh, { capture: true });
            // element.addEventListener('focus', this._triggerRefresh, { capture: true })
            // element.addEventListener('transitionend', this._triggerRefresh, { capture: true })
            this._mutationObserver = new MutationObserver(this._processMutations);
            this._mutationObserver.observe(element, {
                characterData: true,
                characterDataOldValue: true,
                attributes: true,
                attributeOldValue: true,
                childList: true,
                subtree: true
            });
            this._resizeObserver = new resize_observer_polyfill_1.default((records, observer) => {
                for (const record of records) {
                    const target = this.getLayerForElement(record.target);
                    target.needsRefresh = true;
                }
                this.refresh();
            });
            this._resizeObserver.observe(element);
            // stuff for rendering with html2canvas ¯\_(ツ)_/¯
            this._logger = new Logger_1.default(false);
            this._fontMetrics = new Font_1.FontMetrics(document);
            this._resourceLoader = new ResourceLoader_1.default({
                imageTimeout: 15000,
                allowTaint: options.allowTaint || false
            }, this._logger, window);
        }
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
     * @param children if true, also update child layers. Default is true.
     * @param transition transition function. Default is WebLayer3D.TRANSITION_DEFAULT
     */
    update(alpha = 1, transition = WebLayer3D.TRANSITION_DEFAULT) {
        alpha = Math.min(alpha, 1);
        this._isUpdating = true;
        this._checkRoot();
        this.refresh();
        this._updateInteractions();
        this.traverseLayers(transition, alpha);
        this._isUpdating = false;
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
        this._raycaster.ray.copy(ray);
        this._hitIntersections.length = 0;
        const intersections = this._raycaster.intersectObject(this, true, this._hitIntersections);
        for (const intersection of intersections) {
            const layer = this.rootLayer._meshMap.get(intersection.object);
            if (!layer)
                continue;
            const layerBoundingRect = layer.boundingRect;
            if (!layerBoundingRect.width || !layerBoundingRect.height)
                continue;
            let target = layer.element;
            const clientX = intersection.uv.x * layerBoundingRect.width;
            const clientY = (1 - intersection.uv.y) * layerBoundingRect.height;
            this._disableTransforms(true);
            traverseDOM(layer.element, el => {
                if (!target.contains(el))
                    return false;
                const elementBoundingRect = Bounds_1.parseBounds(el, window.pageXOffset, window.pageYOffset);
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
            this._disableTransforms(false);
            return { layer, intersection, target };
        }
        return undefined;
    }
    async refresh(force = false) {
        if (force)
            this.needsRefresh = true;
        this._updateState();
        this._updateChildLayers();
        this._updateDefaultLayout();
        const refreshes = [];
        for (const child of this.children) {
            if (child instanceof WebLayer3D)
                refreshes.push(child.refresh(force));
        }
        if (this.needsRefresh && !this._isRefreshing) {
            this._isRefreshing = true;
            this.needsRefresh = false;
            await this._renderTextures();
            this._isRefreshing = false;
            this._updateDefaultLayout();
        }
        this._updateMesh();
        await Promise.all(refreshes);
        return;
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
        this._states = (element.getAttribute(WebLayer3D.STATES_ATTRIBUTE) || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        this._states.push('');
        for (const state of this._states.slice()) {
            this._states.push((state + ' hover').trim());
        }
    }
    _checkRoot() {
        if (this.rootLayer !== this)
            throw new Error('Only call `update` on a root WebLayer3D instance');
    }
    _updateDefaultLayout() {
        this.targetContentPosition.copy(this._lastTargetContentPosition);
        this.targetContentScale.copy(this._lastTargetContentScale);
        if (this.needsRemoval) {
            this._needsHiding = true;
            return;
        }
        this._needsHiding = false;
        const rootBoundingRect = this.rootLayer.boundingRect;
        const boundingRect = this.boundingRect;
        if (boundingRect.width === 0 ||
            boundingRect.height === 0 ||
            (this.parent instanceof WebLayer3D && this.parent._needsHiding)) {
            this._needsHiding = true;
            return;
        }
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
        // cleanup unused textures
        const states = this._states;
        for (const state in this.textures) {
            if (!states.includes(state)) {
                this.textures[state].dispose();
                delete this.textures[state];
            }
        }
        const mesh = this.mesh;
        const textureID = (this.hover ? this.state + ' hover' : this.state).trim();
        const fallbackTextureID = this.hover ? 'hover' : '';
        const texture = this.textures[textureID] || this.textures[fallbackTextureID];
        if (!texture)
            return;
        const material = mesh.material;
        material.map = texture;
        material.needsUpdate = true;
        this.depthMaterial['map'] = texture;
        this.depthMaterial.needsUpdate = true;
        if (!this.needsHiding && !mesh.parent) {
            this.content.add(mesh);
            this._updateDefaultLayout();
            // this.content.position.copy(this.defaultContentPosition)
            this.content.scale.copy(this.targetContentScale);
        }
        if (this.needsHiding && mesh.material.opacity < 0.05) {
            mesh.visible = false;
        }
        else {
            mesh.visible = true;
        }
    }
    _updateInteractions() {
        const interactionMap = this._interactionMap;
        interactionMap.clear();
        if (!this._interactionRays || this._interactionRays.length === 0) {
            this.traverseLayers(WebLayer3D._updateInteraction, interactionMap);
            return;
        }
        interactions: for (const ray of this._interactionRays) {
            this._hitIntersections.length = 0;
            this._raycaster.ray.copy(ray);
            this._raycaster.intersectObject(this, true, this._hitIntersections);
            for (const intersection of this._hitIntersections) {
                const layer = this._meshMap.get(intersection.object);
                if (layer) {
                    interactionMap.set(layer, { point: intersection.point });
                    continue interactions;
                }
            }
        }
        this.traverseLayers(WebLayer3D._updateInteraction, interactionMap);
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
        const rootParent = this.rootLayer.element.parentElement;
        if (disabled)
            rootParent.setAttribute(WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE, '');
        else
            rootParent.removeAttribute(WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE);
    }
    // private _markForRefresh() {
    //   if (this._needsRefresh) return
    //   this._needsRefresh = true
    //   if (this.parent instanceof WebLayer3D) this.parent._markForRefresh()
    // }
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
        const id = el.getAttribute(WebLayer3D.LAYER_ATTRIBUTE);
        if (id !== null) {
            let child = this.getObjectById(parseInt(id, 10));
            if (!child) {
                child = new WebLayer3D(el, this.options, this.rootLayer, this._level + 1);
                this.add(child);
            }
            this.childLayers.push(child);
            return false; // stop traversing this subtree
        }
        return true;
    }
    async _renderTextures() {
        const element = this.element;
        const textures = this.textures;
        const renderFunctions = [];
        this._disableTransforms(true);
        const bounds = (this.boundingRect = Bounds_1.parseBounds(element, window.pageXOffset, window.pageYOffset));
        if (!bounds.width || !bounds.height) {
            this._disableTransforms(false);
            return;
        }
        this._showChildLayers(false);
        for (const state of this._states) {
            let texture = textures[state];
            if (!texture) {
                texture = new THREE.Texture(document.createElement('canvas'));
                texture.anisotropy = 16;
            }
            const classes = state && state.split(' ');
            if (classes)
                element.classList.add(...classes);
            const stack = NodeParser_1.NodeParser(element, this.rootLayer._resourceLoader, this.rootLayer._logger);
            if (classes)
                element.classList.remove(...classes);
            renderFunctions.push(() => {
                const canvas = texture.image;
                const context = canvas.getContext('2d');
                context.clearRect(0, 0, canvas.width, canvas.height);
                const renderer = new Renderer_1.default(new CanvasRenderer_1.default(canvas), renderOptions);
                renderer.render(stack);
                if (!canvas.width || !canvas.height) {
                    canvas.width = 1;
                    canvas.height = 1;
                }
                texture.image = canvas;
                texture.minFilter = THREE.LinearFilter;
                texture.needsUpdate = true;
                textures[state] = texture;
            });
        }
        this._showChildLayers(true);
        this._disableTransforms(false);
        this.rootLayer._processMutations(this.rootLayer._mutationObserver.takeRecords());
        const imageStore = await this.rootLayer._resourceLoader.ready();
        const renderOptions = {
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
        };
        for (const render of renderFunctions)
            render();
    }
}
WebLayer3D.LAYER_ATTRIBUTE = 'data-layer';
WebLayer3D.LAYER_CONTAINER_ATTRIBUTE = 'data-layer-container';
WebLayer3D.PIXEL_RATIO_ATTRIBUTE = 'data-layer-pixel-ratio';
WebLayer3D.STATES_ATTRIBUTE = 'data-layer-states';
WebLayer3D.DISABLE_TRANSFORMS_ATTRIBUTE = 'data-layer-disable-transforms';
WebLayer3D.DEFAULT_LAYER_SEPARATION = 0.005;
WebLayer3D.DEFAULT_PIXEL_DIMENSIONS = 0.001;
WebLayer3D.GEOMETRY = new THREE.PlaneGeometry(1, 1, 2, 2);
WebLayer3D.TRANSITION_DEFAULT = function (layer, alpha = 1) {
    WebLayer3D.transitionLayout(layer, alpha);
    WebLayer3D.transitionVisibility(layer, alpha);
};
WebLayer3D._updateInteraction = function (layer, interactions) {
    const interaction = interactions.get(layer);
    if (interaction) {
        layer._hover = true;
        layer.cursor.position.copy(interaction.point);
        layer.worldToLocal(layer.cursor.position);
        layer.add(layer.cursor);
    }
    else {
        layer._hover = false;
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
    document.body
        ? document.body.appendChild(container)
        : document.documentElement.appendChild(container);
    return element;
}
function traverseDOM(node, each, bind) {
    for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child;
            if (each.call(bind, el)) {
                traverseDOM(el, each, bind);
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
//# sourceMappingURL=three-web-layer.js.map