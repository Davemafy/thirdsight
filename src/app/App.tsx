import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  ChevronRight,
  CircleCheck,
  Clock3,
  Code2,
  Database,
  Eye,
  Globe2,
  Layers3,
  Network,
  PlugZap,
  Radio,
  Search,
  ShieldCheck,
  ShieldEllipsis,
  SlidersHorizontal,
  Workflow,
  X,
} from "lucide-react";
import type {
  BrowserCapabilityLowerBound,
  BusinessContextEvidence,
  EvidenceClaim,
  EvidenceCoverage,
  PurposeEvidence,
  RuntimeAccessEvidence,
} from "../domain/evidence";
import type { BlindSpotAssessment } from "../domain/blind-spot-assessment";
import { LearningLoopPanel } from "./LearningLoopPanel";
import { IntegrationExposureMap, type ChallengeProof, type ExposureRow } from "./IntegrationExposureMap";
import { RealWorldValidation } from "./RealWorldValidation";
import "./ProductConsole.css";

type View="overview"|"integrations"|"activity"|"incidents"|"policies"|"connections"|"validation";
type Finding={type:string;action:string;field?:string;reason?:string};
type Enforcement={action:"CONSTRAIN"|"ISOLATE";outcome:"PREVENTED";removedFields:readonly string[];continuedFields:readonly string[];receiver:{receivedFields:readonly string[];forbiddenFieldReceived:boolean}};
type Containment={action:"ISOLATE";credentialId:string;applied:boolean};
type AiAssessmentView={
  analystVersion:string;
  model:string;
  accepted:boolean;
  authorityViolation:boolean;
  output:{
    assessment:"NEEDS_REVIEW"|"INSUFFICIENT_EVIDENCE"|"EXPLAINABLE_OBSERVATION";
    evidence_used:readonly string[];
    unsupported_assumptions:readonly string[];
    confidence:"LOW"|"MEDIUM"|"HIGH";
    recommended_response:"OBSERVE"|"REVIEW"|"ABSTAIN";
    explanation:string;
  };
};
type ConsoleEvent={
  recordId:string;
  observedAt:string;
  integrationId:string|null;
  integrationResolution:string;
  should:EvidenceClaim<PurposeEvidence>;
  could:EvidenceClaim<BrowserCapabilityLowerBound>;
  did:EvidenceClaim<RuntimeAccessEvidence>;
  why:EvidenceClaim<BusinessContextEvidence>;
  coverage:EvidenceCoverage;
  findings:readonly Finding[];
  enforcement:Enforcement|null;
  containment:Containment|null;
  blindSpotAssessment:BlindSpotAssessment|null;
  aiAssessment:AiAssessmentView|null;
  decision:"ALLOW"|"OBSERVE"|"CONSTRAIN"|"ISOLATE"|null;
  outcome:"PREVENTED"|"DETECTED"|null;
};

const viewCopy:Record<View,{title:string;subtitle:string}>={
  overview:{title:"Overview",subtitle:"Third-party access posture across your connected stack."},
  integrations:{title:"Integrations",subtitle:"What each integration can reach, what it touched and whether that matches its job."},
  activity:{title:"Activity",subtitle:"Representative persisted integration evidence from the operational workspace."},
  incidents:{title:"Incidents",subtitle:"Representative deterministic findings, prevented access and post-access detections."},
  policies:{title:"Policies",subtitle:"Approved purposes and data scope for registered integrations."},
  connections:{title:"Connections",subtitle:"How another platform connects ThirdSight to its browser, backend and audit surfaces."},
  validation:{title:"Validation",subtitle:"Controlled ground-truth proof and bounded public-site discovery evidence."},
};

