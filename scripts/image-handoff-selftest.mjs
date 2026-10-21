import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=Array.from({length:9},(_,i)=>readFileSync(resolve(root,'parts',String(i).padStart(2,'0')+'.txt'),'utf8')).join('');
const js=source.match(/<script>\s*(\(\(\) => \{[\s\S]*?\}\)\(\);)\s*<\/script>/)?.[1];
assert.ok(js,'complete assembled script present');
assert.doesNotThrow(()=>new Function(js),'assembled JavaScript parses');
for(const phrase of ['referenceCutBtn','referenceCutKind','handoffExportBtn','sourceImageIncluded:false','captureType'])assert.ok(source.includes(phrase));
assert.ok(!/fetch\(['"]https?:/i.test(js),'no remote fetch for handoff');
const section=js.slice(js.indexOf('function zipU16('),js.indexOf("handoffBtn.addEventListener",js.indexOf('function zipU16(')));
const {buildZip,crc32Zip}=new Function(section+';return {buildZip,crc32Zip};')();
const encoder=new TextEncoder();
const files=[{name:'preview.png',bytes:new Uint8Array([0x89,0x50,0x4e,0x47])},
  {name:'layout.json',bytes:encoder.encode('{"cards":[]}')},
  {name:'parts/001.png',bytes:new Uint8Array([1,2,3,4,5,6])}];
const archive=new Uint8Array(await buildZip(files).arrayBuffer());
const dv=new DataView(archive.buffer);
let offset=0;
for(const f of files){
  assert.equal(dv.getUint32(offset,true),0x04034b50);
  assert.equal(dv.getUint16(offset+8,true),0,'no compression');
  assert.equal(dv.getUint32(offset+14,true),crc32Zip(f.bytes),'CRC32 correct');
  const filenameLength=dv.getUint16(offset+26,true);
  const contentLength=dv.getUint32(offset+18,true);
  assert.equal(new TextDecoder().decode(archive.slice(offset+30,offset+30+filenameLength)),f.name);
  assert.deepEqual(archive.slice(offset+30+filenameLength,offset+30+filenameLength+contentLength),f.bytes);
  offset+=30+filenameLength+contentLength;
}
for(const f of files){
  assert.equal(dv.getUint32(offset,true),0x02014b50,'central directory header');
  offset+=46+dv.getUint16(offset+28,true);
}
assert.equal(dv.getUint32(offset,true),0x06054b50,'end of ZIP');
assert.equal(dv.getUint16(offset+10,true),files.length,'ZIP file count');
console.log('image-handoff ZIP + source checks passed');
