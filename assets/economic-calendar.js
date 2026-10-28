/* Calendar shares one data state with image export; upstream freshness is not guaranteed. */
(()=>{
const dictionary={
 'RBA Gov Bullock Speaks':'تصريحات محافظ البنك الاحتياطي الأسترالي بولوك','Trimmed Mean CPI m/m':'مؤشر التضخم الأساسي المشذب الشهري','Official Cash Rate':'سعر الفائدة النقدية الرسمي','RBNZ Rate Statement':'بيان الفائدة للبنك المركزي النيوزيلندي','RBNZ Press Conference':'المؤتمر الصحفي للبنك المركزي النيوزيلندي','Annual Budget Release':'صدور الموازنة السنوية','Autumn Forecast Statement':'بيان التوقعات الاقتصادية للخريف','BOC Monetary Policy Report':'تقرير السياسة النقدية لبنك كندا','BOC Rate Statement':'بيان الفائدة لبنك كندا','Overnight Rate':'سعر الفائدة لليلة واحدة','BOC Press Conference':'المؤتمر الصحفي لبنك كندا','Advance GDP Price Index q/q':'التقدير الأولي لمؤشر أسعار الناتج المحلي الفصلي','Main Refinancing Rate':'سعر إعادة التمويل الرئيسي','ECB Press Conference':'المؤتمر الصحفي للمركزي الأوروبي','Tokyo Core CPI y/y':'مؤشر التضخم الأساسي في طوكيو السنوي','BOJ Policy Rate':'سعر الفائدة لبنك اليابان','BOJ Outlook Report':'تقرير التوقعات لبنك اليابان','BOJ Press Conference':'المؤتمر الصحفي لبنك اليابان','German Prelim CPI m/m':'التقدير الأولي للتضخم الألماني الشهري','German Prelim GDP q/q':'التقدير الأولي للناتج المحلي الألماني الفصلي','GDP m/m':'الناتج المحلي الإجمالي الشهري','Employment Cost Index q/q':'مؤشر تكلفة التوظيف الفصلي',
 'CPI m/m':'مؤشر أسعار المستهلكين الشهري','CPI y/y':'مؤشر أسعار المستهلكين السنوي','Core CPI m/m':'مؤشر أسعار المستهلكين الأساسي الشهري','Core CPI y/y':'مؤشر أسعار المستهلكين الأساسي السنوي','PPI m/m':'مؤشر أسعار المنتجين الشهري','Core PPI m/m':'مؤشر أسعار المنتجين الأساسي الشهري','Unemployment Rate':'معدل البطالة','Non-Farm Employment Change':'التغير في الوظائف غير الزراعية','Unemployment Claims':'طلبات إعانة البطالة','Average Hourly Earnings m/m':'متوسط الأجور بالساعة الشهري','Federal Funds Rate':'سعر الفائدة الفيدرالية','FOMC Statement':'بيان لجنة السوق المفتوحة الفيدرالية','FOMC Press Conference':'المؤتمر الصحفي للفيدرالي','FOMC Meeting Minutes':'محضر اجتماع الفيدرالي','GDP q/q':'الناتج المحلي الإجمالي الفصلي','Advance GDP q/q':'التقدير الأولي للناتج المحلي الإجمالي الفصلي','Retail Sales m/m':'مبيعات التجزئة الشهرية','Core Retail Sales m/m':'مبيعات التجزئة الأساسية الشهرية','Crude Oil Inventories':'مخزونات النفط الخام','ISM Manufacturing PMI':'مؤشر مديري مشتريات التصنيع من ISM','ISM Services PMI':'مؤشر مديري مشتريات الخدمات من ISM','Manufacturing PMI':'مؤشر مديري مشتريات التصنيع','Services PMI':'مؤشر مديري مشتريات الخدمات','CB Consumer Confidence':'مؤشر ثقة المستهلك','Consumer Confidence':'ثقة المستهلك','Trade Balance':'الميزان التجاري','Bank Rate':'سعر الفائدة المصرفية','Official Bank Rate':'سعر الفائدة الرسمي','ECB Main Refinancing Rate':'سعر إعادة التمويل الرئيسي للمركزي الأوروبي','Monetary Policy Statement':'بيان السياسة النقدية','Prelim GDP q/q':'القراءة الأولية للناتج المحلي الإجمالي الفصلي','Flash Manufacturing PMI':'القراءة الأولية لمؤشر مديري مشتريات التصنيع','Flash Services PMI':'القراءة الأولية لمؤشر مديري مشتريات الخدمات','JOLTS Job Openings':'فرص العمل الشاغرة JOLTS','ADP Non-Farm Employment Change':'التغير في وظائف القطاع الخاص ADP','New Home Sales':'مبيعات المنازل الجديدة','Existing Home Sales':'مبيعات المنازل القائمة','Consumer Price Index':'مؤشر أسعار المستهلكين','Core PCE Price Index m/m':'مؤشر نفقات الاستهلاك الشخصي الأساسي الشهري','PCE Price Index m/m':'مؤشر نفقات الاستهلاك الشخصي الشهري','Building Permits':'تصاريح البناء','Housing Starts':'بدء بناء المنازل','Durable Goods Orders m/m':'طلبات السلع المعمرة الشهرية','Core Durable Goods Orders m/m':'طلبات السلع المعمرة الأساسية الشهرية','Prelim UoM Consumer Sentiment':'القراءة الأولية لمعنويات المستهلك بجامعة ميشيغان','Revised UoM Consumer Sentiment':'القراءة المعدلة لمعنويات المستهلك بجامعة ميشيغان'
};
const root=document.getElementById('vx-events');if(!root)return;
const status=document.getElementById('vx-calendar-status'), country=document.getElementById('vx-country'), impact=document.getElementById('vx-impact'), period=document.getElementById('vx-period');let data=null;
const choice=document.getElementById('vx-calendar-choice'),choiceHelp=document.getElementById('vx-calendar-choice-help'),selectedEvents=new Set();
const eventKey=e=>encodeURIComponent(JSON.stringify([e.country,e.date,e.title]));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const day=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
// Generated initials are only a fallback; they are not official market ticker symbols.
function abbreviation(title){
  const words=String(title).match(/[A-Za-z0-9]+/g)||[];
  const ignored=new Set(['a','an','and','the','of','for','in','on','to']);
  const initials=words.filter(w=>!ignored.has(w.toLowerCase())).map(w=>w.length>1&&w===w.toUpperCase()?w:w[0].toUpperCase()).join('');
  return initials.slice(0,12)||'EVENT';
}
function assets(e){const title=e.title.toLowerCase();if(/crude oil inventories|oil inventory/.test(title))return ['WTI CFD','Brent CFD'];if(e.country==='USD'&&/cpi|inflation|pce|fomc|federal funds|non-farm|unemployment/.test(title))return ['USD','XAU/USD','EUR/USD'];if(e.country==='EUR'&&/ecb|cpi|inflation|rate/.test(title))return ['EUR/USD','EUR/GBP'];return [];}
function render(){if(!data)return;const now=new Date(), c=country.value, level=impact.value, range=period.value;
 let entries=data.events.filter(e=>{const d=new Date(e.date);if(Number.isNaN(d.valueOf()))return false;if(c!=='all'&&e.country!==c)return false;if(level==='high'&&e.impact!=='High')return false;if(level==='medium'&&!['High','Medium'].includes(e.impact))return false;if(range==='today'&&day(d)!==day(now))return false;return true}).sort((a,b)=>new Date(a.date)-new Date(b.date));
 const manual=choice&&choice.value==='selected',exportEvents=manual?entries.filter(e=>selectedEvents.has(eventKey(e))):entries;
 window.vxCalendarExport={updatedAt:data.updated_at, fetchedAt:data.fetched_at||null, snapshot:Boolean(data.snapshot), period:range,selectionMode:manual?'selected':'all',selectedTotal:manual?selectedEvents.size:0,events:exportEvents.map(e=>({...e,title_ar:dictionary[e.title]||''}))};
 if(choiceHelp)choiceHelp.textContent=manual?'حدد حتى 10 أخبار من القائمة الحالية: '+selectedEvents.size+' / 10':'تعرض الصورة أول 10 أخبار كحد أقصى من القائمة المطابقة للفلاتر.';
 root.innerHTML=entries.length?entries.map(e=>{let a=dictionary[e.title], symbols=assets(e), im=({High:'مرتفع | High',Medium:'متوسط | Medium',Low:'منخفض | Low',Holiday:'عطلة | Holiday'})[e.impact]||e.impact;const fields=[['الفعلي<br><span lang="en">Actual</span>',e.actual],['المتوقع<br><span lang="en">Forecast</span>',e.forecast],['السابق<br><span lang="en">Previous</span>',e.previous]].map(([n,v])=>`<div><small>${n}</small><strong dir="ltr">${esc(v||'—')}</strong></div>`).join('');return `<article class="vx-event">${manual?`<label class="vx-event-select"><input type="checkbox" data-vx-event-key="${eventKey(e)}" ${selectedEvents.has(eventKey(e))?'checked':''}> اختيار هذا الخبر للصورة</label>`:''}<div class="vx-event-meta"><time>${esc(fmt.format(new Date(e.date)))} <small>TRT</small></time><span class="vx-importance vx-i-${esc(e.impact)}">${esc(im)}</span><span dir="ltr">${esc(e.country)}</span></div><div class="vx-event-title"><strong>${a?esc(a):'اختصار تلقائي | Auto initials: '+esc(abbreviation(e.title))}</strong><span dir="ltr">${esc(e.title)}</span></div><div class="vx-event-values">${fields}</div><div class="vx-event-assets">${symbols.length?'أصول قد تتأثر | Potentially affected: '+symbols.map(x=>`<span dir="ltr">${esc(x)}</span>`).join(' '):'الأصول المرتبطة: — | Assets: —'}</div></article>`}).join(''):'<p class="vx-empty">لا توجد أحداث مطابقة في البيانات المتاحة. | No matching events in the available snapshot.</p>';
 const updated=new Date(data.updated_at), valid=Boolean(data.updated_at)&&Number.isFinite(updated.valueOf()), mins=valid?Math.floor((Date.now()-updated)/60000):Infinity;status.textContent=`${valid?(data.snapshot?'تاريخ البيانات المتاحة | Available data timestamp: ':'آخر تعديل معلن للمصدر | Source last modified: ')+fmt.format(updated)+' TRT':'وقت تعديل المصدر غير متاح | Source update time unavailable'}${data.snapshot?' · ⚠ تعذر التحديث / Refresh failed':mins>90?' · ⚠ تحقق من المصدر / Check source':''} · ${entries.length} حدث / events`;
}
[country,impact,period].forEach(x=>x.addEventListener('change',()=>{selectedEvents.clear();render()}));
if(choice)choice.addEventListener('change',()=>{selectedEvents.clear();render()});
root.addEventListener('change',e=>{const input=e.target;if(!input.matches('input[data-vx-event-key]'))return;const key=input.dataset.vxEventKey;if(input.checked&&selectedEvents.size>=10){input.checked=false;if(choiceHelp)choiceHelp.textContent='يمكن اختيار 10 أخبار كحد أقصى.';return}if(input.checked)selectedEvents.add(key);else selectedEvents.delete(key);render()});
let inFlight=null, retryAfter=0, lastSuccessfulAt=0;
async function refreshCalendar(){
 if(inFlight)return inFlight;
 // Reuse this tab's recent successful fetch instead of immediately hitting the source again.
 if(data&&!data.snapshot&&Date.now()-lastSuccessfulAt<120000)return window.vxCalendarExport;
 if(Date.now()<retryAfter)throw Error('rate_limited');
 inFlight=(async()=>{
  let response;
  try {response=await fetch('/api/calendar',{cache:'no-store'})} catch(e){retryAfter=Date.now()+60000;throw e}
  if(!response.ok){
   const delay=Number(response.headers.get('retry-after'));
   retryAfter=Date.now()+(response.status===429&&Number.isFinite(delay)&&delay>0?Math.min(delay,3600)*1000:60000);
   throw Error(response.status===429?'rate_limited':'unavailable');
  }
  const value=await response.json();
  if(!Array.isArray(value.events)||!value.events.length||!value.fetched_at)throw Error('invalid');
  // CDN can return an earlier fetch; only reuse for two minutes from its real fetch time.
  const fetched=Date.parse(value.fetched_at);lastSuccessfulAt=Number.isFinite(fetched)?Math.min(fetched,Date.now()):0;
  value.snapshot=false;data=value;render();return window.vxCalendarExport;
 })();
 try{return await inFlight}finally{inFlight=null}
}
window.vxRefreshCalendar=refreshCalendar;
window.vxCalendarMarkSnapshot=()=>{if(data){data.snapshot=true;render()}return window.vxCalendarExport||null};
(async()=>{
 try{await refreshCalendar()}
 catch(_){
  try{const r=await fetch('/data/economic-calendar.json',{cache:'no-store'});if(!r.ok)throw Error('snapshot');const value=await r.json();if(!Array.isArray(value.events)||!value.updated_at)throw Error('invalid');value.snapshot=true;data=value;render();}
  catch(_){status.textContent='تعذر تحميل البيانات | Calendar data unavailable';root.innerHTML='<p class="vx-empty">البيانات غير متاحة حاليًا. يرجى مراجعة المصدر مباشرة. | Data unavailable; please check the source.</p>'}
 }
})();
})();
