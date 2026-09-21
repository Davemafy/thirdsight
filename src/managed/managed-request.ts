import { businessEventEvidence } from "../domain/evidence-sources.js";
import type { EvidenceClaim, EvidenceGraphRecord } from "../domain/evidence.js";
import { enrichEvidenceGraph } from "../domain/evidence-verification.js";
import {
  decideVerification,
  verifyIntegrationLifecycle,
  type VerificationFinding,
} from "../domain/deterministic-verifier.js";
import { verifyAndConstrainManagedRequest } from "../domain/managed-verification.js";
import type { EvidenceHistoryEntry, EnforcementRecord } from "../infrastructure/evidence-history/evidence-history-store.js";
import type { ManagedHttpObservationV1 } from "../infrastructure/gateway/managed-http-observation.js";
import { flattenJsonObject, removeJsonPaths } from "./payload-paths.js";
import type { ManagedRequestInput, ManagedRequestResult } from "./types.js";

export async function enforceManagedRequest(input:ManagedRequestInput):Promise<ManagedRequestResult>{
  const observedFields=Object.keys(flattenJsonObject(input.payload)).sort();

  if(input.context?.businessEvent){
    const event=input.context.businessEvent;
    await input.store.appendBusinessEvent(businessEventEvidence({
      id:event.id,
      type:event.type,
      timestamp:event.timestamp??input.observedAt,
      integrationId:input.integrationId,
      ...(event.customerRefHash?{customerRefHash:event.customerRefHash}:{}),
      ...(event.orderRefHash?{orderRefHash:event.orderRefHash}:{}),
      ...(event.paymentRefHash?{paymentRefHash:event.paymentRefHash}:{}),
      ...(event.deliveryRefHash?{deliveryRefHash:event.deliveryRefHash}:{}),
      ...(event.campaignRef?{campaignRef:event.campaignRef}:{}),
    }));
  }

  const provenance=[{
    source:"gateway" as const,
    sourceId:input.requestId,
    observedAt:input.observedAt,
    confidence:"OBSERVED" as const,
  }];
  const unknown=<T>(reason:string):EvidenceClaim<T>=>({
    status:"UNKNOWN",
    confidence:"UNKNOWN",
    value:null,
    provenance:[],
    reason,
  });

  const base:EvidenceGraphRecord={
    recordId:"gateway-http:"+input.requestId,
    observedAt:input.observedAt,
    integrationId:input.integrationId,
    integrationResolution:"RESOLVED",
    should:unknown("Purpose Contract has not yet been projected for this managed request."),
    could:unknown("No independent capability evidence has yet been projected for this managed request."),
    did:{
      status:"KNOWN",
      confidence:"OBSERVED",
      value:{
        boundary:"gateway",
        phase:"ATTEMPTED",
        pageOrigin:null,
        destinationOrigin:new URL(input.destinationOrigin).origin,
        destinationPath:input.destinationPath,
        method:input.method.toUpperCase(),
        resourceType:"HTTP",
        initiatorType:"thirdsight-sdk",
        hasPostData:observedFields.length>0,
        originRelationship:"CROSS_ORIGIN",
        dataCategories:observedFields,
        ...(input.context?.requestRefs?{businessObjectRefs:input.context.requestRefs}:{}),
      },
      provenance,
      reason:"ThirdSight observed the outbound request at its managed gateway before forwarding.",
    },
    why:unknown("Trusted first-party context has not yet been projected for this managed request."),
    coverage:{
      label:"MULTI_BOUNDARY",
      boundaries:["gateway"],
      limitations:["ThirdSight controls this outbound request, but does not claim visibility into downstream vendor use after legitimate egress."],
    },
  };

  const [contracts,capabilities,businessEvents,lifecycle]=await Promise.all([
    input.store.findPurposeContracts(input.integrationId,input.environment,input.observedAt),
    input.store.findCapabilities(input.integrationId,input.environment,input.observedAt),
    input.store.findBusinessEvents(input.integrationId,input.observedAt),
    input.store.findIntegrationLifecycle(input.integrationId),
  ]);

  const evidence=enrichEvidenceGraph(base,{purposeContracts:contracts,capabilities,businessEvents});
  const semanticPayload=flattenJsonObject(input.payload);
  const scope=verifyAndConstrainManagedRequest({
    evidence,
    semanticPayload,
    observedFields,
    purposeContracts:contracts,
  });

  const lifecycleFindings:readonly VerificationFinding[]=lifecycle
    ? verifyIntegrationLifecycle(asCredentialAccessEvidence(evidence),lifecycle)
    : [];
  const findings=[...lifecycleFindings,...scope.findings];
  let decision=decideVerification(findings);
  if(decision==="ALLOW"&&evidence.should.status!=="KNOWN") decision="OBSERVE";

  const removedFields=scope.removedFields;
  const constrained=removeJsonPaths(input.payload,removedFields);
  const purposeMismatch=findings.some((finding)=>finding.type==="PURPOSE_MISMATCH"&&finding.action==="CONSTRAIN");
  const isolated=decision==="ISOLATE";
  const shouldForward=!isolated&&!purposeMismatch;
  const transmittedFields=shouldForward?Object.keys(flattenJsonObject(constrained)).sort():[];
  const prevented=removedFields.length>0||!shouldForward;

  return {
    requestId:input.requestId,
    decision,
    outcome:prevented?"PREVENTED":null,
    shouldForward,
    blockReason:isolated
      ?"Integration lifecycle policy requires isolation before outbound transmission."
      :purposeMismatch
        ?"Trusted business context does not justify this request, so the managed request is not forwarded."
        :null,
    payload:constrained,
    observedFields,
    transmittedFields,
    removedFields,
    findings,
    evidence,
    purposeContractVersion:evidence.should.value?.contractVersion??null,
  };
}