export default function App(){
  const [events,setEvents]=useState<ConsoleEvent[]>([]);
  const [selected,setSelected]=useState(0);
  const [view,setView]=useState<View>("overview");
  const [detailOpen,setDetailOpen]=useState(false);
  const [error,setError]=useState(false);
  const [aiPromoted,setAiPromoted]=useState(false);
  const [exposureMap,setExposureMap]=useState<ExposureRow[]>([]);
  const [challengeProof,setChallengeProof]=useState<ChallengeProof|null>(null);
  const [query,setQuery]=useState("");

  useEffect(()=>{
    let live=true;
    const load=()=>fetch("/api/console-events",{cache:"no-store"})
      .then(r=>{if(!r.ok)throw new Error("evidence unavailable");return r.json()})
      .then(d=>{
        if(!live)return;
        const history=(d.history??[]) as ConsoleEvent[];
        setEvents(history);
        setExposureMap((d.exposureMap??[]) as ExposureRow[]);
        setChallengeProof((d.challengeProof??null) as ChallengeProof|null);
        setAiPromoted(Boolean(d.aiAnalyst?.promoted));
        setSelected(current=>current<history.length?current:0);
        setError(false);
      })
      .catch(()=>live&&setError(true));
    load();
    const id=window.setInterval(load,5000);
    return()=>{live=false;window.clearInterval(id)};
  },[]);

  const selectedEvent=events[selected]??events[0]??null;
  const registered=exposureMap.filter(row=>Boolean(row.integrationId));
  const unregistered=exposureMap.filter(row=>!row.integrationId);
  const findings=exposureMap.filter(row=>row.findings.length>0);
  const normalizedQuery=query.trim().toLowerCase();
  const filteredExposure=useMemo(()=>exposureMap.filter(row=>{
    if(!normalizedQuery)return true;
    return [
      row.label,
      row.integrationId??"",
      ...row.destinations,
      ...row.approvedFields,
      ...row.attemptedFields,
      ...row.findings,
    ].join(" ").toLowerCase().includes(normalizedQuery);
  }),[exposureMap,normalizedQuery]);

  const openEvent=(index:number)=>{
    if(index<0||index>=events.length)return;
    setSelected(index);
    setDetailOpen(true);
  };

  const openRow=(row:ExposureRow)=>{
    const index=events.findIndex(event=>
      (row.integrationId!==null&&event.integrationId===row.integrationId)||
      (event.did.value?.destinationOrigin?row.destinations.includes(event.did.value.destinationOrigin):false)
    );
    if(index>=0)openEvent(index);
  };

  const current=viewCopy[view];

  return <div className="ts-shell">
    <div className="ts-sidebar">
      <button className="ts-brand" onClick={()=>setView("overview")}>
        <span><ShieldCheck size={20}/></span>
        <div><strong>ThirdSight</strong><small>Integration security</small></div>
      </button>

      <div className="ts-nav">
        <NavButton active={view==="overview"} icon={<Layers3 size={16}/>} label="Overview" onClick={()=>setView("overview")}/>
        <NavButton active={view==="integrations"} icon={<PlugZap size={16}/>} label="Integrations" onClick={()=>setView("integrations")}/>
        <NavButton active={view==="activity"} icon={<Activity size={16}/>} label="Activity" onClick={()=>setView("activity")}/>
        <NavButton active={view==="incidents"} icon={<AlertTriangle size={16}/>} label="Incidents" onClick={()=>setView("incidents")}/>
        <NavButton active={view==="policies"} icon={<BookOpenCheck size={16}/>} label="Policies" onClick={()=>setView("policies")}/>
        <NavButton active={view==="connections"} icon={<Network size={16}/>} label="Connections" onClick={()=>setView("connections")}/>
        <div className="ts-nav-separator"/>
        <NavButton active={view==="validation"} icon={<CircleCheck size={16}/>} label="Validation" onClick={()=>setView("validation")}/>
      </div>

      <div className="ts-sidebar-foot">
        <span><Radio size={12}/> Evidence live</span>
        <small>Persisted evidence only. Unknown stays unknown.</small>
      </div>
    </div>

    <div className="ts-workspace">
      <div className="ts-topbar">
        <div>
          <strong>{current.title}</strong>
          <span>{current.subtitle}</span>
        </div>
        <div className="ts-topbar-actions">
          <span className="ts-env"><span/> Commerce Lab</span>
          <button className="ts-connect-button" onClick={()=>setView("connections")}><PlugZap size={14}/> Connect platform</button>
        </div>
      </div>

      <div className="ts-content">
        {error?<div className="ts-error"><AlertTriangle size={16}/><div><strong>Live evidence is unavailable.</strong><span>ThirdSight will not substitute mock data for the production evidence feed.</span></div></div>:null}

        {view==="overview"?<Overview
          exposure={exposureMap}
          events={events}
          proof={challengeProof}
          registeredCount={registered.length}
          unregisteredCount={unregistered.length}
          findingCount={findings.length}
          onViewIntegrations={()=>setView("integrations")}
          onConnections={()=>setView("connections")}
          onOpenRow={openRow}
          onOpenEvent={openEvent}
        />:null}

        {view==="integrations"?<Integrations
          rows={filteredExposure}
          query={query}
          onQuery={setQuery}
          onOpen={openRow}
        />:null}

        {view==="activity"?<ActivityView events={events} onOpen={openEvent}/>:null}
        {view==="incidents"?<IncidentView events={events} onOpen={openEvent}/>:null}
        {view==="policies"?<Policies rows={registered} events={events} onOpen={openRow}/>:null}
        {view==="connections"?<Connections rows={exposureMap} proof={challengeProof}/>:null}
        {view==="validation"?<Validation rows={exposureMap} proof={challengeProof}/>:null}
      </div>
    </div>

    {detailOpen&&selectedEvent?<EvidenceDrawer
      event={selectedEvent}
      aiPromoted={aiPromoted}
      onClose={()=>setDetailOpen(false)}
    />:null}
  </div>;
}

