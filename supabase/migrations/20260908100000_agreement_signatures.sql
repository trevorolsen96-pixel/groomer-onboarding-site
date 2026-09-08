-- Replaces the plain "I understand" checkbox with an adopted
-- signature/initials flow: the client types their name once, applies
-- their initials per policy, and signs once at the end. Denormalized onto
-- each acceptance row (same pattern as the existing accepted_text
-- snapshot column) rather than a separate signatures table, since every
-- acceptance in one submission shares the same signature.
alter table public.intake_agreement_acceptances
  add column if not exists initials_text text,
  add column if not exists signature_text text,
  add column if not exists signature_font text;