export function buildManagedHistoryEntry(input:{
  result:ManagedRequestResult;
  environment:string;
  acceptedAt:string;
  upstreamContacted:boolean|null;
  upstreamStatus:number|null;
  transmissionKnown:boolean;
  receiver?:{receivedFields:readonly string[];forbiddenFieldReceived:boolean};
}):EvidenceHistoryEntry{
  const phase=input.transmissionKnown&&input.upstreamContacted===true?"TRANSMITTED":"ATTEMPTED";
  const evidence=input.result.evidence.did.value
    ?{
      ...input.result.evidence,
      did:{
        ...input.result.evidence.did,
        value:{...input.result.evidence.did.value,phase,dataCategories:phase==="TRANSMITTED"?input.result.transmittedFields:input.result.observedFields},
        reason:phase==="TRANSMITTED"
          ?"ThirdSight constructed the constrained outbound body and the upstream returned an HTTP response."
          :input.upstreamContacted===false
            ?"ThirdSight blocked the managed request before contacting the upstream."
            :"ThirdSight observed the managed request, but successful upstream transmission is not proven.",
      },
    }
    :input.result.evidence;

  const observation:ManagedHttpObservationV1={
    schemaVersion:"managed-http.v1",
    observationId:input.result.requestId,
    observedAt:evidence.observedAt,
    integrationId:input.result.evidence.integrationId??"unknown",
    environment:input.environment,
    destinationOrigin:evidence.did.value?.destinationOrigin??"",
    destinationPath:evidence.did.value?.destinationPath??"",
    method:evidence.did.value?.method??"",
    attemptedFields:input.result.observedFields,
    transmittedFields:input.upstreamContacted===true?input.result.transmittedFields:[],
    upstreamContacted:input.upstreamContacted,
    upstreamStatus:input.upstreamStatus,
  };

  const enforcement:EnforcementRecord|null=input.result.outcome==="PREVENTED"
    ?{
      action:input.result.decision==="ISOLATE"?"ISOLATE":"CONSTRAIN",
      outcome:"PREVENTED",
      removedFields:input.result.removedFields,
      continuedFields:input.result.shouldForward?input.result.transmittedFields:[],
      ...(input.receiver?{receiver:input.receiver}:{}),
      forwarding:{
        upstreamContacted:input.upstreamContacted,
        transmittedFields:input.upstreamContacted===true?input.result.transmittedFields:[],
        upstreamStatus:input.upstreamStatus,
      },
    }
    :null;

  return {
    recordId:evidence.recordId,
    observationId:observation.observationId,
    acceptedAt:input.acceptedAt,
    observation,
    evidence,
    integrationResolution:{
      status:"RESOLVED",
      integrationId:input.result.evidence.integrationId,
      confidence:"AUTHORITATIVE",
      bindingIds:[],
      sourceIds:["managed-gateway:"+(input.result.evidence.integrationId??"unknown")],
      reason:"Resolved from the server-owned ThirdSight managed integration registry.",
    },
    findings:input.result.findings,
    enforcement,
    outcome:input.result.outcome,
    decision:input.result.decision,
  };
}

function asCredentialAccessEvidence(evidence:EvidenceGraphRecord):EvidenceGraphRecord{
  if(!evidence.did.value) return evidence;
  return {
    ...evidence,
    did:{
      ...evidence.did,
      value:{...evidence.did.value,phase:"ACCESSED"},
      reason:"The managed gateway request accesses the registered integration capability before any vendor request is forwarded.",
    },
  };
}
