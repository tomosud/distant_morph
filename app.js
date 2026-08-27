(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const els = {input:$('#fileInput'),drop:$('#dropzone'),list:$('#fileList'),between:$('#inbetweens'),precision:$('#precision'),easing:$('#easing'),outputResolution:$('#outputResolution'),prefix:$('#prefix'),threshold:$('#blackThreshold'),tolerance:$('#colorTolerance'),thresholdOut:$('#thresholdOut'),toleranceOut:$('#toleranceOut'),formula:$('#frameFormula'),canvas:$('#previewCanvas'),empty:$('#emptyPreview'),status:$('#statusText'),generate:$('#generateBtn'),download:$('#downloadBtn'),play:$('#playBtn'),timeline:$('#timeline'),count:$('#frameCount'),progress:$('#progress')};
  const state = {sources:[],frames:[],timer:null,zip:null};
  const ctx = els.canvas.getContext('2d',{alpha:false});

  els.input.addEventListener('change',e=>loadFiles([...e.target.files]));
  ['dragenter','dragover'].forEach(n=>els.drop.addEventListener(n,e=>{e.preventDefault();els.drop.classList.add('drag')}));
  ['dragleave','drop'].forEach(n=>els.drop.addEventListener(n,e=>{e.preventDefault();els.drop.classList.remove('drag')}));
  els.drop.addEventListener('drop',e=>loadFiles([...e.dataTransfer.files]));
  [els.between,els.precision,els.easing,els.threshold,els.tolerance].forEach(x=>x.addEventListener('input',()=>{updateFormula();invalidate()}));
  els.threshold.addEventListener('input',()=>els.thresholdOut.value=els.threshold.value);
  els.tolerance.addEventListener('input',()=>els.toleranceOut.value=els.tolerance.value);
  els.generate.addEventListener('click',generate);
  els.download.addEventListener('click',downloadZip);
  els.timeline.addEventListener('input',()=>showFrame(+els.timeline.value));
  els.play.addEventListener('click',togglePlay);

  async function loadFiles(files){
    const supported=files.filter(f=>/\.(png|psd|jpe?g|webp)$/i.test(f.name));
    if(!supported.length)return setStatus('対応画像がありません');
    setBusy(true,'画像を読み込み中…');
    const loaded=[];
    for(const file of supported){try{loaded.push(await decodeFile(file))}catch(err){console.error(err);setStatus(`${file.name} を読めませんでした`)}}
    state.sources=[...state.sources,...loaded].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
    setBusy(false);renderFileList();updateFormula();invalidate();
    if(state.sources[0])drawSource(state.sources[0]);
  }

  async function decodeFile(file){
    let canvas;
    if(/\.psd$/i.test(file.name)){
      const PSDDecoder=resolvePsdDecoder();
      if(!PSDDecoder)throw new Error('PSD decoder unavailable');
      const psd=new PSDDecoder(new Uint8Array(await file.arrayBuffer())); psd.parse();
      const image=psd.image.toPng();
      await waitForImage(image);
      canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);
    }else{
      const bmp=await createImageBitmap(file);canvas=document.createElement('canvas');canvas.width=bmp.width;canvas.height=bmp.height;canvas.getContext('2d').drawImage(bmp,0,0);bmp.close();
    }
    return {name:file.name,canvas,width:canvas.width,height:canvas.height};
  }

  function resolvePsdDecoder(){
    if(typeof window.PSD==='function')return window.PSD;
    if(typeof window.require!=='function')return null;
    try{
      const module=window.require('psd');
      if(typeof module==='function')return module;
      return module?.PSD||module?.default||null;
    }catch(error){console.error('PSD.js module resolution failed',error);return null}
  }
  function waitForImage(image){
    if(image.complete&&image.naturalWidth)return Promise.resolve();
    if(typeof image.decode==='function')return image.decode();
    return new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('PSD preview image could not be decoded'))});
  }

  function renderFileList(){
    els.list.innerHTML='';els.list.hidden=!state.sources.length;
    state.sources.forEach((src,i)=>{const card=document.createElement('div');card.className='file-card';const thumb=document.createElement('canvas');thumb.width=340;thumb.height=216;const t=thumb.getContext('2d');t.fillStyle='#000';t.fillRect(0,0,340,216);const scale=Math.min(340/src.width,216/src.height);t.drawImage(src.canvas,(340-src.width*scale)/2,(216-src.height*scale)/2,src.width*scale,src.height*scale);card.append(thumb);const p=document.createElement('p');p.textContent=`${String(i+1).padStart(2,'0')} · ${src.name}`;card.append(p);const meta=document.createElement('small');meta.textContent=`${src.width} × ${src.height}`;card.append(meta);const del=document.createElement('button');del.textContent='×';del.title='削除';del.onclick=()=>{state.sources.splice(i,1);renderFileList();updateFormula();invalidate();if(state.sources[0])drawSource(state.sources[0]);else clearPreview()};card.append(del);els.list.append(card)});
    els.generate.disabled=state.sources.length<2;
  }

  function updateFormula(){const n=state.sources.length,b=+els.between.value||0,total=n>1?(n-1)*(b+1)+1:0;els.formula.textContent=n>1?`${n} KEY × ${b} IN-BETWEEN → ${total} FRAMES`:'キー画像を2枚以上追加してください'}
  function invalidate(){state.frames=[];state.zip=null;els.download.disabled=true;els.timeline.disabled=true;els.play.disabled=true}
  function drawSource(src){els.canvas.width=src.width;els.canvas.height=src.height;ctx.fillStyle='#000';ctx.fillRect(0,0,src.width,src.height);ctx.drawImage(src.canvas,0,0);els.empty.hidden=true;els.count.value='KEY FRAME';setStatus(src.name)}
  function clearPreview(){ctx.fillStyle='#050506';ctx.fillRect(0,0,els.canvas.width,els.canvas.height);els.empty.hidden=false;els.count.value='000 / 000';setStatus('待機中')}
  function setStatus(s){els.status.textContent=s}
  function setBusy(on,text='処理中…'){els.progress.hidden=!on;els.generate.disabled=on||state.sources.length<2;if(on){els.progress.querySelector('span').textContent=text;els.progress.querySelector('i').style.width='8%'}}
  const tick=()=>new Promise(r=>requestAnimationFrame(r));

  async function generate(){
    if(state.sources.length<2)return;
    const w=state.sources[0].width,h=state.sources[0].height;
    if(state.sources.some(x=>x.width!==w||x.height!==h))return setStatus('すべて同じ画像サイズにしてください');
    setBusy(true,'色領域を解析中…');state.frames=[];state.zip=null;
    try{
      const shapes=[];
      for(let i=0;i<state.sources.length;i++){shapes.push(vectorize(state.sources[i].canvas));setProgress((i+1)/state.sources.length*.25);await tick()}
      const palette=validateAndMatch(shapes);
      const between=Math.max(1,+els.between.value||1),steps=between+1;
      for(let pair=0;pair<shapes.length-1;pair++){
        for(let j=0;j<steps;j++){
          const raw=j/steps,t=ease(raw,els.easing.value);state.frames.push(renderTween(shapes[pair],shapes[pair+1],palette,t,w,h));
          setProgress(.25+.65*(pair*steps+j)/((shapes.length-1)*steps));await tick();
        }
      }
      state.frames.push(renderTween(shapes.at(-1),shapes.at(-1),palette,1,w,h));
      els.timeline.max=state.frames.length-1;els.timeline.value=0;els.timeline.disabled=false;els.play.disabled=false;els.download.disabled=false;showFrame(0);setStatus(`${state.frames.length}枚の連番を生成しました`);setProgress(1);
    }catch(err){console.error(err);setStatus(err.message||'生成に失敗しました')}
    finally{setTimeout(()=>setBusy(false),250)}
  }

  function vectorize(canvas){
    const c=canvas.getContext('2d'),{width:w,height:h}=canvas,data=c.getImageData(0,0,w,h).data,threshold=+els.threshold.value,tol=+els.tolerance.value;
    const buckets=new Map(),quant=Math.max(1,tol);
    for(let p=0;p<data.length;p+=4){if(data[p+3]<128||Math.max(data[p],data[p+1],data[p+2])<=threshold)continue;const rgb=[data[p],data[p+1],data[p+2]],bucket=rgb.map(v=>Math.round(v/quant)*quant).join(','),exact=rgb.join(',');if(!buckets.has(bucket))buckets.set(bucket,{count:0,exact:new Map()});const item=buckets.get(bucket);item.count++;item.exact.set(exact,(item.exact.get(exact)||0)+1)}
    const candidates=[...buckets.values()].filter(x=>x.count>=4).sort((a,b)=>b.count-a.count).map(item=>({count:item.count,rgb:[...item.exact].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(Number)}));
    const families=[];
    for(const candidate of candidates){let family=families.find(x=>colorCosine(x.rgb,candidate.rgb)>=.995);if(family){family.count+=candidate.count;if(candidate.count>family.peak){family.rgb=candidate.rgb;family.peak=candidate.count}}else families.push({rgb:candidate.rgb,count:candidate.count,peak:candidate.count})}
    const colors=families.filter(x=>x.count>=Math.max(16,w*h*.00001)&&Math.max(...x.rgb)>Math.max(32,threshold*2)).sort((a,b)=>b.count-a.count).slice(0,12).map(x=>x.rgb);
    const result=new Map();
    for(const color of colors){const mask=new Uint8Array(w*h);let count=0;for(let p=0,k=0;p<data.length;p+=4,k++){const rgb=[data[p],data[p+1],data[p+2]];if(data[p+3]<128||Math.max(...rgb)<=threshold)continue;if(colorCosine(rgb,color)>=.985){mask[k]=1;count++}}if(count<4)continue;const contour=traceBoundary(mask,w,h);if(contour.length>3)result.set(color.join(','),resample(contour,+els.precision.value))}
    return result;
  }

  function colorCosine(a,b){const dot=a[0]*b[0]+a[1]*b[1]+a[2]*b[2],ma=Math.hypot(...a),mb=Math.hypot(...b);return ma&&mb?dot/(ma*mb):0}

  function traceBoundary(mask,w,h){
    const edges=new Map(),add=(a,b)=>{const k=a.join(',');if(!edges.has(k))edges.set(k,[]);edges.get(k).push(b)};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){if(y===0||!mask[(y-1)*w+x])add([x,y],[x+1,y]);if(x===w-1||!mask[y*w+x+1])add([x+1,y],[x+1,y+1]);if(y===h-1||!mask[(y+1)*w+x])add([x+1,y+1],[x,y+1]);if(x===0||!mask[y*w+x-1])add([x,y+1],[x,y])}
    let best=[];
    while(edges.size){const start=edges.keys().next().value.split(',').map(Number),path=[start],cur=[...start];let guard=0;do{const key=cur.join(','),nexts=edges.get(key);if(!nexts||!nexts.length)break;const next=nexts.pop();if(!nexts.length)edges.delete(key);cur[0]=next[0];cur[1]=next[1];path.push([...cur])}while((cur[0]!==start[0]||cur[1]!==start[1])&&guard++<w*h*4);if(path.length>best.length)best=path}
    return best;
  }

  function resample(points,n){const seg=[],cum=[0];let total=0;for(let i=0;i<points.length-1;i++){const d=Math.hypot(points[i+1][0]-points[i][0],points[i+1][1]-points[i][1]);seg.push(d);total+=d;cum.push(total)}const out=[];for(let k=0;k<n;k++){const target=total*k/n;let i=0;while(i<seg.length-1&&cum[i+1]<target)i++;const u=seg[i]?((target-cum[i])/seg[i]):0;out.push([points[i][0]+(points[i+1][0]-points[i][0])*u,points[i][1]+(points[i+1][1]-points[i][1])*u])}return out}
  function validateAndMatch(shapes){const base=[...shapes[0].keys()];if(!base.length)throw new Error('色領域を検出できませんでした');for(let i=1;i<shapes.length;i++){const keys=[...shapes[i].keys()];for(const color of base){if(shapes[i].has(color))continue;const rgb=color.split(',').map(Number);let best=null,dist=Infinity;for(const k of keys){const v=k.split(',').map(Number),d=Math.hypot(v[0]-rgb[0],v[1]-rgb[1],v[2]-rgb[2]);if(d<dist){dist=d;best=k}}if(best&&dist<=+els.tolerance.value*2+4)shapes[i].set(color,shapes[i].get(best));else throw new Error(`画像${i+1}に RGB(${color}) の対応領域がありません`)}}for(const color of base)for(let i=1;i<shapes.length;i++)shapes[i].set(color,align(shapes[i-1].get(color),shapes[i].get(color)));return base}
  function align(a,b){const n=a.length,stride=Math.max(1,Math.floor(n/64));let best=0,cost=Infinity;for(let shift=0;shift<n;shift+=stride){let c=0;for(let i=0;i<n;i+=stride){const q=b[(i+shift)%n];c+=(a[i][0]-q[0])**2+(a[i][1]-q[1])**2}if(c<cost){cost=c;best=shift}}return b.map((_,i)=>b[(i+best)%n])}
  function renderTween(a,b,palette,t,w,h){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('width',w);svg.setAttribute('height',h);const bg=document.createElementNS(svg.namespaceURI,'rect');bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill','#000');svg.append(bg);for(const color of palette){const p=a.get(color),q=b.get(color),pts=p.map((v,i)=>[v[0]+(q[i][0]-v[0])*t,v[1]+(q[i][1]-v[1])*t]);const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',smoothPath(pts));path.setAttribute('fill',`rgb(${color})`);svg.append(path)}return svg}
  function smoothPath(p){if(!p.length)return'';let d=`M ${(p[0][0]+p.at(-1)[0])/2} ${(p[0][1]+p.at(-1)[1])/2}`;for(let i=0;i<p.length;i++){const n=p[(i+1)%p.length];d+=` Q ${p[i][0]} ${p[i][1]} ${(p[i][0]+n[0])/2} ${(p[i][1]+n[1])/2}`}return d+' Z'}
  function ease(t,type){if(type==='smooth')return t*t*(3-2*t);if(type==='easeInOut')return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;return t}
  async function svgToCanvas(svg,target=els.canvas,longEdge='original'){const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);try{const img=await new Promise((res,rej)=>{const x=new Image;x.onload=()=>res(x);x.onerror=rej;x.src=url}),sourceWidth=+svg.getAttribute('width'),sourceHeight=+svg.getAttribute('height'),requested=longEdge==='original'?Math.max(sourceWidth,sourceHeight):+longEdge,scale=requested/Math.max(sourceWidth,sourceHeight);target.width=Math.max(1,Math.round(sourceWidth*scale));target.height=Math.max(1,Math.round(sourceHeight*scale));target.getContext('2d',{alpha:false}).drawImage(img,0,0,target.width,target.height)}finally{URL.revokeObjectURL(url)}}
  function distanceFieldBlob(canvas,spread){
    const context=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height,source=context.getImageData(0,0,w,h).data,result=new ImageData(w,h),masks=[new Uint8Array(w*h),new Uint8Array(w*h),new Uint8Array(w*h)];
    for(let i=0,p=0;i<source.length;i+=4,p++){masks[0][p]=source[i]>=128?1:0;masks[1][p]=source[i+1]>=128?1:0;masks[2][p]=source[i+2]>=128?1:0}
    for(let channel=0;channel<3;channel++){
      const mask=masks[channel],insideCount=mask.reduce((sum,v)=>sum+v,0);
      if(!insideCount){for(let p=0;p<mask.length;p++)result.data[p*4+channel]=0;continue}
      if(insideCount===mask.length){for(let p=0;p<mask.length;p++)result.data[p*4+channel]=255;continue}
      const toInside=distanceTransform(mask,1,w,h),toOutside=distanceTransform(mask,0,w,h);
      for(let p=0;p<mask.length;p++){const signed=mask[p]?Math.sqrt(toOutside[p]):-Math.sqrt(toInside[p]);result.data[p*4+channel]=Math.round(255*Math.max(0,Math.min(1,.5+signed/(2*spread))))}
    }
    for(let p=3;p<result.data.length;p+=4)result.data[p]=255;
    const output=document.createElement('canvas');output.width=w;output.height=h;output.getContext('2d').putImageData(result,0,0);
    return new Promise(resolve=>output.toBlob(resolve,'image/png'));
  }
  function distanceTransform(mask,target,w,h){
    const size=w*h,data=new Float32Array(size),limit=Math.max(w,h),input=new Float32Array(limit),output=new Float32Array(limit),infinity=1e20;
    for(let i=0;i<size;i++)data[i]=mask[i]===target?0:infinity;
    for(let y=0;y<h;y++){const offset=y*w;for(let x=0;x<w;x++)input[x]=data[offset+x];edt1d(input,output,w);for(let x=0;x<w;x++)data[offset+x]=output[x]}
    for(let x=0;x<w;x++){for(let y=0;y<h;y++)input[y]=data[y*w+x];edt1d(input,output,h);for(let y=0;y<h;y++)data[y*w+x]=output[y]}
    return data;
  }
  function edt1d(input,output,n){
    const sites=new Int32Array(n),bounds=new Float64Array(n+1);let k=0;sites[0]=0;bounds[0]=-Infinity;bounds[1]=Infinity;
    for(let q=1;q<n;q++){let s=((input[q]+q*q)-(input[sites[k]]+sites[k]*sites[k]))/(2*q-2*sites[k]);while(s<=bounds[k]){k--;s=((input[q]+q*q)-(input[sites[k]]+sites[k]*sites[k]))/(2*q-2*sites[k])}k++;sites[k]=q;bounds[k]=s;bounds[k+1]=Infinity}
    k=0;for(let q=0;q<n;q++){while(bounds[k+1]<q)k++;const d=q-sites[k];output[q]=d*d+input[sites[k]]}
  }
  async function showFrame(i){if(!state.frames[i])return;await svgToCanvas(state.frames[i]);els.empty.hidden=true;els.timeline.value=i;els.count.value=`${String(i+1).padStart(3,'0')} / ${String(state.frames.length).padStart(3,'0')}`}
  function togglePlay(){if(state.timer){clearInterval(state.timer);state.timer=null;els.play.textContent='▶';return}els.play.textContent='Ⅱ';state.timer=setInterval(()=>{let i=(+els.timeline.value+1)%state.frames.length;showFrame(i)},1000/12)}
  async function downloadZip(){if(!state.frames.length||!window.JSZip)return setStatus('ZIPライブラリを読み込めませんでした');setBusy(true,'PNG・Distance Field連番を書き出し中…');els.download.disabled=true;try{const zip=new JSZip(),pad=String(state.frames.length).length,prefix=(els.prefix.value||'tween_').replace(/[\\/:*?"<>|]/g,'_'),resolution=els.outputResolution.value;const out=document.createElement('canvas');for(let i=0;i<state.frames.length;i++){await svgToCanvas(state.frames[i],out,resolution);const name=`${prefix}${String(i+1).padStart(pad,'0')}`,spread=Math.max(out.width,out.height)*.25;const blob=await new Promise(r=>out.toBlob(r,'image/png'));zip.file(`${name}.png`,blob);const dfBlob=await distanceFieldBlob(out,spread);zip.file(`distance_field/${name}_df.png`,dfBlob);setProgress((i+1)/state.frames.length*.8);await tick()}const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},m=>setProgress(.8+m.percent*.002));const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${prefix}sequence.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);setStatus(`長辺${resolution==='original'?'Original':resolution+'px'}でダウンロードしました`)}catch(e){console.error(e);setStatus('ZIPの作成に失敗しました')}finally{setBusy(false);els.download.disabled=false}}
  function setProgress(v){els.progress.querySelector('i').style.width=`${Math.round(v*100)}%`}
})();
