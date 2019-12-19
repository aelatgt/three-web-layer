import ResizeObserver from 'resize-observer-polyfill'
import { Matrix4 } from 'three/src/math/Matrix4'
import { Vector3 } from 'three/src/math/Vector3'
import {
  addCSSRule,
  traverseChildElements,
  getBounds,
  getPadding,
  getMargin,
  getBorder,
  Bounds,
  Edges
} from './dom-utils'
import { LRUMap } from 'lru_map'
import * as sha256 from 'fast-sha256'

function ensureElementIsInDocument(element: Element): Element {
  const document = element.ownerDocument!
  if (document.contains(element)) {
    return element
  }
  const container = document.createElement('div')
  container.setAttribute(WebRenderer.CONTAINER_ATTRIBUTE, '')
  container.style.position = 'fixed'
  container.style.width = '100%'
  container.style.height = '100%'
  container.style.top = '-100000px'
  container.style['contain'] = 'strict'
  container.appendChild(element)
  document.documentElement.appendChild(container)
  // document.body.appendChild(container)
  return element
}

const scratchMat1 = new Matrix4()
const scratchMat2 = new Matrix4()
const textDecoder = new TextDecoder()
const microtask = Promise.resolve()

type EventCallback = (
  event:
    | 'layerpainted'
    | 'layerresized'
    | 'layercreated'
    | 'parentchanged'
    | 'removalrequired'
    | 'inputrequired',
  data: { target: Element }
) => void

export class WebLayer {
  static DEFAULT_CACHE_SIZE = 4
  static canvasHashes: LRUMap<string, string> = new LRUMap(1000)
  static cachedCanvases: LRUMap<string, HTMLCanvasElement> = new LRUMap(WebLayer.DEFAULT_CACHE_SIZE)
  private static _nextID = 0

  id = WebLayer._nextID++

  constructor(public element: Element, public eventCallback: EventCallback) {
    WebRenderer.layers.set(element, this)
    element.setAttribute(WebRenderer.LAYER_ATTRIBUTE, '' + this.id)
    this.parentLayer = WebRenderer.getClosestLayer(this.element.parentElement)
    this.eventCallback('layercreated', { target: element })
    WebLayer.cachedCanvases.limit = WebRenderer.layers.size * WebLayer.DEFAULT_CACHE_SIZE
  }

  needsRefresh = true
  needsRemoval = false

  svg: HTMLImageElement = new Image()
  bounds = new Bounds()
  private _previousBounds = new Bounds()

  private padding = new Edges()
  private margin = new Edges()
  private border = new Edges()
  parentLayer?: WebLayer
  childLayers = [] as WebLayer[]
  pixelRatio?: number

  cssTransform = new Matrix4()

  cachedBounds: Map<string, Bounds> = new Map()
  cachedMargin: Map<string, Edges> = new Map()

  private _dynamicAttributes = ''
  private _svgDocument = ''
  private _svgSrc = ''
  private _hashingCanvas = document.createElement('canvas')

  _canvas: HTMLCanvasElement

  set canvas(val: HTMLCanvasElement) {
    if (this._canvas !== val) {
      this._canvas = val
      if (this.eventCallback) this.eventCallback('layerpainted', { target: this.element })
    }
  }

  get canvas() {
    return this._canvas
  }

  get depth() {
    const parentLayer = this.parentLayer
    let depth = 0
    if (parentLayer) {
      let el = this.element
      while (el !== parentLayer.element) {
        el = el.parentElement
        depth++
      }
    }
    return depth
  }

  get rootLayer() {
    let rootLayer = this as WebLayer
    while (rootLayer.parentLayer) rootLayer = rootLayer.parentLayer
    return rootLayer
  }

  traverseParentLayers<T extends any[]>(
    each: (layer: WebLayer, ...params: T) => void,
    ...params: T
  ) {
    const parentLayer = this.parentLayer
    if (parentLayer) {
      parentLayer.traverseParentLayers(each, ...params)
      each(parentLayer, ...params)
    }
  }

  traverseLayers<T extends any[]>(each: (layer: WebLayer, ...params: T) => void, ...params: T) {
    each(this, ...params)
    this.traverseChildLayers(each, ...params)
  }

