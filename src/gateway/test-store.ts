import type { IntegrationOriginBinding } from "../domain/integration-identity.js";
import type { BusinessEventEvidence, CapabilityGrantEvidence, PurposeContractEvidence } from "../domain/evidence-sources.js";
import type { IntegrationLifecycleState } from "../domain/deterministic-verifier.js";
import type { EvidenceHistoryEntry, EvidenceHistoryStore } from "../infrastructure/evidence-history/evidence-history-store.js";

export class MemoryEvidenceStore implements EvidenceHistoryStore {
  bindings:IntegrationOriginBinding[]=[];
  contracts:PurposeContractEvidence[]=[];
  capabilities:CapabilityGrantEvidence[]=[];
  businessEvents:BusinessEventEvidence[]=[];
  entries:EvidenceHistoryEntry[]=[];
  lifecycle:IntegrationLifecycleState|null=null;
  failPolicy=false;
  failAppend=false;

  async findActiveOriginBindings(){return this.bindings;}
  async findPurposeContracts(){
    if(this.failPolicy) throw new Error("policy unavailable");
    return this.contracts;
  }
  async findCapabilities(){
    if(this.failPolicy) throw new Error("policy unavailable");
    return this.capabilities;
  }
  async findBusinessEvents(){
    if(this.failPolicy) throw new Error("policy unavailable");
    return this.businessEvents;
  }
  async findIntegrationLifecycle(){
    if(this.failPolicy) throw new Error("policy unavailable");
    return this.lifecycle;
  }
  async findCredential(){return null;}
  async registerCredential():Promise<void>{}
  async isolateCredential():Promise<boolean>{return true;}
  async appendBusinessEvent(event:BusinessEventEvidence){this.businessEvents.push(event);}
  async appendBusinessEvents(events:readonly BusinessEventEvidence[]){this.businessEvents.push(...events);}
  async append(entry:EvidenceHistoryEntry){if(this.failAppend) throw new Error("evidence unavailable");this.entries.push(entry);}
  async appendMany(entries:readonly EvidenceHistoryEntry[]){if(this.failAppend) throw new Error("evidence unavailable");this.entries.push(...entries);}
  async list(limit=50){return this.entries.slice(-limit).reverse();}
}