function NavButton({active,icon,label,count,onClick}:{active:boolean;icon:React.ReactNode;label:string;count?:number;onClick:()=>void}){
  return <button className={"ts-nav-button "+(active?"active":"")} onClick={onClick}>
    <span>{icon}</span><b>{label}</b>{typeof count==="number"&&count>0?<em>{count}</em>:null}
  </button>;
}

function Overview({
  exposure,
  events,
  proof,
  registeredCount,
  unregisteredCount,
  findingCount,
  onViewIntegrations,
  onConnections,
  onOpenRow,
  onOpenEvent,
}:{
  exposure:readonly ExposureRow[];
  events:readonly ConsoleEvent[];
  proof:ChallengeProof|null;
  registeredCount:number;
  unregisteredCount:number;
  findingCount:number;
  onViewIntegrations:()=>void;
  onConnections:()=>void;
  onOpenRow:(row:ExposureRow)=>void;
  onOpenEvent:(index:number)=>void;
}){
  const prevented=proof?.scopePrevention.proven??false;
  return <>
    <div className="ts-hero">
      <div className="ts-hero-copy">
        <span className="ts-kicker">Third-party access control</span>
        <h1>Know what every integration can reach. Catch when it goes beyond its job.</h1>
        <p>ThirdSight compares approved purpose, technical reach, runtime behaviour and business context—then applies the smallest justified response without treating normal business spikes as attacks.</p>
        <div className="ts-hero-actions">
          <button className="ts-primary" onClick={onViewIntegrations}>View integrations <ArrowRight size={15}/></button>
          <button className="ts-secondary" onClick={onConnections}>How to connect a platform</button>
        </div>
      </div>
      <div className="ts-hero-model">
        <span>Decision model</span>
        <div><b>SHOULD</b><small>approved purpose</small></div>
        <div><b>COULD</b><small>technical reach</small></div>
        <div><b>DID</b><small>observed access</small></div>
        <div><b>WHY</b><small>business context</small></div>
      </div>
    </div>

    <div className="ts-stat-grid">
      <StatCard label="Registered integrations" value={String(registeredCount)} detail="Purpose-aware identities" icon={<PlugZap size={17}/>}/>
      <StatCard label="Unregistered destinations" value={String(unregisteredCount)} detail="Observed, not automatically malicious" icon={<Eye size={17}/>}/>
      <StatCard label="Integrations with findings" value={String(findingCount)} detail="Deterministic evidence attached" icon={<AlertTriangle size={17}/>}/>
      <StatCard label="Managed prevention" value={prevented?"Proven":"Not yet"} detail={prevented?"Unjustified field stopped pre-send":"No persisted pre-send proof"} icon={<ShieldCheck size={17}/>}/>
    </div>

    <div className="ts-overview-grid">
      <Panel title="Integration posture" subtitle="Highest-signal integrations and observed destinations." action="View all" onAction={onViewIntegrations}>
        <CompactIntegrationTable rows={exposure.slice(0,6)} onOpen={onOpenRow}/>
      </Panel>
      <Panel title="Recent activity" subtitle="Representative persisted evidence." >
        <div className="ts-activity-list">
          {events.slice(0,6).map((event,index)=><ActivityRow key={event.recordId} event={event} onClick={()=>onOpenEvent(index)}/>)}
          {events.length===0?<EmptyState text="Waiting for persisted evidence."/>:null}
        </div>
      </Panel>
    </div>

    <div className="ts-proof-strip">
      <div>
        <span><CircleCheck size={15}/></span>
        <p><small>Busy sales day</small><b>{proof?.busySale.passed?"No false alarm":"Awaiting proof"}</b></p>
      </div>
      <div>
        <span><AlertTriangle size={15}/></span>
        <p><small>Abnormal partner behaviour</small><b>{proof?.abnormalBehavior.observed?"Caught":"Not observed"}</b></p>
      </div>
      <div>
        <span><SlidersHorizontal size={15}/></span>
        <p><small>Graded response</small><b>ALLOW → OBSERVE → CONSTRAIN → ISOLATE</b></p>
      </div>
      <div>
        <span><ShieldCheck size={15}/></span>
        <p><small>Managed scope control</small><b>{proof?.scopePrevention.proven?"Prevented before send":"Awaiting proof"}</b></p>
      </div>
    </div>
  </>;
}

