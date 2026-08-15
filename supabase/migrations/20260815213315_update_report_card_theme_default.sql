-- Themes switched from generic aesthetic presets (rose_petal, golden_hour,
-- etc.) to holiday-based ones (wagzly_classic, halloween, thanksgiving,
-- winter_holiday, valentines_day, july_fourth). The app always sets
-- `theme` explicitly on insert, so this default was never actually relied
-- on in practice -- fixing it anyway so it isn't a stale, invalid key if
-- anything ever inserts without specifying one.
alter table pet_report_cards
  alter column theme set default 'wagzly_classic';

update pet_report_cards
  set theme = 'wagzly_classic'
  where theme = 'rose_petal';
