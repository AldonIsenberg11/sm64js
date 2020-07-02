import { LevelUpdateInstance as LevelUpdate } from "./LevelUpdate"
import { GEO_CONTEXT_RENDER, GEO_CONTEXT_CREATE } from "../engine/graph_node"

const CAM_MODE_MARIO_ACTIVE           = 0x01
const CAM_MODE_LAKITU_WAS_ZOOMED_OUT  = 0x02
const CAM_MODE_MARIO_SELECTED         = 0x04

class Camera {
    constructor() {
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
        console.log(graphNode)

        const mode = graphNode.config.mode

        const c = {
            /// fillout camera
        }

        throw "more here in create camera"
    }

    geo_camera_main(callContext, graphNode) {
        switch (callContext) {
            case GEO_CONTEXT_CREATE:
                this.create_camera(graphNode)
                break
            case GEO_CONTEXT_RENDER:
                throw "geo_camera_main - render - implementation needed"
                break
        }
    }

    geo_camera_fov(callContext, graphNode) {
        const marioState = LevelUpdate.gMarioState
        const fovFunc = this.sFOVState.fovFunc

        if (callContext == GEO_CONTEXT_RENDER) {
            throw "geo camera fov implementation needed"
        }

        graphNode.fov = this.sFOVState.fov

        ///this.shake_camera_fov(graphNode)
    }
}

export const CameraInstance = new Camera()