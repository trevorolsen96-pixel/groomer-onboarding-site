-- Adds a "Pet Type" field (Dog / Cat / Other), shown in the app's pet
-- editor and on the public onboarding form. This is a brand-new column,
-- so it's safe to constrain with a CHECK — unlike `sex`, which already
-- holds years of free-text data and isn't touched here (it's constrained
-- at the UI layer instead, via a dropdown, to avoid breaking existing rows
-- that don't cleanly match 'male'/'female').
alter table pets
  add column pet_type text
  check (pet_type is null or pet_type in ('dog', 'cat', 'other'));
