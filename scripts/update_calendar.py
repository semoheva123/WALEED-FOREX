#!/usr/bin/env python3
"""Refresh the public calendar snapshot; never overwrite the last good snapshot on failure."""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

URL='https://nfs.faireconomy.media/ff_calendar_thisweek.json'
req=Request(URL, headers={'User-Agent':'Mozilla/5.0 VALID-VX-calendar/1.0'})
with urlopen(req, timeout=25) as response:
    raw=json.load(response)
if not isinstance(raw,list) or not raw:
    raise ValueError('Empty or invalid calendar response; refusing to replace snapshot')
events=[]
for item in raw:
    if not isinstance(item, dict) or not all(item.get(k) for k in ('title','date','country','impact')): continue
    events.append({k:str(item.get(k) or '') for k in ('title','country','date','impact','forecast','previous','actual')})
if not events: raise ValueError('No valid events; refusing to replace snapshot')
out={'updated_at':datetime.now(timezone.utc).isoformat(), 'source':'Fair Economy / Forex Factory', 'events':events}
path=Path(__file__).resolve().parent.parent/'data'/'economic-calendar.json'
tmp=path.with_suffix('.tmp'); tmp.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8'); tmp.replace(path)
print('Updated',len(events),'events')
