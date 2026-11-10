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


CCY_MAP = {'US': 'USD', 'JP': 'JPY', 'GB': 'GBP', 'UK': 'GBP', 'EU': 'EUR', 'CA': 'CAD',
           'AU': 'AUD', 'CH': 'CHF', 'NZ': 'NZD', 'CN': 'CNY', 'TR': 'TRY', 'KW': 'KWD',
           'SA': 'SAR', 'AE': 'AED', 'QA': 'QAR', 'BH': 'BHD', 'OM': 'OMR', 'EG': 'EGP',
           'JO': 'JOD', 'LB': 'LBP', 'IL': 'ILS', 'IN': 'INR', 'KR': 'KRW', 'SG': 'SGD',
           'HK': 'HKD', 'BR': 'BRL', 'MX': 'MXN', 'ZA': 'ZAR', 'SE': 'SEK', 'NO': 'NOK',
           'DK': 'DKK', 'PL': 'PLN', 'CZ': 'CZK', 'HU': 'HUF', 'RU': 'RUB', 'ID': 'IDR',
           'TH': 'THB', 'MY': 'MYR', 'PH': 'PHP', 'TW': 'TWD'}


def parse_investing(html_text):
    """Parse the current sa.investing.com datatable-v2 markup."""
    events = []
    current = None
    tb = re.search(r'<tbody[^>]*datatable-v2_body', html_text, re.I)
    scope = html_text
    if tb:
        end = html_text.find('</tbody>', tb.start())
        scope = html_text[tb.start():end + 8 if end >= 0 else len(html_text)]
    for row in re.split(r'(?=<tr[^>]*>)', scope, flags=re.I):
        if not re.search(r'datatable-v2_row', row, re.I):
            continue
        if re.search(r'colspan\s*=\s*["\']?\d+', row, re.I):
            parsed = parse_day_header(strip_tags(row))
            if parsed:
                current = parsed
            continue
        if not current:
            continue
        cells = re.findall(r'<td[^>]*>([\s\S]*?)</td>', row, flags=re.I)
        if len(cells) < 8:
            continue
        time = strip_tags(cells[1])
        m = re.search(r'data-test="flag-([A-Za-z]+)"', row)
        flag = m.group(1).upper() if m else ''
        country = CCY_MAP.get(flag, flag)
        filled = len(re.findall(r'icon-star-filled opacity-60', cells[4]))
        impact = 'High' if filled >= 3 else ('Medium' if filled == 2 else 'Low')
        event_part = cells[3].split('visible flex')[0]
        a = re.search(r'<a[^>]*>([\s\S]*?)</a>', event_part, re.I)
        title = strip_tags(a.group(1) if a else event_part)
        if not title:
            continue
        y, mo, d = current
        tm = re.search(r'(\d{1,2}):(\d{2})', time)
        if tm:
            date = f'{y:04d}-{mo:02d}-{d:02d}T{int(tm.group(1)):02d}:{tm.group(2)}:00+03:00'
        else:
            date = f'{y:04d}-{mo:02d}-{d:02d}T00:00:00+03:00'
        events.append({
            'title': title[:500], 'country': country, 'date': date, 'impact': impact,
            'forecast': strip_tags(cells[6])[:500], 'previous': strip_tags(cells[7])[:500],
            'actual': strip_tags(cells[5])[:500],
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
