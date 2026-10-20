import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $ = id => document.getElementById(id);
const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
if (touch) document.body.classList.add('touch');
const menu=$('menu'), startBtn=$('startBtn');
const scene=new THREE.Scene();
scene.background=new THREE.Color('#91c7e3');
scene.fog=new THREE.Fog('#91c7e3',28,74);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.06,90);
let renderer;
try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  $('game').appendChild(renderer.domElement);
}catch(e){$('error').textContent='WebGLが使えません: '+e.message;startBtn.disabled=true;throw e;}
scene.add(new THREE.HemisphereLight('#f5faff','#5b7f9a',2.3));
const sun=new THREE.DirectionalLight('#fff1d9',2.4);sun.position.set(-12,20,7);scene.add(sun);
const mat=(color,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),mat('#617a83'));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;scene.add(floor);
const grid=new THREE.GridHelper(50,25,'#9ab0b9','#76909b');grid.position.y=.01;scene.add(grid);
const boxes=[],obstacles=[];
function addBox(x,z,w,d,h,material=mat('#45647a')){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,h/2,z);scene.add(mesh);boxes.push({x,z,w,d});obstacles.push(mesh);return mesh;
}
const wallMat=mat('#dae8ee'),coverMat=mat('#45647a');
addBox(0,-25,50,1,7,wallMat);addBox(0,25,50,1,7,wallMat);
addBox(-25,0,1,50,7,wallMat);addBox(25,0,1,50,7,wallMat);
[[-10,-8,6,2,2.2],[10,-8,6,2,2.2],[-10,7,6,2,2.2],[10,7,6,2,2.2],[0,0,3,3,2.6],[-17,0,2,7,2.3],[17,0,2,7,2.3]]
  .forEach(a=>addBox(...a,coverMat));
for(const [x,z] of [[-20,-18],[20,-18],[-20,17],[20,17]]){
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,5,8),mat('#b5d5df'));
  pillar.position.set(x,2.5,z);scene.add(pillar);
}
function collides(x,z,r=.46){
  if(x<-24.1+r||x>24.1-r||z<-24.1+r||z>24.1-r)return true;
  return boxes.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);
}
const player={pos:new THREE.Vector3(0,1.7,14),yaw:0,pitch:0,velY:0,grounded:true,
  health:200,maxHealth:200,ammo:30,magazine:30,reloading:0,shotCooldown:0,kills:0,deaths:0,
  sliding:0,slideDir:new THREE.Vector3(),eyeHeight:1.7,alive:true,respawn:0};
