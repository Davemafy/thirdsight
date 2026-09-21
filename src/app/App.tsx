import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
  const [aiPromoted,setAiPromoted]=useState(false);
  const [exposureMap,setExposureMap]=useState<ExposureRow[]>([]);
  const [challengeProof,setChallengeProof]=useState<ChallengeProof|null>(null);
  const [query,setQuery]=useState("");
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [retryKey,setRetryKey]=useState(0);

  const retryEvidence=()=>{
    toast.loading("Retrying connection…",{
      id:"evidence-feed",
      description:"Checking the evidence feed now.",
      duration:Infinity,
    });
    setRetryKey(value=>value+1);
  };

  useEffect(()=>{
    let live=true;
    const load=(manual=false)=>fetch("/api/console-events",{cache:"no-store"})
      .then(r=>{if(!r.ok)throw new Error("evidence unavailable");return r.json()})
      .then(d=>{
        if(!live)return;
        const history=(d.history??[]) as ConsoleEvent[];
        setEvents(history);
        setExposureMap((d.exposureMap??[]) as ExposureRow[]);
        setChallengeProof((d.challengeProof??null) as ChallengeProof|null);
        setAiPromoted(Boolean(d.aiAnalyst?.promoted));
        setSelected(current=>current<history.length?current:0);
        if(manual){
          toast.success("Connection restored",{
            id:"evidence-feed",
            description:"Latest evidence is available again.",
            duration:2400,
          });
        }else{
          toast.dismiss("evidence-feed");
        }
      })
      .catch(()=>{
        if(!live)return;
        toast.error("Live evidence is unavailable",{
          id:"evidence-feed",
          description:"We couldn't refresh your latest activity.",
          duration:Infinity,
          action:{
            label:"Retry",
            onClick:retryEvidence,
          },
        });
      });
    load(retryKey>0);
    const id=window.setInterval(()=>load(false),5000);
    return()=>{
      live=false;
      window.clearInterval(id);
    };
  },[retryKey]);

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
        </div>
        <div className="ts-topbar-actions">
          <span className="ts-env"><span/> Commerce Lab</span>
          <button className="ts-connect-button" onClick={()=>setView("connections")}><PlugZap size={14}/> Connect platform</button>
          <button className="ts-mobile-more" onClick={()=>setMobileMenuOpen(true)} aria-label="More navigation"><MoreHorizontal size={19}/></button>
        </div>
      </div>

      <div className="ts-content">
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
  const prevented=proof?.scopePrevention.proven??false;
  const totalObserved=exposure.length;
  const reviewRows=[
    ...exposure.filter(row=>row.findings.length>0),
    ...exposure.filter(row=>row.findings.length===0&&!row.integrationId),
  ].slice(0,3);
  const statusTitle=findingCount>0
    ? `${findingCount} integration${findingCount===1?"":"s"} need attention`
    : `${totalObserved} third-party destination${totalObserved===1?"":"s"} observed`;
  const statusDetail=findingCount>0
    ? `${findingCount} proven policy issue${findingCount===1?"":"s"} need review.`
    : unregisteredCount>0
      ? `No proven policy violations. ${unregisteredCount} destination${unregisteredCount===1?"":"s"} still need an owner or approved purpose.`
      : "No proven policy violations.";

  return <>
    <div className="ts-operational-hero">
      <div className="ts-operational-copy">
        <span className="ts-live-label">Discovery active · Commerce Lab</span>
        <h1>{statusTitle}</h1>
        <p>{statusDetail}</p>
        <div className="ts-hero-actions">
          <button className="ts-primary" onClick={onViewIntegrations}>Review destinations <ArrowRight size={15}/></button>
          <button className="ts-secondary" onClick={onConnections}>Connect enforcement</button>
        </div>
      </div>
    </div>

    <div className="ts-stat-grid">
      <StatCard label="Identified" value={String(registeredCount)} detail="Integrations with an owner or policy" icon={<PlugZap size={17}/>}/>
      <StatCard label="Policy issues" value={String(findingCount)} detail={findingCount>0?"Need investigation":"None proven"} icon={<AlertTriangle size={17}/>}/>
      <StatCard label="Stopped before send" value={prevented?"Yes":"—"} detail={prevented?"Unapproved data removed":"No prevention event yet"} icon={<ShieldCheck size={17}/>}/>
    </div>

    <div className="ts-review-grid">
      <Panel title="Review next" subtitle={reviewRows.length>0?"Items that need an owner, policy, or investigation.":"Nothing needs review."} action="View all" onAction={onViewIntegrations}>
        <ReviewQueue rows={reviewRows} onOpen={onOpenRow}/>
      </Panel>
      <Panel title="Recent activity" subtitle="Latest observed integration activity." >
        <div className="ts-activity-list">
          {groupActivityEvents(events).slice(0,6).map(item=><ActivityRow key={item.event.recordId} event={item.event} count={item.count} onClick={()=>onOpenEvent(item.index)}/>)}
          {events.length===0?<EmptyState text="No activity yet."/>:null}
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
      <div><h2>Integrations</h2><p>What each integration can access, what it touched, and what you approved.</p></div>
      <label className="ts-search"><Search size={15}/><input value={query} onChange={e=>onQuery(e.target.value)} placeholder="Search integrations, data, or domains"/></label>
    </div>
    <div className="ts-intel-principle">
      <span>Approval</span><b>Merchant policy</b><i>›</i><span>Product context</span><b>Vendor docs</b><i>›</i><span>Runtime</span><b>Observed evidence</b>
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
  const grouped=groupActivityEvents(events);
  return <div className="ts-page-stack">
    <div className="ts-section-head"><div><h2>Activity</h2><p>What your integrations have done.</p></div></div>
    <div className="ts-list-card">
      {grouped.map(item=><ActivityRow key={item.event.recordId} event={item.event} count={item.count} onClick={()=>onOpen(item.index)} large/>)}
      {events.length===0?<EmptyState text="No activity yet."/>:null}
    </div>
  </div>;
}

