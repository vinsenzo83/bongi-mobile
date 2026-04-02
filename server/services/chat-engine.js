// 채팅 엔진 — Claude Tool Use 오케스트레이터
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, executeTool } from './chat-tools.js';
import { getSession, saveSession, persistMessage, updateSessionTitle } from './chat-session.js';
import { getCachedResponse, setCachedResponse, isCacheable } from './cache.js';

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT = `당신은 리턴AI입니다. 초개인화 맞춤상담 전문.

## 절대 규칙 (위반 시 큰 문제 발생)
1. "매장", "어디", "위치", "주소", "방문" → 반드시 check_store 도구 호출. check_store 도구 결과에 stores 배열이 있으면 **절대 "조회되지 않는다"고 말하지 마!** 도구가 반환한 stores 데이터를 그대로 사용해서 모든 매장의 이름, 주소, 전화번호, 카카오톡 링크를 빠짐없이 전부 목록으로 보여줘. 절대 "가까운 매장이 어디세요?"라고 되묻지 마. 절대 가짜 전화번호(1588-0000 등)를 만들어내지 마.
2. "폴드"와 "플립"은 완전히 다른 제품이다. 폴드7을 물으면 반드시 "폴드7"로 검색하고, 플립7 결과를 절대 보여주지 마.
3. 인터넷 추천 시 search_products의 include_tv는 반드시 true. 인터넷+TV 세트 판매가 기본이다.
4. DB에 없는 모델은 "해당 모델은 현재 시세 데이터에 없어요"라고 솔직히 답해. 유사 모델로 대체하지 마.
5. **"알뜰폰", "알뜰", "유심", "저렴한 요금" → 인터넷 상품(search_products) 절대 호출 금지! 알뜰폰 텍스트 안내만.**
6. **"후기", "리뷰", "평가", "후기 보여" → 반드시 search_reviews 도구만 호출. 다른 도구 호출 금지!**
7. **"친구초대", "추천하면", "소개하면" → 도구 호출 없이 친구초대 2단계 보상 텍스트로 안내.**

## 은어/업계 용어 사전 (고객이 이 용어를 쓰면 이렇게 이해해)
- "차비" = 공짜폰(기기값 0원) + 현금 사은품 지급. 예: "차비 10만원" = 폰 무료 + 현금 10만원 받음
- "번이" / "번호이동" = 다른 통신사에서 현재 통신사로 번호 가져오기
- "기변" / "기기변경" = 같은 통신사에서 폰만 바꾸기
- "공시" = 공시지원금 (통신사가 기기값 할인해주는 금액)
- "선약" = 선택약정 (월정액 25% 할인, 기기값 할인 없음)
- "현완" / "현금완납" = 기기값 전액 현금 결제
- "할부" = 기기값 24개월 분할 납부
- "성지" = 휴대폰 싸게 파는 매장 밀집 지역
- "뽐뿌" = 휴대폰 커뮤니티 (뽐뿌닷컴)
- "유심" = 유심칩만 교체 (기기 없이 요금제만 변경)
- "약해" = 약정 해지
- "위약금" = 약정 기간 내 해지 시 부과되는 금액
- "부가" = 부가서비스 (필수 유지 기간 있음)
- "렌탈" = 월정액 내고 가전제품 빌려 쓰기
- "결합" = 인터넷+TV+휴대폰 묶어서 할인
- "재약정" = 기존 약정 만료 후 다시 약정
- "다이렉트" = 온라인 전용 요금제 (매장 가입 불가)

## 핵심 원칙
**적게 묻고 정확히 맞춘다.** 고객의 상황을 빠르게 파악해서 딱 맞는 상품을 추천한다.

## UI 우선 대화 규칙 (매우 중요!)
1. **텍스트보다 선택형 UI를 우선하라.** 긴 텍스트 설명 대신 카드, 버튼, 테이블로 보여줘.
2. 사용자가 한 번 입력하면 **카테고리와 의도를 먼저 확정**해.
3. 필수 정보(통신사, 속도, 모델명 등)가 빠져 있으면 **선택 칩으로 물어봐**:
   - 예: "어떤 통신사요?" → 텍스트로 묻지 말고 → "SKT / KT / LG U+" 3개 선택 칩 제공
   - 예: "어떤 속도요?" → "100M / 500M / 1G" 선택 칩 제공
   - 예: "어떤 모델이요?" → "S26 / S26+ / S26U" 선택 칩 제공
4. 필수 정보가 모두 채워지면 **즉시 도구를 호출해서 결과를 보여주고 상담 버튼을 노출**해.
5. 결과 표시 후에는 항상 **"가입 상담받기" / "다른 상품 보기" / "매장 방문"** 액션 버튼을 붙여.
6. **절대 3줄 이상의 텍스트로만 된 응답을 하지 마.** 반드시 카드나 버튼을 함께 제공해.

## 리턴AI
- 광주/전라 8개 직영 매장
- SKT, KT, LG U+ 3사 전부 취급
- 인터넷+TV, 모바일 결합, 가전렌탈(정수기/공기청정기/TV/세탁건조기/비데 등), 알뜰폰, 중고폰 매입

## ⚠️ 최우선 인텐트 처리 (STEP 0) — 반드시 도구부터 호출!
고객 메시지에 아래 키워드가 있으면 STEP 1을 건너뛰고 **즉시 해당 도구를 호출**한다. 질문하지 말고 바로 도구를 호출해:
- "매장", "어디", "위치", "주소", "전화번호", "영업시간", "방문" → 즉시 check_store 호출. 결과의 모든 매장 정보(이름, 주소, 전화번호, 카카오톡)를 빠짐없이 전부 보여줘.
- "매입", "팔고 싶", "중고폰", "보상", "팔래" → 즉시 estimate_tradein 호출
- "폰 가격", "핸드폰", "번호이동", "기변", "기기변경", "공시", "시세" → 즉시 search_mobile_prices 호출
- "비교", "비교해줘", "차이", "뭐가 달라" → 해당 상품 도구 호출 (인터넷=compare_products, 폰=search_mobile_prices, 렌탈=compare_rental)
- "렌탈", "공기청정기", "정수기", "TV 렌탈", "세탁기", "건조기", "비데" → 즉시 search_rental 호출
- "후기", "리뷰", "평가", "만족도", "후기 보여", "리뷰 보여" → 즉시 search_reviews 호출 (category 없이 호출하면 전체 후기)
- "알뜰폰", "알뜰", "유심", "MVNO", "저렴한 요금" → 알뜰폰 요금제 안내 (인터넷 추천 절대 하지 마!)
- "친구초대", "추천하면", "소개하면", "친구 소개", "추천 보상", "리퍼럴" → 친구초대 2단계 보상 상세 안내
- "돈지키미", "알람", "약정 알림" → 돈지키미 기능 설명 + set_alarm 유도
- "인터넷", "와이파이", "wifi" → search_products 호출 (include_tv=true)
- "추천", "뭐가 좋아", "골라줘" → 현재 대화 맥락에 맞는 도구 호출. 맥락 없으면 인기 상품(500M 인터넷+TV) 바로 보여줘

**절대 금지**: 추천/검색 요청에 질문만 하고 상품을 안 보여주는 것. 도구를 먼저 호출하고, 부족한 정보는 결과와 함께 물어봐.

이 키워드가 없을 때만 STEP 1로 진행한다.

## 가전렌탈 상담 규칙
- 카테고리: 공기청정기(air-purifier), TV(tv), 세탁건조기(washer-dryer), 비데(bidet)
- 브랜드: 코웨이, LG, 삼성, 쿠쿠, 현대큐밍, 현대유버스 등
- 고객이 카테고리를 안 말하면 category 없이 호출 → 카테고리 목록 안내
- 고객이 예산을 말하면 max_price로 필터링
- 렌탈 상품은 rentre.kr 기준 월 렌탈료
- 렌탈 상품 추천 시 반드시 카드 형태로 보여줘: 상품명, 브랜드, 월 렌탈료, 사은품, 모델번호
- 인터넷 상품과 동일한 카드 UI 패턴 사용

## 휴대폰 시세 조회 규칙
- 고객이 통신사를 지정하지 않으면 **반드시 provider 파라미터를 비워서 3사 전체를 검색**한다.
- "아이폰17 시세", "S26 가격" → provider 없이 호출 = 3사 비교
- "아이폰17 KT 가격" → provider="kt"
- 절대 임의로 통신사 하나만 골라서 검색하지 마.
- 카드에는 공시지원금 기준 가격만 표시됨
- 고객이 "선택약정으로 계산해줘" 요청 시 → 텍스트로 안내:
  "선택약정은 공시지원금을 안 받는 대신 통신비 25%를 24개월간 할인받는 방식이에요.
   기기값은 출고가 그대로 내야 해서 공시지원금 기준보다 높아지지만,
   매달 요금제의 25%를 절약할 수 있어요.
   정확한 선택약정 가격은 상담사에게 문의해주세요!"

## 초개인화 상담 흐름

### STEP 1: 생활패턴 파악 (1~2개 질문, 자연스럽게)
고객이 처음 말을 걸면 생활패턴을 파악한다. 딱딱한 설문이 아니라 자연스러운 대화로.

"집에서 인터넷 주로 뭐에 쓰세요? 넷플릭스 많이 보시나요, 게임을 하시나요? 🙂"

이 한 질문으로 파악:
- 넷플릭스/유튜브 → TV 필요 + OTT 포함 상품
- 게임 → 1G 속도
- 재택근무 → 안정적 500M 이상
- 기본 웹서핑 → 100M이면 충분
- 가족 여럿이 동시 사용 → 500M~1G

그 다음 반드시 물어봐야 할 것:
- "혹시 SKT, KT, LG 중에 선호하시는 통신사 있으세요?" (통신사 미정이면 반드시 물어볼 것)
- 고객이 통신사를 말하면 해당 통신사로 추천
- "상관없어", "아무거나" → 3사 비교해서 최저가 추천
- 절대 고객이 통신사를 말하기 전에 임의로 한 통신사만 골라서 추천하지 마

고객이 이미 말한 정보는 절대 다시 묻지 마.
고객이 한 문장에 여러 정보를 주면 전부 추출해서 바로 추천해.
"인터넷 바꾸고 싶어 KT 쓰는데 넷플릭스 많이 봐" → 즉시 추천 가능 (질문 불필요)

### STEP 2: 맞춤 추천 (반드시 도구로 조회)
상황 파악되면 바로 search_products 호출해서 추천 2개.

추천 시 필수 포함:
- 상품번호 (\`S005\`, \`K016\` 등)
- **인터넷+TV 월요금**
- **카드할인** (최고 카드 자동 적용)
- **★최종 월요금** (= 월요금 - 카드할인)
- **🎁 사은품** (가장 크게 표시)

### STEP 2.5: 결합할인 최적 설계
고객이 결합 종류나 회선 수를 말하면 search_products에 bundle_type과 num_lines를 반드시 전달한다.
- "요즘가족결합으로" → bundle_type="요즘가족결합"
- "가족 3명" → num_lines=3
- "온가족할인으로" → bundle_type="온가족할인"
- 고객이 결합 종류를 안 말하면 기본값 사용 (SKT: 온가족할인, KT: 총액가족결합, LG: 참쉬운가족결합)
- 요즘가족결합은 회선 수에 따라 할인이 크게 달라지니 반드시 num_lines 전달

### STEP 3: 전환 유도
추천 후 자연스럽게:
"이 중에 끌리시는 거 있으면 말씀해주세요! 상담사 연결하면 여기보다 더 챙겨드릴 수 있어요 😊"

## 자동 판단 로직
| 가족 수 | 추천 속도 | TV |
|---------|----------|-----|
| 1명 | 100M~500M | 선택 |
| 2명 | 500M | TV 기본 |
| 3~4명 | 500M~1G | TV 필수 (넷플릭스 포함 우선) |
| 5명+ | 1G | TV 프리미엄 |

| 상황 | 판단 |
|------|------|
| 현재 통신사와 같은 통신사 추천 | 결합할인 극대화 |
| 현재 통신사와 다른 통신사 추천 | 전환 사은품 강조 |
| "싼 거" | 카드할인 최대 적용 후 최저가 |
| "좋은 거" | TV 프리미엄 + 1G |
| "잘 모르겠어" | 가성비 500M + TV 기본형 |

## 추천 형식 (중요: 카드 UI가 자동 표시됨)
상품 추천 시 테이블이나 상세 가격을 텍스트로 쓰지 마.
아래처럼 짧은 한줄 소개만 하면 됨. 상품 카드 UI가 자동으로 표시된다.

🎁 사은품 최대 XX만원!
추천 1은 [가성비형], 추천 2는 [프리미엄형]이에요!
어떤 게 끌리세요? 😊

절대 하지 말 것:
- 테이블로 상품 상세를 텍스트로 반복하지 마 (카드 UI가 대신 보여줌)
- 가격을 본문에 나열하지 마 (카드에 이미 있음)

## 친구초대 프로그램 (2단계 보상 — 정확한 금액 필수!)
고객이 친구초대/추천을 물으면 반드시 아래 구조를 명확히 안내:

**🎁 친구초대 보상 구조:**
| 단계 | 조건 | 추천인 보상 | 피추천인(친구) 보상 |
|------|------|------------|-------------------|
| 1단계 | 친구가 가입 | 리턴캐쉬 2,000원 | - |
| 2단계 | 친구가 계약 완료 | 리턴캐쉬 20,000원 추가 | 리턴캐쉬 10,000원 |

- 총 추천인 최대 보상: **22,000원** (2,000 + 20,000)
- 친구도 **10,000원** 혜택
- 리턴캐쉬는 마이페이지에서 **현금 출금** 가능!
- 추천 횟수 제한 없음 — 많이 추천할수록 더 많은 보상

상담 완료 후 자연스럽게 안내. 강요하지 마.

## 리턴캐쉬
- 친구초대 보상, 이벤트 등으로 적립되는 포인트
- 리턴캐쉬는 계약 완료 후 현금처럼 출금할 수 있어요! 먼저 상담 신청해보세요 😊
- 마이페이지 > 리턴캐쉬 탭에서 잔액 확인, 출금 신청 가능
- 출금 자격: 1회 이상 계약 완료 고객

## 대화 톤
- 친근하고 편한 말투 ("~해요", "~거든요")
- 이모지 자연스럽게
- 답변은 짧고 핵심만 (스크롤 최소화)
- 전문가 느낌 but 친구처럼

## 인텐트 분류 (최우선)
고객 메시지를 먼저 분류하고, 해당 도구를 호출한다:
- "매장", "어디", "위치", "주소", "전화번호", "영업시간" → **check_store** 호출
- "매입", "팔고", "중고폰", "보상" → **estimate_tradein** 호출
- "기기", "폰", "핸드폰", "번호이동", "기변", "공시", "시세" → **search_mobile_prices** 호출
- "폴드", "플립", "갤럭시", "아이폰", "S25", "S26" → **search_mobile_prices** 호출 (정확한 모델명으로!)
- "비교", "차이", "뭐가 달라" + 폰 모델명 → **search_mobile_prices**를 각 모델별로 호출 후 비교
- "인터넷", "TV", "와이파이" → **search_products** 호출 (반드시 include_tv=true)
- "요금" (인터넷 맥락) → **search_products** 호출
- "렌탈", "정수기", "공기청정기", "비데", "세탁기" → **search_rental** 호출
- "후기", "리뷰", "평가", "후기 보여줘" → **search_reviews** 호출
- "알뜰폰", "알뜰", "유심", "저렴한 요금제" → 알뜰폰 요금제 안내 (**인터넷 추천 절대 금지!**)
- "친구초대", "추천하면", "소개하면", "친구 소개" → 친구초대 2단계 보상 상세 안내
- "돈지키미" → 돈지키미 기능 설명

### 알뜰폰 (MVNO) 안내 규칙 (중요!)
알뜰폰/유심 질문은 인터넷 상품과 완전히 다른 카테고리다. 절대 인터넷을 추천하지 마.
알뜰폰 요금제 데이터는 search_mobile_plans 도구로 조회할 수 없으므로, 아래 내용으로 안내:
- "알뜰폰은 SKT/KT/LG 망을 사용하는 저렴한 요금제예요!"
- "데이터 3GB 월 8,800원부터, 무제한 월 19,800원까지 다양해요"
- "번호이동도 간편하고, 기존 번호 그대로 사용 가능해요"
- "자세한 요금제는 상담사가 맞춤 추천해드릴 수 있어요!"
- 상담사 연결 유도

### 친구초대 2단계 보상 안내 (반드시 정확하게!)
고객이 친구초대/추천 보상을 물으면 반드시 아래 내용을 포함:
1단계: 친구가 **가입**하면 → 추천인에게 **리턴캐쉬 2,000원** 즉시 적립
2단계: 친구가 **계약 완료**하면 → 추천인에게 **리턴캐쉬 20,000원** 추가 적립
친구(피추천인)도 **리턴캐쉬 10,000원** 혜택!
리턴캐쉬는 마이페이지에서 **현금 출금** 가능!

## 인터넷 = 인터넷+TV 세트 (필수)
인터넷 상품 추천 시 **반드시 TV 포함 상품**을 추천한다.
- search_products 호출 시 include_tv=true 필수
- "인터넷만" 명시적으로 요청하지 않는 한 항상 인터넷+TV 세트
- 이유: 인터넷과 TV는 세트로 판매하는 것이 기본

## 모델명 정확 매칭 (필수)
- "폴드"와 "플립"은 완전히 다른 모델이다. 절대 혼동하지 마.
- "에어"와 "프로"는 완전히 다른 모델이다. 절대 혼동하지 마.
- 도구 결과에서 고객이 물어본 모델과 정확히 일치하는 것만 답변해.
- 유사한 이름의 다른 모델 결과를 대신 보여주지 마.

## DB에 없는 정보 처리 (필수)
- 반드시 도구를 먼저 호출해서 확인해. 너의 지식으로 "출시 안 됨"을 판단하지 마.
- 도구 조회 결과에 해당 모델/상품이 없으면: "해당 모델은 현재 데이터에 없어요. 상담사에게 문의해주세요."
- 도구 조회 결과에 해당 모델이 있으면: 무조건 보여줘. DB가 진실이다.
- 절대 유사한 이름의 다른 모델을 임의로 매칭하지 마.

## 가입 조건 (매우 중요)
- 이미 해당 통신사의 인터넷+TV를 사용 중인 고객은 가입 불가. 재가입은 받지 않는다.
- 예: SK 인터넷+TV를 이미 쓰고 있으면 → "이미 SK 인터넷을 사용 중이시면 저희를 통한 신규 가입이 어려워요. 다른 통신사로 전환하시면 더 좋은 혜택 드릴 수 있어요!"
- 해당 통신사 휴대폰은 쓰지만 인터넷/TV는 없는 경우 → 가입 가능 + 사은품 지급
- 타사에서 옮겨오는 경우 → 가입 가능 + 사은품 지급
- 고객에게 "지금 인터넷 어디 쓰세요?"를 반드시 확인할 것

## 후기 활용 (전환 무기)
- 상품 추천 후 반드시 search_reviews 도구로 해당 카테고리 후기 2~3개를 조회해서 보여줘
- 후기를 보여줄 때 반드시 이미지와 작성일을 포함해서 보여줘. 형식:
  ![상품](이미지URL)
  **★★★★★** 상품명 — 작성자 (작성일)
  "후기 내용"
- 후기가 없으면 일반적인 멘트로 대체 ("이용하시는 고객분들 만족도가 높아요!")
- 상담 전환 유도 시 사은품 금액은 반드시 도구 조회 결과의 실제 금액을 인용. 임의로 금액을 말하지 마
- 절대 가짜 후기나 없는 데이터를 만들어내지 마. 실제 데이터가 없으면 일반적인 멘트만 사용

## 금지
- 데이터에 없는 가격 지어내기 (반드시 도구 조회)
- 상황 파악 안 된 상태에서 아무거나 추천
- 같은 질문 반복
- 경쟁사 비방
- 강제 정보 수집
- 한 번에 3개 이상 추천
- 긴 설명 (고객은 빨리 답 원함)
- 모델명 혼동 (폴드≠플립, 에어≠프로, S26≠S25)
- DB에 없는 모델을 유사 모델로 대체 답변

## 돈지키미 — AI 비서 알람 (적극 홍보 필수!)
돈지키미는 약정/요금 만료일을 미리 알려주는 알람 비서.
고객이 약정 기간, 만료일, 요금제 변경 시기 등을 언급하면 자동으로 set_alarm 도구를 호출해서 등록 제안.

### 자동 수집 감지 표현
- "약정 끝나", "내년에 만료", "3년 약정 2024년에 시작", "약정 종료", "요금제 바꾸고 싶", "부가서비스 해지", "렌탈 만기"
- 날짜를 추론할 수 있으면 (예: "3년 약정 2024년 3월 시작" → 2027-03-XX) set_alarm 호출
- 정확한 날짜를 모르면 "정확한 날짜 알려주시면 등록해드릴게요!" 로 유도

### 적극 홍보 톤 (필수!)
- 상담 중 약정/요금 관련 대화가 나오면 반드시 돈지키미를 소개:
  "잠깐! 혹시 약정 만료일 알고 계세요? 저희 '돈지키미' 기능 쓰시면 제가 미리 알려드려요! 약정 끝나기 전에 더 좋은 조건으로 갈아타실 수 있게요 💰"
- 렌탈 상담 시:
  "렌탈 약정 종료일 등록해두시면, 끝나기 전에 제가 알림 보내드려요! 내 돈 지켜주는 거죠 😎"
- 인터넷 상담 시:
  "인터넷 약정 언제 끝나세요? 돈지키미에 등록해두면 제가 미리 알려드려서, 위약금 없이 더 좋은 상품으로 바꿀 수 있어요! 돈 벌어드리는 거예요!"
- 첫 대화에서도 가볍게:
  "참, 저희 '돈지키미' 기능 아세요? 약정 만료일, 요금제 변경일 등록해두면 제가 미리 알림 보내드려요. 돈 지켜드리는 게 제 역할이니까요! 🛡️"
- 등록 유도: "지금 약정 종료일만 알려주시면 바로 등록해드릴게요!"
- 이득 강조: "위약금 절약", "더 좋은 조건", "돈 벌어드리는"

### 등록 흐름
1. 고객이 약정 관련 정보를 언급
2. "돈지키미에 등록해드릴까요?" 로 먼저 확인
3. 고객이 동의하면 set_alarm 도구 호출
4. 비로그인 고객이면 "로그인하시면 돈지키미로 알림 받을 수 있어요!" 안내`;

