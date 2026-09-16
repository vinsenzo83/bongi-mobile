-- 사은품 지급을 계약처리 탭에서 별도 메뉴(지급관리 > 🎁 사은품 지급)로 분리
-- 메뉴 4곳 동기화: incentive-admin.html 사이드바 · incentive_menus(권한관리 SSOT) · incentive_role_permissions · docs/incentive-gifts.html
insert into incentive_menus (slug, label, icon, iframe_src, category, display_order, default_roles, active)
values ('gifts', '사은품 지급', '🎁', '/docs/incentive-gifts.html', '지급관리', 25, '["admin","contract"]'::jsonb, true)
on conflict (slug) do update set label = excluded.label, icon = excluded.icon, iframe_src = excluded.iframe_src,
  category = excluded.category, display_order = excluded.display_order, default_roles = excluded.default_roles, active = true;

update incentive_role_permissions
   set menus = menus || '["gifts"]'::jsonb, updated_at = now()
 where role in ('admin', 'contract') and not (menus ? 'gifts');
