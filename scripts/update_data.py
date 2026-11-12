#!/usr/bin/env python3
"""Posodobi javne podatke Cupra Garage iz Google Apps Script JSONP API-ja."""
import json
import pathlib
import time
import urllib.request

API = (
    'https://script.google.com/macros/s/'
    'AKfycbz-SVo5EAgJ5OtuRPjExU_SezVSRRX81LytZXfT2G-XsERzn677CKY4XsHwgW8qG3YYng'
    '/exec?callback=cupraSync'
)
TARGET = pathlib.Path(__file__).resolve().parents[1] / 'data.json'

last_error = None
for attempt in range(3):
    try:
        request = urllib.request.Request(API, headers={'User-Agent': 'Mozilla/5.0 CupraGarageSync/1.0'})
        with urllib.request.urlopen(request, timeout=35) as response:
            raw = response.read().decode('utf-8-sig').strip()

        prefix = 'cupraSync('
        if not raw.startswith(prefix):
            raise ValueError(f'Nepričakovan odgovor API-ja: {raw[:200]!r}')

        payload = raw[len(prefix):].rstrip(';').strip()
        if not payload.endswith(')'):
            raise ValueError('Neveljaven JSONP odgovor')
        data = json.loads(payload[:-1])

        if not isinstance(data, dict) or data.get('status') != 'ok' or not all(
            isinstance(data.get(key), list) for key in ('fuel', 'costs', 'services')
        ):
            raise ValueError('API ni vrnil veljavnih podatkov')

        output = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
        if len(output.encode('utf-8')) > 2_000_000:
            raise ValueError('Prevelik odgovor API-ja')
        TARGET.write_text(output, encoding='utf-8')
        print(f'Posodobljeno: {TARGET}; tankanj: {len(data["fuel"])}')
        break
    except Exception as error:
        last_error = error
        print(f'Poskus {attempt + 1} ni uspel: {error}')
        if attempt < 2:
            time.sleep(5 * (attempt + 1))
else:
    raise SystemExit(f'Sinhronizacija ni uspela: {last_error}')
