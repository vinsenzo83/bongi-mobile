-- ═══════════════════════════════════════════════════════════════
-- 2026-05-18 notes 누적 HTML escape 정리
-- ═══════════════════════════════════════════════════════════════
-- 버그: PATCH할 때마다 < → &lt; → &amp;lt; → &amp;amp;lt; ... 누적
--      화면에 "&amp;amp;amp;amp;lt;10건" 같이 깨져 표시됨
-- fix: server/routes/incentive.js, rental.js 에 normalizeNotes() 추가
--      여기서는 이미 누적 깨진 DB 값을 1회 정리
-- 대상 테이블: incentive_rules.notes, rental_policy.notes
-- 양쪽 supabase (sesgdq + dugaqv) 둘 다 실행 필요
-- ═══════════════════════════════════════════════════════════════

-- 인터넷+TV 정책
UPDATE incentive_rules SET notes = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(notes,
  '&amp;amp;amp;amp;amp;', '&'),
  '&amp;amp;amp;amp;', '&'),
  '&amp;amp;amp;', '&'),
  '&amp;amp;', '&'),
  '&amp;', '&'),
  '&lt;', '<'),
  '&gt;', '>'),
  '&quot;', '"'),
  '&apos;', ''''),
  '&#39;', ''''),
  '&#x27;', ''''),
  '&#x2F;', '/'),
  '&#x60;', '`'),
  '&#x3D;', '='),
  '&#x26;', '&')
  WHERE notes LIKE '%&amp;%' OR notes LIKE '%&lt;%' OR notes LIKE '%&gt;%' OR notes LIKE '%&quot;%';

-- 가전 렌탈 정책
UPDATE rental_policy SET notes = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(notes,
  '&amp;amp;amp;amp;amp;', '&'),
  '&amp;amp;amp;amp;', '&'),
  '&amp;amp;amp;', '&'),
  '&amp;amp;', '&'),
  '&amp;', '&'),
  '&lt;', '<'),
  '&gt;', '>'),
  '&quot;', '"'),
  '&apos;', ''''),
  '&#39;', ''''),
  '&#x27;', ''''),
  '&#x2F;', '/'),
  '&#x60;', '`'),
  '&#x3D;', '='),
  '&#x26;', '&')
  WHERE notes LIKE '%&amp;%' OR notes LIKE '%&lt;%' OR notes LIKE '%&gt;%' OR notes LIKE '%&quot;%';
