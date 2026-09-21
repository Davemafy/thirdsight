import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Clock3,
  Code2,
  Database,
  Eye,
  FlaskConical,
  Globe2,
  Home,
  Layers3,
  Network,
  MoreHorizontal,
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

  return <div className="ts-shell ts-master-shell">
    <aside className="ts-sidebar ts-master-sidebar">
      <button className="ts-brand ts-master-brand" onClick={()=>setView("overview")}>
        <span className="ts-brand-symbol" aria-hidden="true"/>
        <strong>ThirdSight</strong>
      </button>

      <nav className="ts-nav ts-master-nav">
        <NavButton active={view==="overview"} icon={<Home size={17}/>} label="Overview" onClick={()=>setView("overview")}/>
        <NavButton active={view==="integrations"} icon={<Layers3 size={17}/>} label="Integrations" onClick={()=>setView("integrations")}/>
        <NavButton active={view==="activity"} icon={<Activity size={17}/>} label="Activity" onClick={()=>setView("activity")}/>
        <NavButton active={view==="incidents"} icon={<AlertTriangle size={17}/>} label="Incidents" count={findings.length} onClick={()=>setView("incidents")}/>
        <NavButton active={view==="policies"} icon={<BookOpenCheck size={17}/>} label="Policies" onClick={()=>setView("policies")}/>
        <a className="ts-nav-link" href="/commerce-lab"><FlaskConical size={17}/><b>Commerce Lab</b></a>
        <div className="ts-nav-separator"/>
        <NavButton active={view==="connections"} icon={<Network size={17}/>} label="Connections" onClick={()=>setView("connections")}/>
        <NavButton active={view==="validation"} icon={<CircleCheck size={17}/>} label="Validation" onClick={()=>setView("validation")}/>
      </nav>

      <div className="ts-sidebar-foot ts-master-sidebar-foot">
        <span>Evidence-backed decisions</span>
        <small>Unknown remains unresolved.</small>
      </div>
    </aside>

    <div className="ts-workspace">
      <header className="ts-topbar ts-master-topbar">
        <button className="ts-workspace-switch" type="button">Commerce Lab <ChevronDown size={14}/></button>
        <label className="ts-global-search">
          <Search size={17}/>
          <input
            value={query}
            onChange={event=>{setQuery(event.target.value);if(event.target.value.trim())setView("integrations")}}
            placeholder="Search integrations, domains, or events..."
          />
        </label>
        <div className="ts-topbar-actions ts-master-actions">
          <button aria-label="Help"><CircleHelp size={18}/></button>
          <button aria-label="Notifications" className="ts-notification-button"><Bell size={18}/>{findings.length>0?<i/>:null}</button>
          <button aria-label="Account" className="ts-account-avatar">D</button>
          <button className="ts-mobile-more" onClick={()=>setMobileMenuOpen(true)} aria-label="More navigation"><MoreHorizontal size={19}/></button>
        </div>
      </header>

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
  onOpenRow:(row:ExposureRow)=>void;
  onOpenEvent:(index:number)=>void;
}){
  const documentedFamilies=new Set(
    exposure.flatMap(row=>row.vendorIntelligence.profiles.map(profile=>profile.family))
  ).size;
  const withinPolicy=exposure.filter(row=>row.latestResponse.toLowerCase()==="allow").length;
  const reviewRows=[
    ...exposure.filter(row=>row.findings.length>0),
    ...exposure.filter(row=>row.findings.length===0&&!row.integrationId),
  ].slice(0,3);
  const leadEvent=events.find(event=>event.outcome==="PREVENTED")
    ??events.find(event=>event.outcome==="DETECTED")
    ??events.find(event=>event.decision==="CONSTRAIN"||event.decision==="ISOLATE")
    ??events.find(event=>event.findings.length>0)
    ??events[0]
    ??null;
  const leadIndex=leadEvent?events.findIndex(event=>event.recordId===leadEvent.recordId):-1;
  const lastEvidence=events.length
    ?[...events].sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0]
    :null;
  const documentationCoverage=exposure.length
    ?Math.round((exposure.filter(row=>row.vendorIntelligence.profiles.length>0).length/exposure.length)*100)
    :0;

  return <div className="ts-master-overview">
    <div className="ts-master-page-head">
      <div>
        <h1>Your commerce data, under control.</h1>
        <p>Monitor integrations, prevent unwanted sharing, and keep merchant policy separate from vendor claims.</p>
      </div>
      <div className="ts-master-page-meta">
        <span><Clock3 size={15}/> Last evidence {lastEvidence?relativeTime(lastEvidence.observedAt):"—"}</span>
        <button type="button">Last 7 days <ChevronDown size={14}/></button>
      </div>
    </div>

    <section className="ts-master-metrics" aria-label="Workspace summary">
      <MasterMetric value={String(unregisteredCount)} label="Unresolved integrations" tone="alert"/>
      <MasterMetric value={String(documentedFamilies||registeredCount)} label="Documented families" tone="neutral"/>
      <MasterMetric value={String(findingCount)} label="Active incidents" tone={findingCount>0?"alert":"neutral"}/>
      <MasterMetric value={String(withinPolicy)} label="Within policy" tone="neutral"/>
      <div className="ts-master-coverage">
        <strong>{documentationCoverage}%</strong>
        <span>of integrations are documented</span>
        <button onClick={onViewIntegrations}>View inventory <ArrowRight size={12}/></button>
      </div>
    </section>

    <div className="ts-master-main-grid">
      <BoundaryDecision
        event={leadEvent}
        eventIndex={leadIndex}
        onOpen={onOpenEvent}
      />
      <VendorIntelligenceRail event={leadEvent}/>
    </div>

    <div className="ts-master-lower-grid">
      <section className="ts-master-list-card">
        <div className="ts-master-card-head"><h2>Recent activity</h2><button onClick={()=>leadIndex>=0&&onOpenEvent(leadIndex)}>View latest <ArrowRight size={13}/></button></div>
        <div className="ts-master-compact-list">
          {events.slice(0,4).map((event,index)=><MasterActivityRow key={event.recordId} event={event} onClick={()=>onOpenEvent(index)}/>)}
          {events.length===0?<EmptyState text="Waiting for persisted evidence."/>:null}
        </div>
      </section>

      <section className="ts-master-list-card">
        <div className="ts-master-card-head"><h2>Needs review</h2><button onClick={onViewIntegrations}>View all ({unregisteredCount+findingCount}) <ArrowRight size={13}/></button></div>
        <div className="ts-master-review-list">
          {reviewRows.map(row=><button key={row.key} onClick={()=>onOpenRow(row)}>
            <VendorMark label={row.vendorIntelligence.profiles[0]?.family??row.label}/>
            <div><strong>{row.vendorIntelligence.profiles[0]?.family??row.label}</strong><span>{row.vendorIntelligence.profiles[0]?.vendor??"Unidentified"}</span></div>
            <em>{row.findings.length>0?humanize(row.findings[0]):"Identity or rule missing"}</em>
            <ChevronRight size={15}/>
          </button>)}
          {reviewRows.length===0?<EmptyState text="Nothing currently needs review."/>:null}
        </div>
      </section>

      <section className="ts-master-commerce-card">
        <span className="ts-master-commerce-icon"><FlaskConical size={18}/></span>
        <h2>A real commerce environment behind the evidence.</h2>
        <p>Open the synthetic storefront, create activity, then return here to inspect what ThirdSight proved.</p>
        <a href="/commerce-lab">Open Commerce Lab <ArrowRight size={14}/></a>
        <div className="ts-master-commerce-orbit" aria-hidden="true"/>
      </section>
    </div>

    <div className="ts-master-proof-note">
      <span>Controlled proof</span>
      <p>
        Busy-sale false alarm: <b>{proof?.busySale.passed?"none observed":"awaiting run"}</b>
        <i/> managed scope prevention: <b>{proof?.scopePrevention.proven?"proven":"awaiting run"}</b>
        <i/> abnormal behaviour: <b>{proof?.abnormalBehavior.observed?"caught":"not currently observed"}</b>
      </p>
    </div>
  </div>;
}

