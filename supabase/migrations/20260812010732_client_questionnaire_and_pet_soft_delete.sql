-- Client-level questionnaire support: questions can now apply to the
-- client themselves (not just a pet), and answers can be linked to a
-- customer instead of a pet.
alter table onboarding_questions
  add column applies_to text not null default 'pet'
  check (applies_to in ('pet', 'client'));

alter table onboarding_question_responses
  add column customer_id uuid references customers(id),
  alter column pet_id drop not null;

alter table onboarding_question_responses
  add constraint onboarding_question_responses_target_check
  check (
    (pet_id is not null and customer_id is null) or
    (pet_id is null and customer_id is not null)
  );

-- Pet soft-delete, mirroring the existing customers.deleted pattern.
-- `is_active` already powers the separate Activate/Deactivate toggle, so
-- Delete needs its own field rather than colliding with that one.
alter table pets
  add column deleted boolean not null default false;
