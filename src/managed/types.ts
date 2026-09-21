import type { BusinessObjectRefs, EvidenceGraphRecord } from "../domain/evidence.js";
import type { VerificationAction, VerificationFinding } from "../domain/deterministic-verifier.js";
import type { EvidenceHistoryStore } from "../infrastructure/evidence-history/evidence-history-store.js";
import type { JsonObject } from "./payload-paths.js";

export interface ManagedBusinessEventContext {
  id:string;
  type:string;
  timestamp?:string;
  customerRefHash?:string;
  orderRefHash?:string;
  paymentRefHash?:string;
  deliveryRefHash?:string;
  campaignRef?:string;
}

export interface ManagedRequestContext {
  businessEvent?:ManagedBusinessEventContext;
  requestRefs?:BusinessObjectRefs;
}

export interface ManagedRequestInput {
  requestId:string;
  integrationId:string;
  environment:string;
  destinationOrigin:string;
  destinationPath:string;
  method:string;
  payload:JsonObject;
  observedAt:string;
  context?:ManagedRequestContext;
  store:EvidenceHistoryStore;
}

export interface ManagedRequestResult {
  requestId:string;
  decision:VerificationAction;
  outcome:"PREVENTED"|null;
  shouldForward:boolean;
  blockReason:string|null;
  payload:JsonObject;
  observedFields:readonly string[];
  transmittedFields:readonly string[];
  removedFields:readonly string[];
  findings:readonly VerificationFinding[];
  evidence:EvidenceGraphRecord;
  purposeContractVersion:string|null;
}
