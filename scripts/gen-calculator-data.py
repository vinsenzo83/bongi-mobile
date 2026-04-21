"""
개발자용 통신사 요금 계산기 데이터 엑셀
출처: docs/calculator.html D 객체 (2026-04-21 기준)
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

OUT = '/Users/vinsenzo/bongi-mobile/docs/bongi-calculator-data.xlsx'
SCRIPT_OUT = '/Users/vinsenzo/bongi-mobile/scripts/gen-calculator-data.py'  # 리포지토리 보관용

# 스타일
HEAD_FILL = PatternFill('solid', fgColor='1a2744')
SKT_FILL = PatternFill('solid', fgColor='fef2f2')
KT_FILL = PatternFill('solid', fgColor='eff6ff')
LGU_FILL = PatternFill('solid', fgColor='fdf2f8')
BORDER = Border(
    left=Side(style='thin', color='cccccc'),
    right=Side(style='thin', color='cccccc'),
    top=Side(style='thin', color='cccccc'),
    bottom=Side(style='thin', color='cccccc'),
)
HEAD_FONT = Font(name='Noto Sans KR', size=11, bold=True, color='ffffff')
BODY_FONT = Font(name='Noto Sans KR', size=10)
MONO = Font(name='SF Mono', size=10)

def style_header(cell):
    cell.fill = HEAD_FILL
    cell.font = HEAD_FONT
    cell.alignment = Alignment(horizontal='center', vertical='center')
    cell.border = BORDER

def style_body(cell, fill=None):
    cell.font = BODY_FONT
    cell.border = BORDER
    cell.alignment = Alignment(vertical='center')
    if fill:
        cell.fill = fill

def write_table(ws, start_row, headers, rows, fill=None):
    for i, h in enumerate(headers):
        c = ws.cell(row=start_row, column=i+1, value=h)
        style_header(c)
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            c = ws.cell(row=start_row+1+ri, column=ci+1, value=val)
            style_body(c, fill)
    return start_row + 1 + len(rows)

def add_section_title(ws, row, title, color='1a2744'):
    c = ws.cell(row=row, column=1, value=title)
    c.font = Font(name='Noto Sans KR', size=14, bold=True, color=color)
    ws.row_dimensions[row].height = 24
    return row + 2

wb = openpyxl.Workbook()

# ═══════════════════════════════════════════════
# INDEX (안내)
# ═══════════════════════════════════════════════
idx = wb.active
idx.title = 'INDEX'
idx.column_dimensions['A'].width = 24
idx.column_dimensions['B'].width = 60
idx.column_dimensions['C'].width = 20

idx['A1'] = '봉이모바일 — 3사 통신 요금 계산기 데이터'
idx['A1'].font = Font(name='Noto Sans KR', size=18, bold=True, color='1a2744')
idx.merge_cells('A1:C1')

idx['A2'] = '개발자 참고용 · 출처: docs/calculator.html D 객체 · 기준일: 2026-04-21'
idx['A2'].font = Font(name='Noto Sans KR', size=11, color='666666', italic=True)
idx.merge_cells('A2:C2')

row = 4
r = add_section_title(idx, row, '📋 시트 구조')
sheets_info = [
    ['INDEX', '전체 시트 목록 · 데이터 스키마 안내', '시작'],
    ['01_Internet', '3사 인터넷 단독 요금 (속도별)', '필수'],
    ['02_TV', '3사 TV 상품 (채널/가격/결합할인)', '필수'],
    ['03_TV_Internet', 'TV 결합 시 인터넷 요금 (WiFi 유/무)', '필수'],
    ['04_SetTop', '3사 셋톱박스 옵션 (기본/활성/요금)', '필수'],
    ['05_WiFi', '3사 WiFi 옵션 (속도별 추가요금)', '필수'],
    ['06_Install', '3사 설치비 (단독/결합)', '필수'],
    ['07_Gift', '3사 사은품 (속도 × TV결합 매트릭스)', '필수'],
    ['08_Cards', '3사 제휴카드 (카드사/실적/할인)', '참고'],
    ['10_SKT_Bundle', 'SKT 요즘가족결합 (속도 × 회선수)', '결합'],
    ['11_KT_Total', 'KT 총액결합 (6구간 × 속도별)', '결합'],
    ['12_KT_Fixed', 'KT 정액결합 (4구간)', '결합'],
    ['13_KT_Premium', 'KT 💎 프리미엄 가족결합 (요금제 카탈로그)', '결합'],
    ['14_LGU_Chweyswun', 'LGU+ 참쉬운가족결합 (요금구간 × 회선수)', '결합'],
    ['15_LGU_Together', 'LGU+ 투게더 결합 (고가요금제)', '결합'],
    ['20_Schema', 'D 객체 JSON 스키마 (개발 참조)', '개발'],
]
r = write_table(idx, r, ['시트명', '내용', '카테고리'], sheets_info)

r += 2
r = add_section_title(idx, r, '🔗 데이터 일관성 원칙')
for line in [
    '1. 모든 데이터는 docs/calculator.html의 D 객체에서 추출',
    '2. calculator.html 수정 시 이 엑셀도 반드시 재생성 (python3 /tmp/gen-excel-dev.py)',
    '3. 3사 공통 속성: internet, wifiCost/wifiPrice, setTopOptions, tvInternetNoWifi/WithWifi, tv, install, gift',
    '4. 통신사별 고유: bundle (SKT.family / KT.total,fixed,premium / LGU.chweyswun,together)',
    '5. WiFi 요금: SKT wifiCost 단일값 / KT wifiPrice 속도별 / LGU wifiCost=0 전속도 무료',
]:
    c = idx.cell(row=r, column=1, value=line)
    c.font = BODY_FONT
    idx.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    r += 1

# ═══════════════════════════════════════════════
# 01_Internet
# ═══════════════════════════════════════════════
ws = wb.create_sheet('01_Internet')
ws.column_dimensions['A'].width = 12
for col in 'BCDE':
    ws.column_dimensions[col].width = 14
r = add_section_title(ws, 1, '📡 인터넷 단독 요금 (3사 공통)', '1a2744')
r = write_table(ws, r, ['통신사', '프리픽스', '100M', '500M', '1G'], [
    ['SKT (B tv)', 'SK', 22000, 33000, 38500],
    ['KT (지니TV)', 'KT', 22000, 33000, 38500],
    ['LG U+ (U+tv)', 'LG', 22000, 33000, 38500],
])
r += 1
c = ws.cell(row=r, column=1, value='※ 3사 모두 3년 약정 기준 · 부가세 포함 · WiFi/셋톱 별도')
c.font = Font(name='Noto Sans KR', size=10, italic=True, color='666666')

# ═══════════════════════════════════════════════
# 02_TV
# ═══════════════════════════════════════════════
ws = wb.create_sheet('02_TV')
for col, w in zip('ABCDEFG', [10, 40, 10, 12, 12, 12, 30]):
    ws.column_dimensions[col].width = w
r = add_section_title(ws, 1, '📺 TV 상품 (3사 전체)', '1a2744')

tv_data = [
    ('SKT', SKT_FILL, [
        ['B tv 이코노미', 182, 12100, 2200, 9900],
        ['B tv 스탠다드', 236, 15400, 2200, 13200],
        ['B tv 올', 252, 18700, 2200, 16500],
        ['B tv 스탠다드 플러스', 222, 23100, 2200, 20900],
        ['B tv 올 플러스', 252, 24200, 2200, 22000],
        ['B tv 스탠다드 넷플릭스', 222, 27700, 2200, 25500],
        ['B tv 올 넷플릭스', 222, 30200, 2200, 28000],
        ['B tv 스탠다드 넷플릭스 프리미엄', 252, 30700, 2200, 28500],
        ['B tv 올 넷플릭스 프리미엄', 252, 33200, 2200, 31000],
    ]),
    ('KT', KT_FILL, [
        ['지니TV 베이직', 238, 14740, 2640, 12100],
        ['지니TV 라이트', 240, 15840, 2640, 13200],
        ['지니TV 에센스', 263, 20240, 3740, 16500],
        ['지니TV 모든G', 250, 21340, 4400, 16940],
        ['지니TV 디즈니+모든G', 250, 28100, 6600, 21500],
    ]),
    ('LG U+', LGU_FILL, [
        ['U+tv 실속형', 217, 15400, 2200, 13200],
        ['U+tv 기본형', 223, 16500, 2200, 14300],
        ['U+tv 프리미엄', 252, 18700, 2200, 16500],
        ['U+tv 프리미엄 VOD', 257, 24200, 5500, 18700],
    ]),
]

headers = ['통신사', 'TV 상품', '채널수', 'TV 단독', '결합할인', '인터넷 결합 시']
for i, h in enumerate(headers):
    c = ws.cell(row=r, column=i+1, value=h)
    style_header(c)
r += 1
for carrier, fill, rows in tv_data:
    for row_data in rows:
        ws.cell(row=r, column=1, value=carrier).font = BODY_FONT
        ws.cell(row=r, column=1).fill = fill
        for i, v in enumerate(row_data):
            c = ws.cell(row=r, column=i+2, value=v)
            style_body(c, fill)
        r += 1

# ═══════════════════════════════════════════════
# 03_TV_Internet (TV 결합 시 인터넷 요금)
# ═══════════════════════════════════════════════
ws = wb.create_sheet('03_TV_Internet')
for col, w in zip('ABCDE', [14, 18, 12, 12, 12]):
    ws.column_dimensions[col].width = w
r = add_section_title(ws, 1, '🔗 TV 결합 시 인터넷 요금 (WiFi 유/무)', '1a2744')
r = write_table(ws, r, ['통신사', 'WiFi 유무', '100M', '500M', '1G'], [
    ['SKT', 'WiFi 미포함', 19800, 27500, 33000],
    ['SKT', 'WiFi 포함', 22000, 28600, 34100],
    ['KT', 'WiFi 미포함', 22000, 27500, 33000],
    ['KT', 'WiFi 포함 (1G는 동일)', 23100, 28600, 33000],
    ['LG U+', 'WiFi 미포함=포함', 22000, 27500, 33000],
])

# ═══════════════════════════════════════════════
# 04_SetTop
# ═══════════════════════════════════════════════
ws = wb.create_sheet('04_SetTop')
for col, w in zip('ABCDEF', [10, 30, 14, 10, 10, 20]):
    ws.column_dimensions[col].width = w
r = add_section_title(ws, 1, '📦 셋톱박스 옵션 (3사 전체)', '1a2744')

settop_data = [
    ('SKT', SKT_FILL, [
        ['smart3', '스마트3', 4400, True, True],
        ['smart3-mini', '스마트3 미니', 4400, False, True],
        ['ai-nugu', 'AI NUGU', 6600, False, True],
        ['sound-max', '사운드 맥스', 8800, False, True],
        ['apple-tv', '애플TV', 6600, False, True],
    ]),
    ('KT', KT_FILL, [
        ['genie-3', '기가지니3', 4400, True, True],
        ['genie-a', '기가지니A', 3300, False, True],
        ['soundbar', '지니TV 올인원 사운드바', 8800, False, True],
    ]),
    ('LG U+', LGU_FILL, [
        ['uhd4', 'U+tv UHD4', 4400, True, True],
        ['soundbar-black', 'U+tv 사운드바 블랙', 6600, False, True],
    ]),
]

headers = ['통신사', 'ID', '모델명', '월 임대료', '기본', '활성']
for i, h in enumerate(headers):
    c = ws.cell(row=r, column=i+1, value=h)
    style_header(c)
r += 1
for carrier, fill, rows in settop_data:
    for rd in rows:
        ws.cell(row=r, column=1, value=carrier)
        ws.cell(row=r, column=1).font = BODY_FONT
        ws.cell(row=r, column=1).fill = fill
        for i, v in enumerate(rd):
            if isinstance(v, bool):
                v = 'O' if v else 'X'
            c = ws.cell(row=r, column=i+2, value=v)
            style_body(c, fill)
        r += 1

# ═══════════════════════════════════════════════
# 05_WiFi
# ═══════════════════════════════════════════════
ws = wb.create_sheet('05_WiFi')
for col, w in zip('ABCDEFGH', [10, 20, 28, 12, 12, 12, 10, 10]):
    ws.column_dimensions[col].width = w
r = add_section_title(ws, 1, '📡 WiFi 옵션 (3사 전체)', '1a2744')

wifi_data = [
    ('SKT', SKT_FILL, [
        ['giga-wifi', 'GIGA WiFi', 1100, 1100, 1100, True, True],
        ['giga-wifi-6', 'GIGA WiFi 6', 1100, 1100, 1100, False, True],
        ['giga-wifi-prem', 'GIGA WiFi 프리미엄', 5500, 5500, 5500, False, True],
        ['wings', '윙즈', 1650, 1650, 1650, False, True],
    ]),
    ('KT', KT_FILL, [
        ['wave2', 'KT GIGA WAVE2', 1100, 1100, 0, True, True],
        ['home-ax', 'GIGA WIFI 홈AX', 0, 1100, 0, False, True],
        ['buddy', 'GIGA WIFI BUDDY', 1650, 1650, 1650, False, True],
        ['prem-24', 'GIGA WIFI 프리미엄 2.4', 4400, 4400, 4400, False, True],
        ['prem-24-6e', 'GIGA WIFI 프리미엄 2.4 (6E)', 4400, 4400, 4400, False, True],
        ['prem-48', 'GIGA WIFI 프리미엄 4.8', 4400, 4400, 4400, False, True],
    ]),
    ('LG U+', LGU_FILL, [
        ['giga-wifi', '기가와이파이', 0, 0, 0, True, True],
        ['giga-wifi-6', '기가와이파이6', 0, 0, 0, False, True],
        ['giga-wifi-mesh', '기가와이파이 메쉬', 0, 0, 0, False, True],
    ]),
]

headers = ['통신사', 'ID', '모델명', '100M', '500M', '1G', '기본', '활성']
for i, h in enumerate(headers):
    c = ws.cell(row=r, column=i+1, value=h)
    style_header(c)
r += 1
for carrier, fill, rows in wifi_data:
    for rd in rows:
        ws.cell(row=r, column=1, value=carrier).fill = fill
        ws.cell(row=r, column=1).font = BODY_FONT
        for i, v in enumerate(rd):
            if isinstance(v, bool):
                v = 'O' if v else 'X'
            c = ws.cell(row=r, column=i+2, value=v)
            style_body(c, fill)
        r += 1

# ═══════════════════════════════════════════════
# 06_Install
# ═══════════════════════════════════════════════
ws = wb.create_sheet('06_Install')
for col in 'ABCD':
    ws.column_dimensions[col].width = 16
r = add_section_title(ws, 1, '🔧 설치비 (1회성 · 평일 기준)', '1a2744')
r = write_table(ws, r, ['통신사', '인터넷 단독 (solo)', '인터넷+TV 결합 (combo)', '비고'], [
    ['SKT', 36300, 56100, '주말 +25%'],
    ['KT', 36000, 56200, '주말 +25%'],
    ['LG U+', 36300, 56100, '주말 +25%'],
])

# ═══════════════════════════════════════════════
# 07_Gift
# ═══════════════════════════════════════════════
ws = wb.create_sheet('07_Gift')
for col, w in zip('ABCDE', [10, 16, 12, 12, 12]):
    ws.column_dimensions[col].width = w
r = add_section_title(ws, 1, '🎁 사은품 (속도 × TV결합 매트릭스 · 원 단위)', '1a2744')
r = write_table(ws, r, ['통신사', '구분', '100M', '500M', '1G'], [
    ['SKT', 'solo (TV 없음)', 110000, 170000, 170000],
    ['SKT', 'combo (TV 결합)', 400000, 430000, 490000],
    ['KT', 'solo', 90000, 140000, 140000],
    ['KT', 'combo', 370000, 450000, 450000],
    ['LG U+', 'solo', 200000, 230000, 230000],
    ['LG U+', 'combo', 400000, 470000, 470000],
])

# ═══════════════════════════════════════════════
# 08_Cards
# ═══════════════════════════════════════════════
ws = wb.create_sheet('08_Cards')
for col, w in zip('ABCDE', [10, 14, 40, 14, 30]):
    ws.column_dimensions[col].width = w
r = add_section_title(ws, 1, '💳 제휴카드 (3사 전체, 총 26종)', '1a2744')

cards_data = [
    ('SKT', SKT_FILL, [
        ['롯데카드', 'SK브로드밴드 B롯데카드', '50만원', '-10,000원'],
        ['삼성카드', 'SK브로드밴드 삼성카드', '30만원', '-7,000원'],
    ]),
    ('KT', KT_FILL, [
        ['KB국민', 'KT DC Plus 국민카드', '30만원', '-7,000원'],
        ['현대', 'KT-현대카드M Edition3 (청구할인형)', '30만원', '-13,000원 (1~24개월)'],
        ['현대', 'KT-현대카드M Edition3 (청구할인형2.0)', '100만원', '-22,000원 (1~36개월)'],
        ['신한', 'KT 신한 체크카드', '30만원', '3,000원 캐시백'],
        ['신한', 'KT 가족만족 DC 신한카드', '30만원', '-7,000원'],
        ['신한', 'KT 으랏차차 신한카드', '50만원', '-12,000원'],
        ['IBK', 'olleh super DC IBK카드', '30만원', '-7,000원'],
        ['IBK', 'KT 으랏차차 IBK카드', '자동납부', '5% 청구할인'],
        ['삼성', 'KT 삼성카드', '30만원', '-7,000원'],
        ['우리', 'KT Plus 우리카드', '40만원', '-10,000원 (1~24개월)'],
        ['우리', 'KT 36 Plus 우리카드', '40만원', '-8,000원 (1~24개월)'],
        ['하나', 'KT DC Plus 더 심플 하나카드', '30만원', '-10,000원'],
        ['NH농협', 'KT 할부 Plus NH농협카드', '40만원', '-5,000원 (할부중복불가)'],
        ['롯데', 'KT DC Plus 롯데카드', '40만원', '-10,000원'],
        ['비씨', 'KT SUPER DC BC 바로카드', '40만원', '-5,000원'],
        ['비씨', 'KT DC Plus BC 바로카드', '30만원', '-7,000원'],
        ['케이뱅크', 'KT멤버십x케이뱅크 더블혜택 체크카드', '20만원', '5% 캐시백 (최대 5,000원)'],
    ]),
    ('LG U+', LGU_FILL, [
        ['삼성카드', 'LG U+ 삼성카드', '30만원', '-7,000원'],
        ['현대카드', 'LG U+ 현대카드M Edition3', '50만원', '-15,000원 (1~24개월)'],
        ['하나카드', '더 심플 하나카드', '30만원', '-10,000원'],
        ['하나카드', 'LG U+Family 하나카드', '30만원', '통신료 25% 청구 (25개월↑ 15%)'],
        ['신한카드', 'LG U+ 사장님 통할인', '70만원', '-10,000원 (25개월↑ -6,000)'],
        ['롯데카드', 'LG U+ x LOCA', '30만원', '-10,000원 (25개월↑ -6,000)'],
        ['NH카드', 'NH올원 LG U+ 카드', '30만원', '-9,000원'],
    ]),
]

headers = ['통신사', '카드사', '카드명', '실적', '할인']
for i, h in enumerate(headers):
    c = ws.cell(row=r, column=i+1, value=h)
    style_header(c)
r += 1
for carrier, fill, rows in cards_data:
    for rd in rows:
        ws.cell(row=r, column=1, value=carrier).fill = fill
        ws.cell(row=r, column=1).font = BODY_FONT
        for i, v in enumerate(rd):
            c = ws.cell(row=r, column=i+2, value=v)
            style_body(c, fill)
        r += 1

# ═══════════════════════════════════════════════
# 10_SKT_Bundle (요즘가족결합)
# ═══════════════════════════════════════════════
ws = wb.create_sheet('10_SKT_Bundle')
for col in 'ABCDEF':
    ws.column_dimensions[col].width = 15
r = add_section_title(ws, 1, '🏷️ SKT 요즘가족결합 (속도 × 회선수)', 'ef4444')

r = write_table(ws, r, ['속도', '회선수', '휴대폰 할인', '인터넷 할인', 'IPTV 할인', '총 할인'], [
    ['100M', 1, 3500, 4400, 1100, 9000],
    ['100M', 2, 7000, 4400, 1100, 12500],
    ['100M', 3, 18000, 4400, 1100, 23500],
    ['100M', 4, 18000, 4400, 1100, 23500],
    ['100M', 5, 18000, 4400, 1100, 23500],
    ['500M', 1, 3500, 11000, 1100, 15600],
    ['500M', 2, 7000, 11000, 1100, 19100],
    ['500M', 3, 18000, 11000, 1100, 30100],
    ['500M', 4, 24000, 11000, 1100, 36100],
    ['500M', 5, 24000, 11000, 1100, 36100],
    ['1G', 1, 3500, 13200, 1100, 17800],
    ['1G', 2, 7000, 13200, 1100, 21300],
    ['1G', 3, 18000, 13200, 1100, 32300],
    ['1G', 4, 24000, 13200, 1100, 38300],
    ['1G', 5, 24000, 13200, 1100, 38300],
], SKT_FILL)

r += 1
c = ws.cell(row=r, column=1, value='※ IPTV 할인은 TV 결합 시에만 적용 · 휴대폰 할인 = 인당 × 회선수 (인당: 100M 1~2회선 3,500 / 3회선 6,000 / 4~5회선 4,500 or 3,600)')
c.font = Font(name='Noto Sans KR', size=9, italic=True, color='666666')
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)

# ═══════════════════════════════════════════════
# 11_KT_Total
# ═══════════════════════════════════════════════
ws = wb.create_sheet('11_KT_Total')
for col in 'ABCDEFG':
    ws.column_dimensions[col].width = 17
r = add_section_title(ws, 1, '🏷️ KT 총액결합할인 (6구간 × 속도별)', '2563eb')

ranges_total = ['22,000원 이하', '22,000원 이상', '64,900원 이상', '108,900원 이상', '141,900원 이상', '174,900원 이상']
total_inet = {
    '100M': [1650, 3300, 5500, 5500, 5500, 5500],
    '500M': [2200, 5500, 5500, 5500, 5500, 5500],
    '1G':   [2200, 5500, 5500, 5500, 5500, 5500],
}
total_mob = {
    '100M': [0, 0, 3300, 14300, 18700, 23100],
    '500M': [0, 0, 5500, 16610, 22110, 27610],
    '1G':   [0, 0, 5500, 16610, 22110, 27610],
}
rows = []
for sp in ['100M', '500M', '1G']:
    for i in range(6):
        rows.append([sp, ranges_total[i], total_inet[sp][i], total_mob[sp][i], total_inet[sp][i] + total_mob[sp][i]])
r = write_table(ws, r, ['속도', '월요금 합산 구간', '인터넷 할인', '휴대폰 할인', '합계'], rows, KT_FILL)

# ═══════════════════════════════════════════════
# 12_KT_Fixed
# ═══════════════════════════════════════════════
ws = wb.create_sheet('12_KT_Fixed')
for col in 'ABCD':
    ws.column_dimensions[col].width = 18
r = add_section_title(ws, 1, '🏷️ KT 정액결합할인 (4구간)', '2563eb')

ranges_fixed = ['37,000원 이하', '37,000원 이상', '61,000원 이상', '77,000원 이상']
fx_inet = [5500, 5500, 5500, 5500]
fx_mob = [0, 3000, 5000, 7000]
r = write_table(ws, r, ['월요금 구간', '인터넷 할인', '휴대폰 할인', '합계'], [
    [ranges_fixed[i], fx_inet[i], fx_mob[i], fx_inet[i] + fx_mob[i]] for i in range(4)
], KT_FILL)

# ═══════════════════════════════════════════════
# 13_KT_Premium
# ═══════════════════════════════════════════════
ws = wb.create_sheet('13_KT_Premium')
for col, w in zip('ABCD', [14, 40, 14, 18]):
    ws.column_dimensions[col].width = w
r = add_section_title(ws, 1, '💎 KT 프리미엄 가족결합 (요금제 카탈로그)', 'd97706')

c = ws.cell(row=r, column=1, value='자격: 77,000원↑ 요금제 2회선 이상 | 대표자는 총액결합만 (프리미엄 불가) | 인터넷 -5,500원 고정 | 구성원 77K↑만 25% 할인 (100원 올림)')
c.font = Font(name='Noto Sans KR', size=10, italic=True, color='92400e')
c.fill = PatternFill('solid', fgColor='fef3c7')
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)
r += 2

plan_catalog = [
    [77000, '77,000원 (임계값)', 19250, '≈25%'],
    [80000, '80,000원 (5G 슈퍼플랜 베이직)', 20000, '25%'],
    [87890, '87,890원 (데이터선택 87.8)', 22000, '≈25%'],
    [89000, '89,000원 (데이터ON 프리미엄)', 22250, '25%'],
    [90000, '90,000원 (슈퍼플랜 베이직 Plus/초이스)', 22500, '25%'],
    [100000, '100,000원 (슈퍼플랜 스페셜)', 25000, '25%'],
    [109000, '109,000원 (데이터선택 109)', 27500, '≈25%'],
    [110000, '110,000원 (슈퍼플랜 스페셜 Plus/초이스)', 27500, '25%'],
    [130000, '130,000원 (슈퍼플랜 프리미엄/초이스)', 32500, '25%'],
]
r = write_table(ws, r, ['월정액 (v)', '요금제명 (label)', '할인액 (dc)', '할인율'], plan_catalog, PatternFill('solid', fgColor='fef3c7'))

# ═══════════════════════════════════════════════
# 14_LGU_Chweyswun
# ═══════════════════════════════════════════════
ws = wb.create_sheet('14_LGU_Chweyswun')
for col in 'ABCDEF':
    ws.column_dimensions[col].width = 17
r = add_section_title(ws, 1, '🏷️ LGU+ 참쉬운가족결합 (요금구간 × 회선수)', 'e40981')

# 인터넷 할인
r = write_table(ws, r, ['구분', '100M', '500M', '1G'], [
    ['인터넷 할인 (3년 약정)', 5500, 9900, 13200],
], LGU_FILL)

r += 1
c = ws.cell(row=r, column=1, value='휴대폰 할인 매트릭스 (인당)')
c.font = Font(name='Noto Sans KR', size=12, bold=True, color='e40981')
r += 1
r = write_table(ws, r, ['휴대폰 월요금', '2회선', '3회선', '4+회선'], [
    ['69,000원 미만', 2200, 3300, 4400],
    ['69,000원 이상', 3300, 5500, 6600],
    ['88,000원 이상', 4400, 6600, 8800],
], LGU_FILL)

r += 1
c = ws.cell(row=r, column=1, value='※ 알뜰폰 결합 가능 · 휴대폰 10대 + 인터넷 3대까지')
c.font = Font(name='Noto Sans KR', size=9, italic=True, color='666666')
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)

# ═══════════════════════════════════════════════
# 15_LGU_Together
# ═══════════════════════════════════════════════
ws = wb.create_sheet('15_LGU_Together')
for col in 'ABCD':
    ws.column_dimensions[col].width = 18
r = add_section_title(ws, 1, '🏷️ LGU+ 투게더 결합 (85,000원↑ 고가요금제)', 'e40981')

c = ws.cell(row=r, column=1, value='조건: 5G 85,000원 이상 요금제 + 500M 이상 인터넷 (100M 결합 불가)')
c.font = Font(name='Noto Sans KR', size=10, italic=True, color='92400e')
c.fill = PatternFill('solid', fgColor='fef3c7')
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4)
r += 2

r = write_table(ws, r, ['구분', '100M', '500M', '1G'], [
    ['인터넷 할인', '결합 불가', 11000, 11000],
], LGU_FILL)
r += 1
r = write_table(ws, r, ['회선수', '휴대폰 할인 (인당)', '', ''], [
    ['2회선', 10000, '', ''],
    ['3회선', 14000, '', ''],
    ['4~5회선', 20000, '', ''],
], LGU_FILL)

# ═══════════════════════════════════════════════
# 30_CALC_Formula (계산 공식 설명)
# ═══════════════════════════════════════════════
ws = wb.create_sheet('30_CALC_Formula')
ws.column_dimensions['A'].width = 30
ws.column_dimensions['B'].width = 70
r = add_section_title(ws, 1, '🧮 월 요금 계산 공식 (3사 공통 구조)', '1a2744')

formulas = [
    ('단계', '공식'),
    ('STEP 1 — 인터넷 기본가', 'netSingle = D[carrier].internet[speed]'),
    ('STEP 2 — WiFi 추가금', 'wifiForSp = D.wifiPrice[speed] (KT) 또는 D.wifiCost (SKT/LGU+)'),
    ('STEP 3 — TV 결합 여부 분기', 'hasTv = (tvIdx > 0)'),
    ('  ├─ TV 없음 (단독)', 'base = netSingle + (wifi ? wifiForSp : 0)'),
    ('  └─ TV 결합', 'netCombo = wifi ? D.tvInternetWithWifi[sp] : D.tvInternetNoWifi[sp]'),
    ('', 'tvFinal = D.tv[tvIdx].p - D.tv[tvIdx].dc'),
    ('', 'base = netCombo + tvFinal + D.setTop.fee'),
    ('STEP 4 — 휴대폰 결합할인', '통신사별 상이 (아래 참조)'),
    ('STEP 5 — 최종 월요금', 'monthlyTotal = base - bundleDiscount'),
    ('STEP 6 — 휴대폰 고지서 별도 할인', 'mobileSideDiscount (가족결합만 해당)'),
    ('STEP 7 — 혜택가', 'finalFee = monthlyTotal - mobileSideDiscount'),
    ('', ''),
    ('부가: 설치비 (1회성)', 'installFee = hasTv ? D.install.combo : D.install.solo'),
    ('부가: 사은품', 'gift = D.gift[hasTv ? "combo" : "solo"][speed]'),
]

for r_idx, (step, formula) in enumerate(formulas):
    if r_idx == 0:
        c1 = ws.cell(row=r, column=1, value=step); style_header(c1)
        c2 = ws.cell(row=r, column=2, value=formula); style_header(c2)
    else:
        c1 = ws.cell(row=r, column=1, value=step)
        c1.font = Font(name='Noto Sans KR', size=10, bold=(not step.startswith('  ') and step != ''))
        c1.border = BORDER
        c2 = ws.cell(row=r, column=2, value=formula)
        c2.font = Font(name='SF Mono', size=10, color='1a2744')
        c2.border = BORDER
    r += 1

r += 2
c = ws.cell(row=r, column=1, value='⚠️ 핵심 주의사항 — 3사 결합할인 적용 방식 다름')
c.font = Font(name='Noto Sans KR', size=13, bold=True, color='dc2626')
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
r += 1
for line in [
    '• SKT 요즘가족결합: 단독가 **REPLACE** (요즘우리집 대체) → tvInternetNoWifi 무시',
    '• KT 총액/정액: 기본 TV결합할인 + 총액할인 **STACK** (중복 적용)',
    '• KT 프리미엄: 총액대상(대표자+77K미만) + 프리미엄대상(77K↑) 독립 계산',
    '• LG U+ 참쉬운: 단독가 **REPLACE** (SKT와 유사)',
    '• LG U+ 투게더: 단독가 **REPLACE** (85K↑ 고가요금제 한정)',
]:
    c = ws.cell(row=r, column=1, value=line)
    c.font = Font(name='Noto Sans KR', size=10)
    c.fill = PatternFill('solid', fgColor='fef3c7')
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
    r += 1

r += 2
r = add_section_title(ws, r, '🏷️ 결합할인 계산 — 통신사별 분기', '1a2744')

bundle_calc = [
    ('통신사', '결합 종류', '계산 공식'),
    ('SKT', '요즘가족결합', 'inetDc = D.skt.bundle.family.internet[sp]'),
    ('', '', 'iptvDc = hasTv ? D.skt.bundle.family.iptv : 0'),
    ('', '', 'mobPer = D.skt.bundle.family.mobilePerBySpeed[sp][lines]'),
    ('', '', 'mobTotal = mobPer × lines  ← 인당 × 인원'),
    ('', '', 'bundleDc = inetDc + iptvDc (인터넷/TV 할인)'),
    ('', '', 'mobileSideDiscount = mobTotal (휴대폰 고지서에서 별도 차감)'),
    ('KT', '총액결합 (total)', 'rngIdx = 합산_요금_구간 (6단계)'),
    ('', '', 'inetDc = D.kt.bundle.total.internet[sp][rngIdx]'),
    ('', '', 'mobDc = D.kt.bundle.total.mobile[sp][rngIdx]'),
    ('', '', 'bundleDc = inetDc (인터넷 할인 · 기본 TV결합할인과 중복 적용)'),
    ('', '', 'mobileSideDiscount = mobDc'),
    ('KT', '정액결합 (fixed)', 'fxIdx = 요금_구간 (4단계)'),
    ('', '', 'inetDc = D.kt.bundle.fixed.internet[fxIdx]  (전구간 5,500)'),
    ('', '', 'mobDc = D.kt.bundle.fixed.mobile[fxIdx]'),
    ('KT', '💎 프리미엄 가족결합', '자격: 77K↑ 요금제 2회선 이상'),
    ('', '', '대표자 + 77K미만 구성원 → 총액결합 합산 → 구간 mobDc'),
    ('', '', '77K↑ 구성원(대표자 제외) → 각각 D.kt.bundle.premium.planCatalog[plan].dc 합산'),
    ('', '', 'totalDc = 5500 (인터넷 고정) + 총액결합mobDc + 프리미엄dc 합'),
    ('LG U+', '참쉬운가족결합', 'inetDc = D.lgu.bundle.chweyswun.internet[sp]'),
    ('', '', 'planIdx = 요금제_구간 (3단계: 69K미만/69K↑/88K↑)'),
    ('', '', 'lineIdx = min(lines,4) - 2  ← 2회선:0, 3회선:1, 4+:2'),
    ('', '', 'mobDc = D.lgu.bundle.chweyswun.mobile[planIdx][lineIdx]'),
    ('LG U+', '투게더 결합', '자격: 85K↑ 고가요금제 (100M 결합 불가)'),
    ('', '', 'inetDc = D.lgu.bundle.together.internet[sp]  (100M=0)'),
    ('', '', 'mobDc = D.lgu.bundle.together.mobile[lineIdx]'),
]

for r_idx, row_data in enumerate(bundle_calc):
    fill = None
    if r_idx == 0:
        for ci, v in enumerate(row_data):
            c = ws.cell(row=r, column=ci+1, value=v); style_header(c)
    else:
        if row_data[0] == 'SKT': fill = SKT_FILL
        elif row_data[0] == 'KT': fill = KT_FILL
        elif row_data[0] == 'LG U+': fill = LGU_FILL
        for ci, v in enumerate(row_data):
            c = ws.cell(row=r, column=ci+1, value=v)
            c.border = BORDER
            c.font = Font(name='SF Mono' if ci == 2 else 'Noto Sans KR', size=10)
            if fill: c.fill = fill
    r += 1

# ═══════════════════════════════════════════════
# 31_CALC_Example_SKT (예시 계산)
# ═══════════════════════════════════════════════
ws = wb.create_sheet('31_CALC_Example_SKT')
ws.column_dimensions['A'].width = 35
ws.column_dimensions['B'].width = 22
ws.column_dimensions['C'].width = 40
r = add_section_title(ws, 1, '🧮 SKT 계산 예시 — 500M + B tv 올 + WiFi 없음 + 요즘가족결합 3회선', 'ef4444')

example_skt = [
    ('입력값', '', ''),
    ('  통신사', 'SKT', 'D[\"skt\"]'),
    ('  속도', '500M', ''),
    ('  TV 상품', 'B tv 올 (tvIdx=3)', 'D.skt.tv[3] = {p:18700, dc:2200}'),
    ('  WiFi', '없음', ''),
    ('  결합 종류', '요즘가족결합 (family)', ''),
    ('  결합 인원', '3명', ''),
    ('', '', ''),
    ('【경로 A】 휴대폰 결합 X (요즘우리집결합만 적용)', '', ''),
    ('  1. 인터넷 결합가 (tvInternetNoWifi)', '27,500원', 'D.skt.tvInternetNoWifi[\"500M\"]'),
    ('  2. TV 최종요금 (결합할인 -2,200)', '16,500원', '18,700 - 2,200'),
    ('  3. 셋톱박스 스마트3', '4,400원', 'D.skt.setTop'),
    ('  = 월 기본요금 (요즘우리집)', '48,400원', '27,500 + 16,500 + 4,400'),
    ('', '', ''),
    ('【경로 B】 휴대폰 결합 O (요즘가족결합 적용 · 요즘우리집 REPLACE)', '', ''),
    ('  ※ 주의: 단독가에서 재계산 (tvInternetNoWifi 사용 X)', '', ''),
    ('  1. 인터넷 단독가 500M', '33,000원', 'D.skt.internet[\"500M\"]'),
    ('  2. 요즘가족결합 인터넷 할인', '-11,000원', 'D.skt.bundle.family.internet[\"500M\"]'),
    ('  → 인터넷 실질', '22,000원', '33,000 - 11,000'),
    ('  3. TV 기본 (B tv 올)', '18,700원', 'D.skt.tv[3].p'),
    ('  4. TV 결합할인', '-2,200원', 'D.skt.tv[3].dc'),
    ('  5. IPTV 추가 할인 (요즘가족 전용)', '-1,100원', 'D.skt.bundle.family.iptv'),
    ('  → TV 실질', '15,400원', '18,700 - 2,200 - 1,100'),
    ('  6. 셋톱박스', '4,400원', ''),
    ('  = 인터넷+TV 월 실납부', '41,800원', '22,000 + 15,400 + 4,400'),
    ('', '', ''),
    ('휴대폰 고지서 별도 차감', '', ''),
    ('  휴대폰 할인 인당 (500M, 3회선)', '6,000원', 'mobilePerBySpeed[\"500M\"][3]'),
    ('  총 할인 (인당 × 회선수)', '-18,000원', '6,000 × 3'),
    ('', '', ''),
    ('  🎉 혜택가 (최종)', '23,800원/월', '41,800 - 18,000'),
    ('', '', ''),
    ('경로 A vs B 차이', '', ''),
    ('  요즘우리집 (A): 48,400원', '', '휴대폰 결합 없을 때'),
    ('  요즘가족 (B): 23,800원', '', '휴대폰 3회선 결합 시 (-24,600 절감)'),
    ('', '', ''),
    ('부가 혜택', '', ''),
    ('  설치비 (1회성, 결합)', '56,100원', 'D.skt.install.combo'),
    ('  사은품 (500M + TV 결합)', '430,000원', 'D.skt.gift.combo[\"500M\"]'),
]

for step, value, source in example_skt:
    cells = [
        (step, Font(name='Noto Sans KR', size=11, bold=(not step.startswith('  ') and step != ''), color='1a2744' if not step.startswith('  ') else '333333')),
        (value, MONO),
        (source, Font(name='SF Mono', size=9, color='666666')),
    ]
    for ci, (val, font) in enumerate(cells):
        c = ws.cell(row=r, column=ci+1, value=val)
        c.font = font
        c.border = BORDER
        if step == '' and value == '':
            c.fill = PatternFill('solid', fgColor='f0f0f0')
        elif '혜택가' in step or '월 기본요금' in step:
            c.fill = SKT_FILL
    r += 1

# ═══════════════════════════════════════════════
# 31b_CALC_Example_KT_Total (총액결합 중복 적용 예시)
# ═══════════════════════════════════════════════
ws = wb.create_sheet('31b_CALC_Example_KT_Total')
ws.column_dimensions['A'].width = 40
ws.column_dimensions['B'].width = 22
ws.column_dimensions['C'].width = 40
r = add_section_title(ws, 1, '🧮 KT 총액결합 계산 예시 — 500M+지니TV 에센스+WiFi O+총액결합(108,900원↑)', '2563eb')

example_kt_total = [
    ('입력값', '', ''),
    ('  통신사/속도', 'KT 500M', ''),
    ('  TV 상품', '지니TV 에센스 (tvIdx=3)', 'D.kt.tv[3] = {p:20240, dc:3740}'),
    ('  WiFi', '사용 (+1,100원)', 'D.kt.wifiPrice[\"500M\"]'),
    ('  결합 종류', '총액결합 (kt-total)', ''),
    ('  휴대폰 합산 구간', '108,900원 이상 (rngIdx=3)', ''),
    ('', '', ''),
    ('【기본 TV 결합 인터넷 할인】 (KT 기본)', '', ''),
    ('  인터넷 단독 (500M)', '33,000원', 'D.kt.internet[\"500M\"]'),
    ('  WiFi 추가', '+1,100원', ''),
    ('  인터넷 결합가 (tvInternetWithWifi)', '28,600원', 'D.kt.tvInternetWithWifi[\"500M\"]'),
    ('  → 기본 TV결합 인터넷 할인', '-5,500원', '(33,000+1,100) - 28,600'),
    ('', '', ''),
    ('【총액결합 추가 할인】 ← 중복 적용', '', ''),
    ('  총액결합 인터넷 할인', '-5,500원', 'D.kt.bundle.total.internet[\"500M\"][3]'),
    ('  → 인터넷 최종', '23,100원', '28,600 - 5,500'),
    ('', '', ''),
    ('【TV + 셋톱】', '', ''),
    ('  TV 기본', '20,240원', 'D.kt.tv[3].p'),
    ('  TV 결합할인', '-3,740원', 'D.kt.tv[3].dc'),
    ('  → TV 실질', '16,500원', '20,240 - 3,740'),
    ('  셋톱박스 기가지니3', '4,400원', 'D.kt.setTop'),
    ('', '', ''),
    ('【월 실납부】', '', ''),
    ('  인터넷+TV+셋톱', '44,000원', '23,100 + 16,500 + 4,400'),
    ('', '', ''),
    ('휴대폰 고지서 별도 할인', '', ''),
    ('  500M mobile[3]', '-16,610원', 'D.kt.bundle.total.mobile[\"500M\"][3]'),
    ('', '', ''),
    ('  🎉 총 월 절감액 (vs 단독)', '44,000 + (-16,610) 별도', ''),
    ('', '', ''),
    ('※ KT 특성: 기본 TV결합 할인 + 총액결합 할인 **중복 적용** (STACK)', '', ''),
    ('   → SKT 요즘가족결합(REPLACE)과 반대 방식', '', ''),
]

for step, value, source in example_kt_total:
    cells = [
        (step, Font(name='Noto Sans KR', size=11, bold=(not step.startswith('  ') and step != ''), color='1a2744')),
        (value, MONO),
        (source, Font(name='SF Mono', size=9, color='666666')),
    ]
    for ci, (val, font) in enumerate(cells):
        c = ws.cell(row=r, column=ci+1, value=val)
        c.font = font
        c.border = BORDER
        if '🎉' in step or '월 실납부' in step:
            c.fill = KT_FILL
    r += 1

# ═══════════════════════════════════════════════
# 32_CALC_Example_KT_Premium (프리미엄 예시)
# ═══════════════════════════════════════════════
ws = wb.create_sheet('32_CALC_Example_KT_Premium')
ws.column_dimensions['A'].width = 40
ws.column_dimensions['B'].width = 22
ws.column_dimensions['C'].width = 40
r = add_section_title(ws, 1, '💎 KT 프리미엄 가족결합 계산 예시 (자료 예시 1)', 'd97706')

example_kt = [
    ('입력값', '', ''),
    ('  인터넷', '100M + WiFi 없음 (TV 없음)', ''),
    ('  회선 구성', '대표 89K + 구성원 89K(프리미엄) + 구성원 89K(프리미엄)', '총 3회선'),
    ('  총액결합 대상', '대표자 89K만 (프리미엄 2명 제외)', '합산 89,000원'),
    ('  구간 판정', '64,900원 이상 (index 2)', ''),
    ('', '', ''),
    ('총액결합 할인 (대표자 몫)', '', ''),
    ('  100M mobile[index 2]', '-3,300원', 'D.kt.bundle.total.mobile[\"100M\"][2]'),
    ('', '', ''),
    ('프리미엄 할인 (구성원 2명)', '', ''),
    ('  89,000원 요금제 × 25% (정확)', '-22,250원 × 2 = -44,500원', 'planCatalog[89000].dc'),
    ('', '', ''),
    ('인터넷 할인 (고정)', '', ''),
    ('  프리미엄 인터넷 할인', '-5,500원', 'D.kt.bundle.premium.internet'),
    ('', '', ''),
    ('합계', '', ''),
    ('  총 할인액', '-53,300원', '3,300 + 44,500 + 5,500'),
    ('  총액결합만 했을 때 비교', '-28,600원', '(174,900↑ 구간 기준)'),
    ('  💎 프리미엄 선택 시 추가 이득', '+24,700원 더 할인', ''),
]

for step, value, source in example_kt:
    cells = [
        (step, Font(name='Noto Sans KR', size=11, bold=(not step.startswith('  ') and step != ''), color='1a2744')),
        (value, MONO),
        (source, Font(name='SF Mono', size=9, color='666666')),
    ]
    for ci, (val, font) in enumerate(cells):
        c = ws.cell(row=r, column=ci+1, value=val)
        c.font = font
        c.border = BORDER
        if '프리미엄' in step and '이득' in step:
            c.fill = PatternFill('solid', fgColor='fef3c7')
        elif '총 할인액' in step:
            c.fill = KT_FILL
    r += 1

# ═══════════════════════════════════════════════
# 40_CALC_Interactive_SKT (대화형 계산기 — SKT)
# ═══════════════════════════════════════════════
from openpyxl.worksheet.datavalidation import DataValidation

ws = wb.create_sheet('40_CALC_Interactive_SKT')
for col, w in zip('ABCDE', [24, 18, 18, 18, 30]):
    ws.column_dimensions[col].width = w

def calc_sheet_header(ws, row, title, color):
    c = ws.cell(row=row, column=1, value=title)
    c.font = Font(name='Noto Sans KR', size=16, bold=True, color='ffffff')
    c.fill = PatternFill('solid', fgColor=color)
    c.alignment = Alignment(horizontal='center', vertical='center')
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
    ws.row_dimensions[row].height = 32
    return row + 2

def input_row(ws, r, label, default, source_note='', options=None):
    ws.cell(row=r, column=1, value=label).font = Font(name='Noto Sans KR', size=11, bold=True)
    c = ws.cell(row=r, column=2, value=default)
    c.font = MONO
    c.fill = PatternFill('solid', fgColor='fef3c7')
    c.border = BORDER
    c.alignment = Alignment(horizontal='center')
    ws.cell(row=r, column=3, value='← 여기 수정').font = Font(name='Noto Sans KR', size=9, italic=True, color='d97706')
    if source_note:
        ws.cell(row=r, column=4, value=source_note).font = Font(name='Noto Sans KR', size=9, color='666666')
    if options:
        dv = DataValidation(type='list', formula1=f'"{",".join(options)}"', allow_blank=False)
        ws.add_data_validation(dv)
        dv.add(c)
    return r + 1

def formula_row(ws, r, label, formula, fill=None):
    ws.cell(row=r, column=1, value=label).font = Font(name='Noto Sans KR', size=10, color='333333')
    c = ws.cell(row=r, column=2, value=formula)
    c.font = MONO
    c.border = BORDER
    c.alignment = Alignment(horizontal='right')
    c.number_format = '#,##0"원"'
    if fill:
        c.fill = fill
    return r + 1

# SKT 계산기
r = calc_sheet_header(ws, 1, '🧮 SKT 요즘가족결합 계산기', 'ef4444')

# 입력
ws.cell(row=r, column=1, value='📝 입력 (노란 셀 수정)').font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
r += 1
r = input_row(ws, r, '속도', '500M', 'D.skt.internet', ['100M','500M','1G'])
r = input_row(ws, r, 'TV 상품 (1=없음, 2~10=선택)', 4, '1=TV없음, 2=이코노미, 3=스탠다드, 4=올, ..., 10=올넷프리미엄')
r = input_row(ws, r, 'WiFi 사용', 'N', 'Y/N', ['Y','N'])
r = input_row(ws, r, '휴대폰 회선수', 3, '1~5 (0=결합 없음)')
r += 1

# 계산 (수식 기반)
ws.cell(row=r, column=1, value='🧮 자동 계산').font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
r += 1

# 참조 셀 위치
SP, TV, WIFI, LINES = 'B4', 'B5', 'B6', 'B7'

# 속도별 인터넷 단독가
r = formula_row(ws, r, '인터넷 단독가',
    f'=IF({SP}="100M",22000,IF({SP}="500M",33000,38500))')

# TV 상품 정보 (9개 배열)
r = formula_row(ws, r, 'TV 상품 가격 (p)',
    f'=IF({TV}=1,0,CHOOSE({TV}-1,12100,15400,18700,23100,24200,27700,30200,30700,33200))')
tv_p_row = r - 1

r = formula_row(ws, r, 'TV 결합 할인 (dc)',
    f'=IF({TV}=1,0,2200)')
tv_dc_row = r - 1

# WiFi 추가금 (SKT 전속도 1,100)
r = formula_row(ws, r, 'WiFi 추가금',
    f'=IF({WIFI}="Y",1100,0)')

# TV 결합가 (noWifi/withWifi)
r = formula_row(ws, r, 'tvInternetNoWifi',
    f'=IF({SP}="100M",19800,IF({SP}="500M",27500,33000))')
r = formula_row(ws, r, 'tvInternetWithWifi',
    f'=IF({SP}="100M",22000,IF({SP}="500M",28600,34100))')

# 요즘가족결합 인터넷 할인
r = formula_row(ws, r, '요즘가족결합 인터넷 할인',
    f'=IF({LINES}=0,0,IF({SP}="100M",4400,IF({SP}="500M",11000,13200)))')
fam_inet_row = r - 1

# IPTV 추가
r = formula_row(ws, r, 'IPTV 추가 할인 (TV 있고 결합 시)',
    f'=IF(AND({LINES}>0,{TV}>1),1100,0)')
fam_iptv_row = r - 1

# 휴대폰 인당 할인 (속도×회선수)
r = formula_row(ws, r, '휴대폰 인당 할인',
    f'=IF({LINES}=0,0,IF({SP}="100M",CHOOSE({LINES},3500,3500,6000,4500,3600),CHOOSE({LINES},3500,3500,6000,6000,4800)))')
fam_mob_per_row = r - 1

# 휴대폰 총 할인
r = formula_row(ws, r, '휴대폰 총 할인 (인당 × 회선수)',
    f'=B{fam_mob_per_row}*{LINES}')
fam_mob_total_row = r - 1
r += 1

# 결과
ws.cell(row=r, column=1, value='💰 결과').font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
r += 1

# 경로 A: 요즘우리집 (휴대폰 결합 X)
ws.cell(row=r, column=1, value='【경로 A】 휴대폰 결합 X').font = Font(name='Noto Sans KR', size=11, bold=True, color='666666')
r += 1
r = formula_row(ws, r, '  월 기본요금 (요즘우리집)',
    f'=IF({WIFI}="Y",B10,B9)+IF({TV}=1,0,B7-B8)+IF({TV}=1,0,4400)',
    SKT_FILL)
# Note: B9=tvInternetNoWifi, B10=tvInternetWithWifi, B7=TV 가격 (tv_p_row=7), B8=TV 할인 (tv_dc_row=8)
# Recalculate actual rows based on structure
# Actually let me just use explicit cell references

# Re-approach: write formulas with cell references I know
# After input rows (rows 4-7), formulas start at row 9
# Let me reconstruct properly - simpler to hardcode values based on row positions

# Better approach: use named references. But for simplicity, let me use direct cell refs.
# The actual layout:
#   Row 4: 속도 input = B4
#   Row 5: TV input = B5
#   Row 6: WiFi input = B6
#   Row 7: 회선수 input = B7
#   Row 9: title
#   Row 10: 단독가 = B10
#   Row 11: TV p = B11
#   Row 12: TV dc = B12
#   Row 13: WiFi 추가 = B13
#   Row 14: tvInternetNoWifi = B14
#   Row 15: tvInternetWithWifi = B15
#   Row 16: 요즘가족 인터넷 = B16
#   Row 17: IPTV 추가 = B17
#   Row 18: 휴대폰 인당 = B18
#   Row 19: 휴대폰 총 = B19

# The formula I wrote above has wrong refs. Let me rewrite explicitly.

# Reset the problematic cell
ws.cell(row=r-1, column=2, value='=B14+(B11-B12)+IF(B5=1,0,4400)')

# Explain: if TV=1 (no TV), base = internet + wifi; else = tvInternetNoWifi + tvFinal + setTop
# But above simplified - let me do properly with IF
ws.cell(row=r-1, column=2, value='=IF(B5=1,B10+B13,B14+(B11-B12)+4400)')
# Note: uses tvInternetNoWifi (no wifi used in formula for simplicity per example 기본)
# Actually should respect WiFi choice
ws.cell(row=r-1, column=2, value='=IF(B5=1,B10+B13,IF(B6="Y",B15,B14)+(B11-B12)+4400)')

# 경로 B: 요즘가족결합 (REPLACE)
ws.cell(row=r, column=1, value='【경로 B】 휴대폰 결합 O (요즘가족)').font = Font(name='Noto Sans KR', size=11, bold=True, color='ef4444')
r += 1

# 인터넷 after family (단독가 기준)
r = formula_row(ws, r, '  인터넷 (단독가 - 요즘가족할인)',
    '=B10+B13-B16', SKT_FILL)
inet_after_row = r - 1

# TV after family (tvBase - tvDc - iptv)
r = formula_row(ws, r, '  TV (기본 - 결합할인 - IPTV 추가)',
    '=IF(B5=1,0,B11-B12-B17)', SKT_FILL)
tv_after_row = r - 1

# 셋톱
r = formula_row(ws, r, '  셋톱박스 (TV 있을 때만)',
    '=IF(B5=1,0,4400)', SKT_FILL)
settop_row = r - 1

# 인터넷+TV 월 실납부
r = formula_row(ws, r, '  = 인터넷+TV 월 실납부',
    f'=B{inet_after_row}+B{tv_after_row}+B{settop_row}', SKT_FILL)
bundle_total_row = r - 1

# 휴대폰 별도
r = formula_row(ws, r, '  - 휴대폰 고지서 별도 차감',
    '=-B19', SKT_FILL)

# 혜택가
r = formula_row(ws, r, '🎉 혜택가 (최종)',
    f'=B{bundle_total_row}-B19')
c = ws.cell(row=r-1, column=2)
c.fill = PatternFill('solid', fgColor='fef2f2')
c.font = Font(name='SF Mono', size=14, bold=True, color='ef4444')
c.number_format = '#,##0"원"'

r += 1
# 부가
ws.cell(row=r, column=1, value='🎁 부가 (참고)').font = Font(name='Noto Sans KR', size=12, bold=True, color='666666')
r += 1
r = formula_row(ws, r, '  설치비 (1회성)',
    '=IF(B5=1,36300,56100)')
r = formula_row(ws, r, '  사은품 (속도×TV결합)',
    '=IF(B5=1,IF(B4="100M",110000,170000),CHOOSE(MATCH(B4,{"100M","500M","1G"},0),400000,430000,490000))')

r += 2
c = ws.cell(row=r, column=1, value='※ B4(속도)·B5(TV)·B6(WiFi)·B7(회선) 입력 셀만 수정하면 자동 재계산됩니다.')
c.font = Font(name='Noto Sans KR', size=10, italic=True, color='666666')
ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)

# ═══════════════════════════════════════════════
# 41_CALC_Interactive_KT (대화형 계산기 — KT 총액결합)
# ═══════════════════════════════════════════════
ws = wb.create_sheet('41_CALC_Interactive_KT')
for col, w in zip('ABCDE', [24, 18, 18, 18, 30]):
    ws.column_dimensions[col].width = w

r = calc_sheet_header(ws, 1, '🧮 KT 총액결합 계산기 (STACK)', '2563eb')

ws.cell(row=r, column=1, value='📝 입력').font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
r += 1
r = input_row(ws, r, '속도', '500M', '100M/500M/1G', ['100M','500M','1G'])
r = input_row(ws, r, 'TV 상품 (1=없음, 2~6=선택)', 3, '1=없음, 2=베이직, 3=라이트, 4=에센스, 5=모든G, 6=디즈니+')
r = input_row(ws, r, 'WiFi 사용', 'Y', 'Y/N', ['Y','N'])
r = input_row(ws, r, '총액결합 구간 (1~6)', 4, '1=22K↓, 2=22K↑, 3=64.9K↑, 4=108.9K↑, 5=141.9K↑, 6=174.9K↑')
r += 1

ws.cell(row=r, column=1, value='🧮 자동 계산').font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
r += 1

r = formula_row(ws, r, '인터넷 단독가',
    '=IF(B4="100M",22000,IF(B4="500M",33000,38500))')
r = formula_row(ws, r, 'TV 가격',
    '=IF(B5=1,0,CHOOSE(B5-1,14740,15840,20240,21340,28100))')
r = formula_row(ws, r, 'TV 결합할인',
    '=IF(B5=1,0,CHOOSE(B5-1,2640,2640,3740,4400,6600))')
r = formula_row(ws, r, 'WiFi 추가금 (속도별)',
    '=IF(B6="Y",IF(B4="1G",0,1100),0)')
r = formula_row(ws, r, 'tvInternetNoWifi',
    '=IF(B4="100M",22000,IF(B4="500M",27500,33000))')
r = formula_row(ws, r, 'tvInternetWithWifi',
    '=IF(B4="100M",23100,IF(B4="500M",28600,33000))')

r = formula_row(ws, r, '총액결합 인터넷 할인',
    '=IF(B4="100M",CHOOSE(B7,1650,3300,5500,5500,5500,5500),IF(B4="500M",CHOOSE(B7,2200,5500,5500,5500,5500,5500),CHOOSE(B7,2200,5500,5500,5500,5500,5500)))')
kt_inet_dc = r - 1

r = formula_row(ws, r, '총액결합 휴대폰 할인',
    '=IF(B4="100M",CHOOSE(B7,0,0,3300,14300,18700,23100),CHOOSE(B7,0,0,5500,16610,22110,27610))')
kt_mob_dc = r - 1

r += 1
ws.cell(row=r, column=1, value='💰 결과').font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
r += 1

# TV 있을 때: tvInternet(WiFi유무) + TV결합가 + 셋톱 - 총액결합할인
# TV 없을 때: 단독가 + WiFi - 총액결합할인
r = formula_row(ws, r, '  인터넷 결합가 (기본 TV결합)',
    f'=IF(B5=1,B10+B13,IF(B6="Y",B15,B14))', KT_FILL)
kt_netbase = r - 1

r = formula_row(ws, r, '  - 총액결합 추가 할인 (STACK)',
    f'=-B{kt_inet_dc}', KT_FILL)

r = formula_row(ws, r, '  TV 최종',
    '=IF(B5=1,0,B11-B12)', KT_FILL)
kt_tv = r - 1

r = formula_row(ws, r, '  셋톱박스',
    '=IF(B5=1,0,4400)', KT_FILL)
kt_settop = r - 1

r = formula_row(ws, r, '  = 인터넷+TV 월 실납부',
    f'=B{kt_netbase}-B{kt_inet_dc}+B{kt_tv}+B{kt_settop}', KT_FILL)
kt_total_row = r - 1

r = formula_row(ws, r, '  - 휴대폰 고지서 별도 차감',
    f'=-B{kt_mob_dc}', KT_FILL)

r = formula_row(ws, r, '🎉 혜택가 (최종)',
    f'=B{kt_total_row}-B{kt_mob_dc}')
c = ws.cell(row=r-1, column=2)
c.fill = PatternFill('solid', fgColor='eff6ff')
c.font = Font(name='SF Mono', size=14, bold=True, color='2563eb')
c.number_format = '#,##0"원"'

# ═══════════════════════════════════════════════
# 42_CALC_Interactive_LGU (대화형 계산기 — LG U+)
# ═══════════════════════════════════════════════
ws = wb.create_sheet('42_CALC_Interactive_LGU')
for col, w in zip('ABCDE', [24, 18, 18, 18, 30]):
    ws.column_dimensions[col].width = w

r = calc_sheet_header(ws, 1, '🧮 LG U+ 참쉬운가족결합 계산기', 'e40981')

ws.cell(row=r, column=1, value='📝 입력').font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
r += 1
r = input_row(ws, r, '속도', '500M', '100M/500M/1G', ['100M','500M','1G'])
r = input_row(ws, r, 'TV 상품 (1=없음, 2~5=선택)', 3, '1=없음, 2=실속형, 3=기본형, 4=프리미엄, 5=프리미엄 VOD')
r = input_row(ws, r, '휴대폰 요금 구간 (1~3)', 2, '1=69K미만, 2=69K↑, 3=88K↑')
r = input_row(ws, r, '결합 회선수 (2~4)', 3, '2/3/4+ (1회선은 결합 불가)')
r += 1

ws.cell(row=r, column=1, value='🧮 자동 계산').font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
r += 1

r = formula_row(ws, r, '인터넷 단독가',
    '=IF(B4="100M",22000,IF(B4="500M",33000,38500))')
r = formula_row(ws, r, 'TV 가격',
    '=IF(B5=1,0,CHOOSE(B5-1,15400,16500,18700,24200))')
r = formula_row(ws, r, 'TV 결합할인',
    '=IF(B5=1,0,CHOOSE(B5-1,2200,2200,2200,5500))')
r = formula_row(ws, r, 'WiFi 추가금 (전속도 무료)',
    '=0')
r = formula_row(ws, r, '참쉬운 인터넷 할인',
    '=IF(B4="100M",5500,IF(B4="500M",9900,13200))')
lgu_inet_dc = r - 1

# 휴대폰 할인 (3×3 매트릭스)
r = formula_row(ws, r, '참쉬운 휴대폰 인당 할인',
    '=CHOOSE(B6,CHOOSE(MIN(B7,4)-1,2200,3300,4400),CHOOSE(MIN(B7,4)-1,3300,5500,6600),CHOOSE(MIN(B7,4)-1,4400,6600,8800))')
lgu_mob_per = r - 1

r = formula_row(ws, r, '휴대폰 총 할인',
    f'=B{lgu_mob_per}*MIN(B7,4)')
lgu_mob_total = r - 1

r += 1
ws.cell(row=r, column=1, value='💰 결과').font = Font(name='Noto Sans KR', size=12, bold=True, color='1a2744')
r += 1

r = formula_row(ws, r, '  인터넷 (단독가 - 참쉬운할인)',
    f'=B10+B13-B{lgu_inet_dc}', LGU_FILL)
lgu_inet_after = r - 1

r = formula_row(ws, r, '  TV 최종',
    '=IF(B5=1,0,B11-B12)', LGU_FILL)
lgu_tv = r - 1

r = formula_row(ws, r, '  셋톱박스',
    '=IF(B5=1,0,4400)', LGU_FILL)
lgu_settop = r - 1

r = formula_row(ws, r, '  = 인터넷+TV 월 실납부',
    f'=B{lgu_inet_after}+B{lgu_tv}+B{lgu_settop}', LGU_FILL)
lgu_total_row = r - 1

r = formula_row(ws, r, '  - 휴대폰 고지서 별도 차감',
    f'=-B{lgu_mob_total}', LGU_FILL)

r = formula_row(ws, r, '🎉 혜택가 (최종)',
    f'=B{lgu_total_row}-B{lgu_mob_total}')
c = ws.cell(row=r-1, column=2)
c.fill = PatternFill('solid', fgColor='fdf2f8')
c.font = Font(name='SF Mono', size=14, bold=True, color='e40981')
c.number_format = '#,##0"원"'

# ═══════════════════════════════════════════════
# 20_Schema (JSON 스키마)
# ═══════════════════════════════════════════════
ws = wb.create_sheet('20_Schema')
ws.column_dimensions['A'].width = 80
r = add_section_title(ws, 1, '📐 D 객체 JSON 스키마 (TypeScript 인터페이스)', '1a2744')

schema_lines = [
    'interface CarrierData {',
    '  name: string;          // "SKT (B tv)"',
    '  prefix: string;        // "SK" | "KT" | "LG"',
    '  internet: Record<"100M"|"500M"|"1G", number>;',
    '  wifiCost?: number;     // SKT, LGU+ 사용 (단일값)',
    '  wifiPrice?: Record<"100M"|"500M"|"1G", number>;  // KT 사용 (속도별)',
    '  setTopOptions: SetTop[];',
    '  wifiOptions: WiFi[];',
    '  tvInternetNoWifi: Record<"100M"|"500M"|"1G", number>;',
    '  tvInternetWithWifi: Record<"100M"|"500M"|"1G", number>;',
    '  tv: TVProduct[];',
    '  install: { solo: number; combo: number; };',
    '  gift: { solo: SpeedMap; combo: SpeedMap; };',
    '  bundle: BundleConfig;  // 통신사별 상이',
    '}',
    '',
    'interface SetTop { id: string; name: string; fee: number; isDefault?: boolean; active: boolean; }',
    'interface WiFi { id: string; name: string; fees: Record<"100M"|"500M"|"1G", number>; isDefault?: boolean; active: boolean; }',
    'interface TVProduct { n: string; p: number; dc: number; }  // n=이름, p=단독가, dc=결합할인',
    '',
    'type BundleConfig =',
    '  | { family: SktFamily }                              // SKT',
    '  | { ranges_total, total, ranges_fixed, fixed, premium }  // KT',
    '  | { chweyswun, together };                           // LGU+',
    '',
    'interface SktFamily {',
    '  internet: SpeedMap;',
    '  iptv: number;  // 1100',
    '  mobilePerBySpeed: Record<Speed, Record<1|2|3|4|5, number>>;',
    '}',
    '',
    'interface KTTotal {',
    '  internet: Record<Speed, number[]>;  // 6구간',
    '  mobile: Record<Speed, number[]>;    // 6구간',
    '}',
    '',
    'interface KTPremium {',
    '  internet: 5500;',
    '  planCatalog: Array<{ v: number; label: string; dc: number; prem: boolean }>;',
    '}',
    '',
    'interface LguChweyswun {',
    '  internet: SpeedMap;',
    '  planLabels: string[];  // 3개',
    '  mobile: number[][];    // 3 (요금구간) × 3 (회선수)',
    '}',
    '',
    'interface LguTogether {',
    '  internet: SpeedMap;  // 100M=0 (불가)',
    '  mobile: [number, number, number];  // 2/3/4+회선',
    '}',
    '',
    'type Speed = "100M" | "500M" | "1G";',
    'type SpeedMap = Record<Speed, number>;',
]
for line in schema_lines:
    c = ws.cell(row=r, column=1, value=line)
    c.font = Font(name='SF Mono', size=10, color='1a2744')
    r += 1

# 저장
import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print(f'✅ {OUT} 생성 완료 ({len(wb.sheetnames)} 시트)')
print('   시트:', ', '.join(wb.sheetnames))

# 스크립트 자체를 리포지토리 scripts/ 폴더에도 복사 (유지보수용)
os.makedirs(os.path.dirname(SCRIPT_OUT), exist_ok=True)
import shutil
shutil.copy(__file__, SCRIPT_OUT)
print(f'✅ 스크립트 {SCRIPT_OUT}에 보관')