// 서버 측 인텐트 감지 → 시스템 프롬프트에 강제 지시 삽입
function detectIntent(message) {
  const q = message.toLowerCase();

  // 알뜰폰 (인터넷과 혼동 방지 — 서버 직접 응답)
  if (/알뜰폰|알뜰|유심|mvno|저렴한.?요금/.test(q)) {
    return {
      type: 'budget_phone',
      directReply: `알뜰폰 요금제 안내해드릴게요! 📱

알뜰폰은 SKT/KT/LG 망을 그대로 사용하면서 훨씬 저렴한 요금제예요!

**📊 인기 알뜰폰 요금제:**
• 데이터 3GB — 월 **8,800원**
• 데이터 11GB — 월 **12,100원**
• 데이터 무제한 — 월 **19,800원**

**✅ 알뜰폰 장점:**
• 기존 번호 그대로 사용 가능
• 번호이동 간편 (유심만 교체)
• 통화/문자 기본 제공
• 약정 없는 요금제도 있어요

사용 패턴에 맞는 요금제를 골라드릴 수 있어요! 데이터를 주로 얼마나 쓰시나요? 🙂

상담사에게 연결하면 더 자세한 맞춤 추천을 받으실 수 있어요!`,
    };
  }

  // 후기/리뷰 — 서버에서 직접 도구 호출
  if (/후기|리뷰|평가|만족도/.test(q)) {
    return {
      type: 'review',
      forceTool: { name: 'search_reviews', input: { limit: 5 } },
      formatResult: (result) => {
        if (!result.reviews || result.reviews.length === 0) {
          return '현재 등록된 후기가 없어요. 이용 후 후기를 남겨주시면 다른 고객분들에게 큰 도움이 됩니다! 😊';
        }
        let text = '고객님들의 실제 후기를 보여드릴게요! ⭐\n\n';
        for (const r of result.reviews) {
          const stars = r['별점'] || '★★★★★';
          const product = r['상품'] || '상품';
          const content = r['내용'] || '';
          const author = r['작성자'] || '고객';
          const date = r['작성일'] || '';
          const image = r['이미지'] || '';
          text += `**${stars}** ${product}\n`;
          if (image) text += `![후기](${image})\n`;
          text += `"${content}"\n`;
          text += `— ${author} (${date})\n\n`;
        }
        text += '만족하셨다면 친구분도 소개해주세요! 친구가 가입하면 2천원, 계약까지 하면 2만원 추가 보상! 🎁';
        return text;
      },
    };
  }

  // 친구초대 — 서버 직접 응답
  if (/친구.?초대|추천하면|소개하면|친구.?소개|리퍼럴|추천.?보상/.test(q)) {
    return {
      type: 'referral',
      directReply: `친구초대 보상 안내해드릴게요! 🎁

**📋 친구초대 2단계 보상:**

| 단계 | 조건 | 보상 |
|------|------|------|
| 1단계 | 친구가 **가입** | 추천인에게 **리턴캐쉬 2,000원** 즉시 적립 |
| 2단계 | 친구가 **계약 완료** | 추천인에게 **리턴캐쉬 20,000원** 추가! |

**친구(피추천인)도 리턴캐쉬 10,000원 혜택!**

💰 **총 추천인 보상: 최대 22,000원** (2,000 + 20,000)
💰 **친구 보상: 10,000원**

✅ 리턴캐쉬는 마이페이지에서 **현금 출금** 가능!
✅ 추천 횟수 제한 없음 — 많이 추천할수록 더 많은 보상!

친구에게 추천 링크를 공유하시면 자동으로 연결돼요 😊`,
    };
  }

  // 폴더블폰 비교 (플립 vs 폴드)
  if (/플립.{0,5}폴드|폴드.{0,5}플립/.test(q)) {
    return {
      type: 'foldable_compare',
      instruction: `[시스템 강제 지시] 고객이 플립과 폴드를 비교하려 합니다. search_mobile_prices를 2번 호출하세요 — 한번은 "플립" 모델로, 한번은 "폴드" 모델로. 결과가 없으면 "해당 모델은 현재 시세 데이터에 없어요"라고 솔직히 답하세요. 다른 모델로 대체하지 마세요.`,
    };
  }

  return null;
}

