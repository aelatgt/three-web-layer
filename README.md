# three-web-layer
A handy tool for rendering DOM layouts in three.js, built on html2canvas

## API

```js
const layer = new WebLayer3D(domElement, {
    pixelRatio: window.devicePixelRatio, // optional
    layerSeparation: 0.001, // optional 
    windowWidth, 300, // optional
    windowHeight, 150, // optional
})

// in update loop
function animate() {
    // ...
    const alpha = deltaTime * 5 // set a lerp value

    // NOTE: all of the following are equivalent, at various levels of abstraction

    // update with linear interpolation
    rootLayer.update(alpha) // lerp value defaults to 1 if ommited

    // update with a specified transition and recursion to update child layers
    rootLayer.update(alpha, WebLayer3D.TRANSITION_DEFAULT, true) // recursion is true by default

    // manually transition each layer
    rootLayer.update(alpha, (layer, alpha) => { 
        layer.transitionLayout(alpha) // transition to default content layout
        layer.transitionEntryExit(alpha) // transition entry/exit of layers
    }) // do the same for child layers

    // more manual update (advanced use case)
    const transitionFunction = (layer, alpha) => { 
        // transition to default content layout
        this.content.position.lerp(this.defaultContentPosition, alpha)
        this.content.scale.lerp(this.defaultContentScale, alpha)
        // transition the entry and exit
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
                material.opacity = Math.min(THREE.Math.lerp(material.opacity, 1, alpha), 1)
                material.needsUpdate = true
            }
        }
    }
    rootLayer.update(transitionFunction, alpha) // do the same for child layers

}
```

When an instance is created, a `layer` data-attribute is set on
the passed DOM element to match this instance's Object3D id.
If the passed DOM element has an `id` attribute, this instance's Object3D name
will be set to match the element id.

Child WebLayer3D instances can be specified with an empty `layer` data-attribute,
which will be set when the child WebLayer3D instance is created automatically.
The data-attribute can be specified added in HTML or dynamically:
 - `<div data-layer></div>`
 - `element.dataset.layer = ''`

Additionally, the pixel ratio can be adjusted on each layer, individually:
 - `<div data-layer data-layer-pixel-ratio="0.5"></div>`
 - `element.dataset.layerPixelRatio = '0.5'`

Finally, each layer can prerender multipe states specified as CSS classes delimited by spaces:
 - `<div data-layer data-layer-states="near far"></div>`
 - `element.dataset.layerStates = 'near far'`

Each WebLayer3D will render each of its states with the corresponding CSS class applied to the element.
Every layer has a `default` state. The texture can be changed with `layer.setState(state)`,
without requiring the DOM to be re-rendered. Setting a state on a parent layer does
not affect the state of a child layer. 

Default dimensions: 

- 1px = 0.001 world dimensions = 1mm (assuming meters)
    e.g., 500px width means 0.5 meters


## Limitations:

- Avoid adding and removing DOM Elements, as this forces the tree to be recloned (updating attributes and/or classes should be fast)
- Relies on html2canvas, which means many CSS styles may not render correctly. YMMV. 
- Anything not withing the bounds of the passed element will be clipped 
- Rendering may vary on different browsers
- Mutation observers and event listeners are attached to the element in order to automatically refresh the texture when changes are detected. To trigger a refresh manually, call ``refresh()`. 