"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const THREE = require("three");
const three_web_layer_1 = require("../three-web-layer");
const TodoMVC_1 = require("./TodoMVC");
if (module.hot) {
    module.hot.dispose(() => {
        window.location.reload();
    });
}
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
camera.position.z = 0.5;
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.style.width = '100vw';
renderer.domElement.style.height = '100vh';
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.setClearColor(new THREE.Color(0x333333));
document.body.appendChild(renderer.domElement);
const todoVue = window.todoVue = new TodoMVC_1.default().$mount();
const todoLayer = window.todoLayer = new three_web_layer_1.default(todoVue.$el, {
    windowWidth: 500,
    layerSeparation: 0.05,
    pixelRatio: window.devicePixelRatio * 2
});
scene.add(todoLayer);
todoLayer.element.parentElement.style.opacity = '1';
todoLayer.element.parentElement.style.pointerEvents = 'auto';
// handle routing
function onHashChange() {
    var visibility = window.location.hash.replace(/#\/?/, '');
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
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;
let mouseX = 0, mouseY = 0;
document.addEventListener('mousemove', onDocumentMouseMove, false);
document.addEventListener('touchstart', onDocumentTouchStart, false);
document.addEventListener('touchmove', onDocumentTouchMove, false);
function onDocumentMouseMove(event) {
    mouseX = event.clientX - windowHalfX;
    mouseY = event.clientY - windowHalfY;
}
function onDocumentTouchStart(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        mouseX = event.touches[0].pageX - windowHalfX;
        mouseY = event.touches[0].pageY - windowHalfY;
    }
}
function onDocumentTouchMove(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        mouseX = event.touches[0].pageX - windowHalfX;
        mouseY = event.touches[0].pageY - windowHalfY;
    }
}
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    todoLayer.update(deltaTime * 5);
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    camera.position.x += (mouseX * 0.001 - camera.position.x) * 0.05;
    camera.position.y += (-mouseY * 0.001 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
}
animate();
//# sourceMappingURL=app.js.map