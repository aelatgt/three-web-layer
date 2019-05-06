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
        bounds.left = 0;
        bounds.top = 0;
        bounds.width = element.innerWidth;
        bounds.height = element.innerHeight;
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
    bounds.left = left + window.pageXOffset;
    bounds.top = top + window.pageYOffset;
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
//# sourceMappingURL=dom-utils.js.map