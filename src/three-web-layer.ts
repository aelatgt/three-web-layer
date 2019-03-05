import * as THREE from 'three'
import ResizeObserver from 'resize-observer-polyfill'
import 'babel-polyfill'

import html2canvas from '@speigg/html2canvas/dist/npm/index'
import { NodeParser } from '@speigg/html2canvas/dist/npm/NodeParser'
import Logger from '@speigg/html2canvas/dist/npm/Logger'
import CanvasRenderer from '@speigg/html2canvas/dist/npm/renderer/CanvasRenderer'
import Renderer from '@speigg/html2canvas/dist/npm/Renderer'
import ResourceLoader from '@speigg/html2canvas/dist/npm/ResourceLoader'
import { FontMetrics } from '@speigg/html2canvas/dist/npm/Font'
import cuid from 'cuid'

export interface WebLayer3DOptions {
  pixelRatio?: number
  layerSeparation?: number
  windowWidth?: number
  windowHeight?: number
  allowTaint?: boolean
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
  static LAYER_ATTRIBUTE = 'data-layer'
  static UID_ATTRIBUTE = 'data-layer-uid'
  static LAYER_CONTAINER_ATTRIBUTE = 'data-layer-container'
  static PIXEL_RATIO_ATTRIBUTE = 'data-layer-pixel-ratio'
  static STATES_ATTRIBUTE = 'data-layer-states'

  static DEFAULT_LAYER_SEPARATION = 0.005
  static DEFAULT_PIXEL_DIMENSIONS = 0.001
  static GEOMETRY = new THREE.PlaneGeometry(1, 1, 2, 2) as THREE.Geometry

  static TRANSITION_DEFAULT = function(layer: WebLayer3D, alpha: number) {
    layer.transitionLayout(alpha)
    layer.transitionEntryExit(alpha)
  }

