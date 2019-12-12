import * as THREE from 'three'
import { WebLayer3D, WebLayer3DBase } from '../three/three-web-layer'
import TodoMVC, { filters } from './TodoMVC'
import dat from 'dat.gui'
import Noty from 'noty'
import Stats from 'stats.js'
import * as ethereal from 'ethereal'

import { createXRButton } from './xr'

const stats = new Stats()
stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
stats.dom.style.bottom = '0'
stats.dom.style.top = ''
document.body.appendChild(stats.dom)

WebLayer3D.DEBUG_PERFORMANCE = true

// reload on changes during development
if (module.hot) {
  module.hot.dispose(() => {
    window.location.reload()
  })
}

// setup some informational notifications
const notes = [
  'FYI, this is running in WebGL, using three.js!',
  'In this demo, web content is rendered to the DOM by VueJS',
  'The Vue-managed DOM hierarchy is rendered to WebGL by a WebLayer3D instance',
  'Internally, WebLayer3D uses html2canvas.js to render DOM content to a 2D canvas',
  'Input events are seamlessly redirected from the WebGL canvas, into the 3D scene, and back out to the underlying DOM',
  '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ← Check out the source!'
]
const interval = setInterval(() => {
  const last = notes.length === 1
  new Noty({
    type: last ? 'success' : 'info',
    layout: last ? 'topLeft' : 'bottomCenter',
    timeout: 8000,
    progressBar: true,
    text: notes.shift()
  }).show()
  if (last) clearInterval(interval)
}, 12000)

// setup three.js
const scene = new THREE.Scene()
const clock = new THREE.Clock()
const renderer = ((window as any).renderer = new THREE.WebGLRenderer({ antialias: false }))
renderer.setClearColor(new THREE.Color('#151513'))
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
const camera = ((window as any).camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10))
scene.add(camera)

// setup DOM
document.documentElement.style.width = '100%'
document.documentElement.style.height = '100%'
renderer.domElement.style.width = '100%'
renderer.domElement.style.height = '100%'
renderer.domElement.style.position = 'fixed'
document.body.append(renderer.domElement)
document.body.style.touchAction = 'none'
document.body.appendChild(createXRButton(renderer))

// setup controls
const Controls = {
  showDOM: false,
  moveCamera: true,
  hoverEffect: true,
  shadows: false,
  layerSeparation: 1,
  lerpSpeed: 3,
  layout: 'dom' as 'dom' | 'custom'
}
const gui = new dat.GUI({ hideable: false })
gui.add(Controls, 'showDOM', true).onChange(toggleDOM)
gui.add(Controls, 'moveCamera', true)
gui.add(Controls, 'hoverEffect', true)
gui.add(Controls, 'shadows', true).onChange(toggleShadows)
gui.add(Controls, 'layerSeparation', 1, 20)
gui.add(Controls, 'lerpSpeed', 0.5, 10)
gui.add(Controls, 'layout', ['dom', 'custom'])
gui.domElement.style.border = '0'
gui.domElement.style.position = 'fixed'
gui.domElement.style.right = '0'
if (window.innerWidth < 600) gui.close()

// create and mount Vue instance (without attaching to DOM)
const todoVue = ((window as any).todoVue = new TodoMVC().$mount())

// handle routing (use Vue's reactive properties to update the DOM)
function onHashChange() {
  const visibility = window.location.hash.replace(/#\/?/, '')
  if (filters[visibility]) {
    todoVue.visibility = visibility as any
  } else {
    window.location.hash = ''
    todoVue.visibility = 'all'
  }
}
window.addEventListener('hashchange', onHashChange)
onHashChange()

// setup scene
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const cursorGeometry = new THREE.SphereGeometry(0.008)

scene.add(new THREE.AmbientLight(0xffffff, 0.9))
const light = new THREE.SpotLight(0xffffff, 0.1)
light.position.set(0, 0, 2.5)
light.angle = 0.3
light.penumbra = 0.8
light.castShadow = true
light.shadow.mapSize.width = 4096
light.shadow.mapSize.height = 4096
light.shadow.bias = -0.0008
light.shadow.camera.far = 3
light.shadow.camera.near = 1
light.shadow.radius = 1
scene.add(light)
const shadowCameraHelper = new THREE.CameraHelper(light.shadow.camera)

const crosshair = new THREE.Mesh(
  new THREE.RingBufferGeometry(0.02, 0.04, 32),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    opacity: 0.5,
    transparent: true
  })
)
crosshair.position.z = -2
camera.add(crosshair)

