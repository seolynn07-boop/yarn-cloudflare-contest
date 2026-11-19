const assert=require('node:assert/strict');
const E=require('./static/evidence.js');
const sample=[{category:'API',source:'backend/routes/chats.js',kind:'discovery',status:'not-checked'},
{category:'API',source:'backend/routes/chats.js',rule:'private-chat-read',kind:'test',status:'checked'},
{category:'Dependencies',kind:'check',status:'review',rule:'lock-http'}];
assert.equal(E.feature(sample[0]).name,'Chats');
assert.equal(E.summary(sample.slice(0,2)).label,'1 chat action blocked');
assert.equal(E.summary(sample.slice(0,2)).unknown.length,1);
assert.equal(E.strength(sample[1]).label,'Tested behavior');
assert.equal(E.strength({...sample[1],freshness:'old'}).label,'Earlier evidence');
assert.equal(E.summary([{...sample[1],freshness:'old'}]).status,'not-checked');
assert.equal(E.strength({kind:'report',status:'review'}).label,'Tool-reported concern');
assert.match(E.risk([sample[2]]),/intercepted/);
assert.match(E.risk([]),/does not mean/);
const a={source:'chat.js',rule:'CWE-639',line:12,kind:'report',status:'review',provider:'A'};
assert.equal(E.overlaps([a,{...a,provider:'B',status:'checked'}])[0].conflicting,true);
assert.equal(E.overlaps([a,{...a,provider:'B',line:13}]).length,0);
assert.equal(E.overlaps([a,{...a}]).length,0);
assert.equal(E.features(sample).length,2);
console.log('Passed: feature grouping, mixed coverage, evidence strength, stale evidence, risk and source disagreements.');
