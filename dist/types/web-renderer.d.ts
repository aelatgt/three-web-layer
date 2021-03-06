import ResizeObserver from 'resize-observer-polyfill';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Bounds, Edges } from './dom-utils';
import { LRUMap } from 'lru_map';
declare type EventCallback = (event: 'layerpainted' | 'layerresized' | 'layercreated' | 'parentchanged' | 'removalrequired' | 'inputrequired', data: {
    target: Element;
}) => void;
export declare class WebLayer {
    element: Element;
    eventCallback: EventCallback;
    static DEFAULT_CACHE_SIZE: number;
    static canvasHashes: LRUMap<string, string>;
    static cachedCanvases: LRUMap<string, HTMLCanvasElement>;
    private static _nextID;
    id: number;
    constructor(element: Element, eventCallback: EventCallback);
    needsRefresh: boolean;
    needsRemoval: boolean;
    svg: HTMLImageElement;
    bounds: Bounds;
    private _previousBounds;
    private padding;
    private margin;
    private border;
    parentLayer?: WebLayer;
    childLayers: WebLayer[];
    pixelRatio?: number;
    cssTransform: Matrix4;
    cachedBounds: Map<string, Bounds>;
    cachedMargin: Map<string, Edges>;
    private _dynamicAttributes;
    private _svgDocument;
    private _svgSrc;
    private _hashingCanvas;
    _canvas: HTMLCanvasElement;
    set canvas(val: HTMLCanvasElement);
    get canvas(): HTMLCanvasElement;
    get depth(): number;
    get rootLayer(): WebLayer;
    traverseParentLayers<T extends any[]>(each: (layer: WebLayer, ...params: T) => void, ...params: T): void;
    traverseLayers<T extends any[]>(each: (layer: WebLayer, ...params: T) => void, ...params: T): void;
    traverseChildLayers<T extends any[]>(each: (layer: WebLayer, ...params: T) => void, ...params: T): void;
    private static _setNeedsRefresh;
    refresh(): void;
    private _refreshParentAndChildLayers;
    private _tryConvertElementToWebLayer;
    serialize(): Promise<void>;
    rasterize(): Promise<unknown>;
    render(): void;
    private _getParentsHTML;
}
export declare class WebRenderer {
    static LAYER_ATTRIBUTE: string;
    static CONTAINER_ATTRIBUTE: string;
    static RENDERING_ATTRIBUTE: string;
    static PIXEL_RATIO_ATTRIBUTE: string;
    static RENDERING_DOCUMENT_ATTRIBUTE: string;
    static serializer: XMLSerializer;
    static rootLayers: Map<Element, WebLayer>;
    static layers: Map<Element, WebLayer>;
    static mutationObservers: Map<Element, MutationObserver>;
    static resizeObservers: Map<Element, ResizeObserver>;
    static serializeQueue: WebLayer[];
    static rasterizeQueue: WebLayer[];
    static renderQueue: WebLayer[];
    static hoverTargetElements: Set<Element>;
    static focusElement: any;
    static activeElement: any;
    static targetElement: any;
    static _didInit: boolean;
    static _init(): void;
    static addToSerializeQueue(layer: WebLayer): void;
    static addToRasterizeQueue(layer: WebLayer): void;
    static addToRenderQueue(layer: WebLayer): void;
    static TASK_SERIALIZE_MAX_TIME: number;
    static TASK_RASTERIZE_MAX_TIME: number;
    static TASK_RASTERIZE_MAX_SIMULTANEOUS: number;
    static TASK_RENDER_MAX_TIME: number;
    static rasterizeTaskCount: number;
    static scheduleTasks(): Promise<void>;
    static setLayerNeedsUpdate(layer: WebLayer): void;
    static createLayerTree(element: Element, eventCallback: EventCallback): WebLayer;
    static disposeLayer(layer: WebLayer): void;
    static getClosestLayer(element: Element): WebLayer | undefined;
    static getCSSTransformForElement(element: Element, out?: Matrix4): Matrix4;
    static embedExternalResources(element: Element): Promise<any[]>;
    static pauseMutationObservers(): void;
    static resumeMutationObservers(): void;
    private static startMutationObserver;
    static handleMutations: (records: MutationRecord[]) => void;
    private static _triggerRefresh;
    private static _addDynamicPseudoClassRulesToPage;
    static arrayBufferToBase64(bytes: any): string;
    static generateEmbeddedCSS(url: any, css: any): Promise<string>;
    static getURL(url: any): Promise<XMLHttpRequest>;
    private static _embeddedPageCSS;
    static getEmbeddedPageCSS(): Promise<string[]>;
    static getDataURL(url: any): Promise<string>;
    static updateInputAttributes(element: Element): void;
    static _updateInputAttribute(inputElement: HTMLInputElement): void;
    static setFocus(ele: HTMLElement): void;
    static setBlur(): void;
    static containsHover(element: Element): boolean;
    static getDynamicAttributes(element: Element): string;
}
export {};
