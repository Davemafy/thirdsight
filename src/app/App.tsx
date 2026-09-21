import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  ChevronRight,
  CircleCheck,
  Code2,
  Database,
  Eye,
  Globe2,
  Layers3,
  Network,
  MoreHorizontal,
  PlugZap,
  Search,
  ShieldCheck,
  ShieldEllipsis,
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
import type { VendorIntelligenceResolution } from "../vendor-intelligence/vendor-intelligence";
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
  vendorIntelligence:VendorIntelligenceResolution;
};

const viewCopy:Record<View,{title:string}>={
  overview:{title:"Boundary"},
  integrations:{title:"Integrations"},
  activity:{title:"Evidence"},
  incidents:{title:"Incidents"},
  policies:{title:"Policies"},
  connections:{title:"Connections"},
  validation:{title:"Validation"},
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
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);

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
      ...row.vendorIntelligence.profiles.flatMap(profile=>[
        profile.vendor,
        profile.family,
        ...profile.expectedPurposes,
        ...profile.documentedCapabilities,
        ...profile.documentedDataOrEvents,
      ]),
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
        <div><strong>ThirdSight</strong></div>
      </button>

      <div className="ts-nav">
        <NavButton active={view==="overview"} icon={<Layers3 size={16}/>} label="Boundary" onClick={()=>setView("overview")}/>
        <NavButton active={view==="integrations"} icon={<PlugZap size={16}/>} label="Integrations" onClick={()=>setView("integrations")}/>
        <NavButton active={view==="activity"||view==="incidents"} icon={<Activity size={16}/>} label="Evidence" onClick={()=>setView("activity")}/>
        <NavButton active={view==="policies"} icon={<BookOpenCheck size={16}/>} label="Policies" onClick={()=>setView("policies")}/>
        <NavButton active={view==="connections"} icon={<Network size={16}/>} label="Connections" onClick={()=>setView("connections")}/>
        <NavButton active={view==="validation"} icon={<CircleCheck size={16}/>} label="Validation" onClick={()=>setView("validation")}/>
      </div>
      <div className="ts-sidebar-foot">
        <strong>Commerce Lab</strong>
        <span>simulation · {events[0]?evidenceFreshness(events[0].observedAt):"no persisted evidence"}</span>
      </div>
    </div>

    <div className="ts-workspace">
      <div className="ts-topbar">
        <div className="ts-mobile-product">
          <span><ShieldCheck size={17}/></span>
          <div><b>ThirdSight</b><small>{current.title}</small></div>
        </div>
        <div className="ts-desktop-context">
          <strong>Commerce Lab</strong>
        </div>
        <div className="ts-topbar-actions">
          <span className="ts-evidence-freshness">{events[0]?evidenceFreshness(events[0].observedAt):"No persisted evidence yet"}</span>
          <button className="ts-mobile-more" onClick={()=>setMobileMenuOpen(true)} aria-label="More navigation"><MoreHorizontal size={19}/></button>
        </div>
      </div>

      <div className="ts-content">
        {error?<div className="ts-error"><AlertTriangle size={16}/><div><strong>Live evidence is unavailable.</strong><span>ThirdSight will not substitute mock data for the production evidence feed.</span></div></div>:null}

        {view==="overview"?<Overview
          exposure={exposureMap}
          events={events}
          onViewIntegrations={()=>setView("integrations")}
          onOpenRow={openRow}
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

    {mobileMenuOpen?<div className="ts-mobile-menu-layer">
      <button className="ts-mobile-menu-backdrop" aria-label="Close menu" onClick={()=>setMobileMenuOpen(false)}/>
      <div className="ts-mobile-menu">
        <div className="ts-mobile-menu-head"><div><strong>ThirdSight</strong><span>More</span></div><button onClick={()=>setMobileMenuOpen(false)} aria-label="Close"><X size={18}/></button></div>
        <button onClick={()=>{setView("policies");setMobileMenuOpen(false)}}><BookOpenCheck size={18}/><div><b>Policies</b><span>Approved purpose and data scope</span></div><ChevronRight size={16}/></button>
        <button onClick={()=>{setView("connections");setMobileMenuOpen(false)}}><Network size={18}/><div><b>Connections</b><span>Connect browser, backend and audit evidence</span></div><ChevronRight size={16}/></button>
        <button onClick={()=>{setView("validation");setMobileMenuOpen(false)}}><CircleCheck size={18}/><div><b>Validation</b><span>Controlled proof and public-site breadth</span></div><ChevronRight size={16}/></button>
      </div>
    </div>:null}

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
  onViewIntegrations,
  onOpenRow,
}:{
  exposure:readonly ExposureRow[];
  onViewIntegrations:()=>void;
  onOpenRow:(row:ExposureRow)=>void;
}){
  const discoveryRows=[...exposure]
    .sort((a,b)=>b.observations-a.observations)
    .slice(0,3);

  return <div className="ts-boundary-screen">
    <section className="ts-boundary-head">
      <div>
        <h1>Customer phone tried to leave the analytics boundary.</h1>
        <p>ThirdSight removed only the unapproved field. Product data continued to AnalyticsPartner.</p>
      </div>
      <div className="ts-boundary-result">
        <strong>Prevented</strong>
        <span>customer.phone did not reach the receiver</span>
      </div>
    </section>

    <div className="ts-boundary-column-head">
      <span>Store data</span>
      <span>Purpose Contract</span>
      <span>AnalyticsPartner</span>
    </div>

    <section className="ts-boundary-map" aria-label="Controlled Commerce Lab scope-prevention replay">
      <div className="ts-boundary-fields">
        <BoundaryField name="product.id" note="approved"/>
        <BoundaryField name="product.category" note="approved"/>
        <BoundaryField name="product.price" note="approved"/>
        <BoundaryField name="customer.phone" note="outside contract" danger/>
      </div>

      <div className="ts-boundary-flow">
        <div className="ts-contract-line"/>
        <div className="ts-contract-title">Measure product interest</div>
        <div className="ts-contract-fields">product.id · product.category · product.price</div>
        <svg viewBox="0 0 620 430" preserveAspectRatio="none" aria-hidden="true">
          <path className="ts-flow-line" d="M0 65 C165 65 420 65 620 65"/>
          <path className="ts-flow-line" d="M0 147 C165 147 420 147 620 147"/>
          <path className="ts-flow-line" d="M0 229 C165 229 420 229 620 229"/>
          <path className="ts-flow-line danger" d="M0 311 C145 311 240 311 307 311"/>
          <circle className="ts-flow-stop" cx="310" cy="311" r="13"/>
          <path className="ts-flow-x" d="M303 304 L317 318 M317 304 L303 318"/>
          <text className="ts-flow-label" x="338" y="61">continued</text>
          <text className="ts-flow-label" x="338" y="143">continued</text>
          <text className="ts-flow-label" x="338" y="225">continued</text>
          <text className="ts-flow-label danger" x="338" y="306">removed here</text>
        </svg>
      </div>

      <div className="ts-boundary-receiver">
        <BoundaryReceiver name="product.id" note="received"/>
        <BoundaryReceiver name="product.category" note="received"/>
        <BoundaryReceiver name="product.price" note="received"/>
        <BoundaryReceiver name="customer.phone" note="not received" muted/>
        <div className="ts-receiver-proof">
          <strong>Receiver confirmed no phone field</strong>
          <span>Managed boundary · PREVENTED</span>
        </div>
      </div>
    </section>

    <div className="ts-boundary-below">
      <section className="ts-boundary-section">
        <h2>Why it stopped</h2>
        <div className="ts-boundary-facts">
          <BoundaryFact label="Approved purpose" value="Measure product interest"/>
          <BoundaryFact label="Observed field" value="customer.phone"/>
          <BoundaryFact label="Finding" value="Scope drift"/>
          <BoundaryFact label="Response" value="Constrain only that field"/>
        </div>
        <p className="ts-evaluation-note">Frozen Stage 7 evaluation: 26/26 managed field-drift cases were prevented. Legitimate fields continued.</p>
      </section>

      <section className="ts-boundary-section">
        <div className="ts-boundary-section-head">
          <h2>Public discovery</h2>
          <button onClick={onViewIntegrations}>All observed origins <ArrowRight size={14}/></button>
        </div>
        <div className="ts-public-observations">
          {discoveryRows.map(row=>{
            const profile=row.vendorIntelligence.profiles[0]??null;
            return <button key={row.key} onClick={()=>onOpenRow(row)}>
              <div><strong>{profile?.family??row.label}</strong><span>{profile?.vendor??row.destinations[0]??"Identity unresolved"}</span></div>
              <b>{row.observations} observations</b>
            </button>;
          })}
          {discoveryRows.length===0?<EmptyState text="No public discovery evidence is currently available."/>:null}
        </div>
        <p className="ts-boundary-note">Browser discovery proves request execution only. It does not claim payload meaning, backend access, downstream receipt, or malicious intent.</p>
      </section>
    </div>

    <footer className="ts-boundary-footer">
      <strong>ThirdSight proves what can be proven, and shows where proof stops.</strong>
      <span>Commerce Lab · controlled validation replay</span>
    </footer>
  </div>;
}

