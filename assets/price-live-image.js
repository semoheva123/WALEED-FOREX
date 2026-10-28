/* Experimental: relies on an on-demand backend, never extracts iframe contents in this page. */
(()=>{
 const button=document.getElementById('vx-generate-prices'), category=document.getElementById('vx-capture-category'), status=document.getElementById('vx-share-prices-status');
 if(!button||!category||!status)return;
 const meta={EURUSD:['اليورو / الدولار','EUR / USD','FOREX'],GBPUSD:['الجنيه / الدولار','GBP / USD','FOREX'],USDJPY:['الدولار / الين','USD / JPY','FOREX'],USDCHF:['الدولار / الفرنك','USD / CHF','FOREX'],XAUUSD:['الذهب / الدولار','XAU / USD','USD / OZ'],XAGUSD:['الفضة / الدولار','XAG / USD','USD / OZ'],USOIL:['النفط الأمريكي','WTI · CFD','USD / BARREL'],BCOUSD:['نفط برنت','BRENT · CFD','USD / BARREL'],SPXUSD:['إس آند بي 500','S&P 500 · CFD','INDEX CFD'],US30:['داو جونز','US 30 · CFD','INDEX CFD'],NSXUSD:['ناسداك 100','US TECH 100 · CFD','INDEX CFD']};
 const english={EURUSD:'Euro / US Dollar',GBPUSD:'Pound / US Dollar',USDJPY:'US Dollar / Yen',USDCHF:'US Dollar / Franc',XAUUSD:'Gold / US Dollar',XAGUSD:'Silver / US Dollar',USOIL:'WTI Oil / CFD',BCOUSD:'Brent Oil / CFD',SPXUSD:'S&P 500 / CFD',US30:'Dow Jones 30 / CFD',NSXUSD:'US Tech 100 / CFD'};
 function draw(data){
  const cv=document.createElement('canvas');cv.width=1080;cv.height=1920;const c=cv.getContext('2d');
  let gradient=c.createLinearGradient(0,0,950,1600);gradient.addColorStop(0,'#203d3b');gradient.addColorStop(.4,'#0c1d27');gradient.addColorStop(1,'#060e17');c.fillStyle=gradient;c.fillRect(0,0,1080,1920);
  c.strokeStyle='#d1b679';c.lineWidth=2;c.beginPath();c.roundRect(680,70,88,88,12);c.stroke();c.fillStyle='#e6ca8d';c.font='bold 37px Arial';c.textAlign='center';c.fillText('VX',724,125);
  c.direction='ltr';c.textAlign='left';c.fillStyle='#eef3f4';c.font='bold 40px Arial';c.fillText('VALID',790,118);c.fillStyle='#dfc184';c.fillText('VX',927,118);c.font='20px Arial';c.fillStyle='#b5c4c1';c.fillText('VALIDVX.COM',790,148);c.fillStyle='#ddc693';c.fillText('MARKET BRIEF / 01',70,120);
  c.strokeStyle='#d3b87966';c.beginPath();c.moveTo(70,205);c.lineTo(1010,205);c.stroke();
  c.textAlign='right';c.fillStyle='#d8b978';c.font='21px Arial';c.fillText('GLOBAL MARKETS · DAILY SNAPSHOT',1010,320);
  c.direction='rtl';c.fillStyle='#eef3f4';c.font='bold 66px Tahoma, Arial';c.fillText('نظرة على الأسواق',1010,414);c.fillStyle='#acbdc1';c.font='29px Tahoma, Arial';c.fillText('أبرز الأصول العالمية في لمحة واحدة',1010,475);
  const stamp=new Intl.DateTimeFormat('ar-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(data.capturedAt));
  c.strokeStyle='#d5b67670';c.beginPath();c.roundRect(450,525,560,58,8);c.stroke();c.fillStyle='#d7c18f';c.font='22px Tahoma, Arial';c.fillText('وقت الالتقاط: '+stamp+' · إسطنبول',990,562);
  const quotes=data.quotes, top=630, height=750, row=height/quotes.length;c.fillStyle='#132633';c.beginPath();c.roundRect(70,top,940,height,20);c.fill();c.strokeStyle='#ffffff18';c.stroke();
  for(let i=0;i<quotes.length;i++){let q=quotes[i],m=meta[q.symbol];if(!m)continue;let y=top+i*row;let mainSize=quotes.length>6?22:30, priceSize=quotes.length>6?28:41,subSize=quotes.length>6?16:21;
    c.direction='rtl';c.textAlign='right';c.fillStyle='#eef3f4';c.font='bold '+mainSize+'px Tahoma, Arial';c.fillText(m[0],970,y+row*.52,285);
    c.direction='ltr';c.textAlign='center';c.fillStyle='#eef3f4';c.font='bold '+(quotes.length>6?20:24)+'px Arial';c.fillText(english[q.symbol]||m[1],540,y+row*.42,290);c.fillStyle='#9fb2b9';c.font=subSize+'px Arial';c.fillText(m[1],540,y+row*.72);
    c.textAlign='left';c.fillStyle=q.price?'#efd9a5':'#b6c5c7';c.font='bold '+priceSize+'px Arial';c.fillText(q.price||'غير متاح',110,y+row*.43,275);c.fillStyle='#9fb2b9';c.font=subSize+'px Arial';c.fillText(m[2],110,y+row*.73);
    if(i<quotes.length-1){c.strokeStyle='#ffffff1a';c.beginPath();c.moveTo(110,y+row);c.lineTo(970,y+row);c.stroke()}
  }
  c.direction='rtl';c.textAlign='right';c.fillStyle='#d5b67620';c.fillRect(70,1420,940,60);c.fillStyle='#e6c990';c.font='22px Tahoma, Arial';c.fillText('الأسعار قد تتأخر أو تتغير. المصدر: TradingView.',990,1458);
  c.strokeStyle='#d3b87966';c.beginPath();c.moveTo(70,1740);c.lineTo(1010,1740);c.stroke();c.direction='ltr';c.fillStyle='#d8bd85';c.font='bold 22px Arial';c.fillText('VALIDVX.COM  ·  MARKET INTELLIGENCE',1010,1790);c.direction='rtl';c.fillStyle='#a5b5bd';c.font='21px Tahoma, Arial';c.fillText('الأسعار إرشادية وقد تختلف عن أسعار الوسيط. ليست توصية استثمارية.',1010,1840);return cv;
 }
 button.addEventListener('click',async()=>{
  if(!category.value){status.textContent='اختر الفئة أولًا.';return}button.disabled=true;status.textContent='جارٍ طلب الأسعار وإنشاء الصورة…';
  try{const url=new URL(window.VX_QUOTE_API || '/api/quotes',location.href);url.searchParams.set('category',category.value);const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error('service');const data=await res.json();if(!Array.isArray(data.quotes)||!data.quotes.length||!data.capturedAt)throw Error('data');const blob=await new Promise(r=>draw(data).toBlob(r,'image/png'));if(!blob)throw Error('image');const file=new File([blob],'validvx-prices.png',{type:'image/png'});
   if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:'VALID VX'});status.textContent='تم فتح قائمة المشاركة.';return}catch(e){if(e.name==='AbortError'){status.textContent='تم إلغاء المشاركة.';return}}}
   const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);status.textContent='تم تنزيل الصورة؛ يمكنك مشاركتها من جهازك.';
  }catch(e){status.textContent='تعذر جلب الأسعار. خدمة الأسعار غير متاحة أو لم تُربط بهذا الموقع.'}finally{button.disabled=false}
 });
})();
