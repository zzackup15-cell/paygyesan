# -*- coding: utf-8 -*-
"""국세청 근로소득 백분위(천분위) CSV → public/assets/income-table.js

    python tools/build-income-table.py

원자료는 data/income-percentile-2024.csv 이고 공공데이터포털에서 받는다.
    https://www.data.go.kr/data/15082063/fileData.do

CSV 는 109개 구간으로 되어 있다. 상위 0.1~1.0% 는 0.1% 단위(10개),
그 아래는 1% 단위(99개)다. 각 행의 '구분' 은 그 구간의 누적 상한이다.
예를 들어 '상위 2%' 는 상위 1% 부터 2% 까지의 1% 구간을 뜻한다.

총급여 단위는 억원이다. 국세청이 발표한 평균 총급여액과 대조해 확인했다.
"""

import csv
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'income-percentile-2024.csv')
OUT = os.path.join(ROOT, 'public', 'assets', 'income-table.js')

YEAR = 2024  # 귀속연도
EOK = 100000000  # 억


def load():
    with io.open(SRC, 'rb') as f:
        raw = f.read()
    for enc in ('cp949', 'utf-8-sig', 'utf-8'):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise SystemExit('CSV 인코딩을 알 수 없다')

    rows = []
    for row in csv.reader(io.StringIO(text)):
        if not row or not row[0].strip():
            continue
        m = re.search(r'([\d.]+)\s*%', row[0])
        if not m:
            continue  # 헤더
        rows.append({
            'cum': float(m.group(1)),      # 누적 상한 (%)
            'people': int(row[1]),
            'pay_eok': int(row[2]),
        })
    return rows


def main():
    rows = load()
    if len(rows) != 109:
        raise SystemExit('구간 수가 109가 아니다: %d' % len(rows))

    total_people = sum(r['people'] for r in rows)
    total_pay = sum(r['pay_eok'] for r in rows) * EOK
    avg = total_pay / total_people

    bands = []
    prev_cum = 0.0
    prev_avg = None
    for r in rows:
        band_avg = int(round(r['pay_eok'] * EOK / r['people']))
        if prev_avg is not None and band_avg > prev_avg:
            raise SystemExit('구간 평균이 단조 감소하지 않는다: %s' % r)
        # 구간의 가운데 백분위. 구간 평균을 그 지점의 대표값으로 본다.
        mid = (prev_cum + r['cum']) / 2.0
        bands.append((round(mid, 4), band_avg))
        prev_cum = r['cum']
        prev_avg = band_avg

    if abs(prev_cum - 100.0) > 1e-9:
        raise SystemExit('누적이 100%% 가 아니다: %s' % prev_cum)

    lines = [
        "'use strict';",
        '',
        '/* 근로소득 백분위 (국세청, %d년 귀속) — 생성 파일. 직접 수정하지 말 것.' % YEAR,
        ' *',
        ' *   python tools/build-income-table.py',
        ' *',
        ' * 원자료: 공공데이터포털 「국세청_근로소득 백분위(천분위) 자료」',
        ' * 109개 구간. 상위 0.1~1.0%% 는 0.1%% 단위, 그 아래는 1%% 단위.',
        ' *',
        ' * bands 의 각 항목은 [구간 가운데 백분위, 그 구간의 1인 평균 총급여].',
        ' * 원자료가 구간별 인원과 총급여 합계만 주기 때문에 경계 금액이 아니라',
        ' * 구간 평균을 쓴다. 따라서 결과는 추정치이며 화면에도 그렇게 밝힌다.',
        ' */',
        'var INCOME_TABLE = {',
        '  year: %d,' % YEAR,
        "  source: '국세청 근로소득 백분위(천분위) 자료',",
        '  people: %d,' % total_people,
        '  averagePay: %d,' % int(round(avg)),
        '  bands: [',
    ]
    for i in range(0, len(bands), 4):
        chunk = bands[i:i + 4]
        lines.append('    ' + ', '.join('[%s,%d]' % (repr(c[0]), c[1]) for c in chunk) + ',')
    lines[-1] = lines[-1].rstrip(',')
    lines += [
        '  ]',
        '};',
        '',
        "if (typeof module !== 'undefined' && module.exports) module.exports = INCOME_TABLE;",
        '',
    ]

    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))

    size = os.path.getsize(OUT)
    sys.stdout.reconfigure(encoding='utf-8')
    print('생성: %s (%.1f KB)' % (os.path.relpath(OUT, ROOT), size / 1024.0))
    print('  구간 %d개 · 인원 %s명 · 평균 총급여 %s원'
          % (len(bands), format(total_people, ','), format(int(round(avg)), ',')))
    print('  상위 0.05%% 평균 %s원 / 최하위 구간 평균 %s원'
          % (format(bands[0][1], ','), format(bands[-1][1], ',')))


if __name__ == '__main__':
    main()