function Integrations({rows,query,onQuery,onOpen}:{rows:readonly ExposureRow[];query:string;onQuery:(value:string)=>void;onOpen:(row:ExposureRow)=>void}){
  return <div className="ts-page-stack">
    <div className="ts-section-head">
      <div><span className="ts-kicker">Inventory</span><h2>Integration exposure</h2><p>Registered integrations and discovered destinations are kept distinct. Discovery is not a verdict.</p></div>
      <label className="ts-search"><Search size={15}/><input value={query} onChange={e=>onQuery(e.target.value)} placeholder="Search integrations, fields, destinations…"/></label>
    </div>
    <div className="ts-table-card">
      <div className="ts-table-head integration">
        <span>Integration</span><span>Can reach</span><span>Actually touched</span><span>Approved</span><span>Response</span>
      </div>
      {rows.map(row=><IntegrationRow key={row.key} row={row} onClick={()=>onOpen(row)}/>)}
      {rows.length===0?<EmptyState text="No integrations match this search."/>:null}
    </div>
  </div>;
}

function ActivityView({events,onOpen}:{events:readonly ConsoleEvent[];onOpen:(index:number)=>void}){
  return <div className="ts-page-stack">
    <div className="ts-section-head"><div><span className="ts-kicker">Evidence history</span><h2>What integrations actually did</h2><p>Representative persisted evidence from the operational workspace. Every row opens the evidence behind the decision.</p></div></div>
    <div className="ts-list-card">
      {events.map((event,index)=><ActivityRow key={event.recordId} event={event} onClick={()=>onOpen(index)} large/>)}
      {events.length===0?<EmptyState text="No persisted evidence is available yet."/>:null}
    </div>
  </div>;
}

function IncidentView({events,onOpen}:{events:readonly ConsoleEvent[];onOpen:(index:number)=>void}){
  const incidents=events.map((event,index)=>({event,index})).filter(item=>isIncident(item.event));
  return <div className="ts-page-stack">
    <div className="ts-section-head"><div><span className="ts-kicker">Deterministic findings</span><h2>Incident evidence</h2><p>Representative violations and detections from persisted evidence. Prevention and detection remain separate outcomes.</p></div></div>
    <div className="ts-list-card">
      {incidents.map(({event,index})=><ActivityRow key={event.recordId} event={event} onClick={()=>onOpen(index)} large/>)}
      {incidents.length===0?<EmptyState text="No representative incident evidence is currently in the queue."/>:null}
    </div>
  </div>;
}

function Policies({rows,events,onOpen}:{rows:readonly ExposureRow[];events:readonly ConsoleEvent[];onOpen:(row:ExposureRow)=>void}){
  return <div className="ts-page-stack">
    <div className="ts-section-head"><div><span className="ts-kicker">Purpose contracts</span><h2>What each integration is supposed to do</h2><p>Policy is shown separately from observed behavior so runtime activity cannot rewrite the approved purpose.</p></div></div>
    <div className="ts-table-card">
      <div className="ts-table-head policy"><span>Integration</span><span>Approved purpose</span><span>Approved data</span><span>Policy state</span></div>
      {rows.map(row=>{
        const related=events.find(event=>event.integrationId===row.integrationId);
        const purpose=related?.should.value?.purpose??"Purpose not present in representative evidence";
        const known=Boolean(related?.should.status==="KNOWN");
        return <button className="ts-table-row policy" key={row.key} onClick={()=>onOpen(row)}>
          <div><strong>{row.label}</strong><small>{row.integrationId}</small></div>
          <div className="ts-copy-cell">{purpose}</div>
          <TagList values={row.approvedFields} fallback="No approved fields surfaced"/>
          <div><StatusPill value={known?"PURPOSE KNOWN":"REVIEW POLICY"}/></div>
        </button>;
      })}
      {rows.length===0?<EmptyState text="No registered integration policies are visible yet."/>:null}
    </div>
  </div>;
}

