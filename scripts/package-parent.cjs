const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'parent-app/apps/parent/dist');
if(!fs.existsSync(path.join(source,'index.html')))throw Error('Build parent app first');
fs.cpSync(source,path.join(root,'dist/parent'),{recursive:true});
console.log('Parent app packaged into dist/parent');
