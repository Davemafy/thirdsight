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
  overview:{title:"Overview",subtitle:"What needs attention across your connected tools."},
  integrations:{title:"Integrations",subtitle:"What each tool is for, what it touched, and whether that matched your rules."},
  activity:{title:"Activity",subtitle:"A timeline of what connected tools actually did."},
  incidents:{title:"Incidents",subtitle:"Access that was blocked, limited, or detected outside the approved rules."},
  policies:{title:"Policies",subtitle:"What each integration is allowed to access and why."},
  connections:{title:"Connections",subtitle:"Connect the places ThirdSight can observe and enforce access."},
  validation:{title:"Validation",subtitle:"The evidence behind ThirdSight's claims and limits."},
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
  const attentionRows=exposure.filter(row=>
    row.findings.length>0||
    !row.integrationId||
    row.latestResponse==="CONSTRAIN"||
    row.latestResponse==="ISOLATE"||
    row.latestResponse==="PREVENTED"||
    row.latestResponse==="DETECTED"
  );
  const stoppedCount=exposure.filter(row=>
    row.preventedFields.length>0||
    row.latestResponse==="CONSTRAIN"||
    row.latestResponse==="ISOLATE"||
    row.latestResponse==="PREVENTED"
  ).length;
  const normalCount=exposure.filter(row=>
    row.findings.length===0&&row.latestResponse==="ALLOW"
  ).length;
  const preventionProven=proof?.scopePrevention.proven??false;
  const reviewRows=attentionRows.slice(0,4);
  const needReview=attentionRows.length;

  return <>
    <section className="ts-five-hero">
      <div className="ts-five-copy">
        <span className="ts-live-label"><i/> Watching Commerce Lab</span>
        <span className="ts-kicker">Third-party access control</span>
        <h1>{needReview>0
          ?`${needReview} integration${needReview===1?"":"s"} need your attention`
          :"Your connected tools look normal"}</h1>
        <p>ThirdSight shows what connected tools are allowed to access, what they actually touched, and limits access when the evidence supports it.</p>
        <div className="ts-hero-actions">
          <button className="ts-primary" onClick={onViewIntegrations}>{needReview>0?"Review now":"See integrations"} <ArrowRight size={15}/></button>
          <button className="ts-secondary" onClick={onConnections}>Connect another source</button>
        </div>
      </div>

      <div className="ts-five-status">
        <SimpleMetric tone={needReview>0?"review":"normal"} value={needReview} label="Need review" detail={needReview>0?"Open these first":"Nothing currently queued"}/>
        <SimpleMetric tone="stopped" value={stoppedCount} label="Stopped or limited" detail={preventionProven?"Pre-send prevention proven":"Evidence-backed responses"}/>
        <SimpleMetric tone="normal" value={normalCount} label="Normal" detail="Matched current rules"/>
      </div>
    </section>

    <div className="ts-five-model" aria-label="How ThirdSight works">
      <div><span>1</span><p><b>What is allowed?</b><small>Your policy</small></p></div>
      <ArrowRight size={14}/>
      <div><span>2</span><p><b>What actually happened?</b><small>Runtime evidence</small></p></div>
      <ArrowRight size={14}/>
      <div><span>3</span><p><b>Do they match?</b><small>Normal, review, or stop</small></p></div>
    </div>

    <div className="ts-five-main">
      <Panel
        title="Needs your attention"
        subtitle={reviewRows.length>0?"The few items worth looking at first.":"Nothing currently needs review."}
        action="See all integrations"
        onAction={onViewIntegrations}
      >
        <ReviewQueue rows={reviewRows} onOpen={onOpenRow}/>
      </Panel>

      <div className="ts-five-side">
        <div className="ts-five-side-card">
          <span>Coverage</span>
          <strong>{exposure.length} observed integrations</strong>
          <p>{registeredCount} have merchant identity context. {unregisteredCount} still need identity or policy context.</p>
        </div>
        <div className="ts-five-side-card">
          <span>Current findings</span>
          <strong>{findingCount}</strong>
          <p>{findingCount>0?"Evidence-backed rule mismatches are present.":"No deterministic rule mismatch is currently proven."}</p>
        </div>
        <button className="ts-five-recent" onClick={()=>events.length>0&&onOpenEvent(0)} disabled={events.length===0}>
          <div><span>Latest activity</span><b>{events[0]?integrationLabel(events[0]):"Waiting for evidence"}</b></div>
          <ChevronRight size={16}/>
        </button>
      </div>
    </div>
  </>;
}

