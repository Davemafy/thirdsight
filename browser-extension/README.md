# ThirdSight Browser Sensor

This directory contains the product browser sensor promoted from the feasibility spike.

It is intentionally small. The extension attaches only after an explicit action, enables Chrome DevTools Protocol network observation for that tab, emits `browser-observation.v1` records, removes query strings and fragments before storage or delivery, and can forward those records to a configured ThirdSight ingestion endpoint.

## Important semantics

This is a passive browser observation path unless a separately managed enforcement rule is introduced. Observation is evidence of DID and a lower bound on COULD. It does not create merchant SHOULD or WHY evidence, and it must not be described as preventing an already observed public-site request.

The endpoint is deliberately not hard-coded. Configure it through the extension runtime message `THIRDSIGHT_SET_INGESTION_ENDPOINT`; packaging/UI configuration can be added later. Without an endpoint, the sensor keeps only a rolling session buffer.

The extension never forwards request bodies, cookies, headers, query strings, fragments, or form values.
