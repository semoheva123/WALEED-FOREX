/* The news snapshot contains headlines only, not complete articles. */
(()=>{
 const list=document.getElementById('vx-news-list'),status=document.getElementById('vx-news-status');if(!list||!status)return;
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
 const datefmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 fetch('/data/market-news.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(data=>{
  if(!Array.isArray(data.items)||!data.updated_at)throw Error('Invalid news snapshot');
  const update=new Date(data.updated_at);if(!Number.isFinite(update.getTime()))throw Error('Invalid timestamp');
  const age=Date.now()-update.getTime();status.textContent='آخر تحديث | Last update: '+datefmt.format(update)+' TRT'+(age>90*60000?' · ⚠ بيانات قديمة / Stale data':'');
  const items=[...data.items].sort((a,b)=>(Date.parse(b.published_at)||0)-(Date.parse(a.published_at)||0));list.replaceChildren();
  for(const item of items){
   let u;try{u=new URL(item.link);if(u.protocol!=='https:')continue}catch{continue}
   const article=make('article','vx-news-card');
   const meta=make('div','vx-news-meta');meta.append(make('span','vx-news-source',item.source||'Google News'));
   const d=new Date(item.published_at);const time=make('time','',Number.isFinite(d.getTime())?datefmt.format(d)+' TRT':'وقت النشر غير متاح | Date unavailable');if(Number.isFinite(d.getTime()))time.dateTime=d.toISOString();meta.append(time);article.append(meta);
   const ar=make('h3','vx-news-ar',item.title_ar||'العنوان غير متوفر');ar.lang='ar';ar.dir='rtl';article.append(ar);
   const en=make('p','vx-news-en',item.title_en||'الترجمة غير متاحة | Translation unavailable');en.lang='en';en.dir='ltr';article.append(en);
   const link=make('a','vx-news-link','اقرأ المصدر | Read source ↗');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','اقرأ المصدر: '+(item.title_ar||''));article.append(link);list.append(article);
  }
  if(!list.children.length)list.append(make('p','vx-empty','لا توجد أخبار متاحة | No headlines available.'));
 }).catch(()=>{status.textContent='تعذر تحميل الأخبار | News unavailable';list.replaceChildren(make('p','vx-empty','حاول مجددًا لاحقًا أو راجع مصدر الأخبار مباشرة. | Please try again or check the source.'))});
})();