let running=false,firing=false;
const movement={x:0,y:0},keys=new Set();
function aim(dx,dy){
  player.yaw-=dx*.0032;
  player.pitch=THREE.MathUtils.clamp(player.pitch-dy*.0032,-1.42,1.42);
}
const gun=new THREE.Group();
const barrel=new THREE.Mesh(new THREE.BoxGeometry(.17,.18,.75),mat('#243542',.48));
barrel.position.set(.29,-.23,-.54);gun.add(barrel);
const grip=new THREE.Mesh(new THREE.BoxGeometry(.19,.26,.23),mat('#111d27'));
grip.position.set(.25,-.38,-.36);gun.add(grip);
const sight=new THREE.Mesh(new THREE.BoxGeometry(.06,.09,.15),mat('#9ad5ed',.38));
sight.position.set(.29,-.095,-.65);gun.add(sight);
camera.add(gun);scene.add(camera);
let kick=0,bob=0;
const bots=[],targets=[];
const spawnPoints=[[-8,-13],[9,-13],[-1,-20]];
function makeBot(index){
  const root=new THREE.Group();
  const color=['#ed6c64','#e8a14c','#bc72e4'][index];
  const body=new THREE.Mesh(new THREE.BoxGeometry(.85,1.12,.53),mat(color));
  body.position.y=1;root.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.31,10,7),mat('#f8dfcb'));
  head.position.y=1.82;root.add(head);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.35,.1,.07),mat('#243d54'));
  visor.position.set(0,1.84,-.28);root.add(visor);
  for(const x of [-.22,.22]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.28,.6,.32),mat('#2d4756'));
    leg.position.set(x,.3,0);root.add(leg);
  }
  const back=new THREE.Mesh(new THREE.PlaneGeometry(.93,.12),new THREE.MeshBasicMaterial({color:'#182b38',depthTest:false}));
  back.position.set(0,2.35,0);root.add(back);
  const fill=new THREE.Mesh(new THREE.PlaneGeometry(.89,.085),new THREE.MeshBasicMaterial({color:'#80ffca',depthTest:false}));
  fill.position.set(0,2.35,.005);root.add(fill);
  const bot={root,body,head,back,fill,health:200,maxHealth:200,alive:true,respawn:0,
    heading:Math.random()*Math.PI*2,changeIn:1.5+Math.random()*1.5,shootIn:1+index*.5,index};
  for(const mesh of [body,head]){mesh.userData.bot=bot;mesh.userData.head=mesh===head;targets.push(mesh);}
  root.position.set(spawnPoints[index][0],0,spawnPoints[index][1]);scene.add(root);bots.push(bot);
}
spawnPoints.forEach((_,i)=>makeBot(i));
const tracerMat=new THREE.LineBasicMaterial({color:'#ffdf85',transparent:true,opacity:1,depthWrite:false});
const tracers=[],raycaster=new THREE.Raycaster(),rayOrigin=new THREE.Vector3(),rayDir=new THREE.Vector3();
let hitTimer=0,msgTimer=0,damageAlpha=0;
function message(msg,time=1.1){$('message').textContent=msg;$('message').classList.add('show');msgTimer=time;}
function reload(){
  if(!running||!player.alive||player.reloading>0||player.ammo===player.magazine)return;
  player.reloading=1.65;$('weaponStatus').textContent='RELOADING';
}
function tracer(from,to,color='#ffdf85'){
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([from,to]),tracerMat.clone());
  line.material.color.set(color);scene.add(line);tracers.push({line,time:.14});
}
function fire(){
  if(!running||!player.alive||player.shotCooldown>0||player.reloading>0)return;
  if(player.ammo<=0){reload();return;}
  player.shotCooldown=.10;player.ammo--;kick=Math.min(.15,kick+.065);
  camera.updateMatrixWorld(true);
  camera.getWorldPosition(rayOrigin);camera.getWorldDirection(rayDir);
  raycaster.set(rayOrigin,rayDir);raycaster.far=75;
  const hits=raycaster.intersectObjects([...targets.filter(m=>m.userData.bot.alive),...obstacles],false);
  let end=rayOrigin.clone().addScaledVector(rayDir,60);
  if(hits.length){
    const first=hits[0];end=first.point;
    const bot=first.object.userData.bot;
    if(bot&&bot.alive){
      const damage=first.object.userData.head?25:17;
      bot.health=Math.max(0,bot.health-damage);
      $('hitmarker').classList.add('show');hitTimer=.11;
      if(bot.health===0){
        bot.alive=false;bot.respawn=2.5;bot.root.visible=false;player.kills++;message('ELIMINATED +1');
      }
    }
  }
  const muzzle=new THREE.Vector3(.29,-.22,-.9).applyMatrix4(camera.matrixWorld);
  tracer(muzzle,end);
  if(player.ammo===0)reload();
}
function jump(){if(running&&player.alive&&player.grounded){player.velY=7;player.grounded=false;player.sliding=0;}}
function desiredMove(){
  const x=THREE.MathUtils.clamp(movement.x+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),-1,1);
  const y=THREE.MathUtils.clamp(movement.y+(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),-1,1);
  const v=new THREE.Vector3(Math.cos(player.yaw)*x+Math.sin(player.yaw)*y,0,
    Math.sin(player.yaw)*x-Math.cos(player.yaw)*y);
  return v.lengthSq()>1?v.normalize():v;
}
function slide(){
  if(!running||!player.alive||!player.grounded||player.sliding>0)return;
  const dir=desiredMove();if(dir.lengthSq()<.06)return;
  player.slideDir.copy(dir.normalize());player.sliding=.62;
}
function updatePlayer(dt){
  if(!player.alive){
    player.respawn-=dt;
    if(player.respawn<=0){
      player.alive=true;player.health=200;player.ammo=30;player.reloading=0;
      player.pos.set(0,1.7,14);player.velY=0;player.grounded=true;message('RESPAWN');
    }
    return;
  }
  player.shotCooldown=Math.max(0,player.shotCooldown-dt);
  if(player.reloading>0){
    player.reloading-=dt;
    if(player.reloading<=0){player.reloading=0;player.ammo=30;$('weaponStatus').textContent='AR · AUTO';}
  }
  if(firing||keys.has('Mouse0'))fire();
  const dir=desiredMove(),moving=dir.lengthSq()>.02;
  const sprint=keys.has('ShiftLeft')||(touch&&dir.length()>.94);
  let velocity=dir.multiplyScalar(sprint?8:6);
  if(player.sliding>0){
    player.sliding-=dt;
    velocity=player.slideDir.clone().multiplyScalar(10.7*(.4+.6*Math.max(0,player.sliding)/.62));
  }
  const nx=player.pos.x+velocity.x*dt,nz=player.pos.z+velocity.z*dt;
  if(!collides(nx,player.pos.z))player.pos.x=nx;
  if(!collides(player.pos.x,nz))player.pos.z=nz;
  player.velY-=18*dt;player.pos.y+=player.velY*dt;
  const height=player.sliding>0?1.2:1.7;
  player.eyeHeight=THREE.MathUtils.damp(player.eyeHeight,height,16,dt);
  if(player.pos.y<=1.7){player.pos.y=1.7;player.velY=0;player.grounded=true;}
  else player.grounded=false;
  camera.position.set(player.pos.x,player.pos.y+(player.eyeHeight-1.7),player.pos.z);
  camera.rotation.order='YXZ';camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;
  kick=THREE.MathUtils.damp(kick,0,14,dt);bob+=dt*(moving?13:3);
  gun.position.set(0,Math.sin(bob)*.009*(moving?1:0),kick);gun.rotation.x=kick*.5;
}
function botSeesPlayer(bot){
  const start=bot.root.position.clone().add(new THREE.Vector3(0,1.5,0));
  const direction=player.pos.clone().sub(start),len=direction.length();
  raycaster.set(start,direction.normalize());raycaster.far=len;
  return raycaster.intersectObjects(obstacles,false).length===0;
}
function updateBots(dt){
  for(const bot of bots){
    if(!bot.alive){
      bot.respawn-=dt;
      if(bot.respawn<=0){
        bot.alive=true;bot.health=200;
        bot.root.position.set(spawnPoints[bot.index][0],0,spawnPoints[bot.index][1]);
        bot.root.visible=true;
      }
      continue;
    }
    bot.changeIn-=dt;
    if(bot.changeIn<=0){bot.heading+=(Math.random()-.5)*2.6;bot.changeIn=1+Math.random()*2;}
    const p=bot.root.position,step=dt*2.35;
    const nx=p.x+Math.sin(bot.heading)*step,nz=p.z+Math.cos(bot.heading)*step;
    if(collides(nx,nz,.52)){bot.heading+=Math.PI*.7;bot.changeIn=.2;}else{p.x=nx;p.z=nz;}
    const angle=Math.atan2(player.pos.x-p.x,p.z-player.pos.z);
    bot.body.rotation.y=angle;bot.head.rotation.y=angle;
    bot.fill.scale.x=bot.health/bot.maxHealth;
    bot.fill.position.x=-(1-bot.fill.scale.x)*.445;
    bot.fill.lookAt(camera.position.x-p.x,2.35,camera.position.z-p.z);
    bot.back.lookAt(camera.position.x-p.x,2.35,camera.position.z-p.z);
    bot.shootIn-=dt;
    const distance=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
    if(bot.shootIn<=0){
      bot.shootIn=.65+Math.random()*.7;
      if(player.alive&&distance<25&&botSeesPlayer(bot)){
        const from=p.clone().add(new THREE.Vector3(0,1.45,0));
        const end=player.pos.clone().add(new THREE.Vector3((Math.random()-.5)*.45,-.25,0));
        tracer(from,end,'#fca981');
        if(Math.random()<.36){
          player.health=Math.max(0,player.health-7);damageAlpha=.28;
          if(player.health===0){
            player.alive=false;player.respawn=1.5;player.deaths++;message('YOU WERE ELIMINATED',1.4);
          }
        }
      }
    }
  }
}
function updateHUD(dt){
  $('health').textContent=player.health;$('healthFill').style.width=player.health/player.maxHealth*100+'%';
  $('ammo').textContent=player.ammo;$('kills').textContent=player.kills;$('deaths').textContent=player.deaths;
  if(hitTimer>0){hitTimer-=dt;if(hitTimer<=0)$('hitmarker').classList.remove('show');}
  if(msgTimer>0){msgTimer-=dt;if(msgTimer<=0)$('message').classList.remove('show');}
  damageAlpha=Math.max(0,damageAlpha-dt*.85);$('damage').style.opacity=damageAlpha;
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];t.time-=dt;t.line.material.opacity=Math.max(0,t.time/.14);
    if(t.time<=0){scene.remove(t.line);t.line.geometry.dispose();t.line.material.dispose();tracers.splice(i,1);}
  }
}
function setupTouch(){
  const zone=$('moveZone'),base=$('stickBase'),knob=$('stickKnob');
  let moveId=null,lookId=null,lastX=0,lastY=0;
  function moveStick(e){
    const r=base.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
    const limit=44,scale=Math.min(1,limit/Math.max(1,Math.hypot(dx,dy)));
    const px=dx*scale,py=dy*scale;movement.x=px/limit;movement.y=-py/limit;
    knob.style.transform='translate(calc(-50% + '+px+'px),calc(-50% + '+py+'px))';
  }
  zone.addEventListener('pointerdown',e=>{
    if(!running||moveId!==null)return;moveId=e.pointerId;zone.setPointerCapture(e.pointerId);moveStick(e);
  });
  zone.addEventListener('pointermove',e=>{if(e.pointerId===moveId)moveStick(e);});
  function endMove(e){
    if(e.pointerId!==moveId)return;moveId=null;movement.x=0;movement.y=0;knob.style.transform='translate(-50%,-50%)';
  }
  zone.addEventListener('pointerup',endMove);zone.addEventListener('pointercancel',endMove);
  const look=$('lookZone');
  look.addEventListener('pointerdown',e=>{
    if(!running||lookId!==null)return;lookId=e.pointerId;lastX=e.clientX;lastY=e.clientY;look.setPointerCapture(e.pointerId);
  });
  look.addEventListener('pointermove',e=>{
    if(e.pointerId!==lookId)return;aim(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;
  });
  function endLook(e){if(e.pointerId===lookId)lookId=null;}
  look.addEventListener('pointerup',endLook);look.addEventListener('pointercancel',endLook);
  function bind(id,down,up=()=>{}){
    const button=$(id);
    button.addEventListener('pointerdown',e=>{
      if(!running)return;e.preventDefault();e.stopPropagation();
      button.setPointerCapture(e.pointerId);button.classList.add('pressed');down();
    });
    const end=e=>{e.preventDefault();button.classList.remove('pressed');up();};
    button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);
  }
  bind('fireBtn',()=>{firing=true;fire();},()=>firing=false);
  bind('jumpBtn',jump);bind('slideBtn',slide);bind('reloadBtn',reload);
}
setupTouch();
window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keys.add(e.code);if(e.repeat)return;
  if(e.code==='Space')jump();if(e.code==='KeyC')slide();if(e.code==='KeyR')reload();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();firing=false;movement.x=movement.y=0;});
renderer.domElement.addEventListener('pointerdown',e=>{
  if(!running||touch)return;
  if(document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock?.();
  else if(e.button===0){firing=true;fire();}
});
document.addEventListener('pointerup',()=>{if(!touch)firing=false;});
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement===renderer.domElement)aim(e.movementX,e.movementY);
});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement)firing=false;});
startBtn.addEventListener('click',()=>{
  running=true;menu.classList.add('hidden');if(!touch)renderer.domElement.requestPointerLock?.();
});
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
});
let last=performance.now(),frames=0,fpsTimer=0;
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min(.05,(now-last)/1000||.016);last=now;
  if(running){updatePlayer(dt);updateBots(dt);updateHUD(dt);}
  renderer.render(scene,camera);frames++;fpsTimer+=dt;
  if(fpsTimer>1){$('fps').textContent=Math.round(frames/fpsTimer)+' FPS';fpsTimer=0;frames=0;}
}
camera.position.copy(player.pos);camera.rotation.order='YXZ';
requestAnimationFrame(animate);