function IncidentView({events,onOpen}:{events:readonly ConsoleEvent[];onOpen:(index:number)=>void}){
  const incidents=events.map((event,index)=>({event,index})).filter(item=>isIncident(item.event));
  return <div className="ts-page-stack">
    <div className="ts-section-head"><div><h2>Incidents</h2><p>Policy violations and detections that need review.</p></div></div>
    <div className="ts-list-card">
      {incidents.map(({event,index})=><ActivityRow key={event.recordId} event={event} onClick={()=>onOpen(index)} large/>)}
      {incidents.length===0?<EmptyState text="No representative incident evidence is currently in the queue."/>:null}
    </div>
  </div>;
}

function Policies({rows,events,onOpen}:{rows:readonly ExposureRow[];events:readonly ConsoleEvent[];onOpen:(row:ExposureRow)=>void}){
  return <div className="ts-page-stack">
    <div className="ts-section-head"><div><h2>Policies</h2><p>What each integration is allowed to do.</p></div></div>
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
          ? "Needs more context"
          : "Owner or approved purpose missing";
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

function ActivityRow({event,onClick,large=false,count=1}:{event:ConsoleEvent;onClick:()=>void;large?:boolean;count?:number}){
  const value=eventStatus(event);
  return <button className={"ts-activity-row "+(large?"large":"")} onClick={onClick}>
    <span className={"ts-activity-icon "+responseClass(value)}>{eventIcon(event)}</span>
    <div className="ts-activity-copy">
      <strong>{integrationLabel(event)}</strong>
      <span>{eventSummary(event)}</span>
      <small>{count>1?count+" similar observations · ":""}{new Date(event.observedAt).toLocaleString()} · {event.coverage.label.replaceAll("_"," ").toLowerCase()}</small>
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

function groupActivityEvents(events:readonly ConsoleEvent[]){
  const grouped:Array<{event:ConsoleEvent;index:number;count:number}>=[];
  const byKey=new Map<string,number>();
  events.forEach((event,index)=>{
    const second=Number.isNaN(Date.parse(event.observedAt))
      ? event.observedAt
      : new Date(event.observedAt).toISOString().slice(0,19);
    const key=[
      integrationLabel(event),
      event.did.value?.destinationOrigin??"",
      event.did.value?.method??"",
      eventSummary(event),
      eventStatus(event),
      second,
    ].join("|");
    const existing=byKey.get(key);
    if(existing===undefined){
      byKey.set(key,grouped.length);
      grouped.push({event,index,count:1});
    }else{
      grouped[existing].count+=1;
    }
  });
  return grouped;
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

function eventIcon(event:ConsoleEvent){
  const value=eventStatus(event).toLowerCase();
  if(value==="prevented"||value==="constrain")return <ShieldCheck size={15}/>;
  if(value==="detected"||value==="isolate"||event.findings.length>0)return <AlertTriangle size={15}/>;
  if(value==="allow")return <CircleCheck size={15}/>;
  if(event.did.value?.boundary==="db-audit")return <Database size={15}/>;
  if(event.did.value?.boundary==="browser")return <Globe2 size={15}/>;
  if(event.did.value?.boundary)return <Workflow size={15}/>;
  return <Eye size={15}/>;
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
