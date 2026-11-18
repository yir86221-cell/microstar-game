// Build-time assets only. The installed app loads these files locally, never a CDN.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'parent-app/apps/parent/public/cutout');
const model = path.join(destination, 'magic-touch.task');
const url = 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/latest/interactive_segmentation.task';
const sha256 = '38431bc66b883404e8397f74c3579404315b9b52b04a46c6346fe906a7309b03';
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
async function main() {
  fs.mkdirSync(destination, {recursive:true});
  if (!fs.existsSync(model) || digest(fs.readFileSync(model)) !== sha256) {
    const response = await fetch(url, {signal:AbortSignal.timeout(120000)});
    if (!response.ok) throw Error(`Model download HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (digest(data) !== sha256) throw Error('Cutout model hash mismatch; review the model version before updating.');
    fs.writeFileSync(model, data);
  }
  fs.cpSync(path.join(root,'parent-app/node_modules/@mediapipe/tasks-vision/wasm'),path.join(destination,'wasm'),{recursive:true});
  fs.copyFileSync(path.join(root,'docs/third-party-cutout.txt'),path.join(destination,'NOTICE.txt'));
  fs.copyFileSync(path.join(root,'docs/Apache-2.0-cutout.txt'),path.join(destination,'LICENSE.txt'));
  console.log('Offline cutout model verified and runtime copied.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
