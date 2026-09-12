import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class BrainView {
  constructor(container) {
    this.container=container; this.startTime=performance.now(); this.lastTick=0;
    try { this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); }
    catch { container.innerHTML='<p class="canvas-fallback">当前设备无法显示 3D 点云。神经计算与脉冲统计仍可使用。</p>'; return; }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.domElement.setAttribute('aria-label','FlyWire 实测神经元锚点，可拖动旋转、滚轮缩放');
    this.renderer.domElement.setAttribute('role','img');
    container.appendChild(this.renderer.domElement);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(38,1,0.01,100); this.camera.position.set(0,0,3.0);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true; this.controls.enablePan=false; this.controls.minDistance=1.3; this.controls.maxDistance=6;
    this.resize=new ResizeObserver(()=>this.fit()); this.resize.observe(container);
    this.frame=this.frame.bind(this); requestAnimationFrame(this.frame);
  }
  load(buffer,n) {
    if (!this.renderer) return;
    this.n=n;
    const coordinates=new Float32Array(buffer,0,n*3), groups=new Uint8Array(buffer,n*12,n), valid=new Uint8Array(buffer,n*13,n);
    const positions=new Float32Array(n*3), colors=new Float32Array(n*3), opacity=new Float32Array(n);
    const palette=['#746c97','#8296c2','#47a99a','#b66680'].map(c=>new THREE.Color(c));
    for (let i=0;i<n;i++) {
      // Published 4x4x40 nm anchors, scale fixed by importer; orient dorsal view.
      positions[i*3]=coordinates[i*3]; positions[i*3+1]=-coordinates[i*3+2]; positions[i*3+2]=coordinates[i*3+1];
      palette[groups[i]].toArray(colors,i*3); opacity[i]=valid[i]?1:0;
    }
    this.groupIds=groups; this.pulse=new Float32Array(n); this.pulse.fill(-100);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometry.setAttribute('valid',new THREE.BufferAttribute(opacity,1));
    geometry.setAttribute('fired',new THREE.BufferAttribute(this.pulse,1).setUsage(THREE.DynamicDrawUsage));
    this.material=new THREE.ShaderMaterial({ transparent:true, depthWrite:false,
      uniforms:{now:{value:0},pointScale:{value:this.renderer.getPixelRatio()}},
      vertexShader:`attribute vec3 color; attribute float valid; attribute float fired;
        uniform float now; uniform float pointScale; varying vec3 tint; varying float alpha;
        void main(){ float activity=max(0.,1.-(now-fired)/.8); tint=mix(color,vec3(.46,.18,.72),activity);
          alpha=valid*(.13+activity*.87); gl_PointSize=(1.35+activity*3.)*pointScale;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader:`varying vec3 tint; varying float alpha;
        void main(){float r=length(gl_PointCoord-vec2(.5)); if(r>.5)discard;
          gl_FragColor=vec4(tint,alpha*smoothstep(.5,.2,r));}`,
    });
    this.points=new THREE.Points(geometry,this.material); this.scene.add(this.points); this.fit();
  }
  showEvents(events) {
    if (!this.pulse) return;
    const now=(performance.now()-this.startTime)/1000;
    for (let i=1;i<events.length;i+=2) this.pulse[events[i]]=now;
    this.points.geometry.attributes.fired.needsUpdate=true;
  }
  clear() { if(this.pulse){this.pulse.fill(-100);this.points.geometry.attributes.fired.needsUpdate=true;} }
  fit() {
    const {width,height}=this.container.getBoundingClientRect();
    this.renderer.setSize(width,height); this.camera.aspect=width/Math.max(1,height); this.camera.updateProjectionMatrix();
  }
  frame(t) {
    // Throttle quiet views; firing timestamps originate exclusively from WASM.
    if(t-this.lastTick>32) {
      this.lastTick=t; this.controls.update();
      if(this.material) this.material.uniforms.now.value=(performance.now()-this.startTime)/1000;
      this.renderer.render(this.scene,this.camera);
    }
    requestAnimationFrame(this.frame);
  }
}