  traverseChildLayers<T extends any[]>(
    each: (layer: WebLayer, ...params: T) => void,
    ...params: T
  ) {
    for (const child of this.childLayers) {
      child.traverseLayers(each, ...params)
    }
  }

  private static _setNeedsRefresh(layer: WebLayer) {
    layer.needsRefresh = true
  }

  refresh() {
    const dynamicAttributes = WebRenderer.getDynamicAttributes(this.element)
    getBounds(this.element, this.bounds, this.parentLayer && this.parentLayer.element)
    if (
      this._dynamicAttributes !== dynamicAttributes ||
      this.bounds.width !== this._previousBounds.width ||
      this.bounds.height !== this._previousBounds.height
    ) {
      this._dynamicAttributes = dynamicAttributes
      this.traverseLayers(WebLayer._setNeedsRefresh)
    }
    this._previousBounds.copy(this.bounds)
    if (this.needsRefresh) {
      this._refreshParentAndChildLayers()
      WebRenderer.addToSerializeQueue(this)
      this.needsRefresh = false
    }
    if (WebRenderer.rootLayers.has(this.element)) {
      WebRenderer.scheduleTasks()
    }
  }

  private _refreshParentAndChildLayers() {
    const element = this.element
    const childLayers = this.childLayers
    const oldChildLayers = childLayers.slice()

    const previousParentLayer = this.parentLayer
    this.parentLayer = WebRenderer.getClosestLayer(this.element.parentElement)
    if (previousParentLayer !== this.parentLayer) {
      this.parentLayer && this.parentLayer.childLayers.push(this)
      this.eventCallback('parentchanged', { target: element })
    }

    childLayers.length = 0
    traverseChildElements(element, this._tryConvertElementToWebLayer, this)

    for (const child of oldChildLayers) {
      const parentLayer = WebRenderer.getClosestLayer(child.element.parentElement)
      if (!parentLayer) {
        child.needsRemoval = true
        childLayers.push(child)
      }
    }
  }

  private _tryConvertElementToWebLayer(el: HTMLElement) {
    const styles = getComputedStyle(el)
    const id = el.getAttribute(WebRenderer.LAYER_ATTRIBUTE)
    if (id !== null || el.nodeName === 'VIDEO' || styles.transform !== 'none') {
      let child = WebRenderer.layers.get(el)
      if (!child) {
        child = new WebLayer(el, this.eventCallback)
      }
      child.needsRemoval = this.needsRemoval
      this.childLayers.push(child)
      return false // stop traversing this subtree
    }
    return true
  }

  async serialize() {
    if (this.element.nodeName === 'VIDEO') return

    const [svgPageCSS] = await Promise.all([
      WebRenderer.getEmbeddedPageCSS(),
      WebRenderer.embedExternalResources(this.element)
    ])

    let { width, height } = this.bounds

    if (width * height > 0) {
      getPadding(this.element, this.padding)
      getMargin(this.element, this.margin)
      getBorder(this.element, this.border)
      // add margins
      width += Math.max(this.margin.left, 0) + Math.max(this.margin.right, 0)
      height += Math.max(this.margin.top, 0) + Math.max(this.margin.bottom, 0)
      // width += Math.max(this.border.left,0) + Math.max(this.border.right,0)
      // height += Math.max(this.border.top,0) + Math.max(this.border.bottom,0)

      // create svg markup
      const layerAttribute = `data-layer="${this.id}"`
      const layerElement = this.element as HTMLElement
      const needsInlineBlock = getComputedStyle(layerElement).display === 'inline'
      const layerHTML = WebRenderer.serializer
        .serializeToString(layerElement)
        .replace(
          layerAttribute,
          `data-layer="" ${WebRenderer.RENDERING_ATTRIBUTE}="" ` +
            `${needsInlineBlock ? 'data-layer-rendering-inline="" ' : ' '} ` +
            WebRenderer.getDynamicAttributes(layerElement)
        )
      const parentsHTML = this._getParentsHTML(layerElement)
      parentsHTML[0] = parentsHTML[0].replace(
        'html',
        'html ' + WebRenderer.RENDERING_DOCUMENT_ATTRIBUTE + '="" '
      )
      const docString =
        '<svg width="' +
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
        '</foreignObject></svg>'
      this._svgDocument = docString
      const svgSrc = (this._svgSrc = 'data:image/svg+xml;utf8,' + encodeURIComponent(docString))

      // check for existing canvas
      const canvasHash = WebLayer.canvasHashes.get(svgSrc)
      if (canvasHash && WebLayer.cachedCanvases.has(canvasHash)) {
        this.canvas = WebLayer.cachedCanvases.get(canvasHash)
        return
      }

      // rasterize the svg document if no existing canvas matches
      this.cachedBounds.set(svgSrc, new Bounds().copy(this.bounds))
      this.cachedMargin.set(svgSrc, new Edges().copy(this.margin))
      WebRenderer.addToRasterizeQueue(this)
    }
  }

