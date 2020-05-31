
export const StartList = () => {
    return { cmd: 0xD1D4 }
}

export const StopList = () => {
    return { cmd: 58 }
}

export const UseIntId = (x) => {
    return { cmd: 0, args: x }
}

export const StartGroup = (x) => {
    return { cmd: 16, args: x }
}

export const EndGroup = (x) => {
    return { cmd: 17, args: x }
}

export const MakeVertex = (x, y, z) => {
    return { cmd: 49, args: { vec: { x, y, z } } }
}

export const SetParamF = (w2, x) => {
    return { cmd: 44, args: { w2, vec: { x } } }
}

export const MakeDynObj = (w2, w1) => {
    return { cmd: 15, args: { w1, w2 } }
}

export const SetMaterial = (w1, w2) => {
    return { cmd: 36, args: { w1, w2 }}
}

export const SetParamPtr = (w2, w1) => {
    return { cmd: 45, args: { w1, w2 } }
}
