import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDot,
  Copy,
  Eye,
  Globe2,
  Layers3,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import "./OriginalDashboard.css";

type Claim={value:any;status:string;reason?:string};
type Finding={type:string;field?:string;reason?:string;action?:string};
type VendorProfile={vendor:string;family:string;category:string;expectedPurposes:readonly string[];documentedCapabilities:readonly string[]};
type VendorIntel={profiles:readonly VendorProfile[];authorityBoundary:string;status:string};
type EventRow={
  recordId:string;observedAt:string;integrationId:string|null;
  should:Claim;could:Claim;did:Claim;why:Claim;
  findings:readonly Finding[];
  enforcement:null|{outcome:string;removedFields:readonly string[];continuedFields:readonly string[];receiver:{receivedFields:readonly string[];forbiddenFieldReceived:boolean}};
  decision:"ALLOW"|"OBSERVE"|"CONSTRAIN"|"ISOLATE"|null;
  outcome:"PREVENTED"|"DETECTED"|null;
  coverage:{label:string;boundaries:readonly string[];limitations:readonly string[]};
  vendorIntelligence:VendorIntel;
};
type ExposureRow={
  key:string;integrationId:string|null;label:string;approvedFields:readonly string[];attemptedFields:readonly string[];
  preventedFields:readonly string[];destinations:readonly string[];findings:readonly string[];observations:number;
  lastSeen:string;latestResponse:string;vendorIntelligence:VendorIntel;
};
type Proof={
  busySale:{passed:boolean;falseAlarms:number};
  abnormalBehavior:{observed:boolean};
  scopePrevention:{proven:boolean;removedFields:readonly string[];receivedFields:readonly string[];forbiddenFieldReceived:boolean|null};
};
type Payload={history?:EventRow[];exposureMap?:ExposureRow[];challengeProof?:Proof;productThesis?:string};

const laneMeta={
  should:{label:"SHOULD",question:"Was it approved?",source:"Merchant policy"},
  could:{label:"COULD",question:"Could it reach this?",source:"Capability evidence"},
  did:{label:"DID",question:"What actually happened?",source:"Runtime sensor"},
  why:{label:"WHY",question:"What business event explains it?",source:"First-party context"},
} as const;

