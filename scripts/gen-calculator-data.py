"""
통신사 요금 계산기 Excel (개발자용 + 상담원용 대화형 계산기)
출처: docs/calculator.html D 객체 (2026-04-21)
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
import os, shutil

OUT = '/Users/vinsenzo/bongi-mobile/docs/bongi-calculator-data.xlsx'
SCRIPT_OUT = '/Users/vinsenzo/bongi-mobile/scripts/gen-calculator-data.py'

# ─── 데이터 (calculator.html D 객체 사본) ───
SKT_TVS = [
    ['TV 없음', 0, 0, 0],
    ['B tv 이코노미', 182, 12100, 2200],
    ['B tv 스탠다드', 236, 15400, 2200],
    ['B tv 올', 252, 18700, 2200],
    ['B tv 스탠다드 플러스', 222, 23100, 2200],
    ['B tv 올 플러스', 252, 24200, 2200],
    ['B tv 스탠다드 넷플릭스', 222, 27700, 2200],
    ['B tv 올 넷플릭스', 222, 30200, 2200],
    ['B tv 스탠다드 넷플릭스 프리미엄', 252, 30700, 2200],
    ['B tv 올 넷플릭스 프리미엄', 252, 33200, 2200],
]
KT_TVS = [
    ['TV 없음', 0, 0, 0],
    ['지니TV 베이직', 238, 14740, 2640],
    ['지니TV 라이트', 240, 15840, 2640],
    ['지니TV 에센스', 263, 20240, 3740],
    ['지니TV 모든G', 250, 21340, 4400],
    ['지니TV 디즈니+모든G', 250, 28100, 6600],
]
LGU_TVS = [
    ['TV 없음', 0, 0, 0],
    ['U+tv 실속형', 217, 15400, 2200],
    ['U+tv 기본형', 223, 16500, 2200],
    ['U+tv 프리미엄', 252, 18700, 2200],
    ['U+tv 프리미엄 VOD', 257, 24200, 5500],
]

# ─── 스타일 ───
HEAD_FONT = Font(name='Noto Sans KR', size=11, bold=True, color='ffffff')
BODY_FONT = Font(name='Noto Sans KR', size=10)
MONO = Font(name='SF Mono', size=10)
BORDER = Border(
    left=Side(style='thin', color='cccccc'), right=Side(style='thin', color='cccccc'),
    top=Side(style='thin', color='cccccc'), bottom=Side(style='thin', color='cccccc'),
)
HEAD_FILL = PatternFill('solid', fgColor='1a2744')
SKT_FILL = PatternFill('solid', fgColor='fef2f2')
KT_FILL = PatternFill('solid', fgColor='eff6ff')
LGU_FILL = PatternFill('solid', fgColor='fdf2f8')
INPUT_FILL = PatternFill('solid', fgColor='fef3c7')

def head(c):
    c.fill = HEAD_FILL; c.font = HEAD_FONT
    c.alignment = Alignment(horizontal='center', vertical='center')
    c.border = BORDER

def body(c, fill=None):
    c.font = BODY_FONT; c.border = BORDER
    c.alignment = Alignment(vertical='center')
    if fill: c.fill = fill

def table(ws, r, headers, rows, fill=None):
    for i, h in enumerate(headers):
        head(ws.cell(row=r, column=i+1, value=h))
    for ri, row in enumerate(rows):
        for ci, v in enumerate(row):
            body(ws.cell(row=r+1+ri, column=ci+1, value=v), fill)
    return r + 1 + len(rows)

def title(ws, r, t, color='1a2744'):
    c = ws.cell(row=r, column=1, value=t)
    c.font = Font(name='Noto Sans KR', size=14, bold=True, color=color)
    ws.row_dimensions[r].height = 24
    return r + 2

wb = openpyxl.Workbook()

# ═══════════════════════════════════════════════
# INDEX
# ═══════════════════════════════════════════════
idx = wb.active
idx.title = 'INDEX'
idx.column_dimensions['A'].width = 30
idx.column_dimensions['B'].width = 60
idx.column_dimensions['C'].width = 15

idx['A1'] = '🧮 봉이모바일 — 통신 3사 요금 계산기 Excel'
idx['A1'].font = Font(name='Noto Sans KR', size=18, bold=True, color='1a2744')
idx.merge_cells('A1:C1')
idx['A2'] = '출처: docs/calculator.html D 객체 · 2026-04-21'
idx['A2'].font = Font(name='Noto Sans KR', size=11, color='666666', italic=True)
idx.merge_cells('A2:C2')

r = title(idx, 4, '📋 시트 구조')
sheets_info = [
    ['🧮 CALC', '대화형 계산기 (3사 통합 · 드롭다운 선택)', '★ 메인'],
    ['01_Internet', '인터넷 단독 요금 (속도별)', '데이터'],
    ['02_TV', 'TV 상품 (채널/가격/결합할인)', '데이터'],
    ['03_TV_Internet', 'TV 결합 시 인터넷 요금 (WiFi 유/무)', '데이터'],
    ['04_SetTop', '셋톱박스 옵션', '데이터'],
    ['05_WiFi', 'WiFi 옵션', '데이터'],
    ['06_Install', '설치비', '데이터'],
    ['07_Gift', '사은품 (속도 × TV결합)', '데이터'],
    ['08_Cards', '제휴카드', '데이터'],
    ['10_SKT_Bundle', 'SKT 요즘가족결합 (15조합)', '결합'],
    ['11_KT_Total', 'KT 총액결합 (6구간)', '결합'],
    ['12_KT_Fixed', 'KT 정액결합 (4구간)', '결합'],
    ['13_KT_Premium', 'KT 💎 프리미엄 가족결합', '결합'],
    ['14_LGU_Chweyswun', 'LG U+ 참쉬운 가족결합', '결합'],
    ['15_LGU_Together', 'LG U+ 투게더 결합', '결합'],
    ['20_Schema', 'TypeScript 인터페이스', '개발'],
    ['30_CALC_Formula', '계산 공식 + 결합할인 분기', '개발'],
]
r = table(idx, r, ['시트명', '내용', '분류'], sheets_info)

r += 2
c = idx.cell(row=r, column=1, value='⚡ 대화형 계산기 사용법')
c.font = Font(name='Noto Sans KR', size=13, bold=True, color='ef4444')
idx.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
r += 1
for line in [
    '1. 🧮 CALC 시트로 이동',
    '2. 노란 셀 클릭 → 드롭다운에서 선택 (통신사/속도/TV/WiFi/결합/회선)',
    '3. 하단에 자동 계산 결과 (기본요금 · 결합할인 · 혜택가)',
    '4. 통신사별 결합할인 방식:',
    '   · SKT 요즘가족결합 → 단독가 REPLACE (요즘우리집 대체)',
    '   · KT 총액결합 → 기본 TV결합 + 총액 STACK (중복)',
    '   · LG U+ 참쉬운 → 단독가 REPLACE',
]:
    c = idx.cell(row=r, column=1, value=line)
    c.font = BODY_FONT
    idx.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    r += 1

# ═══════════════════════════════════════════════
# 🧮 CALC (대화형 계산기 — 통합 · 통신사 선택 방식)
# ═══════════════════════════════════════════════
ws = wb.create_sheet('🧮 CALC')
for col, w in zip('ABCDE', [28, 34, 14, 14, 30]):
    ws.column_dimensions[col].width = w

c = ws.cell(row=1, column=1, value='🧮 통신 3사 요금 계산기')
c.font = Font(name='Noto Sans KR', size=18, bold=True, color='ffffff')
c.fill = HEAD_FILL
c.alignment = Alignment(horizontal='center', vertical='center')
ws.merge_cells('A1:E1')
ws.row_dimensions[1].height = 36

r = 3
c = ws.cell(row=r, column=1, value='📝 입력 (노란 셀 클릭 → 드롭다운)')
c.font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
r += 1

# 입력 셀: B4~B10
INPUTS = [
    (r, '통신사',       'SKT',    ['SKT', 'KT', 'LG U+']),
    (r+1, '속도',        '500M',   ['100M', '500M', '1G']),
    (r+2, 'TV 상품',     'B tv 올', None),  # 동적 (통신사별)
    (r+3, 'WiFi 사용',   'N',      ['Y', 'N']),
    (r+4, '결합 종류',   '요즘가족결합', None),  # 동적
    (r+5, '휴대폰 회선수', 3,       ['0','1','2','3','4','5']),
    (r+6, 'KT 합산구간 / LGU 요금구간 (해당 시)', 3, ['1','2','3','4','5','6']),
]

for row_num, label, default, opts in INPUTS:
    ws.cell(row=row_num, column=1, value=label).font = Font(name='Noto Sans KR', size=11, bold=True)
    ic = ws.cell(row=row_num, column=2, value=default)
    ic.font = Font(name='SF Mono', size=12, bold=True, color='92400e')
    ic.fill = INPUT_FILL
    ic.border = BORDER
    ic.alignment = Alignment(horizontal='center', vertical='center')
    if opts:
        dv = DataValidation(type='list', formula1=f'"{",".join(opts)}"', allow_blank=False)
        ws.add_data_validation(dv); dv.add(ic)
    hint = ws.cell(row=row_num, column=3, value='← 클릭')
    hint.font = Font(name='Noto Sans KR', size=10, italic=True, color='d97706')

# TV 상품 동적 힌트 — 통신사별 드롭다운은 모든 상품 합친 리스트로
all_tvs = [t[0] for t in SKT_TVS] + [t[0] for t in KT_TVS[1:]] + [t[0] for t in LGU_TVS[1:]]
tv_dv_str = ','.join(all_tvs)
dv_tv = DataValidation(type='list', formula1=f'"{tv_dv_str}"', allow_blank=False)
ws.add_data_validation(dv_tv)
dv_tv.add(ws.cell(row=6, column=2))

bundle_opts = ['요즘가족결합','총액결합','정액결합','프리미엄 가족결합','참쉬운 가족결합','투게더','결합없음']
dv_b = DataValidation(type='list', formula1=f'"{",".join(bundle_opts)}"', allow_blank=False)
ws.add_data_validation(dv_b)
dv_b.add(ws.cell(row=8, column=2))

# 입력 힌트 설명
r = 12
ws.cell(row=r, column=1, value='ℹ️ 통신사별 결합 안내').font = Font(name='Noto Sans KR', size=10, bold=True, color='666666')
r += 1
hints = [
    'SKT: 요즘가족결합 (1~5회선) — 단독가 REPLACE + 휴대폰 별도 차감',
    'KT: 총액/정액결합 (구간 1~6, 1~4) — 기본 TV결합 + STACK 중복',
    'KT: 프리미엄 가족결합 — 77K+ 2회선 이상 (별도 계산)',
    'LG U+: 참쉬운(2~4회선) — 요금구간(1=69K-, 2=69K+, 3=88K+) + 단독가 REPLACE',
    'LG U+: 투게더 — 85K+ 고가요금제, 500M+ 전용 (100M 불가)',
]
for h in hints:
    c = ws.cell(row=r, column=1, value='• ' + h)
    c.font = Font(name='Noto Sans KR', size=9, color='666666')
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
    r += 1

# ─── 자동 계산 섹션 ───
r += 1
c = ws.cell(row=r, column=1, value='🧮 자동 계산 (수식)')
c.font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
r += 1

# 모든 TV 리스트 VLOOKUP 테이블 (숨김 영역 H~L 열)
def write_hidden_lookup():
    """숨김 영역 (column G~J): 전체 TV 데이터 통합"""
    # G: carrier, H: tv name, I: p, J: dc
    ws.cell(row=1, column=7, value='carrier'); ws.cell(row=1, column=8, value='tv_name')
    ws.cell(row=1, column=9, value='p'); ws.cell(row=1, column=10, value='dc')
    row = 2
    for t in SKT_TVS:
        ws.cell(row=row, column=7, value='SKT'); ws.cell(row=row, column=8, value=t[0])
        ws.cell(row=row, column=9, value=t[2]); ws.cell(row=row, column=10, value=t[3]); row += 1
    for t in KT_TVS:
        ws.cell(row=row, column=7, value='KT'); ws.cell(row=row, column=8, value=t[0])
        ws.cell(row=row, column=9, value=t[2]); ws.cell(row=row, column=10, value=t[3]); row += 1
    for t in LGU_TVS:
        ws.cell(row=row, column=7, value='LG U+'); ws.cell(row=row, column=8, value=t[0])
        ws.cell(row=row, column=9, value=t[2]); ws.cell(row=row, column=10, value=t[3]); row += 1
    # 숨김 컬럼
    for col in 'GHIJ':
        ws.column_dimensions[col].hidden = True
    return row - 1

lookup_end = write_hidden_lookup()

# 계산 로직 (수식)
CARRIER = 'B4'; SP = 'B5'; TVNAME = 'B6'; WIFI = 'B7'; BUNDLE = 'B8'; LINES = 'B9'; RANGE_IDX = 'B10'

def frow(r_, label, formula, fill=None, bold=False, color=None):
    ws.cell(row=r_, column=1, value=label).font = Font(name='Noto Sans KR', size=10, bold=bold)
    c = ws.cell(row=r_, column=2, value=formula)
    c.font = Font(name='SF Mono', size=11, bold=bold, color=color or '1a2744')
    c.border = BORDER
    c.alignment = Alignment(horizontal='right')
    c.number_format = '#,##0"원"'
    if fill: c.fill = fill
    return r_ + 1

# 단독가
r = frow(r, '인터넷 단독가',
    f'=IF({SP}="100M",22000,IF({SP}="500M",33000,38500))')

# TV 가격 (VLOOKUP by carrier + tv_name) — SUMPRODUCT로 두 조건 매칭
r = frow(r, 'TV 가격 (p)',
    f'=IFERROR(SUMPRODUCT(($G$2:$G${lookup_end}={CARRIER})*($H$2:$H${lookup_end}={TVNAME})*($I$2:$I${lookup_end})),0)')
TV_P = r - 1

r = frow(r, 'TV 결합할인 (dc)',
    f'=IFERROR(SUMPRODUCT(($G$2:$G${lookup_end}={CARRIER})*($H$2:$H${lookup_end}={TVNAME})*($J$2:$J${lookup_end})),0)')
TV_DC = r - 1

r = frow(r, 'TV 선택 여부',
    f'=IF({TVNAME}="TV 없음",0,1)')
HAS_TV = r - 1

# WiFi 추가금
r = frow(r, 'WiFi 추가금 (속도별)',
    f'=IF({WIFI}="N",0,IF({CARRIER}="SKT",1100,IF({CARRIER}="KT",IF({SP}="1G",0,1100),0)))')
WIFI_FEE = r - 1

# tvInternetNoWifi
r = frow(r, 'tvInternetNoWifi',
    f'=IF({CARRIER}="SKT",IF({SP}="100M",19800,IF({SP}="500M",27500,33000)),'
    f'IF({CARRIER}="KT",IF({SP}="100M",22000,IF({SP}="500M",27500,33000)),'
    f'IF({SP}="100M",22000,IF({SP}="500M",27500,33000))))')
TV_INET_NO = r - 1

r = frow(r, 'tvInternetWithWifi',
    f'=IF({CARRIER}="SKT",IF({SP}="100M",22000,IF({SP}="500M",28600,34100)),'
    f'IF({CARRIER}="KT",IF({SP}="100M",23100,IF({SP}="500M",28600,33000)),'
    f'IF({SP}="100M",22000,IF({SP}="500M",27500,33000))))')
TV_INET_WITH = r - 1

# 셋톱 (3사 모두 4,400)
r = frow(r, '셋톱박스 (기본)', '=4400')
SETTOP = r - 1

r += 1
# ─── 경로 A: 결합없음/기본 TV 결합 ───
c = ws.cell(row=r, column=1, value='【경로 A】 결합없음 / 기본 TV 결합만')
c.font = Font(name='Noto Sans KR', size=11, bold=True, color='666666')
r += 1

r = frow(r, '  기본 월요금',
    f'=IF(B{HAS_TV}=0,B{r-2-4}+B{WIFI_FEE},IF({WIFI}="Y",B{TV_INET_WITH},B{TV_INET_NO})+(B{TV_P}-B{TV_DC})+B{SETTOP})',
    None, True)
PATH_A = r - 1

r += 1
# ─── 경로 B: 결합할인 적용 ───
c = ws.cell(row=r, column=1, value='【경로 B】 휴대폰 결합 할인 적용')
c.font = Font(name='Noto Sans KR', size=11, bold=True, color='ef4444')
r += 1

# SKT 요즘가족결합 인터넷 할인
r = frow(r, '  [SKT] 요즘가족 인터넷 할인',
    f'=IF(AND({CARRIER}="SKT",{BUNDLE}="요즘가족결합",{LINES}>0),'
    f'IF({SP}="100M",4400,IF({SP}="500M",11000,13200)),0)')
SKT_FAM_INET = r - 1

r = frow(r, '  [SKT] IPTV 추가 (TV결합 시)',
    f'=IF(AND({CARRIER}="SKT",{BUNDLE}="요즘가족결합",{LINES}>0,B{HAS_TV}=1),1100,0)')
SKT_FAM_IPTV = r - 1

r = frow(r, '  [SKT] 휴대폰 인당 할인',
    f'=IF(AND({CARRIER}="SKT",{BUNDLE}="요즘가족결합",{LINES}>0),'
    f'IF({SP}="100M",CHOOSE({LINES},3500,3500,6000,4500,3600),CHOOSE({LINES},3500,3500,6000,6000,4800)),0)')
SKT_MOB_PER = r - 1

r = frow(r, '  [SKT] 휴대폰 총 할인',
    f'=B{SKT_MOB_PER}*IF(AND({CARRIER}="SKT",{BUNDLE}="요즘가족결합"),{LINES},0)')
SKT_MOB_TOTAL = r - 1

# KT 총액결합 (STACK)
r = frow(r, '  [KT] 총액결합 인터넷 할인',
    f'=IF(AND({CARRIER}="KT",{BUNDLE}="총액결합"),'
    f'IF({SP}="100M",CHOOSE({RANGE_IDX},1650,3300,5500,5500,5500,5500),'
    f'CHOOSE({RANGE_IDX},2200,5500,5500,5500,5500,5500)),0)')
KT_TOTAL_INET = r - 1

r = frow(r, '  [KT] 총액결합 휴대폰 할인',
    f'=IF(AND({CARRIER}="KT",{BUNDLE}="총액결합"),'
    f'IF({SP}="100M",CHOOSE({RANGE_IDX},0,0,3300,14300,18700,23100),'
    f'CHOOSE({RANGE_IDX},0,0,5500,16610,22110,27610)),0)')
KT_TOTAL_MOB = r - 1

# LGU+ 참쉬운
r = frow(r, '  [LGU+] 참쉬운 인터넷 할인',
    f'=IF(AND({CARRIER}="LG U+",{BUNDLE}="참쉬운 가족결합",{LINES}>=2),'
    f'IF({SP}="100M",5500,IF({SP}="500M",9900,13200)),0)')
LGU_CHW_INET = r - 1

r = frow(r, '  [LGU+] 참쉬운 휴대폰 인당 할인',
    f'=IF(AND({CARRIER}="LG U+",{BUNDLE}="참쉬운 가족결합",{LINES}>=2),'
    f'CHOOSE({RANGE_IDX},CHOOSE(MIN({LINES},4)-1,2200,3300,4400),'
    f'CHOOSE(MIN({LINES},4)-1,3300,5500,6600),'
    f'CHOOSE(MIN({LINES},4)-1,4400,6600,8800)),0)')
LGU_MOB_PER = r - 1

r = frow(r, '  [LGU+] 참쉬운 휴대폰 총 할인',
    f'=B{LGU_MOB_PER}*IF(AND({CARRIER}="LG U+",{BUNDLE}="참쉬운 가족결합"),MIN({LINES},4),0)')
LGU_MOB_TOTAL = r - 1

r += 1
# ─── 결합 적용 월요금 (조건부 재계산) ───
c = ws.cell(row=r, column=1, value='💰 결합 적용 월요금')
c.font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
r += 1

# 통신사 & 결합 종류별 분기
# SKT REPLACE: 단독가 - inet할인 + (tvP - tvDc - iptv) + setTop
# KT STACK: tvInternet(wifi) + (tvP-tvDc) + setTop - totalInet
# LGU REPLACE: 단독가 - chw할인 + (tvP - tvDc) + setTop
# 결합없음: Path A 그대로

formula_bundle_fee = (
    f'=IF({BUNDLE}="결합없음",B{PATH_A},'
    # SKT 요즘가족: 단독가 REPLACE
    f'IF(AND({CARRIER}="SKT",{BUNDLE}="요즘가족결합"),'
    f'(B{r-2-11}+B{WIFI_FEE}-B{SKT_FAM_INET})+IF(B{HAS_TV}=1,B{TV_P}-B{TV_DC}-B{SKT_FAM_IPTV},0)+IF(B{HAS_TV}=1,B{SETTOP},0),'
    # KT 총액: 기본 TV결합 STACK
    f'IF(AND({CARRIER}="KT",{BUNDLE}="총액결합"),'
    f'(IF(B{HAS_TV}=0,B{r-2-11}+B{WIFI_FEE},IF({WIFI}="Y",B{TV_INET_WITH},B{TV_INET_NO}))-B{KT_TOTAL_INET})+IF(B{HAS_TV}=1,B{TV_P}-B{TV_DC},0)+IF(B{HAS_TV}=1,B{SETTOP},0),'
    # LGU+ 참쉬운: 단독가 REPLACE
    f'IF(AND({CARRIER}="LG U+",{BUNDLE}="참쉬운 가족결합"),'
    f'(B{r-2-11}+B{WIFI_FEE}-B{LGU_CHW_INET})+IF(B{HAS_TV}=1,B{TV_P}-B{TV_DC},0)+IF(B{HAS_TV}=1,B{SETTOP},0),'
    # 기타 (프리미엄/투게더/정액): Path A 기준 + 요약값 (차후 확장)
    f'B{PATH_A}'
    f'))))'
)

# 단독가 위치 찾기: 인터넷 단독가는 첫 자동계산 행 = r - 2 - 11... 복잡하니 명시적 계산
# 인터넷 단독가 = (PATH_A 블록 위 첫 cell) = the first calc row
# Let me refetch: the first frow wrote 인터넷 단독가 at (initial r of 자동계산), which we didn't track.
# Actually track it:

# Rewrite with tracked SOLO_INET cell
# I'll refactor below

# 이미 만든 셀들의 위치는 아래와 같음:
# 인터넷 단독가 = 맨 처음 frow 호출 (row before TV_P)
SOLO_INET = TV_P - 1

formula_bundle_fee = (
    f'=IF({BUNDLE}="결합없음",B{PATH_A},'
    f'IF(AND({CARRIER}="SKT",{BUNDLE}="요즘가족결합"),'
    f'(B{SOLO_INET}+B{WIFI_FEE}-B{SKT_FAM_INET})+IF(B{HAS_TV}=1,B{TV_P}-B{TV_DC}-B{SKT_FAM_IPTV}+B{SETTOP},0),'
    f'IF(AND({CARRIER}="KT",{BUNDLE}="총액결합"),'
    f'IF(B{HAS_TV}=0,B{SOLO_INET}+B{WIFI_FEE}-B{KT_TOTAL_INET},(IF({WIFI}="Y",B{TV_INET_WITH},B{TV_INET_NO})-B{KT_TOTAL_INET})+(B{TV_P}-B{TV_DC})+B{SETTOP}),'
    f'IF(AND({CARRIER}="LG U+",{BUNDLE}="참쉬운 가족결합"),'
    f'(B{SOLO_INET}+B{WIFI_FEE}-B{LGU_CHW_INET})+IF(B{HAS_TV}=1,B{TV_P}-B{TV_DC}+B{SETTOP},0),'
    f'B{PATH_A}'
    f'))))'
)

r = frow(r, '  인터넷+TV 월 실납부 (결합 적용)', formula_bundle_fee, None, True)
BUNDLE_FEE = r - 1

# 휴대폰 고지서 별도 할인 (SKT + LGU+ 참쉬운) or KT 총액 (휴대폰)
r = frow(r, '  - 휴대폰 고지서 별도 차감',
    f'=-(B{SKT_MOB_TOTAL}+B{KT_TOTAL_MOB}+B{LGU_MOB_TOTAL})')
MOB_SIDE = r - 1

r = frow(r, '  🎉 혜택가 (최종 월요금)',
    f'=B{BUNDLE_FEE}-(B{SKT_MOB_TOTAL}+B{KT_TOTAL_MOB}+B{LGU_MOB_TOTAL})',
    INPUT_FILL, True, 'ef4444')
c = ws.cell(row=r-1, column=2)
c.font = Font(name='SF Mono', size=16, bold=True, color='ef4444')
c.number_format = '#,##0"원"'

r += 1
# ─── 부가 ───
c = ws.cell(row=r, column=1, value='🎁 부가 (참고)')
c.font = Font(name='Noto Sans KR', size=11, bold=True, color='666666')
r += 1
r = frow(r, '  설치비 (1회성)',
    f'=IF({CARRIER}="KT",IF(B{HAS_TV}=0,36000,56200),IF(B{HAS_TV}=0,36300,56100))')
r = frow(r, '  사은품',
    f'=IF({CARRIER}="SKT",IF(B{HAS_TV}=0,IF({SP}="100M",110000,170000),CHOOSE(MATCH({SP},{{"100M","500M","1G"}},0),400000,430000,490000)),'
    f'IF({CARRIER}="KT",IF(B{HAS_TV}=0,IF({SP}="100M",90000,140000),CHOOSE(MATCH({SP},{{"100M","500M","1G"}},0),370000,450000,450000)),'
    f'IF(B{HAS_TV}=0,IF({SP}="100M",200000,230000),CHOOSE(MATCH({SP},{{"100M","500M","1G"}},0),400000,470000,470000))))')

# ═══════════════════════════════════════════════
# 데이터 시트들 (간결하게)
# ═══════════════════════════════════════════════
ws = wb.create_sheet('01_Internet')
for col in 'ABCDE': ws.column_dimensions[col].width = 16
r = title(ws, 1, '📡 인터넷 단독 요금 (3사 공통)')
r = table(ws, r, ['통신사', '프리픽스', '100M', '500M', '1G'], [
    ['SKT', 'SK', 22000, 33000, 38500],
    ['KT', 'KT', 22000, 33000, 38500],
    ['LG U+', 'LG', 22000, 33000, 38500],
])

ws = wb.create_sheet('02_TV')
for col, w in zip('ABCDEFG', [10, 40, 10, 12, 12, 12, 15]):
    ws.column_dimensions[col].width = w
r = title(ws, 1, '📺 TV 상품 (3사 전체)')
tv_all = []
for c_name, tvs, fill in [('SKT', SKT_TVS, SKT_FILL), ('KT', KT_TVS, KT_FILL), ('LG U+', LGU_TVS, LGU_FILL)]:
    for t in tvs[1:]:
        tv_all.append([c_name, t[0], t[1], t[2], t[3], t[2]-t[3]])
r = table(ws, r, ['통신사', 'TV 상품', '채널수', 'TV 단독', '결합할인', '인터넷 결합 시'], tv_all)

ws = wb.create_sheet('03_TV_Internet')
for col in 'ABCDE': ws.column_dimensions[col].width = 16
r = title(ws, 1, '🔗 TV 결합 시 인터넷 요금 (WiFi 유/무)')
r = table(ws, r, ['통신사', 'WiFi 유무', '100M', '500M', '1G'], [
    ['SKT', 'WiFi 미포함', 19800, 27500, 33000],
    ['SKT', 'WiFi 포함', 22000, 28600, 34100],
    ['KT', 'WiFi 미포함', 22000, 27500, 33000],
    ['KT', 'WiFi 포함 (1G=동일)', 23100, 28600, 33000],
    ['LG U+', '모든 속도 동일', 22000, 27500, 33000],
])

ws = wb.create_sheet('04_SetTop')
for col, w in zip('ABCDEF', [10, 20, 28, 12, 10, 10]):
    ws.column_dimensions[col].width = w
r = title(ws, 1, '📦 셋톱박스 옵션')
settops = [
    ['SKT','smart3','스마트3',4400,'O','O'],
    ['SKT','smart3-mini','스마트3 미니',4400,'X','O'],
    ['SKT','ai-nugu','AI NUGU',6600,'X','O'],
    ['SKT','sound-max','사운드 맥스',8800,'X','O'],
    ['SKT','apple-tv','애플TV',6600,'X','O'],
    ['KT','genie-3','기가지니3',4400,'O','O'],
    ['KT','genie-a','기가지니A',3300,'X','O'],
    ['KT','soundbar','지니TV 올인원 사운드바',8800,'X','O'],
    ['LG U+','uhd4','U+tv UHD4',4400,'O','O'],
    ['LG U+','soundbar-black','U+tv 사운드바 블랙',6600,'X','O'],
]
r = table(ws, r, ['통신사','ID','모델명','월 임대료','기본','활성'], settops)

ws = wb.create_sheet('05_WiFi')
for col, w in zip('ABCDEFGH', [10, 20, 28, 12, 12, 12, 10, 10]):
    ws.column_dimensions[col].width = w
r = title(ws, 1, '📡 WiFi 옵션')
wifis = [
    ['SKT','giga-wifi','GIGA WiFi',1100,1100,1100,'O','O'],
    ['SKT','giga-wifi-6','GIGA WiFi 6',1100,1100,1100,'X','O'],
    ['SKT','giga-wifi-prem','GIGA WiFi 프리미엄',5500,5500,5500,'X','O'],
    ['SKT','wings','윙즈',1650,1650,1650,'X','O'],
    ['KT','wave2','KT GIGA WAVE2',1100,1100,0,'O','O'],
    ['KT','home-ax','GIGA WIFI 홈AX',0,1100,0,'X','O'],
    ['KT','buddy','GIGA WIFI BUDDY',1650,1650,1650,'X','O'],
    ['KT','prem-24','GIGA WIFI 프리미엄 2.4',4400,4400,4400,'X','O'],
    ['KT','prem-24-6e','GIGA WIFI 프리미엄 2.4 (6E)',4400,4400,4400,'X','O'],
    ['KT','prem-48','GIGA WIFI 프리미엄 4.8',4400,4400,4400,'X','O'],
    ['LG U+','giga-wifi','기가와이파이',0,0,0,'O','O'],
    ['LG U+','giga-wifi-6','기가와이파이6',0,0,0,'X','O'],
    ['LG U+','giga-wifi-mesh','기가와이파이 메쉬',0,0,0,'X','O'],
]
r = table(ws, r, ['통신사','ID','모델명','100M','500M','1G','기본','활성'], wifis)

ws = wb.create_sheet('06_Install')
for col in 'ABCD': ws.column_dimensions[col].width = 18
r = title(ws, 1, '🔧 설치비')
r = table(ws, r, ['통신사','단독 (solo)','결합 (combo)','비고'], [
    ['SKT',36300,56100,'주말 +25%'],
    ['KT',36000,56200,'주말 +25%'],
    ['LG U+',36300,56100,'주말 +25%'],
])

ws = wb.create_sheet('07_Gift')
for col, w in zip('ABCDE', [10, 18, 12, 12, 12]): ws.column_dimensions[col].width = w
r = title(ws, 1, '🎁 사은품 (원)')
r = table(ws, r, ['통신사','구분','100M','500M','1G'], [
    ['SKT','solo',110000,170000,170000],
    ['SKT','combo',400000,430000,490000],
    ['KT','solo',90000,140000,140000],
    ['KT','combo',370000,450000,450000],
    ['LG U+','solo',200000,230000,230000],
    ['LG U+','combo',400000,470000,470000],
])

ws = wb.create_sheet('08_Cards')
for col, w in zip('ABCDE', [10, 14, 40, 14, 30]): ws.column_dimensions[col].width = w
r = title(ws, 1, '💳 제휴카드 (총 26종)')
cards = [
    ['SKT','롯데카드','SK브로드밴드 B롯데카드','50만원','-10,000원'],
    ['SKT','삼성카드','SK브로드밴드 삼성카드','30만원','-7,000원'],
    ['KT','KB국민','KT DC Plus 국민카드','30만원','-7,000원'],
    ['KT','현대','KT-현대카드M Edition3','30만원','-13,000원 (1~24M)'],
    ['KT','현대','KT-현대카드M Edition3 (2.0)','100만원','-22,000원 (1~36M)'],
    ['KT','신한','KT 신한 체크카드','30만원','3,000원 캐시백'],
    ['KT','신한','KT 가족만족 DC 신한카드','30만원','-7,000원'],
    ['KT','신한','KT 으랏차차 신한카드','50만원','-12,000원'],
    ['KT','IBK','olleh super DC IBK카드','30만원','-7,000원'],
    ['KT','IBK','KT 으랏차차 IBK카드','자동납부','5% 청구할인'],
    ['KT','삼성','KT 삼성카드','30만원','-7,000원'],
    ['KT','우리','KT Plus 우리카드','40만원','-10,000원'],
    ['KT','우리','KT 36 Plus 우리카드','40만원','-8,000원'],
    ['KT','하나','KT DC Plus 더 심플 하나카드','30만원','-10,000원'],
    ['KT','NH농협','KT 할부 Plus NH농협카드','40만원','-5,000원'],
    ['KT','롯데','KT DC Plus 롯데카드','40만원','-10,000원'],
    ['KT','비씨','KT SUPER DC BC 바로카드','40만원','-5,000원'],
    ['KT','비씨','KT DC Plus BC 바로카드','30만원','-7,000원'],
    ['KT','케이뱅크','KT멤버십x케이뱅크 더블혜택','20만원','5% 캐시백 (최대5천)'],
    ['LG U+','삼성카드','LG U+ 삼성카드','30만원','-7,000원'],
    ['LG U+','현대카드','LG U+ 현대카드M Edition3','50만원','-15,000원'],
    ['LG U+','하나카드','더 심플 하나카드','30만원','-10,000원'],
    ['LG U+','하나카드','LG U+Family 하나카드','30만원','통신료 25% 청구'],
    ['LG U+','신한카드','LG U+ 사장님 통할인','70만원','-10,000원'],
    ['LG U+','롯데카드','LG U+ x LOCA','30만원','-10,000원'],
    ['LG U+','NH카드','NH올원 LG U+ 카드','30만원','-9,000원'],
]
r = table(ws, r, ['통신사','카드사','카드명','실적','할인'], cards)

# SKT Bundle
ws = wb.create_sheet('10_SKT_Bundle')
for col in 'ABCDEF': ws.column_dimensions[col].width = 15
r = title(ws, 1, '🏷️ SKT 요즘가족결합', 'ef4444')
skt_rows = []
mob_100 = {1:3500,2:7000,3:18000,4:18000,5:18000}
mob_500 = {1:3500,2:7000,3:18000,4:24000,5:24000}
inet_map = {'100M':4400,'500M':11000,'1G':13200}
for sp in ['100M','500M','1G']:
    for ln in [1,2,3,4,5]:
        mob = mob_100[ln] if sp=='100M' else mob_500[ln]
        inet = inet_map[sp]
        skt_rows.append([sp, ln, mob, inet, 1100, mob+inet+1100])
r = table(ws, r, ['속도','회선수','휴대폰','인터넷','IPTV 추가','총할인'], skt_rows, SKT_FILL)

# KT Total
ws = wb.create_sheet('11_KT_Total')
for col in 'ABCDE': ws.column_dimensions[col].width = 17
r = title(ws, 1, '🏷️ KT 총액결합할인', '2563eb')
ranges_t = ['22K 이하','22K 이상','64.9K 이상','108.9K 이상','141.9K 이상','174.9K 이상']
inet_t = {'100M':[1650,3300,5500,5500,5500,5500],'500M':[2200,5500,5500,5500,5500,5500],'1G':[2200,5500,5500,5500,5500,5500]}
mob_t = {'100M':[0,0,3300,14300,18700,23100],'500M':[0,0,5500,16610,22110,27610],'1G':[0,0,5500,16610,22110,27610]}
rows = []
for sp in ['100M','500M','1G']:
    for i in range(6):
        rows.append([sp, ranges_t[i], inet_t[sp][i], mob_t[sp][i], inet_t[sp][i]+mob_t[sp][i]])
r = table(ws, r, ['속도','구간','인터넷','휴대폰','합계'], rows, KT_FILL)

# KT Fixed
ws = wb.create_sheet('12_KT_Fixed')
for col in 'ABCD': ws.column_dimensions[col].width = 18
r = title(ws, 1, '🏷️ KT 정액결합할인', '2563eb')
r = table(ws, r, ['구간','인터넷','휴대폰','합계'], [
    ['37K 이하',5500,0,5500],['37K 이상',5500,3000,8500],
    ['61K 이상',5500,5000,10500],['77K 이상',5500,7000,12500]
], KT_FILL)

# KT Premium
ws = wb.create_sheet('13_KT_Premium')
for col, w in zip('ABCD', [14, 40, 14, 14]): ws.column_dimensions[col].width = w
r = title(ws, 1, '💎 KT 프리미엄 가족결합', 'd97706')
c = ws.cell(row=r, column=1, value='자격: 77K↑ 요금제 2회선 이상 | 대표자 총액결합만 | 인터넷 -5,500 고정')
c.font = Font(name='Noto Sans KR', size=10, italic=True, color='92400e')
c.fill = PatternFill('solid', fgColor='fef3c7')
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)
r += 2
r = table(ws, r, ['월정액','요금제명','할인액','비율'], [
    [77000,'77,000원 (임계값)',19250,'≈25%'],
    [80000,'80,000원 (5G 슈퍼플랜 베이직)',20000,'25%'],
    [87890,'87,890원 (데이터선택 87.8)',22000,'≈25%'],
    [89000,'89,000원 (데이터ON 프리미엄)',22250,'25%'],
    [90000,'90,000원 (슈퍼플랜 베이직 Plus/초이스)',22500,'25%'],
    [100000,'100,000원 (슈퍼플랜 스페셜)',25000,'25%'],
    [109000,'109,000원 (데이터선택 109)',27500,'≈25%'],
    [110000,'110,000원 (슈퍼플랜 스페셜 Plus/초이스)',27500,'25%'],
    [130000,'130,000원 (슈퍼플랜 프리미엄/초이스)',32500,'25%'],
], PatternFill('solid', fgColor='fef3c7'))

# LGU+ Chweyswun
ws = wb.create_sheet('14_LGU_Chweyswun')
for col in 'ABCDEF': ws.column_dimensions[col].width = 17
r = title(ws, 1, '🏷️ LG U+ 참쉬운가족결합', 'e40981')
r = table(ws, r, ['구분','100M','500M','1G'], [['인터넷 할인 (3년)',5500,9900,13200]], LGU_FILL)
r += 1
c = ws.cell(row=r, column=1, value='휴대폰 할인 매트릭스 (인당)')
c.font = Font(name='Noto Sans KR', size=11, bold=True, color='e40981')
r += 1
r = table(ws, r, ['요금구간','2회선','3회선','4+회선'], [
    ['69K 미만',2200,3300,4400],
    ['69K 이상',3300,5500,6600],
    ['88K 이상',4400,6600,8800],
], LGU_FILL)

# LGU+ Together
ws = wb.create_sheet('15_LGU_Together')
for col in 'ABCD': ws.column_dimensions[col].width = 18
r = title(ws, 1, '🏷️ LG U+ 투게더 결합 (85K↑)', 'e40981')
c = ws.cell(row=r, column=1, value='자격: 5G 85K↑ + 500M+ 인터넷 (100M 결합 불가)')
c.font = Font(name='Noto Sans KR', size=10, italic=True, color='92400e')
c.fill = PatternFill('solid', fgColor='fef3c7')
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)
r += 2
r = table(ws, r, ['구분','100M','500M','1G'], [['인터넷 할인','불가',11000,11000]], LGU_FILL)
r += 1
r = table(ws, r, ['회선수','휴대폰 할인 (인당)'], [['2회선',10000],['3회선',14000],['4~5회선',20000]], LGU_FILL)

# Schema
ws = wb.create_sheet('20_Schema')
ws.column_dimensions['A'].width = 90
r = title(ws, 1, '📐 TypeScript 인터페이스 (D 객체)')
schema_lines = [
    'interface CarrierData {',
    '  name: string; prefix: string;',
    '  internet: Record<"100M"|"500M"|"1G", number>;',
    '  wifiCost?: number; wifiPrice?: Record<Speed, number>;',
    '  setTopOptions: SetTop[]; wifiOptions: WiFi[];',
    '  tvInternetNoWifi: Record<Speed, number>;',
    '  tvInternetWithWifi: Record<Speed, number>;',
    '  tv: TVProduct[];',
    '  install: { solo: number; combo: number };',
    '  gift: { solo: SpeedMap; combo: SpeedMap };',
    '  bundle: BundleConfig;',
    '}',
    '',
    'interface TVProduct { n: string; p: number; dc: number; }',
    'interface SetTop { id, name, fee, isDefault?, active }',
    'interface WiFi { id, name, fees: SpeedMap, isDefault?, active }',
    '',
    '// BundleConfig — 통신사별 상이:',
    '// SKT: { family: { internet, iptv, mobilePerBySpeed } }',
    '// KT: { ranges_total, total, ranges_fixed, fixed, premium }',
    '// LGU: { chweyswun: { internet, planLabels, mobile[][]} , together: { internet, mobile[] } }',
    '',
    'type Speed = "100M" | "500M" | "1G";',
]
for line in schema_lines:
    c = ws.cell(row=r, column=1, value=line)
    c.font = Font(name='SF Mono', size=10, color='1a2744'); r += 1

# Formula
ws = wb.create_sheet('30_CALC_Formula')
ws.column_dimensions['A'].width = 32
ws.column_dimensions['B'].width = 70
r = title(ws, 1, '🧮 월 요금 계산 공식')
c = ws.cell(row=r, column=1, value='⚠️ 3사 결합할인 적용 방식 핵심 차이')
c.font = Font(name='Noto Sans KR', size=12, bold=True, color='dc2626')
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
r += 1
for line in [
    'SKT 요즘가족결합: 단독가 REPLACE (요즘우리집 대체) → tvInternet 값 사용 안함',
    'KT 총액/정액: 기본 TV결합할인 + 추가할인 STACK (중복 적용)',
    'KT 프리미엄: 대표자+일반구성원은 총액결합, 77K↑ 구성원은 프리미엄 (독립)',
    'LG U+ 참쉬운: 단독가 REPLACE',
    'LG U+ 투게더: 단독가 REPLACE + 100M 결합 불가',
]:
    c = ws.cell(row=r, column=1, value='• ' + line)
    c.font = Font(name='Noto Sans KR', size=10)
    c.fill = PatternFill('solid', fgColor='fef3c7')
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2); r += 1

r += 1
r = title(ws, r, '계산 단계 (공식)')
for step, f in [
    ('기본 월요금 (결합없음)', 'base = (TV있?(tvInetWithWifi[sp]+tvFinal+setTop):(internet[sp]+wifiFee))'),
    ('SKT REPLACE', 'bundleFee = (internet[sp]+wifiFee - famInet) + (tvP - tvDc - iptv) + setTop'),
    ('KT STACK', 'bundleFee = (tvInet(wifi) - totalInet) + (tvP - tvDc) + setTop'),
    ('LGU REPLACE', 'bundleFee = (internet[sp] - chwInet) + (tvP - tvDc) + setTop'),
    ('혜택가', 'finalFee = bundleFee - 휴대폰_고지서_별도_차감'),
]:
    c1 = ws.cell(row=r, column=1, value=step); c1.font = Font(name='Noto Sans KR', size=10, bold=True); c1.border = BORDER
    c2 = ws.cell(row=r, column=2, value=f); c2.font = Font(name='SF Mono', size=10); c2.border = BORDER
    r += 1

# ─── 저장 ───
os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print(f'✅ {OUT} ({len(wb.sheetnames)} 시트)')
print('   시트:', ', '.join(wb.sheetnames))

os.makedirs(os.path.dirname(SCRIPT_OUT), exist_ok=True)
shutil.copy(__file__, SCRIPT_OUT)
print(f'✅ 스크립트 {SCRIPT_OUT}에 보관')
