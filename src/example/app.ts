import * as THREE from 'three'
import WebLayer3D from '../three-web-layer'
import TodoMVC, { filters } from './TodoMVC'
import dat from 'dat.gui'
import Noty from 'noty'

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
  'The Vue-managed DOM heiarchy is then wrapped in a WebLayer3D instance',
  'Internally, WebLayer3D uses html2canvas.js to render DOM content to WebGL',
  'Input events are seamlessly redirected from the WebGL canvas, into the 3D scene, and back to the underlying DOM',
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
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setClearColor(new THREE.Color(0xcccccc))
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10)
camera.position.z = 0.8
scene.add(camera)

// setup DOM
const containerElement = document.body
document.documentElement.style.width = '100%'
document.documentElement.style.height = '100%'
renderer.domElement.style.width = '100%'
renderer.domElement.style.height = '100%'
renderer.domElement.style.position = 'fixed'
document.body.append(renderer.domElement)
document.body.style.touchAction = 'none'

// setup controls
const Controls = {
  showDOM: false,
  hoverEffect: true,
  cameraMovement: true,
  layerSeparation: 0.01,
  lerpSpeed: 3,
  material: 'basic'
}
const gui = new dat.GUI()
gui.add(Controls, 'showDOM', false)
gui.add(Controls, 'cameraMovement', true)
gui.add(Controls, 'hoverEffect', true)
gui.add(Controls, 'layerSeparation', 0.001, 0.15)
gui.add(Controls, 'lerpSpeed', 0.5, 10)
gui.add(Controls, 'material', ['basic', 'toon'])
gui.domElement.style.border = '0'
gui.domElement.style.position = 'fixed'
gui.domElement.style.right = '0'

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
const mouse = new THREE.Vector2()
const cursorGeometry = new THREE.SphereGeometry(0.008)

scene.add(new THREE.AmbientLight(0xaaaaaa))
const light = new THREE.DirectionalLight(0xdfebff, 1)
light.position.set(0.1, 0.1, 0.1)
// light.position.multiplyScalar( 1.3 );
light.castShadow = true
light.shadow.mapSize.width = 1024
light.shadow.mapSize.height = 1024
var d = 300
light.shadow.camera.left = -d
light.shadow.camera.right = d
light.shadow.camera.top = d
light.shadow.camera.bottom = -d
light.shadow.camera.far = 1000
camera.add(light)
scene.add(light)

// magic: convert DOM hierarchy to WebLayer3D heirarchy
const todoLayer = ((window as any).todoLayer = new WebLayer3D(todoVue.$el, {
  windowWidth: 500,
  layerSeparation: 0.001,
  pixelRatio: window.devicePixelRatio,
  onLayerCreate(layer) {
    layer.cursor.add(new THREE.Mesh(cursorGeometry))
    layer.mesh.castShadow = true
    layer.mesh.receiveShadow = true
  }
}))
scene.add(todoLayer)

// enable hover-state rendering
todoLayer.interactionRays = [raycaster.ray]

// setup interaction
document.documentElement.addEventListener('gesturestart', e => e.preventDefault(), {
  passive: false,
  capture: true
})
document.addEventListener('mousemove', onMouseMove, false)
renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false })
renderer.domElement.addEventListener('touchstart', redirectEvent)
renderer.domElement.addEventListener('click', redirectEvent, false)

function updateMouse(x, y) {
  mouse.x = (x / document.documentElement.offsetWidth) * 2 - 1
  mouse.y = -(y / document.documentElement.offsetHeight) * 2 + 1
}

function onMouseMove(event) {
  updateMouse(event.clientX, event.clientY)
}

function onTouchMove(event) {
  event.preventDefault() // disable scrolling
  updateMouse(event.touches[0].clientX, event.touches[0].clientY)
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
  requestAnimationFrame(animate)
  const deltaTime = clock.getDelta()

  // update camera
  // important: window.innerWidth/window.innerHeight changes when soft-keyboard is up!
  // We want the fixed viewport size, so we use offsetWidth/Height of the documentElement
  const width = document.documentElement.offsetWidth
  const height = document.documentElement.offsetHeight
  const aspect = width / height
  camera.aspect = aspect
  camera.updateProjectionMatrix()
  if (Controls.cameraMovement) {
    camera.position.x += (mouse.x * 0.3 - camera.position.x) * 0.05
    camera.position.y += (mouse.y * 0.3 - camera.position.y) * 0.05
  } else {
    camera.position.x = 0
    camera.position.y = 0
  }
  camera.lookAt(scene.position)

  // update our interaction ray
  // important: make sure camera pose is updated first!
  raycaster.setFromCamera(mouse, camera)

  // update our WebLayer3D heirarchy
  // important: update interaction rays first!
  todoLayer.update(deltaTime * Controls.lerpSpeed, (layer, alpha) => {
    const level = layer.element.matches('.info a') ? layer.level - 0.9 : layer.level
    layer.defaultContentPosition.z = Controls.layerSeparation * level
    if (Controls.hoverEffect) {
      if (layer.hover && layer.level > 1) {
        layer.defaultContentPosition.z += 0.005
        layer.defaultContentScale.multiplyScalar(1.05)
      }
    }
    WebLayer3D.TRANSITION_DEFAULT(layer, alpha)
  })

  // render!
  renderer.setSize(width, height, false)
  renderer.render(scene, camera)

  // show/hide the Vue-managed DOM
  const containerStyle = todoLayer.element.parentElement!.style
  if (Controls.showDOM) {
    containerStyle.top = '0px'
    containerStyle.overflow = 'auto'
    containerStyle.height = '100vh'
    containerStyle.transform = 'scale(0.5)'
    containerStyle.transformOrigin = '0 0'
  } else {
    containerStyle.top = '-100000px'
  }
}

animate()