export default function OriginalDashboard(){
  const [data,setData]=useState<Payload>({});
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [selectedIntegration,setSelectedIntegration]=useState<string|null>(null);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [running,setRunning]=useState(false);

  const load=async()=>{
    try{
      const res=await fetch("/api/console-events",{cache:"no-store"});
      if(!res.ok)throw new Error("feed");
      const next=await res.json() as Payload;
      setData(next);
      setError(false);
      if(!selectedId&&next.history?.[0])setSelectedId(next.history[0].recordId);
    }catch{
      setError(true);
    }finally{setLoading(false)}
  };

  useEffect(()=>{
    void load();
    const id=window.setInterval(()=>void load(),7000);
    return()=>window.clearInterval(id);
  },[]);

  const events=data.history??[];
  const exposures=data.exposureMap??[];
  const normalized=query.trim().toLowerCase();

  const visibleEvents=useMemo(()=>events.filter(event=>{
    const integrationName=eventName(event).toLowerCase();
    const dest=String(event.did.value?.destinationOrigin??"").toLowerCase();
    const matchesQuery=!normalized||integrationName.includes(normalized)||dest.includes(normalized)||summary(event).toLowerCase().includes(normalized);
    const matchesIntegration=!selectedIntegration||event.integrationId===selectedIntegration||integrationName===selectedIntegration;
    return matchesQuery&&matchesIntegration;
  }),[events,normalized,selectedIntegration]);

  const selected=events.find(event=>event.recordId===selectedId)??visibleEvents[0]??events[0]??null;
  const response=responseLabel(selected);

  const runProof=async()=>{
    setRunning(true);
    try{
      const res=await fetch("/api/stage5-proof",{cache:"no-store"});
      if(!res.ok)throw new Error("proof");
      await load();
    }finally{setRunning(false)}
  };

  return <div className="os-app">
    <header className="os-topbar">
      <a className="os-brand" href="/">
        <span className="os-brandmark"><i/><i/><i/><i/></span>
        <strong>ThirdSight</strong>
      </a>
      <button className="os-workspace">Commerce Lab <ChevronDown size={13}/></button>
      <label className="os-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search integration, origin, field…"/></label>
      <div className="os-top-actions">
        <span className="os-live"><i/> evidence live</span>
        <button onClick={()=>void load()} aria-label="Refresh"><RefreshCw size={14}/></button>
        <button className="os-run" onClick={runProof} disabled={running}><Play size={13}/>{running?"Running":"Run proof"}</button>
      </div>
    </header>

    <div className="os-shell">
      <aside className="os-integrations">
        <div className="os-side-head">
          <div><span>Integrations</span><b>{exposures.length}</b></div>
          <small>Who can touch customer data</small>
        </div>

        <button className={"os-all-integrations "+(!selectedIntegration?"active":"")} onClick={()=>setSelectedIntegration(null)}>
          <Layers3 size={14}/><span>All activity</span><b>{events.length}</b>
        </button>

        <div className="os-integration-list">
          {exposures.map(row=><button key={row.key} className={selectedIntegration===integrationKey(row)?"active":""} onClick={()=>setSelectedIntegration(integrationKey(row))}>
            <span className={"os-int-dot "+tone(row.latestResponse,row.findings.length)}/>
            <div><strong>{rowName(row)}</strong><small>{row.destinations[0]?host(row.destinations[0]):row.integrationId??"Unresolved"}</small></div>
            <em>{row.observations}</em>
          </button>)}
        </div>

        <div className="os-side-foot">
          <span><Globe2 size={12}/> Browser + managed evidence</span>
          <a href="/commerce-lab">Commerce Lab <ArrowRight size={12}/></a>
        </div>
      </aside>

      <main className="os-main">
        {error?<div className="os-feed-error"><AlertTriangle size={14}/> Live evidence is unavailable. ThirdSight is not substituting mock data.</div>:null}

        <section className="os-spine">
          <div className="os-trace-head">
            <div>
              <span className="os-kicker">Selected access path</span>
              <h1>{selected?eventName(selected):loading?"Loading evidence…":"No evidence yet"}</h1>
              <p>{selected?destination(selected):"Waiting for a persisted integration event."}</p>
            </div>
            <div className="os-decision-block">
              <small>DETERMINISTIC RESPONSE</small>
              <strong className={tone(response,selected?.findings.length??0)}>{response}</strong>
              <span>{selected?.outcome==="PREVENTED"?"before transmission":selected?.outcome==="DETECTED"?"after access":selected?.decision?"evidence-backed":"discovery only"}</span>
            </div>
          </div>

          {selected?<div className="os-lanes">
            <EvidenceLane id="should" claim={selected.should}/>
            <EvidenceLane id="could" claim={selected.could}/>
            <EvidenceLane id="did" claim={selected.did}/>
            <EvidenceLane id="why" claim={selected.why}/>
            <div className={"os-response-gate "+tone(response,selected.findings.length)}>
              <span/>
              <b>{response}</b>
            </div>
          </div>:<div className="os-empty-spine">No persisted access selected.</div>}

          {selected?<div className="os-proof-strip">
            <div><span>Finding</span><strong>{selected.findings[0]?.type??"None"}</strong></div>
            <div><span>Removed</span><strong>{selected.enforcement?.removedFields.join(", ")||"—"}</strong></div>
            <div><span>Continued</span><strong>{selected.enforcement?.continuedFields.join(", ")||"—"}</strong></div>
            <div><span>Receiver proof</span><strong>{selected.enforcement?selected.enforcement.receiver.forbiddenFieldReceived?"Forbidden field arrived":"Forbidden field absent":"—"}</strong></div>
          </div>:null}
        </section>

        <section className="os-lower">
          <div className="os-ledger">
            <div className="os-section-title">
              <div><span>Live access ledger</span><small>Persisted representative evidence</small></div>
              <b>{visibleEvents.length}</b>
            </div>
            <div className="os-ledger-head"><span>Integration</span><span>Access</span><span>Response</span><span>When</span></div>
            <div className="os-ledger-body">
              {visibleEvents.map(event=><button key={event.recordId} className={selected?.recordId===event.recordId?"active":""} onClick={()=>setSelectedId(event.recordId)}>
                <div><span className={"os-event-dot "+tone(responseLabel(event),event.findings.length)}/><strong>{eventName(event)}</strong><small>{boundary(event)}</small></div>
                <div><strong>{primaryAccess(event)}</strong><small>{summary(event)}</small></div>
                <span className={"os-response-label "+tone(responseLabel(event),event.findings.length)}>{responseLabel(event)}</span>
                <time>{relative(event.observedAt)}</time>
              </button>)}
              {!visibleEvents.length?<div className="os-ledger-empty">No evidence matches the current filter.</div>:null}
            </div>
          </div>

          <aside className="os-inspector">
            <div className="os-section-title">
              <div><span>Proof</span><small>Why this response happened</small></div>
              <button><Copy size={13}/></button>
            </div>
            {selected?<>
              <div className="os-inspector-block">
                <span>Observed object</span>
                <code>{primaryAccess(selected)}</code>
                <small>{summary(selected)}</small>
              </div>
              <div className="os-inspector-block">
                <span>Coverage</span>
                <strong>{selected.coverage.label}</strong>
                <small>{selected.coverage.limitations[0]??"No additional limitation recorded."}</small>
              </div>
              <div className="os-inspector-block">
                <span>Authority boundary</span>
                <strong>{selected.vendorIntelligence.authorityBoundary}</strong>
              </div>
              <div className="os-proof-callout">
                <ShieldCheck size={16}/>
                <div><strong>{proofHeadline(selected)}</strong><span>{proofCopy(selected)}</span></div>
              </div>
            </>:<div className="os-inspector-empty">Select a ledger row to inspect evidence.</div>}
          </aside>
        </section>

        <section className="os-validation-bar">
          <div><Eye size={14}/><span>Busy sale</span><strong>{data.challengeProof?.busySale.passed?"0 false alarms":"Awaiting proof"}</strong></div>
          <div><Activity size={14}/><span>Abnormal behaviour</span><strong>{data.challengeProof?.abnormalBehavior.observed?"Caught":"Not observed"}</strong></div>
          <div><SlidersHorizontal size={14}/><span>Scope control</span><strong>{data.challengeProof?.scopePrevention.proven?"Pre-send proven":"Awaiting proof"}</strong></div>
        </section>
      </main>
    </div>
  </div>;
}

