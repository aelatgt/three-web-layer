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
export default class WebLayer3D extends THREE.Object3D {
    options: WebLayer3DOptions;
    rootLayer: WebLayer3D;
    level: number;
    static LAYER_ATTRIBUTE: string;
    static UID_ATTRIBUTE: string;
    static LAYER_CONTAINER_ATTRIBUTE: string;
    static PIXEL_RATIO_ATTRIBUTE: string;
    static STATES_ATTRIBUTE: string;
    static DEFAULT_LAYER_SEPARATION: number;
    static DEFAULT_PIXEL_DIMENSIONS: number;
    static GEOMETRY: THREE.Geometry;
    static TRANSITION_DEFAULT: (layer: WebLayer3D, alpha: number) => void;
    private static _UPDATE_INTERACTION;
    element: HTMLElement;
    content: THREE.Object3D;
    textures: {
        [state: string]: THREE.Texture;
    };
    mesh: THREE.Mesh;
    childLayers: WebLayer3D[];
    boundingRect: DOMRect;
    defaultContentPosition: THREE.Vector3;
    defaultContentScale: THREE.Vector3;
    cursor: THREE.Object3D;
    private _hover;
    private _needsRemoval;
    private _states;
    private _pixelRatio;
    private _state;
    private _resizeObserver;
    private _raycaster;
    private _hitIntersections;
    private _mutationObserver?;
    private _clonedDocument?;
    private _clonedDocumentPromise?;
    private _resourceLoader?;
    private _logger?;
    private _meshMap;
    private _interactionRays?;
    private _interactionMap;
    constructor(element: Element, options?: WebLayer3DOptions, rootLayer?: WebLayer3D, level?: number);
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
    /** If true, this layer needs to be removed from the scene */
    readonly needsRemoval: boolean;
    /**
     * Update the pose and opacity of this layer (does not rerender the DOM).
     * This should be called each frame, and can only be called on a root WebLayer3D instance.
     *
     * @param alpha lerp value
     * @param transition transition function (by default, this is WebLayer3D.TRANSITION_DEFAULT)
     * @param children if true, also update child layers
     */
    update(alpha?: number, transition?: (layer: WebLayer3D, alpha: number) => void, children?: boolean): void;
    transitionLayout(alpha: number): void;
    transitionEntryExit(alpha: number): void;
    traverseLayers<T extends any[]>(each: (layer: WebLayer3D, ...params: T) => void, ...params: T): void;
    traverseChildLayers<T extends any[]>(each: (layer: WebLayer3D, ...params: T) => void, ...params: T): T;
    getLayerForQuery(selector: string): WebLayer3D | undefined;
    getLayerForElement(element: Element): WebLayer3D | undefined;
    getLayerForRay(ray: THREE.Ray): WebLayer3D | undefined;
    refresh(forceClone?: boolean): Promise<void>;
    dispose(): void;
    private _checkRoot;
    private _updateInteractions;
    private _hideChildLayers;
    private _showChildLayers;
    private _markForRemoval;
    private _updateChildLayers;
    private _tryConvertToWebLayer3D;
    private _renderTextures;
    private _updateBoundingRect;
    private _updateTexture;
    _updateTargetInClonedDocument(target: HTMLElement, updateTextContent?: boolean): boolean;
    private _getUniqueSelector;
    private _getClonedElement;
    private _updateMesh;
}
