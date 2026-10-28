#!/usr/bin/env python3
"""Create a dated news snapshot. Translation failures leave the original intact."""
import html, json, time, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
PATH=ROOT/'data'/'market-news.json'
HEADERS={'User-Agent':'Mozilla/5.0 (compatible; VALIDVX-news/1.0)'}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=16) as r:
        return r.read()
cache={}
if PATH.exists():
    try:
        old=json.loads(PATH.read_text(encoding='utf-8'))
        cache={x['title_ar']:x['title_en'] for x in old.get('items',[]) if x.get('title_en')}
    except (ValueError,KeyError,TypeError): pass
query=urllib.parse.urlencode({'q':'الاقتصاد الأسواق العملات الذهب النفط','hl':'ar','gl':'SA','ceid':'SA:ar'})
root=ET.fromstring(get('https://news.google.com/rss/search?'+query))
items=[]
for el in root.findall('./channel/item')[:8]:
    title=(el.findtext('title') or '').strip(); link=(el.findtext('link') or '').strip()
    source=(el.findtext('source') or '').strip(); published=(el.findtext('pubDate') or '').strip()
    if not title or not link.startswith('https://'): continue
    translation=cache.get(title,'')
    if not translation:
        try:
            params=urllib.parse.urlencode({'q':title[:450],'langpair':'ar|en'})
            result=json.loads(get('https://api.mymemory.translated.net/get?'+params))
            text=result.get('responseData',{}).get('translatedText','')
            if result.get('responseStatus')==200 and not result.get('quotaFinished') and text and text.strip().lower()!=title.lower():
                translation=html.unescape(text.strip())
        except Exception as e:
            print('Translation unavailable:',type(e).__name__)
    items.append({'title_ar':title,'title_en':translation,'link':link,'source':source,'published_at':published})
if not items: raise ValueError('No headlines returned; previous snapshot preserved')
output={'updated_at':datetime.now(timezone.utc).isoformat(),'source':'Google News RSS','translation':'MyMemory (automated, when available)','items':items}
tmp=PATH.with_suffix('.tmp');tmp.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(PATH)
print('Updated',len(items),'headlines, translated',sum(bool(i['title_en']) for i in items))
