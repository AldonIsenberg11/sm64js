import { LevelUpdateInstance as LevelUpdate } from "./LevelUpdate"
import { GEO_CONTEXT_RENDER, GEO_CONTEXT_CREATE } from "../engine/graph_node"

const CAM_MODE_MARIO_ACTIVE           = 0x01
const CAM_MODE_LAKITU_WAS_ZOOMED_OUT  = 0x02
const CAM_MODE_MARIO_SELECTED = 0x04

const DOOR_DEFAULT         = 0
const DOOR_LEAVING_SPECIAL = 1
const DOOR_ENTER_LOBBY     = 2

class Camera {
    constructor() {

        this.CAM_MOVE_C_UP_MODE   = 0x2000


        this.gCameraMovementFlags = 0

        this.gPlayerCameraState = {
            action: 0,
            pos: [0, 0, 0],
            faceAngle: [0, 0, 0],
            headRotation: [0, 0, 0],
            cameraEvent: 0,
            usedObj: null
        }

        this.sFOVState = {
            fovFunc: 0,
            fov: 0.0
        }
    }

    select_mario_cam_mode() {
        this.sSelectionFlags = CAM_MODE_MARIO_SELECTED
    }

    create_camera(graphNode) {

        const mode = graphNode.config.mode

        graphNode.config.camera = {
            mode,
            defMode: mode,
            cutscene: 0,
            doorStatus: DOOR_DEFAULT,
            areaCenX: graphNode.focus[0],
            areaCenY: graphNode.focus[1],
            areaCenZ: graphNode.focus[2],
            yaw: 0,
            // pos: [...graphNode.pos],
            // focus: [...graphNode.focus]
        }

        Object.assign(graphNode, {
            pos: [-1328.0, 1200.0, 6064.0],
            focus: [-1328.0, 260, 4664.0],
            myDemoAngle: 0,
            myDemoRadius: 1500,
            myCounter: 0
        })

    }

    update_graph_node_camera(graphNode) {
        // graphNode.myDemoAngle += 0.02

        // Demo show off code
        // graphNode.myCounter++
        // if (graphNode.myCounter < 500) {
        //     graphNode.pos[0] = Math.sin(graphNode.myDemoAngle) * graphNode.myDemoRadius
        //     graphNode.pos[2] = Math.cos(graphNode.myDemoAngle) * graphNode.myDemoRadius
        // } else if (graphNode.myCounter == 500) {
        //     graphNode.pos = [-1328.0,600.0, 6064.0]
        //     graphNode.focus = [-1328.0, 260, 4664.0]
        //     graphNode.myDemoRadius = 800
        // } else {
        //     graphNode.pos[0] = (Math.sin(graphNode.myDemoAngle) * graphNode.myDemoRadius) - 1328.0
        //     graphNode.pos[2] = (Math.cos(graphNode.myDemoAngle) * graphNode.myDemoRadius) + 4664.0
        // }

        graphNode.pos[0] = (Math.sin(graphNode.myDemoAngle) * graphNode.myDemoRadius) + LevelUpdate.gMarioState[0].pos[0]
        graphNode.pos[2] = (Math.cos(graphNode.myDemoAngle) * graphNode.myDemoRadius) + LevelUpdate.gMarioState[0].pos[2]

        graphNode.focus = [ ...LevelUpdate.gMarioState[0].pos ]
    }

    geo_camera_main(callContext, graphNode) {

        switch (callContext) {
            case GEO_CONTEXT_CREATE:
                this.create_camera(graphNode)
                break
            case GEO_CONTEXT_RENDER:
                this.update_graph_node_camera(graphNode)
                break
        }
    }

    geo_camera_fov(callContext, graphNode) {

        return

        const marioState = LevelUpdate.gMarioState[0]
        const fovFunc = this.sFOVState.fovFunc

        if (callContext == GEO_CONTEXT_RENDER) {
            throw "geo camera fov implementation needed"
        }

        graphNode.fov = this.sFOVState.fov

        ///this.shake_camera_fov(graphNode)
    }
}

export const CameraInstance = new Camera()