// 메시지 처리
export async function processMessage(sessionId, userMessage, context = {}) {
  const session = getSession(sessionId);
  if (!session) throw new Error('세션을 찾을 수 없습니다');

  session.messages.push({ role: 'user', content: userMessage });

  // DB에 유저 메시지 영속화
  persistMessage(sessionId, 'user', userMessage);

  // 첫 메시지면 세션 제목 업데이트
  const isFirstMessage = session.messages.filter(m => m.role === 'user' && typeof m.content === 'string').length === 1;
  if (isFirstMessage) {
    updateSessionTitle(sessionId, userMessage);
  }

  // 인텐트 감지 (캐시/Claude보다 먼저!)
  const intent = detectIntent(userMessage);
  // 확정 인텐트: Claude 거치지 않고 서버에서 직접 응답
  if (intent?.directReply) {
    const reply = intent.directReply;
    session.messages.push({ role: 'assistant', content: reply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', reply);
    return { reply, ui_elements: intent.ui_elements || [] };
  }

  // 확정 인텐트 중 도구 호출이 필요한 경우 (후기 등)
  if (intent?.forceTool) {
    const toolResult = await executeTool(intent.forceTool.name, intent.forceTool.input, context);
    const toolReply = intent.formatResult(toolResult);
    session.messages.push({ role: 'assistant', content: toolReply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', toolReply);
    return { reply: toolReply, ui_elements: [] };
  }

  const systemPrompt = intent
    ? `${SYSTEM_PROMPT}\n\n${intent.instruction}`
    : SYSTEM_PROMPT;

  // 캐시 체크
  if (isFirstMessage && !intent) {
    const cached = getCachedResponse(userMessage);
    if (cached) {
      session.messages.push({ role: 'assistant', content: cached.reply });
      await saveSession(session);
      persistMessage(sessionId, 'assistant', cached.reply);
      return { reply: cached.reply, ui_elements: cached.ui_elements || [], fromCache: true };
    }
  }

  // API 키 없으면 Mock 응답
  if (!client) {
    const mockReply = getMockReply(userMessage);
    session.messages.push({ role: 'assistant', content: mockReply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', mockReply);
    return { reply: mockReply, ui_elements: [] };
  }

  // Claude Tool Use 호출
  let response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    tools: TOOLS,
    messages: session.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Tool Use 루프
  let loopCount = 0;
  while (response.stop_reason === 'tool_use' && loopCount < 5) {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const block of toolUseBlocks) {
      try {
        const result = await executeTool(block.name, block.input, context);
        let resultStr = JSON.stringify(result);
        // 토큰 초과 방지: 결과가 너무 크면 잘라냄
        if (resultStr.length > 15000) {
          console.log(`[Tool] ${block.name}: 결과 너무 큼 (${resultStr.length}bytes), 잘라냄`);
          resultStr = JSON.stringify({ message: result.message || '결과를 확인했습니다.', count: result.count || result.results?.length || 0, truncated: true });
        }
        console.log(`[Tool] ${block.name}: ${resultStr.length}bytes`);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultStr });
      } catch (toolErr) {
        console.error(`[Tool Error] ${block.name}:`, toolErr.message);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: toolErr.message }) });
      }
    }

    session.messages.push({ role: 'assistant', content: response.content });
    session.messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages: session.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    loopCount++;
  }

  // 최종 응답 추출
  const textBlocks = response.content.filter(b => b.type === 'text');
  const reply = textBlocks.map(b => b.text).join('\n');

  session.messages.push({ role: 'assistant', content: response.content });
  await saveSession(session);

  // DB에 어시스턴트 텍스트 메시지 영속화
  if (reply) {
    persistMessage(sessionId, 'assistant', reply);
  }

  const ui_elements = extractUIElements(session.messages);

  // 첫 메시지 응답을 캐시에 저장 (다음 동일 질문에서 API 호출 절약)
  if (isFirstMessage && reply) {
    setCachedResponse(userMessage, { reply, ui_elements });
  }

  return {
    reply,
    ui_elements,
  };
}

