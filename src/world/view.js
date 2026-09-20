import * as THREE from 'three';

// Geometry is the simulation's visible body and habitat, not a pre-rendered scene.
export class WorldView {
  constructor(host) {
    this.renderer=new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setClearColor(0x0c1513); this.renderer.shadowMap.enabled=true;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.25;
    host.append(this.renderer.domElement);this.canvas=this.renderer.domElement;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0x10251d,12,25);
    this.camera=new THREE.PerspectiveCamera(40,1,0.1,70);this.camera.position.set(7,7.6,10);
    this.camera.lookAt(0,0,0);
    this.scene.add(new THREE.HemisphereLight(0xdafbe4,0x394b32,2.2));
    const sun=new THREE.DirectionalLight(0xffe0a4,4);sun.position.set(-3,8,2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;this.scene.add(sun);this.sun=sun;
    const ground=this.mesh(new THREE.CylinderGeometry(6,6.1,0.3,80),0x263d2a);ground.position.y=-0.18;ground.receiveShadow=true;
    const rim=this.mesh(new THREE.TorusGeometry(5.95,0.045,8,100),0x7b9682);rim.rotation.x=Math.PI/2;rim.position.y=0.03;
    // Seeded distribution keeps the habitat fixed between sessions and camera modes.
    let seed=81; const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const mossGeo=new THREE.IcosahedronGeometry(0.14,0);
    for(let i=0;i<180;i++) {
      const x=(rand()-0.5)*11,z=(rand()-0.5)*11;
      if(Math.hypot(x,z)>5.7)continue;
      const tuft=this.mesh(mossGeo,[0x4b653b,0x668247,0x344f31][i%3]);tuft.position.set(x,0.02,z);tuft.scale.set(1+rand(),0.5+rand(),1);tuft.rotation.y=rand()*6;
    }
    this.fruit=new THREE.Group();this.scene.add(this.fruit);
    for(let y=0;y<4;y++)for(let i=0;i<10;i++) {
      const a=i/10*Math.PI*2+y*0.33,r=0.4-Math.abs(y-1.3)*0.07;
      const berry=this.mesh(new THREE.SphereGeometry(0.19,16,12),0x8f293e,this.fruit);berry.position.set(Math.cos(a)*r,0.13+y*0.2,Math.sin(a)*r);berry.castShadow=true;
    }
    const leaf=this.mesh(new THREE.SphereGeometry(1,18,12),0x5c8035,this.fruit);leaf.position.set(0.2,0.88,0);leaf.scale.set(0.48,0.035,0.17);leaf.rotation.z=0.2;
    this.fly=new THREE.Group();this.scene.add(this.fly);this.fly.scale.setScalar(0.8);
    const abdomen=this.mesh(new THREE.SphereGeometry(1,24,18),0x8a6336,this.fly);abdomen.scale.set(0.29,0.16,0.17);abdomen.position.set(-0.13,0.31,0);
    for(let i=0;i<4;i++) {const stripe=this.mesh(new THREE.TorusGeometry(0.153-i*0.012,0.018,8,24),0x332d20,this.fly);stripe.rotation.y=Math.PI/2;stripe.position.set(-0.12-i*0.065,0.31,0);}
    const thorax=this.mesh(new THREE.SphereGeometry(0.15,20,14),0x987440,this.fly);thorax.position.set(0.13,0.33,0);
    const head=this.mesh(new THREE.SphereGeometry(0.12,20,14),0x795534,this.fly);head.position.set(0.33,0.34,0);
    for(const z of [-1,1]) {const eye=this.mesh(new THREE.SphereGeometry(0.082,18,14),0xac3026,this.fly);eye.position.set(0.36,0.36,z*0.079);}
    this.legs=[];this.wings=[];
    for(const side of [-1,1]) {
      const wing=this.mesh(new THREE.SphereGeometry(1,24,12),0xc5e4d7,this.fly);wing.material.transparent=true;wing.material.opacity=0.38;wing.material.roughness=0.1;wing.scale.set(0.38,0.012,0.125);wing.position.set(-0.05,0.47,side*0.17);wing.rotation.y=side*0.3;this.wings.push(wing);
      for(let i=0;i<3;i++) {
        const leg=new THREE.Group();this.fly.add(leg);leg.position.set(0.22-i*0.18,0.27,side*0.07);
        const path=new THREE.CatmullRomCurve3([new THREE.Vector3(),new THREE.Vector3((i-1)*0.09,-0.06,side*0.2),new THREE.Vector3((i-1)*0.17,-0.25,side*0.29)]);
        this.mesh(new THREE.TubeGeometry(path,6,0.012,5,false),0x30281b,leg);this.legs.push(leg);
      }
    }
    this.track=false;
    new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}).observe(host);
  }
  mesh(geometry,color,parent=this.scene) {const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:0.8}));parent.add(mesh);return mesh;}
  render(s,now) {
    this.fly.position.set(s.x,0,s.z);this.fly.rotation.y=-s.heading;this.fruit.position.set(s.food.x,0,s.food.z);this.sun.intensity=1+4*s.light;
    const walking=['forward','left','right'].includes(s.action);
    this.legs.forEach((leg,i)=>leg.rotation.y=walking?Math.sin(now*16+i*Math.PI/3)*0.3:0);
    this.wings.forEach((wing,i)=>wing.rotation.x=s.action==='groom'?Math.sin(now*8+i)*0.22:0);
    const target=this.track?new THREE.Vector3(s.x+3,3.3,s.z+4.4):new THREE.Vector3(7,7.6,10);
    this.camera.position.lerp(target,0.045);this.camera.lookAt(this.track?new THREE.Vector3(s.x,0.3,s.z):new THREE.Vector3(0,0,0));
    this.renderer.render(this.scene,this.camera);
  }
}
