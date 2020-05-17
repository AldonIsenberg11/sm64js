import { LevelCommandsInstance } from "../../engine/level_script"

export const level_script_entry = [
    { command: LevelCommandsInstance.init_level },
    { command: LevelCommandsInstance.sleep, args: [/*frames*/ 2] },
    { command: LevelCommandsInstance.blackout, args: [/*active*/ false] },
    { command: LevelCommandsInstance.set_register, args: [0] },
    //{ command: LevelCommands.execute, args: [/*seg*/ 0x14, /*script*/ _introSegmentRomStart, /*scriptEnd*/ _introSegmentRomEnd, /*entry*/ level_intro_entry_1] } 
]