  element: HTMLElement
  content = new THREE.Object3D()
  mesh = new THREE.Mesh(
    WebLayer3D.GEOMETRY,
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    })
  )

  childLayers: WebLayer3D[] = []
  boundingRect: DOMRect = new DOMRect()
  defaultContentPosition = new THREE.Vector3()
  defaultContentScale = new THREE.Vector3()

  textures: { [state: string]: THREE.Texture } = {
    default: new THREE.Texture(document.createElement('canvas'))
  }

  private _needsRemoval = false
  private _states!: string[]
  private _pixelRatio = 1
  private _currentState = 'default'
  private _resizeObserver: ResizeObserver

  // the following properties are only set on the root layer
  private _mutationObserver?: MutationObserver
  private _clonedDocument?: Document
  private _clonedDocumentPromise?: Promise<Document>
  private _resourceLoader?: any
  private _logger?: any

  constructor(
    element: Element,
    public options: WebLayer3DOptions = {},
    public rootLayer: WebLayer3D = undefined as any,
    public level = 0
  ) {
    super()

    this.element = element as HTMLElement
    this.element.setAttribute(WebLayer3D.LAYER_ATTRIBUTE, this.id.toString())
    this.element.setAttribute(WebLayer3D.UID_ATTRIBUTE, cuid.slug())
    this.rootLayer = rootLayer || this
    this.name = element.id

    if (this.rootLayer === this) {
      this._logger = new Logger(false)
      this._resourceLoader = new ResourceLoader(
        {
          imageTimeout: 15000,
          allowTaint: options.allowTaint || false
        },
        this._logger,
        window
      )
    }

    if (!document.contains(element)) {
      ensureElementIsInDocument(element, options)
    }

    this.add(this.content)
    this.mesh.visible = false

    if (this.rootLayer === this) {
      this.refresh(true)

      const getClosestLayer = (target: HTMLElement) => {
        const closestLayerElement = target.closest(
          `[${WebLayer3D.LAYER_ATTRIBUTE}]`
        )! as HTMLElement
        const id = parseInt(closestLayerElement.getAttribute(WebLayer3D.LAYER_ATTRIBUTE) || '', 10)
        return this.id === id ? this : (this.getObjectById(id) as WebLayer3D)
      }

      const refreshOnChange = (e: Event) => {
        if (!this._updateTargetInClonedDocument(e.target as any)) {
          return this.refresh(true)
        }
        getClosestLayer(e.target as any).refresh()
      }
      element.addEventListener('input', refreshOnChange, { capture: true })
      element.addEventListener('change', refreshOnChange, { capture: true })
      element.addEventListener('focus', refreshOnChange, { capture: true })
      element.addEventListener('blue', refreshOnChange, { capture: true })

      const layersToRefresh = new Set<WebLayer3D>()
      this._mutationObserver = new MutationObserver((records, observer) => {
        for (const record of records) {
          const target =
            record.target.nodeType === Node.ELEMENT_NODE
              ? (record.target as HTMLElement)
              : record.target.parentElement!

          if (
            record.type === 'attributes' &&
            target.getAttribute(record.attributeName!) === record.oldValue
          )
            continue

          if (
            record.type === 'characterData' &&
            (record.target as CharacterData).data === record.oldValue
          )
            continue

          const addedItem = record.addedNodes.item(0) as HTMLElement
          if (
            addedItem &&
            addedItem.classList &&
            addedItem.classList.contains('html2canvas-container')
          )
            continue

          const removedItem = record.removedNodes.item(0) as HTMLElement
          if (
            removedItem &&
            removedItem.classList &&
            removedItem.classList.contains('html2canvas-container')
          )
            continue

          if (record.type === 'childList') {
            return this.refresh(true)
          }

          if (!this._updateTargetInClonedDocument(target, record.type === 'characterData')) {
            return this.refresh(true)
          }

          layersToRefresh.add(getClosestLayer(target))
        }
        for (const layer of layersToRefresh) {
          layer.refresh()
        }
        layersToRefresh.clear()
      })
      this._mutationObserver.observe(element, {
        characterData: true,
        characterDataOldValue: true,
        attributes: true,
        attributeOldValue: true,
        childList: true,
        subtree: true
      })
    }

    this._resizeObserver = new ResizeObserver((records, observer) => {
      this.refresh()
    })
    this._resizeObserver.observe(element)
  }

  get currentState() {
    return this._currentState
  }

  get needsRemoval() {
    return this._needsRemoval
  }

  /**
   * Change the texture state.
   * Note: if a state is not available, the `default` state will be rendered.
   */
  setState(state: string) {
    this._currentState = state
    this._updateMesh()
  }

  /**
   * Update the pose and opacity of this layer (does not rerender the DOM)
   *
   * @param alpha lerp value
   * @param transition transition function (by default, this is WebLayer3D.TRANSITION_DEFAULT)
   * @param children if true, also update child layers
   */
  update(alpha = 1, transition = WebLayer3D.TRANSITION_DEFAULT, children = true) {
    transition(this, alpha)
    if (children) this.traverseLayers(transition, alpha)
  }

  transitionLayout(alpha: number) {
    this.content.position.lerp(this.defaultContentPosition, alpha)
    this.content.scale.lerp(this.defaultContentScale, alpha)
  }

  transitionEntryExit(alpha: number) {
    const material = this.mesh.material as THREE.MeshBasicMaterial
    if (this.needsRemoval) {
      if ('opacity' in material && material.opacity > 0.001) {
        material.opacity = THREE.Math.lerp(material.opacity, 0, alpha)
        material.needsUpdate = true
      } else {
        if (this.parent) this.parent.remove(this)
        this.dispose()
      }
    } else {
      if ('opacity' in material && material.opacity < 1) {
        material.opacity = THREE.Math.lerp(material.opacity, 1, alpha)
        material.needsUpdate = true
      }
    }
  }

  traverseLayers<T extends any[]>(each: (layer: WebLayer3D, ...params: T) => void, ...params: T) {
    for (const child of this.children) {
      if (child instanceof WebLayer3D) {
        each(child, ...params)
        child.traverseLayers(each, ...params)
      }
    }
    return params
  }

  async refresh(forceClone = false): Promise<void> {
    const isRootLayer = this.rootLayer === this
    if (!this.rootLayer._clonedDocument && !this.rootLayer._clonedDocumentPromise) forceClone = true
    if (forceClone && !isRootLayer) return this.rootLayer.refresh(true)

    const element = this.element
    const options = this.options
    const window = element.ownerDocument!.defaultView!

    const pixelRatioDefault =
      options.pixelRatio && options.pixelRatio > 0
        ? options.pixelRatio
        : window.devicePixelRatio || 1
    const pixelRatioAttribute = parseFloat(
      element.getAttribute(WebLayer3D.PIXEL_RATIO_ATTRIBUTE) || '1'
    )
    const pixelRatio =
      isFinite(pixelRatioAttribute) && pixelRatioAttribute > 0
        ? pixelRatioAttribute * pixelRatioDefault
        : pixelRatioDefault
    this._pixelRatio = Math.max(pixelRatio, 10e-6)

    this._states = (element.getAttribute(WebLayer3D.STATES_ATTRIBUTE) || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    this._states.push('default')
    for (const state of this._states) {
      if (!this.textures[state]) {
        this.textures[state] = new THREE.Texture(document.createElement('canvas'))
      }
    }

    this._updateChildLayers()
    this._updateBoundingRect()

    if (isRootLayer && forceClone && !this._clonedDocumentPromise) {
      const oldClonedDocument = this._clonedDocument
      if (oldClonedDocument && oldClonedDocument.defaultView) {
        const container = oldClonedDocument.defaultView.frameElement
        container.remove()
      }
      this._clonedDocument = undefined
      const boundingRect = this.boundingRect
      const clonedPromise = (this._clonedDocumentPromise = new Promise((resolve, reject) => {
        let cloned: Document
        html2canvas(element, {
          logging: false,
          target: [new CanvasRenderer(this.textures.default.image)],
          width: boundingRect.width,
          height: boundingRect.height,
          windowWidth: 'windowWidth' in options ? options.windowWidth : window.innerWidth,
          windowHeight: 'windowHeight' in options ? options.windowHeight : window.innerHeight,
          scale: this._pixelRatio,
          backgroundColor: null,
          allowTaint: options.allowTaint || false,
          onclone: (document: HTMLDocument) => {
            const clonedRootEl = document.querySelector<HTMLElement>(
              `[${WebLayer3D.LAYER_ATTRIBUTE}="${this.rootLayer.id}"]`
            )!
            clonedRootEl.style.visibility = 'visible'
            this._hideChildLayers(document)
            cloned = document
          }
        })
          .then(([canvas]: [HTMLCanvasElement]) => {
            this._showChildLayers(cloned)
            this._updateTexture(canvas, 'default')
            if (clonedPromise !== this._clonedDocumentPromise && cloned.defaultView) {
              cloned.defaultView.frameElement.remove()
            } else {
              this._clonedDocument = cloned
              this._clonedDocumentPromise = undefined
            }
            resolve(cloned)
          })
          .catch(reject)
      }))
    }

    // if cloned document is not attached to the DOM, the root element was refreshed,
    // so wait for the next cloned document
    let clonedDocument = this.rootLayer._clonedDocument!
    while (!clonedDocument || clonedDocument.defaultView === null) {
      clonedDocument =
        this.rootLayer._clonedDocument || (await this.rootLayer._clonedDocumentPromise!)
    }

    const childrenRefreshing = [] as Promise<void>[]
    this.traverseLayers(child => {
      childrenRefreshing.push(child.refresh())
    })

    await this._renderTextures(
      clonedDocument,
      forceClone ? { ...this.textures, default: null as any } : this.textures
    )

    this._updateMesh()
    if (!this.mesh.parent) {
      this.mesh.visible = true
      this.content.position.copy(this.defaultContentPosition)
      this.content.scale.copy(this.defaultContentScale)
      this.content.add(this.mesh)
    }

    return Promise.all(childrenRefreshing).then(() => {})
  }

  dispose() {
    if (this._mutationObserver) this._mutationObserver.disconnect()
    if (this._resizeObserver) this._resizeObserver.disconnect()
    for (const child of this.childLayers) child.dispose()
  }

  private _hideChildLayers(clonedDocument: Document) {
    for (const child of this.childLayers) {
      const clonedEl = clonedDocument.querySelector<HTMLElement>(
        `[${WebLayer3D.LAYER_ATTRIBUTE}="${child.id}"]`
      )
      if (clonedEl && clonedEl.style) {
        clonedEl.style.visibility = 'hidden'
      }
    }
  }

  private _showChildLayers(clonedDocument: Document) {
    for (const child of this.childLayers) {
      const clonedEl = clonedDocument.querySelector<HTMLElement>(
        `[${WebLayer3D.LAYER_ATTRIBUTE}="${child.id}"]`
      )
      if (clonedEl && clonedEl.style) {
        clonedEl.style.visibility = 'visible'
      }
    }
  }

  private _markForRemoval() {
    this._needsRemoval = true
    for (const child of this.children) {
      if (child instanceof WebLayer3D) child._markForRemoval()
    }
  }

  private _updateChildLayers() {
    const element = this.element
    const childLayers = this.childLayers
    const oldChildLayers = childLayers.slice()

    childLayers.length = 0
    traverseDOM(element, this._tryConvertToWebLayer3D, this)

    for (const child of oldChildLayers) {
      if (childLayers.indexOf(child) === -1) child._markForRemoval()
    }
  }

  private _tryConvertToWebLayer3D(el: HTMLElement) {
    const uid = el.getAttribute(WebLayer3D.UID_ATTRIBUTE)
    if (!uid) el.setAttribute(WebLayer3D.UID_ATTRIBUTE, cuid.slug())
    const id = el.getAttribute(WebLayer3D.LAYER_ATTRIBUTE)
    if (id !== null) {
      let child = this.getObjectById(parseInt(id, 10)) as WebLayer3D
      if (!child) {
        child = new WebLayer3D(el, this.options, this.rootLayer, this.level + 1)
        this.add(child)
      }
      this.childLayers.push(child)
      return true // stop traversing this subtree
    }
    return false
  }

  private async _renderTextures(
    clonedDocument: Document,
    textures: typeof WebLayer3D.prototype.textures
  ) {
    if (Object.keys(textures).length === 0) {
      return
    }

    const clonedElement = clonedDocument.querySelector(
      `[${WebLayer3D.LAYER_ATTRIBUTE}="${this.id}"]`
    )!
    if (!clonedElement) return // has been removed

    this._hideChildLayers(clonedDocument)

    const renderFunctions = [] as Function[]
    for (const state in textures) {
      const texture = textures[state]
      if (!texture) {
        continue
      }

      clonedElement.classList.add(state)
      const stack = NodeParser(
        clonedElement,
        this.rootLayer._resourceLoader,
        this.rootLayer._logger
      )
      // stack.container.style.background.backgroundColor = TRANSPARENT
      clonedElement.classList.remove(state)

      renderFunctions.push(() => {
        const canvas = texture.image as HTMLCanvasElement
        const context = canvas.getContext('2d')!
        context.clearRect(0, 0, canvas.width, canvas.height)
        const renderer = new Renderer(new CanvasRenderer(canvas), renderOptions)
        renderer.render(stack)
        this._updateTexture(canvas, state)
      })
    }

    const boundingRect = this.boundingRect
    this._showChildLayers(clonedDocument)
    const fontMetrics = new FontMetrics(clonedDocument)

    const imageStore = await this.rootLayer._resourceLoader.ready()

    const renderOptions = {
      backgroundColor: null,
      fontMetrics,
      imageStore,
      logger: this.rootLayer._logger,
      scale: this._pixelRatio,
      x: boundingRect.left,
      y: boundingRect.top,
      width: boundingRect.width,
      height: boundingRect.height,
      allowTaint: this.options.allowTaint || false
    }

    for (const render of renderFunctions) render()
  }

  private _updateBoundingRect() {
    const boundingRect = (this.boundingRect = this.element.getBoundingClientRect() as DOMRect)
    const pixelSize = WebLayer3D.DEFAULT_PIXEL_DIMENSIONS

    if (this.rootLayer !== this) {
      const layerSeparation = this.options.layerSeparation || WebLayer3D.DEFAULT_LAYER_SEPARATION

      const rootBoundingRect = this.rootLayer.boundingRect
      const rootOriginX = pixelSize * (-rootBoundingRect.width / 2)
      const rootOriginY = pixelSize * (rootBoundingRect.height / 2)

      const myLeft = pixelSize * (boundingRect.left + boundingRect.width / 2)
      const myTop = pixelSize * (boundingRect.top + boundingRect.height / 2)

      this.defaultContentPosition.set(
        rootOriginX + myLeft,
        rootOriginY - myTop,
        layerSeparation * this.level
      )
    }

    this.defaultContentScale.set(
      Math.max(pixelSize * boundingRect.width, 10e-6),
      Math.max(pixelSize * boundingRect.height, 10e-6),
      1
    )
  }

  private _updateTexture(canvas: HTMLCanvasElement, state = 'default') {
    const stateTexture = this.textures[state]
    if (!stateTexture) {
      throw new Error(`Missing texture for state: ${state}`)
    }
    stateTexture.image = canvas
    stateTexture.minFilter = THREE.LinearFilter
    stateTexture.needsUpdate = true
  }

  _updateTargetInClonedDocument(target: HTMLElement, updateTextContent = false): boolean {
    if (!target) return false
    const targetElement =
      target.nodeType === Node.ELEMENT_NODE ? (target as HTMLElement) : target.parentElement!
    if (!targetElement) return false
    const clonedTarget = this._getClonedElement(targetElement)
    const document = clonedTarget && clonedTarget.ownerDocument
    if (
      clonedTarget &&
      clonedTarget.parentNode &&
      document &&
      document.defaultView &&
      targetElement.style
    ) {
      for (const id of Object.keys(targetElement.attributes)) {
        const attr = targetElement.attributes[id]
        clonedTarget.setAttribute(attr.name, attr.value)
      }
      // clonedTarget.style.cssText = targetElement.ownerDocument!.defaultView!.getComputedStyle(targetElement).cssText
      if (clonedTarget.nodeName === 'INPUT' || clonedTarget.nodeName === 'TEXTAREA') {
        const targetInput = targetElement as HTMLInputElement & HTMLTextAreaElement
        const clonedInput = clonedTarget as HTMLInputElement & HTMLTextAreaElement
        clonedInput.value = targetInput.value
        clonedInput.checked = targetInput.checked
      }
      if (updateTextContent) clonedTarget.innerHTML = target.innerHTML
      return true
    } else {
      return false
    }
  }

  private _getUniqueSelector(target: HTMLElement) {
    return `[${WebLayer3D.UID_ATTRIBUTE}="${target.getAttribute(WebLayer3D.UID_ATTRIBUTE)}"]`
  }

  private _getClonedElement(target: HTMLElement) {
    if (!this.rootLayer._clonedDocument) return null
    return this.rootLayer._clonedDocument.querySelector(
      this._getUniqueSelector(target)
    ) as HTMLElement
  }

  private _updateMesh() {
    // cleanup unused textures
    const states = this._states
    for (const state in this.textures) {
      if (!states.includes(state)) {
        this.textures[state].dispose()
        delete this.textures[state]
      }
    }
    const mesh = this.mesh
    const texture = this.textures[this._currentState] || this.textures.default
    const material = mesh.material as THREE.MeshBasicMaterial
    material.map = texture
    material.needsUpdate = true
  }
}

