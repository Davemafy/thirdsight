export interface GatewayObservationV1{
  schemaVersion:"gateway-dispatch.v1";observationId:string;merchantId:string;integrationId:string;
  purpose:string;eventName:string;observedAt:string;environment:string;attemptedFields:readonly string[];
}
