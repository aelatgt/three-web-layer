"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const THREE = require("three");
const three_web_layer_1 = require("../three-web-layer");
const TodoMVC_1 = require("./TodoMVC");
const dat_gui_1 = require("dat.gui");
const noty_1 = require("noty");
const stats_js_1 = require("stats.js");
const xr_1 = require("./xr");
const stats = new stats_js_1.default();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
stats.dom.style.bottom = '0';
stats.dom.style.top = '';
document.body.appendChild(stats.dom);
three_web_layer_1.default.DEBUG_PERFORMANCE = true;
// reload on changes during development
if (module.hot) {
    module.hot.dispose(() => {
        window.location.reload();
    });
}
// setup some informational notifications
const notes = [
    'FYI, this is running in WebGL, using three.js!',
    'In this demo, web content is rendered to the DOM by VueJS',
    'The Vue-managed DOM hierarchy is rendered to WebGL by a WebLayer3D instance',
    'Internally, WebLayer3D uses html2canvas.js to render DOM content to a 2D canvas',
    'Input events are seamlessly redirected from the WebGL canvas, into the 3D scene, and back out to the underlying DOM',
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ← Check out the source!'
];
const interval = setInterval(() => {
    const last = notes.length === 1;
    new noty_1.default({
        type: last ? 'success' : 'info',
        layout: last ? 'topLeft' : 'bottomCenter',
        timeout: 8000,
        progressBar: true,
        text: notes.shift()
    }).show();
    if (last)
        clearInterval(interval);
}, 12000);
// setup three.js
const scene = new THREE.Scene();
const clock = new THREE.Clock();
const renderer = (window.renderer = new THREE.WebGLRenderer({ antialias: false }));
renderer.setClearColor(new THREE.Color('#151513'));
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
const camera = (window.camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10));
scene.add(camera);
// setup DOM
document.documentElement.style.width = '100%';
document.documentElement.style.height = '100%';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.position = 'fixed';
document.body.append(renderer.domElement);
document.body.style.touchAction = 'none';
document.body.appendChild(xr_1.createXRButton(renderer));
// setup controls
const Controls = {
    showDOM: false,
    moveCamera: true,
    hoverEffect: true,
    shadows: false,
    layerSeparation: 0.002,
    lerpSpeed: 3,
    layout: 'dom'
};
const gui = new dat_gui_1.default.GUI({ hideable: false });
gui.add(Controls, 'showDOM', true).onChange(toggleDOM);
gui.add(Controls, 'moveCamera', true);
gui.add(Controls, 'hoverEffect', true);
gui.add(Controls, 'shadows', true).onChange(toggleShadows);
gui.add(Controls, 'layerSeparation', 0.002, 0.2);
gui.add(Controls, 'lerpSpeed', 0.5, 10);
gui.add(Controls, 'layout', ['dom', 'custom']);
gui.domElement.style.border = '0';
gui.domElement.style.position = 'fixed';
gui.domElement.style.right = '0';
if (window.innerWidth < 600)
    gui.close();
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
// setup scene
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const cursorGeometry = new THREE.SphereGeometry(0.008);
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const light = new THREE.SpotLight(0xffffff, 0.1);
light.position.set(0, 0, 2.5);
light.angle = 0.3;
light.penumbra = 0.8;
light.castShadow = true;
light.shadow.mapSize.width = 4096;
light.shadow.mapSize.height = 4096;
light.shadow.bias = -0.0008;
light.shadow.camera.far = 3;
light.shadow.camera.near = 1;
light.shadow.radius = 1;
scene.add(light);
const shadowCameraHelper = new THREE.CameraHelper(light.shadow.camera);
const crosshair = new THREE.Mesh(new THREE.RingBufferGeometry(0.02, 0.04, 32), new THREE.MeshBasicMaterial({
    color: 0xffffff,
    opacity: 0.5,
    transparent: true
}));
crosshair.position.z = -2;
camera.add(crosshair);
// magic: convert DOM hierarchy to WebLayer3D heirarchy
const todoLayer = (window.todoLayer = new three_web_layer_1.default(todoVue.$el, {
    windowWidth: 500,
    pixelRatio: window.devicePixelRatio,
    onLayerCreate(layer) {
        layer.cursor.add(new THREE.Mesh(cursorGeometry));
        layer.mesh.castShadow = true;
        layer.mesh.receiveShadow = true;
        if (Controls.shadows) {
            layer.mesh.material = makeShadowMaterial(layer);
        }
        else {
            layer.mesh.material = makeDefaultMaterial(layer);
        }
    }
}));
scene.add(todoLayer);
function makeShadowMaterial(layer) {
    return new THREE.MeshPhongMaterial({
        alphaTest: 0.01,
        side: THREE.DoubleSide,
        premultipliedAlpha: true,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        opacity: layer.mesh.material.opacity
    });
}
function makeDefaultMaterial(layer) {
    return new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.001,
        opacity: layer.mesh.material.opacity
    });
}
// shadows
function toggleShadows(enabled) {
    if (enabled) {
        todoLayer.traverseLayers(layer => {
            layer.mesh.material = makeShadowMaterial(layer);
        });
        // scene.add(shadowCameraHelper)
    }
    else {
        todoLayer.traverseLayers(layer => {
            layer.mesh.material = makeDefaultMaterial(layer);
        });
        // scene.remove(shadowCameraHelper)
    }
}
function toggleDOM(enabled) {
    // show/hide the Vue-managed DOM
    const containerStyle = todoLayer.element.parentElement.style;
    if (enabled) {
        containerStyle.top = '';
        containerStyle.bottom = '0px';
        containerStyle.overflow = 'auto';
        containerStyle.height = '100vh';
        containerStyle.transform = 'scale(0.5)';
        containerStyle.transformOrigin = 'bottom left';
        todoLayer.refresh(true);
    }
    else {
        containerStyle.top = '-100000px';
        todoLayer.refresh(true);
    }
}
// enable hover-state rendering
const mouseRays = [raycaster.ray];
todoLayer.interactionRays = mouseRays;
// setup interaction
document.documentElement.addEventListener('gesturestart', e => e.preventDefault(), {
    passive: false,
    capture: true
});
document.addEventListener('mousemove', onMouseMove, false);
renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
renderer.domElement.addEventListener('touchstart', onTouchStart, false);
renderer.domElement.addEventListener('click', onClick, false);
function updateRay(x, y) {
    pointer.x = ((x + window.pageXOffset) / document.documentElement.offsetWidth) * 2 - 1;
    pointer.y = (-(y + window.pageYOffset) / document.documentElement.offsetHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
}
function onMouseMove(event) {
    updateRay(event.clientX, event.clientY);
}
function onClick(event) {
    updateRay(event.clientX, event.clientY);
    redirectEvent(event);
}
function onTouchMove(event) {
    event.preventDefault(); // disable scrolling
    updateRay(event.touches[0].clientX, event.touches[0].clientY);
}
function onTouchStart(event) {
    updateRay(event.touches[0].clientX, event.touches[0].clientY);
    redirectEvent(event);
}
// redirect DOM events from the canvas, to the 3D scene,
// to the appropriate child Web3DLayer, and finally (back) to the
// DOM to dispatch an event on the intended DOM target
function redirectEvent(evt) {
    const hit = todoLayer.hitTest(raycaster.ray);
    if (hit) {
        hit.target.dispatchEvent(new evt.constructor(evt.type, evt));
        hit.target.focus();
        console.log('hit', hit.target, hit.layer);
    }
}
const controller1 = renderer.vr.getController(0);
controller1.add(new THREE.Mesh(cursorGeometry));
const ray1 = new THREE.Object3D();
// ray1.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1), Math.PI
ray1.scale.set(1, 1, -1);
controller1.add(ray1);
const arrow1 = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), undefined, 100, Math.random() * 0xffffff);
controller1.add(arrow1);
controller1.addEventListener('select', onSelect);
scene.add(controller1);
const controller2 = renderer.vr.getController(1);
controller2.add(new THREE.Mesh(cursorGeometry));
const ray2 = new THREE.Object3D();
ray2.scale.set(1, 1, -1);
// ray2.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1), Math.PI)
controller2.add(ray2);
const arrow2 = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), undefined, 100, Math.random() * 0xffffff);
controller2.add(arrow2);
controller2.addEventListener('select', onSelect);
scene.add(controller2);
const controller5 = renderer.vr.getController(2);
controller5.addEventListener('select', onSelect);
scene.add(controller5);
function onSelect(evt) {
    const controller = evt.target;
    raycaster.ray.set(controller.position, controller.getWorldDirection(new THREE.Vector3()).negate());
    const hit = todoLayer.hitTest(raycaster.ray);
    if (hit) {
        hit.target.click();
        hit.target.focus();
        console.log('hit', hit.target, hit.layer);
    }
}
const immersiveRays = [ray1, ray2];
const todoLayerTargetPosition = new THREE.Vector3();
const todoLayerTargetQuaternion = new THREE.Quaternion();
const currentTargetPosition = new THREE.Vector3();
// animate
function animate() {
    stats.begin();
    const deltaTime = clock.getDelta();
    const lerpValue = Math.min(deltaTime * Controls.lerpSpeed, 1);
    // update camera
    if (renderer.vr.enabled && renderer.vr.getDevice()) {
        renderer.vr.getCamera(camera);
        currentTargetPosition.set(0, 0, -1.5);
        camera.localToWorld(currentTargetPosition);
        if (currentTargetPosition.distanceTo(todoLayerTargetPosition) > 1.5) {
            todoLayerTargetPosition.copy(currentTargetPosition);
            todoLayerTargetQuaternion.copy(camera.quaternion);
        }
        todoLayer.position.lerp(todoLayerTargetPosition, lerpValue);
        todoLayer.quaternion.slerp(todoLayerTargetQuaternion, lerpValue);
        todoLayer.interactionRays = immersiveRays;
    }
    else {
        const width = renderer.domElement.offsetWidth;
        const height = renderer.domElement.offsetHeight;
        const aspect = width / height;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        camera.position.z = 0.7;
        if (Controls.moveCamera) {
            camera.position.x += (pointer.x * 0.4 - camera.position.x) * 0.05;
            camera.position.y += (pointer.y * 0.4 - camera.position.y) * 0.05;
        }
        else {
            camera.position.x = 0;
            camera.position.y = 0;
        }
        camera.lookAt(scene.position);
        renderer.setSize(width, height, false);
        todoLayer.position.set(0, 0, 0);
        todoLayer.quaternion.set(0, 0, 0, 1);
        todoLayer.interactionRays = mouseRays;
    }
    // update our interaction ray
    // important: make sure camera pose is updated first!
    raycaster.setFromCamera(pointer, camera);
    // update our WebLayer3D heirarchy
    // important: update interaction rays first!
    todoLayer.update(lerpValue, (layer, lerp) => {
        layer.target.position.z = Controls.layerSeparation * layer.level;
        if (layer.element.matches('.todo-list li *') && layer.contentTargetOpacity === 0) {
            if (!layer.element.matches('.destroy'))
                layer.target.position.y = 0;
            layer.target.scale.y = 0.001;
        }
        if (layer.element.matches('.destroy')) {
            layer.position.copy(layer.target.position);
        }
        if (Controls.hoverEffect) {
            if (layer.hover === 1 &&
                layer.level > 2 &&
                !layer.element.matches('h1') &&
                !layer.element.matches('.todo-count')) {
                layer.contentTarget.position.z += Controls.layerSeparation * 0.3;
                layer.contentTarget.scale.multiplyScalar(1.1);
            }
        }
        if (Controls.layout === 'custom') {
            if (layer.level === 0) {
                layer.contentTargetOpacity = 0;
                const h1Layer = layer.getLayerForQuery('h1');
                const infoLayer = layer.getLayerForQuery('.info');
                const mainLayer = layer.getLayerForQuery('.todoapp');
                const footerLayer = layer.getLayerForQuery('.footer');
                h1Layer.target.position.set(-0.4, 0.05, 0);
                infoLayer.target.position.set(-0.2, -0.05, 0);
                mainLayer.target.position.set(0.2, 0, 0);
                mainLayer.contentTargetOpacity = 0;
                footerLayer.target.position.set(-0.2, -0.2, 0);
                footerLayer.target.scale.set(1.5, 1.5, 1.5);
            }
        }
        three_web_layer_1.default.UPDATE_DEFAULT(layer, lerp);
    });
    // render!
    renderer.render(scene, camera);
    stats.end();
}
renderer.setAnimationLoop(animate);
//# sourceMappingURL=app.js.map