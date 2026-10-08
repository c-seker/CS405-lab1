// CS405 · Lab 1 — your first triangle in WebGPU (starter)
// Work through the TODOs in order. After each one, check the matching
// checkpoint on the lab slides. The reference solution is in ../lab1-solution/.

const canvas = document.querySelector('canvas');

// ---------------------------------------------------------------------------
// TODO 1 — get a device and configure the canvas
//   a) check navigator.gpu exists, throw a clear error if not
//   b) const adapter = await navigator.gpu.requestAdapter()
//   c) const device  = await adapter.requestDevice()
//   d) const ctx     = canvas.getContext('webgpu')
//   e) const format  = navigator.gpu.getPreferredCanvasFormat()
//   f) ctx.configure({ device, format, alphaMode: 'opaque' })
//   g) console.log('WebGPU ready:', format)
// ---------------------------------------------------------------------------

if (!navigator.gpu) throw new Error('WebGPU not available');

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const ctx = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
ctx.configure({ device, format, alphaMode: 'opaque' });
console.log('WebGPU ready:', format);


// ---------------------------------------------------------------------------
// TODO 2 — a shader module and a render pipeline
//   The vertex shader returns clip-space positions for vertex_index 0, 1, 2.
//   The fragment shader returns a solid colour.
//   Then: device.createRenderPipeline({ layout: 'auto', vertex, fragment })
// ---------------------------------------------------------------------------
const SHADER = `
  struct U {time: f32, aspect: f32, pad: vec2f};
  @group(0) @binding(0) var<uniform> u: U;

  struct VSOut {
    @builtin(position) pos: vec4f,
    @location(0) colour: vec4f
  };


  @vertex fn vs(@builtin(vertex_index) i: u32)
       -> VSOut {
    // Two triangles share the four corners of a square (size 0.35).
    var p = array<vec2f, 6>(
      vec2f(-0.35, -0.35), vec2f( 0.35, -0.35), vec2f( 0.35,  0.35),
      vec2f(-0.35, -0.35), vec2f( 0.35,  0.35), vec2f(-0.35,  0.35));

    var c = array<vec3f, 6>(
      vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 0.0, 1.0),
      vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0), vec3f(1.0, 1.0, 0.0));

      let a = u.time;
      // TODO 4 — same rotation written as two scalar formulas:
      // var q = vec2f(p[i].x * cos(a) - p[i].y * sin(a),
      //               p[i].x * sin(a) + p[i].y * cos(a));
      // TODO 6 — the same 2×2 rotation matrix: [cos -sin; sin cos] * p
      // WGSL stores matrices by column, so the args are col0 then col1.
      let R = mat2x2f(cos(a), sin(a), -sin(a), cos(a));
      var q = R * p[i];
      q.x /= u.aspect;   // undo the canvas's 4:3 stretch so it looks square
      q += u.pad;        // pad = mouse position in clip space

      var out: VSOut;
      out.pos = vec4f(q, 0.0,1.0);
      out.colour = vec4f(c[i], 1.0);
      return out;
  }
  @fragment fn fs(in: VSOut) -> @location(0) vec4f {
    return in.colour;
  }` ;

const module = device.createShaderModule({ code: SHADER });

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module, entryPoint: 'vs' },
  fragment: { module, entryPoint: 'fs', targets: [{ format }] }
});


const ubuf = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

const bind = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: ubuf } }]
});


// ---------------------------------------------------------------------------
// TODO 3 — a colour per vertex
//   Return a struct from the vertex shader with @location(0) colour,
//   take it as the fragment shader's input, and watch it interpolate.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// TODO 4 — a uniform buffer with the time, and rotate the triangle
//   size 16 bytes, usage UNIFORM | COPY_DST
//   bind group from pipeline.getBindGroupLayout(0)
//   device.queue.writeBuffer(...) every frame
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// TODO 6 — the same rotation, as a matrix
//   The two scalar lines in the vertex shader ARE a matrix multiply.
//   Replace them with mat2x2f(...) * p[i]. Uniforms / JS stay the same.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// TODO 5 — your turn: a square (two triangles), correct aspect ratio,
//   and the shape following the mouse.
// ---------------------------------------------------------------------------
const mouse = { x: 0, y: 0 };

canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = 1 - ((e.clientY - r.top) / r.height) * 2;
});


// TODO 1 (continued): create a command encoder, begin a render pass that
// clears the canvas, end it, and submit it to device.queue.
const t0 = performance.now();

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
window.addEventListener('resize', resize);
resize();
function frame() {

  const t = (performance.now() - t0) * 0.001;

  const aspect = canvas.width / canvas.height;
  device.queue.writeBuffer(ubuf, 0, new Float32Array([t, aspect, mouse.x, mouse.y]));

  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({
    colorAttachments: [{
      view: ctx.getCurrentTexture().createView(),
      clearValue: { r: 0.19, g: 0.2, b: 0.6, a: 1 },
      loadOp: 'clear', storeOp: 'store'
    }]
  });

  // TODO 2 (continued): pass.setPipeline(pipeline); pass.draw(3);
  // TODO 4 (continued): writeBuffer + pass.setBindGroup(0, bindGroup);
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  pass.draw(6);
  pass.end();

  device.queue.submit([enc.finish()]);

  requestAnimationFrame(frame);
}
frame();
