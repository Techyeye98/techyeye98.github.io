import * as THREE from './vendor/three.module.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.querySelector('#portrait-stage');
const loader = document.querySelector('#loader');
const button = document.querySelector('#reveal');
let revealed = false, reveal = 0, revealTarget = 0;
const pointer = new THREE.Vector2();
let hasMoved = false;
let paused = document.hidden;
document.addEventListener('visibilitychange', () => paused = document.hidden);
document.querySelector('#year').textContent = new Date().getFullYear();


async function loadArtwork() {
  // Embedded by the standalone packager; hosted assets use real byte progress.
  if (window.PORTFOLIO_EMBED) {
    const bytes = Uint8Array.from(atob(window.PORTFOLIO_EMBED.dots), c => c.charCodeAt(0));
    return [bytes.buffer, await new THREE.TextureLoader().loadAsync(window.PORTFOLIO_EMBED.photo)];
  }
  const files=['assets/portrait-dots.bin','assets/portrait.png'];
  const responses=await Promise.all(files.map(f=>fetch(f)));
  responses.forEach(r=>{if(!r.ok)throw new Error('Artwork could not be downloaded');});
  const sizes=responses.map(r=>Number(r.headers.get('content-length')));
  const total=sizes.reduce((a,b)=>a+b,0);let loaded=0;
  const buffers=await Promise.all(responses.map(async response=>{
    if(!response.body)return response.arrayBuffer();
    const reader=response.body.getReader();const chunks=[];let length=0;
    for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);length+=value.length;loaded+=value.length;loader.querySelector('span').textContent=total?`${Math.min(99,Math.floor(loaded/total*100))}%`:`${(loaded/1048576).toFixed(1)} MB`;}
    const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes.buffer;
  }));
  const url=URL.createObjectURL(new Blob([buffers[1]],{type:'image/png'}));
  try{return [buffers[0],await new THREE.TextureLoader().loadAsync(url)];}finally{URL.revokeObjectURL(url);}
}

