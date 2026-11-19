// The approved holographic yarn rebuilt as 3D strands, projected through a camera.
// Geometry is illustrative: connections are not claims about application data flow.
const canvas=$('#orb'),ctx=canvas.getContext('2d'),mq=matchMedia('(prefers-reduced-motion: reduce)');
let paused=mq.matches,time=0,last=0,yaw=0,pitch=0,drag=null;
const fibers=[];
function orient(p,a,b){const [x,y,z]=p;const xx=x*Math.cos(a)+z*Math.sin(a),zz=-x*Math.sin(a)+z*Math.cos(a);return [xx,y*Math.cos(b)-zz*Math.sin(b),y*Math.sin(b)+zz*Math.cos(b)];}
for(let k=0;k<150;k++){
 const points=[],angle=k*2.39996,tilt=.23+.74*((k*43%97)/97);
 for(let j=0;j<=100;j++){
  const u=j/100*Math.PI*2,r=.94+.025*Math.sin(u*5+k)+.015*Math.sin(u*11+k*2);
  const x=Math.cos(u)*r,y=Math.sin(u)*r*tilt,z=Math.sin(u)*r*Math.sqrt(1-tilt*tilt);
  points.push([x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),z]);
 }
 fibers.push(points);
}
for(let layer=0;layer<3;layer++)for(let k=0;k<17;k++){
 const points=[],r=.36+layer*.19;
 for(let j=0;j<=70;j++){const u=j/70*Math.PI*2;points.push(orient([Math.cos(u)*r,Math.sin(u)*r,0],k*2.39996,layer*.8+k*.37));}
 fibers.push(points);
}
function motionLabel(){$('#motion').textContent=paused?'Resume motion':'Pause motion';$('#motion').setAttribute('aria-pressed',String(paused));}
motionLabel();$('#motion').onclick=()=>{paused=!paused;motionLabel()};mq.addEventListener('change',()=>{paused=mq.matches;motionLabel()});
function rotate(dx,dy=0){yaw+=dx;pitch=Math.max(-1.3,Math.min(1.3,pitch+dy));paused=true;motionLabel();}
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);canvas.focus();paused=true;motionLabel();});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;rotate((e.clientX-drag.x)*.008,(e.clientY-drag.y)*.008);drag.x=e.clientX;drag.y=e.clientY;});
function release(){drag=null;}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
canvas.addEventListener('keydown',e=>{const delta={ArrowLeft:[-.22,0],ArrowRight:[.22,0],ArrowUp:[0,-.18],ArrowDown:[0,.18]}[e.key];if(delta){e.preventDefault();rotate(...delta);}if(e.key==='Home'){e.preventDefault();yaw=pitch=0;}});
$('#turnLeft').onclick=()=>rotate(-.4);$('#turnRight').onclick=()=>rotate(.4);$('#resetRotation').onclick=()=>{yaw=pitch=0;paused=true;motionLabel()};
function anchor(i,n){const y=.78-1.56*(i+.5)/Math.max(n,1),a=i*2.39996,r=Math.sqrt(1-y*y)*.91;return [Math.sin(a)*r,y,Math.cos(a)*r];}
window.addEventListener('yarn-select',()=>{
 const index=appFeatures.findIndex(f=>f.id===selectedFeature);if(index<0)return;
 const [x,y,z]=anchor(index,appFeatures.length);yaw=-Math.atan2(x,z);pitch=Math.atan2(y,Math.hypot(x,z));paused=true;motionLabel();
});
function draw(now){
 if(document.hidden){last=now;requestAnimationFrame(draw);return;}
 if(!paused&&!drag){const step=Math.min(now-last,40);time+=step*.00008;yaw+=step*.000025;}last=now;
 const w=canvas.clientWidth,h=canvas.clientHeight,d=Math.min(devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);}
 ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
 const cx=w*.5,cy=h*.48,r=Math.min(w*.43,h*.43);
 function project(v){const q=orient(v,yaw,pitch),scale=3.5/(3.5-q[2]);return {x:cx+q[0]*r*scale,y:cy+q[1]*r*scale,z:q[2],scale};}
 const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,r*1.2);glow.addColorStop(0,'#109cad1b');glow.addColorStop(.8,'#20bbd018');glow.addColorStop(1,'#00000000');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 const strands=fibers.map((points,k)=>{const projected=points.map(project);return {points:projected,z:projected.reduce((a,p)=>a+p.z,0)/projected.length,k};}).sort((a,b)=>a.z-b.z);
 for(const strand of strands){ctx.beginPath();strand.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=strand.k%7===0?'#4bdce650':'#21748e2c';ctx.lineWidth=strand.k%7===0?.75:.45;ctx.stroke();}
 const features=appFeatures,knots=features.map((f,i)=>({f,v:anchor(i,features.length),p:project(anchor(i,features.length)),s:YarnEvidence.summary(visibleChecks().filter(c=>YarnEvidence.feature(c).id===f.id))}));
 // Fine silk bundles connect feature junctions in three dimensions.
 knots.forEach((a,i)=>{
  const b=knots[(i+1)%knots.length];if(!b||b===a)return;
  const orange=a.s.status==='review'||b.s.status==='review';
  for(let fiber=0;fiber<26;fiber++){
   ctx.beginPath();for(let j=0;j<=48;j++){
    const t=j/48,arch=Math.sin(Math.PI*t),spread=(fiber-12.5)/12.5*.055*arch;
    const v=a.v.map((value,axis)=>value*(1-t)+b.v[axis]*t+arch*.18*Math.sin(i+axis*2)+spread*Math.cos(axis*2+i));
    const p=project(v);j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);
   }
   ctx.strokeStyle=orange?(fiber%5===0?'#ffc2789a':'#d58b3d50'):(fiber%8===0?'#a2f9ff72':'#3bb8ce26');ctx.lineWidth=fiber%8===0?.7:.32;ctx.stroke();
  }
 });
 knots.sort((a,b)=>a.p.z-b.p.z).forEach(({f,p,s},k)=>{
  const orange=s.status==='review';ctx.save();ctx.translate(p.x,p.y);ctx.rotate(k*.9);ctx.globalAlpha=.5+(p.z+1)*.22;
  for(let n=0;n<11;n++){ctx.beginPath();ctx.ellipse((n-5)*.8,Math.sin(n)*2,3+n*.35,9+n*.35,n*.12,0,Math.PI*2);ctx.strokeStyle=orange?'#ffbb6eaa':n%3===0?'#bbffffd0':'#57e8ed95';ctx.lineWidth=n%3===0?.85:.5;ctx.stroke();}
  ctx.shadowBlur=19;ctx.shadowColor=orange?'#ff9e36':'#3bdde8';ctx.fillStyle=orange?'#ffe0af':'#a2ffff';ctx.beginPath();ctx.arc(0,0,orange?3:1.4,0,Math.PI*2);ctx.fill();ctx.restore();
  const node=[...document.querySelectorAll('.sphere .node')].find(n=>n.dataset.feature===f.id);
  if(node){const nw=node.offsetWidth,nh=node.offsetHeight;node.style.left=Math.max(nw/2+3,Math.min(w-nw/2-3,p.x))+'px';node.style.top=Math.max(nh/2+4,Math.min(h-nh/2-28,p.y))+'px';node.style.opacity=f.id===selectedFeature?'1':p.z<-.15?'.6':'1';node.style.zIndex=String(Math.round((p.z+1)*10)+2);node.dataset.depth=p.z.toFixed(3);}
 });
 // Move overlapping labels apart while keeping a visible tether to their 3D knot.
 const placed=[];
 [...document.querySelectorAll('.sphere .node')].sort((a,b)=>Number(b.dataset.depth)-Number(a.dataset.depth)).forEach(node=>{
  let x=parseFloat(node.style.left),y=parseFloat(node.style.top),nw=node.offsetWidth,nh=node.offsetHeight;
  const start={x,y};
  for(let n=0;n<12;n++){const collision=placed.find(p=>Math.abs(x-p.x)<(nw+p.w)/2+5&&Math.abs(y-p.y)<(nh+p.h)/2+5);if(!collision)break;y+=y<cy?-nh-6:nh+6;y=Math.max(nh/2+3,Math.min(h-nh/2-30,y));}
  node.style.top=y+'px';placed.push({x,y,w:nw,h:nh});
  if(Math.abs(y-start.y)>4){ctx.strokeStyle='#5de8ec55';ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(x,y);ctx.stroke();}
 });
 for(let k=0;k<60;k++){const p=project(anchor(k,60));ctx.globalAlpha=.15+.4*(.5+.5*Math.sin(time*5+k));ctx.fillStyle='#a0ffff';ctx.beginPath();ctx.arc(p.x,p.y,k%9===0?1.3:.55,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 ctx.save();ctx.translate(cx,cy+r*1.04);ctx.scale(1,.10);const ground=ctx.createRadialGradient(0,0,0,0,0,r*.9);ground.addColorStop(0,'#41d7e548');ground.addColorStop(1,'#22c7dd00');ctx.fillStyle=ground;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore();
 canvas.dataset.rotation=yaw.toFixed(3)+','+pitch.toFixed(3);requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