  async rasterize() {
    return new Promise(resolve => {
      this.svg.onload = () => {
        WebRenderer.addToRenderQueue(this)
        resolve()
      }
      this.svg.src = this._svgSrc
      if (this.svg.complete && this.svg.currentSrc === this.svg.src) {
        WebRenderer.addToRenderQueue(this)
        this.svg.onload = undefined
        resolve()
      }
    })
  }

  render() {
    const src = this.svg.currentSrc
    if (!this.svg.complete || !this.cachedBounds.has(src) || !this.cachedMargin.has(src)) {
      this.needsRefresh = true
      return
    }

    let { width, height } = this.cachedBounds.get(src)
    let { left, top } = this.cachedMargin.get(src)

    const hashingCanvas = this._hashingCanvas
    let hw = (hashingCanvas.width = Math.max(width * 0.05, 40))
    let hh = (hashingCanvas.height = Math.max(height * 0.05, 40))
    const hctx = hashingCanvas.getContext('2d')
    hctx.clearRect(0, 0, hw, hh)
    hctx.drawImage(this.svg, left, top, width, height, 0, 0, hw, hh)
    const hashData = hctx.getImageData(0, 0, hw, hh).data
    const newHash =
      WebRenderer.arrayBufferToBase64(sha256.hash(new Uint8Array(hashData))) +
      '?w=' +
      width +
      ';h=' +
      height
    WebLayer.canvasHashes.set(src, newHash)

    if (WebLayer.cachedCanvases.has(newHash)) {
      this.canvas = WebLayer.cachedCanvases.get(newHash)
      return
    }

    const pixelRatio =
      this.pixelRatio ||
      parseFloat(this.element.getAttribute(WebRenderer.PIXEL_RATIO_ATTRIBUTE)) ||
      window.devicePixelRatio
    const newCanvas =
      WebLayer.cachedCanvases.size === WebLayer.cachedCanvases.limit
        ? WebLayer.cachedCanvases.shift()[1]
        : document.createElement('canvas')
    let w = (newCanvas.width = width * pixelRatio)
    let h = (newCanvas.height = height * pixelRatio)
    const ctx = newCanvas.getContext('2d')
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.svg, left, top, width, height, 0, 0, w, h)

    WebLayer.cachedCanvases.set(newHash, newCanvas)
    this.canvas = newCanvas
  }

  // Get all parents of the embeded html as these can effect the resulting styles
  private _getParentsHTML(element: Element) {
    const opens = []
    const closes = []
    let parent = element.parentElement!
    do {
      let tag = parent.tagName.toLowerCase()
      let attributes = ' '
      for (const a of parent.attributes) {
        if (a.name === 'style') continue
        if (a.name === 'data-layer') {
          attributes += 'data-layer="" ' // remove layer id to increase cache hits for similar element heirarchies
          continue
        }
        attributes += `${a.name}="${a.value}" `
      }
      const open =
        '<' +
        tag +
        (tag === 'html'
          ? ` xmlns="http://www.w3.org/1999/xhtml" style="--x-width:${this.bounds.width +
              0.5}px;--x-height:${this.bounds.height}px;--x-inline-top:${this.border.top +
              this.margin.top +
              this.padding.top}px" `
          : '') +
        attributes +
        'data-layer-rendering-parent="" ' +
        WebRenderer.getDynamicAttributes(parent) +
        ' >'
      opens.unshift(open)
      const close = '</' + tag + '>'
      closes.push(close)
      if (tag == 'html') break
    } while ((parent = parent.parentElement!))
    return [opens.join(''), closes.join('')]
  }
}