function MasterMetric({value,label,tone}:{value:string;label:string;tone:"neutral"|"alert"}){
  return <div className={"ts-master-metric "+tone}>
    <strong>{value}</strong>
    <span>{label}</span>
    <i/>
  </div>;
}

function BoundaryDecision({
  event,
  eventIndex,
  onOpen,
}:{
  event:ConsoleEvent|null;
  eventIndex:number;
  onOpen:(index:number)=>void;
}){
  if(!event)return <section className="ts-master-decision empty"><EmptyState text="Waiting for a persisted decision."/></section>;

  const profile=event.vendorIntelligence.profiles[0]??null;
  const allowed=event.enforcement?.continuedFields??[];
  const blocked=event.enforcement?.removedFields??[];
  const observed=event.did.value?.dataCategories??[];
  const fields=allowed.length+blocked.length>0
    ?[
      ...allowed.map(field=>({field,state:"allowed" as const})),
      ...blocked.map(field=>({field,state:"blocked" as const})),
    ]
    :observed.slice(0,4).map(field=>({field,state:"observed" as const}));

  const title=overviewDecisionTitle(event);
  const destination=event.did.value?.destinationOrigin?safeHost(event.did.value.destinationOrigin):profile?.family??integrationLabel(event);

  return <section className="ts-master-decision">
    <div className="ts-master-decision-head">
      <div><span>{event.why.value?.eventType?humanize(event.why.value.eventType):"Latest boundary decision"}</span><h2>{title}</h2></div>
      <div className="ts-master-decision-actions"><time>{relativeTime(event.observedAt)}</time>{eventIndex>=0?<button onClick={()=>onOpen(eventIndex)}>View evidence <ArrowRight size={13}/></button>:null}</div>
    </div>
    <p className="ts-master-decision-copy">{overviewDecisionCopy(event)}</p>

    <div className="ts-master-trace">
      <div className="ts-master-trace-fields">
        {(fields.length?fields:[{field:destination,state:"observed" as const}]).map(item=><div className={"ts-master-trace-row "+item.state} key={item.field}>
          <div><strong>{item.field}</strong><span>{humanizeDataField(item.field)}</span></div>
          <span className="ts-master-trace-line"><i/></span>
          <b>{item.state==="blocked"?"Blocked":item.state==="allowed"?"Allowed":"Observed"}</b>
        </div>)}
      </div>
      <div className="ts-master-destination">
        <VendorMark label={profile?.family??integrationLabel(event)} large/>
        <div><strong>{profile?.family??integrationLabel(event)}</strong><span>{destination}</span></div>
        <p>{profile?.expectedPurposes[0]??"Runtime destination observed; documented purpose unavailable."}</p>
      </div>
    </div>
  </section>;
}

