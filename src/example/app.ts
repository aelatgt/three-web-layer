import * as THREE from 'three'
import WebLayer3D from '../three-web-layer'
import TodoMVC, { filters } from './TodoMVC'
import dat from 'dat.gui'
import Noty from 'noty'

import { createXRButton } from './xr'

WebLayer3D.DEBUG = true

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
const renderer = new THREE.WebGLRenderer({ antialias: false })
renderer.setClearColor(new THREE.Color(0xcccccc))
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10)
camera.position.z = 0.7
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
  layerSeparation: 0.001,
  lerpSpeed: 3
}
const gui = new dat.GUI({ hideable: false })
gui.add(Controls, 'showDOM', true).onChange(toggleDOM)
gui.add(Controls, 'moveCamera', true)
gui.add(Controls, 'hoverEffect', true)
gui.add(Controls, 'shadows', true).onChange(toggleShadows)
gui.add(Controls, 'layerSeparation', 0.001, 0.2)
gui.add(Controls, 'lerpSpeed', 0.5, 10)
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

scene.add(new THREE.AmbientLight(0xffffff, 0.8))
const light = new THREE.SpotLight(0xffffff, 0.3)
light.position.set(0, 0, 1.5)
light.angle = 0.3
light.penumbra = 0.8
light.castShadow = true
light.shadow.mapSize.width = 2048
light.shadow.mapSize.height = 2048
light.shadow.bias = -0.0015
light.shadow.camera.far = 3
light.shadow.camera.near = 1
light.shadow.radius = 2
scene.add(light)
const shadowCameraHelper = new THREE.CameraHelper(light.shadow.camera)

// magic: convert DOM hierarchy to WebLayer3D heirarchy
const todoLayer = ((window as any).todoLayer = new WebLayer3D(todoVue.$el, {
  windowWidth: 500,
  pixelRatio: window.devicePixelRatio,
  onLayerCreate(layer) {
    layer.cursor.add(new THREE.Mesh(cursorGeometry))
    layer.mesh.castShadow = true
    layer.mesh.receiveShadow = true
    if (Controls.shadows) {
      layer.mesh.material = makeShadowMaterial()
    } else {
      layer.mesh.material = new THREE.MeshBasicMaterial({ transparent: true })
    }
  }
}))
scene.add(todoLayer)

function makeShadowMaterial() {
  return new THREE.MeshPhongMaterial({
    alphaTest: 0.11,
    side: THREE.DoubleSide
  })
}

// shadows
function toggleShadows(enabled) {
  if (enabled) {
    todoLayer.traverseLayers(layer => {
      layer.mesh.material = makeShadowMaterial()
    })
    // scene.add(shadowCameraHelper)
  } else {
    todoLayer.traverseLayers(layer => {
      layer.mesh.material = new THREE.MeshBasicMaterial({ transparent: true })
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
    todoLayer.refresh(true)
  } else {
    containerStyle.top = '-100000px'
    todoLayer.refresh(true)
  }
}

// enable hover-state rendering
todoLayer.interactionRays = [raycaster.ray]

// setup interaction
document.documentElement.addEventListener('gesturestart', e => e.preventDefault(), {
  passive: false,
  capture: true
})
document.addEventListener('mousemove', onMouseMove, false)
renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false })
renderer.domElement.addEventListener('touchstart', onTouchStart, false)
renderer.domElement.addEventListener('click', onClick, false)

const controller1 = (renderer.vr as any).getController(0)
// controller1.addEventListener( 'selectstart', onSelectStart );
// controller1.addEventListener( 'selectend', onSelectEnd );
scene.add(controller1)

const controller2 = (renderer.vr as any).getController(1)
// controller2.addEventListener( 'selectstart', onSelectStart );
// controller2.addEventListener( 'selectend', onSelectEnd );
scene.add(controller2)

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

// animate
function animate() {
  const deltaTime = clock.getDelta()

  // update camera
  // important: window.innerWidth/window.innerHeight changes when soft-keyboard is up!
  // We want the fixed viewport size, so we use offsetWidth/Height of the documentElement
  const width = document.documentElement.offsetWidth
  const height = document.documentElement.offsetHeight
  const aspect = width / height
  camera.aspect = aspect
  camera.updateProjectionMatrix()
  if (Controls.moveCamera) {
    camera.position.x += (pointer.x * 0.4 - camera.position.x) * 0.05
    camera.position.y += (pointer.y * 0.4 - camera.position.y) * 0.05
  } else {
    camera.position.x = 0
    camera.position.y = 0
  }
  camera.lookAt(scene.position)

  // update our interaction ray
  // important: make sure camera pose is updated first!
  raycaster.setFromCamera(pointer, camera)

  // update our WebLayer3D heirarchy
  // important: update interaction rays first!
  todoLayer.update(deltaTime * Controls.lerpSpeed, (layer, alpha) => {
    const level = layer.element.matches('.info a') ? layer.level - 0.9 : layer.level
    layer.targetContentPosition.z = Controls.layerSeparation * level
    if (Controls.hoverEffect) {
      if (
        layer.hover === 1 &&
        layer.level > 1 &&
        layer.element.nodeName !== 'H1' &&
        !layer.element.matches('.todo-count')
      ) {
        layer.targetContentPosition.z += Controls.layerSeparation * 0.3
        layer.targetContentScale.multiplyScalar(1.1)
      }
    }
    if (layer.needsHiding && layer.element.matches('.todo *')) {
      if (!layer.element.matches('.destroy')) layer.targetContentPosition.y = 0
      layer.targetContentScale.y = 0.001
    }
    if (layer.element.matches('.destroy')) {
      layer.content.position.copy(layer.targetContentPosition)
    }
    WebLayer3D.TRANSITION_DEFAULT(layer, alpha)
  })

  // render!
  renderer.setSize(width, height, false)
  renderer.render(scene, camera)
}

renderer.setAnimationLoop(animate)