export class WebRenderer {
  static LAYER_ATTRIBUTE = 'data-layer'
  static CONTAINER_ATTRIBUTE = 'data-layer-container'
  static RENDERING_ATTRIBUTE = 'data-layer-rendering'
  static PIXEL_RATIO_ATTRIBUTE = 'data-layer-pixel-ratio'
  static RENDERING_DOCUMENT_ATTRIBUTE = 'data-layer-rendering-document'
  static serializer = new XMLSerializer()

  static rootLayers: Map<Element, WebLayer> = new Map()
  static layers: Map<Element, WebLayer> = new Map()
  static mutationObservers: Map<Element, MutationObserver> = new Map()
  static resizeObservers: Map<Element, ResizeObserver> = new Map()
  static serializeQueue = [] as WebLayer[]
  static rasterizeQueue = [] as WebLayer[]
  static renderQueue = [] as WebLayer[]

  static hoverTargetElements = new Set<Element>()

  static focusElement = null // i.e., element is ready to receive input
  static activeElement = null // i.e., button element is being "pressed down"
  static targetElement = null // i.e., the element whose ID matches the url #hash

  static _didInit = false
  static _init() {
    if (this._didInit) return
    this._didInit = true

    // const inputStyles = document.createElement("style")
    // inputStyles.innerHTML = "input, select,textarea{border: 1px solid #000000;margin: 0;background-color: #ffffff;-webkit-appearance: none;}:-webkit-autofill {color: #fff !important;}input[type='checkbox']{width: 20px;height: 20px;display: inline-block;}input[type='radio']{width: 20px;height: 20px;display: inline-block;border-radius: 50%;}input[type='checkbox'][checked],input[type='radio'][checked]{background-color: #555555;}"
    // document.head.insertBefore(inputStyles, document.head.firstChild)
    const style = document.createElement('style')
    document.head.append(style)
    const sheet = style.sheet as CSSStyleSheet
    let i = 0
    addCSSRule(
      sheet,
      `[${WebRenderer.RENDERING_DOCUMENT_ATTRIBUTE}] *`,
      'transform: none !important;',
      i++
    )
    addCSSRule(
      sheet,
      `[${WebRenderer.RENDERING_ATTRIBUTE}], [${WebRenderer.RENDERING_ATTRIBUTE}] *`,
      'visibility: visible !important;',
      i++
    )
    addCSSRule(
      sheet,
      `[${WebRenderer.RENDERING_ATTRIBUTE}] [${WebRenderer.LAYER_ATTRIBUTE}], [${
        WebRenderer.RENDERING_ATTRIBUTE
      }] [${WebRenderer.LAYER_ATTRIBUTE}] *`,
      'visibility: hidden !important;',
      i++
    )
    addCSSRule(
      sheet,
      `[${WebRenderer.RENDERING_ATTRIBUTE}]`,
      'position: relative; top: 0 !important; left: 0 !important; float: none; box-sizing:border-box; width:var(--x-width); height:var(--x-height);',
      i++
    )
    addCSSRule(
      sheet,
      `[data-layer-rendering-inline]`,
      'top: var(--x-inline-top) !important; width:auto !important',
      i++
    )
    addCSSRule(
      sheet,
      `[data-layer-rendering-parent]`,
      'transform: none !important; left: 0 !important; top: 0 !important; margin: 0 !important; border:0 !important; border-radius:0 !important; height:100% !important; padding:0 !important; position:static !important; text-align:left !important; display:block !important; background: rgba(0,0,0,0) none !important; box-shadow:none !important',
      i++
    )
    addCSSRule(
      sheet,
      `[data-layer-rendering-parent]::before, [data-layer-rendering-parent]::after`,
      'content:none !important; box-shadow:none !important;',
      i++
    )

    let previousHash = ''
    const onHashChange = () => {
      if (previousHash != window.location.hash) {
        if (window.location.hash) {
          try {
            this.targetElement = document.querySelector(window.location.hash)
          } catch {}
        }
      }
      previousHash = window.location.hash
    }
    window.addEventListener('hashchange', onHashChange, false)
    onHashChange()
  }