// magic: convert DOM hierarchy to WebLayer3D heirarchy
const todoLayer = ((window as any).todoLayer = new WebLayer3D(todoVue.$el, {
  pixelRatio: window.devicePixelRatio,
  onLayerCreate(layer) {
    layer.cursor.add(new THREE.Mesh(cursorGeometry))
    layer.contentMesh.castShadow = true
    layer.contentMesh.receiveShadow = true
    if (Controls.shadows) {
      layer.contentMesh.material = makeShadowMaterial(layer)
    } else {
      layer.contentMesh.material = makeDefaultMaterial(layer)
    }
  }
}))
scene.add(todoLayer)

function makeShadowMaterial(layer: WebLayer3DBase) {
  return new THREE.MeshPhongMaterial({
    alphaTest: 0.01,
    side: THREE.DoubleSide,
    premultipliedAlpha: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    opacity: (layer.contentMesh.material as THREE.Material).opacity
  })
}

function makeDefaultMaterial(layer: WebLayer3DBase) {
  return new THREE.MeshBasicMaterial({
    transparent: true,
    alphaTest: 0.001,
    opacity: (layer.contentMesh.material as THREE.Material).opacity
  })
}

// shadows
function toggleShadows(enabled) {
  if (enabled) {
    todoLayer.traverseLayers(layer => {
      layer.contentMesh.material = makeShadowMaterial(layer)
    })
    // scene.add(shadowCameraHelper)
  } else {
    todoLayer.traverseLayers(layer => {
      layer.contentMesh.material = makeDefaultMaterial(layer)
    })
    // scene.remove(shadowCameraHelper)
  }
}

function toggleDOM(enabled) {
  // show/hide the Vue-managed DOM
  const containerStyle = todoLayer.element.parentElement!.style
  if (enabled) {
    containerStyle.top = ''
    containerStyle.bottom = '0px'
    containerStyle.overflow = 'auto'
    containerStyle.height = '100vh'
    containerStyle.transform = 'scale(0.5)'
    containerStyle.transformOrigin = 'bottom left'
    todoLayer.needsRefresh = true
  } else {
    containerStyle.top = '-100000px'
    todoLayer.needsRefresh = true
  }
}

// enable hover-state rendering
const mouseRays = [raycaster.ray]
todoLayer.interactionRays = mouseRays

// setup interaction
document.documentElement.addEventListener('gesturestart', e => e.preventDefault(), {
  passive: false,
  capture: true
})
document.addEventListener('mousemove', onMouseMove, false)
renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false })
renderer.domElement.addEventListener('touchstart', onTouchStart, false)
renderer.domElement.addEventListener('click', onClick, false)

function updateRay(x, y) {
  pointer.x = ((x + window.pageXOffset) / document.documentElement.offsetWidth) * 2 - 1
  pointer.y = (-(y + window.pageYOffset) / document.documentElement.offsetHeight) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
}

function onMouseMove(event) {
  updateRay(event.clientX, event.clientY)
}

function onClick(event) {
  updateRay(event.clientX, event.clientY)
  redirectEvent(event)
}

function onTouchMove(event) {
  event.preventDefault() // disable scrolling
  updateRay(event.touches[0].clientX, event.touches[0].clientY)
}

function onTouchStart(event) {
  updateRay(event.touches[0].clientX, event.touches[0].clientY)
  redirectEvent(event)
}

// redirect DOM events from the canvas, to the 3D scene,
// to the appropriate child Web3DLayer, and finally (back) to the
// DOM to dispatch an event on the intended DOM target
function redirectEvent(evt) {
  const hit = todoLayer.hitTest(raycaster.ray)
  if (hit) {
    hit.target.dispatchEvent(new evt.constructor(evt.type, evt))
    hit.target.focus()
    console.log('hit', hit.target, hit.layer)
  }
}

const controller1 = (renderer.vr as any).getController(0) as THREE.Object3D
controller1.add(new THREE.Mesh(cursorGeometry))
const ray1 = new THREE.Object3D()
// ray1.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1), Math.PI
ray1.scale.set(1, 1, -1)
controller1.add(ray1)
const arrow1 = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, -1),
  undefined,
  100,
  Math.random() * 0xffffff
)
controller1.add(arrow1)
controller1.addEventListener('select', onSelect)
scene.add(controller1)

const controller2 = (renderer.vr as any).getController(1) as THREE.Object3D
controller2.add(new THREE.Mesh(cursorGeometry))
const ray2 = new THREE.Object3D()
ray2.scale.set(1, 1, -1)
// ray2.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1), Math.PI)
controller2.add(ray2)
const arrow2 = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, -1),
  undefined,
  100,
  Math.random() * 0xffffff
)
controller2.add(arrow2)
controller2.addEventListener('select', onSelect)
scene.add(controller2)

