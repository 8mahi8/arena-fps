// Coordinates in the horizontal plane relative to the camera yaw.
// +y input moves forward (camera -Z), +x input strafes right.
export function cameraRelativeMove(x,y,yaw){
  if(![x,y,yaw].every(Number.isFinite))throw new RangeError('invalid movement axes');
  const scale=1/Math.max(1,Math.hypot(x,y));
  const right=x*scale,forward=y*scale;
  return {
    x: Math.cos(yaw)*right-Math.sin(yaw)*forward,
    z: -Math.sin(yaw)*right-Math.cos(yaw)*forward
  };
}