  static addToSerializeQueue(layer: WebLayer) {
    if (this.serializeQueue.indexOf(layer) === -1) this.serializeQueue.push(layer)
  }

  static addToRasterizeQueue(layer: WebLayer) {
    if (this.rasterizeQueue.indexOf(layer) === -1) this.rasterizeQueue.push(layer)
  }

  static addToRenderQueue(layer: WebLayer) {
    if (this.renderQueue.indexOf(layer) === -1) this.renderQueue.push(layer)
  }

  static TASK_SERIALIZE_MAX_TIME = 200 // serialization is synchronous
  static TASK_RASTERIZE_MAX_TIME = 200 // processing of data:svg is async
  static TASK_RASTERIZE_MAX_SIMULTANEOUS = 2 // since rasterization is async, limit simultaneous rasterizations
  static TASK_RENDER_MAX_TIME = 300 // rendering to canvas is synchronous
  static rasterizeTaskCount = 0
  static async scheduleTasks() {
    await microtask
    const serializeQueue = WebRenderer.serializeQueue
    const rasterizeQueue = WebRenderer.rasterizeQueue
    const renderQueue = WebRenderer.renderQueue
    let startTime = performance.now()
    // while (renderQueue.length && performance.now() - startTime < this.TASK_RENDER_MAX_TIME/2) {
    //     renderQueue.shift()!.render()
    // }
    // startTime = performance.now()
    while (serializeQueue.length && performance.now() - startTime < this.TASK_SERIALIZE_MAX_TIME) {
      serializeQueue.shift()!.serialize()
    }
    startTime = performance.now()
    while (
      rasterizeQueue.length &&
      performance.now() - startTime < this.TASK_RASTERIZE_MAX_TIME &&
      this.rasterizeTaskCount < this.TASK_RASTERIZE_MAX_SIMULTANEOUS
    ) {
      this.rasterizeTaskCount++
      rasterizeQueue
        .shift()!
        .rasterize()
        .then(() => {
          this.rasterizeTaskCount--
        })
    }
    startTime = performance.now()
    while (renderQueue.length && performance.now() - startTime < this.TASK_RENDER_MAX_TIME / 2) {
      renderQueue.shift()!.render()
    }
  }

  static setLayerNeedsUpdate(layer: WebLayer) {
    layer.needsRefresh = true
  }

  static createLayerTree(element: Element, eventCallback: EventCallback) {
    if (WebRenderer.getClosestLayer(element))
      throw new Error('A root WebLayer for the given element already exists')

    WebRenderer._init()
    ensureElementIsInDocument(element)

    const observer = new MutationObserver(WebRenderer.handleMutations)
    this.mutationObservers.set(element, observer)
    this.startMutationObserver(element)

    const resizeObserver = new ResizeObserver(records => {
      for (const record of records) {
        const layer = this.getClosestLayer(record.target)!
        layer.needsRefresh = true
      }
    })
    resizeObserver.observe(element)
    this.resizeObservers.set(element, resizeObserver)

    element.addEventListener('input', this._triggerRefresh, { capture: true })
    element.addEventListener('keydown', this._triggerRefresh, { capture: true })
    element.addEventListener('submit', this._triggerRefresh, { capture: true })
    element.addEventListener('change', this._triggerRefresh, { capture: true })
    element.addEventListener('focus', this._triggerRefresh, { capture: true })
    element.addEventListener('blur', this._triggerRefresh, { capture: true })
    element.addEventListener('transitionend', this._triggerRefresh, { capture: true })

    const layer = new WebLayer(element, eventCallback)
    this.rootLayers.set(element, layer)
    return layer
  }