function Integrations({rows,query,onQuery,onOpen}:{rows:readonly ExposureRow[];query:string;onQuery:(value:string)=>void;onOpen:(row:ExposureRow)=>void}){
  return <div className="ts-page-stack">
    <div className="ts-section-head ts-simple-section-head">
      <div>
        <span className="ts-kicker">Connected tools</span>
        <h2>What is each integration doing?</h2>
        <p>Start with the outcome. Open a row only when you need the policy, vendor documentation, or raw evidence behind it.</p>
      </div>
      <label className="ts-search"><Search size={15}/><input value={query} onChange={e=>onQuery(e.target.value)} placeholder="Search integrations…"/></label>
    </div>
    <div className="ts-table-card">
      <div className="ts-table-head integration simple">
        <span>Integration</span><span>What it does</span><span>What happened</span><span>Status</span>
      </div>
      {rows.map(row=><IntegrationRow key={row.key} row={row} onClick={()=>onOpen(row)}/>)}
      {rows.length===0?<EmptyState text="No integrations match this search."/>:null}
    </div>
    <p className="ts-simple-footnote">“Normal” means the available evidence matches the current merchant rules. “Watching” means ThirdSight saw activity but does not have enough evidence for a stronger conclusion.</p>
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
  if(rows.length===0)return <EmptyState text="Nothing needs your attention right now."/>;
  return <div className="ts-review-list simple">
    {rows.map(row=>{
      const status=simpleRowStatus(row);
      const profile=row.vendorIntelligence.profiles[0]??null;
      const reason=row.findings.length>0
        ? humanize(row.findings[0]??"finding")
        : !row.integrationId
          ? "No merchant rule is attached yet"
          : status.label==="Stopped"
            ? "ThirdSight limited this access"
            : "Needs more context before it can be cleared";
      return <button key={row.key} onClick={()=>onOpen(row)}>
        <span className={"ts-review-icon "+status.tone}>{statusIcon(status.tone)}</span>
        <div>
          <strong>{profile?.family??row.label}</strong>
          <span>{reason}</span>
          <small>{simpleObservedRow(row)}</small>
        </div>
        <span className={"ts-simple-status "+status.tone}>{status.label}</span>
        <ChevronRight size={15}/>
      </button>;
    })}
  </div>;
}

function IntegrationRow({row,onClick}:{row:ExposureRow;onClick:()=>void}){
  const profile=row.vendorIntelligence.profiles[0]??null;
  const status=simpleRowStatus(row);
  const purpose=profile?.expectedPurposes[0]
    ??(row.integrationId?"Merchant rule exists; documented vendor purpose unavailable":"Purpose not identified yet");

  return <button className="ts-table-row integration simple" onClick={onClick}>
    <div className="ts-integration-name">
      <span className={"ts-integration-dot "+status.tone}/>
      <p>
        <b>{profile?.family??row.label}</b>
        <small>{profile?.vendor??(row.integrationId??"Unidentified integration")} · {row.observations} observation{row.observations===1?"":"s"}</small>
      </p>
    </div>
    <div className="ts-simple-cell">
      <b>{purpose}</b>
      <small>{profile?"Vendor-documented purpose":"Open for evidence details"}</small>
    </div>
    <div className="ts-simple-cell">
      <b>{simpleObservedRow(row)}</b>
      <small>{row.approvedFields.length>0
        ?`Allowed fields: ${row.approvedFields.slice(0,3).join(", ")}`
        :"Merchant-approved data scope not supplied"}</small>
    </div>
    <div className="ts-simple-response">
      <span className={"ts-simple-status "+status.tone}>{status.label}</span>
      <small>{status.detail}</small>
    </div>
  </button>;
}

