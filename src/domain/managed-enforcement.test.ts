import { describe, expect, it } from "vitest";
import { constrainManagedPayload } from "./managed-enforcement.js";
import type { VerificationFinding } from "./deterministic-verifier.js";

const finding: VerificationFinding = {type:"SCOPE_DRIFT",action:"CONSTRAIN",evidenceRecordId:"browser:s:o",integrationId:"analytics-partner",field:"customer.phone",contractId:"analytics-product-view",contractVersion:"1",reason:"outside approved scope"};

describe("managed enforcement",()=>{
  it("removes only the unjustified field before receiver delivery",()=>{
    const result=constrainManagedPayload({"product.id":"sku-1","product.category":"phones","product.price":120000,"customer.phone":"+234000000000"},[finding]);
    expect(result.outcome).toBe("PREVENTED");
    expect(result.removedFields).toEqual(["customer.phone"]);
    expect(result.payload).toEqual({"product.id":"sku-1","product.category":"phones","product.price":120000});
    expect(result.payload).not.toHaveProperty("customer.phone");
  });
  it("leaves legitimate payload unchanged when there is no finding",()=>{
    const payload={"product.id":"sku-1"};
    expect(constrainManagedPayload(payload,[])).toMatchObject({outcome:"UNCHANGED",payload});
  });
});
