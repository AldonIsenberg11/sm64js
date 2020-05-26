import { WebGLInstance as WebGL } from "./WebGL"
import * as Gbi from "../include/gbi"

const precomp_shaders = [
    0x01200200,
    0x00000045,
    0x00000200,
    0x01200a00,
    0x00000a00,
    0x01a00045,
    0x00000551,
    0x01045045,
    0x05a00a00,
    0x01200045,
    0x05045045,
    0x01045a00,
    0x01a00a00,
    0x0000038d,
    0x01081081,
    0x0120038d,
    0x03200045,
    0x03200a00,
    0x01a00a6f,
    0x01141045,
    0x07a00a00,
    0x05200200,
    0x03200200
]

const MAX_BUFFERED = 256
const MAX_LIGHTS = 2
const MAX_VERTICES = 64

let opCount = 0

export class n64GfxProcessor {
    constructor() {

        //buffer
        this.buf_vbo = [] //new Array(MAX_BUFFERED * 26 * 3).fill(0.0) // 3 vertices in a triangle and 26 floats per vtx
        this.buf_vbo_num_tris = 0

        //RSP
        this.rsp = {
            modelview_matrix_stack: new Array(11).fill(0).map(() => new Array(4).fill(0).map(() => new Array(4).fill(0))),
            modelview_matrix_stack_size: 0,
            MP_matrix: new Array(4).fill(0).map(() => new Array(4).fill(0)),
            P_matrix: new Array(4).fill(0).map(() => new Array(4).fill(0)),
            current_lights: new Array(MAX_LIGHTS + 1).fill(0).map(() => ({
                col: [0, 0, 0],
                pad1: 0,
                colc: [0, 0, 0],
                pad2: 0,
                dir: [0, 0, 0],
                pad3: 0
            })),
            current_lights_coeffs: new Array(MAX_LIGHTS).fill(0).map(() => new Array(3).fill(0.0)),
            current_lookat_coeffs: new Array(2).fill(0).map(() => new Array(3).fill(0.0)),
            current_num_lights: 0,
            lights_changed: false,
            geometry_mode: 0,
            fog_mul: 0,
            fog_offset: 0,
            texture_scaling_factor: { s: 0, t: 0 },
            loaded_vertices: new Array(MAX_VERTICES + 4).fill(0).map(() => ({
                x: 0.0, y: 0.0, z: 0.0, w: 0.0, u: 0.0, v: 0.0,
                color: { r: 0, g: 0, b: 0, a: 0 },
                clip_rej: 0
            }))
        }

        //RDP
        this.rdp = {
            palette: [],
            texture_to_load: { textureData: null, tile_number: 0, size: 0, id: 0 },
            loaded_texture: [{ textureData: null, size_bytes: 0, id: 0 }, { textureData: null, size_bytes: 0, id: 0 }],
            texture_tile: { fmt: 0, siz: 0, cms: 0, cmt: 0, uls: 0, ult: 0, lrs: 0, lrt: 0, line_size_bytes: 0 },
            textures_changed: [false, false],
            other_mode_l: 0, other_mode_h: 0,
            combine_mode: 0,
            env_color: { r: 0, g: 0, b: 0, a: 0 },
            prim_color: { r: 0, g: 0, b: 0, a: 0 },
            fog_color: { r: 0, g: 0, b: 0, a: 0 },
            fill_color: { r: 0, g: 0, b: 0, a: 0 },
            viewport: { x: 0, y: 0, width: 0, height: 0 },
            scissor: { x: 0, y: 0, width: 0, height: 0 },
            viewport_or_scissor_changed: false,
            z_buf_address: null,
            color_image_address: null
        }

        this.color_combiner_pool = []

        this.rendering_state = {
            depth_test: false,
            depth_mask: false,
            decal_mode: false,
            alpha_blend: false,
            viewport: {
                x: 0, y: 0, width: 0, height: 0
            },
            scissor: {
                x: 0, y: 0, width: 0, height: 0
            },
            shader_program: null,
            textures: [null, null]
        }

        this.gfx_texture_cache = { pool: [] }

        /// create opengl shaders
        precomp_shaders.forEach(shader_id => {
            this.lookup_or_create_shader_program(shader_id)
        })
    }

