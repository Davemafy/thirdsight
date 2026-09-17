# ThirdSight Browser Sensor

This directory contains the product browser sensor promoted from the feasibility spike.

It is intentionally small. The extension attaches only after an explicit action, enables Chrome DevTools Protocol network observation for that tab, emits `browser-observation.v1` records, removes query strings and fragments before storage or delivery, redacts obviously identifier-like path segments, and can forward those records to a configured ThirdSight ingestion endpoint.

## Important semantics

This is a passive browser observation path unless a separately managed enforcement rule is introduced. Observation is evidence of DID and a lower bound on COULD. It does not create merchant SHOULD or WHY evidence, and it must not be described as preventing an already observed public-site request.

The endpoint is deliberately not hard-coded. Configure it through the extension runtime message `THIRDSIGHT_SET_INGESTION_CONFIG` with both an `endpoint` and installation token. The token authenticates the prototype sensor to the ingestion endpoint; it is not equivalent to hardware-backed device attestation and should not be described as proof that a local machine is uncompromised.

Without an ingestion configuration, the sensor keeps only a rolling session buffer. The extension never forwards request bodies, cookies, headers from the observed request, query strings, fragments, or form values. The only authorization header it sends is the ThirdSight ingestion token to the ThirdSight endpoint itself.
