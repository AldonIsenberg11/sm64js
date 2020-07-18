import { PlatformDisplacementInstance as PlatformDisplacement } from "./PlatformDisplacement"
import { RESPAWN_INFO_DONT_RESPAWN, ACTIVE_FLAGS_DEACTIVATED, RESPAWN_INFO_TYPE_32 } from "../include/object_constants"
import { SpawnObjectInstance as Spawn } from "./SpawnObject"
import * as GraphNode from "../engine/graph_node"
import { GeoLayoutInstance } from "../engine/GeoLayout"


class ObjectListProcessor {
    constructor() {

        this.OBJECT_POOL_CAPACITY = 240

        this.OBJ_LIST_PLAYER = 0      //  (0) mario
        this.OBJ_LIST_UNUSED_1 = 1    //  (1) (unused)
        this.OBJ_LIST_DESTRUCTIVE = 2 //  (2) things that can be used to destroy other objects, like
                              //      bob-ombs and corkboxes
        this.OBJ_LIST_UNUSED_3 = 3    //  (3) (unused)
        this.OBJ_LIST_GENACTOR = 4    //  (4) general actors. most normal 'enemies' or actors are
                              //      on this list. (MIPS, bullet bill, bully, etc)
        this.OBJ_LIST_PUSHABLE = 5   //  (5) pushable actors. This is a group of objects which
                              //      can push each other around as well as their parent
                              //      objects. (goombas, koopas, spinies)
        this.OBJ_LIST_LEVEL = 6       //  (6) level objects. general level objects such as heart, star
        this.OBJ_LIST_UNUSED_7 = 7    //  (7) (unused)
        this.OBJ_LIST_DEFAULT = 8     //  (8) default objects. objects that didnt start with a 00
                              //      command are put here, so this is treated as a default.
        this.OBJ_LIST_SURFACE = 9     //  (9) surface objects. objects that specifically have surface
                              //      collision and not object collision. (thwomp, whomp, etc)
        this.OBJ_LIST_POLELIKE = 10    // (10) polelike objects. objects that attract or otherwise
                              //      "cling" mario similar to a pole action. (hoot,
                              //      whirlpool, trees/poles, etc)
        this.OBJ_LIST_SPAWNER = 11     // (11) spawners
        this.OBJ_LIST_UNIMPORTANT = 12 // (12) unimportant objects. objects that will not load
                              //      if there are not enough object slots: they will also
                              //      be manually unloaded to make room for slots if the list
                              //      gets exhausted.
        this.NUM_OBJ_LISTS = 13

        this.gCCMEnteredSlide = 0
        this.gObjectLists = new Array(16).fill(0).map(() => { 

            const newObjectNode = { //ObjectNode
                next: null, prev: null,
                gfx: { //GraphObjectNode
                    node: { //GraphNode
                        type: null,
                        flags: null,
                        prev: null,
                        next: null,
                        children: null,
                        wrapper: null
                    }, 
                    sharedChild: { //GraphNode
                        type: null,
                        flags: null,
                        prev: null,
                        next: null,
                        children: null
                    },
                    wrapperObjectNode: null
                },
                wrapperObject: null
            }

            newObjectNode.gfx.wrapperObjectNode = newObjectNode
            newObjectNode.gfx.node.wrapper = newObjectNode.gfx

            const newObject = { header: newObjectNode, activeFlags: 0 }

            newObjectNode.wrapperObject = newObject

            return newObjectNode
        })

        this.gObjectPool = new Array(this.OBJECT_POOL_CAPACITY).fill(0).map(() => {

            const newObject = {
                activeFlags: 0,
                header: {  //ObjectNode
                    next: null, prev: null,
                    gfx: {  //GraphObjectNode
                        node: { //GraphNode
                            type: null,
                            flags: null,
                            prev: null,
                            next: null,
                            children: null,
                            wrapper: null,
                        }, 
                        sharedChild: { //GraphNode
                            type: null,
                            flags: null,
                            prev: null,
                            next: null,
                            children: null
                        },
                        wrapperObjectNode: null
                    },
                    wrapperObject: null
                }
            }

            newObject.header.wrapperObject = newObject
            newObject.header.gfx.wrapperObjectNode = newObject.header
            newObject.header.gfx.node.wrapper = newObject.header.gfx

            return newObject

        })
    }

    spawn_objects_from_info(spawnInfo) {

        this.gTimeStopState = 0

        this.gWDWWaterLevelChanging = false;
        this.gMarioOnMerryGoRound = 0

        PlatformDisplacement.clear_mario_platform()

        this.gCCMEnteredSlide |= 1

        while (spawnInfo) {

            const script = spawnInfo.behaviorScript

            if ((spawnInfo.behaviorArg & (RESPAWN_INFO_DONT_RESPAWN << 8)) != (RESPAWN_INFO_DONT_RESPAWN << 8)) {

                const object = Spawn.create_object(script)

                object.oBehParams = spawnInfo.behaviorArg

                object.oBehParams2ndByte = ((spawnInfo.behaviorArg) >> 16) & 0xFF

                object.behavior = script

                // Record death/collection in the SpawnInfo
                object.respawnInfoType = RESPAWN_INFO_TYPE_32
                object.respawnInfo = spawnInfo.behaviorArg

                if (spawnInfo.behaviorArg & 0x01) {
                    this.gMarioObject = object
                    GraphNode.geo_make_first_child(object.header.gfx.node)
                }

                GraphNode.geo_obj_init_spawninfo(object.header.gfx, spawnInfo)

                object.oPosX = spawnInfo.startPos[0]
                object.oPosY = spawnInfo.startPos[1]
                object.oPosZ = spawnInfo.startPos[2]
    
                object.oFaceAnglePitch = spawnInfo.startAngle[0]
                object.oFaceAngleYaw = spawnInfo.startAngle[1]
                object.oFaceAngleRoll = spawnInfo.startAngle[2]
    
                object.oMoveAnglePitch = spawnInfo.startAngle[0]
                object.oMoveAngleYaw = spawnInfo.startAngle[1]
                object.oMoveAngleRoll = spawnInfo.startAngle[2]
                
            }

            spawnInfo = spawnInfo.next
        }

    }

    clear_objects() {

        Spawn.clear_object_lists()

        for (let i = 0; i < this.OBJECT_POOL_CAPACITY; i++) {
            this.gObjectPool[i].activeFlags = ACTIVE_FLAGS_DEACTIVATED
            this.gObjectPool[i].header.gfx = GraphNode.geo_reset_object_node(this.gObjectPool[i].header.gfx)
            this.gObjectPool[i].header.gfx.wrapperObjectNode = this.gObjectPool[i].header
        }

    }
}

export const ObjectListProcessorInstance = new ObjectListProcessor()