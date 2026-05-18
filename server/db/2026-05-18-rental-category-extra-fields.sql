-- Phase: rental_categories.extra_fields 동적 폼 빌더 (#37)
-- 2026-05-18
-- 각 카테고리에 카테고리 전용 input schema(extra_fields) seed
-- UI(products.html 가전 편집)에서 카테고리.metadata.extra_fields → 동적 input 렌더 → specifications JSONB에 저장

-- 정수기
UPDATE rental_categories SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{extra_fields}',
  '[
    {"key":"water_source","label":"급수 방식","type":"select","options":["수돗물","RO 직수","지하수"]},
    {"key":"ice_capacity","label":"얼음 용량","type":"number","unit":"개/일","placeholder":"예: 150"},
    {"key":"hot_temp_max","label":"온수 최고","type":"number","unit":"℃"},
    {"key":"warranty_years","label":"보증 기간","type":"number","unit":"년"},
    {"key":"power_w","label":"소비 전력","type":"number","unit":"W"}
  ]'::jsonb
) WHERE slug = 'water-purifier';

-- 공기청정기
UPDATE rental_categories SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{extra_fields}',
  '[
    {"key":"coverage_m2","label":"적용 면적","type":"number","unit":"㎡"},
    {"key":"cadr","label":"CADR","type":"number","unit":"m³/h"},
    {"key":"filter_grade","label":"필터 등급","type":"select","options":["헤파 H11","헤파 H13","헤파 H14"]},
    {"key":"noise_db","label":"소음","type":"number","unit":"dB"},
    {"key":"sensor_type","label":"센서","type":"select","options":["PM2.5","PM1.0","가스","복합"]}
  ]'::jsonb
) WHERE slug = 'air-purifier';

-- 안마의자
UPDATE rental_categories SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{extra_fields}',
  '[
    {"key":"massage_modes","label":"마사지 모드 수","type":"number","unit":"종"},
    {"key":"max_user_weight_kg","label":"최대 사용자 체중","type":"number","unit":"kg"},
    {"key":"reclining_180","label":"180도 리클라이닝","type":"checkbox"},
    {"key":"heating","label":"온열 기능","type":"checkbox"},
    {"key":"power_w","label":"소비 전력","type":"number","unit":"W"}
  ]'::jsonb
) WHERE slug = 'massage-chair';

-- 비데 (있으면)
UPDATE rental_categories SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{extra_fields}',
  '[
    {"key":"nozzle_type","label":"노즐","type":"select","options":["스테인리스","플라스틱","항균"]},
    {"key":"seat_temp_max","label":"좌석 최고온","type":"number","unit":"℃"},
    {"key":"power_w","label":"소비 전력","type":"number","unit":"W"}
  ]'::jsonb
) WHERE slug = 'bidet';

-- 매트리스 (있으면)
UPDATE rental_categories SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{extra_fields}',
  '[
    {"key":"size","label":"규격","type":"select","options":["S","SS","Q","K"]},
    {"key":"firmness","label":"강도","type":"select","options":["소프트","미디엄","펌"]},
    {"key":"cooling","label":"쿨링 기능","type":"checkbox"}
  ]'::jsonb
) WHERE slug = 'mattress';

-- 확인
-- SELECT slug, name, metadata FROM rental_categories;
