import type { ReactNode } from "react";
import { Activity, CheckCircle2, Layers3, ShieldAlert } from "lucide-react";
import type { VendorIntelligenceResolution } from "../vendor-intelligence/vendor-intelligence";

export interface ExposureRow {
  key:string;
  integrationId:string|null;
  label:string;
  resolution:string;
  approvedFields:readonly string[];
  canReachFields:readonly string[];
  attemptedFields:readonly string[];
  receivedFields:readonly string[];
  preventedFields:readonly string[];
  destinations:readonly string[];
  findings:readonly string[];
  boundaries:readonly string[];
  observations:number;
  lastSeen:string;
  latestResponse:string;
  reachSource:"DECLARED_CAPABILITY"|"OBSERVED_LOWER_BOUND"|"UNKNOWN";
  vendorIntelligence:VendorIntelligenceResolution;
}

export interface ChallengeProof {
  busySale:{scenario:string;observed:number;allowed:number;falseAlarms:number;passed:boolean};
  abnormalBehavior:{persistedFindings:number;findingTypes:readonly string[];observed:boolean};
  gradedResponse:{levels:readonly string[];observedResponses:readonly string[]};
  scopePrevention:{
    proven:boolean;
    recordId:string|null;
    removedFields:readonly string[];
    receivedFields:readonly string[];
    forbiddenFieldReceived:boolean|null;
  };
}

export function IntegrationExposureMap({
  rows,
  proof,
}:{
  rows:readonly ExposureRow[];
  proof:ChallengeProof|null;
}){
  return <section className="exposure-section">
    <div className="exposure-intro">
      <div>
        <span className="eyebrow">Track G · live integration exposure</span>
        <h2>What can each integration reach — and what did it actually touch?</h2>
        <p>Capability, approved purpose and runtime evidence stay separate. Missing visibility is shown as unknown, not inferred.</p>
      </div>
      <span className="exposure-live"><Activity size={13}/> persisted evidence</span>
    </div>

    {proof?<div className="challenge-proof">
      <ProofCard
        icon={<CheckCircle2 size={15}/>}
        label="Busy sales day"
        value={proof.busySale.passed?"NO FALSE ALARM":"NOT YET PROVEN"}
        detail={proof.busySale.observed>0
          ?`${proof.busySale.allowed}/${proof.busySale.observed} legitimate flash-sale events allowed · ${proof.busySale.falseAlarms} false alarms`
          :"No persisted flash-sale run available"}
        state={proof.busySale.passed?"pass":"neutral"}
      />
      <ProofCard
        icon={<ShieldAlert size={15}/>}
        label="Abnormal partner behaviour"
        value={proof.abnormalBehavior.observed?"CAUGHT":"NOT OBSERVED"}
        detail={proof.abnormalBehavior.observed
          ?`${proof.abnormalBehavior.persistedFindings} persisted findings · ${proof.abnormalBehavior.findingTypes.slice(0,3).join(" · ")}`
          :"No deterministic finding persisted"}
        state={proof.abnormalBehavior.observed?"warn":"neutral"}
      />
      <ProofCard
        icon={<Layers3 size={15}/>}
        label="Graded response"
        value="4 LEVELS"
        detail={proof.gradedResponse.levels.join(" → ")}
        state="neutral"
      />
      <ProofCard
        icon={<CheckCircle2 size={15}/>}
        label="Managed prevention"
        value={proof.scopePrevention.proven?"PREVENTED":"NOT YET PROVEN"}
        detail={proof.scopePrevention.proven
          ?`${proof.scopePrevention.removedFields.join(", ")||"unjustified field"} removed before receiver · forbidden field received: ${proof.scopePrevention.forbiddenFieldReceived?"YES":"NO"}`
          :"No persisted pre-send scope prevention"}
        state={proof.scopePrevention.proven?"pass":"neutral"}
      />
    </div>:null}

    <div className="exposure-table-wrap">
      <div className="exposure-table-head">
        <span>Integration</span>
        <span>Can reach</span>
        <span>Actually touched / attempted</span>
        <span>Merchant approved</span>
        <span>Latest response</span>
      </div>
      <div className="exposure-rows">
        {rows.length===0?<div className="exposure-empty">No persisted third-party exposure evidence yet.</div>:rows.map((row)=>
          <div className="exposure-row" key={row.key}>
            <div className="exposure-identity">
              <strong>{row.vendorIntelligence.profiles[0]?.family??row.label}</strong>
              <small>{row.vendorIntelligence.profiles[0]
                ?`${row.vendorIntelligence.profiles[0].vendor} · vendor documented · ${row.observations} obs.`
                :`${row.integrationId??"identity unresolved"} · ${row.observations} obs.`}</small>
            </div>
            <FieldCell
              values={row.canReachFields}
              fallback={row.reachSource==="OBSERVED_LOWER_BOUND"?"browser-visible lower bound":"not declared"}
            />
            <FieldCell
              values={row.attemptedFields}
              blocked={row.preventedFields}
              fallback={row.boundaries.length?row.boundaries.map((boundary)=>`${boundary} metadata`).join(", "):"not observed"}
            />
            <FieldCell values={row.approvedFields} fallback="not provided"/>
            <div className="exposure-response">
              <span className={"response-pill "+responseClass(row.latestResponse)}>{row.latestResponse}</span>
              {row.findings.slice(0,2).map((finding)=><small key={finding}>{finding.replaceAll("_"," ")}</small>)}
            </div>
          </div>
        )}
      </div>
    </div>
    <small className="exposure-footnote">Vendor documentation is contextual evidence, not merchant authorization. “Can reach” remains declared/local capability evidence where available; “Touched / attempted” remains persisted runtime evidence. Public browser discovery never claims complete backend access.</small>
  </section>;
}

function ProofCard({
  icon,
  label,
  value,
  detail,
  state,
}:{
  icon:ReactNode;
  label:string;
  value:string;
  detail:string;
  state:"pass"|"warn"|"neutral";
}){
  return <div className={"proof-card "+state}>
    <div>{icon}<span>{label}</span></div>
    <strong>{value}</strong>
    <small>{detail}</small>
  </div>;
}

function FieldCell({
  values,
  blocked=[],
  fallback,
}:{
  values:readonly string[];
  blocked?:readonly string[];
  fallback:string;
}){
  if(values.length===0) return <div className="field-cell muted">{fallback}</div>;
  return <div className="field-cell">
    {values.slice(0,5).map((value)=><span className={blocked.includes(value)?"blocked":""} key={value}>
      {value}{blocked.includes(value)?" · blocked":""}
    </span>)}
    {values.length>5?<small>+{values.length-5} more</small>:null}
  </div>;
}

function responseClass(value:string){
  const normalized=value.toLowerCase();
  if(normalized==="allow") return "allow";
  if(normalized==="observe"||normalized==="discovery") return "observe";
  if(normalized==="constrain"||normalized==="prevented") return "constrain";
  if(normalized==="isolate"||normalized==="detected") return "isolate";
  return "unknown";
}
