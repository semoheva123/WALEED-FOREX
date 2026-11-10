#!/usr/bin/env python3
"""Refresh the public calendar snapshot; never overwrite the last good snapshot on failure.

Primary source: Investing.com Saudi Arabic calendar (HTML, best-effort parse).
Fallback source: Fair Economy / Forex Factory JSON (used when Investing.com
blocks the request, e.g. HTTP 403 from datacenter IPs).
"""
import html as html_lib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

INVESTING_URL = 'https://sa.investing.com/economic-calendar'
FAIRECONOMY_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'
BROWSER_UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

MONTHS = {
    'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'مايو': 5, 'يونيو': 6,
    'يوليو': 7, 'أغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
}


def strip_tags(s):
    s = re.sub(r'<[^>]*>', '', s or '')
    s = html_lib.unescape(s).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', s).strip()


def parse_day_header(text):
    m = re.search(r'(\d{1,2})\s+([^\s\d,]+)\s+(\d{4})', text)
    if m and m.group(2).lower() in MONTHS:
        return int(m.group(3)), MONTHS[m.group(2).lower()], int(m.group(1))
    m = re.search(r'([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', text)
    if m and m.group(1).lower() in MONTHS:
        return int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2))
    return None


def parse_investing(html_text):
    events = []
    current = None
    for row in re.split(r'(?=<tr[^>]*>)', html_text, flags=re.I):
        is_day = re.search(r'class=["\'][^"\']*\btheDay\b', row, re.I) or re.search(r'colspan', row, re.I)
        if is_day and not re.search(r'js-event-item', row, re.I):
            parsed = parse_day_header(strip_tags(row))
            if parsed:
                current = parsed
            continue
        if not re.search(r'js-event-item', row, re.I) or not current:
            continue
        cells = re.findall(r'<td[^>]*>([\s\S]*?)</td>', row, flags=re.I)
        if len(cells) < 7:
            continue
        time = strip_tags(cells[0])
        m = re.search(r'[A-Z]{3}', strip_tags(cells[1]))
        currency = m.group(0) if m else ''
        bulls = len(re.findall(r'bullishIcon', cells[2], flags=re.I))
        impact = 'High' if bulls >= 3 else ('Medium' if bulls == 2 else 'Low')
        title = strip_tags(cells[3])
        if not title:
            continue
        y, mo, d = current
        tm = re.search(r'(\d{1,2}):(\d{2})', time)
        if tm:
            date = f'{y:04d}-{mo:02d}-{d:02d}T{int(tm.group(1)):02d}:{tm.group(2)}:00+03:00'
        else:
            date = f'{y:04d}-{mo:02d}-{d:02d}T00:00:00+03:00'
        events.append({
            'title': title[:500], 'country': currency, 'date': date, 'impact': impact,
            'forecast': strip_tags(cells[5])[:500], 'previous': strip_tags(cells[6])[:500],
            'actual': strip_tags(cells[4])[:500],
        })
        if len(events) >= 2000:
            break
    return events


def fetch_investing():
    req = Request(INVESTING_URL, headers={
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
    })
    with urlopen(req, timeout=20) as response:
        html_text = response.read().decode('utf-8', errors='replace')
    if not html_text or len(html_text) < 1000:
        return None
    events = parse_investing(html_text)
    return events or None


def fetch_fair_economy():
    req = Request(FAIRECONOMY_URL, headers={'User-Agent': 'Mozilla/5.0 VALID-VX-calendar/1.0'})
    with urlopen(req, timeout=25) as response:
        raw = json.load(response)
    if not isinstance(raw, list) or not raw:
        raise ValueError('Empty or invalid calendar response; refusing to replace snapshot')
    events = []
    for item in raw:
        if not isinstance(item, dict) or not all(item.get(k) for k in ('title', 'date', 'country', 'impact')):
            continue
        events.append({k: str(item.get(k) or '') for k in ('title', 'country', 'date', 'impact', 'forecast', 'previous', 'actual')})
    if not events:
        raise ValueError('No valid events; refusing to replace snapshot')
    return events


def main():
    source = None
    events = None
    try:
        events = fetch_investing()
        if events:
            source = 'Investing.com (السعودية)'
    except Exception as exc:  # primary source unreachable (e.g. 403) -> use fallback
        print(f'Investing.com fetch failed ({exc}); trying Fair Economy fallback')
    if not events:
        events = fetch_fair_economy()
        source = 'Fair Economy / Forex Factory'
    out = {'updated_at': datetime.now(timezone.utc).isoformat(), 'source': source, 'events': events}
    path = Path(__file__).resolve().parent.parent / 'data' / 'economic-calendar.json'
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(path)
    print(f'Updated {len(events)} events from {source}')


if __name__ == '__main__':
    main()