  static disposeLayer(layer: WebLayer) {
    if (this.rootLayers.has(layer.element)) {
      this.rootLayers.delete(layer.element)
      const observer = this.mutationObservers.get(layer.element)
      observer.disconnect()
      this.mutationObservers.delete(layer.element)
      const resizeObserver = this.resizeObservers.get(layer.element)
      resizeObserver.disconnect()
      this.resizeObservers.delete(layer.element)
      layer.element.removeEventListener('input', this._triggerRefresh, { capture: true })
      layer.element.removeEventListener('change', this._triggerRefresh, { capture: true })
      layer.element.removeEventListener('focus', this._triggerRefresh, { capture: true })
      layer.element.removeEventListener('blur', this._triggerRefresh, { capture: true })
      layer.element.removeEventListener('transitionend', this._triggerRefresh, { capture: true })
    }
  }

  static getClosestLayer(element: Element): WebLayer | undefined {
    const closestLayerElement =
      element && (element.closest(`[${WebRenderer.LAYER_ATTRIBUTE}]`) as HTMLElement)
    return this.layers.get(closestLayerElement)
  }

  static getCSSTransformForElement(element: Element, out = new Matrix4()) {
    const styles = getComputedStyle(element)
    var transformcss = styles['transform']
    if (transformcss.indexOf('matrix(') == 0) {
      out.identity()
      var mat = transformcss
        .substring(7, transformcss.length - 1)
        .split(', ')
        .map(parseFloat)
      out.elements[0] = mat[0]
      out.elements[1] = mat[1]
      out.elements[4] = mat[2]
      out.elements[5] = mat[3]
      out.elements[12] = mat[4]
      out.elements[13] = mat[5]
    } else if (transformcss.indexOf('matrix3d(') == 0) {
      var mat = transformcss
        .substring(9, transformcss.length - 1)
        .split(', ')
        .map(parseFloat)
      out.fromArray(mat)
    } else {
      return out.identity()
    }

    var origincss = styles['transform-origin']
    origincss = origincss.split(' ').map(parseFloat)

    var ox = origincss[0]
    var oy = origincss[1]
    var oz = origincss[2] || 0

    var T1 = scratchMat1.identity().makeTranslation(-ox, -oy, -oz)
    var T2 = scratchMat2.identity().makeTranslation(ox, oy, oz)

    return out.premultiply(T2).multiply(T1)
  }

  static async embedExternalResources(element: Element) {
    const promises = []
    const elements = element.querySelectorAll('*')
    for (const element of elements) {
      const link = element.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
      if (link) {
        promises.push(
          WebRenderer.getDataURL(link).then(dataURL => {
            element.removeAttributeNS('http://www.w3.org/1999/xlink', 'href')
            element.setAttribute('href', dataURL)
          })
        )
      }
      const imgElement = element as HTMLImageElement
      if (element.tagName == 'IMG' && imgElement.src.substr(0, 4) != 'data') {
        promises.push(
          WebRenderer.getDataURL(imgElement.src).then(dataURL => {
            element.setAttribute('src', dataURL)
          })
        )
      }
      if (element.namespaceURI == 'http://www.w3.org/1999/xhtml' && element.hasAttribute('style')) {
        const style = element.getAttribute('style')
        promises.push(
          WebRenderer.generateEmbeddedCSS(window.location, style).then(css => {
            if (style != css) element.setAttribute('style', css)
          })
        )
      }
    }
    const styles = element.querySelectorAll('style')
    for (const style of styles) {
      promises.push(
        WebRenderer.generateEmbeddedCSS(window.location, style.innerHTML).then(css => {
          if (style.innerHTML != css) style.innerHTML = css
        })
      )
    }
    return Promise.all(promises)
  }

  static pauseMutationObservers() {
    const mutationObservers = WebRenderer.mutationObservers.values()
    for (const m of mutationObservers) {
      WebRenderer.handleMutations(m.takeRecords())
      m.disconnect()
    }
  }

  static resumeMutationObservers() {
    for (const [e] of WebRenderer.mutationObservers) {
      this.startMutationObserver(e)
    }
  }

