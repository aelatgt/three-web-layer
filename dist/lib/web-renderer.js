"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resize_observer_polyfill_1 = require("resize-observer-polyfill");
const Matrix4_1 = require("three/src/math/Matrix4");
const Vector3_1 = require("three/src/math/Vector3");
const dom_utils_1 = require("./dom-utils");
const lru_map_1 = require("lru_map");
const sha256 = require("fast-sha256");
function ensureElementIsInDocument(element) {
    const document = element.ownerDocument;
    if (document.contains(element)) {
        return element;
    }
    const container = document.createElement('div');
    container.setAttribute(WebRenderer.CONTAINER_ATTRIBUTE, '');
    container.style.position = 'fixed';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.top = '-100000px';
    container.style['contain'] = 'strict';
    container.appendChild(element);
    document.documentElement.appendChild(container);
    // document.body.appendChild(container)
    return element;
}
const scratchMat1 = new Matrix4_1.Matrix4();
const scratchMat2 = new Matrix4_1.Matrix4();
const textDecoder = new TextDecoder();
const microtask = Promise.resolve();
class WebLayer {
    constructor(element, eventCallback) {
        this.element = element;
        this.eventCallback = eventCallback;
        this.id = WebLayer._nextID++;
        this.cachedBounds = new Map();
        this.cachedMargin = new Map();
        this.needsRefresh = true;
        this.needsRemoval = false;
        this.svg = new Image();
        this.bounds = new dom_utils_1.Bounds();
        this.padding = new dom_utils_1.Edges();
        this.margin = new dom_utils_1.Edges();
        this.border = new dom_utils_1.Edges();
        this.childLayers = [];
        this.cssTransform = new Matrix4_1.Matrix4();
        this._svgDocument = '';
        this._svgSrc = '';
        this._hashingCanvas = document.createElement('canvas');
        WebRenderer.layers.set(element, this);
        element.setAttribute(WebRenderer.LAYER_ATTRIBUTE, '' + this.id);
        this.parentLayer = WebRenderer.getLayerForElement(this.element.parentElement);
        this.eventCallback('layercreated', { target: element });
        WebLayer.cachedCanvases.limit = WebRenderer.layers.size * WebLayer.DEFAULT_CACHE_SIZE;
    }
    set canvas(val) {
        if (this._canvas !== val) {
            this._canvas = val;
            if (this.eventCallback)
                this.eventCallback('layerpainted', { target: this.element });
        }
    }
    get canvas() {
        return this._canvas;
    }
    get depth() {
        const parentLayer = this.parentLayer;
        let depth = 0;
        if (parentLayer) {
            let el = this.element;
            while (el !== parentLayer.element) {
                el = el.parentElement;
                depth++;
            }
        }
        return depth;
    }
    get rootLayer() {
        let rootLayer = this;
        while (rootLayer.parentLayer)
            rootLayer = rootLayer.parentLayer;
        return rootLayer;
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
    }
    refresh(forceRefresh = true) {
        dom_utils_1.getBounds(this.element, this.bounds, this.parentLayer && this.parentLayer.element);
        if (this.needsRefresh || forceRefresh) {
            this._refreshParentAndChildLayers();
            WebRenderer.addToSerializeQueue(this);
        }
        if (!this.parentLayer) {
            WebRenderer.scheduleTasks();
        }
    }
    _refreshParentAndChildLayers() {
        const element = this.element;
        const childLayers = this.childLayers;
        const oldChildLayers = childLayers.slice();
        const previousParentLayer = this.parentLayer;
        this.parentLayer = WebRenderer.getLayerForElement(this.element.parentElement);
        if (previousParentLayer !== this.parentLayer) {
            this.parentLayer && this.parentLayer.childLayers.push(this);
            this.eventCallback('parentchanged', { target: element });
        }
        childLayers.length = 0;
        dom_utils_1.traverseChildElements(element, this._tryConvertElementToWebLayer, this);
        for (const child of oldChildLayers) {
            const parentLayer = WebRenderer.getLayerForElement(child.element.parentElement);
            if (!parentLayer) {
                child.needsRemoval = true;
                childLayers.push(child);
            }
        }
    }
    _tryConvertElementToWebLayer(el) {
        const styles = getComputedStyle(el);
        const id = el.getAttribute(WebRenderer.LAYER_ATTRIBUTE);
        if (id !== null || el.nodeName === 'VIDEO' || styles.transform !== 'none') {
            let child = WebRenderer.layers.get(el);
            if (!child) {
                child = new WebLayer(el, this.eventCallback);
            }
            child.needsRemoval = this.needsRemoval;
            this.childLayers.push(child);
            return false; // stop traversing this subtree
        }
        return true;
    }
    async serialize() {
        if (this.element.nodeName === 'VIDEO')
            return;
        this.needsRefresh = false;
        const [svgPageCSS] = await Promise.all([
            WebRenderer.getEmbeddedPageCSS(),
            WebRenderer.embedExternalResources(this.element)
        ]);
        let { width, height } = this.bounds;
        if (width * height > 0) {
            dom_utils_1.getPadding(this.element, this.padding);
            dom_utils_1.getMargin(this.element, this.margin);
            dom_utils_1.getBorder(this.element, this.border);
            // add margins
            width += Math.max(this.margin.left, 0) + Math.max(this.margin.right, 0);
            height += Math.max(this.margin.top, 0) + Math.max(this.margin.bottom, 0);
            // width += Math.max(this.border.left,0) + Math.max(this.border.right,0)
            // height += Math.max(this.border.top,0) + Math.max(this.border.bottom,0)
            // create svg markup
            const layerAttribute = `data-layer="${this.id}"`;
            const layerElement = this.element;
            const needsInlineBlock = getComputedStyle(layerElement).display === 'inline';
            const layerHTML = WebRenderer.serializer
                .serializeToString(layerElement)
                .replace(layerAttribute, 'data-layer="" ' +
                WebRenderer.RENDERING_ATTRIBUTE +
                '="" ' +
                (needsInlineBlock ? 'data-layer-rendering-inline="" ' : ''));
            const parentsHTML = this._getParentsHTML(layerElement);
            parentsHTML[0] = parentsHTML[0].replace('html', 'html ' + WebRenderer.RENDERING_DOCUMENT_ATTRIBUTE + '="" ');
            const docString = '<svg width="' +
                width +
                '" height="' +
                height +
                '" xmlns="http://www.w3.org/2000/svg"><defs><style type="text/css"><![CDATA[a[href]{color:#0000EE;text-decoration:underline;}' +
                svgPageCSS.join('') +
                ']]></style></defs><foreignObject x="0" y="0" width="' +
                width +
                '" height="' +
                height +
                '">' +
                parentsHTML[0] +
                layerHTML +
                parentsHTML[1] +
                '</foreignObject></svg>';
            this._svgDocument = docString;
            const svgSrc = (this._svgSrc = 'data:image/svg+xml;utf8,' + encodeURIComponent(docString));
            // check for existing canvas
            const canvasHash = WebLayer.canvasHashes.get(svgSrc);
            if (canvasHash && WebLayer.cachedCanvases.has(canvasHash)) {
                this.canvas = WebLayer.cachedCanvases.get(canvasHash);
                return;
            }
            // rasterize the svg document if no existing canvas matches
            this.cachedBounds.set(svgSrc, new dom_utils_1.Bounds().copy(this.bounds));
            this.cachedMargin.set(svgSrc, new dom_utils_1.Edges().copy(this.margin));
            WebRenderer.addToRasterizeQueue(this);
        }
    }
    async rasterize() {
        return new Promise(resolve => {
            this.svg.onload = () => {
                WebRenderer.addToRenderQueue(this);
                resolve();
            };
            this.svg.src = this._svgSrc;
            if (this.svg.complete && this.svg.currentSrc === this.svg.src) {
                WebRenderer.addToRenderQueue(this);
                this.svg.onload = undefined;
                resolve();
            }
        });
    }
    render() {
        const src = this.svg.currentSrc;
        if (!this.svg.complete || !this.cachedBounds.has(src) || !this.cachedMargin.has(src)) {
            this.needsRefresh = true;
            return;
        }
        let { width, height } = this.cachedBounds.get(src);
        let { left, top } = this.cachedMargin.get(src);
        const hashingCanvas = this._hashingCanvas;
        let hw = (hashingCanvas.width = Math.max(width * 0.05, 40));
        let hh = (hashingCanvas.height = Math.max(height * 0.05, 40));
        const hctx = hashingCanvas.getContext('2d');
        hctx.clearRect(0, 0, hw, hh);
        hctx.drawImage(this.svg, left, top, width, height, 0, 0, hw, hh);
        const hashData = hctx.getImageData(0, 0, hw, hh).data;
        const newHash = WebRenderer.arrayBufferToBase64(sha256.hash(new Uint8Array(hashData))) +
            '?w=' +
            width +
            ';h=' +
            height;
        WebLayer.canvasHashes.set(src, newHash);
        if (WebLayer.cachedCanvases.has(newHash)) {
            this.canvas = WebLayer.cachedCanvases.get(newHash);
            return;
        }
        const pixelRatio = this.pixelRatio ||
            parseFloat(this.element.getAttribute(WebRenderer.PIXEL_RATIO_ATTRIBUTE)) ||
            window.devicePixelRatio;
        const newCanvas = WebLayer.cachedCanvases.size === WebLayer.cachedCanvases.limit
            ? WebLayer.cachedCanvases.shift()[1]
            : document.createElement('canvas');
        let w = (newCanvas.width = width * pixelRatio);
        let h = (newCanvas.height = height * pixelRatio);
        const ctx = newCanvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(this.svg, left, top, width, height, 0, 0, w, h);
        WebLayer.cachedCanvases.set(newHash, newCanvas);
        this.canvas = newCanvas;
    }
    // Get all parents of the embeded html as these can effect the resulting styles
    _getParentsHTML(element) {
        const opens = [];
        const closes = [];
        let parent = element.parentElement;
        do {
            let tag = parent.tagName.toLowerCase();
            let attributes = ' ';
            for (const a of parent.attributes) {
                if (a.name === 'style')
                    continue;
                if (a.name === 'data-layer') {
                    attributes += 'data-layer="" '; // remove layer id to increase cache hits for similar element heirarchies
                    continue;
                }
                attributes += `${a.name}="${a.value}" `;
            }
            const open = '<' +
                tag +
                (tag === 'html'
                    ? ` xmlns="http://www.w3.org/1999/xhtml" style="--x-width:${this.bounds.width +
                        0.5}px;--x-height:${this.bounds.height}px;--x-inline-top:${this.border.top +
                        this.margin.top +
                        this.padding.top}px" `
                    : '') +
                attributes +
                ' data-layer-rendering-parent="" >';
            opens.unshift(open);
            const close = '</' + tag + '>';
            closes.push(close);
            if (tag == 'html')
                break;
        } while ((parent = parent.parentElement));
        return [opens.join(''), closes.join('')];
    }
}
exports.WebLayer = WebLayer;
WebLayer.DEFAULT_CACHE_SIZE = 4;
WebLayer.canvasHashes = new lru_map_1.LRUMap(1000);
WebLayer.cachedCanvases = new lru_map_1.LRUMap(WebLayer.DEFAULT_CACHE_SIZE);
WebLayer._nextID = 0;
class WebRenderer {
    static _init() {
        if (this._didInit)
            return;
        this._didInit = true;
        // const inputStyles = document.createElement("style")
        // inputStyles.innerHTML = "input, select,textarea{border: 1px solid #000000;margin: 0;background-color: #ffffff;-webkit-appearance: none;}:-webkit-autofill {color: #fff !important;}input[type='checkbox']{width: 20px;height: 20px;display: inline-block;}input[type='radio']{width: 20px;height: 20px;display: inline-block;border-radius: 50%;}input[type='checkbox'][checked],input[type='radio'][checked]{background-color: #555555;}"
        // document.head.insertBefore(inputStyles, document.head.firstChild)
        const style = document.createElement('style');
        document.head.append(style);
        const sheet = style.sheet;
        let i = 0;
        dom_utils_1.addCSSRule(sheet, `[${WebRenderer.RENDERING_DOCUMENT_ATTRIBUTE}] *`, 'transform: none !important;', i++);
        dom_utils_1.addCSSRule(sheet, `[${WebRenderer.RENDERING_ATTRIBUTE}], [${WebRenderer.RENDERING_ATTRIBUTE}] *`, 'visibility: visible !important;', i++);
        dom_utils_1.addCSSRule(sheet, `[${WebRenderer.RENDERING_ATTRIBUTE}] [${WebRenderer.LAYER_ATTRIBUTE}], [${WebRenderer.RENDERING_ATTRIBUTE}] [${WebRenderer.LAYER_ATTRIBUTE}] *`, 'visibility: hidden !important;', i++);
        dom_utils_1.addCSSRule(sheet, `[${WebRenderer.RENDERING_ATTRIBUTE}]`, 'position: relative; top: 0 !important; left: 0 !important; float: none; box-sizing:border-box; width:var(--x-width); height:var(--x-height);', i++);
        dom_utils_1.addCSSRule(sheet, `[data-layer-rendering-inline]`, 'top: var(--x-inline-top) !important; width:auto !important', i++);
        dom_utils_1.addCSSRule(sheet, `[data-layer-rendering-parent]`, 'transform: none;left: 0;top: 0;margin: 0;border:0;border-radius:0;height:100%;padding:0;position:static;text-align:left;display:block;background:rgba(0,0,0,0);box-shadow:none', i++);
        dom_utils_1.addCSSRule(sheet, `[data-layer-rendering-parent]::before, [data-layer-rendering-parent]::after`, 'content:none; box-shadow:none;', i++);
        let previousHash = '';
        const onHashChange = () => {
            if (previousHash != window.location.hash) {
                var currentTarget = document.querySelector('.x-target');
                if (currentTarget) {
                    currentTarget.classList.remove('x-target');
                }
                if (window.location.hash) {
                    try {
                        var newTarget = document.querySelector(window.location.hash);
                        if (newTarget) {
                            newTarget.classList.add('x-target');
                        }
                    }
                    catch { }
                }
            }
            previousHash = window.location.hash;
        };
        window.addEventListener('hashchange', onHashChange, false);
        onHashChange();
    }
    static addToSerializeQueue(layer) {
        if (this.serializeQueue.indexOf(layer) === -1)
            this.serializeQueue.push(layer);
    }
    static addToRasterizeQueue(layer) {
        if (this.rasterizeQueue.indexOf(layer) === -1)
            this.rasterizeQueue.push(layer);
    }
    static addToRenderQueue(layer) {
        if (this.renderQueue.indexOf(layer) === -1)
            this.renderQueue.push(layer);
    }
    static async scheduleTasks() {
        await microtask;
        const serializeQueue = WebRenderer.serializeQueue;
        const rasterizeQueue = WebRenderer.rasterizeQueue;
        const renderQueue = WebRenderer.renderQueue;
        let startTime = performance.now();
        // while (renderQueue.length && performance.now() - startTime < this.TASK_RENDER_MAX_TIME/2) {
        //     renderQueue.shift()!.render()
        // }
        // startTime = performance.now()
        while (serializeQueue.length && performance.now() - startTime < this.TASK_SERIALIZE_MAX_TIME) {
            serializeQueue.shift().serialize();
        }
        startTime = performance.now();
        while (rasterizeQueue.length &&
            performance.now() - startTime < this.TASK_RASTERIZE_MAX_TIME &&
            this.rasterizeTaskCount < this.TASK_RASTERIZE_MAX_SIMULTANEOUS) {
            this.rasterizeTaskCount++;
            rasterizeQueue
                .shift()
                .rasterize()
                .then(() => {
                this.rasterizeTaskCount--;
            });
        }
        startTime = performance.now();
        while (renderQueue.length && performance.now() - startTime < this.TASK_RENDER_MAX_TIME / 2) {
            renderQueue.shift().render();
        }
    }
    static setLayerNeedsUpdate(layer) {
        layer.needsRefresh = true;
    }
    static createLayerTree(element, eventCallback) {
        if (WebRenderer.getLayerForElement(element))
            throw new Error('A root WebLayer for the given element already exists');
        WebRenderer._init();
        ensureElementIsInDocument(element);
        const observer = new MutationObserver(WebRenderer.handleMutations);
        this.mutationObservers.set(element, observer);
        this.startMutationObserver(element);
        const resizeObserver = new resize_observer_polyfill_1.default(records => {
            for (const record of records) {
                const layer = this.getLayerForElement(record.target);
                layer.needsRefresh = true;
            }
        });
        resizeObserver.observe(element);
        this.resizeObservers.set(element, resizeObserver);
        element.addEventListener('mousemove', this._onmousemove, { capture: true });
        element.addEventListener('input', this._triggerRefresh, { capture: true });
        element.addEventListener('keydown', this._triggerRefresh, { capture: true });
        element.addEventListener('submit', this._triggerRefresh, { capture: true });
        element.addEventListener('change', this._triggerRefresh, { capture: true });
        element.addEventListener('focus', this._triggerRefresh, { capture: true });
        element.addEventListener('blur', this._triggerRefresh, { capture: true });
        element.addEventListener('transitionend', this._triggerRefresh, { capture: true });
        const layer = new WebLayer(element, eventCallback);
        this.rootLayers.set(element, layer);
        return layer;
    }
    static disposeLayer(layer) {
        if (this.rootLayers.has(layer.element)) {
            this.rootLayers.delete(layer.element);
            const observer = this.mutationObservers.get(layer.element);
            observer.disconnect();
            this.mutationObservers.delete(layer.element);
            const resizeObserver = this.resizeObservers.get(layer.element);
            resizeObserver.disconnect();
            this.resizeObservers.delete(layer.element);
            layer.element.removeEventListener('mousemove', this._onmousemove, { capture: true });
            layer.element.removeEventListener('input', this._triggerRefresh, { capture: true });
            layer.element.removeEventListener('change', this._triggerRefresh, { capture: true });
            layer.element.removeEventListener('focus', this._triggerRefresh, { capture: true });
            layer.element.removeEventListener('blur', this._triggerRefresh, { capture: true });
            layer.element.removeEventListener('transitionend', this._triggerRefresh, { capture: true });
        }
    }
    static getLayerForElement(element) {
        const closestLayerElement = element && element.closest(`[${WebRenderer.LAYER_ATTRIBUTE}]`);
        return this.layers.get(closestLayerElement);
    }
    static getCSSTransformForElement(element, out = new Matrix4_1.Matrix4()) {
        const styles = getComputedStyle(element);
        var transformcss = styles['transform'];
        if (transformcss.indexOf('matrix(') == 0) {
            out.identity();
            var mat = transformcss
                .substring(7, transformcss.length - 1)
                .split(', ')
                .map(parseFloat);
            out.elements[0] = mat[0];
            out.elements[1] = mat[1];
            out.elements[4] = mat[2];
            out.elements[5] = mat[3];
            out.elements[12] = mat[4];
            out.elements[13] = mat[5];
        }
        else if (transformcss.indexOf('matrix3d(') == 0) {
            var mat = transformcss
                .substring(9, transformcss.length - 1)
                .split(', ')
                .map(parseFloat);
            out.fromArray(mat);
        }
        else {
            return out.identity();
        }
        var origincss = styles['transform-origin'];
        origincss = origincss.split(' ').map(parseFloat);
        var ox = origincss[0];
        var oy = origincss[1];
        var oz = origincss[2] || 0;
        var T1 = scratchMat1.identity().makeTranslation(-ox, -oy, -oz);
        var T2 = scratchMat2.identity().makeTranslation(ox, oy, oz);
        return out.premultiply(T2).multiply(T1);
    }
    static async embedExternalResources(element) {
        const promises = [];
        const elements = element.querySelectorAll('*');
        for (const element of elements) {
            const link = element.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
            if (link) {
                promises.push(WebRenderer.getDataURL(link).then(dataURL => {
                    element.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
                    element.setAttribute('href', dataURL);
                }));
            }
            const imgElement = element;
            if (element.tagName == 'IMG' && imgElement.src.substr(0, 4) != 'data') {
                promises.push(WebRenderer.getDataURL(imgElement.src).then(dataURL => {
                    element.setAttribute('src', dataURL);
                }));
            }
            if (element.namespaceURI == 'http://www.w3.org/1999/xhtml' && element.hasAttribute('style')) {
                const style = element.getAttribute('style');
                promises.push(WebRenderer.generateEmbeddedCSS(window.location, style).then(css => {
                    if (style != css)
                        element.setAttribute('style', css);
                }));
            }
        }
        const styles = element.querySelectorAll('style');
        for (const style of styles) {
            promises.push(WebRenderer.generateEmbeddedCSS(window.location, style.innerHTML).then(css => {
                if (style.innerHTML != css)
                    style.innerHTML = css;
            }));
        }
        return Promise.all(promises);
    }
    static pauseMutationObservers() {
        const mutationObservers = WebRenderer.mutationObservers.values();
        for (const m of mutationObservers) {
            WebRenderer.handleMutations(m.takeRecords());
            m.disconnect();
        }
    }
    static resumeMutationObservers() {
        for (const [e] of WebRenderer.mutationObservers) {
            this.startMutationObserver(e);
        }
    }
    static startMutationObserver(element) {
        const observer = WebRenderer.mutationObservers.get(element);
        observer.observe(element, {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true,
            characterDataOldValue: true,
            attributeOldValue: true
        });
    }
    static _addDynamicPseudoClassRulesToPage() {
        const sheets = document.styleSheets;
        for (let i = 0; i < sheets.length; i++) {
            try {
                const sheet = sheets[i];
                const rules = sheet.cssRules;
                const newRules = [];
                for (var j = 0; j < rules.length; j++) {
                    if (rules[j].cssText.indexOf(':hover') > -1) {
                        newRules.push(rules[j].cssText.replace(new RegExp(':hover', 'g'), '.x-hover'));
                    }
                    if (rules[j].cssText.indexOf(':active') > -1) {
                        newRules.push(rules[j].cssText.replace(new RegExp(':active', 'g'), '.x-active'));
                    }
                    if (rules[j].cssText.indexOf(':focus') > -1) {
                        newRules.push(rules[j].cssText.replace(new RegExp(':focus', 'g'), '.x-focus'));
                    }
                    if (rules[j].cssText.indexOf(':target') > -1) {
                        newRules.push(rules[j].cssText.replace(new RegExp(':target', 'g'), '.x-target'));
                    }
                    var idx = newRules.indexOf(rules[j].cssText);
                    if (idx > -1) {
                        newRules.splice(idx, 1);
                    }
                }
                for (var j = 0; j < newRules.length; j++) {
                    sheet.insertRule(newRules[j]);
                }
            }
            catch (e) { }
        }
    }
    static arrayBufferToBase64(bytes) {
        var binary = '';
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
    static async generateEmbeddedCSS(url, css) {
        let found;
        const promises = [];
        // Add classes for psuedo-classes
        css = css.replace(new RegExp(':hover', 'g'), '.x-hover');
        css = css.replace(new RegExp(':active', 'g'), '.x-active');
        css = css.replace(new RegExp(':focus', 'g'), '.x-focus');
        css = css.replace(new RegExp(':target', 'g'), '.x-target');
        // Replace all urls in the css
        const regEx = RegExp(/url\((?!['"]?(?:data):)['"]?([^'"\)]*)['"]?\)/gi);
        while ((found = regEx.exec(css))) {
            promises.push(this.getDataURL(new URL(found[1], url)).then(url => {
                css = css.replace(found[1], url);
            }));
        }
        await Promise.all(promises);
        return css;
    }
    static async getURL(url) {
        url = new URL(url, window.location.href).href;
        return new Promise(resolve => {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => {
                resolve(xhr);
            };
            xhr.send();
        });
    }
    static async getEmbeddedPageCSS() {
        const embedded = this._embeddedPageCSS;
        const styleElements = Array.from(document.querySelectorAll("style, link[type='text/css'], link[rel='stylesheet']"));
        let foundNewStyles = false;
        for (const element of styleElements) {
            if (!embedded.has(element)) {
                foundNewStyles = true;
                if (element.tagName == 'STYLE') {
                    const sheet = element.sheet;
                    let cssText = '';
                    for (const rule of sheet.cssRules) {
                        cssText += rule.cssText + '\n';
                    }
                    embedded.set(element, this.generateEmbeddedCSS(window.location, cssText));
                }
                else {
                    embedded.set(element, this.getURL(element.getAttribute('href')).then(xhr => {
                        var css = textDecoder.decode(xhr.response);
                        return this.generateEmbeddedCSS(window.location, css);
                    }));
                }
            }
        }
        if (foundNewStyles)
            this._addDynamicPseudoClassRulesToPage();
        return Promise.all(embedded.values());
    }
    // Generate and returns a dataurl for the given url
    static async getDataURL(url) {
        const xhr = await this.getURL(url);
        const arr = new Uint8Array(xhr.response);
        const contentType = xhr.getResponseHeader('Content-Type').split(';')[0];
        if (contentType == 'text/css') {
            let css = textDecoder.decode(arr);
            css = await this.generateEmbeddedCSS(url, css);
            const base64 = window.btoa(css);
            if (base64.length > 0) {
                return 'data:' + contentType + ';base64,' + base64;
            }
            else {
                return '';
            }
        }
        else {
            return 'data:' + contentType + ';base64,' + this.arrayBufferToBase64(arr);
        }
    }
    // Transforms a point into an elements frame of reference
    static transformPoint(elementStyles, x, y, offsetX, offsetY) {
        // Get the elements tranform matrix
        var transformcss = elementStyles['transform'];
        if (transformcss.indexOf('matrix(') == 0) {
            var transform = new Matrix4_1.Matrix4();
            var mat = transformcss
                .substring(7, transformcss.length - 1)
                .split(', ')
                .map(parseFloat);
            transform.elements[0] = mat[0];
            transform.elements[1] = mat[1];
            transform.elements[4] = mat[2];
            transform.elements[5] = mat[3];
            transform.elements[12] = mat[4];
            transform.elements[13] = mat[5];
        }
        else if (transformcss.indexOf('matrix3d(') == 0) {
            var transform = new Matrix4_1.Matrix4();
            var mat = transformcss
                .substring(9, transformcss.length - 1)
                .split(', ')
                .map(parseFloat);
            transform.elements = mat;
        }
        else {
            return [x, y];
        }
        // Get the elements tranform origin
        var origincss = elementStyles['transform-origin'];
        origincss = origincss
            .replace(new RegExp('px', 'g'), '')
            .split(' ')
            .map(parseFloat);
        // Apply the transform to the origin
        var ox = offsetX + origincss[0];
        var oy = offsetY + origincss[1];
        var oz = 0;
        if (origincss[2])
            oz += origincss[2];
        var T1 = new Matrix4_1.Matrix4().makeTranslation(-ox, -oy, -oz);
        var T2 = new Matrix4_1.Matrix4().makeTranslation(ox, oy, oz);
        transform = T2.multiply(transform).multiply(T1);
        // return if matrix determinate is not zero
        if (transform.determinant() != 0)
            return [x, y];
        // Inverse the transform so we can go from page space to element space
        var inverse = new Matrix4_1.Matrix4().getInverse(transform);
        // Calculate a ray in the direction of the plane
        var v1 = new Vector3_1.Vector3(x, y, 0);
        var v2 = new Vector3_1.Vector3(x, y, -1);
        v1.applyMatrix4(inverse);
        v2.applyMatrix4(inverse);
        var dir = v2.sub(v1).normalize();
        // If ray is parallel to the plane then there is no intersection
        if (dir.z == 0) {
            return false;
        }
        // Get the point of intersection on the element plane
        var result = dir.multiplyScalar(-v1.z / dir.z).add(v1);
        return [result.x, result.y];
    }
    static getBorderRadii(element, style) {
        var properties = [
            'border-top-left-radius',
            'border-top-right-radius',
            'border-bottom-right-radius',
            'border-bottom-left-radius'
        ];
        var result;
        // Parse the css results
        var corners = [];
        for (var i = 0; i < properties.length; i++) {
            var borderRadiusString = style[properties[i]];
            var reExp = /(\d*)([a-z%]{1,3})/gi;
            var rec = [];
            while ((result = reExp.exec(borderRadiusString))) {
                rec.push({
                    value: result[1],
                    unit: result[2]
                });
            }
            if (rec.length == 1)
                rec.push(rec[0]);
            corners.push(rec);
        }
        const unitConv = {
            px: 1,
            '%': element.offsetWidth / 100
        };
        // Convert all corners into pixels
        var pixelCorners = [];
        for (var i = 0; i < corners.length; i++) {
            var corner = corners[i];
            var rec = [];
            for (var j = 0; j < corner.length; j++) {
                rec.push(corner[j].value * unitConv[corner[j].unit]);
            }
            pixelCorners.push(rec);
        }
        // Initial corner point scales
        var c1scale = 1;
        var c2scale = 1;
        var c3scale = 1;
        var c4scale = 1;
        // Change scales of top left and top right corners based on offsetWidth
        var borderTop = pixelCorners[0][0] + pixelCorners[1][0];
        if (borderTop > element.offsetWidth) {
            var f = (1 / borderTop) * element.offsetWidth;
            c1scale = Math.min(c1scale, f);
            c2scale = Math.min(c2scale, f);
        }
        // Change scales of bottom right and top right corners based on offsetHeight
        var borderLeft = pixelCorners[1][1] + pixelCorners[2][1];
        if (borderLeft > element.offsetHeight) {
            f = (1 / borderLeft) * element.offsetHeight;
            c3scale = Math.min(c3scale, f);
            c2scale = Math.min(c2scale, f);
        }
        // Change scales of bottom left and bottom right corners based on offsetWidth
        var borderBottom = pixelCorners[2][0] + pixelCorners[3][0];
        if (borderBottom > element.offsetWidth) {
            f = (1 / borderBottom) * element.offsetWidth;
            c3scale = Math.min(c3scale, f);
            c4scale = Math.min(c4scale, f);
        }
        // Change scales of bottom left and top right corners based on offsetHeight
        var borderRight = pixelCorners[0][1] + pixelCorners[3][1];
        if (borderRight > element.offsetHeight) {
            f = (1 / borderRight) * element.offsetHeight;
            c1scale = Math.min(c1scale, f);
            c4scale = Math.min(c4scale, f);
        }
        // Scale the corners to fix within the confines of the element
        pixelCorners[0][0] = pixelCorners[0][0] * c1scale;
        pixelCorners[0][1] = pixelCorners[0][1] * c1scale;
        pixelCorners[1][0] = pixelCorners[1][0] * c2scale;
        pixelCorners[1][1] = pixelCorners[1][1] * c2scale;
        pixelCorners[2][0] = pixelCorners[2][0] * c3scale;
        pixelCorners[2][1] = pixelCorners[2][1] * c3scale;
        pixelCorners[3][0] = pixelCorners[3][0] * c4scale;
        pixelCorners[3][1] = pixelCorners[3][1] * c4scale;
        return pixelCorners;
    }
    // Check that the element is with the confines of rounded corners
    static checkInBorder(element, style, x, y, left, top) {
        if (style['border-radius'] == '0px')
            return true;
        var width = element.offsetWidth;
        var height = element.offsetHeight;
        var corners = this.getBorderRadii(element, style);
        // Check top left corner
        if (x < corners[0][0] + left && y < corners[0][1] + top) {
            var x1 = (corners[0][0] + left - x) / corners[0][0];
            var y1 = (corners[0][1] + top - y) / corners[0][1];
            if (x1 * x1 + y1 * y1 > 1) {
                return false;
            }
        }
        // Check top right corner
        if (x > left + width - corners[1][0] && y < corners[1][1] + top) {
            var x1 = (x - (left + width - corners[1][0])) / corners[1][0];
            var y1 = (corners[1][1] + top - y) / corners[1][1];
            if (x1 * x1 + y1 * y1 > 1) {
                return false;
            }
        }
        // Check bottom right corner
        if (x > left + width - corners[2][0] && y > top + height - corners[2][1]) {
            var x1 = (x - (left + width - corners[2][0])) / corners[2][0];
            var y1 = (y - (top + height - corners[2][1])) / corners[2][1];
            if (x1 * x1 + y1 * y1 > 1) {
                return false;
            }
        }
        // Check bottom left corner
        if (x < corners[3][0] + left && y > top + height - corners[3][1]) {
            var x1 = (corners[3][0] + left - x) / corners[3][0];
            var y1 = (y - (top + height - corners[3][1])) / corners[3][1];
            if (x1 * x1 + y1 * y1 > 1) {
                return false;
            }
        }
        return true;
    }
    // Check if element it under the current position
    // x,y - the position to check
    // offsetx, offsety - the current left and top offsets
    // offsetz - the current z offset on the current z-index
    // level - the current z-index
    // element - element being tested
    // result - the final result of the hover target
    static checkElement(x, y, offsetx, offsety, offsetz, level, element, result) {
        // Return if this element isn't visible
        if (!element.offsetParent)
            return;
        var style = window.getComputedStyle(element);
        // Calculate absolute position and dimensions
        var left = element.offsetLeft + offsetx;
        var top = element.offsetTop + offsety;
        var width = element.offsetWidth;
        var height = element.offsetHeight;
        var zIndex = style['z-index'];
        if (zIndex != 'auto') {
            offsetz = 0;
            level = parseInt(zIndex);
        }
        // If the element isn't static the increment the offsetz
        // if (style['position'] != 'static' && element != this.element) {
        //     if (zIndex == 'auto') offsetz += 1
        // }
        // If there is a transform then transform point
        if ((style['display'] == 'block' || style['display'] == 'inline-block') &&
            style['transform'] != 'none') {
            // Apply css transforms to click point
            var newcoord = this.transformPoint(style, x, y, left, top);
            if (!newcoord)
                return;
            x = newcoord[0];
            y = newcoord[1];
            if (zIndex == 'auto')
                offsetz += 1;
        }
        // Check if in confines of bounding box
        if (x > left && x < left + width && y > top && y < top + height) {
            // Check if in confines of rounded corders
            if (this.checkInBorder(element, style, x, y, left, top)) {
                //check if above other elements
                if ((offsetz >= result.zIndex || level > result.level) &&
                    level >= result.level &&
                    style['pointer-events'] != 'none') {
                    result.zIndex = offsetz;
                    result.element = element;
                    result.level = level;
                }
            }
        }
        else if (style['overflow'] != 'visible') {
            // If the element has no overflow and the point is outsize then skip it's children
            return;
        }
        // Check each of the child elements for intersection of the point
        var child = element.firstChild;
        if (child)
            do {
                if (child.nodeType == 1) {
                    if (child.offsetParent == element) {
                        this.checkElement(x, y, offsetx + left, offsety + top, offsetz, level, child, result);
                    }
                    else {
                        this.checkElement(x, y, offsetx, offsety, offsetz, level, child, result);
                    }
                }
            } while ((child = child.nextSibling));
    }
    static elementAt(element, x, y) {
        element.style.display = 'block';
        var result = {
            zIndex: 0,
            element: null,
            level: 0
        };
        this.checkElement(x, y, 0, 0, 0, 0, element, result);
        element.style.display = 'none';
        return result.element;
    }
    static mousemove(layer, x, y, button) {
        const mouseState = {
            screenX: x,
            screenY: y,
            clientX: x,
            clientY: y,
            button: button ? button : 0,
            bubbles: true,
            cancelable: true
        };
        const mouseStateHover = {
            clientX: x,
            clientY: y,
            button: button ? button : 0,
            bubbles: false
        };
        const ele = this.elementAt(layer.element, x, y);
        // If the element under cusor isn't the same as lasttime then update hoverstates and fire off events
        if (ele != this.mouseoverElement) {
            if (ele) {
                var parents = [];
                var current = ele;
                if (this.mouseoverElement)
                    this.mouseoverElement.dispatchEvent(new MouseEvent('mouseout', mouseState));
                ele.dispatchEvent(new MouseEvent('mouseover', mouseState));
                // Update overElements and fire corresponding events
                do {
                    if (current == element)
                        break;
                    if (this.overElements.indexOf(current) == -1) {
                        if (current.classList)
                            current.classList.add('x-hover');
                        current.dispatchEvent(new MouseEvent('mouseenter', mouseStateHover));
                        this.overElements.push(current);
                    }
                    parents.push(current);
                } while ((current = current.parentNode));
                for (var i = 0; i < this.overElements.length; i++) {
                    var element = this.overElements[i];
                    if (parents.indexOf(element) == -1) {
                        if (element.classList)
                            element.classList.remove('x-hover');
                        element.dispatchEvent(new MouseEvent('mouseleave', mouseStateHover));
                        this.overElements.splice(i, 1);
                        i--;
                    }
                }
            }
            else {
                while ((element = this.overElements.pop())) {
                    if (element.classList)
                        element.classList.remove('x-hover');
                    element.dispatchEvent(new MouseEvent('mouseout', mouseState));
                }
            }
        }
        if (ele && this.overElements.indexOf(ele) == -1)
            this.overElements.push(ele);
        this.mouseoverElement = ele;
        if (ele)
            ele.dispatchEvent(new MouseEvent('mousemove', mouseState));
    }
    // Mouse down on the HTML Element
    static mousedown(layer, x, y, button) {
        var mouseState = {
            screenX: x,
            screenY: y,
            clientX: x,
            clientY: y,
            button: button ? button : 0,
            bubbles: true,
            cancelable: true
        };
        var ele = this.elementAt(layer.element, x, y);
        if (ele) {
            this.activeElement = ele;
            ele.classList.add('x-active');
            ele.classList.remove('x-hover');
            ele.dispatchEvent(new MouseEvent('mousedown', mouseState));
        }
        this.mousedownElement = ele;
    }
    static updateInputAttributes(element) {
        if (element.matches('input'))
            this._updateInputAttribute(element);
        for (const e of element.getElementsByTagName('input'))
            this._updateInputAttribute(e);
    }
    static _updateInputAttribute(inputElement) {
        if (inputElement.hasAttribute('checked')) {
            if (!inputElement.checked)
                inputElement.removeAttribute('checked');
        }
        else {
            if (inputElement.checked)
                inputElement.setAttribute('checked', '');
        }
        inputElement.setAttribute('value', inputElement.value);
    }
    static setFocus(ele) {
        ele.dispatchEvent(new FocusEvent('focus'));
        ele.dispatchEvent(new CustomEvent('focusin', {
            bubbles: true,
            cancelable: false
        }));
        ele.classList.add('x-focus');
        this.focusElement = ele;
    }
    static setBlur() {
        if (this.focusElement) {
            this.focusElement.classList.remove('x-focus');
            this.focusElement.dispatchEvent(new FocusEvent('blur'));
            this.focusElement.dispatchEvent(new CustomEvent('focusout', {
                bubbles: true,
                cancelable: false
            }));
        }
    }
    static clearHover() {
        let element;
        while ((element = this.overElements.pop())) {
            if (element.classList)
                element.classList.remove('x-hover');
            element.dispatchEvent(new MouseEvent('mouseout', {
                bubbles: true,
                cancelable: true
            }));
        }
        if (this.mouseoverElement)
            this.mouseoverElement.dispatchEvent(new MouseEvent('mouseleave', {
                bubbles: true,
                cancelable: true
            }));
        this.mouseoverElement = null;
        const activeElement = document.querySelector('.x-active');
        if (activeElement) {
            activeElement.classList.remove('x-active');
            this.activeElement = null;
        }
    }
    static mouseup(layer, x, y, button) {
        const mouseState = {
            screenX: x,
            screenY: y,
            clientX: x,
            clientY: y,
            button: button ? button : 0,
            bubbles: true,
            cancelable: true
        };
        const ele = WebRenderer.elementAt(layer.element, x, y);
        if (this.activeElement) {
            this.activeElement.classList.remove('x-active');
            if (ele) {
                ele.classList.add('x-hover');
                if (this.overElements.indexOf(ele) == -1)
                    this.overElements.push(ele);
            }
            this.activeElement = null;
        }
        if (ele) {
            ele.dispatchEvent(new MouseEvent('mouseup', mouseState));
            if (ele != this.focusElement) {
                this.setBlur();
                this.setFocus(ele);
            }
            if (ele == this.mousedownElement) {
                ele.dispatchEvent(new MouseEvent('click', mouseState));
                // if (ele.tagName == "INPUT") this.updateCheckedAttributes(ele)
                // If the element requires some sort of keyboard interaction then notify of an input requirment
                if (ele.tagName == 'INPUT' || ele.tagName == 'TEXTAREA' || ele.tagName == 'SELECT') {
                    if (layer.eventCallback)
                        layer.eventCallback('inputrequired', {
                            target: ele
                        });
                }
            }
        }
        else {
            if (this.focusElement)
                this.focusElement.dispatchEvent(new FocusEvent('blur'));
            this.focusElement = null;
        }
    }
}
exports.WebRenderer = WebRenderer;
WebRenderer.LAYER_ATTRIBUTE = 'data-layer';
WebRenderer.CONTAINER_ATTRIBUTE = 'data-layer-container';
WebRenderer.RENDERING_ATTRIBUTE = 'data-layer-rendering';
WebRenderer.PIXEL_RATIO_ATTRIBUTE = 'data-layer-pixel-ratio';
WebRenderer.RENDERING_DOCUMENT_ATTRIBUTE = 'data-layer-rendering-document';
WebRenderer.serializer = new XMLSerializer();
WebRenderer.rootLayers = new Map();
WebRenderer.layers = new Map();
WebRenderer.mutationObservers = new Map();
WebRenderer.resizeObservers = new Map();
WebRenderer.serializeQueue = [];
WebRenderer.rasterizeQueue = [];
WebRenderer.renderQueue = [];
WebRenderer.overElements = [];
WebRenderer.focusElement = null;
WebRenderer.activeElement = null;
WebRenderer.mousedownElement = null;
WebRenderer.mouseoverElement = null;
WebRenderer._didInit = false;
WebRenderer.TASK_SERIALIZE_MAX_TIME = 2; // serialization is synchronous
WebRenderer.TASK_RASTERIZE_MAX_TIME = 2; // processing of data:svg is async
WebRenderer.TASK_RASTERIZE_MAX_SIMULTANEOUS = 2; // since rasterization is async, limit simultaneous rasterizations
WebRenderer.TASK_RENDER_MAX_TIME = 3; // rendering to canvas is synchronous
WebRenderer.rasterizeTaskCount = 0;
WebRenderer._onmousemove = e => {
    e.stopPropagation();
};
WebRenderer.handleMutations = (records) => {
    for (const record of records) {
        if (record.type === 'attributes') {
            const target = record.target;
            if (target.getAttribute(record.attributeName) === record.oldValue) {
                continue;
            }
        }
        if (record.type === 'characterData') {
            const target = record.target;
            if (target.data === record.oldValue) {
                continue;
            }
        }
        const target = record.target.nodeType === Node.ELEMENT_NODE
            ? record.target
            : record.target.parentElement;
        if (!target)
            continue;
        const layer = WebRenderer.getLayerForElement(target);
        if (!layer)
            continue;
        if (record.type === 'attributes' && record.attributeName === 'class') {
            const oldClasses = record.oldValue ? record.oldValue : '';
            const currentClasses = record.target.className;
            if (oldClasses === currentClasses)
                continue;
        }
        // layer.traverseParentLayers(WebRenderer.setLayerNeedsRasterize) // may be needed to support :focus-within() and future :has() selector support
        layer.parentLayer
            ? layer.parentLayer.traverseChildLayers(WebRenderer.setLayerNeedsUpdate)
            : layer.traverseLayers(WebRenderer.setLayerNeedsUpdate);
    }
};
WebRenderer._triggerRefresh = async (e) => {
    await microtask; // allow other handlers to run first
    const layer = WebRenderer.getLayerForElement(e.target);
    WebRenderer.updateInputAttributes(e.target);
    if (layer) {
        // layer.traverseParentLayers(WebRenderer.setLayerNeedsRasterize) // may be needed to support :focus-within() and future :has() selector support
        layer.parentLayer
            ? layer.parentLayer.traverseChildLayers(WebRenderer.setLayerNeedsUpdate)
            : layer.traverseLayers(WebRenderer.setLayerNeedsUpdate);
    }
};
WebRenderer._embeddedPageCSS = new Map();
//# sourceMappingURL=web-renderer.js.map