function ensureElementIsInDocument(element: Element, options: WebLayer3DOptions): Element {
  const document = element.ownerDocument!
  if (document.contains(element)) {
    return element
  }

  const container = document.createElement('div')
  container.setAttribute(WebLayer3D.LAYER_CONTAINER_ATTRIBUTE, '')
  container.style.opacity = '0'
  container.style.pointerEvents = 'none'
  container.style.position = 'absolute'
  container.style.width = 'windowWidth' in options ? options.windowWidth + 'px' : '550px'
  container.style.height = 'windowHeight' in options ? options.windowHeight + 'px' : '150px'
  container.style.top = '0'
  container.style.left = '0'

  container.appendChild(element)
  document.body
    ? document.body.appendChild(container)
    : document.documentElement.appendChild(container)
  return element
}

function traverseDOM(node: Node, each: (node: HTMLElement) => boolean, bind?: any) {
  for (let child: Node | null = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      if (!each.call(bind, el)) {
        traverseDOM(el, each, bind)
      }
    }
  }
}

// const getUniqueSelector = (() => {
//   let sSel : string
//   let aSel: string[]
//   // Derive selector from element
//   function getSelector(el: HTMLElement) {
//     // 1. Check ID first
//     // NOTE: ID must be unique amongst all IDs in an HTML5 document.
//     // https://www.w3.org/TR/html5/dom.html#the-id-attribute
//     if (el.id) {
//       aSel.unshift('#' + el.id)
//       return true
//     }
//     aSel.unshift(sSel = el.nodeName.toLowerCase())
//     // Try to select by nth-of-type() as a fallback for generic elements
//     var elChild: Element|null = el, n = 1
//     while (elChild = elChild.previousElementSibling) {
//       if (elChild.nodeName===el.nodeName) ++n
//     }
//     aSel[0] = sSel += ':nth-of-type(' + n + ')'
//     if (uniqueQuery()) return true
//     // Try to select by nth-child() as a last resort
//     elChild = el
//     n = 1
//     while (elChild = elChild.previousElementSibling) ++n
//     aSel[0] = sSel = sSel.replace(/:nth-of-type\(\d+\)/, n>1 ? ':nth-child(' + n + ')' : ':first-child')
//     if (uniqueQuery()) return true
//     return false
//   }
//   // Test query to see if it returns one element
//   function uniqueQuery() {
//     const query = aSel.join('>')
//     return query ? document.querySelectorAll(query).length===1 : false
//   }
//   // Walk up the DOM tree to compile a unique selector
//   return function getUniqueSelector(elSrc: Node) {
//     if (!(elSrc instanceof Element)) return
//     aSel = []
//     while (elSrc.parentNode) {
//       if (getSelector(elSrc as HTMLElement)) return aSel.join(' > ')
//       elSrc = elSrc.parentNode
//     }
//   }
// })()
