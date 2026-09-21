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
  MoreHorizontal,
  PlugZap,
  Radio,
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

const viewCopy:Record<View,{title:string;subtitle:string}>={
  overview:{title:"Overview",subtitle:"Third-party access posture across your connected stack."},
  integrations:{title:"Integrations",subtitle:"Vendor-documented expectation, merchant approval and observed behaviour — kept as separate evidence."},
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
        <div className="ts-mobile-product">
          <span><ShieldCheck size={17}/></span>
          <div><b>ThirdSight</b><small>{current.title}</small></div>
        </div>
        <div className="ts-desktop-context">
          <strong>{current.title}</strong>
          <span>{current.subtitle}</span>
        </div>
        <div className="ts-topbar-actions">
          <span className="ts-env"><span/> Commerce Lab</span>
          <button className="ts-connect-button" onClick={()=>setView("connections")}><PlugZap size={14}/> Connect platform</button>
          <button className="ts-mobile-more" onClick={()=>setMobileMenuOpen(true)} aria-label="More navigation"><MoreHorizontal size={19}/></button>
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

    {mobileMenuOpen?<div className="ts-mobile-menu-layer">
      <button className="ts-mobile-menu-backdrop" aria-label="Close menu" onClick={()=>setMobileMenuOpen(false)}/>
      <div className="ts-mobile-menu">
        <div className="ts-mobile-menu-head"><div><span className="ts-kicker">Workspace</span><strong>More in ThirdSight</strong></div><button onClick={()=>setMobileMenuOpen(false)} aria-label="Close"><X size={18}/></button></div>
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
  const incidents=events.map((event,index)=>({event,index})).filter(item=>isIncident(item.event));
  const unresolved=exposure.filter(row=>!row.integrationId);
  const attentionCount=incidents.length+unresolved.length;
  const lastSeen=events.map(event=>Date.parse(event.observedAt)).filter(Number.isFinite).sort((a,b)=>b-a)[0]??null;
  const topIntegrations=exposure.slice(0,6);

  return <div className="ts-final-overview">
    <section className="ts-final-summary">
      <div>
        <h1>{attentionCount>0?"There are things worth looking at.":"Nothing currently needs intervention."}</h1>
        <p>{findingCount>0
          ?String(findingCount)+" integration"+(findingCount===1?"":"s")+" carry deterministic findings in the current evidence."
          :unregisteredCount>0
            ?String(unregisteredCount)+" destination"+(unregisteredCount===1?"":"s")+" still lack merchant identity or approval context."
            :"The current representative evidence does not prove a policy violation."}</p>
      </div>
      <dl>
        <div><dt>Observed</dt><dd>{exposure.length}</dd></div>
        <div><dt>Approved</dt><dd>{registeredCount}</dd></div>
        <div><dt>Last evidence</dt><dd>{lastSeen?relativeTimeValue(new Date(lastSeen).toISOString()):"—"}</dd></div>
      </dl>
    </section>

    <section className="ts-final-section">
      <div className="ts-final-section-head">
        <h2>Needs attention</h2>
        {incidents.length>0?<button onClick={()=>onOpenEvent(incidents[0].index)}>Open latest <ArrowRight size={13}/></button>:null}
      </div>
      <div className="ts-final-attention">
        {incidents.slice(0,3).map(({event,index})=><button key={event.recordId} onClick={()=>onOpenEvent(index)}>
          <div>
            <strong>{incidentTitleValue(event)}</strong>
            <p>{event.findings[0]?.reason??eventSummary(event)}</p>
            <span>{integrationLabel(event)} · {relativeTimeValue(event.observedAt)} · {coverageCopy(event)}</span>
          </div>
          <StatusText value={eventStatus(event)}/>
          <ChevronRight size={14}/>
        </button>)}
        {incidents.length===0&&unresolved.slice(0,3).map(row=><button key={row.key} onClick={()=>onOpenRow(row)}>
          <div>
            <strong>{displayIntegration(row)} has no merchant approval on file</strong>
            <p>ThirdSight observed the destination but will not invent why this merchant uses it.</p>
            <span>{row.observations} observation{row.observations===1?"":"s"} · {row.lastSeen?relativeTimeValue(row.lastSeen):"time unavailable"}</span>
          </div>
          <StatusText value="UNRESOLVED"/>
          <ChevronRight size={14}/>
        </button>)}
        {incidents.length===0&&unresolved.length===0?<div className="ts-final-empty">No incident or unresolved integration is represented in the current evidence.</div>:null}
      </div>
    </section>

    <div className="ts-final-split">
      <section className="ts-final-section">
        <div className="ts-final-section-head"><h2>Integrations</h2><button onClick={onViewIntegrations}>View all <ArrowRight size={13}/></button></div>
        <div className="ts-final-integration-list">
          {topIntegrations.map(row=><button key={row.key} onClick={()=>onOpenRow(row)}>
            <div className="ts-final-monogram">{integrationInitials(row)}</div>
            <div><strong>{displayIntegration(row)}</strong><span>{integrationRelationship(row)}</span></div>
            <small>{row.observations} obs.</small>
            <StatusText value={integrationStateValue(row)}/>
          </button>)}
        </div>
      </section>

      <section className="ts-final-section ts-final-coverage">
        <div className="ts-final-section-head"><h2>Coverage</h2><button onClick={onConnections}>Connections <ArrowRight size={13}/></button></div>
        <dl>
          <div><dt>Browser-visible</dt><dd>{exposure.filter(row=>row.boundaries.includes("browser")).length}</dd><span>Request metadata and destinations</span></div>
          <div><dt>Managed or audit</dt><dd>{exposure.filter(row=>row.boundaries.some(boundary=>boundary!=="browser")).length}</dd><span>Stronger boundary evidence where present</span></div>
          <div><dt>Merchant scope</dt><dd>{exposure.filter(row=>row.approvedFields.length>0).length}</dd><span>Integrations with approved data fields</span></div>
        </dl>
        <p>A missing signal stays missing. Browser discovery does not become merchant intent, backend visibility, or proof of prevention.</p>
      </section>
    </div>

    <section className="ts-final-section">
      <div className="ts-final-section-head"><h2>Recent activity</h2></div>
      <div className="ts-final-activity">
        {events.slice(0,7).map((event,index)=><ActivityLedgerRow key={event.recordId} event={event} onClick={()=>onOpenEvent(index)}/>)}
        {events.length===0?<div className="ts-final-empty">Waiting for persisted evidence.</div>:null}
      </div>
    </section>

    <div className="ts-final-proof">
      <p><b>Controlled proof</b> · {proof?.busySale.passed?"busy-sale traffic stayed allowed without a false alarm":"busy-sale proof not represented"} · {proof?.scopePrevention.proven?"managed scope prevention persisted":"managed prevention proof not represented"}</p>
    </div>
  </div>;
}

function Integrations({rows,query,onQuery,onOpen}:{rows:readonly ExposureRow[];query:string;onQuery:(value:string)=>void;onOpen:(row:ExposureRow)=>void}){
  const [filter,setFilter]=useState<"all"|"review"|"approved"|"unresolved">("all");
  const visible=rows.filter(row=>{
    if(filter==="review")return row.findings.length>0||responseClass(row.latestResponse)==="constrain"||responseClass(row.latestResponse)==="isolate";
    if(filter==="approved")return row.approvedFields.length>0;
    if(filter==="unresolved")return !row.integrationId;
    return true;
  });
  return <div className="ts-final-page">
    <div className="ts-final-tools">
      <label><Search size={15}/><input value={query} onChange={e=>onQuery(e.target.value)} placeholder="Search integrations, domains, fields, or vendors"/></label>
      <div>{(["all","review","approved","unresolved"] as const).map(item=><button key={item} className={filter===item?"active":""} onClick={()=>setFilter(item)}>{humanize(item)}</button>)}</div>
    </div>
    <div className="ts-final-table">
      <div className="ts-final-table-head integrations"><span>Integration</span><span>Merchant approval</span><span>Observed</span><span>Boundary</span><span>Last seen</span><span>State</span></div>
      {visible.map(row=><button className="ts-final-table-row integrations" key={row.key} onClick={()=>onOpen(row)}>
        <div className="ts-final-name"><span>{integrationInitials(row)}</span><p><strong>{displayIntegration(row)}</strong><small>{integrationVendor(row)}</small></p></div>
        <div className={row.approvedFields.length===0?"muted":""}>{integrationApproval(row)}</div>
        <div>{integrationObserved(row)}</div>
        <div>{row.boundaries.length?row.boundaries.map(humanize).join(", "):"Unknown"}</div>
        <div>{row.lastSeen?relativeTimeValue(row.lastSeen):"—"}</div>
        <div><StatusText value={integrationStateValue(row)}/></div>
      </button>)}
      {visible.length===0?<div className="ts-final-empty">No integrations match this view.</div>:null}
    </div>
  </div>;
}


function ActivityView({events,onOpen}:{events:readonly ConsoleEvent[];onOpen:(index:number)=>void}){
  const [filter,setFilter]=useState<"all"|"allowed"|"observed"|"actioned">("all");
  const [search,setSearch]=useState("");
  const normalized=search.trim().toLowerCase();
  const visible=events.filter(event=>{
    const status=eventStatus(event);
    const matches=!normalized||[integrationLabel(event),eventSummary(event),event.did.value?.destinationOrigin??"",primaryEventField(event)??""].join(" ").toLowerCase().includes(normalized);
    if(!matches)return false;
    if(filter==="allowed")return status==="ALLOW";
    if(filter==="observed")return status==="OBSERVE"||status==="DISCOVERY"||status==="UNRESOLVED";
    if(filter==="actioned")return isIncident(event);
    return true;
  });
  return <div className="ts-final-page">
    <div className="ts-final-tools">
      <label><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search activity"/></label>
      <div>{(["all","allowed","observed","actioned"] as const).map(item=><button key={item} className={filter===item?"active":""} onClick={()=>setFilter(item)}>{humanize(item)}</button>)}</div>
    </div>
    <div className="ts-final-activity table">
      <div className="ts-final-activity-head"><span>Time</span><span>Integration</span><span>What happened</span><span>Evidence</span><span>Decision</span></div>
      {visible.map(event=>{const index=events.findIndex(item=>item.recordId===event.recordId);return <ActivityLedgerRow key={event.recordId} event={event} onClick={()=>index>=0&&onOpen(index)} table/>})}
      {visible.length===0?<div className="ts-final-empty">No activity matches this view.</div>:null}
    </div>
  </div>;
}

function IncidentView({events,onOpen}:{events:readonly ConsoleEvent[];onOpen:(index:number)=>void}){
  const incidents=events.map((event,index)=>({event,index})).filter(item=>isIncident(item.event));
  return <div className="ts-final-incidents">
    {incidents.map(({event,index})=><button key={event.recordId} onClick={()=>onOpen(index)}>
      <time>{shortDateValue(event.observedAt)}<span>{shortTimeValue(event.observedAt)}</span></time>
      <div><strong>{incidentTitleValue(event)}</strong><p>{event.findings[0]?.reason??eventSummary(event)}</p><span>{integrationLabel(event)} · {coverageCopy(event)}</span></div>
      <StatusText value={eventStatus(event)}/>
      <ChevronRight size={14}/>
    </button>)}
    {incidents.length===0?<div className="ts-final-empty">No representative incident evidence is currently in the queue.</div>:null}
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

function EvidenceDrawer({event,aiPromoted,onClose}:{event:ConsoleEvent;aiPromoted:boolean;onClose:()=>void}){
  const value=eventStatus(event);
  const discoveryOnly=event.coverage.label==="BROWSER_ONLY"&&event.should.status==="UNKNOWN"&&event.why.status==="UNKNOWN";
  const field=primaryEventField(event);
  return <div className="ts-drawer-layer" role="dialog" aria-modal="true">
    <button className="ts-drawer-backdrop" aria-label="Close evidence detail" onClick={onClose}/>
    <div className="ts-final-drawer">
      <button className="ts-final-drawer-close" onClick={onClose} aria-label="Close"><X size={18}/></button>

      <header className="ts-final-detail-head">
        <StatusText value={value}/>
        <h1>{incidentTitleValue(event)}</h1>
        <p>{event.findings[0]?.reason??eventSummary(event)}</p>
        <span>{integrationLabel(event)} · {new Date(event.observedAt).toLocaleString()} · {coverageCopy(event)}</span>
      </header>

      {discoveryOnly?<div className="ts-final-note"><Eye size={15}/><p><b>Discovery only.</b> Runtime metadata proves the observation boundary. Merchant approval and first-party business context are not present, so ThirdSight leaves them unresolved.</p></div>:null}
      {event.blindSpotAssessment?<div className="ts-final-note warning"><AlertTriangle size={15}/><p><b>Known blind spot.</b> {event.blindSpotAssessment.reason}</p></div>:null}

      <section className="ts-final-detail-section">
        <h2>What happened</h2>
        <dl className="ts-final-definition">
          <div><dt>Integration</dt><dd>{integrationLabel(event)}</dd></div>
          <div><dt>Destination</dt><dd>{event.did.value?.destinationOrigin?safeHost(event.did.value.destinationOrigin):"Unknown"}</dd></div>
          <div><dt>Operation</dt><dd>{[event.did.value?.method,event.did.value?.destinationPath].filter(Boolean).join(" ")||"Runtime access"}</dd></div>
          <div><dt>Data</dt><dd>{field??event.did.value?.dataCategories?.join(", ")??"Payload semantics unavailable"}</dd></div>
        </dl>
      </section>

      <section className="ts-final-detail-section">
        <h2>Evidence used</h2>
        <div className="ts-final-evidence">
          <EvidenceLine label="Should" status={event.should.status} value={event.should.value?.purpose??"No merchant Purpose Contract"} source="Merchant policy"/>
          <EvidenceLine label="Could" status={event.could.status} value={event.could.value?.statement??"Complete capability surface unavailable"} source="Capability evidence"/>
          <EvidenceLine label="Did" status={event.did.status} value={didSummary(event)} source={event.did.value?.boundary==="browser"?"Browser sensor":"Runtime evidence"}/>
          <EvidenceLine label="Why" status={event.why.status} value={event.why.value?.eventType?event.why.value.eventType+" · "+event.why.value.correlationStrength:"No authoritative business context"} source="First-party context"/>
        </div>
      </section>

      <section className="ts-final-detail-section">
        <h2>Response</h2>
        <p>{eventSummary(event)}</p>
        {event.enforcement?<dl className="ts-final-definition">
          <div><dt>Removed before send</dt><dd>{event.enforcement.removedFields.join(", ")||"None"}</dd></div>
          <div><dt>Continued</dt><dd>{event.enforcement.continuedFields.join(", ")||"None"}</dd></div>
          <div><dt>Receiver got</dt><dd>{event.enforcement.receiver.receivedFields.join(", ")||"None"}</dd></div>
          <div><dt>Forbidden field received</dt><dd>{event.enforcement.receiver.forbiddenFieldReceived?"Yes":"No"}</dd></div>
        </dl>:null}
        {event.containment?<dl className="ts-final-definition"><div><dt>Containment</dt><dd>{humanize(event.containment.action)}</dd></div><div><dt>Applied</dt><dd>{event.containment.applied?"Yes":"No"}</dd></div></dl>:null}
      </section>

      <details className="ts-final-disclosure"><summary>Raw evidence and provenance</summary><div className="ts-final-raw"><RawEvidence label="SHOULD" value={event.should}/><RawEvidence label="COULD" value={event.could}/><RawEvidence label="DID" value={event.did}/><RawEvidence label="WHY" value={event.why}/></div></details>
      <details className="ts-final-disclosure"><summary>Verified Learning</summary><LearningLoopPanel recordId={event.recordId} deterministicResult={event.outcome??event.decision??"UNRESOLVED"}/></details>
      {aiPromoted&&event.aiAssessment?.accepted?<details className="ts-final-disclosure"><summary>Advisory analyst</summary><div className="ts-final-ai"><p>{event.aiAssessment.output.explanation}</p><span>Advisory only. It cannot change merchant authority or deterministic enforcement.</span></div></details>:null}
    </div>
  </div>;
}

function EvidenceLine({label,status,value,source}:{label:string;status:string;value:string;source:string}){
  return <div><p><strong>{label}</strong><span className={"ts-final-evidence-state "+status.toLowerCase()}>{humanize(status)}</span></p><b>{value}</b><small>{source}</small></div>;
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


function StatusText({value}:{value:string}){return <span className={"ts-final-status "+finalStatusClass(value)}>{statusCopy(value)}</span>}

function ActivityLedgerRow({event,onClick,table=false}:{event:ConsoleEvent;onClick:()=>void;table?:boolean}){
  return <button className={table?"ts-final-activity-row table":"ts-final-activity-row"} onClick={onClick}>
    <time>{shortTimeValue(event.observedAt)}</time>
    <div className="ts-final-activity-name"><span>{eventInitials(event)}</span><p><strong>{integrationLabel(event)}</strong><small>{safeHost(event.did.value?.destinationOrigin??"")}</small></p></div>
    <div className="ts-final-activity-summary">{eventSummary(event)}</div>
    {table?<div className="ts-final-activity-coverage">{coverageCopy(event)}</div>:null}
    <StatusText value={eventStatus(event)}/>
  </button>;
}

function incidentTitleValue(event:ConsoleEvent){
  const field=primaryEventField(event);
  const finding=event.findings[0]?.type;
  if(event.outcome==="PREVENTED"&&field)return integrationLabel(event)+" tried to send "+field;
  if(finding==="PURPOSE_MISMATCH")return integrationLabel(event)+" accessed data without matching business context";
  if(finding==="SHADOW_INTEGRATION")return integrationLabel(event)+" appeared without a registered identity";
  if(finding==="STALE_INTEGRATION")return integrationLabel(event)+" used a retired integration path";
  if(event.outcome==="DETECTED")return integrationLabel(event)+" access was detected after it happened";
  return integrationLabel(event)+" needs review";
}
function primaryEventField(event:ConsoleEvent){return event.enforcement?.removedFields[0]??event.findings.find(finding=>Boolean(finding.field))?.field??event.did.value?.dataCategories?.[0]??null}
function displayIntegration(row:ExposureRow){return row.vendorIntelligence.profiles[0]?.family??row.label}
function integrationVendor(row:ExposureRow){return row.vendorIntelligence.profiles[0]?.vendor??row.integrationId??safeHost(row.destinations[0]??row.label)}
function integrationInitials(row:ExposureRow){return initials(displayIntegration(row))}
function eventInitials(event:ConsoleEvent){return initials(integrationLabel(event))}
function initials(value:string){return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part.charAt(0).toUpperCase()).join("")||"?"}
function integrationRelationship(row:ExposureRow){if(row.approvedFields.length>0)return integrationApproval(row);if(row.vendorIntelligence.profiles[0])return "Vendor documented · merchant approval missing";return "Identity or merchant approval unresolved"}
function integrationApproval(row:ExposureRow){if(row.approvedFields.length>0)return row.approvedFields.slice(0,3).join(", ")+(row.approvedFields.length>3?" +"+String(row.approvedFields.length-3):"");return "No merchant approval registered"}
function integrationObserved(row:ExposureRow){if(row.attemptedFields.length>0)return row.attemptedFields.slice(0,3).join(", ")+(row.attemptedFields.length>3?" +"+String(row.attemptedFields.length-3):"");return String(row.observations)+" observation"+(row.observations===1?"":"s")}
function integrationStateValue(row:ExposureRow){const value=row.latestResponse.toLowerCase();if(value==="allow")return "Within policy";if(value==="constrain"||value==="prevented")return "Constrained";if(value==="isolate")return "Isolated";if(value==="detected")return "Detected";if(row.findings.length>0)return "Needs review";if(!row.integrationId)return "Unresolved";if(value==="observe"||value==="discovery")return "Watching";return "Unresolved"}
function finalStatusClass(value:string){const v=value.toLowerCase();if(v==="allow"||v==="within policy")return "normal";if(v==="observe"||v==="discovery"||v==="watching"||v==="unresolved")return "review";if(v==="constrain"||v==="prevented"||v==="detected"||v==="isolate"||v==="isolated"||v==="needs review")return "action";return "muted"}
function statusCopy(value:string){const v=value.toLowerCase();if(v==="allow")return "Within policy";if(v==="prevented")return "Prevented";if(v==="detected")return "Detected";if(v==="constrain")return "Constrained";if(v==="isolate")return "Isolated";if(v==="observe")return "Watching";if(v==="discovery")return "Observed";return humanize(value)}
function relativeTimeValue(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return "—";const diff=Math.max(0,Date.now()-date.getTime());const mins=Math.floor(diff/60000);if(mins<1)return "now";if(mins<60)return String(mins)+"m ago";const hours=Math.floor(mins/60);if(hours<24)return String(hours)+"h ago";const days=Math.floor(hours/24);if(days<7)return String(days)+"d ago";return date.toLocaleDateString([],{month:"short",day:"numeric"})}
function shortTimeValue(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return "—";return date.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
function shortDateValue(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return "—";return date.toLocaleDateString([],{month:"short",day:"numeric"})}
function safeHost(origin:string){if(!origin)return "Unknown";try{return new URL(origin).hostname}catch{return origin}}
function coverageCopy(event:ConsoleEvent){const value=event.coverage.label.replaceAll("_"," ").toLowerCase();return value.charAt(0).toUpperCase()+value.slice(1)}
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