function VendorIntelligenceRail({event}:{event:ConsoleEvent|null}){
  if(!event)return <aside className="ts-master-vendor"><h2>Vendor intelligence</h2><EmptyState text="No evidence selected."/></aside>;
  const profile=event.vendorIntelligence.profiles[0]??null;
  const sources=profile?.sources.slice(0,3)??[];
  return <aside className="ts-master-vendor">
    <div className="ts-master-vendor-head"><h2>Vendor intelligence</h2><span>{profile?"Known":"Unresolved"}</span></div>
    <div className="ts-master-vendor-title"><VendorMark label={profile?.family??integrationLabel(event)}/><div><strong>{profile?.family??integrationLabel(event)}</strong><span>{event.did.value?.destinationOrigin?safeHost(event.did.value.destinationOrigin):"destination unavailable"}</span></div></div>
    <VendorFact label="Expected" value={profile?.expectedPurposes[0]??"Documentation-backed purpose unavailable"}/>
    <VendorFact label="Approved" value={event.should.value?.purpose??"Merchant approval not supplied"}/>
    <VendorFact label="Capable" value={profile?.documentedCapabilities.slice(0,2).join(" · ")??event.could.value?.statement??"Capability evidence unavailable"}/>
    <VendorFact label="Observed" value={event.did.value?.dataCategories?.slice(0,3).join(", ")??didSummary(event)}/>
    <div className="ts-master-vendor-sources">
      <strong>Sources</strong>
      {sources.length?sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>):<span>No documentation source matched.</span>}
      <span>Merchant policy</span>
      <span>{event.did.value?.boundary==="browser"?"Browser sensor":"Runtime evidence"}</span>
    </div>
  </aside>;
}

function VendorFact({label,value}:{label:string;value:string}){
  return <div className="ts-master-vendor-fact"><strong>{label}</strong><span>{value}</span></div>;
}

function MasterActivityRow({event,onClick}:{event:ConsoleEvent;onClick:()=>void}){
  const state=eventStatus(event);
  return <button onClick={onClick}>
    <span className={"ts-master-event-icon "+responseClass(state)}>{eventIcon(state)}</span>
    <div><strong>{masterEventTitle(event)}</strong><span>{integrationLabel(event)} · {eventSummary(event)}</span></div>
    <time>{relativeTime(event.observedAt)}</time>
  </button>;
}