function Connections({rows,proof}:{rows:readonly ExposureRow[];proof:ChallengeProof|null}){
  const browserProven=rows.some(row=>row.boundaries.includes("browser"));
  const auditProven=rows.some(row=>row.boundaries.some(boundary=>boundary.includes("db")));
  const managedProven=proof?.scopePrevention.proven??false;
  return <div className="ts-page-stack">
    <div className="ts-connect-hero">
      <div><span className="ts-kicker">Platform onboarding</span><h2>Connect ThirdSight where third parties touch customer data.</h2><p>You do not rebuild your platform around ThirdSight. Choose the boundary that matches the integration: inline managed requests for prevention, browser observation for discovery, or audit evidence for post-access detection.</p></div>
      <div className="ts-connection-flow">
        <span><b>1</b>Choose boundary</span><i><ArrowRight size={14}/></i>
        <span><b>2</b>Register purpose</span><i><ArrowRight size={14}/></i>
        <span><b>3</b>Stream evidence</span><i><ArrowRight size={14}/></i>
        <span><b>4</b>Monitor & respond</span>
      </div>
    </div>

    <div className="ts-connector-grid">
      <ConnectorCard
        icon={<Workflow size={18}/>}
        title="Managed request boundary"
        badge={managedProven?"Proven in prototype":"Prototype path"}
        tone="strong"
        summary="Best protection. Place ThirdSight in the outbound integration path so approved purpose and business context can be checked before data leaves."
        bullets={["Purpose Contract can be authoritative","Can remove only unjustified fields before send","Supports PREVENTED when receiver non-receipt is proven"]}
      />
      <ConnectorCard
        icon={<Globe2 size={18}/>}
        title="Browser sensor"
        badge={browserProven?"Observed in prototype":"Prototype path"}
        tone="neutral"
        summary="Fastest discovery path. The browser sensor forwards privacy-reduced request metadata to the existing ingestion endpoint."
        bullets={["DID is directly observed","COULD is only a browser-visible lower bound","No request bodies, cookies, query strings or form values forwarded"]}
      />
      <ConnectorCard
        icon={<Database size={18}/>}
        title="Audit / backend evidence"
        badge={auditProven?"Observed in prototype":"Prototype path"}
        tone="neutral"
        summary="Use database or gateway audit events when the integration already exists and cannot be placed behind an inline boundary."
        bullets={["Strong post-access evidence","Can support containment of future credential use","Already-observed reads remain DETECTED, not PREVENTED"]}
      />
    </div>

    <div className="ts-connection-detail-grid">
      <div className="ts-code-card">
        <div><span><Code2 size={15}/></span><div><strong>Browser sensor configuration</strong><small>Current prototype contract</small></div></div>
        <pre>{`chrome.runtime.sendMessage({
  type: "THIRDSIGHT_SET_INGESTION_CONFIG",
  endpoint: "https://<host>/api/browser-observations",
  token: "<installation-token>"
})`}</pre>
        <p>The installation token authenticates the prototype sensor to the ingestion endpoint. It is not device attestation.</p>
      </div>
      <div className="ts-coverage-card">
        <span className="ts-kicker">Coverage truth</span>
        <h3>What changes by connection mode</h3>
        <div className="ts-coverage-row"><b>Managed boundary</b><span>SHOULD + DID + WHY can be strong enough for pre-send policy enforcement.</span></div>
        <div className="ts-coverage-row"><b>Browser sensor</b><span>DID is observed; COULD is partial; SHOULD and WHY stay unknown unless the merchant supplies them.</span></div>
        <div className="ts-coverage-row"><b>Audit stream</b><span>Excellent for proving access after it happened; not a claim of inline prevention.</span></div>
        <div className="ts-offline-note"><ShieldEllipsis size={15}/><p><b>Network loss:</b> the current prototype does not claim uninterrupted central coverage while disconnected. Missing periods must remain visible as coverage gaps rather than inferred away.</p></div>
      </div>
    </div>
  </div>;
}

