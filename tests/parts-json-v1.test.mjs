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
console.log('parts-json-v1 source checks passed');
