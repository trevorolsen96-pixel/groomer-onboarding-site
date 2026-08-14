-- Fixes public.sms_segments_for_text(), the function a trigger on
-- message_items (trg_log_sms_usage_from_message_item) calls on every send
-- to log usage into sms_usage_events -- which is what actually drives each
-- business's SMS credit balance via get_sms_credit_summary().
--
-- The old version was:
--   select greatest(1, ceil(length(coalesce(p_body, '')) / 160.0)::int);
-- which always assumed 160 chars/segment and had no concept of Unicode
-- encoding at all. Any message containing an emoji or other character
-- outside the GSM-7 default alphabet forces real carriers (confirmed
-- against an actual Telnyx per-message billing export) onto UCS-2 encoding
-- at 67 chars/segment instead of GSM-7's 153 -- so the old formula was
-- undercounting real usage by 2x+ on any such message, silently draining
-- the gap between recorded credits and real Telnyx cost.
--
-- This version mirrors lib/sms-text.ts's smsSegments() exactly: GSM-7
-- default-alphabet detection (160 chars single-part / 153 concatenated),
-- else Unicode (70 single / 67 concatenated), with UTF-16-code-unit length
-- semantics (characters outside the Basic Multilingual Plane, i.e. most
-- emoji, count as 2) to match how JS/Telnyx actually measure length.
create or replace function public.sms_segments_for_text(p_body text)
returns integer
language plpgsql
immutable
as $$
declare
  v_text text := coalesce(p_body, '');
  v_char_count integer;
  v_char text;
  v_code integer;
  v_is_gsm7 boolean := true;
  v_gsm7_len integer := 0;
  v_utf16_len integer := 0;
  -- GSM 03.38 default alphabet, basic table -- same 127 code points as
  -- GSM_7BIT_BASIC in lib/sms-text.ts.
  v_gsm7_basic integer[] := array[
    64,163,36,165,232,233,249,236,242,199,10,216,248,13,197,229,916,95,934,915,
    923,937,928,936,931,920,926,198,230,223,201,164,161,196,214,209,220,167,191,
    228,246,241,252,224,
    32,33,34,35,37,38,39,40,41,42,43,44,45,46,47,
    48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,
    65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,
    97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122
  ];
  -- GSM extension table -- ^ { } \ [ ~ ] | € -- same as GSM_7BIT_EXTENDED.
  -- Each of these costs 2 septets (escape + char), matching gsm7Length().
  v_gsm7_extended integer[] := array[94,123,125,92,91,126,93,124,8364];
begin
  if v_text = '' then
    return 1;
  end if;

  v_char_count := char_length(v_text);

  for i in 1..v_char_count loop
    v_char := substr(v_text, i, 1);
    v_code := ascii(v_char); -- Unicode code point under UTF8 encoding

    if v_is_gsm7 then
      if v_code = any(v_gsm7_extended) then
        v_gsm7_len := v_gsm7_len + 2;
      elsif v_code = any(v_gsm7_basic) then
        v_gsm7_len := v_gsm7_len + 1;
      else
        v_is_gsm7 := false;
      end if;
    end if;

    -- UTF-16 code-unit length (matches JS .length): anything outside the
    -- Basic Multilingual Plane -- most emoji -- is a surrogate pair, so it
    -- counts as 2, not 1.
    if v_code > 65535 then
      v_utf16_len := v_utf16_len + 2;
    else
      v_utf16_len := v_utf16_len + 1;
    end if;
  end loop;

  if v_is_gsm7 then
    if v_gsm7_len <= 160 then
      return 1;
    end if;
    return ceil(v_gsm7_len / 153.0)::int;
  end if;

  if v_utf16_len <= 70 then
    return 1;
  end if;
  return ceil(v_utf16_len / 67.0)::int;
end;
$$;
