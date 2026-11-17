#!/usr/bin/env python3
"""Read ARSO's regional CAP feed and publish a freshness-checked JSON snapshot.
Fail closed: never declare no warnings if parsing or fetching cannot be verified.
"""
import datetime as dt
import json
import os
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET

REGION = 'SLOVENIA_MIDDLE'
URL = ('https://meteo.arso.gov.si/uploads/probase/www/warning/text/sl/'
       'warning_SLOVENIA_MIDDLE_latest_CAP.xml')
DEST = Path(__file__).resolve().parents[1] / 'arso-warnings.json'


def local(tag):
    return tag.rsplit('}', 1)[-1]


def children(node, name):
    return [item for item in node if local(item.tag) == name]


def one(node, name):
    for child in node:
        if local(child.tag) == name:
            return (child.text or '').strip()
    return ''


def level(info):
    severity = one(info, 'severity').lower()
    level_from_severity = {'minor': 'yellow', 'moderate': 'yellow',
                           'severe': 'orange', 'extreme': 'red'}
    # Some ARSO CAP variants provide their colour via awareness_level parameter.
    for p in children(info, 'parameter'):
        if 'awareness_level' in one(p, 'valueName').lower():
            value = one(p, 'value').lower()
            m = re.search(r'(?<!\d)([1-4])(?!\d)', value)
            if m:
                return {1: None, 2: 'yellow', 3: 'orange', 4: 'red'}[int(m.group(1))]
            for name in ('red', 'orange', 'yellow', 'green'):
                if name in value:
                    return None if name == 'green' else name
    return level_from_severity.get(severity)


def iso(value):
    if not value:
        return ''
    try:
        stamp = dt.datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
        return stamp.isoformat() if stamp.tzinfo else ''
    except ValueError:
        return ''


def parse(xml_bytes):
    root = ET.fromstring(xml_bytes)
    # CAP v1.2 alert(s) may be wrapped in a collection container.
    alerts = [item for item in root.iter() if local(item.tag) == 'alert']
    if not alerts:
        raise ValueError('CAP feed has no <alert> elements; unknown format')
    records = []
    verified_infos = 0
    for alert in alerts:
        status = one(alert, 'status').lower()
        msgtype = one(alert, 'msgType').lower()
        if status and status != 'actual':
            continue
        if msgtype in ('cancel', 'error'):
            continue
        for info in children(alert, 'info'):
            # Region-specific official feed, but also check geocodes if present.
            areas = children(info, 'area')
            geocodes = [one(geo, 'value') for area in areas
                        for geo in children(area, 'geocode')]
            if geocodes and not any(REGION in code for code in geocodes):
                continue
            if one(info, 'language') and not one(info, 'language').lower().startswith('sl'):
                continue
            verified_infos += 1
            lev = level(info)
            if lev is None:
                # green / no special warnings
                continue
            onset = iso(one(info, 'onset') or one(info, 'effective'))
            expires = iso(one(info, 'expires'))
            if not onset or not expires:
                raise ValueError('CAP warning lacks valid onset/expiry')
            records.append({'level': lev, 'event': one(info, 'event')[:100],
                            'headline': one(info, 'headline')[:300],
                            'description': one(info, 'description')[:350],
                            'onset': onset, 'expires': expires})
    if verified_infos == 0:
        raise ValueError('Could not verify an info block for region')
    return records


def main():
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        req = urllib.request.Request(URL, headers={'User-Agent': 'CupraGarage/3.1 (ARSO weather warnings reader)'})
        with urllib.request.urlopen(req, timeout=18) as response:
            xml_bytes = response.read(3_000_001)
        if len(xml_bytes) > 3_000_000:
            raise ValueError('CAP response too large')
        warnings = parse(xml_bytes)
        output = {'status': 'ok', 'region': REGION, 'source': URL,
                  'fetched_at': now, 'warnings': warnings}
    except Exception as exc:
        output = {'status': 'unavailable', 'region': REGION, 'fetched_at': now,
                  'error': str(exc)[:180], 'warnings': []}
        print('WARNING:', output['error'])
    DEST.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('ARSO:', output['status'], '|', len(output['warnings']), 'warnings')
    # Exit with success so failure status can be committed and shown to user.


if __name__ == '__main__':
    main()
