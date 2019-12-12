function id(element: HTMLElement) {
  return element.id ? `#${element.id}` : ''
}

function classes(element: HTMLElement) {
  let classSelector = ''
  const classList = element.classList
  for (const c of classList) {
    classSelector += '.' + c
  }
  return classSelector
}

function nthChild(element: HTMLElement) {
  let childNumber = 0
  const childNodes = element.parentNode!.childNodes
  for (const node of childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) ++childNumber
    if (node === element) return `:nth-child('${childNumber}')`
  }
}

function attributes(element: HTMLElement) {
  let attributes = ''
  for (const attr of element.attributes) {
    attributes += `[${attr.name}="${attr.value}"]`
  }
  return attributes
}

export function path(el: HTMLElement, rootNode = document.documentElement) {
  const selector = el.tagName.toLowerCase() + id(el) + classes(el) + attributes(el) + nthChild(el)
  const hasParent = el.parentNode && el.parentNode !== rootNode && (el.parentNode as any).tagName
  return hasParent ? path(el.parentNode as HTMLElement, rootNode) + ' > ' + selector : selector
}

export function hash(el: HTMLElement) {
  const cssPath = path(el)
  const type = (el as HTMLInputElement).type
  const checked = (el as HTMLInputElement).checked
  const value = (el as HTMLInputElement).value
  const textContent = (el as HTMLInputElement).textContent
}

export function traverseChildElements(
  node: Node,
  each: (node: Element, level: number) => boolean,
  bind?: any,
  level = 0
) {
  level++
  for (let child: Node | null = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      if (each.call(bind, el, level)) {
        traverseChildElements(el, each, bind, level)
      }
    }
  }
}

export function addCSSRule(sheet, selector, rules, index) {
  if ('insertRule' in sheet) {
    sheet.insertRule(selector + '{' + rules + '}', index)
  } else if ('addRule' in sheet) {
    sheet.addRule(selector, rules, index)
  }
}

export class Bounds {
  left = 0
  top = 0
  width = 0
  height = 0
  copy(rect: Bounds) {
    this.top = rect.top
    this.left = rect.left
    this.width = rect.width
    this.height = rect.height
    return this
  }
}

export class Edges {
  left = 0
  top = 0
  right = 0
  bottom = 0
  copy(rect: Edges) {
    this.top = rect.top
    this.left = rect.left
    this.right = rect.right
    this.bottom = rect.bottom
    return this
  }
}

export function getBounds(
  element: Element,
  bounds: Bounds = new Bounds(),
  referenceElement?: Element
) {
  const doc = element.ownerDocument!
  const defaultView = element.ownerDocument!.defaultView!
  const docEl = doc.documentElement
  const body = doc.body

  if (element === docEl) {
    return getDocumentBounds(doc, bounds)
  }

  if (referenceElement === element) {
    bounds.left = 0
    bounds.top = 0
    bounds.width = (element as HTMLElement).offsetWidth
    bounds.height = (element as HTMLElement).offsetHeight
    return
  }

  let el: HTMLElement | null = element as HTMLElement

  let computedStyle
  let offsetParent = el.offsetParent as HTMLElement
  let prevComputedStyle = defaultView.getComputedStyle(el, null)
  let top = el.offsetTop
  let left = el.offsetLeft

  if (
    offsetParent &&
    referenceElement &&
    offsetParent.contains(referenceElement) &&
    offsetParent !== referenceElement
  ) {
    getBounds(referenceElement, bounds, offsetParent)
    left -= bounds.left
    top -= bounds.top
  }

  while (
    (el = el.parentNode as HTMLElement) &&
    el !== body &&
    el !== docEl &&
    el !== referenceElement
  ) {
    if (prevComputedStyle.position === 'fixed') {
      break
    }

    computedStyle = defaultView.getComputedStyle(el, null)
    top -= el.scrollTop
    left -= el.scrollLeft

    if (el === offsetParent) {
      top += el.offsetTop
      left += el.offsetLeft
      top += parseFloat(computedStyle.borderTopWidth) || 0
      left += parseFloat(computedStyle.borderLeftWidth) || 0
      offsetParent = el.offsetParent as HTMLElement
    }

    prevComputedStyle = computedStyle
  }

  // if (prevComputedStyle.position === 'relative' || prevComputedStyle.position === 'static') {
  //   getDocumentBounds(doc, bounds)
  //   top += bounds.top
  //   left += bounds.left
  // }

  if (prevComputedStyle.position === 'fixed') {
    top += Math.max(docEl.scrollTop, body.scrollTop)
    left += Math.max(docEl.scrollLeft, body.scrollLeft)
  }

  // let el = element
  // let left = el.offsetLeft
  // let top = el.offsetTop
  // let offsetParent = el.offsetParent
  // while (el && el.nodeType !== Node.DOCUMENT_NODE) {
  //   left -= el.scrollLeft
  //   top -= el.scrollTop
  //   if (el === offsetParent) {
  //     const style = window.getComputedStyle(el)
  //     left += el.offsetLeft + parseFloat(style.borderLeftWidth!) || 0
  //     top += el.offsetTop + parseFloat(style.borderTopWidth!) || 0
  //     offsetParent = el.offsetParent
  //   }
  //   el = el.offsetParent as any
  // }

  bounds.left = left
  bounds.top = top
  bounds.width = (element as HTMLElement).offsetWidth
  bounds.height = (element as HTMLElement).offsetHeight
  return bounds
}

