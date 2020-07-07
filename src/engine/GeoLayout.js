import * as GraphNode from "./graph_node"

const copy3argsToObject = (pos, argIndex, args) => {
    for (let i = argIndex; i < argIndex + 3; i++) {
        pos.push(args[i])
    }
    return 3
}

class GeoLayout {
    constructor() {
        this.sCurrentLayout = {}

        // Layers
        this.LAYER_FORCE             = 0
        this.LAYER_OPAQUE            = 1
        this.LAYER_OPAQUE_DECAL      = 2
        this.LAYER_OPAQUE_INTER      = 3
        this.LAYER_ALPHA             = 4
        this.LAYER_TRANSPARENT       = 5
        this.LAYER_TRANSPARENT_DECAL = 6
        this.LAYER_TRANSPARENT_INTER = 7
    }

    node_screen_area(args) {  /// node_root

        const x = args[1], y = args[2], width = args[3], height = args[4]
        let i = 0

        this.gGeoNumViews = args[0] + 2

        const graphNode = GraphNode.init_graph_node_root(null, null, 0, x, y, width, height)

        //this.gGeoViews = []

        graphNode.numViews = this.gGeoNumViews

        this.gGeoViews = Array(this.gGeoNumViews).fill(null)
        graphNode.views = this.gGeoViews

        GraphNode.register_scene_graph_node(this, graphNode)

        this.sCurrentLayout.index++
    }

    open_node(args) {
        this.gCurGraphNodeList.push(this.gCurGraphNodeList[this.gCurGraphNodeIndex++])
        this.sCurrentLayout.index++
    }

    close_node(args) {
        this.gCurGraphNodeIndex--
        this.sCurrentLayout.index++
    }

    node_master_list(args) { //zbuffer?

        const graphNode = GraphNode.init_graph_node_master_list(null, null, args[0])

        GraphNode.register_scene_graph_node(this, graphNode)

        this.sCurrentLayout.index++
    }

    display_list(args) {
        const drawingLayer = args[0]
        const displaylist = args[1]

        const graphNode = GraphNode.init_graph_node_display_list(drawingLayer, displaylist)

        GraphNode.register_scene_graph_node(this, graphNode)

        this.sCurrentLayout.index++
    }

    node_ortho(args) {
        const scale = args[0] / 100.0

        const graphNode = GraphNode.init_graph_node_ortho(null, null, scale)

        GraphNode.register_scene_graph_node(this, graphNode)

        this.sCurrentLayout.index++
    }

    node_perspective(args) {

        if (args[3]) { //optional 4th function argument

        }

        const graphNode = GraphNode.init_graph_node_perspective(null, null, args[0], args[1], args[2], args[3], 0)

        GraphNode.register_scene_graph_node(this, graphNode)

        this.sCurrentLayout.index++
    }

    node_camera(args) {

        const cameraType = args[0]
        const func = args[7]
        let argIndex = 1
        const pos = [], focus = []

        argIndex += copy3argsToObject(pos, argIndex, args)
        argIndex += copy3argsToObject(focus, argIndex, args)

        const graphNode = GraphNode.init_graph_node_camera(null, null, pos, focus, func, cameraType)

        GraphNode.register_scene_graph_node(this, graphNode)

        this.gGeoViews[0] = graphNode

        this.sCurrentLayout.index++
    }

    node_generated(args) {
        const theFunc = args[1], param = args[0]

        const graphNode = GraphNode.init_graph_node_generated(null, null, theFunc, param)

        GraphNode.register_scene_graph_node(this, graphNode)

        this.sCurrentLayout.index++
    }

    node_background(args) {

        const graphNode = GraphNode.init_graph_node_background(null, null, args[0], null, 0)

        GraphNode.register_scene_graph_node(this, graphNode)

        this.sCurrentLayout.index++
    }

    node_end(args) {
        this.gGeoLayoutStackIndex = this.gGeoLayoutReturnIndex
        this.gGeoLayoutReturnIndex = this.gGeoLayoutStack[--this.gGeoLayoutStackIndex] /// ??
        this.gCurGraphNodeIndex = this.gGeoLayoutStack[this.gGeoLayoutStackIndex] // ?
        this.gGeoLayoutCommand = this.gGeoLayoutStack[--this.gGeoLayoutStackIndex]
        this.sCurrentLayout.index++
    }

    process_geo_layout(geoLayout) {
        this.sCurrentLayout.layout = geoLayout
        this.sCurrentLayout.index = 0

        /// set a bunch of other initial globals
        this.gCurRootGraphNode = null
        this.gGeoNumViews = 0

        this.gCurGraphNodeList = [0]
        this.gCurGraphNodeIndex = 0

        this.gGeoLayoutStackIndex = 2
        this.gGeoLayoutReturnIndex = 2 // stack index is often copied here?

        //this.gGraphNodePool = {}

        this.gGeoLayoutStack = [0, 0]

        console.log("proccesing geo layout")

        while (this.sCurrentLayout.index < geoLayout.length) {
            const cmd = this.sCurrentLayout.layout[this.sCurrentLayout.index]
            //console.log("processing layout command: " + cmd.command.name)
            cmd.command.call(this, cmd.args)
        }

        console.log("finshed processing geo layout")
        //console.log(this.gCurRootGraphNode)
        return this.gCurRootGraphNode

    }
}

export const GeoLayoutInstance = new GeoLayout()