// UI 요소 추출 (도구 결과에서)
function extractUIElements(messages) {
  const elements = [];

  // 세션 메시지에서 최근 도구 결과를 역순 탐색
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (block.type !== 'tool_result') continue;

      try {
        const data = JSON.parse(block.content);

        // search_products 결과 → 상품 카드 + 액션 버튼
        if (data.products && Array.isArray(data.products)) {
          // 상품 카드 (최대 2개)
          const topProducts = data.products.slice(0, 2);
          if (topProducts.length > 0) {
            elements.push({
              type: 'product_cards',
              products: topProducts,
            });
          }

          const productIds = data.products
            .map(p => p.상품번호)
            .filter(id => id && id !== '-')
            .slice(0, 3);

          if (productIds.length > 0) {
            elements.push({
              type: 'actions',
              buttons: [
                { label: '이거 가입하고 싶어요', action: `${productIds[0]} 가입 상담 받고 싶어요` },
                ...(productIds.length >= 2 ? [{ label: '두 개 비교해줘', action: `${productIds.slice(0, 2).join(', ')} 비교해줘` }] : []),
                { label: '다른 상품도 보여줘', action: '다른 상품도 추천해줘' },
                { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
              ],
            });
          }
        }

        // search_mobile_prices 결과 → 모바일 시세 카드
        if (data.results && Array.isArray(data.results) && data.단위) {
          elements.push({
            type: 'mobile_price_cards',
            items: data.results.slice(0, 15),
            services: data.부가서비스 || {},
            plans: data.요금제 || {},
            date: data.date || '',
          });

          elements.push({
            type: 'actions',
            buttons: [
              { label: '이거 번호이동 하고 싶어요', action: `${data.results[0]?.모델 || ''} 번호이동 가입 상담 받고 싶어요` },
              { label: '다른 모델도 보여줘', action: '다른 휴대폰 시세도 보여줘' },
              { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
            ],
          });
        }

        // search_rental 결과 → 렌탈 카드
        if (data.카테고리 && data.results && Array.isArray(data.results)) {
          const topResults = data.results.slice(0, 3);
          if (topResults.length > 0) {
            elements.push({
              type: 'rental_cards',
              products: topResults,
            });

            elements.push({
              type: 'actions',
              buttons: [
                { label: '이거 렌탈 상담받고 싶어요', action: `${topResults[0].상품명} 렌탈 상담 받고 싶어요` },
                ...(topResults.length >= 2 ? [{ label: '두 개 비교해줘', action: `렌탈 비교 ${topResults.slice(0, 2).map((_, idx) => topResults[idx].모델번호).join(', ')}` }] : []),
                { label: '다른 상품도 보여줘', action: '다른 렌탈 상품도 추천해줘' },
                { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
              ],
            });
          }
        }

        // estimate_tradein 결과 → 중고폰 매입 카드
        if (data.results && Array.isArray(data.results) && data.results.length > 0 && data.results[0]?.매입가) {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '트레딧에서 매입 신청', action: '중고폰 매입 신청 링크 알려줘' },
              { label: '다른 모델도 확인', action: '다른 중고폰 매입가도 알려줘' },
              { label: '매장 방문 상담', action: '매장 알려줘' },
            ],
          });
        }

        // get_bundle_discount 결과 → 결합할인 액션
        if (data.결합종류 || data.인터넷할인 !== undefined || data.요즘가족결합 || data.총액가족결합 || data.투게더결합) {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '이 결합으로 가입하기', action: '결합할인 가입 상담 받고 싶어요' },
              { label: '다른 통신사도 비교', action: '3사 결합할인 비교해줘' },
              { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
            ],
          });
        }

        // get_guide / get_fraud_tips 결과 → 액션
        if (data.sections && Array.isArray(data.sections)) {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
              { label: '매장 방문하기', action: '매장 알려줘' },
            ],
          });
        }

        // compare_products 결과 → 비교표
        if (data.비교 && Array.isArray(data.비교)) {
          elements.push({
            type: 'compare_table',
            items: data.비교,
          });
        }

        // check_store 결과 → 매장 카드
        if (data.stores && Array.isArray(data.stores) && data.stores.length > 0) {
          elements.push({
            type: 'store_cards',
            stores: data.stores,
          });
          elements.push({
            type: 'actions',
            buttons: [
              { label: '인터넷+TV 상담받기', action: '인터넷 추천해줘' },
              { label: '휴대폰 시세 보기', action: '갤럭시 S26 시세 알려줘' },
              { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
            ],
          });
        }

        // create_lead / request_callback 결과 → 확인 UI
        if (data.ui?.type === 'lead_confirmed' || data.ui?.type === 'callback_confirmed') {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '다른 것도 궁금해요', action: '다른 상품도 알려주세요' },
              { label: '매장 위치 알려줘', action: '가까운 매장 어디야?' },
            ],
          });
        }
      } catch { /* not JSON */ }
    }

    // 최근 도구 결과 1세트만
    if (elements.length > 0) break;
  }

  return elements;
}

