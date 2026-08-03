# 근로소득 간이세액표(소득세법 시행령 별표2) PDF → assets/tax-table.js 생성기
#
# 사용법:
#   pip install pypdf
#   python tools/build-tax-table.py <간이세액표.pdf>
#
# 간이세액표는 매년 2월경 개정된다. 개정 시 국세청/법제처에서 새 별표2 PDF를 받아
# 이 스크립트를 다시 실행하고, index.html의 표기 연도와 _headers의 CSP 해시를 함께 갱신할 것.
# 원본: https://www.law.go.kr  소득세법 시행령 [별표 2]

import re
import sys
import json
import os

from pypdf import PdfReader

TOKEN = re.compile(r'\d{1,3}(?:,\d{3})*|-')
HEADER = '공제대상가족의수1234567891011'


def parse(pdf_path):
    reader = PdfReader(pdf_path)
    rows = []
    top = None

    for pageno in range(1, len(reader.pages)):
        text = reader.pages[pageno].extract_text()

        idx = text.find(HEADER)
        body = text[idx + len(HEADER):] if idx != -1 else text

        # 월급여 1,000만원 초과 구간은 별도 산식이므로 표에서 제외
        cut = body.find('10,000천원초과')
        if cut != -1:
            body = body[:cut]

        # 마지막 '10,000천원' 행(구간이 아닌 정확값)을 따로 보관
        exact = body.find('10,000천원')
        if exact != -1:
            tail = body[exact + len('10,000천원'):]
            nums = [int(t.replace(',', '')) for t in TOKEN.findall(tail) if t != '-']
            if len(nums) >= 11:
                top = nums[:11]
            body = body[:exact]

        vals = [0 if t == '-' else int(t.replace(',', '')) for t in TOKEN.findall(body)]
        for i in range(0, len(vals) - 12, 13):
            chunk = vals[i:i + 13]
            lo, hi = chunk[0], chunk[1]
            if not (hi > lo and hi - lo <= 100 and lo >= 700):
                continue
            rows.append((lo, hi, chunk[2:]))

    return rows, top


DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'


def b36(n):
    if n < 0:
        return '-' + b36(-n)
    if n == 0:
        return '0'
    out = ''
    while n:
        n, r = divmod(n, 36)
        out = DIGITS[r] + out
    return out


def encode(rows, top):
    # 전 구간이 0인 앞부분은 버린다 (세액 0)
    first = next(i for i, r in enumerate(rows) if any(r[2]))
    rows = rows[first:]

    for lo, hi, tax in rows:
        for v in tax:
            assert v % 10 == 0, '세액이 10원 단위가 아님: %d' % v
    for v in top:
        assert v % 10 == 0

    # 구간 경계: lo의 델타 (천원 단위)
    bounds = []
    prev_lo = rows[0][0]
    for lo, hi, tax in rows[1:]:
        bounds.append(lo - prev_lo)
        prev_lo = lo
    bounds.append(rows[-1][1] - prev_lo)  # 마지막 행의 hi

    # 세액: 행간 델타(1열) + 열간 델타(2~11열), 10원 단위
    lines = []
    prev_first = 0
    for lo, hi, tax in rows:
        v = [x // 10 for x in tax]
        out = [v[0] - prev_first]
        for i in range(1, 11):
            out.append(v[i] - v[i - 1])
        prev_first = v[0]
        lines.append(','.join(b36(x) for x in out))

    return {
        'from': rows[0][0],
        'bounds': ','.join(b36(x) for x in bounds),
        'data': ';'.join(lines),
        'top': top,
        'rows': len(rows),
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    rows, top = parse(sys.argv[1])
    if not rows or not top:
        print('파싱 실패: 표를 찾지 못했다')
        sys.exit(1)

    enc = encode(rows, top)
    print('구간 %d개, %d천원 ~ %d천원' % (enc['rows'], enc['from'], 10000))

    out = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'tax-table.js')
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write("'use strict';\n\n")
        f.write('/* 근로소득 간이세액표 (소득세법 시행령 별표2)\n')
        f.write(' * tools/build-tax-table.py 로 생성된 파일. 직접 수정하지 말 것.\n')
        f.write(' * 월급여액(천원, 비과세 및 학자금 제외) 구간별 · 공제대상가족수별 원천징수 세액.\n')
        f.write(' * 값은 10원 단위. bounds/data 는 base36 델타 인코딩.\n')
        f.write(' */\n\n')
        f.write('var TAX_TABLE = ')
        f.write(json.dumps({
            'from': enc['from'],
            'bounds': enc['bounds'],
            'data': enc['data'],
            'top': enc['top'],
        }, ensure_ascii=False))
        f.write(';\n\n')
        f.write("if (typeof module !== 'undefined' && module.exports) module.exports = TAX_TABLE;\n")

    print('생성:', os.path.normpath(out), '%.1f KB' % (os.path.getsize(out) / 1024))


if __name__ == '__main__':
    main()
