// 単体HTML（Google Sites貼り付け用）を生成する。
// 使い方: node stealth/build-embed.mjs  (要: stealth/vendor/three.module.min.js)
// 方針: 外部依存はFirebase(オンライン時のみ・別途)だけに寄せ、Three.jsと自作コードは全てインライン化する。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const threePath = join(root, 'vendor', 'three.module.min.js');
const threeCorePath = join(root, 'vendor', 'three.core.min.js');
for (const p of [threePath, threeCorePath]) if (!existsSync(p)) { console.error(p + ' がありません。jsDelivr から three@0.180.0 の build を取得してください'); process.exit(1); }
const html = readFileSync(join(root, 'index.html'), 'utf8');
const core = readFileSync(join(root, 'src', 'core.mjs'), 'utf8');
const net = readFileSync(join(root, 'src', 'net.js'), 'utf8');
let main = readFileSync(join(root, 'src', 'main.js'), 'utf8');
const three = readFileSync(threePath, 'utf8');
const threeCore = readFileSync(threeCorePath, 'utf8');
for (const [name, src] of [['three', three], ['threeCore', threeCore], ['core', core], ['net', net], ['main', main]]) if (src.includes('</script>')) { console.error(`${name} に </script> が含まれインライン化できません`); process.exit(1); }
if (!three.includes('"./three.core.min.js"')) { console.error('three.module.min.js の core 参照形式が想定と違います'); process.exit(1); }
main = main.replace("from './net.js'", "from 'net-inline'");
main = main.replace("from './core.mjs'", "from 'core-inline'");
const bootstrap = `<script type="module">
const blobUrl = text => URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
const text = id => document.getElementById(id).textContent;
const threeCoreUrl = blobUrl(text('src-three-core'));
const threeUrl = blobUrl(text('src-three').replaceAll('"./three.core.min.js"', '"' + threeCoreUrl + '"'));
const coreUrl = blobUrl(text('src-core'));
const netUrl = blobUrl(text('src-net'));
let mainSrc = text('src-main');
mainSrc = mainSrc.replace("from 'three'", "from '" + threeUrl + "'").replace("from 'core-inline'", "from '" + coreUrl + "'").replace("from 'net-inline'", "from '" + netUrl + "'");
await import(blobUrl(mainSrc));
</script>`;
let out = html
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/, '');
// 置換文字列内の $& 等が特殊展開される事故を避けるため、挿入は必ず関数で返す
const insertion = `<script type="text/plain" id="src-three-core">${threeCore}</script>\n<script type="text/plain" id="src-three">${three}</script>\n<script type="text/plain" id="src-core">${core}</script>\n<script type="text/plain" id="src-net">${net}</script>\n<script type="text/plain" id="src-main">${main}</script>\n${bootstrap}\n</body>`;
out = out.replace('</body>', () => insertion);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'stealth-embed.html'), out);
console.log('wrote stealth/dist/stealth-embed.html', (out.length / 1024).toFixed(0) + 'KB');
