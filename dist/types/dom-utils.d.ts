export declare function path(el: HTMLElement, rootNode?: HTMLElement): any;
export declare function hash(el: HTMLElement): void;
export declare function traverseChildElements(node: Node, each: (node: Element, level: number) => boolean, bind?: any, level?: number): void;
export declare function addCSSRule(sheet: any, selector: any, rules: any, index: any): void;
export declare class Bounds {
    left: number;
    top: number;
    width: number;
    height: number;
    copy(rect: Bounds): this;
}
export declare class Edges {
    left: number;
    top: number;
    right: number;
    bottom: number;
    copy(rect: Edges): this;
}
export declare function getBounds(element: Element, bounds?: Bounds, referenceElement?: Element): Bounds;
export declare function getMargin(element: Element, margin: Edges): void;
export declare function getBorder(element: Element, border: Edges): void;
export declare function getPadding(element: Element, padding: Edges): void;
export declare function getViewportBounds(bounds: Bounds): Bounds;
export declare function getDocumentBounds(document: Document, bounds: Bounds): Bounds;