export function getMargin(element: Element, margin: Edges) {
  let style = getComputedStyle(element)
  margin.left = parseFloat(style.marginLeft) || 0
  margin.right = parseFloat(style.marginRight) || 0
  margin.top = parseFloat(style.marginTop) || 0
  margin.bottom = parseFloat(style.marginBottom) || 0
}

export function getBorder(element: Element, border: Edges) {
  let style = getComputedStyle(element)
  border.left = parseFloat(style.borderLeftWidth) || 0
  border.right = parseFloat(style.borderRightWidth) || 0
  border.top = parseFloat(style.borderTopWidth) || 0
  border.bottom = parseFloat(style.borderBottomWidth) || 0
}

export function getPadding(element: Element, padding: Edges) {
  let style = getComputedStyle(element)
  padding.left = parseFloat(style.paddingLeft) || 0
  padding.right = parseFloat(style.paddingRight) || 0
  padding.top = parseFloat(style.paddingTop) || 0
  padding.bottom = parseFloat(style.paddingBottom) || 0
}

/*
 * On some mobile browsers, the value reported by window.innerHeight
 * is not the true viewport height. This method returns
 * the actual viewport.
 */
export function getViewportBounds(bounds: Bounds) {
  if (!viewportTester.parentNode) document.documentElement.append(viewportTester)
  bounds.left = pageXOffset
  bounds.top = pageYOffset
  bounds.width = viewportTester.offsetWidth
  bounds.height = viewportTester.offsetHeight
  return bounds
}
const viewportTester = document.createElement('div')
viewportTester.id = 'VIEWPORT'
viewportTester.style.position = 'fixed'
viewportTester.style.width = '100vw'
viewportTester.style.height = '100vh'
viewportTester.style.visibility = 'hidden'
viewportTester.style.pointerEvents = 'none'

export function getDocumentBounds(document: Document, bounds: Bounds) {
  const documentElement = document.documentElement
  const body = document.body
  const documentElementStyle = getComputedStyle(documentElement)
  const bodyStyle = getComputedStyle(body)
  bounds.top =
    body.offsetTop + parseFloat(documentElementStyle.marginTop as '') ||
    0 + parseFloat(bodyStyle.marginTop as '') ||
    0
  bounds.left =
    body.offsetLeft + parseFloat(documentElementStyle.marginLeft as '') ||
    0 + parseFloat(bodyStyle.marginLeft as '') ||
    0
  bounds.width = Math.max(
    Math.max(body.scrollWidth, documentElement.scrollWidth),
    Math.max(body.offsetWidth, documentElement.offsetWidth),
    Math.max(body.clientWidth, documentElement.clientWidth)
  )
  bounds.height = Math.max(
    Math.max(body.scrollHeight, documentElement.scrollHeight),
    Math.max(body.offsetHeight, documentElement.offsetHeight),
    Math.max(body.clientHeight, documentElement.clientHeight)
  )
  return bounds
}
