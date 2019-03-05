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
layer.update(deltaTime)  // pass a lerp value
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
- Rendering may vary on platforms. 
- Mutation observers and event listeneres are attached to the given element in order to automatically refresh the texture when changes are detected. To trigger a refresh manually, call ``refresh()`. 