    start_frame(){
        /// handle input
        /// handle dimensions
    }

    end_frame() { }

    sp_reset() {
        this.rsp.modelview_matrix_stack_size = 1        
        this.rsp.current_num_lights = 2
        this.rsp.lights_changed = true
        this.MP_matrix = new Array(4).fill(0).map(() => new Array(4).fill(0))
        this.MP_matrix = new Array(4).fill(0).map(() => new Array(4).fill(0))
    }

    matrix_mul(res, a, b) {
        const temp = new Array(4).fill(0).map(() => new Array(4).fill(0))
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                temp[i][j] = a[i][0] * b[0][j] +
                            a[i][1] * b[1][j] +
                            a[i][2] * b[2][j] +
                            a[i][3] * b[3][j]
            }
        }
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                res[i][j] = temp[i][j]
            }
        }
    }

    cloneMatrix4x4(src){
        const dst = new Array(4).fill(0).map(() => new Array(4).fill(0))
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                dst[i][j] = src[i][j]
            }
        }
        return dst
    }

    sp_matrix(parameters, og_matrix) {

        const matrix = this.cloneMatrix4x4(og_matrix)

        if (parameters & Gbi.G_MTX_PROJECTION) {
            if (parameters & Gbi.G_MTX_LOAD) {
                this.rsp.P_matrix = matrix
            } else {
                this.matrix_mul(this.rsp.P_matrix, matrix, this.rsp.P_matrix)
            }
        } else { // G_MTX_MODELVIEW
            if ((parameters & Gbi.G_MTX_PUSH) && this.rsp.modelview_matrix_stack_size < 11) {
                this.rsp.modelview_matrix_stack_size++
                this.rsp.modelview_matrix_stack[this.rsp.modelview_matrix_stack_size - 1] = this.rsp.modelview_matrix_stack[this.rsp.modelview_matrix_stack_size - 2]
            }
            if (parameters & Gbi.G_MTX_LOAD) {
                this.rsp.modelview_matrix_stack[this.rsp.modelview_matrix_stack_size - 1] = matrix
            } else {
                this.matrix_mul(
                    this.rsp.modelview_matrix_stack[this.rsp.modelview_matrix_stack_size - 1],
                    matrix,
                    this.rsp.modelview_matrix_stack[this.rsp.modelview_matrix_stack_size - 1],
                    
                )
            }
            this.rsp.lights_changed = true
        }
        this.matrix_mul(
            this.rsp.MP_matrix,
            this.rsp.modelview_matrix_stack[this.rsp.modelview_matrix_stack_size - 1],
            this.rsp.P_matrix,
        )
    }

    sp_geometry_mode(clear, set) {
        this.rsp.geometry_mode &= ~clear
        this.rsp.geometry_mode |= set
    }

    scale_5_8(val) {
        return Math.floor(((val) * 0xFF) / 0x1F)
    }

    dp_set_fill_color(color) {
        this.rdp.fill_color.r = this.scale_5_8(color >> 11)
        this.rdp.fill_color.g = this.scale_5_8((color >> 6) & 0x1f)
        this.rdp.fill_color.b = this.scale_5_8((color >> 1) & 0x1f)
        this.rdp.fill_color.a = (color & 1) * 255
    }

    color_comb_component(v) {
        switch (v) {
            case Gbi.G_CCMUX_TEXEL0:
                return Gbi.CC_TEXEL0
            case Gbi.G_CCMUX_TEXEL1:
                return Gbi.CC_TEXEL1
            case Gbi.G_CCMUX_PRIMITIVE:
                return Gbi.CC_PRIM
            case Gbi.G_CCMUX_SHADE:
                return Gbi.CC_SHADE
            case Gbi.G_CCMUX_ENVIRONMENT:
                return Gbi.CC_ENV
            case Gbi.G_CCMUX_TEXEL0_ALPHA:
                return Gbi.CC_TEXEL0A
            case Gbi.G_CCMUX_LOD_FRACTION:
                return Gbi.CC_LOD
            default:
                return Gbi.CC_0
        }
    }

    color_comb(a, b, c, d) {
        return this.color_comb_component(a) |
            (this.color_comb_component(b) << 3) |
            (this.color_comb_component(c) << 6) |
            (this.color_comb_component(d) << 9)
    }

    dp_set_combine_mode(rgb, alpha) {
        this.rdp.combine_mode = rgb | (alpha << 12)
    }

    viewportsEqual(vp1, vp2) {
        return vp1.x == vp2.x && vp1.y == vp2.y && vp1.width == vp2.width && vp1.height == vp2.height
    }

    lookup_or_create_shader_program(shader_id) {

        let prg = WebGL.lookup_shader(shader_id)
        if (prg == undefined) {
            WebGL.unload_shader(this.rendering_state.shader_program)
            prg = WebGL.create_and_load_new_shader(shader_id)
            this.rendering_state.shader_program = prg
        }

        return prg
    }

    generate_cc(cc_id) {
        const c = new Array(2).fill(0).map(() => new Array(4).fill(0))
        let shader_id = (cc_id >> 24) << 24
        const shader_input_mapping = new Array(2).fill(0).map(() => new Array(4).fill(0))

        for (let i = 0; i < 4; i++) {
            c[0][i] = (cc_id >> (i * 3)) & 7
            c[1][i] = (cc_id >> (12 + i * 3)) & 7
        }

        for (let i = 0; i < 2; i++) {
            if (c[i][0] == c[i][1] || c[i][2] == Gbi.CC_0) {
                c[i][0] = c[i][1] = c[i][2] = 0
            }

            const input_number = new Array(8).fill(0)
            let next_input_number = Gbi.SHADER_INPUT_1
            for (let j = 0; j < 4; j++) {
                let val = 0
                switch (c[i][j]) {
                    case Gbi.CC_0: break
                    case Gbi.CC_TEXEL0: val = Gbi.SHADER_TEXEL0; break
                    case Gbi.CC_TEXEL1: val = Gbi.SHADER_TEXEL1; break
                    case Gbi.CC_TEXEL0A: val = Gbi.SHADER_TEXEL0A; break
                    case Gbi.CC_PRIM:
                    case Gbi.CC_SHADE:
                    case Gbi.CC_ENV:
                    case Gbi.CC_LOD:
                        if (input_number[c[i][j]] == 0) {
                            shader_input_mapping[i][next_input_number - 1] = c[i][j]
                            input_number[c[i][j]] = next_input_number++
                        }
                        val = input_number[c[i][j]]
                        break
                }
                shader_id |= val << (i * 12 + j * 3)
            }
        }

        return {
            cc_id,
            shader_input_mapping,
            prg: this.lookup_or_create_shader_program(shader_id)
        }

    }

    lookup_or_create_color_combiner(cc_id) {
        if (this.prev_combiner != undefined && this.prev_combiner.cc_id == cc_id) {
            return this.prev_combiner
        }

        const other_combiner = this.color_combiner_pool.find(x => x.cc_id == cc_id)
        if (other_combiner) {
            this.prev_combiner = other_combiner
            return other_combiner
        }
        this.flush()
        const new_combiner = this.generate_cc(cc_id)
        this.color_combiner_pool.push(new_combiner)
        this.prev_combiner = new_combiner
        return new_combiner
    }

    import_texture_rgba16(tile) {

        const rgba32_buf = []
        for (let i = 0; i < this.rdp.loaded_texture[tile].size_bytes / 2; i++) {
            const col16 = (this.rdp.loaded_texture[tile].textureData[2 * i] << 8) | this.rdp.loaded_texture[tile].textureData[2 * i + 1]

            const a = col16 & 1
            const r = col16 >> 11
            const g = (col16 >> 6) & 0x1f
            const b = (col16 >> 1) & 0x1f

            rgba32_buf.push(this.scale_5_8(r))
            rgba32_buf.push(this.scale_5_8(g))
            rgba32_buf.push(this.scale_5_8(b))
            rgba32_buf.push(a ? 255 : 0)
        }

        const width = this.rdp.texture_tile.line_size_bytes / 2
        const height = this.rdp.loaded_texture[tile].size_bytes / this.rdp.texture_tile.line_size_bytes

        WebGL.upload_texture(rgba32_buf, width, height)

    }

    import_texture(tile) {
        const fmt = this.rdp.texture_tile.fmt
        const siz = this.rdp.texture_tile.siz

        if (this.texture_cache_lookup(tile, this.rdp.loaded_texture[tile].textureData, fmt, siz, this.rdp.loaded_texture[tile].id)) return

        if (fmt == Gbi.G_IM_FMT_RGBA) {
            if (siz == Gbi.G_IM_SIZ_16b) {
                this.import_texture_rgba16(tile)
            } else {
                throw "unimplemented texture size"
            }
        } else {
            throw "unimplemented texture format"
        }


    }

    texture_cache_lookup(tile, textureData, fmt, siz, id) {
        //const hash = id
        //let node = this.gfx_texture_cache.hashmap[hash]
        let node = this.gfx_texture_cache.pool.find(x => x.id == id && x.fmt == fmt && x.siz == siz)
        if (node != undefined) {
            WebGL.select_texture(tile, node.texture_object)
            this.rendering_state.textures[tile] = node
            return true
        }
        if (this.gfx_texture_cache.pool.length >= 512) {
            /// pool hits limit
            throw "more implementation needed in texture cache lookup"
        }
        node = {}
        this.gfx_texture_cache.pool.push(node)
        if (node.texture_object == undefined) {
            node.texture_object = WebGL.new_texture()
        }
        WebGL.select_texture(tile, node.texture_object)
        WebGL.set_sampler_parameters(tile, false, 0, 0)
        Object.assign(node, { cms: 0, cmt: 0, linear_filter: false, id, textureData, fmt, siz, meow: true })
        this.rendering_state.textures[tile] = node
        return false
    }

    sp_tri1(vtx1_idx, vtx2_idx, vtx3_idx) {
        const v1 = this.rsp.loaded_vertices[vtx1_idx]
        const v2 = this.rsp.loaded_vertices[vtx2_idx]
        const v3 = this.rsp.loaded_vertices[vtx3_idx]
        const v_arr = [ v1, v2, v3 ]

        if (v1.clip_rej & v2.clip_rej & v3.clip_rej) return

        if ((this.rsp.geometry_mode & Gbi.G_CULL_BOTH) != 0) {
            throw "not implemented section in sp_tri1"
        }

        const depth_test = (this.rsp.geometry_mode & Gbi.G_ZBUFFER) == Gbi.G_ZBUFFER
        if (depth_test != this.rendering_state.depth_test) {
            this.flush()
            WebGL.set_depth_test(depth_test)
            this.rendering_state.depth_test = depth_test
        }

        const z_upd = (this.rdp.other_mode_l & Gbi.Z_UPD) == Gbi.Z_UPD
        if (z_upd != this.rendering_state.depth_mask) {
            this.flush()
            WebGL.set_depth_mask(z_upd)
            this.rendering_state.depth_mask = z_upd
        }

        const zmode_decal = (this.rdp.other_mode_l & Gbi.ZMODE_DEC) == Gbi.ZMODE_DEC
        if (zmode_decal != this.rendering_state.decal_mode) {
            this.flush()
            WebGL.set_zmode_decal(zmode_decal)
            this.rendering_state.decal_mode = zmode_decal
        }

        if (this.rdp.viewport_or_scissor_changed) {
            if (!this.viewportsEqual(this.rdp.viewport, this.rendering_state.viewport)) {
                this.flush()
                WebGL.set_viewport(this.rdp.viewport)
                this.rendering_state.viewport = this.rdp.viewport
            }
            if (!this.viewportsEqual(this.rdp.scissor, this.rendering_state.scissor)) {
                this.flush()
                WebGL.set_scissor(this.rdp.scissor)
                this.rendering_state.scissor = this.rdp.scissor
            }
            this.rdp.viewport_or_scissor_changed = false
        }

        let cc_id = this.rdp.combine_mode

        let use_alpha = (this.rdp.other_mode_l & (Gbi.G_BL_A_MEM << 18)) == 0
        const use_fog = (this.rdp.other_mode_l >> 30) == Gbi.G_BL_CLR_FOG
        const texture_edge = (this.rdp.other_mode_l & Gbi.CVG_X_ALPHA) == Gbi.CVG_X_ALPHA

        if (texture_edge) use_alpha = true

        if (use_alpha) cc_id |= Gbi.SHADER_OPT_ALPHA
        if (use_fog) cc_id |= Gbi.SHADER_OPT_FOG
        if (texture_edge) cc_id |= Gbi.SHADER_OPT_TEXTURE_EDGE

        if (!use_alpha) cc_id &= ~0xfff000

        const comb = this.lookup_or_create_color_combiner(cc_id)
        const prg = comb.prg

        if (prg != this.rendering_state.shader_program) {
            this.flush()
            WebGL.unload_shader(this.rendering_state.shader_program)
            WebGL.load_shader(prg)
            this.rendering_state.shader_program = prg
        }

        if (use_alpha != this.rendering_state.alpha_blend) {
            this.flush()
            WebGL.set_use_alpha(use_alpha)
            this.rendering_state.alpha_blend = use_alpha
        }

        const used_textures = [false, false]
        const num_inputs = WebGL.shader_get_info(prg, used_textures)

        for (let i = 0; i < 2; i++) {
            if (used_textures[i]) {
                if (this.rdp.textures_changed[i]) {
                    this.flush()
                    this.import_texture(i)
                    this.rdp.textures_changed[i] = false
                }
                const linear_filter = (this.rdp.other_mode_h & (3 << Gbi.G_MDSFT_TEXTFILT)) != Gbi.G_TF_POINT
                if (linear_filter != this.rendering_state.textures[i].linear_filter ||
                    this.rdp.texture_tile.cms != this.rendering_state.textures[i].cms ||
                    this.rdp.texture_tile.cmt != this.rendering_state.textures[i].cmt) {

                    this.flush()
                    WebGL.set_sampler_parameters(i, linear_filter, this.rdp.texture_tile.cms, this.rdp.texture_tile.cmt)
                    this.rendering_state.textures[i].linear_filter = linear_filter
                    this.rendering_state.textures[i].cms = this.rdp.texture_tile.cms
                    this.rendering_state.textures[i].cmt = this.rdp.texture_tile.cmt

                }
            }
        }

        const use_texture = used_textures[0] || used_textures[1]
        const tex_width = (this.rdp.texture_tile.lrs - this.rdp.texture_tile.uls + 4) / 4
        const tex_height = (this.rdp.texture_tile.lrt - this.rdp.texture_tile.ult + 4) / 4

        for (let i = 0; i < 3; i++) {
            this.buf_vbo.push(v_arr[i].x)
            this.buf_vbo.push(v_arr[i].y)
            this.buf_vbo.push(v_arr[i].z)
            this.buf_vbo.push(v_arr[i].w)

            if (use_texture) {
                let u = (v_arr[i].u - this.rdp.texture_tile.uls * 8) / 32.0
                let v = (v_arr[i].v - this.rdp.texture_tile.ult * 8) / 32.0
                if ((this.rdp.other_mode_h & (3 << Gbi.G_MDSFT_TEXTFILT)) != Gbi.G_TF_POINT) {
                    // Linear filter adds 0.5f to the coordinates
                    u += 0.5
                    v += 0.5
                }

                this.buf_vbo.push(u / tex_width)
                this.buf_vbo.push(v / tex_height)
            }

            if (use_fog) {
                throw "more fog implementation needed here"
            }

            for (let j = 0; j < num_inputs; j++) {
                let color = {}
                for (let k = 0; k < 1 + (use_alpha ? 1 : 0); k++) {
                    switch (comb.shader_input_mapping[k][j]) {
                        case Gbi.CC_PRIM: color = this.rdp.prim_color; break
                        case Gbi.CC_SHADE: color = v_arr[i].color; break
                        case Gbi.CC_ENV: color = this.rdp.env_color; break
                        case Gbi.CC_LOD:
                            const distance_frac = (v1.w - 3000.0) / 3000.0
                            if (distance_frac < 0.0) distance_frac = 0.0
                            if (distance_frac > 1.0) distance_frac = 1.0
                            color.r = color.g = color.b = color.a = distance_frac * 255.0
                            break
                        default:
                            color = { r: 0, g: 0, b: 0, a: 0 }
                    }
                    if (k == 0) { // not the alpha channel?
                        this.buf_vbo.push(color.r / 255.0)
                        this.buf_vbo.push(color.g / 255.0)
                        this.buf_vbo.push(color.b / 255.0)
                    } else { /// here is use_alpha is true
                        if (use_fog && color == v_arr[i].color) {
                            // Shade alpha is 100% for fog
                            this.buf_vbo.push(1.0)
                        } else {
                            this.buf_vbo.push(color.a / 255.0)
                        }
                    }
                }
            }

        }

        if (++this.buf_vbo_num_tris == MAX_BUFFERED) {
            this.flush()
        }

    }

    draw_rectangle(ulx, uly, lrx, lry) {
        const saved_other_mode_h = this.rdp.other_mode_h
        const cycle_type = (this.rdp.other_mode_h & (3 << Gbi.G_MDSFT_CYCLETYPE))

        if (cycle_type == Gbi.G_CYC_COPY) {
            this.rdp.other_mode_h = (this.rdp.other_mode_h & ~(3 << Gbi.G_MDSFT_TEXTFILT)) | Gbi.G_TF_POINT
        }

        ulx = (ulx / (WebGL.canvas.width / 2.0)) - 1.0
        uly = -(uly / (WebGL.canvas.height / 2.0)) + 1.0
        lrx = (lrx / (WebGL.canvas.width / 2.0)) - 1.0
        lry = -(lry / (WebGL.canvas.height / 2.0)) + 1.0

        const ul = this.rsp.loaded_vertices[MAX_VERTICES + 0]
        const ll = this.rsp.loaded_vertices[MAX_VERTICES + 1]
        const lr = this.rsp.loaded_vertices[MAX_VERTICES + 2]
        const ur = this.rsp.loaded_vertices[MAX_VERTICES + 3]

        ul.x = ulx
        ul.y = uly
        ul.z = -1.0
        ul.w = 1.0

        ll.x = ulx
        ll.y = lry
        ll.z = -1.0
        ll.w = 1.0

        lr.x = lrx
        lr.y = lry
        lr.z = -1.0
        lr.w = 1.0

        ur.x = lrx
        ur.y = uly
        ur.z = -1.0
        ur.w = 1.0

        const default_viewport = { x: 0, y: 0, width: WebGL.canvas.width, height: WebGL.canvas.height }
        const viewport_saved = this.rdp.viewport
        const geometry_mode_saved = this.rsp.geometry_mode

        this.rdp.viewport = default_viewport
        this.rdp.viewport_or_scissor_changed = true
        this.rsp.geometry_mode = 0

        this.sp_tri1(MAX_VERTICES + 0, MAX_VERTICES + 1, MAX_VERTICES + 3)
        this.sp_tri1(MAX_VERTICES + 1, MAX_VERTICES + 2, MAX_VERTICES + 3)

        this.rsp.geometry_mode = geometry_mode_saved
        this.rdp.viewport = viewport_saved
        this.rdp.viewport_or_scissor_changed = true

        if (cycle_type == Gbi.G_CYC_COPY) {
            this.rdp.other_mode_h = saved_other_mode_h
        }

    } 

    dp_set_env_color(r, g, b, a) {
        this.rdp.env_color = { r, g, b, a }
    }

    dp_fill_rectangle(ulx, uly, lrx, lry) {

        if (this.rdp.color_image_address == this.rdp.z_buf_address) {
            return 
        }

        const mode = this.rdp.other_mode_h & (3 << Gbi.G_MDSFT_CYCLETYPE)

        if (mode == Gbi.G_CYC_COPY || mode == Gbi.G_CYC_FILL || true) { ///TODO_OTHERMODE
            // Per documentation one extra pixel is added in this modes to each edge
            lrx += 1 
            lry += 1 
        }

        for (let i = MAX_VERTICES; i < MAX_VERTICES + 4; i++) {
            const v = this.rsp.loaded_vertices[i]
            v.color = this.rdp.fill_color
        }

        const saved_combine_mode = this.rdp.combine_mode
        this.dp_set_combine_mode(this.color_comb(0, 0, 0, Gbi.G_CCMUX_SHADE), this.color_comb(0, 0, 0, Gbi.G_CCMUX_SHADE))
        this.draw_rectangle(ulx, uly, lrx, lry)
        this.rdp.combine_mode = saved_combine_mode

    }

    sp_texture(s, t) {
        this.rsp.texture_scaling_factor = { s, t }
    }

    dp_set_tile(fmt, siz, line, tmem, tile, palette, cmt, cms) {
        if (siz == Gbi.G_IM_SIZ_32b) throw "unsupported tile size JS"

        if (tile == Gbi.G_TX_RENDERTILE) {
            if (palette != 0) throw "unsupported palette"
            Object.assign(this.rdp.texture_tile, { fmt, siz, cms, cmt, line_size_bytes: line * 8 })
            this.rdp.textures_changed = [ true, true ]
        }

        if (tile == Gbi.G_TX_LOADTILE) {
            this.rdp.texture_to_load.tile_number = parseInt(tmem / 256)
        }
    }

    dp_set_tile_size(tile, uls, ult, lrs, lrt) {
        if (tile == Gbi.G_TX_RENDERTILE) {
            Object.assign(this.rdp.texture_tile, { uls, ult, lrs, lrt })
            this.rdp.textures_changed = [ true, true ]
        }
    }

    dp_set_texture_image(size, imageData, id) {
        Object.assign(this.rdp.texture_to_load, { size, id, textureData: imageData })
    }

    dp_load_block(tile, uls, ult, lrs) {
        if (tile == 1) return
        if (tile != Gbi.G_TX_LOADTILE) throw "unsupported"
        if (uls != 0) throw "unsupported"
        if (ult != 0) throw "unsupported"

        let word_size_shift
        switch (this.rdp.texture_to_load.size) {
            case Gbi.G_IM_SIZ_4b:
                throw "need to verify correct size for this case"
                break
            case Gbi.G_IM_SIZ_8b:
                word_size_shift = 0
                break
            case Gbi.G_IM_SIZ_16b:
                word_size_shift = 1
                break
            case Gbi.G_IM_SIZ_32b:
                word_size_shift = 2
                break
        }
        const size_bytes = (lrs + 1) << word_size_shift
        this.rdp.loaded_texture[this.rdp.texture_to_load.tile_number].size_bytes = size_bytes
        if (size_bytes > 4096) throw "bug: too big texture"
        this.rdp.loaded_texture[this.rdp.texture_to_load.tile_number].textureData = this.rdp.texture_to_load.textureData
        this.rdp.loaded_texture[this.rdp.texture_to_load.tile_number].id = this.rdp.texture_to_load.id
        this.rdp.textures_changed[this.rdp.texture_to_load.tile_number] = true
    }

    sp_vertex(dest_index, vertices) {

        //console.log(JSON.stringify(this.rsp.MP_matrix))

        for (let i = 0; i < vertices.length; i++, dest_index++) {
            const v = vertices[i]
            const d = this.rsp.loaded_vertices[dest_index]

            const x = v.pos[0] * this.rsp.MP_matrix[0][0] + v.pos[1] * this.rsp.MP_matrix[1][0] + v.pos[2] * this.rsp.MP_matrix[2][0] + this.rsp.MP_matrix[3][0]
            const y = v.pos[0] * this.rsp.MP_matrix[0][1] + v.pos[1] * this.rsp.MP_matrix[1][1] + v.pos[2] * this.rsp.MP_matrix[2][1] + this.rsp.MP_matrix[3][1]
            const z = v.pos[0] * this.rsp.MP_matrix[0][2] + v.pos[1] * this.rsp.MP_matrix[1][2] + v.pos[2] * this.rsp.MP_matrix[2][2] + this.rsp.MP_matrix[3][2]
            const w = v.pos[0] * this.rsp.MP_matrix[0][3] + v.pos[1] * this.rsp.MP_matrix[1][3] + v.pos[2] * this.rsp.MP_matrix[2][3] + this.rsp.MP_matrix[3][3]

            /// x = adjust x for aspect ratio (x)
            const U = v.tc[0] * this.rsp.texture_scaling_factor.s >> 16
            const V = v.tc[1] * this.rsp.texture_scaling_factor.t >> 16

            if (this.rsp.geometry_mode & Gbi.G_LIGHTING) {
                throw "more implementation needed here"
            } else {
                Object.assign(d.color, { r: v.color[0], g: v.color[1], b: v.color[2] })
            }

            d.u = U; d.v = V

            d.clip_rej = 0
            if (x < -w) d.clip_rej |= 1
            if (x > w) d.clip_rej |= 2
            if (y < -w) d.clip_rej |= 4
            if (y > w) d.clip_rej |= 8
            if (z < -w) d.clip_rej |= 16
            if (z > w) d.clip_rej |= 32

            Object.assign(d, { x, y, z, w })

            if (this.rsp.geometry_mode & Gbi.G_FOG) {
                throw "more implementation needed here"
            } else {
                d.color.a = v.color[3]
            }

        }
    }

    run_dl(commands) {

        //console.log("G_DL")

        for (const command of commands) {
            const opcode = command.words.w0
            const args = command.words.w1

            opCount++
            command.opCount = opCount
            //console.log(command)

            switch (opcode) {
                case Gbi.G_ENDDL: /// not necessary for JS
                    //console.log("G_ENDDL")
                    break
                case Gbi.G_MTX:
                    this.sp_matrix(args.parameters, args.matrix)
                    break
                case Gbi.G_VTX:
                    this.sp_vertex(args.dest_index, args.vertices)
                    break
                case Gbi.G_TRI1:
                    this.sp_tri1(args.v0, args.v1, args.v2)
                    break
                case Gbi.G_SETGEOMETRYMODE:
                    this.sp_geometry_mode(0, args.mode)
                    break
                case Gbi.G_CLEARGEOMETRYMODE:
                    this.sp_geometry_mode(args.mode, 0)
                    break
                case Gbi.G_SETCOMBINE:
                    const rgb = this.color_comb(args.mode.rgb[0], args.mode.rgb[1], args.mode.rgb[2], args.mode.rgb[3])
                    const alpha = this.color_comb(args.mode.alpha[0], args.mode.alpha[1], args.mode.alpha[2], args.mode.alpha[3])
                    this.dp_set_combine_mode(rgb, alpha)
                    break
                case Gbi.G_SETTIMG:
                    this.dp_set_texture_image(args.size, args.imageData, args.id)
                    break
                case Gbi.G_SETTILE:
                    this.dp_set_tile(args.fmt, args.siz, args.line, args.tmem, args.tile, args.palette, args.cmt, args.cms)
                    break
                case Gbi.G_SETTILESIZE:
                    this.dp_set_tile_size(args.t, args.uls, args.ult, args.lrs, args.lrt)
                    break
                case Gbi.G_TEXTURE:
                    this.sp_texture(args.s, args.t)
                    break
                case Gbi.G_LOADBLOCK:
                    this.dp_load_block(args.tile, args.uls, args.ult, args.lrs)
                    break
                case Gbi.G_SETFILLCOLOR:
                    this.dp_set_fill_color(args.color)
                    break
                case Gbi.G_SETENVCOLOR:
                    this.dp_set_env_color(args.r, args.g, args.g, args.a)
                    break
                case Gbi.G_FILLRECT:
                    this.dp_fill_rectangle(args.ulx, args.uly, args.lrx, args.lry)
                    break
                case Gbi.G_DL:
                    this.run_dl(args.childDisplayList)
                    break
                default:
                    throw "unimplemented gfx opcode: " + opcode
            }

        }
    }

    flush() {
        if (this.buf_vbo.length > 0) {
            WebGL.draw_triangles(this.buf_vbo, this.buf_vbo_num_tris)
            this.buf_vbo = []
            this.buf_vbo_num_tris = 0
        }
    }

    run(commands) {
        this.sp_reset()

        WebGL.start_frame()
        this.run_dl(commands)
        this.flush()

/*        if (opCount >= 1213) {
            throw "reached opcount max"
        }*/
    }
}

export const n64GfxProcessorInstance = new n64GfxProcessor()