// Exercise the glossary's user interactions without a browser dependency.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(tag='div') { this.tagName=tag; this.children=[]; this.dataset={}; this.value=''; this.listeners={}; this.scrollTop=0; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children=[...nodes]; }
  setAttribute(key,value) { this[key]=value; }
  addEventListener(key,fn) { this.listeners[key]=fn; }
  showModal() { this.open=true; }
  close() { this.open=false; this.listeners.close?.(); }
  focus() { this.focused=true; }
  getBoundingClientRect() { return {top:0}; }
}
const ids = new Map();
const get = id => { if (!ids.has(id)) ids.set(id,new Element()); return ids.get(id); };
let fetches=0;
const rows = JSON.parse(fs.readFileSync(__dirname+'/static/dictionary.json','utf8'));
vm.runInNewContext(fs.readFileSync(__dirname+'/static/dictionary.js','utf8'), {
  document:{getElementById:get,createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),querySelectorAll:()=>[]},
  fetch:async()=>{ fetches++; return {ok:true,json:async()=>structuredClone(rows)}; }
});
const terms = () => get('dictionaryResults').children.filter(n=>n.tagName==='article').map(n=>n.children[0].textContent);
function query(value) { get('dictionarySearch').value=value; get('dictionarySearch').listeners.input(); }
(async()=>{
  get('dictionaryTab').onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(get('dictionaryDialog').open,true);
  assert.equal(terms().length,93);
  assert.deepEqual(terms(),[...terms()].sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'})));
  query('command window'); assert.ok(terms().includes('Console')); assert.ok(terms().includes('Terminal'));
  query('127.0.0.1'); assert.ok(terms().includes('Localhost'));
  query('aPi KeY'); assert.ok(terms().includes('API key'));
  query('a-word-no-one-added-xyz'); assert.equal(terms().length,0); assert.match(get('dictionaryResults').children[0].textContent,/No matching word/);
  get('dictionaryClear').onclick(); assert.equal(terms().length,93); assert.equal(get('dictionarySearch').value,'');
  assert.equal(get('dictionaryLetters').children.length,26);
  assert.ok(get('dictionaryLetters').children.find(n=>n.textContent==='X').disabled);
  get('dictionaryClose').onclick(); assert.equal(get('dictionaryDialog').open,false); assert.ok(get('dictionaryTab').focused);
  get('dictionaryTab').onclick(); await new Promise(resolve=>setImmediate(resolve)); assert.equal(fetches,1);
  console.log('Passed: 93 A–Z entries, aliases, punctuation, case-insensitive search, empty results, clear, letter shortcuts, focus return and offline reuse.');
})().catch(error=>{console.error(error);process.exitCode=1;});
