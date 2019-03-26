# three-web-layer
A handy tool for rendering complex and interactive 2D web content in WebGL using three.js, built on html2canvas

## Motivation

The goal of this project is to leverage the power of the 2D web for layout and design of content presented in a 3D environment.

## DEMO

[TodoMVC running in WebGL! Built with Vuejs, JSX, and WebLayer3D](http://argonjs.github.io/three-web-layer/)

## Installation

```bash
npm i three-web-layer
``` 

## API

```js
// create a root WebLayer3D instance. 
const rootLayer = new WebLayer3D(domElement, {
    // these options are all optional
    pixelRatio: window.devicePixelRatio,
    layerSeparation: 0.001, 
    windowWidth, 300,
    windowHeight, 150,
    onLayerCreate: (layer) => {
        // do something every time a layer is created
        // eg., attach a cursor
        layer.cursor.add(new THREE.Mesh(cursorGeometry))
    }
})

// optionally setup interaction rays for hover effects
rootLayer.interactionRays = [mouseRay] 

// hit testing
renderer.domElement.addEventListener('click', redirectEvent)
renderer.domElement.addEventListener('dblclick', redirectEvent)
function redirectEvent(event) {
    const hit = rootLayer.hitTest(mouseRay)
    if (hit) {
        hit.target.dispatchEvent(new event.constructor(event.type, event))
    }
}

// in update loop
function animate() {

    // If using interaction rays, update them first
    updateMouseRay() // app code

    // ...
    const alpha = deltaTime * 5 // set a lerp value

    // NOTE: all of the following are equivalent, at various levels of abstraction

    // update with linear interpolation
    rootLayer.update(alpha) // lerp value defaults to 1 if ommited

    // update with a specified transition 
    rootLayer.update(alpha, WebLayer3D.TRANSITION_DEFAULT)

    // manually transition each layer using provided transition functions
    rootLayer.update(alpha, (layer, alpha) => { // NOTE: ideally, save and reuse the same function
        layer.transitionLayout(alpha) // transition to default content layout
        layer.transitionVisibility(alpha) // transition entry/exit of layers
    })

    // custom layer transition logic 
    const customTransition = (layer, alpha) => { 
        // transition the layout
        this.content.position.lerp(this.targetContentPosition, alpha)
        this.content.scale.lerp(this.targetContentScale, alpha)
        // transition the visibility
        const material = layer.mesh.material
        if (layer.needsRemoval) {
            if ('opacity' in material && material.opacity > 0.001) {
                material.opacity = THREE.Math.lerp(material.opacity, 0, alpha)
                material.needsUpdate = true
            } else {
                if (layer.parent) layer.parent.remove(layer)
                layer.dispose()
            }
        } else {
            if ('opacity' in material && material.opacity < 1) {
                const opacity = layer.needsHiding ? 0 : 1
                material.opacity = Math.min(THREE.Math.lerp(material.opacity, 1, alpha), 1)
                material.needsUpdate = true
            }
        }
    }
    rootLayer.update(alpha, customTransition)

}
```

*Note: See the example source code for more details, which roughly follows the above setup while presenting web content built with Vue.js and JSX (just an example, the only dependencies of WebLayer3D are threejs, WebGL, and DOM).*

When a WebLayer3D instance is created, a `layer` data-attribute is set on
the DOM element to match the `id` property (inherited from Object3D). Likewise, the name property will be set to match the element id (allowing `scene.getObjectByName(<dom-id>)`).

Child WebLayer3D instances can be created by adding a `layer` data-attribute to the intended DOM element. The `layer` data-attribute can be added in HTML or dynamically:
 - `<div data-layer></div>`
 - `element.dataset.layer = ''`

Additionally, the pixel ratio can be adjusted on each layer, individually:
 - `<div data-layer data-layer-pixel-ratio="0.5"></div>`
 - `element.dataset.layerPixelRatio = '0.5'`

Finally, each layer can prerender multipe states specified similarly to CSS classes:
 - `<div data-layer data-layer-states="near far"></div>`
 - `element.dataset.layerStates = 'near far'`

Each WebLayer3D will render each of its states with the corresponding CSS class applied to the element. The texture state can then be changed with `layer.setState(state)`, 
without requiring the DOM to be re-rendered. Setting a state on a parent layer does
not affect the state of a child layer. 

Default dimensions: 

- 1px = 0.001 world dimensions = 1mm (assuming meters)
    e.g., 500px width means 0.5 meters


## Limitations:

- Relies on html2canvas, which means many CSS styles may not render correctly. 
- Tainting the canvas will prevent the layer from rendering. This includes cross-origin resources loaded without CORS, and (in Safari) data-urls for images
- Anything not within the bounds of the passed element will be clipped. If you want to render a child element that is outside of the bounds of a parent layer element, the descendent element must also be made into a WebLayer3D instance (by adding a `data-layer` attribute)
- Mutation observers, resize observers, and event listeners are attached to the root element in order to automatically refresh textures when changes are detected. It's possible that some changes to the DOM can be missed (e.g., stylesheets can be changed). To manually trigger a forced rasterize on a layer and it's descendent layers, call `layer.refresh(true)`. Alternatively, set `layer.needsRasterize = true` on every layer that needs to be rasterized, and then call `refresh()` on the root layer to rasterize the layers that are marked. 