  private static startMutationObserver(element: Element) {
    const observer = WebRenderer.mutationObservers.get(element)
    observer.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true,
      attributeOldValue: true
    })
  }

  static handleMutations = (records: MutationRecord[]) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        const target = record.target as HTMLElement
        if (target.getAttribute(record.attributeName!) === record.oldValue) {
          continue
        }
      }
      if (record.type === 'characterData') {
        const target = record.target as CharacterData
        if (target.data === record.oldValue) {
          continue
        }
      }
      const target =
        record.target.nodeType === Node.ELEMENT_NODE
          ? (record.target as HTMLElement)
          : record.target.parentElement
      if (!target) continue
      const layer = WebRenderer.getClosestLayer(target)
      if (!layer) continue
      if (record.type === 'attributes' && record.attributeName === 'class') {
        const oldClasses = record.oldValue ? record.oldValue : ''
        const currentClasses = (record.target as HTMLElement).className
        if (oldClasses === currentClasses) continue
      }
      // layer.traverseParentLayers(WebRenderer.setLayerNeedsRasterize) // may be needed to support :focus-within() and future :has() selector support
      layer.parentLayer
        ? layer.parentLayer.traverseChildLayers(WebRenderer.setLayerNeedsUpdate)
        : layer.traverseLayers(WebRenderer.setLayerNeedsUpdate)
    }
  }

  private static _triggerRefresh = async (e: Event) => {
    await microtask // allow other handlers to run first
    const layer = WebRenderer.getClosestLayer(e.target as any)!
    WebRenderer.updateInputAttributes(e.target as any)
    if (layer) {
      // layer.traverseParentLayers(WebRenderer.setLayerNeedsRasterize) // may be needed to support :focus-within() and future :has() selector support
      layer.parentLayer
        ? layer.parentLayer.traverseChildLayers(WebRenderer.setLayerNeedsUpdate)
        : layer.traverseLayers(WebRenderer.setLayerNeedsUpdate)
    }
  }

  private static _addDynamicPseudoClassRulesToPage() {
    const sheets = document.styleSheets
    for (let i = 0; i < sheets.length; i++) {
      try {
        const sheet = sheets[i] as CSSStyleSheet
        const rules = sheet.cssRules
        if (!rules) continue
        const newRules = []
        for (var j = 0; j < rules.length; j++) {
          if (rules[j].cssText.indexOf(':hover') > -1) {
            newRules.push(rules[j].cssText.replace(new RegExp(':hover', 'g'), '[data-layer-hover]'))
          }
          if (rules[j].cssText.indexOf(':active') > -1) {
            newRules.push(
              rules[j].cssText.replace(new RegExp(':active', 'g'), '[data-layer-active]')
            )
          }
          if (rules[j].cssText.indexOf(':focus') > -1) {
            newRules.push(rules[j].cssText.replace(new RegExp(':focus', 'g'), '[data-layer-focus]'))
          }
          if (rules[j].cssText.indexOf(':target') > -1) {
            newRules.push(
              rules[j].cssText.replace(new RegExp(':target', 'g'), '[data-layer-target]')
            )
          }
          var idx = newRules.indexOf(rules[j].cssText)
          if (idx > -1) {
            newRules.splice(idx, 1)
          }
        }
        for (var j = 0; j < newRules.length; j++) {
          sheet.insertRule(newRules[j])
        }
      } catch (e) {}
    }
  }

  static arrayBufferToBase64(bytes) {
    var binary = ''
    var len = bytes.byteLength
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }

  static async generateEmbeddedCSS(url, css): Promise<string> {
    let found
    const promises = []

    // Add classes for psuedo-classes
    css = css.replace(new RegExp(':hover', 'g'), '[data-layer-hover]')
    css = css.replace(new RegExp(':active', 'g'), '[data-layer-active]')
    css = css.replace(new RegExp(':focus', 'g'), '[data-layer-focus]')
    css = css.replace(new RegExp(':target', 'g'), '[data-layer-target]')

    // Replace all urls in the css
    const regEx = RegExp(/url\((?!['"]?(?:data):)['"]?([^'"\)]*)['"]?\)/gi)
    while ((found = regEx.exec(css))) {
      const resourceURL = found[1]
      promises.push(
        this.getDataURL(new URL(resourceURL, url)).then(dataURL => {
          css = css.replace(resourceURL, dataURL)
        })
      )
    }

    await Promise.all(promises)
    return css
  }

  static async getURL(url): Promise<XMLHttpRequest> {
    url = new URL(url, window.location.href).href
    return new Promise<XMLHttpRequest>(resolve => {
      var xhr = new XMLHttpRequest()

      xhr.open('GET', url, true)

      xhr.responseType = 'arraybuffer'

      xhr.onload = () => {
        resolve(xhr)
      }

      xhr.onerror = () => {
        resolve(xhr)
      }

      xhr.send()
    })
  }

  private static _embeddedPageCSS = new Map<Element, Promise<string>>()

  static async getEmbeddedPageCSS() {
    const embedded = this._embeddedPageCSS
    const styleElements = Array.from(
      document.querySelectorAll("style, link[type='text/css'], link[rel='stylesheet']")
    )
    let foundNewStyles = false
    for (const element of styleElements) {
      if (!embedded.has(element)) {
        foundNewStyles = true
        if (element.tagName == 'STYLE') {
          const sheet = (element as HTMLStyleElement).sheet as CSSStyleSheet
          let cssText = ''
          for (const rule of sheet.cssRules) {
            cssText += rule.cssText + '\n'
          }
          embedded.set(element, this.generateEmbeddedCSS(window.location, cssText))
        } else {
          embedded.set(
            element,
            this.getURL(element.getAttribute('href')).then(xhr => {
              if (!xhr.response) return ''
              this._addDynamicPseudoClassRulesToPage()
              var css = textDecoder.decode(xhr.response)
              return this.generateEmbeddedCSS(window.location, css)
            })
          )
        }
      }
    }
    if (foundNewStyles) this._addDynamicPseudoClassRulesToPage()
    return Promise.all(embedded.values())
  }

  // Generate and returns a dataurl for the given url
  static async getDataURL(url): Promise<string> {
    const xhr = await this.getURL(url)
    const arr = new Uint8Array(xhr.response)
    const contentType = xhr.getResponseHeader('Content-Type').split(';')[0]
    if (contentType == 'text/css') {
      let css = textDecoder.decode(arr)
      css = await this.generateEmbeddedCSS(url, css)
      const base64 = window.btoa(css)
      if (base64.length > 0) {
        return 'data:' + contentType + ';base64,' + base64
      } else {
        return ''
      }
    } else {
      return 'data:' + contentType + ';base64,' + this.arrayBufferToBase64(arr)
    }
  }

  static updateInputAttributes(element: Element) {
    if (element.matches('input')) this._updateInputAttribute(element as HTMLInputElement)
    for (const e of element.getElementsByTagName('input')) this._updateInputAttribute(e)
  }

  static _updateInputAttribute(inputElement: HTMLInputElement) {
    if (inputElement.hasAttribute('checked')) {
      if (!inputElement.checked) inputElement.removeAttribute('checked')
    } else {
      if (inputElement.checked) inputElement.setAttribute('checked', '')
    }
    inputElement.setAttribute('value', inputElement.value)
  }

  static setFocus(ele: HTMLElement) {
    ele.dispatchEvent(new FocusEvent('focus'))
    ele.dispatchEvent(
      new CustomEvent('focusin', {
        bubbles: true,
        cancelable: false
      })
    )
    this.focusElement = ele
  }

  static setBlur() {
    if (this.focusElement) {
      this.focusElement.dispatchEvent(new FocusEvent('blur'))
      this.focusElement.dispatchEvent(
        new CustomEvent('focusout', {
          bubbles: true,
          cancelable: false
        })
      )
      this.focusElement = null
    }
  }

  static containsHover(element: Element) {
    for (const t of this.hoverTargetElements) {
      if (element.contains(t)) return true
    }
    return false
  }

  static getDynamicAttributes(element: Element) {
    const layer = this.layers.get(element)
    return (
      `${this.containsHover(element) ? 'data-layer-hover="" ' : ' '}` +
      `${this.getClosestLayer(this.focusElement) === layer ? 'data-layer-focus="" ' : ' '}` +
      `${this.getClosestLayer(this.activeElement) === layer ? 'data-layer-active="" ' : ' '}` +
      `${this.getClosestLayer(this.targetElement) === layer ? 'data-layer-target="" ' : ' '}`
    )
  }
}
