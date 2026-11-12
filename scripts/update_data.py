#!/usr/bin/env python3
"""Prenesi javni Cupra Garage API in posodobi data.json."""
import json
import pathlib
import time
import urllib.request

API = 'https://script.google.com/macros/s/AKfycbz-SVo5EAgJ5OtuRPjExU_SezVSRRX81LytZXfT2G-XsERzn677CKY4XsHwgW8qG3YYng/exec'
TARGET = pathlib.Path(__file__).resolve().parents[1] / 'data.json'

last_error = None
for attempt in range(3):
    try:
        request = urllib.request.Request(API, headers={'User-Agent': 'CupraGarageSync/1.0'})
        with urllib.request.urlopen(request, timeout=35) as response:
            data = json.load(response)
        if data.get('status') != 'ok' or not all(isinstance(data.get(k), list) for k in ('fuel', 'costs', 'services')):
            raise ValueError('API ni vrnil veljavnih podatkov')
        # Prepreči objavo nepričakovano velike datoteke.
        payload = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
        if len(payload.encode('utf-8')) > 2_000_000:
            raise ValueError('Prevelik odgovor API')
        TARGET.write_text(payload, encoding='utf-8')
        print('Posodobljeno:', TARGET, '| tankanja:', len(data['fuel']))
        break
    except Exception as error:
        last_error = error
        print(f'Poskus {attempt + 1} ni uspel: {error}')
        if attempt < 2:
            time.sleep(5 * (attempt + 1))
else:
    raise SystemExit(f'Sinhronizacija ni uspela: {last_error}')