function BoundaryField({name,note,danger=false}:{name:string;note:string;danger?:boolean}){
  return <div className={"ts-boundary-field "+(danger?"danger":"")}><code>{name}</code><span>{note}</span></div>;
}

function BoundaryReceiver({name,note,muted=false}:{name:string;note:string;muted?:boolean}){
  return <div className={"ts-boundary-dest "+(muted?"muted":"")}><strong>{name}</strong><span>{note}</span></div>;
}

function BoundaryFact({label,value}:{label:string;value:string}){
  return <div><span>{label}</span><b>{value}</b></div>;
}

function Integrations({rows,query,onQuery,onOpen}:{rows:readonly ExposureRow[];query:string;onQuery:(value:string)=>void;onOpen:(row:ExposureRow)=>void}){
  return <div className="ts-page-stack">
    <div className="ts-page-toolbar">
      <span>{rows.length} observed</span>
      <label className="ts-search"><Search size={15}/><input value={query} onChange={e=>onQuery(e.target.value)} placeholder="Search integrations…"/></label>
    </div>
    <div className="ts-table-card ts-flat-table">
      <div className="ts-table-head integration simple">
        <span>Integration</span><span>Approved data</span><span>Observed</span><span>Result</span>
      </div>
      {rows.map(row=><IntegrationRow key={row.key} row={row} onClick={()=>onOpen(row)}/>)}
      {rows.length===0?<EmptyState text="No integrations match this search."/>:null}
    </div>
  </div>;
}

