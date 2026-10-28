/* Capture a user-approved screen or user-selected screenshot, without reading TradingView data. */
(()=>{
 const button=document.getElementById('vx-share-prices'),status=document.getElementById('vx-share-prices-status');
 const fallback=document.getElementById('vx-share-prices-fallback'),pick=document.getElementById('vx-pick-screenshot'),input=document.getElementById('vx-screenshot-file');
 if(!button||!status||!fallback||!pick||!input)return;
 const options=document.getElementById('vx-capture-options'),category=document.getElementById('vx-capture-category'),host=document.getElementById('vx-capture-widget'),start=document.getElementById('vx-capture-start');
 const groups={forex:[{s:'FX:EURUSD',d:'EUR/USD'},{s:'FX:GBPUSD',d:'GBP/USD'},{s:'FX:USDJPY',d:'USD/JPY'},{s:'FX:USDCHF',d:'USD/CHF'}],commodities:[{s:'OANDA:XAUUSD',d:'Gold / USD'},{s:'OANDA:XAGUSD',d:'Silver / USD'},{s:'TVC:USOIL',d:'WTI Oil / CFD'},{s:'OANDA:BCOUSD',d:'Brent / CFD'}],indices:[{s:'FOREXCOM:SPXUSD',d:'S&P 500 / CFD'},{s:'FOREXCOM:US30',d:'Dow Jones 30 / CFD'},{s:'FOREXCOM:NSXUSD',d:'US Tech 100 / CFD'}]};
 const labels={forex:'الفوركس',commodities:'السلع',indices:'المؤشرات',all:'الفوركس والسلع والمؤشرات'};
 button.addEventListener('click',()=>{options.hidden=false;options.scrollIntoView({behavior:'smooth',block:'nearest'});message('اختر الفئة، ثم انتظر ظهور الأسعار قبل التقاط الشاشة.')});
 category.addEventListener('change',()=>{const key=category.value;host.replaceChildren();fallback.hidden=true;start.disabled=!key;if(!key)return;
  const symbols=key==='all'?[...groups.forex,...groups.commodities,...groups.indices]:groups[key];
  const container=document.createElement('div');container.className='tradingview-widget-container';const body=document.createElement('div');body.className='tradingview-widget-container__widget';
  const attribution=document.createElement('a');attribution.href='https://www.tradingview.com/markets/';attribution.target='_blank';attribution.rel='noopener noreferrer';attribution.textContent='Market data by TradingView';
  const script=document.createElement('script');script.src='https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';script.async=true;script.textContent=JSON.stringify({colorTheme:'dark',dateRange:'1D',showChart:false,locale:'ar_AE',isTransparent:true,showSymbolLogo:true,width:'100%',height:key==='all'?850:390,tabs:[{title:labels[key],symbols}]});
  container.append(body,attribution,script);host.append(container);message('انتظر ظهور أسعار '+labels[key]+'، ثم التقط الشاشة أو اختر لقطة محفوظة.');
 });

 const message=(t)=>{status.textContent=t};
 function frameImage(image,w,h){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;const c=canvas.getContext('2d');
  const bg=c.createLinearGradient(0,0,1050,1600);bg.addColorStop(0,'#1b3939');bg.addColorStop(.37,'#0c2029');bg.addColorStop(1,'#050f19');c.fillStyle=bg;c.fillRect(0,0,1080,1920);
  c.strokeStyle='rgba(207,180,122,.18)';c.lineWidth=2;c.beginPath();c.arc(100,-60,700,0,Math.PI*1.1);c.stroke();
  c.strokeStyle='#cbb17c';c.lineWidth=2;c.strokeRect(685,70,88,88);c.fillStyle='#e5c88e';c.textAlign='center';c.font='bold 36px Arial';c.fillText('VX',729,126);
  c.textAlign='left';c.direction='ltr';c.font='bold 42px Arial';c.fillStyle='#f0f4f2';c.fillText('VALID',792,116);c.fillStyle='#e5c88e';c.fillText('VX',930,116);
  c.font='20px Arial';c.fillStyle='#b8cbcb';c.fillText('VALIDVX.COM',792,145);c.fillStyle='#dec38b';c.font='20px Arial';c.fillText('MARKET BRIEF / 01',70,120);
  c.strokeStyle='rgba(207,180,122,.35)';c.beginPath();c.moveTo(70,205);c.lineTo(1010,205);c.stroke();
  c.textAlign='right';c.direction='ltr';c.fillStyle='#e4c58a';c.font='21px Arial';c.fillText('GLOBAL MARKETS · DAILY SNAPSHOT',1010,300);
  c.direction='rtl';c.fillStyle='#eef5f5';c.font='bold 66px Tahoma, Arial, sans-serif';c.fillText('نظرة على الأسواق',1010,405);
  c.fillStyle='#b6c7ce';c.font='30px Tahoma, Arial, sans-serif';c.fillText('لقطة من لوحة الأسعار على TradingView',1010,470);
  c.fillStyle='#112632';c.fillRect(70,530,940,1110);c.strokeStyle='rgba(150,180,190,.25)';c.strokeRect(70,530,940,1110);
  const maxW=920,maxH=1090,ratio=Math.min(maxW/w,maxH/h),tw=w*ratio,th=h*ratio;c.drawImage(image,(1080-tw)/2,540+(1090-th)/2,tw,th);
  c.fillStyle='#e2c99b';c.font='23px Tahoma, Arial, sans-serif';c.fillText('الأسعار كما ظهرت في لقطة الشاشة وقد تتغير بعدها.',1010,1695);
  c.strokeStyle='rgba(207,180,122,.35)';c.beginPath();c.moveTo(70,1760);c.lineTo(1010,1760);c.stroke();
  c.direction='ltr';c.fillStyle='#d9bd84';c.textAlign='right';c.font='bold 23px Arial';c.fillText('VALIDVX.COM  ·  MARKET INTELLIGENCE',1010,1810);
  c.direction='rtl';c.fillStyle='#b0c0c6';c.font='21px Tahoma, Arial, sans-serif';c.fillText('الأسعار إرشادية وقد تتأخر أو تختلف عن أسعار الوسيط؛ ليست توصية.',1010,1850);
  return canvas;
 }
 function download(file){const u=URL.createObjectURL(file),a=document.createElement('a');a.href=u;a.download=file.name||'validvx-screen.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
 async function shareImage(image,w,h){
  const blob=await new Promise(resolve=>frameImage(image,w,h).toBlob(resolve,'image/png'));if(!blob)throw Error('image');
  const file=typeof File==='function'?new File([blob],'validvx-screen.png',{type:'image/png'}):blob;
  if(typeof File==='function'&&navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
   try{await navigator.share({files:[file],title:'VALID VX | لوحة الأسعار'});message('تم فتح قائمة المشاركة.');return}
   catch(e){if(e.name==='AbortError'){message('تم إلغاء المشاركة.');return} /* browsers may require a fresh gesture */}
  }
  download(file);message('تم تنزيل الصورة؛ يمكنك مشاركتها من معرض الصور.');
 }
 start.addEventListener('click',async()=>{
  if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia){fallback.hidden=false;message('التقاط الشاشة المباشر غير متاح على هذا المتصفح.');return}
  let stream;
  try{
   message('اختر الشاشة أو علامة التبويب التي تعرض لوحة الأسعار.');
   stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
   const video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;
   await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject;setTimeout(()=>reject(Error('timeout')),8000)});
   await video.play();if(!video.videoWidth||!video.videoHeight)throw Error('empty');
   const shot=document.createElement('canvas');shot.width=video.videoWidth;shot.height=video.videoHeight;shot.getContext('2d').drawImage(video,0,0);
   stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;
   await shareImage(shot,shot.width,shot.height);
  }catch(e){fallback.hidden=false;if(e.name==='NotAllowedError'||e.name==='AbortError')message('لم يُسمح بالتقاط الشاشة أو أُغلق اختيارها. قد تمنع المعاينة أو إعدادات المتصفح ذلك؛ يمكنك اختيار لقطة شاشة محفوظة.');else message('تعذر التقاط الشاشة؛ يمكنك اختيار لقطة محفوظة.')}
  finally{if(stream)stream.getTracks().forEach(t=>t.stop())}
 });
 pick.addEventListener('click',()=>input.click());
 input.addEventListener('change',async()=>{const file=input.files&&input.files[0];if(!file)return;try{if(!file.type.startsWith('image/')||file.size>15*1024*1024)throw Error('invalid');const url=URL.createObjectURL(file);try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});await shareImage(image,image.naturalWidth,image.naturalHeight)}finally{URL.revokeObjectURL(url)}}catch(e){message('تعذر فتح الصورة. اختر صورة بحجم أقل من 15 ميغابايت.')}finally{input.value=''}});
})();
