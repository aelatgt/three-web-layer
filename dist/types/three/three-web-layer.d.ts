import * as THREE from 'three';
import * as ethereal from 'ethereal';
import * as domUtils from '../dom-utils';
export interface WebLayer3DOptions {
    pixelRatio?: number;
    layerSeparation?: number;
    autoRefresh?: boolean;
    onLayerCreate?(layer: WebLayer3DBase): void;
    onAfterRasterize?(layer: WebLayer3DBase): void;
}
export declare type WebLayerHit = ReturnType<typeof WebLayer3D.prototype.hitTest> & {};
export declare class WebLayer3DBase extends THREE.Object3D {
    element: Element;
    options: WebLayer3DOptions;
    constructor(element: Element, options?: WebLayer3DOptions);
    protected _webLayer: import("../web-renderer").WebLayer;
    textures: Map<HTMLElement, THREE.Texture>;
    get currentTexture(): THREE.Texture;
    content: THREE.Object3D;
    contentMesh: THREE.Mesh;
    cursor: THREE.Object3D;
    depthMaterial: THREE.MeshDepthMaterial;
    target: THREE.Object3D;
    contentTarget: THREE.Object3D;
    contentOpacity: ethereal.Transitionable<0>;
    get needsRefresh(): boolean;
    set needsRefresh(value: boolean);
    get textureSource(): HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
    /**
     * Get the hover state
     */
    get hover(): boolean;
    /**
     * Get the layer depth (distance from this layer's element and the parent layer's element)
     */
    get depth(): number;
    /**
     *
     */
    get index(): number;
    /** If true, this layer needs to be removed from the scene */
    get needsRemoval(): boolean;
    get bounds(): domUtils.Bounds;
    get parentLayer(): WebLayer3DBase | undefined;
    childLayers: WebLayer3DBase[];
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
    shouldApplyTargetLayout: true | false | 'auto';
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
    shouldApplyContentTargetLayout: boolean;
    private _lastTargetPosition;
    private _lastContentTargetScale;
    refresh(forceRefresh?: boolean): void;
    querySelector(selector: string): WebLayer3DBase | undefined;
    traverseParentLayers<T extends any[]>(each: (layer: WebLayer3DBase, ...params: T) => void, ...params: T): void;
    traverseLayers<T extends any[]>(each: (layer: WebLayer3DBase, ...params: T) => void, ...params: T): void;
    traverseChildLayers<T extends any[]>(each: (layer: WebLayer3DBase, ...params: T) => void, ...params: T): T;
    dispose(): void;
    private _refreshVideoBounds;
    private _refreshTargetLayout;
    private _refreshMesh;
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
export declare class WebLayer3D extends WebLayer3DBase {
    element: Element;
    options: WebLayer3DOptions;
    static domUtils: typeof domUtils;
    static layersByElement: WeakMap<Element, WebLayer3DBase>;
    static layersByMesh: WeakMap<THREE.Mesh, WebLayer3DBase>;
    static DEBUG_PERFORMANCE: boolean;
    static LAYER_ATTRIBUTE: string;
    static PIXEL_RATIO_ATTRIBUTE: string;
    static STATES_ATTRIBUTE: string;
    static HOVER_DEPTH_ATTRIBUTE: string;
    private static DISABLE_TRANSFORMS_ATTRIBUTE;
    static DEFAULT_LAYER_SEPARATION: number;
    static DEFAULT_PIXELS_PER_UNIT: number;
    static GEOMETRY: THREE.Geometry;
    static computeNaturalDistance(projection: THREE.Matrix4 | THREE.Camera, renderer: THREE.WebGLRenderer): number;
    static UPDATE_DEFAULT: (layer: WebLayer3DBase, deltaTime?: number) => void;
    static shouldApplyTargetLayout(layer: WebLayer3DBase): boolean;
    static hoverLayers: Set<WebLayer3DBase>;
    private static _updateInteractions;
    private static _scheduleRefresh;
    private static _clearHover;
    private static _setHoverClass;
    private _interactionRays;
    private _raycaster;
    private _hitIntersections;
    constructor(element: Element, options?: WebLayer3DOptions);
    /**
     * A list of Rays to be used for interaction.
     * Can only be set on a root WebLayer3D instance.
     * @param rays
     */
    set interactionRays(rays: Array<THREE.Ray | THREE.Object3D>);
    get interactionRays(): Array<THREE.Ray | THREE.Object3D>;
    /**
     * Update the pose and opacity of this layer (does not rerender the DOM).
     * This should be called each frame, and can only be called on a root WebLayer3D instance.
     *
     * @param lerp lerp value
     * @param updateCallback update callback called for each layer. Default is WebLayer3D.UDPATE_DEFAULT
     */
    update(lerp?: number, updateCallback?: (layer: WebLayer3D, lerp: number) => void): void;
    static getLayerForQuery(selector: string): WebLayer3DBase | undefined;
    static getClosestLayerForElement(element: Element): WebLayer3DBase | undefined;
    hitTest(ray: THREE.Ray): {
        layer: WebLayer3DBase;
        intersection: THREE.Intersection;
        target: HTMLElement;
    };
}
