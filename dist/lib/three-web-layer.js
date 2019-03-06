"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const THREE = require("three");
const resize_observer_polyfill_1 = require("resize-observer-polyfill");
require("babel-polyfill");
const index_1 = require("@speigg/html2canvas/dist/npm/index");
const NodeParser_1 = require("@speigg/html2canvas/dist/npm/NodeParser");
const Logger_1 = require("@speigg/html2canvas/dist/npm/Logger");
const CanvasRenderer_1 = require("@speigg/html2canvas/dist/npm/renderer/CanvasRenderer");
const Renderer_1 = require("@speigg/html2canvas/dist/npm/Renderer");
const ResourceLoader_1 = require("@speigg/html2canvas/dist/npm/ResourceLoader");
const Font_1 = require("@speigg/html2canvas/dist/npm/Font");
const cuid_1 = require("cuid");
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
        this.textures = {
            default: new THREE.Texture(document.createElement('canvas'))
        };
        this.mesh = new THREE.Mesh(WebLayer3D.GEOMETRY, new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            map: this.textures.default
        }));
        this.childLayers = [];
        this.boundingRect = new DOMRect();
        this.defaultContentPosition = new THREE.Vector3();
        this.defaultContentScale = new THREE.Vector3(1, 1, 1);
        this.cursor = new THREE.Object3D();
        this._hover = false;
        this._needsRemoval = false;
        this._pixelRatio = 1;
        this._state = 'default';
        this._raycaster = new THREE.Raycaster();
        this._hitIntersections = this._raycaster.intersectObjects([]); // for type inference
        this._meshMap = new WeakMap();
        this._interactionMap = new Map();
        this.element = element;
        this.element.setAttribute(WebLayer3D.LAYER_ATTRIBUTE, this.id.toString());
        this.element.setAttribute(WebLayer3D.UID_ATTRIBUTE, cuid_1.default.slug());
        this.rootLayer = rootLayer || this;
        this.name = element.id;
        if (this.rootLayer === this) {
            this._logger = new Logger_1.default(false);
            this._resourceLoader = new ResourceLoader_1.default({
                imageTimeout: 15000,
                allowTaint: options.allowTaint || false
            }, this._logger, window);
        }
        if (!document.contains(element)) {
            ensureElementIsInDocument(element, options);
        }
        this.add(this.content);
        this.mesh.visible = false;
        this.rootLayer._meshMap.set(this.mesh, this);
        if (this.rootLayer === this) {
            this.refresh(true);
            const refreshOnChange = (e) => {
                if (!this._updateTargetInClonedDocument(e.target)) {
                    return this.refresh(true);
                }
                this.getLayerForElement(e.target).refresh();
            };
            element.addEventListener('input', refreshOnChange, { capture: true });
            element.addEventListener('change', refreshOnChange, { capture: true });
            element.addEventListener('focus', refreshOnChange, { capture: true });
            element.addEventListener('transitionend', refreshOnChange, { capture: true });
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
                        const layer = this.getLayerForElement(target);
                        layer._updateChildLayers();
                        return this.refresh(true);
                    }
                    if (!this._updateTargetInClonedDocument(target, record.type === 'characterData')) {
                        return this.refresh(true);
                    }
                    layersToRefresh.add(this.getLayerForElement(target));
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
        this._resizeObserver = new resize_observer_polyfill_1.default((records, observer) => {
            this.refresh();
        });
        this._resizeObserver.observe(element);
        if (this.options.onLayerCreate)
            this.options.onLayerCreate(this);
    }
    /**
     * Change the texture state.
     * Note: if a state is not available, the `default` state will be rendered.
     */
    set state(state) {
        this._state = state;
        this._updateMesh();
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
    /** If true, this layer needs to be removed from the scene */
    get needsRemoval() {
        return this._needsRemoval;
    }
    /**
     * Update the pose and opacity of this layer (does not rerender the DOM).
     * This should be called each frame, and can only be called on a root WebLayer3D instance.
     *
     * @param alpha lerp value
     * @param transition transition function (by default, this is WebLayer3D.TRANSITION_DEFAULT)
     * @param children if true, also update child layers
     */
    update(alpha = 1, transition = WebLayer3D.TRANSITION_DEFAULT, children = true) {
        this._checkRoot();
        this._updateInteractions();
        if (children)
            this.traverseLayers(transition, alpha);
        else
            transition(this, alpha);
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
                material.opacity = Math.min(THREE.Math.lerp(material.opacity, 1, alpha), 1);
                material.needsUpdate = true;
            }
        }
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
    getLayerForRay(ray) {
        this._raycaster.ray.copy(ray);
        this._hitIntersections.length = 0;
        const intersections = this._raycaster.intersectObject(this, true, this._hitIntersections);
        for (const intersection of intersections) {
            const layer = this.rootLayer._meshMap.get(intersection.object);
            if (layer)
                return layer;
        }
        return undefined;
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
        for (const state of this._states.slice()) {
            this._states.push(state + ' hover');
        }
        for (const state of this._states) {
            if (!this.textures[state]) {
                const canvas = document.createElement('canvas');
                this.textures[state] = new THREE.Texture(canvas);
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
                index_1.default(element, {
                    logging: false,
                    target: [new CanvasRenderer_1.default(this.textures.default.image)],
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
        const childrenRefreshing = [];
        this.traverseChildLayers(child => {
            childrenRefreshing.push(child.refresh());
        });
        await this._renderTextures();
        this._updateMesh();
        if (!this.mesh.parent && this.mesh.material.map) {
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
    _checkRoot() {
        if (this.rootLayer !== this)
            throw new Error('Only call `update` on a root WebLayer3D instance');
    }
    _updateInteractions() {
        const interactionMap = this._interactionMap;
        interactionMap.clear();
        if (!this._interactionRays || this._interactionRays.length === 0) {
            this.traverseLayers(WebLayer3D._UPDATE_INTERACTION, interactionMap);
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
        this.traverseLayers(WebLayer3D._UPDATE_INTERACTION, interactionMap);
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
            el.setAttribute(WebLayer3D.UID_ATTRIBUTE, cuid_1.default.slug());
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
    async _renderTextures() {
        // if cloned document is not attached to the DOM, the root element was refreshed,
        // so wait for the next cloned document
        let clonedDocument = this.rootLayer._clonedDocument;
        while (!clonedDocument || clonedDocument.defaultView === null) {
            clonedDocument =
                this.rootLayer._clonedDocument || (await this.rootLayer._clonedDocumentPromise);
        }
        const clonedElement = clonedDocument.querySelector(`[${WebLayer3D.LAYER_ATTRIBUTE}="${this.id}"]`);
        if (!clonedElement)
            return; // has been removed
        this._hideChildLayers(clonedDocument);
        const textures = this.textures;
        const renderFunctions = [];
        for (const state in textures) {
            const texture = textures[state];
            if (!texture) {
                continue;
            }
            const classes = state.split(' ');
            clonedElement.classList.add(...classes);
            const stack = NodeParser_1.NodeParser(clonedElement, this.rootLayer._resourceLoader, this.rootLayer._logger);
            clonedElement.classList.remove(...classes);
            renderFunctions.push(() => {
                const canvas = texture.image;
                const context = canvas.getContext('2d');
                context.clearRect(0, 0, canvas.width, canvas.height);
                const renderer = new Renderer_1.default(new CanvasRenderer_1.default(canvas), renderOptions);
                renderer.render(stack);
                this._updateTexture(canvas, state);
            });
        }
        const boundingRect = this.boundingRect;
        this._showChildLayers(clonedDocument);
        const fontMetrics = new Font_1.FontMetrics(clonedDocument);
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
        if (this.needsRemoval)
            return;
        if (getComputedStyle(this.element).display === 'none')
            return;
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
        const material = this.mesh.material;
        if (material.map && material.map.image === canvas) {
            if (!canvas.width || !canvas.height) {
                material.map = null;
                material.needsUpdate = true;
                this.mesh.visible = false;
            }
        }
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
        const hover = this.hover ? ' hover' : '';
        const texture = this.textures[this.state + hover] || this.textures['default' + hover];
        const material = mesh.material;
        if (!texture.image.width || !texture.image.height) {
            material.map = null;
            material.needsUpdate = true;
        }
        else if (material.map !== texture) {
            material.map = texture;
            material.needsUpdate = true;
        }
        mesh.renderOrder = this.level;
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
WebLayer3D._UPDATE_INTERACTION = function (layer, interactions) {
    const interaction = interactions.get(layer);
    if (interaction) {
        layer._hover = true;
        layer.cursor.position.copy(interaction.point);
        layer.worldToLocal(layer.cursor.position);
        layer.add(layer.cursor);
        layer._updateMesh();
    }
    else {
        layer._hover = false;
        layer.remove(layer.cursor);
        layer._updateMesh();
    }
};
exports.default = WebLayer3D;
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
    container.style.width = options && 'windowWidth' in options ? options.windowWidth + 'px' : '550px';
    container.style.height =
        options && 'windowHeight' in options ? options.windowHeight + 'px' : '150px';
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
//# sourceMappingURL=three-web-layer.js.map