function ActivityView({events,onOpen}:{events:readonly ConsoleEvent[];onOpen:(index:number)=>void}){
  return <div className="ts-page-stack">
    <div className="ts-page-toolbar"><span>{events.length} persisted records</span></div>
    <div className="ts-list-card ts-flat-list">
      {events.map((event,index)=><ActivityRow key={event.recordId} event={event} onClick={()=>onOpen(index)} large/>)}
      {events.length===0?<EmptyState text="No persisted evidence is available yet."/>:null}
    </div>
  </div>;
}

function IncidentView({events,onOpen}:{events:readonly ConsoleEvent[];onOpen:(index:number)=>void}){
  const incidents=events.map((event,index)=>({event,index})).filter(item=>isIncident(item.event));
  return <div className="ts-page-stack">
    <div className="ts-page-toolbar"><span>{incidents.length} incident{incidents.length===1?"":"s"}</span></div>
    <div className="ts-list-card ts-flat-list">
      {incidents.map(({event,index})=><ActivityRow key={event.recordId} event={event} onClick={()=>onOpen(index)} large/>)}
      {incidents.length===0?<EmptyState text="No incident evidence is currently in the queue."/>:null}
    </div>
  </div>;
}

function Policies({rows,events,onOpen}:{rows:readonly ExposureRow[];events:readonly ConsoleEvent[];onOpen:(row:ExposureRow)=>void}){
  return <div className="ts-page-stack">
    <div className="ts-page-toolbar"><span>{rows.length} registered policies</span></div>
    <div className="ts-table-card ts-flat-table">
      <div className="ts-table-head policy"><span>Integration</span><span>Approved purpose</span><span>Approved data</span><span>Policy</span></div>
      {rows.map(row=>{
        const related=events.find(event=>event.integrationId===row.integrationId);
        const purpose=related?.should.value?.purpose??"Purpose not present in representative evidence";
        const known=Boolean(related?.should.status==="KNOWN");
        return <button className="ts-table-row policy" key={row.key} onClick={()=>onOpen(row)}>
          <div><strong>{row.label}</strong><small>{row.integrationId}</small></div>
          <div className="ts-copy-cell">{purpose}</div>
          <TagList values={row.approvedFields} fallback="No approved fields surfaced"/>
          <div><StatusPill value={known?"PURPOSE_KNOWN":"REVIEW_POLICY"}/></div>
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
    <div className="ts-connection-title">
      <h2>Choose the boundary</h2>
      <span>Pre-send control, browser discovery, or audit evidence.</span>
    </div>

    <div className="ts-connector-grid ts-connector-list">
      <ConnectorCard
        icon={<Workflow size={18}/>}
        title="Managed request boundary"
        badge={managedProven?"Pre-send prevention proven":"Prototype path"}
        tone="strong"
        summary="Check purpose and business context before data leaves."
        bullets={["Can remove only unjustified fields","Can prove receiver non-receipt when evidence exists"]}
      />
      <ConnectorCard
        icon={<Globe2 size={18}/>}
        title="Browser sensor"
        badge={browserProven?"Observed in prototype":"Prototype path"}
        tone="neutral"
        summary="Discover browser-visible cross-origin requests without collecting payloads."
        bullets={["DID is directly observed","COULD stays a browser-visible lower bound"]}
      />
      <ConnectorCard
        icon={<Database size={18}/>}
        title="Audit / backend evidence"
        badge={auditProven?"Observed in prototype":"Prototype path"}
        tone="neutral"
        summary="Prove access after it happened when inline control is unavailable."
        bullets={["Strong post-access evidence","Observed reads remain detected, not prevented"]}
      />
    </div>

    <details className="ts-details ts-connection-technical">
      <summary>Browser sensor setup</summary>
      <div className="ts-code-card">
        <div><span><Code2 size={15}/></span><div><strong>Configuration</strong><small>Current prototype contract</small></div></div>
        <pre>{`chrome.runtime.sendMessage({
  type: "THIRDSIGHT_SET_INGESTION_CONFIG",
  endpoint: "https://<host>/api/browser-observations",
  token: "<installation-token>"
})`}</pre>
        <p>The installation token authenticates the prototype sensor to the ingestion endpoint. It is not device attestation.</p>
      </div>
    </details>

    <div className="ts-coverage-warning">
      <ShieldEllipsis size={15}/>
      <p><b>Network loss creates a coverage gap.</b> ThirdSight does not infer activity during disconnected periods.</p>
    </div>
  </div>;
}

function Validation({rows,proof}:{rows:readonly ExposureRow[];proof:ChallengeProof|null}){
  return <div className="ts-validation-stack">
    <IntegrationExposureMap rows={rows.slice(0,10)} proof={proof}/>
    <RealWorldValidation/>
  </div>;
}


function IntegrationRow({row,onClick}:{row:ExposureRow;onClick:()=>void}){
  const profile=row.vendorIntelligence.profiles[0]??null;
  const status=simpleRowStatus(row);
  const approved=row.approvedFields.length>0
    ?row.approvedFields.slice(0,4).join(", ")+(row.approvedFields.length>4?" + more":"")
    :"No merchant policy";

  return <button className="ts-table-row integration simple" onClick={onClick}>
    <div className="ts-integration-name">
      <p>
        <b>{profile?.family??row.label}</b>
        <small>{profile?.vendor??row.integrationId??"Unidentified integration"}</small>
      </p>
    </div>
    <div className="ts-simple-cell"><b>{approved}</b></div>
    <div className="ts-simple-cell">
      <b>{simpleObservedRow(row)}</b>
      <small>{row.observations} observation{row.observations===1?"":"s"}</small>
    </div>
    <div className="ts-simple-response">
      <span className={"ts-result-word "+status.tone}>{status.label}</span>
      <small>{status.detail}</small>
    </div>
  </button>;
}

function simpleRowStatus(row:ExposureRow):{label:string;tone:"review"|"stopped"|"normal"|"watching";detail:string}{
  const response=row.latestResponse.toLowerCase();
  if(response==="isolate"){
    return {label:"Isolated",tone:"stopped",detail:"Future integration access was isolated"};
  }
  if(row.preventedFields.length>0||response==="constrain"||response==="prevented"){
    return {label:"Limited",tone:"stopped",detail:"Unapproved access was limited"};
  }
  if(row.findings.length>0||response==="detected"){
    return {label:"Review",tone:"review",detail:"Evidence shows a rule mismatch"};
  }
  if(response==="allow"){
    return {label:"Normal",tone:"normal",detail:"Matches the current rules"};
  }
  if(!row.integrationId){
    return {label:"Review",tone:"review",detail:"No merchant rule attached"};
  }
  return {label:"Watching",tone:"watching",detail:"Not enough evidence to conclude more"};
}

function simpleObservedRow(row:ExposureRow):string{
  if(row.preventedFields.length>0){
    return `Tried ${row.preventedFields.slice(0,3).join(", ")} · blocked before send`;
  }
  if(row.attemptedFields.length>0){
    return `Touched ${row.attemptedFields.slice(0,3).join(", ")}${row.attemptedFields.length>3?" + more":""}`;
  }
  if(row.destinations.length>0){
    const destination=row.destinations[0]??"";
    try{return `Connected to ${new URL(destination).hostname}`;}catch{return `Connected to ${destination}`;}
  }
  return "Activity observed";
}


function ActivityRow({event,onClick,large=false}:{event:ConsoleEvent;onClick:()=>void;large?:boolean}){
  const value=eventStatus(event);
  return <button className={"ts-activity-row plain "+(large?"large":"")} onClick={onClick}>
    <div className="ts-activity-copy">
      <strong>{integrationLabel(event)}</strong>
      <span>{eventSummary(event)}</span>
      <small>{new Date(event.observedAt).toLocaleString()} · {event.coverage.label.replaceAll("_"," ").toLowerCase()}</small>
    </div>
    <span className={"ts-activity-result "+responseClass(value)}>{humanize(value)}</span>
    <ChevronRight size={15}/>
  </button>;
}

function EvidenceDrawer({event,aiPromoted,onClose}:{event:ConsoleEvent;aiPromoted:boolean;onClose:()=>void}){
  const discoveryOnly=event.coverage.label==="BROWSER_ONLY"&&event.should.status==="UNKNOWN"&&event.why.status==="UNKNOWN";
  const status=simpleEventStatus(event);
  const allowedFor=event.should.status==="KNOWN"
    ?event.should.value?.purpose??"Merchant rule present"
    :"No merchant rule supplied";
  const observed=didSummary(event);
  const reason=event.findings.length>0
    ?humanize(event.findings[0]?.type??"Policy mismatch")
    :eventSummary(event);

  return <div className="ts-drawer-layer" role="dialog" aria-modal="true">
    <button className="ts-drawer-backdrop" aria-label="Close evidence detail" onClick={onClose}/>
    <div className="ts-drawer">
      <div className="ts-drawer-head">
        <h2>{integrationLabel(event)}</h2>
        <button className="ts-icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button>
      </div>

      <div className="ts-drawer-outcome">
        <span className={"ts-result-word "+status.tone}>{status.label}</span>
        <strong>{status.headline}</strong>
        <p>{status.detail}</p>
      </div>

      <div className="ts-simple-why">
        <div><span>Approved purpose</span><b>{allowedFor}</b></div>
        <div><span>Observed</span><b>{observed}</b></div>
        <div><span>Reason</span><b>{reason}</b></div>
      </div>

      {discoveryOnly?<div className="ts-boundary-note"><Eye size={16}/><p><b>Unresolved.</b> ThirdSight saw this browser request, but no merchant policy or first-party business context proves whether it was appropriate.</p></div>:null}
      {event.blindSpotAssessment?<div className="ts-boundary-note warning"><AlertTriangle size={16}/><p><b>Validation limit.</b> {event.blindSpotAssessment.reason}</p></div>:null}

      <DecisionCard event={event}/>

      <details className="ts-details ts-technical-details">
        <summary>Technical evidence</summary>
        <VendorIntelligencePanel event={event}/>
        <div className="ts-proof-model-label"><span>Proof model</span><small>Policy · capability · runtime · business context</small></div>
        <div className="ts-evidence-grid">
          <EvidenceFact title="Approved" status={event.should.status} value={event.should.value?.purpose??"No merchant policy provided"} detail={event.should.reason}/>
          <EvidenceFact title="Could access" status={event.could.status} value={event.could.value?.statement??"Complete capability surface not available"} detail={event.could.reason}/>
          <EvidenceFact title="Observed" status={event.did.status} value={didSummary(event)} detail={event.did.reason}/>
          <EvidenceFact title="Business context" status={event.why.status} value={event.why.value?.eventType?event.why.value.eventType+" · "+event.why.value.correlationStrength:"No authoritative business context"} detail={event.why.reason}/>
        </div>
        <div className="ts-raw-grid">
          <RawEvidence label="Policy" value={event.should}/>
          <RawEvidence label="Capability" value={event.could}/>
          <RawEvidence label="Observed" value={event.did}/>
          <RawEvidence label="Context" value={event.why}/>
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
          <div><span>Recommendation</span><b>{humanize(event.aiAssessment.output.recommended_response)}</b></div>
          <p>{event.aiAssessment.output.explanation}</p>
          <small>Advisory only. AI cannot change evidence or enforcement.</small>
        </div>
      </details>:null}
    </div>
  </div>;
}

function simpleEventStatus(event:ConsoleEvent):{
  label:string;
  tone:"review"|"stopped"|"normal"|"watching";
  headline:string;
  detail:string;
}{
  const value=eventStatus(event).toLowerCase();
  if(value==="prevented"||value==="constrain"||value==="isolate"){
    return {label:"Stopped",tone:"stopped",headline:"ThirdSight limited this access.",detail:eventSummary(event)};
  }
  if(value==="detected"||event.findings.length>0){
    return {label:"Review",tone:"review",headline:"This activity does not match the available rules.",detail:eventSummary(event)};
  }
  if(value==="allow"){
    return {label:"Normal",tone:"normal",headline:"This activity matches the current rules.",detail:eventSummary(event)};
  }
  return {label:"Watching",tone:"watching",headline:"ThirdSight saw activity but does not have enough evidence to judge it.",detail:eventSummary(event)};
}

function VendorIntelligencePanel({event}:{event:ConsoleEvent}){
  const profile=event.vendorIntelligence.profiles[0]??null;
  const approved=event.should.status==="KNOWN"
    ? event.should.value?.purpose??"Merchant policy present"
    : "Not supplied by merchant";
  const observed=didSummary(event);
  const context=event.why.value?.eventType
    ? `${event.why.value.eventType} · ${event.why.value.correlationStrength}`
    : "No authoritative customer-journey context";
  const capability=profile?.documentedCapabilities.slice(0,2).join(" · ")
    ?? event.could.value?.statement
    ?? "Documented capability unavailable";

  return <section className="ts-vendor-intel">
    <div className="ts-vendor-intel-head">
      <div>
        <strong>{profile?profile.family:"Vendor identity unresolved"}</strong>
        <small>{profile?`${profile.vendor} · ${humanize(profile.category)}`:"No documentation-backed family matched this destination."}</small>
        <small>Vendor context · {event.vendorIntelligence.registryVersion}</small>
      </div>
      <span className={"ts-vendor-match "+(profile?"matched":"unresolved")}>{profile?"Documented":"Unresolved"}</span>
    </div>

    <div className="ts-intel-stack">
      <IntelFact label="Expected" value={profile?.expectedPurposes[0]??"Documented purpose unavailable"} source={profile?"Vendor documented":"Unavailable"}/>
      <IntelFact label="Approved" value={approved} source="Merchant policy"/>
      <IntelFact label="Capable" value={capability} source={profile?"Vendor documentation":event.could.status!=="UNKNOWN"?"Local evidence":"Unavailable"}/>
      <IntelFact label="Observed" value={observed} source={event.did.value?.boundary==="browser"?"Browser sensor":"Runtime evidence"}/>
      <IntelFact label="Context" value={context} source={event.why.status==="UNKNOWN"?"Not supplied":"First-party business event"}/>
    </div>

    {profile?<div className="ts-vendor-docs">
      <span>Documentation reviewed {profile.sources[0]?.reviewedAt}</span>
      <div>{profile.sources.slice(0,3).map(item=><a href={item.url} target="_blank" rel="noreferrer" key={item.url}>{item.title}</a>)}</div>
    </div>:null}
    <p className="ts-vendor-boundary">{event.vendorIntelligence.authorityBoundary}</p>
  </section>;
}

function IntelFact({label,value,source}:{label:string;value:string;source:string}){
  return <div className="ts-intel-fact"><span>{label}</span><p><b>{value}</b><small>{source}</small></p></div>;
}

function DecisionCard({event}:{event:ConsoleEvent}){
  const value=eventStatus(event);
  return <div className={"ts-decision-card "+responseClass(value)}>
    <div><strong>{humanize(value)}</strong><span>ThirdSight response</span></div>
    <p>{eventSummary(event)}</p>
    {event.findings.length>0?<div className="ts-decision-meta"><span>Finding <b>{humanize(event.findings[0].type)}</b></span><span>Response <b>{humanize(event.findings[0].action)}</b></span></div>:null}
    {event.enforcement?<div className="ts-enforcement-grid">
      <div><span>Removed before send</span><b>{event.enforcement.removedFields.join(", ")||"none"}</b></div>
      <div><span>Continued</span><b>{event.enforcement.continuedFields.join(", ")||"none"}</b></div>
      <div><span>Receiver got</span><b>{event.enforcement.receiver.receivedFields.join(", ")||"none"}</b></div>
      <div><span>Forbidden field received</span><b>{event.enforcement.receiver.forbiddenFieldReceived?"Yes":"No"}</b></div>
    </div>:null}
    {event.containment?<div className="ts-decision-meta"><span>Containment <b>{humanize(event.containment.action)}</b></span><span>Applied <b>{event.containment.applied?"Yes":"No"}</b></span></div>:null}
  </div>;
}

function EvidenceFact({title,status,value,detail}:{title:string;status:string;value:string;detail?:string}){
  return <div className="ts-evidence-fact"><div><b>{title}</b><span className={"ts-evidence-status "+status.toLowerCase()}>{status}</span></div><strong>{value}</strong><p>{detail??"No explanatory note recorded."}</p></div>;
}

function RawEvidence({label,value}:{label:string;value:unknown}){
  return <div><span>{label}</span><pre>{JSON.stringify(value,null,2)}</pre></div>;
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

function evidenceFreshness(value:string){
  const timestamp=new Date(value).getTime();
  if(!Number.isFinite(timestamp))return "Evidence timestamp unavailable";
  const elapsed=Math.max(0,Date.now()-timestamp);
  if(elapsed<60_000)return `Last evidence ${Math.max(1,Math.floor(elapsed/1000))}s ago`;
  if(elapsed<3_600_000)return `Last evidence ${Math.floor(elapsed/60_000)}m ago`;
  if(elapsed<86_400_000)return `Last evidence ${Math.floor(elapsed/3_600_000)}h ago`;
  return `Last evidence ${Math.floor(elapsed/86_400_000)}d ago`;
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
