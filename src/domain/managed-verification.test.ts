import { describe, expect, it } from "vitest";
import type { EvidenceGraphRecord } from "./evidence.js";
import { purposeContractEvidence } from "./evidence-sources.js";
import { verifyAndConstrainManagedRequest } from "./managed-verification.js";

describe("Gate 4 end-to-end deterministic prevention",()=>{
  it("turns reconstructed SHOULD plus observed fields into PREVENTED receiver payload",()=>{
    const contract=purposeContractEvidence({contractId:"analytics-product-view",integrationId:"analytics-partner",version:"1",purpose:"Measure product interest",resources:["analytics.events"],fields:["product.id","product.category","product.price"],operations:["send"],validTriggers:["product.viewed"],environment:"production",validFrom:"2026-09-18T00:00:00.000Z",reviewAt:"2026-10-18T00:00:00.000Z",expiresAt:null,owner:"commerce",approvedBy:"privacy",changeReason:"Initial contract"},"contract:v1");
    const evidence={recordId:"browser:s:o",observedAt:"2026-09-18T10:00:00.000Z",integrationId:"analytics-partner",integrationResolution:"RESOLVED",should:{status:"KNOWN",confidence:"AUTHORITATIVE",value:{contractId:"analytics-product-view",contractVersion:"1",purpose:"Measure product interest"},provenance:[contract.provenance]},could:{status:"PARTIAL",confidence:"DECLARED",value:{kind:"DECLARED_BROWSER_CAPABILITY",destinationOrigin:"https://analytics.example",statement:"configured"},provenance:[]},did:{status:"UNKNOWN",confidence:"UNKNOWN",value:null,provenance:[]},why:{status:"PARTIAL",confidence:"AUTHORITATIVE",value:{eventId:"view-1",eventType:"product.viewed",correlationStrength:"TRIGGER_WINDOW"},provenance:[]}} satisfies EvidenceGraphRecord;
    const result=verifyAndConstrainManagedRequest({evidence,semanticPayload:{"product.id":"sku-1","product.category":"phones","product.price":120000,"customer.phone":"+234000000000"},observedFields:["product.id","product.category","product.price","customer.phone"],purposeContracts:[contract]});
    expect(result.outcome).toBe("PREVENTED");
    expect(result.findings).toEqual([expect.objectContaining({type:"SCOPE_DRIFT",action:"CONSTRAIN",field:"customer.phone"})]);
    expect(result.payload).not.toHaveProperty("customer.phone");
    expect(result.payload).toHaveProperty("product.id","sku-1");
  });
});
