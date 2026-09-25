-- Raises the SMS credit pack add-on from 200 to 350 messages/month per
-- pack. Price per pack is unchanged ($9.99/month, set on the Stripe
-- price itself, not here). Matches the JS-side copy of this constant in
-- app/api/billing/credit-packs/route.ts (limitAfterRemoval calc), which
-- must stay in sync with this function -- that route only uses its own
-- copy to validate removing a pack; this function is what actually gates
-- every send via assertSmsCreditsAvailable().
CREATE OR REPLACE FUNCTION public.get_sms_credit_summary(p_business_id uuid)
 RETURNS TABLE(used_credits integer, monthly_limit integer, remaining_credits integer, period_starts_at timestamp with time zone, period_ends_at timestamp with time zone, plan text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_plan text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_limit int;
  v_credit_packs int;
begin
  select
    coalesce(b.plan, 'basic'),
    coalesce(b.current_period_starts_at, date_trunc('month', now())),
    coalesce(b.current_period_ends_at, date_trunc('month', now()) + interval '1 month'),
    coalesce(b.sms_credit_packs, 0)
  into
    v_plan,
    v_period_start,
    v_period_end,
    v_credit_packs
  from public.businesses b
  where b.id = p_business_id;

  v_limit := case
    when lower(coalesce(v_plan, 'basic')) = 'pro' then 1500
    else 400
  end;

  v_limit := v_limit + (v_credit_packs * 350);

  return query
  select
    coalesce(sum(e.segment_count), 0)::int as used_credits,
    v_limit as monthly_limit,
    greatest(v_limit - coalesce(sum(e.segment_count), 0)::int, 0) as remaining_credits,
    v_period_start as period_starts_at,
    v_period_end as period_ends_at,
    v_plan as plan
  from public.sms_usage_events e
  where e.business_id = p_business_id
    and e.created_at >= v_period_start
    and e.created_at < v_period_end;
end;
$function$
