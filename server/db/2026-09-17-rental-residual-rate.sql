-- 렌탈 전용 배분율 (A안, 대표 승인 2026-09-17)
--   렌탈 판매분 잔존마진 × 렌탈 배분율 (기본 30%) + 그 밖(인터넷·TV·유심) 잔존마진 × 개인 배분율 (기존 그대로)
--   렌탈 배분율 = 상담사별 rental_incentive_rate → 없으면 정산 규칙 rental_residual_rate → 없으면 30
alter table incentive_rules add column if not exists rental_residual_rate numeric;
update incentive_rules set rental_residual_rate = 30 where active = true and rental_residual_rate is null;
alter table incentive_agents add column if not exists rental_incentive_rate numeric check (rental_incentive_rate is null or (rental_incentive_rate >= 0 and rental_incentive_rate <= 100));
alter table incentive_monthly_settlements add column if not exists rental_residual_margin integer;
alter table incentive_monthly_settlements add column if not exists rental_incentive_rate numeric;

create or replace function public.incentive_calc_monthly_settlement(p_agent_id uuid, p_year_month text)
returns incentive_monthly_settlements language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare
  v_result incentive_monthly_settlements; v_agg record; v_base_salary integer; v_rate numeric; v_rental_rate numeric; v_agent_rental numeric;
begin
  select coalesce(base_salary, 2300000), coalesce(incentive_rate, 20), rental_incentive_rate into v_base_salary, v_rate, v_agent_rental
    from incentive_agents where id = p_agent_id;
  if v_base_salary is null then v_base_salary := 2300000; end if;
  if v_rate is null then v_rate := 20; end if;
  v_rental_rate := coalesce(v_agent_rental, (select rental_residual_rate from incentive_rules where active = true order by effective_from desc limit 1), 30);
  -- 설치완료 건만 집계한다. 잔존마진 = (MAX − 실제 지급액) 을 인터넷+TV·렌탈 과 유심 각각 구해 더한다.
  -- MAX·가이드는 등록 시점 스냅샷을 우선 쓴다 — 나중에 상품값이 바뀌어도 지난 정산이 흔들리면 안 된다.
  -- ★ LEFT JOIN 이어야 한다. 유심 단독·렌탈 건은 product_id 가 없어 INNER JOIN 이면 통째로 빠진다.
  select count(*)::integer as total_count,
    coalesce(sum(
      greatest(0, coalesce(s.max_payout_snapshot, p.max_payout, 0) - coalesce(s.actual_payout, s.guide_payout_snapshot, p.guide_payout, s.payback_snapshot, p.payback, 0))
      + greatest(0, coalesce(s.usim_max_snapshot, 0) - coalesce(s.usim_payout, s.usim_guide_snapshot, 0))
    ), 0)::integer as total_residual_margin,
    coalesce(sum(case when s.sale_kind = 'rental' then
      greatest(0, coalesce(s.max_payout_snapshot, 0) - coalesce(s.actual_payout, s.guide_payout_snapshot, s.payback_snapshot, 0))
    else 0 end), 0)::integer as rental_residual_margin,
    coalesce(sum(coalesce(s.actual_payout, s.guide_payout_snapshot, p.guide_payout, s.payback_snapshot, p.payback, 0) + coalesce(s.usim_payout, s.usim_guide_snapshot, 0)), 0)::integer as total_payback,
    coalesce(sum(s.company_payback_burden), 0)::integer as total_company_payback_burden,
    coalesce(sum(s.agent_payback_deduct), 0)::integer as total_agent_payback_deduct
  into v_agg
  from incentive_sales s left join incentive_products p on p.id = s.product_id
  where s.agent_id = p_agent_id and s.status = 'completed' and s.contract_completed_at is not null
    and to_char(s.contract_completed_at at time zone 'Asia/Seoul', 'YYYY-MM') = p_year_month;

  v_result.agent_id := p_agent_id;
  v_result.year_month := p_year_month;
  v_result.total_count := v_agg.total_count;
  v_result.total_residual_margin := v_agg.total_residual_margin;
  v_result.rental_residual_margin := v_agg.rental_residual_margin;
  v_result.incentive_rate_applied := v_rate;
  v_result.rental_incentive_rate := v_rental_rate;
  v_result.formula_version := 'residual';
  v_result.applied_rate := v_rate::integer;
  v_result.is_penalty := false;
  v_result.total_revenue := 0;
  v_result.total_payback := v_agg.total_payback;
  v_result.total_company_payback_burden := v_agg.total_company_payback_burden;
  v_result.total_agent_payback_deduct := v_agg.total_agent_payback_deduct;
  v_result.base_salary := v_base_salary;
  v_result.incentive := round((v_agg.total_residual_margin - v_agg.rental_residual_margin) * v_rate / 100
                              + v_agg.rental_residual_margin * v_rental_rate / 100)::integer;
  v_result.bonus := 0;
  v_result.agent_total := v_result.base_salary + v_result.incentive - v_agg.total_agent_payback_deduct;
  v_result.company_profit := v_agg.total_residual_margin - v_result.incentive;
  v_result.profit_rate := case when v_agg.total_residual_margin > 0 then v_result.company_profit::numeric / v_agg.total_residual_margin else 0 end;
  return v_result;
