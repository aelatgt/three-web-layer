import * as THREE from 'three';
import 'babel-polyfill';
export interface WebLayer3DOptions {
    pixelRatio?: number;
    layerSeparation?: number;
    windowWidth?: number;
    windowHeight?: number;
    allowTaint?: boolean;
    onLayerCreate?(layer: WebLayer3D): void;
}
export declare type WebLayerHit = ReturnType<typeof WebLayer3D.prototype.hitTest> & {};
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
export default class WebLayer3D extends THREE.Object3D {
    options: WebLayer3DOptions;
    rootLayer: WebLayer3D;
    private _level;
    static LAYER_ATTRIBUTE: string;
    static LAYER_CONTAINER_ATTRIBUTE: string;
    static PIXEL_RATIO_ATTRIBUTE: string;
    static STATES_ATTRIBUTE: string;
    private static DISABLE_TRANSFORMS_ATTRIBUTE;
    static DEFAULT_LAYER_SEPARATION: number;
    static DEFAULT_PIXEL_DIMENSIONS: number;
    static GEOMETRY: THREE.Geometry;
    static TRANSITION_DEFAULT: (layer: WebLayer3D, alpha?: number) => void;
    static transitionLayout(layer: WebLayer3D, alpha: number): void;
    static transitionVisibility(layer: WebLayer3D, alpha: number): void;
    private static _updateInteraction;
    private static _didInstallStyleSheet;
    element: HTMLElement;
    content: THREE.Object3D;
    textures: {
        [state: string]: THREE.Texture;
    };
    mesh: THREE.Mesh;
    depthMaterial: THREE.MeshDepthMaterial;
    childLayers: WebLayer3D[];
    targetContentPosition: THREE.Vector3;
    targetContentScale: THREE.Vector3;
    boundingRect: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    cursor: THREE.Object3D;
    needsRefresh: boolean;
    private _lastTargetContentPosition;
    private _lastTargetContentScale;
    private _isRefreshing;
    private _isUpdating;
    private _needsRemoval;
    private _needsHiding;
    private _hover;
    private _states;
    private _pixelRatio;
    private _state;
    private _raycaster;
    private _hitIntersections;
    private _mutationObserver?;
    private _resizeObserver?;
    private _resourceLoader?;
    private _fontMetrics?;
    private _logger?;
    private _meshMap;
    private _interactionRays?;
    private _interactionMap;
    private _triggerRefresh?;
    private _processMutations?;
    constructor(element: Element, options?: WebLayer3DOptions, rootLayer?: WebLayer3D, _level?: number);
    /**
     * Change the texture state.
     * Note: if a state is not available, the `default` state will be rendered.
     */
    state: string;
    /**
     * A list of Rays to be used for interaction.
     * Can only be set on a root WebLayer3D instance.
     * @param rays
     */
    interactionRays: THREE.Ray[] | undefined | null;
    /**
     * Get the hover state
     */
    readonly hover: boolean;
    /**
     * Get the layer level
     */
    readonly level: number;
    /** If true, this layer needs to be removed from the scene */
    readonly needsRemoval: boolean;
    readonly needsHiding: boolean;
    /**
     * Update the pose and opacity of this layer (does not rerender the DOM).
     * This should be called each frame, and can only be called on a root WebLayer3D instance.
     *
     * @param alpha lerp value
     * @param children if true, also update child layers. Default is true.
     * @param transition transition function. Default is WebLayer3D.TRANSITION_DEFAULT
     */
    update(alpha?: number, transition?: (layer: WebLayer3D, alpha: number) => void): void;
    traverseLayers<T extends any[]>(each: (layer: WebLayer3D, ...params: T) => void, ...params: T): void;
    traverseChildLayers<T extends any[]>(each: (layer: WebLayer3D, ...params: T) => void, ...params: T): T;
    getLayerForQuery(selector: string): WebLayer3D | undefined;
    getLayerForElement(element: Element): WebLayer3D | undefined;
    hitTest(ray: THREE.Ray): {
        layer: WebLayer3D;
        intersection: import("three/src/core/Raycaster").Intersection;
        target: HTMLElement;
    } | undefined;
    refresh(force?: boolean): Promise<void>;
    dispose(): void;
    private _updateState;
    private _checkRoot;
    private _updateDefaultLayout;
    private _updateMesh;
    private _updateInteractions;
    private _showChildLayers;
    private _disableTransforms;
    private _markForRemoval;
    private _updateChildLayers;
    private _tryConvertToWebLayer3D;
    private _renderTextures;
}