function Validation({rows,proof}:{rows:readonly ExposureRow[];proof:ChallengeProof|null}){
  return <div className="ts-validation-stack">
    <div className="ts-section-head"><div><span className="ts-kicker">Judge proof</span><h2>Challenge requirements, separated from product operations</h2><p>Commerce Lab proves correctness under ground truth. Public-site discovery proves external breadth under explicit visibility limits.</p></div></div>
    <IntegrationExposureMap rows={rows.slice(0,10)} proof={proof}/>
    <RealWorldValidation/>
  </div>;
}

function CompactIntegrationTable({rows,onOpen}:{rows:readonly ExposureRow[];onOpen:(row:ExposureRow)=>void}){
  if(rows.length===0)return <EmptyState text="No persisted integration exposure evidence yet."/>;
  return <div className="ts-compact-table">
    {rows.map(row=><button key={row.key} onClick={()=>onOpen(row)}>
      <div className="ts-integration-name"><span className={"ts-integration-dot "+responseClass(row.latestResponse)}/><p><b>{row.label}</b><small>{row.integrationId??"Unregistered destination"}</small></p></div>
      <div className="ts-compact-tags"><TagList values={row.attemptedFields} fallback={row.boundaries.length?row.boundaries.join(" + "):"No field metadata"}/></div>
      <StatusPill value={row.latestResponse}/>
      <ChevronRight size={15}/>
    </button>)}
  </div>;
}

function IntegrationRow({row,onClick}:{row:ExposureRow;onClick:()=>void}){
  return <button className="ts-table-row integration" onClick={onClick}>
    <div className="ts-integration-name"><span className={"ts-integration-dot "+responseClass(row.latestResponse)}/><p><b>{row.label}</b><small>{row.integrationId??"identity unresolved"} · {row.observations} observations</small></p></div>
    <TagList values={row.canReachFields} fallback={row.reachSource==="OBSERVED_LOWER_BOUND"?"Browser-visible lower bound":"Not declared"}/>
    <TagList values={row.attemptedFields} blocked={row.preventedFields} fallback={row.boundaries.length?row.boundaries.map(v=>v+" metadata").join(", "):"Not observed"}/>
    <TagList values={row.approvedFields} fallback="Not provided"/>
    <div className="ts-response-cell"><StatusPill value={row.latestResponse}/>{row.findings.slice(0,1).map(value=><small key={value}>{humanize(value)}</small>)}</div>
  </button>;
}

function ActivityRow({event,onClick,large=false}:{event:ConsoleEvent;onClick:()=>void;large?:boolean}){
  const value=eventStatus(event);
  return <button className={"ts-activity-row "+(large?"large":"")} onClick={onClick}>
    <span className={"ts-activity-icon "+responseClass(value)}>{eventIcon(value)}</span>
    <div className="ts-activity-copy">
      <strong>{integrationLabel(event)}</strong>
      <span>{eventSummary(event)}</span>
      <small>{new Date(event.observedAt).toLocaleString()} · {event.coverage.label.replaceAll("_"," ").toLowerCase()}</small>
    </div>
    <StatusPill value={value}/>
    <ChevronRight size={15}/>
  </button>;
}