function VendorMark({label,large=false}:{label:string;large?:boolean}){
  const lower=label.toLowerCase();
  const kind=lower.includes("google")||lower.includes("analytics")?"google":lower.includes("tiktok")?"tiktok":lower.includes("meta")||lower.includes("facebook")?"meta":"default";
  const glyph=kind==="tiktok"?"♪":kind==="google"?"G":kind==="meta"?"M":label.trim().charAt(0).toUpperCase()||"?";
  return <span className={"ts-master-vendor-mark "+kind+(large?" large":"")}>{glyph}</span>;
}

function overviewDecisionTitle(event:ConsoleEvent){
  const blocked=event.enforcement?.removedFields[0];
  if(event.outcome==="PREVENTED"&&blocked)return `Blocked ${blocked} before transmission`;
  if(event.outcome==="DETECTED")return "Detected access after it occurred";
  if(event.decision==="CONSTRAIN")return "Constrained access outside approved scope";
  if(event.decision==="ISOLATE")return "Isolated integration after deterministic finding";
  if(event.decision==="ALLOW")return "Access matched approved purpose";
  return "Integration activity needs review";
}

function overviewDecisionCopy(event:ConsoleEvent){
  if(event.outcome==="PREVENTED"){
    const allowed=event.enforcement?.continuedFields.length??0;
    const blocked=event.enforcement?.removedFields.length??0;
    return `During this event, ThirdSight allowed ${allowed} field${allowed===1?"":"s"} and blocked ${blocked} field${blocked===1?"":"s"} before the request reached the receiver.`;
  }
  return eventSummary(event);
}

function masterEventTitle(event:ConsoleEvent){
  const field=event.enforcement?.removedFields[0]??event.findings.find(finding=>finding.field)?.field;
  if(event.outcome==="PREVENTED")return field?`Blocked ${field}`:"Blocked field before transmission";
  if(event.outcome==="DETECTED")return field?`Detected ${field}`:"Detected post-access activity";
  if(event.decision==="ALLOW")return "Allowed integration activity";
  if(event.findings.length)return humanize(event.findings[0].type);
  return "Evidence collected";
}

function humanizeDataField(value:string){
  const parts=value.split(".");
  const leaf=parts[parts.length-1]??value;
  return humanize(leaf);
}

function safeHost(value:string){
  try{return new URL(value).hostname;}catch{return value;}
}

function relativeTime(value:string){
  const stamp=Date.parse(value);
  if(Number.isNaN(stamp))return "—";
  const diff=Math.max(0,Date.now()-stamp);
  const minutes=Math.floor(diff/60000);
  if(minutes<1)return "now";
  if(minutes<60)return minutes+"m ago";
  const hours=Math.floor(minutes/60);
  if(hours<24)return hours+"h ago";
  return Math.floor(hours/24)+"d ago";
}

