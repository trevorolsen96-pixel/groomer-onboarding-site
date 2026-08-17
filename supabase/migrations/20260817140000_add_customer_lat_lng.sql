-- Cached geocoded coordinates for the client map feature. Nullable since
-- existing customers need a one-time backfill and some addresses may
-- fail to geocode. Geocoding itself happens client-side in the app via
-- the device's native geocoder (no Google Cloud billing) -- these columns
-- just cache the result so the map doesn't re-geocode on every open.
alter table customers
  add column latitude double precision,
  add column longitude double precision;