const controller5 = (renderer.vr as any).getController(2) as THREE.Object3D
controller5.addEventListener('select', onSelect)
scene.add(controller5)

function onSelect(evt: THREE.Event) {
  const controller = evt.target as THREE.Object3D
  raycaster.ray.set(controller.position, controller.getWorldDirection(new THREE.Vector3()).negate())
  const hit = todoLayer.hitTest(raycaster.ray)
  if (hit) {
    hit.target.click()
    hit.target.focus()
    console.log('hit', hit.target, hit.layer)
  }
}

const immersiveRays = [ray1, ray2]
const todoLayerTargetPosition = new THREE.Vector3()
const todoLayerTargetQuaternion = new THREE.Quaternion()
const currentTargetPosition = new THREE.Vector3()

// animate
function animate() {
  stats.begin()
  const deltaTime = Math.min(clock.getDelta(), 1 / 60)
  const lerpValue = Math.min(deltaTime * Controls.lerpSpeed, 1)

  // update camera
  if (renderer.vr.enabled && renderer.vr.getDevice()) {
    renderer.vr.getCamera(camera)
    currentTargetPosition.set(0, 0, -1.5)
    camera.localToWorld(currentTargetPosition)
    if (currentTargetPosition.distanceTo(todoLayerTargetPosition) > 1.5) {
      todoLayerTargetPosition.copy(currentTargetPosition)
      todoLayerTargetQuaternion.copy(camera.quaternion)
    }
    todoLayer.position.lerp(todoLayerTargetPosition, lerpValue)
    todoLayer.quaternion.slerp(todoLayerTargetQuaternion, lerpValue)
    todoLayer.interactionRays = immersiveRays
  } else {
    const width = renderer.domElement.offsetWidth
    const height = renderer.domElement.offsetHeight
    const aspect = width / height
    camera.aspect = aspect
    camera.updateProjectionMatrix()

    if (Controls.moveCamera) {
      const sphericalDirection = ethereal.vectors2.get().set(pointer.x * 45, pointer.y * 45)
      ethereal.SpatialMetrics.getCartesianForSphericalDirection(sphericalDirection, camera.position)
      ethereal.vectors2.pool(sphericalDirection)
      camera.position.z *= -0.8
    } else {
      camera.position.x = 0
      camera.position.y = 0
    }

    camera.updateWorldMatrix(true, true)
    camera.lookAt(scene.position)
    renderer.setSize(width, height, false)
    todoLayer.position.set(0, 0, 0)
    todoLayer.quaternion.set(0, 0, 0, 1)
    todoLayer.interactionRays = mouseRays
    // update our interaction ray
    // important: make sure camera pose is updated first!
    raycaster.setFromCamera(pointer, camera)
  }

  // update our target states
  // important: update interaction rays first!

  if (Controls.layout === 'custom') {
    todoLayer.contentOpacity.target = 0
    const h1Layer = todoLayer.querySelector('h1')!
    const infoLayer = todoLayer.querySelector('.info')!
    const mainLayer = todoLayer.querySelector('.todoapp')!
    h1Layer.position.set(-0.4, 0.05, 0)
    infoLayer.position.set(-0.2, -0.05, 0)
    mainLayer.position.set(0.2, 0, 0)
    mainLayer.contentOpacity.target = 0
  } else {
    todoLayer.position.z = 0
  }

  todoLayer.traverseLayers(layer => {
    layer.transitioner.multiplier = Controls.lerpSpeed
    layer.content.transitioner.multiplier = Controls.lerpSpeed

    if (layer.element.matches('.destroy')) {
      layer.transitioner.duration = 0.5
      layer.content.transitioner.duration = 0.5
    } else {
      layer.transitioner.duration = 1
      layer.content.transitioner.duration = 1
    }

    layer.position.z *= Controls.layerSeparation

    if (layer.element.matches('.todo-list li *') && layer.contentOpacity.target === 0) {
      if (!layer.element.matches('.destroy')) layer.position.y = 0
      layer.scale.y = 0.001
    }

    hover: if (Controls.hoverEffect && layer.hover) {
      if (layer.element.matches('.todo *, .toggle, .destroy, a')) {
        layer.scale.multiplyScalar(1.02)
        break hover
      }
    }
  })

  // update transitions
  todoLayer.update(deltaTime)

  // render!
  renderer.render(scene, camera)
  stats.end()
}

renderer.setAnimationLoop(animate)