function simpleRowStatus(row:ExposureRow):{label:string;tone:"review"|"stopped"|"normal"|"watching";detail:string}{
  const response=row.latestResponse.toLowerCase();
  if(row.preventedFields.length>0||response==="constrain"||response==="isolate"||response==="prevented"){
    return {label:"Stopped",tone:"stopped",detail:"Access was limited or blocked"};
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

function statusIcon(tone:"review"|"stopped"|"normal"|"watching"){
  if(tone==="stopped")return <ShieldCheck size={15}/>;
  if(tone==="normal")return <CircleCheck size={15}/>;
  if(tone==="review")return <AlertTriangle size={15}/>;
  return <Eye size={15}/>;
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
        <div><span className="ts-kicker">Integration review</span><h2>{integrationLabel(event)}</h2><p>Understand the outcome first. Evidence is below when you need it.</p></div>
        <button className="ts-icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button>
      </div>

      <div className="ts-simple-drawer-status">
        <span className={"ts-simple-status "+status.tone}>{status.label}</span>
        <strong>{status.headline}</strong>
        <p>{status.detail}</p>
      </div>

      <div className="ts-simple-why">
        <div><span>Allowed for</span><b>{allowedFor}</b></div>
        <div><span>What happened</span><b>{observed}</b></div>
        <div><span>Why this status</span><b>{reason}</b></div>
      </div>

      {discoveryOnly?<div className="ts-boundary-note"><Eye size={16}/><p><b>Still learning.</b> ThirdSight saw this browser request, but there is no merchant policy or first-party business context yet to say whether it was appropriate.</p></div>:null}
      {event.blindSpotAssessment?<div className="ts-boundary-note warning"><AlertTriangle size={16}/><p><b>Known validation limit.</b> {event.blindSpotAssessment.reason}</p></div>:null}

      <DecisionCard event={event}/>

      <details className="ts-details ts-technical-details">
        <summary>Technical evidence</summary>
        <VendorIntelligencePanel event={event}/>
        <div className="ts-proof-model-label"><span>Proof model</span><small>Policy · capability · runtime · business context</small></div>
        <div className="ts-evidence-grid">
          <EvidenceFact title="Allowed" status={event.should.status} value={event.should.value?.purpose??"No merchant policy provided"} detail={event.should.reason}/>
          <EvidenceFact title="Could access" status={event.could.status} value={event.could.value?.statement??"Complete capability surface not available"} detail={event.could.reason}/>
          <EvidenceFact title="Observed" status={event.did.status} value={didSummary(event)} detail={event.did.reason}/>
          <EvidenceFact title="Business context" status={event.why.status} value={event.why.value?.eventType?event.why.value.eventType+" · "+event.why.value.correlationStrength:"No authoritative business context"} detail={event.why.reason}/>
        </div>
        <div className="ts-raw-grid">
          <RawEvidence label="POLICY" value={event.should}/>
          <RawEvidence label="CAPABILITY" value={event.could}/>
          <RawEvidence label="OBSERVED" value={event.did}/>
          <RawEvidence label="CONTEXT" value={event.why}/>
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
          <small>Advisory only. AI cannot change the evidence or enforcement decision.</small>
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

function SimpleMetric({
  tone,
  value,
  label,
  detail,
}:{
  tone:"review"|"stopped"|"normal";
  value:number;
  label:string;
  detail:string;
}){
  return <div className={"ts-simple-metric "+tone}>
    <strong>{value}</strong>
    <span>{label}</span>
    <small>{detail}</small>
  </div>;
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
