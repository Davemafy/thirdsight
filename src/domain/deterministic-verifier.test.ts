import { describe, expect, it } from "vitest";
import type { EvidenceGraphRecord } from "./evidence.js";
import { purposeContractEvidence } from "./evidence-sources.js";
import { verifyObservedFields } from "./deterministic-verifier.js";

describe("deterministic verifier", () => {
  it("emits SCOPE_DRIFT and the smallest response for an unapproved field", () => {
    const contract=purposeContractEvidence({contractId:"analytics-product-view",integrationId:"analytics-partner",version:"1",purpose:"Measure product interest",resources:["analytics.events"],fields:["product.id","product.category","product.price"],operations:["send"],validTriggers:["product.viewed"],environment:"production",validFrom:"2026-09-18T00:00:00.000Z",reviewAt:"2026-10-18T00:00:00.000Z",expiresAt:null,owner:"commerce",approvedBy:"privacy",changeReason:"Initial contract"},"contract:v1");
    const evidence={recordId:"browser:s:o",observedAt:"2026-09-18T10:00:00.000Z",integrationId:"analytics-partner",integrationResolution:"RESOLVED",should:{status:"KNOWN",confidence:"AUTHORITATIVE",value:{contractId:"analytics-product-view",contractVersion:"1",purpose:"Measure product interest"},provenance:[contract.provenance]},could:{status:"UNKNOWN",confidence:"UNKNOWN",value:null,provenance:[]},did:{status:"UNKNOWN",confidence:"UNKNOWN",value:null,provenance:[]},why:{status:"UNKNOWN",confidence:"UNKNOWN",value:null,provenance:[]}} satisfies EvidenceGraphRecord;
    const findings=verifyObservedFields(evidence,["product.id","customer.phone"],[contract]);
    expect(findings).toHaveLength(1); expect(findings[0]).toMatchObject({type:"SCOPE_DRIFT",action:"CONSTRAIN",field:"customer.phone"});
  });
  it("does not flag approved fields",()=>{ expect(verifyObservedFields({} as EvidenceGraphRecord,["product.id"],[])).toEqual([]); });
});