end; $function$;

create or replace function public.incentive_finalize_monthly_settlement(p_agent_id uuid, p_year_month character, p_finalized_by uuid)
returns incentive_monthly_settlements language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare v_calc incentive_monthly_settlements; v_result incentive_monthly_settlements;
begin
  v_calc := incentive_calc_monthly_settlement(p_agent_id, p_year_month::text);
  v_calc.finalized_at := now();
  v_calc.finalized_by := p_finalized_by;
  insert into incentive_monthly_settlements as m (
    agent_id, year_month, total_count, total_residual_margin, incentive_rate_applied, formula_version, is_penalty, applied_rate,
    total_revenue, total_payback, total_company_payback_burden, total_agent_payback_deduct, base_salary, incentive, bonus, agent_total,
    company_profit, profit_rate, finalized_at, finalized_by, rental_residual_margin, rental_incentive_rate)
  values (
    v_calc.agent_id, v_calc.year_month, v_calc.total_count, v_calc.total_residual_margin, v_calc.incentive_rate_applied, 'residual', v_calc.is_penalty, v_calc.applied_rate,
    v_calc.total_revenue, v_calc.total_payback, v_calc.total_company_payback_burden, v_calc.total_agent_payback_deduct, v_calc.base_salary, v_calc.incentive, v_calc.bonus, v_calc.agent_total,
    v_calc.company_profit, v_calc.profit_rate, v_calc.finalized_at, v_calc.finalized_by, v_calc.rental_residual_margin, v_calc.rental_incentive_rate)
  on conflict (agent_id, year_month) do update set
    total_count = excluded.total_count, total_residual_margin = excluded.total_residual_margin, incentive_rate_applied = excluded.incentive_rate_applied,
    formula_version = excluded.formula_version, is_penalty = excluded.is_penalty, applied_rate = excluded.applied_rate, total_revenue = excluded.total_revenue,
    total_payback = excluded.total_payback, total_company_payback_burden = excluded.total_company_payback_burden, total_agent_payback_deduct = excluded.total_agent_payback_deduct,
    base_salary = excluded.base_salary, incentive = excluded.incentive, bonus = excluded.bonus, agent_total = excluded.agent_total,
    company_profit = excluded.company_profit, profit_rate = excluded.profit_rate, finalized_at = excluded.finalized_at, finalized_by = excluded.finalized_by,
    rental_residual_margin = excluded.rental_residual_margin, rental_incentive_rate = excluded.rental_incentive_rate, updated_at = now()
  returning m.* into v_result;
  return v_result;
end; $function$;
