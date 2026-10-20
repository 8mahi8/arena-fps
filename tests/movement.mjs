import assert from 'node:assert/strict';
import {cameraRelativeMove} from '../src/movement.mjs';
const near=(actual,expected,msg)=>assert.ok(Math.abs(actual-expected)<1e-9,`${msg}: got ${actual}, expected ${expected}`);
for(const [x,y,yaw,expectedX,expectedZ,name] of [
  [0,1,0,0,-1,'forward center'],
  [1,0,0,1,0,'right center'],
  [0,1,Math.PI/2,-1,0,'forward when facing left'],
  [1,0,Math.PI/2,0,-1,'right when facing left'],
  [0,1,-Math.PI/2,1,0,'forward when facing right'],
  [0,-1,Math.PI/2,1,0,'backward when facing left']
]){
  const value=cameraRelativeMove(x,y,yaw);
  near(value.x,expectedX,name+' x');
  near(value.z,expectedZ,name+' z');
}
const diagonal=cameraRelativeMove(1,1,0);
near(Math.hypot(diagonal.x,diagonal.z),1,'diagonal normalization');
const idle=cameraRelativeMove(0,0,2);
near(idle.x,0,'idle x');near(idle.z,0,'idle z');
console.log('Camera-relative movement checks passed');