function EvidenceDrawer({event,aiPromoted,onClose}:{event:ConsoleEvent;aiPromoted:boolean;onClose:()=>void}){
  const value=eventStatus(event);
  const discoveryOnly=event.coverage.label==="BROWSER_ONLY"&&event.should.status==="UNKNOWN"&&event.why.status==="UNKNOWN";
  return <div className="ts-drawer-layer" role="dialog" aria-modal="true">
    <button className="ts-drawer-backdrop" aria-label="Close evidence detail" onClick={onClose}/>
    <div className="ts-drawer">
      <div className="ts-drawer-head">
        <div><span className="ts-kicker">Evidence detail</span><h2>{integrationLabel(event)}</h2><p>{event.recordId}</p></div>
        <button className="ts-icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button>
      </div>
      <div className="ts-drawer-status"><StatusPill value={value}/><span>{eventSummary(event)}</span></div>

      {discoveryOnly?<div className="ts-boundary-note"><Eye size={16}/><p><b>Discovery only.</b> Browser-visible metadata does not establish merchant purpose, backend permissions or business justification.</p></div>:null}
      {event.blindSpotAssessment?<div className="ts-boundary-note warning"><AlertTriangle size={16}/><p><b>Known benchmark blind spot.</b> {event.blindSpotAssessment.reason}</p></div>:null}

      <div className="ts-evidence-grid">
        <EvidenceFact title="Should" status={event.should.status} value={event.should.value?.purpose??"No Purpose Contract provided"} detail={event.should.reason}/>
        <EvidenceFact title="Could" status={event.could.status} value={event.could.value?.statement??"Complete capability surface not available"} detail={event.could.reason}/>
        <EvidenceFact title="Did" status={event.did.status} value={didSummary(event)} detail={event.did.reason}/>
        <EvidenceFact title="Why" status={event.why.status} value={event.why.value?.eventType?event.why.value.eventType+" · "+event.why.value.correlationStrength:"No authoritative business context"} detail={event.why.reason}/>
      </div>

      <DecisionCard event={event}/>

      <details className="ts-details">
        <summary>Advanced evidence and provenance</summary>
        <div className="ts-raw-grid">
          <RawEvidence label="SHOULD" value={event.should}/>
          <RawEvidence label="COULD" value={event.could}/>
          <RawEvidence label="DID" value={event.did}/>
          <RawEvidence label="WHY" value={event.why}/>
        </div>
      </details>

      <details className="ts-details">
        <summary>Verified Learning</summary>
        <LearningLoopPanel recordId={event.recordId} deterministicResult={event.outcome??event.decision??"UNRESOLVED"}/>
      </details>

      {aiPromoted&&event.aiAssessment?.accepted?<details className="ts-details">
        <summary>Advisory AI analyst</summary>
        <div className="ts-ai-summary">
          <div><span>Assessment</span><b>{humanize(event.aiAssessment.output.assessment)}</b></div>
          <div><span>Recommendation</span><b>{event.aiAssessment.output.recommended_response}</b></div>
          <p>{event.aiAssessment.output.explanation}</p>
          <small>Advisory only. AI cannot alter SHOULD / COULD / DID / WHY or gain CONSTRAIN / ISOLATE authority.</small>
        </div>
      </details>:null}
    </div>
  </div>;
}

function DecisionCard({event}:{event:ConsoleEvent}){
  const value=eventStatus(event);
  return <div className={"ts-decision-card "+responseClass(value)}>
    <div><span>What ThirdSight did</span><strong>{value}</strong></div>
    <p>{eventSummary(event)}</p>
    {event.findings.length>0?<div className="ts-decision-meta"><span>Finding <b>{humanize(event.findings[0].type)}</b></span><span>Response <b>{event.findings[0].action}</b></span></div>:null}
    {event.enforcement?<div className="ts-enforcement-grid">
      <div><span>Removed before send</span><b>{event.enforcement.removedFields.join(", ")||"none"}</b></div>
      <div><span>Continued</span><b>{event.enforcement.continuedFields.join(", ")||"none"}</b></div>
      <div><span>Receiver got</span><b>{event.enforcement.receiver.receivedFields.join(", ")||"none"}</b></div>
      <div><span>Forbidden field received</span><b>{event.enforcement.receiver.forbiddenFieldReceived?"YES":"NO"}</b></div>
    </div>:null}
    {event.containment?<div className="ts-decision-meta"><span>Containment <b>{event.containment.action}</b></span><span>Applied <b>{event.containment.applied?"YES":"NO"}</b></span></div>:null}
  </div>;
}

function EvidenceFact({title,status,value,detail}:{title:string;status:string;value:string;detail?:string}){
  return <div className="ts-evidence-fact"><div><b>{title}</b><span className={"ts-evidence-status "+status.toLowerCase()}>{status}</span></div><strong>{value}</strong><p>{detail??"No explanatory note recorded."}</p></div>;
}

function RawEvidence({label,value}:{label:string;value:unknown}){
  return <div><span>{label}</span><pre>{JSON.stringify(value,null,2)}</pre></div>;
}

function Panel({title,subtitle,action,onAction,children}:{title:string;subtitle:string;action?:string;onAction?:()=>void;children:React.ReactNode}){
  return <div className="ts-panel">
    <div className="ts-panel-head"><div><strong>{title}</strong><span>{subtitle}</span></div>{action&&onAction?<button onClick={onAction}>{action}<ArrowRight size={13}/></button>:null}</div>
    {children}
  </div>;
}

