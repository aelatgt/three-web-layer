"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function id(element) {
    return element.id ? `#${element.id}` : '';
}
function classes(element) {
    let classSelector = '';
    const classList = element.classList;
    for (const c of classList) {
        classSelector += '.' + c;
    }
    return classSelector;
}
function nthChild(element) {
    let childNumber = 0;
    const childNodes = element.parentNode.childNodes;
    for (const node of childNodes) {
        if (node.nodeType === Node.ELEMENT_NODE)
            ++childNumber;
        if (node === element)
            return `:nth-child('${childNumber}')`;
    }
}
function attributes(element) {
    let attributes = '';
    for (const attr of element.attributes) {
        attributes += `[${attr.name}="${attr.value}"]`;
    }
    return attributes;
}
function path(el, rootNode = document.documentElement) {
    const selector = el.tagName.toLowerCase() + id(el) + classes(el) + attributes(el) + nthChild(el);
    const hasParent = el.parentNode && el.parentNode !== rootNode && el.parentNode.tagName;
    return hasParent ? path(el.parentNode, rootNode) + ' > ' + selector : selector;
}
exports.path = path;
function hash(el) {
    const cssPath = path(el);
    const type = el.type;
    const checked = el.checked;
    const value = el.value;
    const textContent = el.textContent;
}
exports.hash = hash;
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
exports.traverseDOM = traverseDOM;
function getBounds(element, bounds = { left: 0, top: 0, width: 0, height: 0 }) {
    if (element instanceof Window) {
        const { width, height } = getViewportSize();
        bounds.left = 0;
        bounds.top = 0;
        bounds.width = width;
        bounds.height = height;
        return bounds;
    }
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
    bounds.left = left;
    bounds.top = top;
    bounds.width = element.offsetWidth;
    bounds.height = element.offsetHeight;
    return bounds;
}
exports.getBounds = getBounds;
function addCSSRule(sheet, selector, rules, index) {
    if ('insertRule' in sheet) {
        sheet.insertRule(selector + '{' + rules + '}', index);
    }
    else if ('addRule' in sheet) {
        sheet.addRule(selector, rules, index);
    }
}
exports.addCSSRule = addCSSRule;
/*
 * On some mobile browsers, the value reported by window.innerHeight
 * is not the true viewport height. This method returns
 * the actual viewport.
 */
function getViewportSize() {
    viewportSize.width = viewport.offsetWidth;
    viewportSize.height = viewport.offsetHeight;
    return viewportSize;
}
exports.getViewportSize = getViewportSize;
const viewport = document.createElement('div');
viewport.id = 'VIEWPORT';
viewport.style.position = 'fixed';
viewport.style.width = '100vw';
viewport.style.height = '100vh';
viewport.style.visibility = 'hidden';
viewport.style.pointerEvents = 'none';
document.documentElement.append(viewport);
const viewportSize = { width: 0, height: 0 };
function getDocumentSize() {
    const body = document.body;
    const documentElement = document.documentElement;
    documentSize.width = Math.max(Math.max(body.scrollWidth, documentElement.scrollWidth), Math.max(body.offsetWidth, documentElement.offsetWidth), Math.max(body.clientWidth, documentElement.clientWidth));
    documentSize.height = Math.max(Math.max(body.scrollHeight, documentElement.scrollHeight), Math.max(body.offsetHeight, documentElement.offsetHeight), Math.max(body.clientHeight, documentElement.clientHeight));
    return documentSize;
}
exports.getDocumentSize = getDocumentSize;
const documentSize = { width: 0, height: 0 };
//# sourceMappingURL=dom-utils.js.map