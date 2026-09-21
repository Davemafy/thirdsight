export interface ManagedHttpObservationV1 {
  schemaVersion:"managed-http.v1";
  observationId:string;
  observedAt:string;
  integrationId:string;
  environment:string;
  destinationOrigin:string;
  destinationPath:string;
  method:string;
  attemptedFields:readonly string[];
  transmittedFields:readonly string[];
  upstreamContacted:boolean|null;
  upstreamStatus:number|null;
}