function Integrations({rows,query,onQuery,onOpen}:{rows:readonly ExposureRow[];query:string;onQuery:(value:string)=>void;onOpen:(row:ExposureRow)=>void}){
  return <div className="ts-page-stack">
    <div className="ts-section-head">
      <div><span className="ts-kicker">Inventory · Vendor Intelligence</span><h2>Integration exposure</h2><p>Expected, approved, capable and observed are separate evidence. Vendor documentation adds context; it never becomes merchant authorization.</p></div>
      <label className="ts-search"><Search size={15}/><input value={query} onChange={e=>onQuery(e.target.value)} placeholder="Search vendors, capabilities, fields, destinations…"/></label>
    </div>
    <div className="ts-intel-principle">
      <span>Approval authority</span><b>Merchant policy</b><i>›</i><span>Product context</span><b>Vendor documentation</b><i>›</i><span>Runtime truth</span><b>Observed evidence</b>
    </div>
    <div className="ts-table-card">
      <div className="ts-table-head integration">
        <span>Integration</span><span>Expected</span><span>Capable</span><span>Observed</span><span>Approved</span><span>Response</span>
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

function ReviewQueue({rows,onOpen}:{rows:readonly ExposureRow[];onOpen:(row:ExposureRow)=>void}){
  if(rows.length===0)return <EmptyState text="No unresolved or evidence-backed item is currently queued."/>;
  return <div className="ts-review-list">
    {rows.map(row=>{
      const hasFinding=row.findings.length>0;
      const reason=hasFinding
        ? humanize(row.findings[0]??"finding")
        : row.integrationId
          ? "Purpose or evidence context needs review"
          : "Identity and merchant-approved purpose not registered";
      return <button key={row.key} onClick={()=>onOpen(row)}>
        <span className={"ts-review-icon "+(hasFinding?"finding":"unresolved")}>
          {hasFinding?<AlertTriangle size={15}/>:<Eye size={15}/>}
        </span>
        <div>
          <strong>{row.label}</strong>
          <span>{reason}</span>
          <small>{row.observations} observation{row.observations===1?"":"s"} · {row.lastSeen?new Date(row.lastSeen).toLocaleString():"no timestamp"}</small>
        </div>
        <ChevronRight size={15}/>
      </button>;
    })}
  </div>;
}

function IntegrationRow({row,onClick}:{row:ExposureRow;onClick:()=>void}){
  const profile=row.vendorIntelligence.profiles[0]??null;
  const expected=profile?.expectedPurposes.slice(0,1)??[];
  const documentedCapability=profile?.documentedCapabilities.slice(0,2)??[];
  const localCapability=row.canReachFields;
  const capable=localCapability.length>0?localCapability:documentedCapability;

  return <button className="ts-table-row integration" onClick={onClick}>
    <div className="ts-integration-name">
      <span className={"ts-integration-dot "+responseClass(row.latestResponse)}/>
      <p>
        <b>{profile?.family??row.label}</b>
        <small>{profile?`${profile.vendor} · documented family`:(row.integrationId??"identity unresolved")} · {row.observations} observations</small>
      </p>
    </div>
    <IntelCell
      values={expected}
      fallback="Documented purpose unavailable"
      source={profile?"Vendor documented":"Unresolved"}
    />
    <IntelCell
      values={capable}
      fallback={row.reachSource==="OBSERVED_LOWER_BOUND"?"Browser-visible lower bound only":"Documented capability unavailable"}
      source={localCapability.length>0?"Local capability":profile?"Vendor documented":row.reachSource==="OBSERVED_LOWER_BOUND"?"Browser sensor":"Unresolved"}
    />
    <IntelCell
      values={row.attemptedFields}
      blocked={row.preventedFields}
      fallback={row.boundaries.length?row.boundaries.map(v=>v+" request metadata").join(", "):"Not observed"}
      source={row.boundaries.includes("browser")?"Browser sensor":"Runtime evidence"}
    />
    <IntelCell
      values={row.approvedFields}
      fallback="Not supplied by merchant"
      source="Merchant policy"
      muted={row.approvedFields.length===0}
    />
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

      {discoveryOnly?<div className="ts-boundary-note"><Eye size={16}/><p><b>Discovery only.</b> Runtime metadata proves the observation boundary. Vendor documentation may describe expected product behaviour, but it does not establish this merchant's approval, configuration or internal justification.</p></div>:null}
      {event.blindSpotAssessment?<div className="ts-boundary-note warning"><AlertTriangle size={16}/><p><b>Known benchmark blind spot.</b> {event.blindSpotAssessment.reason}</p></div>:null}

      <VendorIntelligencePanel event={event}/>

      <div className="ts-proof-model-label"><span>Frozen proof model</span><small>Merchant-authoritative SHOULD / local COULD / runtime DID / first-party WHY</small></div>
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
        <span className="ts-kicker">Vendor Intelligence · {event.vendorIntelligence.registryVersion}</span>
        <strong>{profile?profile.family:"Vendor identity unresolved"}</strong>
        <small>{profile?`${profile.vendor} · ${humanize(profile.category)}`:"No documentation-backed family matched this destination."}</small>
      </div>
      <span className={"ts-vendor-match "+(profile?"matched":"unresolved")}>{profile?"DOCUMENTED":"UNRESOLVED"}</span>
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

function IntelCell({values,blocked=[],fallback,source,muted=false}:{values:readonly string[];blocked?:readonly string[];fallback:string;source:string;muted?:boolean}){
  return <div className={"ts-intel-cell "+(muted?"muted":"")}>
    <div className="ts-intel-cell-values">
      {values.length>0
        ?values.slice(0,2).map(value=><span className={blocked.includes(value)?"blocked":""} key={value}>{value}{blocked.includes(value)?" · blocked":""}</span>)
        :<span>{fallback}</span>}
      {values.length>2?<small>+{values.length-2} more</small>:null}
    </div>
    <em>{source}</em>
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