function StatCard({label,value,detail,icon}:{label:string;value:string;detail:string;icon:React.ReactNode}){
  return <div className="ts-stat-card"><div><span>{icon}</span><small>{label}</small></div><strong>{value}</strong><p>{detail}</p></div>;
}

function ConnectorCard({icon,title,badge,tone,summary,bullets}:{icon:React.ReactNode;title:string;badge:string;tone:"strong"|"neutral";summary:string;bullets:readonly string[]}){
  return <div className={"ts-connector-card "+tone}>
    <div className="ts-connector-head"><span>{icon}</span><div><strong>{title}</strong><small>{badge}</small></div></div>
    <p>{summary}</p>
    <ul>{bullets.map(item=><li key={item}><CircleCheck size={13}/>{item}</li>)}</ul>
  </div>;
}

function TagList({values,blocked=[],fallback}:{values:readonly string[];blocked?:readonly string[];fallback:string}){
  if(values.length===0)return <div className="ts-tag-fallback">{fallback}</div>;
  return <div className="ts-tag-list">{values.slice(0,4).map(value=><span className={blocked.includes(value)?"blocked":""} key={value}>{value}</span>)}{values.length>4?<small>+{values.length-4}</small>:null}</div>;
}

function StatusPill({value}:{value:string}){
  return <span className={"ts-status-pill "+responseClass(value)}>{humanize(value)}</span>;
}

function EmptyState({text}:{text:string}){
  return <div className="ts-empty"><Eye size={17}/><span>{text}</span></div>;
}

function eventStatus(event:ConsoleEvent){
  return event.outcome??event.decision??(event.coverage.label==="BROWSER_ONLY"?"DISCOVERY":"UNRESOLVED");
}

function eventSummary(event:ConsoleEvent){
  if(event.outcome==="PREVENTED")return "An unjustified field was removed at the managed boundary before transmission.";
  if(event.outcome==="DETECTED")return event.did.value?.boundary==="db-audit"?"Access was observed after it occurred; future credential use may be contained.":"Runtime evidence proves the access occurred before the finding.";
  if(event.decision==="ALLOW")return "Observed access is consistent with approved scope and available business context.";
  if(event.decision==="CONSTRAIN")return "ThirdSight recorded a deterministic policy violation and a constrained response.";
  if(event.decision==="ISOLATE")return "ThirdSight recorded deterministic evidence strong enough to isolate future integration access.";
  if(event.decision==="OBSERVE")return "Evidence is incomplete or ambiguous, so ThirdSight keeps the integration under observation instead of escalating authority.";
  if(event.coverage.label==="BROWSER_ONLY")return "Browser-visible cross-origin request metadata was discovered and persisted.";
  return "Persisted evidence does not support a stronger enforcement claim.";
}

function integrationLabel(event:ConsoleEvent){
  if(event.integrationId)return humanize(event.integrationId);
  const origin=event.did.value?.destinationOrigin;
  if(origin){
    try{return new URL(origin).hostname;}catch{return origin;}
  }
  return "Unresolved destination";
}

function didSummary(event:ConsoleEvent){
  const did=event.did.value;
  if(!did)return "No runtime access evidence";
  const method=did.method??"";
  const destination=did.destinationOrigin??"";
  return [method,destination].filter(Boolean).join(" → ")||did.boundary;
}

function isIncident(event:ConsoleEvent){
  return event.findings.length>0||
    event.outcome==="PREVENTED"||
    event.outcome==="DETECTED"||
    event.decision==="CONSTRAIN"||
    event.decision==="ISOLATE";
}

function eventIcon(value:string){
  const normalized=value.toLowerCase();
  if(normalized==="allow")return <CircleCheck size={15}/>;
  if(normalized==="prevented"||normalized==="constrain")return <ShieldCheck size={15}/>;
  if(normalized==="detected"||normalized==="isolate")return <AlertTriangle size={15}/>;
  if(normalized==="observe"||normalized==="discovery")return <Eye size={15}/>;
  return <Clock3 size={15}/>;
}

function responseClass(value:string){
  const normalized=value.toLowerCase();
  if(normalized==="allow")return "allow";
  if(normalized==="observe"||normalized==="discovery")return "observe";
  if(normalized==="constrain"||normalized==="prevented")return "constrain";
  if(normalized==="isolate"||normalized==="detected")return "isolate";
  return "unknown";
}

function humanize(value:string){
  return value.split(/[-_]/g).filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1).toLowerCase()).join(" ");
}
