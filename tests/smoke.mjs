import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
for(const match of js.matchAll(/\$\('([a-zA-Z0-9]+)'\)/g)){
  assert.ok(html.includes('id="'+match[1]+'"'),'missing HTML element: '+match[1]);
}
for(const id of ['game','moveZone','lookZone','fireBtn','jumpBtn','slideBtn','reloadBtn']){
  assert.ok(html.includes('id="'+id+'"'),'missing control: '+id);
}
assert.match(js,/three@0\.180\.0/);
assert.match(js,/raycaster\.intersectObjects/);
assert.match(js,/player\.health/);
assert.match(js,/resetTouchControls/);
assert.match(js,/fireButton.addEventListener\('pointermove'/);
assert.match(js,/pointerlockchange/);
assert.match(js,/cameraRelativeMove/);
assert.ok(html.includes('ドラッグ照準'));
assert.match(css,/#touchControls/);
console.log('Static FPS smoke checks passed');
