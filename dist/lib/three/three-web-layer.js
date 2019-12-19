"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const THREE = require("three");
const ethereal = require("ethereal");
// import ResizeObserver from 'resize-observer-polyfill'
// import { NodeParser } from '@speigg/html2canvas/dist/npm/NodeParser'
// import Logger from '@speigg/html2canvas/dist/npm/Logger'
// import CanvasRenderer from '@speigg/html2canvas/dist/npm/renderer/CanvasRenderer'
// import Renderer from '@speigg/html2canvas/dist/npm/Renderer'
// import ResourceLoader from '@speigg/html2canvas/dist/npm/ResourceLoader'
// import { FontMetrics } from '@speigg/html2canvas/dist/npm/Font'
// import {CanvasRenderer as XCanvasRenderer} from 'html2canvas/dist/lib/render/canvas/canvas-renderer'
const web_renderer_1 = require("../web-renderer");
const domUtils = require("../dom-utils");
const scratchVector = new THREE.Vector3();
const scratchVector2 = new THREE.Vector3();
const microtask = Promise.resolve();
const scratchBounds = new domUtils.Bounds();
const scratchBounds2 = new domUtils.Bounds();
class WebLayer3DBase extends THREE.Object3D {
    constructor(element, options = {}) {
        super();
        this.element = element;
        this.options = options;
        this._webLayer = web_renderer_1.WebRenderer.getClosestLayer(this.element);
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
        return web_renderer_1.WebRenderer.containsHover(this.element);
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
        web_renderer_1.WebRenderer.disposeLayer(this._webLayer);
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
            : domUtils.getViewportBounds(scratchBounds);
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
exports.WebLayer3DBase = WebLayer3DBase;
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
        this._webLayer = web_renderer_1.WebRenderer.createLayerTree(element, (event, { target }) => {
            if (event === 'layercreated') {
                if (target === this.element)
                    return;
                const layer = new WebLayer3DBase(target, this.options);
                layer.parentLayer.add(layer);
                if (this.options.onLayerCreate)
                    this.options.onLayerCreate(layer);
            }
            else if (event === 'layerpainted') {
                const layer = web_renderer_1.WebRenderer.layers.get(target);
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
        web_renderer_1.WebRenderer.hoverTargetElements.clear();
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
                        web_renderer_1.WebRenderer.hoverTargetElements.add(layer.element);
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
        await microtask;
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
            const layerBoundingRect = domUtils.getBounds(layer.element, scratchBounds);
            if (!layerBoundingRect.width || !layerBoundingRect.height)
                continue;
            let target = layer.element;
            const clientX = intersection.uv.x * layerBoundingRect.width;
            const clientY = (1 - intersection.uv.y) * layerBoundingRect.height;
            domUtils.traverseChildElements(layer.element, el => {
                if (!target.contains(el))
                    return false;
                const elementBoundingRect = domUtils.getBounds(el, scratchBounds2);
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
exports.WebLayer3D = WebLayer3D;
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