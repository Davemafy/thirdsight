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
      <h2>Integration exposure</h2>
      <span>{rows.length} persisted integration rows</span>
    </div>

    {proof?<div className="challenge-proof">
      <div>
        <span>Busy sales day</span>
        <strong>{proof.busySale.passed?"No false alarm":"Not yet proven"}</strong>
        <small>{proof.busySale.observed>0
          ?`${proof.busySale.allowed}/${proof.busySale.observed} legitimate flash-sale events allowed · ${proof.busySale.falseAlarms} false alarms`
          :"No persisted flash-sale run available"}</small>
      </div>
      <div>
        <span>Abnormal partner behaviour</span>
        <strong>{proof.abnormalBehavior.observed?"Caught":"Not observed"}</strong>
        <small>{proof.abnormalBehavior.observed
          ?`${proof.abnormalBehavior.persistedFindings} persisted findings · ${proof.abnormalBehavior.findingTypes.slice(0,3).map(pretty).join(" · ")}`
          :"No deterministic finding persisted"}</small>
      </div>
      <div>
        <span>Graded response</span>
        <strong>{proof.gradedResponse.levels.length} levels</strong>
        <small>{proof.gradedResponse.levels.map(pretty).join(" → ")}</small>
      </div>
      <div>
        <span>Managed prevention</span>
        <strong>{proof.scopePrevention.proven?"Prevented":"Not yet proven"}</strong>
        <small>{proof.scopePrevention.proven
          ?`${proof.scopePrevention.removedFields.join(", ")||"Unjustified field"} removed before receiver · forbidden field received: ${proof.scopePrevention.forbiddenFieldReceived?"yes":"no"}`
          :"No persisted pre-send scope prevention"}</small>
      </div>
    </div>:null}

    <div className="exposure-table-wrap">
      <div className="exposure-table-head">
        <span>Integration</span>
        <span>Can reach</span>
        <span>Observed</span>
        <span>Merchant approved</span>
        <span>Response</span>
      </div>
      <div className="exposure-rows">
        {rows.length===0?<div className="exposure-empty">No persisted third-party exposure evidence yet.</div>:rows.map((row)=>
          <div className="exposure-row" key={row.key}>
            <div className="exposure-identity">
              <strong>{row.vendorIntelligence.profiles[0]?.family??row.label}</strong>
              <small>{row.vendorIntelligence.profiles[0]
                ?`${row.vendorIntelligence.profiles[0].vendor} · ${row.observations} observations`
                :`${row.integrationId??"Identity unresolved"} · ${row.observations} observations`}</small>
            </div>
            <FieldCell
              values={row.canReachFields}
              fallback={row.reachSource==="OBSERVED_LOWER_BOUND"?"Browser-visible lower bound":"Not declared"}
            />
            <FieldCell
              values={row.attemptedFields}
              blocked={row.preventedFields}
              fallback={row.boundaries.length?row.boundaries.map((boundary)=>`${pretty(boundary)} metadata`).join(", "):"Not observed"}
            />
            <FieldCell values={row.approvedFields} fallback="Not provided"/>
            <div className="exposure-response">
              <span className={"response-pill "+responseClass(row.latestResponse)}>{pretty(row.latestResponse)}</span>
              {row.findings.slice(0,2).map((finding)=><small key={finding}>{pretty(finding)}</small>)}
            </div>
          </div>
        )}
      </div>
    </div>
    <small className="exposure-footnote">Vendor documentation is context, not merchant authorization. Public browser discovery does not claim complete backend access.</small>
  </section>;
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


function pretty(value:string){
  return value.split(/[-_]/g).filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1).toLowerCase()).join(" ");
}
