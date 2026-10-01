-- Portal subscription prices: US$ 10 per month, US$ 25 per term.
UPDATE public.subscription_plans
   SET amount_usd = 10.00,
       description = 'Full Parent + Student portal access, billed monthly.'
 WHERE plan_type = 'monthly';

UPDATE public.subscription_plans
   SET amount_usd = 25.00,
       description = 'Full Parent + Student portal access for one academic term. Save $5.',
       is_recommended = true
 WHERE plan_type = 'term';

-- Only the monthly and term plans are offered.
UPDATE public.subscription_plans SET is_active = false
 WHERE plan_type NOT IN ('monthly', 'term');
