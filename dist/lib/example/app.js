"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const THREE = require("three");
const three_web_layer_1 = require("../three-web-layer");
const TodoMVC_1 = require("./TodoMVC");
const dat_gui_1 = require("dat.gui");
// reload on changes during development
if (module.hot) {
    module.hot.dispose(() => {
        window.location.reload();
    });
}
// controls
const Controls = {
    showDOM: false,
    layerSeparation: 0.001
};
const gui = new dat_gui_1.default.GUI();
gui.add(Controls, 'showDOM', false);
gui.add(Controls, 'layerSeparation', 0.001, 0.1);
gui.domElement.style.border = '0';
gui.domElement.parentElement.style.zIndex = '1';
// basic setup
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
camera.position.z = 0.5;
const scene = new THREE.Scene();
const clock = new THREE.Clock();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.style.width = '100vw';
renderer.domElement.style.height = '100vh';
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.setClearColor(new THREE.Color(0xcccccc));
renderer.setPixelRatio(window.devicePixelRatio);
document.body.insertBefore(renderer.domElement, document.body.firstChild);
// setup interaction
const raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
document.addEventListener('mousemove', onDocumentMouseMove, false);
document.addEventListener('touchstart', onDocumentTouchStart, false);
document.addEventListener('touchmove', onDocumentTouchMove, false);
renderer.domElement.addEventListener('click', onCanvasClick, false);
function updateMouse(clientX, clientY) {
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
}
function onDocumentMouseMove(event) {
    updateMouse(event.clientX, event.clientY);
}
function onDocumentTouchStart(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        updateMouse(event.touches[0].clientX, event.touches[0].clientY);
    }
}
function onDocumentTouchMove(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        updateMouse(event.touches[0].clientX, event.touches[0].clientY);
    }
}
function onCanvasClick(event) {
    if (event.target === renderer.domElement) {
        raycaster.setFromCamera(mouse, camera);
        const layer = todoLayer.getLayerForRay(raycaster.ray);
        if (layer) {
            layer.element.click();
            layer.element.focus();
        }
    }
}
function onCanvasDoubleClick(event) {
    if (event.target === renderer.domElement) {
        raycaster.setFromCamera(mouse, camera);
        const layer = todoLayer.getLayerForRay(raycaster.ray);
        if (layer) {
            layer.element.click();
            layer.element.focus();
        }
    }
}
// create and mount Vue instance (without attaching to DOM)
const todoVue = (window.todoVue = new TodoMVC_1.default().$mount());
// handle routing (use Vue's reactive properties to update the DOM)
function onHashChange() {
    const visibility = window.location.hash.replace(/#\/?/, '');
    if (TodoMVC_1.filters[visibility]) {
        todoVue.visibility = visibility;
    }
    else {
        window.location.hash = '';
        todoVue.visibility = 'all';
    }
}
window.addEventListener('hashchange', onHashChange);
onHashChange();
const cursorGeometry = new THREE.SphereGeometry(0.01);
// create WebLayer3D instance with HTMLElement
// (element will be mounted in a hidden and non-interactive container if not already in DOM)
const todoLayer = (window.todoLayer = new three_web_layer_1.default(todoVue.$el, {
    windowWidth: 500,
    layerSeparation: 0.001,
    pixelRatio: window.devicePixelRatio * 1.5,
    onLayerCreate(layer) {
        // do something every time a layer is created
        layer.cursor.add(new THREE.Mesh(cursorGeometry));
    }
}));
// in this case, we actually want the container to be visible and interactive
todoLayer.element.parentElement.style.opacity = '1';
todoLayer.element.parentElement.style.pointerEvents = 'auto';
todoLayer.interactionRays = [raycaster.ray]; // enable hover-state rendering
scene.add(todoLayer);
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    camera.position.x += (mouse.x * 0.3 - camera.position.x) * 0.05;
    camera.position.y += (-mouse.y * 0.3 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);
    raycaster.setFromCamera(mouse, camera);
    todoLayer.traverseLayers(layer => {
        layer.defaultContentPosition.z = Controls.layerSeparation * layer.level;
    });
    todoLayer.update(deltaTime * 5);
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
    if (Controls.showDOM) {
        todoLayer.element.parentElement.style.opacity = '1';
        todoLayer.element.parentElement.style.pointerEvents = 'auto';
    }
    else {
        todoLayer.element.parentElement.style.opacity = '0';
        todoLayer.element.parentElement.style.pointerEvents = 'none';
    }
}
animate();
//# sourceMappingURL=app.js.map