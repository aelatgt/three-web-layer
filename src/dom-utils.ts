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

export function traverseDOM(
  node: Node,
  each: (node: HTMLElement, level: number) => boolean,
  bind?: any,
  level = 0
) {
  level++
  for (let child: Node | null = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      if (each.call(bind, el, level)) {
        traverseDOM(el, each, bind, level)
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

export interface Bounds {
  left: number
  top: number
  width: number
  height: number
}

export function getBounds(
  element: HTMLElement,
  bounds: Bounds = { left: 0, top: 0, width: 0, height: 0 }
) {
  const doc = element.ownerDocument!
  const defaultView = element.ownerDocument!.defaultView!
  const docEl = doc.documentElement
  const body = doc.body

  if (element === docEl) {
    return getDocumentBounds(doc, bounds)
  }

  let el: HTMLElement | null = element

  let computedStyle
  let offsetParent = el.offsetParent as HTMLElement
  let prevComputedStyle = defaultView.getComputedStyle(el, null)
  let top = el.offsetTop
  let left = el.offsetLeft

  while ((el = el.parentNode as HTMLElement) && el !== body && el !== docEl) {
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

  if (prevComputedStyle.position === 'relative' || prevComputedStyle.position === 'static') {
    getDocumentBounds(doc, bounds)
    top += bounds.top
    left += bounds.left
  }

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
  bounds.width = element.offsetWidth
  bounds.height = element.offsetHeight
  return bounds
}

/*
 * On some mobile browsers, the value reported by window.innerHeight
 * is not the true viewport height. This method returns
 * the actual viewport.
 */
export function getViewportBounds(bounds: Bounds) {
  if (!viewportTester.parentNode) document.documentElement.append(viewportTester)
  bounds.top = 0
  bounds.left = 0
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