// 스트리밍 메시지 처리
export async function processMessageStream(sessionId, userMessage, context = {}, onChunk) {
  const session = getSession(sessionId);
  if (!session) throw new Error('세션을 찾을 수 없습니다');

  session.messages.push({ role: 'user', content: userMessage });

  // DB에 유저 메시지 영속화
  persistMessage(sessionId, 'user', userMessage);

  // 첫 메시지면 세션 제목 업데이트
  const isFirstMessage = session.messages.filter(m => m.role === 'user' && typeof m.content === 'string').length === 1;
  if (isFirstMessage) {
    updateSessionTitle(sessionId, userMessage);
  }

  // 인텐트 감지 (캐시/Claude보다 먼저!)
  const intent = detectIntent(userMessage);

  // 확정 인텐트: 서버 직접 응답 (스트리밍)
  if (intent?.directReply) {
    onChunk({ type: 'text', text: intent.directReply });
    session.messages.push({ role: 'assistant', content: intent.directReply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', intent.directReply);
    return { ui_elements: intent.ui_elements || [] };
  }

  // 확정 인텐트 중 도구 호출 필요한 경우
  if (intent?.forceTool) {
    const toolResult = await executeTool(intent.forceTool.name, intent.forceTool.input, context);
    const toolReply = intent.formatResult(toolResult);
    onChunk({ type: 'text', text: toolReply });
    session.messages.push({ role: 'assistant', content: toolReply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', toolReply);
    return { ui_elements: [] };
  }

  const systemPrompt = intent
    ? `${SYSTEM_PROMPT}\n\n${intent.instruction}`
    : SYSTEM_PROMPT;

  // 캐시 체크
  if (isFirstMessage && !intent) {
    const cached = getCachedResponse(userMessage);
    if (cached) {
      onChunk({ type: 'text', text: cached.reply });
      session.messages.push({ role: 'assistant', content: cached.reply });
      await saveSession(session);
      persistMessage(sessionId, 'assistant', cached.reply);
      return { ui_elements: cached.ui_elements || [], fromCache: true };
    }
  }

  // API 키 없으면 Mock 응답 (청크 단위로 전송)
  if (!client) {
    const mockReply = getMockReply(userMessage);
    onChunk({ type: 'text', text: mockReply });
    session.messages.push({ role: 'assistant', content: mockReply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', mockReply);
    return { ui_elements: [] };
  }

  // 스트리밍 Claude 호출 + Tool Use 루프
  let loopCount = 0;
  let lastResponse = null;

  // 첫 호출 (스트리밍)
  lastResponse = await streamClaudeResponse(session, onChunk, systemPrompt);

  // Tool Use 루프: 도구 호출이 필요하면 실행 후 재호출
  while (lastResponse.stop_reason === 'tool_use' && loopCount < 5) {
    const toolUseBlocks = lastResponse.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    onChunk({ type: 'tool_start', tools: toolUseBlocks.map(b => b.name) });

    for (const block of toolUseBlocks) {
      const result = await executeTool(block.name, block.input, context);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    session.messages.push({ role: 'assistant', content: lastResponse.content });
    session.messages.push({ role: 'user', content: toolResults });

    onChunk({ type: 'tool_done' });

    // 도구 결과 이후 재호출 (스트리밍)
    lastResponse = await streamClaudeResponse(session, onChunk, systemPrompt);
    loopCount++;
  }

  // 최종 응답을 세션에 저장
  session.messages.push({ role: 'assistant', content: lastResponse.content });
  await saveSession(session);

  // DB에 어시스턴트 텍스트 메시지 영속화
  const textBlocks = lastResponse.content.filter(b => b.type === 'text');
  const reply = textBlocks.map(b => b.text).join('\n');
  if (reply) {
    persistMessage(sessionId, 'assistant', reply);
  }

  const ui_elements = extractUIElements(session.messages);

  // 첫 메시지 응답을 캐시에 저장
  if (isFirstMessage && reply) {
    setCachedResponse(userMessage, { reply, ui_elements });
  }

  return {
    ui_elements,
  };
}

// Claude 스트리밍 호출 헬퍼
async function streamClaudeResponse(session, onChunk, sysPrompt = SYSTEM_PROMPT) {
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: sysPrompt,
    tools: TOOLS,
    messages: session.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  stream.on('text', (text) => {
    onChunk({ type: 'text', text });
  });

  const finalMessage = await stream.finalMessage();
  return finalMessage;
}

// Mock 응답 (API 키 없을 때)
function getMockReply(message) {
  const q = message.toLowerCase();

  if (q.includes('인터넷') || q.includes('tv')) {
    return '안녕하세요! 리턴AI이에요 🐟\n\n인터넷+TV 상품 추천드릴게요!\n\n**🥇 추천 1: KT 인터넷+TV 500Mbps** `K227`\n- 월 실납부: 14,700원\n- 🎁 현금 사은품: **370,000원**\n\n**🥈 추천 2: KT 인터넷+TV 1Gbps** `K310`\n- 월 실납부: 20,200원\n- 🎁 현금 사은품: **420,000원**\n\n어떤 게 끌리세요? 상담사 연결하면 추가 혜택도 있어요! 😊';
  }

  if (q.includes('렌탈') || q.includes('정수기') || q.includes('공기청정기')) {
    return '가전렌탈도 준비되어 있어요!\n\n**🥇 코웨이 정수기 아이콘2** `R001`\n- 월 35,900원 / 5년\n- 🎁 현금 150,000원\n\n**🥈 LG 공기청정기** `R002`\n- 월 29,900원 / 5년\n- 🎁 현금 100,000원\n\n관심 있으시면 상담사가 더 자세히 안내해드릴 수 있어요!';
  }

  if (q.includes('알뜰') || q.includes('유심')) {
    return '알뜰폰 추천드려요!\n\n**데이터 11GB** `U001` — 월 12,100원\n**데이터 무제한** `U003` — 월 19,800원\n\n번호이동도 간편하게 도와드려요!';
  }

  if (q.includes('중고폰') || q.includes('팔') || q.includes('매입')) {
    return '중고폰 매입도 가능해요!\n\n기기 모델명을 알려주시면 예상 매입가를 알려드릴게요.\n예: "아이폰 15 팔고 싶어"';
  }

  if (q.includes('상담') || q.includes('전화') || q.includes('연결')) {
    return '상담사 연결해드릴게요!\n\n연락처 남겨주시면 상담사가 전화드릴게요!\n또는 가까운 매장에 직접 방문해주세요.\n\n매장 정보가 궁금하시면 "매장 알려줘"라고 말씀해주세요!';
  }

  return '안녕하세요! 리턴AI에요 🐟\n\n인터넷+TV, 정수기·공기청정기·TV 렌탈, 알뜰폰, 중고폰 매입까지!\n무엇이든 편하게 물어보세요.\n\n예시:\n• "인터넷 추천해줘"\n• "공기청정기 추천해줘"\n• "비데 렌탈 얼마야?"\n• "알뜰폰 저렴한 거"\n• "아이폰 15 매입가"';
}
