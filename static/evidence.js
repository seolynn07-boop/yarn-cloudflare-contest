// Evidence-first view model. Labels inferred from paths are navigation hints, not proof.
(function(scope) {
const defaults={Dependencies:'Code you rely on',Configuration:'App protections',Authentication:'Accounts & sign-in',API:'App actions',Database:'Saved information',Secrets:'Connected services'};
const groups=[['chats','Chats',/(chat|message|conversation)/i],['teams','Teams',/team/i],['payments','Payments',/(payment|billing|checkout|stripe|purchase)/i],['uploads','Files & uploads',/(upload|attachment|storage|download)/i],['accounts','Accounts & sign-in',/(auth|login|session|profile|account|user)/i],['admin','Admin tools',/(admin|moderation)/i]];
function feature(c) {
 if(c.kind==='permission-receipt' && c.featureId) {
   const group=groups.find(g=>g[0]===c.featureId);
   return {id:c.featureId,name:group?.[1]||'Other app parts',inferred:false};
 }
 if(c.category==='Authentication'&&!groups.some(g=>g[2].test(c.source||'')))return {id:'accounts',name:'Accounts & sign-in',inferred:false};
 if(c.category==='Dependencies'||c.category==='Configuration')return {id:c.category,name:defaults[c.category],inferred:false};
 const match=groups.find(g=>g[2].test(c.source||''));
 return match?{id:match[0],name:match[1],inferred:true}:{id:c.category||'other',name:defaults[c.category]||'Other app parts',inferred:false};
}
function features(checks) {
 const found=new Map();
 checks.forEach(c=>{const f=feature(c);if(!found.has(f.id))found.set(f.id,{...f,checks:[]});found.get(f.id).checks.push(c)});
 return [...found.values()];
}
function strength(c) {
 if(c.kind==='permission-receipt')return {label:'Reported by your test suite',uncertainty:'YARN read a saved result. Check its test date for freshness.'};
 if(c.freshness)return {label:'Earlier evidence',uncertainty:'This has not been verified against the current version.'};
 if(c.method==='advisory-match')return {label:c.status==='not-checked'?'Advisory coverage gap':'Published advisory lookup',uncertainty:c.uncertainty||'Only eligible package versions were matched. Exploitability and deployed versions are not established.'};
 if(c.method==='secret-pattern')return {label:c.status==='not-checked'?'Secret coverage gap':'Local credential pattern',uncertainty:c.uncertainty||'Pattern matching only. Other formats and excluded files can contain secrets. No credential was validated.'};
 if(c.kind==='test'&&c.status!=='not-checked')return {label:'Tested behavior',uncertainty:'Only the listed action, accounts and test environment were tested.'};
 if(c.kind==='report')return {label:'Tool-reported concern',uncertainty:'YARN has not independently reproduced this finding. Check the original report.'};
 if(c.kind==='discovery'||c.status==='not-checked')return {label:'Not established',uncertainty:'Finding relevant code does not tell us whether the behavior is secure.'};
 return {label:'Local rule result',uncertainty:'This checks a specific file or setting, not whether someone can exploit the app.'};
}
function summary(checks) {
 const fresh=checks.filter(c=>!c.freshness);
 const concerns=checks.filter(c=>c.status==='review');
 const tested=fresh.filter(c=>c.kind==='test'&&c.status==='checked');
 const passed=fresh.filter(c=>c.status==='checked');
 const unknown=checks.filter(c=>c.status==='not-checked'||c.freshness);
 const result=fresh.find(c=>c.status==='review') || tested[0] || passed[0] || fresh.find(c=>c.kind!=='discovery') || fresh[0];
 const words=describe(result);
 if(tested.length && !fresh.some(c=>c.status==='review') && tested.every(c=>feature(c).id==='chats')){
   words.label=tested.length===1?'1 chat action blocked':tested.length+' chat actions blocked';
   words.evidence=tested.length===9?'Nine attempts to read, send, list or create chats without permission were blocked in a local copy.':tested[0].impact||'The local test blocked the forbidden chat action.';
   words.gaps='Deletion, blocks and behavior in the live app still need testing.';
 }
 return {concerns,tested,passed,unknown,status:concerns.length?'review':passed.length?'checked':'not-checked',...words};
}
function describe(c) {
 const words=(label,evidence,gaps)=>({label,evidence,gaps});
 if(!c)return words('No current result','There is no current result for this view.','This view has no evidence about how the feature behaves.');
 if(c.kind==='discovery')return words('Code found · untested','YARN found related code.','How this feature behaves for real users still needs testing.');
 if(c.kind==='permission-receipt')return words(({checked:'Suite reports blocked',review:'Suite reports allowed'})[c.status]||'Test inconclusive',c.title+' '+c.impact,'Changes since your test and other actions still need testing.');
 if(c.kind==='test')return words(({checked:'Test action blocked',review:'Forbidden action allowed'})[c.status]||'Test inconclusive',c.title+' '+(c.impact||''),'Other actions and the live app still need testing.');
 if(c.method==='secret-pattern' && c.status==='review')return words('Possible secret found','YARN found text that looks like a secret in a file.','Whether anyone can use it is unknown.');
 if(c.method==='secret-pattern' && c.status==='checked')return words('No secret pattern matched','The scanned files had no matches for the secret patterns YARN checked.','Hidden files, file history and unfamiliar key formats may still contain secrets.');
 if(c.method==='advisory-match' && c.status==='review')return words('Package advisory matched',(c.package||'A package')+' '+(c.version||'')+' matched a published vulnerability notice.','Whether the affected code runs in your app is unknown.');
 if(c.kind==='report')return words(c.status==='review'?'Tool reported a concern':'Report inconclusive',c.title,'The reported behavior still needs independent verification.');
 const known={
 'lock-presence':['Version file found','Version file missing','Whether deployed packages match this copy is unknown.'],
 'lock-http':['No plain HTTP found','Plain HTTP link found','Only recorded download addresses were examined.'],
 'dependency-policy':['Package rules checked','Loose package version','The installed versions still need checking.'],
 'typescript-strict':['Strict checks enabled','Strict checks need review','The deployed build settings still need checking.']};
 if(known[c.rule] && c.status!=='not-checked'){
   const [pass,review,gap]=known[c.rule];
   const observation=c.rule==='lock-presence'
     ? (c.status==='review'?'One inspected folder had no recognized file recording its package versions.':'YARN found a file recording package versions in the inspected folder.')
     : c.evidence;
   return words(c.status==='review'?review:pass,observation,gap);
 }
 if(c.rule==='typescript-strict' && c.evidence?.includes('No tsconfig.json'))return words('Settings file missing','YARN could not find the settings file for TypeScript checks in the inspected folder.','Whether the built app uses strict checks is unknown.');
 return words(c.status==='not-checked'?'No verified result':c.title||'Local result',c.evidence||c.title||'No observation recorded.',c.uncertainty||c.action||'Behavior beyond this check is unknown.');
}
function risk(checks) {
 const c=checks.find(c=>c.status==='review');
 if(!c)return 'No problem established by these checks. That does not mean this part is safe.';
 if(c.impact)return c.impact;
 return ({'dependency-policy':'Package contents could change unexpectedly between installs. This is a warning, not a proven breach.','lock-presence':'Different installs could use different package versions.','lock-http':'An unencrypted package download could be intercepted.','typescript-strict':'Some coding mistakes may be harder to catch. This does not prove a security flaw.'})[c.rule]||'A check found something that needs review. Its effect on users is not yet established.';
}
function overlaps(checks) {
 const map=new Map();
 checks.filter(c=>c.source&&c.rule&&c.kind!=='discovery').forEach(c=>{const key=[c.source,c.line||'',c.rule].join('|');if(!map.has(key))map.set(key,[]);map.get(key).push(c)});
 return [...map.values()].filter(rows=>new Set(rows.map(c=>c.provider||'YARN local checks')).size>1).map(rows=>({
  conflicting:new Set(rows.map(c=>c.status)).size>1,
  message:new Set(rows.map(c=>c.status)).size>1?'Sources differ on this recorded location. Neither result cancels the other; verify the original evidence.':'More than one source mentions the same rule and location. This is not independent confirmation.'}));
}
const api={feature,features,strength,describe,summary,risk,overlaps};
if(typeof module!=='undefined')module.exports=api;else scope.YarnEvidence=api;
})(globalThis);
