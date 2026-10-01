-- ============================================
-- PAYMENT METHODS: INNBUCKS
-- InnBucks is one of the mobile wallets Zimbabwean parents pay with, alongside
-- EcoCash, OneMoney and Telecash. Kept in its own file because a new enum value
-- can't be used in the same transaction that adds it.
-- ============================================
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'innbucks';