function EvidenceLane({id,claim}:{id:keyof typeof laneMeta;claim:Claim}){
  const meta=laneMeta[id];
  return <div className={"os-lane "+id+" "+claim.status.toLowerCase()}>
    <div className="os-lane-label"><b>{meta.label}</b><span>{meta.question}</span></div>
    <div className="os-lane-claim">
      <strong>{claimHeadline(id,claim)}</strong>
      <small>{claim.reason??meta.source}</small>
    </div>
    <span className="os-lane-status">{claim.status}</span>
    <div className="os-lane-track"><i/><b/></div>
  </div>;
}

function claimHeadline(id:keyof typeof laneMeta,claim:Claim){
  if(id==="should")return claim.value?.purpose??(claim.status==="UNKNOWN"?"No merchant approval":"Purpose recorded");
  if(id==="could")return claim.value?.allowedFields?.join(", ")??claim.value?.dataCategories?.join(", ")??(claim.status==="UNKNOWN"?"Capability unresolved":"Capability partially known");
  if(id==="did")return claim.value?.dataCategories?.join(", ")??claim.value?.destinationOrigin??"Runtime observation";
  return claim.value?.eventType??claim.value?.event?.type??(claim.status==="UNKNOWN"?"No trusted business context":"Context recorded");
}

function eventName(event:EventRow){
  return event.vendorIntelligence.profiles[0]?.family??event.vendorIntelligence.profiles[0]?.vendor??event.integrationId??host(event.did.value?.destinationOrigin??"Unknown integration");
}
function rowName(row:ExposureRow){return row.vendorIntelligence.profiles[0]?.family??row.vendorIntelligence.profiles[0]?.vendor??row.label}
function integrationKey(row:ExposureRow){return row.integrationId??rowName(row)}
function destination(event:EventRow){return [event.did.value?.method,event.did.value?.destinationOrigin,event.did.value?.destinationPath].filter(Boolean).join(" · ")||"No destination captured"}
function primaryAccess(event:EventRow){return event.enforcement?.removedFields[0]??event.findings.find(f=>f.field)?.field??event.did.value?.dataCategories?.[0]??event.did.value?.destinationOrigin??"Third-party request"}
function summary(event:EventRow){
  if(event.enforcement?.removedFields.length)return "Removed "+event.enforcement.removedFields.join(", ")+" before send";
  if(event.findings[0]?.reason)return event.findings[0].reason;
  if(event.did.value?.destinationOrigin)return host(event.did.value.destinationOrigin);
  return "Persisted integration evidence";
}
function responseLabel(event:EventRow|null){return event?.outcome??event?.decision??"OBSERVED"}
function tone(value:string,findings=0){const v=value.toUpperCase();if(v==="ALLOW")return"allow";if(v==="PREVENTED"||v==="CONSTRAIN")return"constrain";if(v==="DETECTED"||v==="ISOLATE")return"isolate";if(v==="OBSERVE"||findings>0)return"observe";return"unknown"}
function boundary(event:EventRow){return String(event.did.value?.boundary??"runtime").replaceAll("_"," ")}
function host(value:string){try{return new URL(value).hostname}catch{return value}}
function relative(value:string){const t=Date.parse(value);if(!Number.isFinite(t))return"—";const d=Math.max(0,Date.now()-t),m=Math.floor(d/60000);if(m<1)return"now";if(m<60)return m+"m";const h=Math.floor(m/60);if(h<24)return h+"h";return Math.floor(h/24)+"d"}
function proofHeadline(event:EventRow){if(event.outcome==="PREVENTED")return"Stopped before transmission";if(event.outcome==="DETECTED")return"Detected after access";if(event.decision==="ALLOW")return"Access matched available evidence";if(event.decision==="OBSERVE")return"Evidence remains unresolved";return"Deterministic response recorded"}
function proofCopy(event:EventRow){if(event.outcome==="PREVENTED")return"Approved fields continued while the unsupported field was removed.";if(event.outcome==="DETECTED")return"ThirdSight observed the mismatch but does not claim pre-send prevention.";if(event.decision==="ALLOW")return"Purpose, runtime behaviour and business context were consistent.";return event.findings[0]?.reason??"ThirdSight kept authority bounded to what the evidence supports."}
