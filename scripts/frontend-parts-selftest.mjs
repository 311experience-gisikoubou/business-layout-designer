// Deterministic source-level checks for parts-json-v1. Run: node tests/parts-json-v1.test.mjs
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const src=Array.from({length:9},(_,i)=>readFileSync(new URL(`../parts/${String(i).padStart(2,'0')}.txt`,import.meta.url),'utf8')).join('');
const has=(s,m)=>assert.ok(src.includes(s),m||`missing: ${s}`);
// card export fields
['cardId:c.id','cardType:c.componentKey','width:c.w','height:c.h','zIndex:i+1','assets:clone(usedAssets())'].forEach(s=>has(s));
// part fields
['partId','partType','imageRef','fontSize','fontWeight','alignment'].forEach(s=>has(s));
['image','heading','text','input','button','checkbox'].forEach(t=>has(`'${t}'`));
// legacy compatibility
has('src.id=src.cardId');has('src.w=src.width');has('src.componentKey=src.cardType');has('normalizeParts(src.parts,card)');
// local-only image replacement
has('FileReader');has("addEventListener('drop'");has('replacePartImage');
assert.ok(!/fetch\(['"`]https?:/.test(src),'no external fetch');
assert.ok(!/XMLHttpRequest|WebSocket|openai/i.test(src),'no network/AI');
// undo coverage and unique ids on duplicate
has('pushHistory();assets[assetId]');has('p.partId=uid()');
// return to card selection
has('partBackBtn');has('backToCard');
// heading/text are true editable parts: geometry is never overwritten
const sync=src.match(/function syncBaseParts\(c\)\{[^\n]*\}/)?.[0]||'';
assert.ok(sync.includes('h.text=c.title')&&sync.includes('t.text=c.body'),'sync keeps title/body text in sync');
assert.ok(!/\.(x|y|width|height)\s*=/.test(sync),'syncBaseParts must not overwrite heading/text geometry');
has('function syncCardFromPart');has('syncBaseParts(c);selectedIds');
// heading/text are rendered and dragged as free parts (not excluded)
assert.ok(!src.includes("if(p.partType==='heading'||p.partType==='text')return;const n="),'heading/text must not be excluded from free part layer');
assert.ok(!src.includes('function decorateBase'),'legacy non-movable base part decoration removed');
const layer=src.match(/function partsLayerNode\(c\)\{[\s\S]*?return layer\}/)?.[0]||'';
assert.ok(layer.includes('startPartGesture(e,c,p,n,isResize)')&&layer.includes('part-resize')&&layer.includes('left:${p.x}px'),'free part drag/resize/geometry render');
has('.part-heading');has('.part-text');
// defect 1: imported parts[] are authoritative over stale legacy title/body (functional)
const fn=n=>{const m=src.match(new RegExp(`^ *(?:function ${n}\\(|(?:const|let|var) ${n}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>).*$`,'m'));assert.ok(m,`missing function or arrow declaration ${n}`);return m[0]};
const partTypes=src.match(/^ *const PART_TYPES=.*$/m)[0];
const build=new Function('uid',`${partTypes}\n${['normalizeRules','safeCardBase','isRefCard','partBase','defaultParts','normalizeParts','syncBaseParts','syncCardFromPart','safeCard'].map(fn).join('\n')}\nreturn safeCard;`);
let n=0;const safeCard=build(()=>'id'+(++n));
const imp=safeCard({id:'a',componentKey:'generic',title:'STALE',body:'STALE BODY',x:0,y:0,w:400,h:300,parts:[
  {partId:'h1',partType:'heading',x:5,y:6,width:200,height:30,text:'New Heading'},
  {partId:'t1',partType:'text',x:7,y:60,width:300,height:100,text:'New Body'}]});
assert.equal(imp.parts.find(p=>p.partType==='heading').text,'New Heading');
assert.equal(imp.parts.find(p=>p.partType==='text').text,'New Body');
assert.equal(imp.title,'New Heading');assert.equal(imp.body,'New Body');
const hp=imp.parts.find(p=>p.partType==='heading');
assert.deepEqual([hp.x,hp.y,hp.width,hp.height],[5,6,200,30],'imported geometry kept');
const legacy=safeCard({id:'b',title:'Legacy T',body:'Legacy B',w:400,h:300});
assert.equal(legacy.parts.find(p=>p.partType==='heading').text,'Legacy T');
assert.equal(legacy.parts.find(p=>p.partType==='text').text,'Legacy B');
// defect 2: card mode -> part mode interaction model
const pd=src.match(/n\.addEventListener\('pointerdown',e=>\{[^\n]*startPartGesture[^\n]*\}\);/)?.[0]||'';
assert.ok(pd.includes('selectedPart.cardId!==c.id)return;e.stopPropagation()'),'part pointerdown delegates to card drag unless part mode is active');
const cardPd=src.match(/el\.addEventListener\('pointerdown',[^\n]*\);return el\}/)?.[0]||'';
assert.ok(cardPd.includes('.part-free')&&!/closest\('\.mini,\.resize-handle,\.part-free'\)/.test(cardPd),'card handler receives free-part pointerdown');
assert.ok(cardPd.includes('toggleOnClick:wasSelected&&!additive')&&cardPd.includes('basePartId:baseEl?.dataset.partId'),'click on selected card part enters part mode');
has('selectPart(c.id,basePartId)');
// defect 3: duplicateSelected keeps copied card title AND copied heading-part text (functional)
const buildDup=new Function('uid','clone','selectedCards','pushHistory','clampCardToGuide','markDirty','render',`${partTypes}\n${['normalizeRules','safeCardBase','isRefCard','partBase','defaultParts','normalizeParts','syncBaseParts','syncCardFromPart','safeCard','duplicateSelected'].map(fn).join('\n')}\nlet cards=[],selectedIds=new Set(),primaryId=null;\nreturn {run(){cards=[];duplicateSelected();return {cards,selectedIds,primaryId}},safeCard};`);
let dn=0;const dupUid=()=>'d'+(++dn);
let dupSel=[];
const dupEnv=buildDup(dupUid,o=>JSON.parse(JSON.stringify(o)),()=>dupSel,()=>{},()=>{},()=>{},()=>{});
const dupOrig=dupEnv.safeCard({id:'o',componentKey:'generic',title:'Orig',body:'Body',x:10,y:10,w:400,h:300});
dupSel=[dupOrig];
const dupRes=dupEnv.run();
assert.equal(dupRes.cards.length,1,'duplicateSelected creates one copy');
const dupCard=dupRes.cards[0];
assert.notEqual(dupCard.id,'o');
assert.equal(dupCard.title,'Orig コピー','duplicated card title is preserved as "<original> コピー"');
assert.equal(dupCard.parts.find(p=>p.partType==='heading').text,'Orig コピー','duplicated heading part text matches copied card title');
assert.equal(dupOrig.title,'Orig','original card title untouched');
console.log('parts-json-v1 source checks passed');
