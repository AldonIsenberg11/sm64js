const SHADER_OPT_ALPHA = (1 << 24)
const SHADER_OPT_FOG = (1 << 25)
const SHADER_OPT_TEXTURE_EDGE = (1 << 26)

const SHADER_0 = 0
const SHADER_INPUT_1 = 1
const SHADER_INPUT_2 = 2
const SHADER_INPUT_3 = 3
const SHADER_INPUT_4 = 4
const SHADER_TEXEL0 = 5
const SHADER_TEXEL0A = 6
const SHADER_TEXEL1 = 7

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

export class WebGL {

    constructor(canvas) {
        this.canvas = canvas
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
            textures: [ null, null ]
        }
        this.shader_program_pool = []

        // Initialize the GL context
        this.gl = this.canvas.getContext("webgl")

        // Only continue if WebGL is available and working
        if (this.gl === null) {
            alert("Unable to initialize WebGL. Your browser or machine may not support it.")
        }

        // Set clear color to black, fully opaque
        this.gl.clearColor(1.0, 0.0, 0.0, 1.0)
        // Clear the color buffer with specified clear color
        this.gl.clear(this.gl.COLOR_BUFFER_BIT)

        //gfx_opengl_init
        const buffer = this.gl.createBuffer()
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
        this.gl.depthFunc(this.gl.LEQUAL);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        /// create opengl shaders
        precomp_shaders.forEach(shader_id => {
            this.gfx_lookup_or_create_shader_program(shader_id)
        })

    }

    shader_item_to_str(item, with_alpha, only_alpha, inputs_have_alpha, hint_single_element) {
        if (!only_alpha) {
            switch (item) {
                case SHADER_0:
                    return with_alpha ? "vec4(0.0, 0.0, 0.0, 0.0)" : "vec3(0.0, 0.0, 0.0)";
                case SHADER_INPUT_1:
                    return with_alpha || !inputs_have_alpha ? "vInput1" : "vInput1.rgb";
                case SHADER_INPUT_2:
                    return with_alpha || !inputs_have_alpha ? "vInput2" : "vInput2.rgb";
                case SHADER_INPUT_3:
                    return with_alpha || !inputs_have_alpha ? "vInput3" : "vInput3.rgb";
                case SHADER_INPUT_4:
                    return with_alpha || !inputs_have_alpha ? "vInput4" : "vInput4.rgb";
                case SHADER_TEXEL0:
                    return with_alpha ? "texVal0" : "texVal0.rgb";
                case SHADER_TEXEL0A:
                    return hint_single_element ? "texVal0.a" :
                        (with_alpha ? "vec4(texelVal0.a, texelVal0.a, texelVal0.a, texelVal0.a)" : "vec3(texelVal0.a, texelVal0.a, texelVal0.a)");
                case SHADER_TEXEL1:
                    return with_alpha ? "texVal1" : "texVal1.rgb";
            }
        } else {
            switch (item) {
                case SHADER_0:
                    return "0.0";
                case SHADER_INPUT_1:
                    return "vInput1.a";
                case SHADER_INPUT_2:
                    return "vInput2.a";
                case SHADER_INPUT_3:
                    return "vInput3.a";
                case SHADER_INPUT_4:
                    return "vInput4.a";
                case SHADER_TEXEL0:
                    return "texVal0.a";
                case SHADER_TEXEL0A:
                    return "texVal0.a";
                case SHADER_TEXEL1:
                    return "texVal1.a";
            }
        }
    }

    create_formula(c, do_single, do_multiply, do_mix, with_alpha, only_alpha_bool, opt_alpha) {
        const only_alpha = only_alpha_bool ? 1 : 0
        let newString = ""
        if (do_single) {
            newString += this.shader_item_to_str(c[only_alpha][3], with_alpha, only_alpha, opt_alpha, false)
        } else if (do_multiply) {
            newString += this.shader_item_to_str(c[only_alpha][0], with_alpha, only_alpha, opt_alpha, false)
            newString += " * "
            newString += this.shader_item_to_str(c[only_alpha][2], with_alpha, only_alpha, opt_alpha, true)
        } else if (do_mix) {
            newString += "mix("
            newString += this.shader_item_to_str(c[only_alpha][1], with_alpha, only_alpha, opt_alpha, false)
            newString += ", "
            newString += this.shader_item_to_str(c[only_alpha][0], with_alpha, only_alpha, opt_alpha, false)
            newString += ", "
            newString += this.shader_item_to_str(c[only_alpha][2], with_alpha, only_alpha, opt_alpha, true)
            newString += ")"
        } else {
            newString += "("
            newString += this.shader_item_to_str(c[only_alpha][0], with_alpha, only_alpha, opt_alpha, false)
            newString += " - "
            newString += this.shader_item_to_str(c[only_alpha][1], with_alpha, only_alpha, opt_alpha, false)
            newString += ") * "
            newString += this.shader_item_to_str(c[only_alpha][2], with_alpha, only_alpha, opt_alpha, true)
            newString += " + "
            newString += this.shader_item_to_str(c[only_alpha][3], with_alpha, only_alpha, opt_alpha, false)
        }
        return newString
    }

    createShader(gl, sourceCode, type) {
        // Compiles either a shader of type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
        const shader = gl.createShader(type)
        gl.shaderSource(shader, sourceCode)
        gl.compileShader(shader)

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            var info = gl.getShaderInfoLog(shader)
            throw 'Could not compile WebGL program. \n\n' + info
        }
        return shader
    }

    create_and_load_new_shader(shader_id) {
        const c = new Array(2).fill(0).map(() => new Array(4).fill(0))
        for (let i = 0; i < 4; i++) {
            c[0][i] = (shader_id >> (i * 3)) & 7
            c[1][i] = (shader_id >> (12 + i * 3)) & 7
        }
        let opt_alpha = (shader_id & SHADER_OPT_ALPHA) != 0
        let opt_fog = (shader_id & SHADER_OPT_FOG) != 0
        let opt_texture_edge = (shader_id & SHADER_OPT_TEXTURE_EDGE) != 0
        let used_textures = [ false, false ]
        let num_inputs = 0

        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 4; j++) {
                if (c[i][j] >= SHADER_INPUT_1 && c[i][j] <= SHADER_INPUT_4) {
                    if (c[i][j] > num_inputs) {
                        num_inputs = c[i][j]
                    }
                }
                if (c[i][j] == SHADER_TEXEL0 || c[i][j] == SHADER_TEXEL0A) {
                    used_textures[0] = true
                }
                if (c[i][j] == SHADER_TEXEL1) {
                    used_textures[1] = true
                }
            }
        }
        let do_single = [ c[0][2] == 0, c[1][2] == 0 ]
        let do_multiply = [ c[0][1] == 0 && c[0][3] == 0, c[1][1] == 0 && c[1][3] == 0 ]
        let do_mix = [ c[0][1] == c[0][3], c[1][1] == c[1][3] ]
        let color_alpha_same = (shader_id & 0xfff) == ((shader_id >> 12) & 0xfff)

        let vs_buf = ""
        let fs_buf = ""
        let num_floats = 4

        // Vertex Shader
        vs_buf += "#version 100\n"
        vs_buf += "attribute vec4 aVtxPos;\n"
        if (used_textures[0] || used_textures[1]) {
            vs_buf += "attribute vec2 aTexCoord;\n"
            vs_buf += "varying vec2 vTexCoord;\n"
            num_floats += 2
        }
        if (opt_fog) {
            vs_buf += "attribute vec4 aFog;\n"
            vs_buf += "varying vec4 vFog;\n"
            num_floats += 4
        }
        for (let i = 0; i < num_inputs; i++) {
            const suffix1 = opt_alpha ? 4 : 3
            const suffix2 = i + 1
            const newString1 = `attribute vec${suffix1} aInput${suffix2};\n`
            const newString2 = `varying vec${suffix1} vInput${suffix2};\n`
            vs_buf += newString1
            vs_buf += newString2
            num_floats += opt_alpha ? 4 : 3
        }
        vs_buf += "void main() {\n"
        if (used_textures[0] || used_textures[1]) {
            vs_buf += "vTexCoord = aTexCoord;\n"
        }
        if (opt_fog) {
            vs_buf += "vFog = aFog;\n"
        }
        for (let i = 0; i < num_inputs; i++) {
            vs_buf += `vInput${i+1} = aInput${i+1};\n`
        }
        vs_buf += "gl_Position = aVtxPos;\n"
        vs_buf += "}\n"

        // Fragment shader
        fs_buf += "#version 100\n"
        fs_buf += "precision mediump float;\n"
        if (used_textures[0] || used_textures[1]) {
            fs_buf += "varying vec2 vTexCoord;\n"
        }
        if (opt_fog) {
            fs_buf += "varying vec4 vFog;\n"
        }
        for (let i = 0; i < num_inputs; i++) {
            fs_buf += `varying vec${opt_alpha ? 4 : 3} vInput${i+1};\n`
        }
        if (used_textures[0]) {
            fs_buf += "uniform sampler2D uTex0;\n"
        }
        if (used_textures[1]) {
            fs_buf += "uniform sampler2D uTex1;\n"
        }
        fs_buf += "void main() {\n"

        if (used_textures[0]) {
            fs_buf += "vec4 texVal0 = texture2D(uTex0, vTexCoord);\n"
        }
        if (used_textures[1]) {
            fs_buf += "vec4 texVal1 = texture2D(uTex1, vTexCoord);\n"
        }

        fs_buf += opt_alpha ? "vec4 texel = " : "vec3 texel = "
        if (!color_alpha_same && opt_alpha) {
            fs_buf += "vec4("
            fs_buf += this.create_formula(c, do_single[0], do_multiply[0], do_mix[0], false, false, true)
            fs_buf += ", "
            fs_buf += this.create_formula(c, do_single[1], do_multiply[1], do_mix[1], true, true, true)
            fs_buf += ")"
        } else {
            fs_buf += this.create_formula(c, do_single[0], do_multiply[0], do_mix[0], opt_alpha, false, opt_alpha)
        }
        fs_buf += ";\n"

        if (opt_texture_edge && opt_alpha) {
            fs_buf += "if (texel.a > 0.3) texel.a = 1.0; else discard;\n"
        }

        if (opt_fog) {
            if (opt_alpha) {
                fs_buf += "texel = vec4(mix(texel.rgb, vFog.rgb, vFog.a), texel.a);\n"
            } else {
                fs_buf += "texel = mix(texel, vFog.rgb, vFog.a);\n"
            }
        }

        if (opt_alpha) {
            fs_buf += "gl_FragColor = texel;\n"
        } else {
            fs_buf += "gl_FragColor = vec4(texel, 1.0);\n"
        }
        fs_buf += "}\n"

        const vertex_shader = this.createShader(this.gl, vs_buf, this.gl.VERTEX_SHADER)
        const fragment_shader = this.createShader(this.gl, fs_buf, this.gl.FRAGMENT_SHADER)

        const shader_program = this.gl.createProgram()
        this.gl.attachShader(shader_program, vertex_shader)
        this.gl.attachShader(shader_program, fragment_shader)
        this.gl.linkProgram(shader_program)

        const new_shader_program_obj = {
            shader_id,
            opengl_program: shader_program,
            num_inputs,
            num_floats,
            used_textures,
            attrib_locations: [],
            attrib_sizes: []
        }

        new_shader_program_obj.attrib_sizes.push(4)
        new_shader_program_obj.attrib_locations.push(this.gl.getAttribLocation(shader_program, "aVtxPos"))

        if (used_textures[0] || used_textures[1]) {
            new_shader_program_obj.attrib_sizes.push(2)
            new_shader_program_obj.attrib_locations.push(this.gl.getAttribLocation(shader_program, "aTexCoord"))
        }

        if (opt_fog) {
            new_shader_program_obj.attrib_sizes.push(4)
            new_shader_program_obj.attrib_locations.push(this.gl.getAttribLocation(shader_program, "aFog"))
        }

        for (let i = 0; i < num_inputs; i++) {
            const name = `aInput${i + 1}`
            new_shader_program_obj.attrib_sizes.push(opt_alpha ? 4 : 3)
            new_shader_program_obj.attrib_locations.push(this.gl.getAttribLocation(shader_program, name))
        }

        this.shader_program_pool.push(new_shader_program_obj)

        this.load_shader(new_shader_program_obj)

        if (used_textures[0]) {
            const sampler_attrib = this.gl.getUniformLocation(shader_program, "uTex0")
            this.gl.uniform1i(sampler_attrib, 0)
        }

        if (used_textures[1]) {
            const sampler_attrib = this.gl.getUniformLocation(shader_program, "uTex1")
            this.gl.uniform1i(sampler_attrib, 1)
        }

        return new_shader_program_obj

    }

    load_shader(new_prg) {
        this.gl.useProgram(new_prg.opengl_program)
        this.vertex_array_set_attribs(new_prg)
    }

    vertex_array_set_attribs(prg) {
        const num_floats = prg.num_floats
        let pos = 0

        for (let i = 0; i < prg.attrib_locations.length; i++) {
            this.gl.enableVertexAttribArray(prg.attrib_locations[i])
            this.gl.vertexAttribPointer(prg.attrib_locations[i], prg.attrib_sizes[i], this.gl.FLOAT, false, num_floats * 4, pos * 4)
            pos += prg.attrib_sizes[i]
        }
    }

    gfx_lookup_or_create_shader_program(shader_id) {
        let shaderProgram = this.lookup_shader(shader_id)
        if (!shaderProgram) {
            this.unload_shader(this.rendering_state.shader_program)
            shaderProgram = this.create_and_load_new_shader(shader_id)
            this.rendering_state.shader_program = shaderProgram
        }
        return shaderProgram
    }

    lookup_shader(shader_id) {
        return this.shader_program_pool.find(x => x.shader_id == shader_id)
    }

    unload_shader(old_prg) {
        if (old_prg) {
            old_prg.attrib_locations.forEach(attrib_index => {
                this.gl.disableVertexAttribArray(attrib_index)
            })
        }
    }

}