async function initPortrait(){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  renderer.setClearColor(0,0);stage.append(renderer.domElement);
  const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-2,2,1,-1,.1,100);camera.position.z=6;
  const [binary,photo]=await loadArtwork();photo.colorSpace=THREE.SRGBColorSpace;
  // Fill each portrait outline row so dark hair and glasses retain solid interiors.
  const maskCanvas=document.createElement('canvas');maskCanvas.width=photo.image.width;maskCanvas.height=photo.image.height;
  const maskContext=maskCanvas.getContext('2d',{willReadFrequently:true});maskContext.drawImage(photo.image,0,0);
  const pixels=maskContext.getImageData(0,0,maskCanvas.width,maskCanvas.height).data;
  const boundsData=new Float32Array(maskCanvas.height*4);
  for(let y=0;y<maskCanvas.height;y++){let left=maskCanvas.width,right=-1;for(let x=0;x<maskCanvas.width;x++){const k=(y*maskCanvas.width+x)*4;if(Math.max(pixels[k],pixels[k+1],pixels[k+2])>26){left=Math.min(left,x);right=x;}}const j=(maskCanvas.height-y-1)*4;boundsData[j]=left/maskCanvas.width;boundsData[j+1]=right/maskCanvas.width;boundsData[j+2]=right>left?1:0;boundsData[j+3]=1;}
  const boundsTexture=new THREE.DataTexture(boundsData,maskCanvas.height,1,THREE.RGBAFormat,THREE.FloatType);boundsTexture.needsUpdate=true;
  const allData=new Float32Array(binary);const raw=allData.subarray(0,780000);const n=raw.length/10;
  const positions=new Float32Array(n*3), normals=new Float32Array(n*3),uvs=new Float32Array(n*2),seeds=new Float32Array(n),brightness=new Float32Array(n);
  for(let i=0;i<n;i++){positions.set(raw.subarray(i*10,i*10+3),i*3);normals.set(raw.subarray(i*10+3,i*10+6),i*3);uvs.set([raw[i*10+6],1-raw[i*10+7]],i*2);seeds[i]=raw[i*10+8];brightness[i]=raw[i*10+9];}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aNormal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('aUv',new THREE.BufferAttribute(uvs,2));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));geometry.setAttribute('aBrightness',new THREE.BufferAttribute(brightness,1));
  const uniforms={uTime:{value:0},uIntro:{value:reduced?1:0},uReveal:{value:0},uTurn:{value:0},uTilt:{value:0},uPointer:{value:pointer},uPixelRatio:{value:renderer.getPixelRatio()},uPhoto:{value:photo},uAccent:{value:new THREE.Color(.82,.045,.065)}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms,
    vertexShader:`attribute vec3 aNormal;attribute vec2 aUv;attribute float aSeed;attribute float aBrightness;uniform float uTime,uIntro,uReveal,uTurn,uTilt,uPixelRatio;uniform vec2 uPointer;varying float vAlpha,vBrightness,vSeed;varying vec2 vUv;
    mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
    void main(){vec3 p=position;vec3 normal=aNormal;float y=clamp((position.y+.6)/1.2,0.,1.);float head=smoothstep(-.55,.1,position.y);float turn=uTurn*(.25+.75*head)*(1.-uReveal);p.xz=rot(turn)*p.xz;normal.xz=rot(turn)*normal.xz;p.yz=rot(uTilt*head*(1.-uReveal))*p.yz;
    float band=1.-uReveal*2.3;float passed=smoothstep(band-.12,band+.12,position.y);float revealPart=passed*smoothstep(.001,.06,uReveal);p=mix(p,vec3(position.xy,0.),revealPart);float t=smoothstep(0.,1.,clamp((uIntro-aSeed*.25)/.75,0.,1.));vec3 ring=vec3(cos(aSeed*6.283)*.28,sin(aSeed*6.283)*.28,0.);p=mix(ring,p,t);p.z+=sin(aSeed*135.+uTime*.6)*.006*(1.-uReveal);
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(1.55+aSeed*1.25)*uPixelRatio;float light=max(dot(normal,normalize(vec3(-.4,.65,1.))),0.);float rim=pow(1.-abs(normal.z),2.);float cursor=exp(-length(p.xy-uPointer)*2.4);vBrightness=aBrightness*(.58+.4*light)+rim*.18+cursor*.24;vAlpha=(1.-revealPart)*t*(normal.z>-.15?1.:.24);vSeed=aSeed;vUv=aUv;}`,
    fragmentShader:`uniform sampler2D uPhoto;uniform float uReveal;uniform vec3 uAccent;varying float vAlpha,vBrightness,vSeed;varying vec2 vUv;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;vec3 crimson=uAccent*vBrightness;vec3 photo=texture2D(uPhoto,vUv).rgb;vec3 color=mix(crimson,photo,uReveal*.7);float alpha=pow(1.-d*d,1.7)*vAlpha*.94;gl_FragColor=vec4(color,alpha);}`});
  const hullGeometry=new THREE.BufferGeometry();hullGeometry.setAttribute('position',new THREE.BufferAttribute(allData.subarray(780000),3));
  const hullMaterial=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms,vertexShader:`uniform float uTurn,uTilt,uReveal,uIntro;mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}void main(){vec3 p=position;float head=smoothstep(-.55,.1,p.y);p.xz=rot(uTurn*(.25+.75*head)*(1.-uReveal))*p.xz;p.yz=rot(uTilt*head*(1.-uReveal))*p.yz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:'uniform float uIntro,uReveal;void main(){gl_FragColor=vec4(vec3(.035),smoothstep(0.,.8,uIntro)*(1.-uReveal));}'});
  // Accent colour follows the theme dot (CSS --particle), easing between themes in the frame loop.
  const accentTarget=new THREE.Color(.82,.045,.065);const readAccent=()=>{const v=getComputedStyle(document.documentElement).getPropertyValue('--particle').trim().split(/[\s,]+/).map(Number);if(v.length===3&&v.every(n=>!isNaN(n)))accentTarget.setRGB(v[0],v[1],v[2]);};readAccent();uniforms.uAccent.value.copy(accentTarget);addEventListener('accentchange',readAccent);
  const hull=new THREE.Mesh(hullGeometry,hullMaterial);hull.renderOrder=0;scene.add(hull);
  const bust=new THREE.Points(geometry,material);bust.renderOrder=1;scene.add(bust);
  const photoMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uPhoto:{value:photo},uBounds:{value:boundsTexture},uReveal:uniforms.uReveal},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D uPhoto,uBounds;uniform float uReveal;varying vec2 vUv;void main(){vec4 c=texture2D(uPhoto,vUv);float band=1.-uReveal*2.3;float fill=smoothstep(band-.12,band+.12,vUv.y*2.-1.);vec2 grid=fract(vUv*vec2(235.,132.))-.5;float radius=fill*.78;float dots=1.-smoothstep(radius-.025,radius+.025,length(grid));vec4 bounds=texture2D(uBounds,vec2(vUv.y,.5));float cut=smoothstep(bounds.r-.002,bounds.r+.002,vUv.x)*(1.-smoothstep(bounds.g-.002,bounds.g+.002,vUv.x))*bounds.b;float alpha=dots*step(.001,uReveal)*cut;gl_FragColor=vec4(c.rgb,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(3.554,2),photoMat);plane.position.z=-.04;plane.renderOrder=2;scene.add(plane);
  // A quiet atmosphere, with no DOM overlays competing with the portrait.
  const dustPositions=new Float32Array(220*3);for(let i=0;i<dustPositions.length;i+=3){dustPositions[i]=(Math.random()-.5)*6;dustPositions[i+1]=(Math.random()-.5)*3;dustPositions[i+2]=-1;}
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0x79313a,size:.004,transparent:true,opacity:.35,depthWrite:false}));scene.add(dust);
  function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);const ratio=w/h;camera.left=-ratio;camera.right=ratio;camera.top=1;camera.bottom=-1;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(stage);resize();
  document.documentElement.classList.add('webgl-ready');loader.querySelector('span').textContent='100%';setTimeout(()=>loader.remove(),250);button.disabled=false;
  document.querySelector('.hero').addEventListener('pointermove',e=>{if(revealed)return;const r=stage.getBoundingClientRect();pointer.set(((e.clientX-r.left)/r.width*2-1)*(r.width/r.height),-((e.clientY-r.top)/r.height*2-1));hasMoved=true;});
  button.addEventListener('click',()=>{revealed=!revealed;revealTarget=revealed?1:0;button.querySelector('.button-label').textContent=revealed?'Back to dots':'Reveal me';button.setAttribute('aria-pressed',String(revealed));document.body.classList.toggle('is-revealed',revealed);document.querySelector('#interaction-hint').textContent=revealed?'THE PERSON BEHIND THE PARTICLES.':'MOVE YOUR CURSOR. SAY HELLO.';});
  button.setAttribute('aria-pressed','false');
  let elapsed=0,last=performance.now(),turn=0,tilt=0;
  const observer=new IntersectionObserver(([e])=>{stage.dataset.visible=e.isIntersecting?'yes':'no';},{threshold:.01});observer.observe(stage);
  function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(paused||stage.dataset.visible==='no')return;elapsed+=dt;
    uniforms.uTime.value=elapsed;uniforms.uIntro.value=reduced?1:Math.min(elapsed/2.1,1);
    const targetTurn=reduced||revealed?0:hasMoved?THREE.MathUtils.clamp(pointer.x*.32,-.52,.52):Math.sin(elapsed*.4)*.1;
    const targetTilt=reduced||revealed?0:THREE.MathUtils.clamp(pointer.y*.08,-.09,.09);
    turn=THREE.MathUtils.damp(turn,targetTurn,5,dt);tilt=THREE.MathUtils.damp(tilt,targetTilt,5,dt);uniforms.uTurn.value=turn;uniforms.uTilt.value=tilt;
    // Return to a front view before the reveal band reaches the sculpture.
    if(!revealed||Math.abs(turn)<.025){const step=dt/(reduced?.01:3.6);reveal=THREE.MathUtils.clamp(reveal+(revealTarget>reveal?step:revealTarget<reveal?-step:0),0,1);}
    uniforms.uReveal.value=reveal;uniforms.uAccent.value.lerp(accentTarget,reduced?1:Math.min(1,dt*5));dust.material.color.copy(uniforms.uAccent.value).multiplyScalar(.6);if(!reduced)dust.rotation.z=elapsed*.006;renderer.render(scene,camera);
  }requestAnimationFrame(frame);
  window.portfolioScene={particleCount:n,renderer,scene,camera,get reveal(){return reveal;},get intro(){return uniforms.uIntro.value;}};
}
initPortrait().catch(error=>{console.error('Portrait renderer:',error);loader.remove();button.disabled=false;button.querySelector('.button-label').textContent='Portrait view';document.querySelector('#interaction-hint').textContent='YOUR BROWSER IS SHOWING THE PHOTO.';button.addEventListener('click',()=>stage.querySelector('.fallback-photo').style.opacity='1');});

// Start each decorative entrance once, without hiding content before JavaScript runs.
if (!reduced && 'IntersectionObserver' in window) {
  const workMotion = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in-view');
      workMotion.unobserve(entry.target);
    }
  }, { threshold: .22 });
  document.querySelectorAll('.ledger-shot, .tvora-shot, .workflow, .contact')
    .forEach(section => workMotion.observe(section));
}
