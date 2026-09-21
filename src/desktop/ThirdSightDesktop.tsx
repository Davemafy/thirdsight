import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Box,
  ChevronDown,
  ChevronRight,
  Check,
  CircleCheck,
  CircleDot,
  FlaskConical,
  Globe2,
  Home,
  Layers3,
  Moon,
  MoreHorizontal,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  TriangleAlert,
} from "lucide-react";
import "./ThirdSightDesktop.css";

type ResponseLevel="ALLOW"|"OBSERVE"|"CONSTRAIN"|"ISOLATE"|null;
type Outcome="PREVENTED"|"DETECTED"|null;
type Finding={type:string;action?:string;field?:string;reason?:string};
type EvidenceClaim={value:any;status:string;reason?:string;confidence?:string;provenance?:readonly any[]};
type VendorProfile={
  vendor:string;
  family:string;
  category:string;
  expectedPurposes:readonly string[];
  documentedCapabilities:readonly string[];
  documentedDataOrEvents:readonly string[];
  sources:readonly {publisher:string;title:string;url:string;reviewedAt:string;sourceType:string}[];
};
type VendorIntelligence={status:string;profiles:readonly VendorProfile[];unresolvedOrigins:readonly string[];authorityBoundary:string};
type ConsoleEvent={
  recordId:string;
  acceptedAt?:string;
  observedAt:string;
  integrationId:string|null;
  integrationResolution:string;
  should:EvidenceClaim;
  could:EvidenceClaim;
  did:EvidenceClaim;
  why:EvidenceClaim;
  findings:readonly Finding[];
  enforcement:null|{
    action:string;
    outcome:"PREVENTED";
    removedFields:readonly string[];
    continuedFields:readonly string[];
    receiver:{receivedFields:readonly string[];forbiddenFieldReceived:boolean};
  };
  containment:null|{action:string;credentialId:string;applied:boolean};
  decision:ResponseLevel;
  outcome:Outcome;
  coverage:{label:string;boundaries:readonly string[];limitations:readonly string[]};
  vendorIntelligence:VendorIntelligence;
};
type ExposureRow={
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
  reachSource:string;
  vendorIntelligence:VendorIntelligence;
};
type ChallengeProof={
  busySale:{observed:number;allowed:number;falseAlarms:number;passed:boolean};
  abnormalBehavior:{persistedFindings:number;findingTypes:readonly string[];observed:boolean};
  gradedResponse:{levels:readonly string[];observedResponses:readonly string[]};
  scopePrevention:{proven:boolean;recordId:string|null;removedFields:readonly string[];receivedFields:readonly string[];forbiddenFieldReceived:boolean|null};
};
type ApiPayload={
  productThesis?:string;
  exposureMap?:ExposureRow[];
  history?:ConsoleEvent[];
  challengeProof?:ChallengeProof;
};

type WorkspaceView="home"|"integrations"|"activity"|"incidents"|"validation";
type InspectorTab="purpose"|"capability"|"observed"|"context"|"evidence";
type OutputTab="response"|"timeline"|"raw";

const railItems:[
  WorkspaceView,
  string,
  React.ReactNode
][]=[
  ["home","Home",<Home size={17}/>],
  ["integrations","Integrations",<Layers3 size={17}/>],
  ["activity","Activity",<Activity size={17}/>],
  ["incidents","Incidents",<TriangleAlert size={17}/>],
  ["validation","Validation",<FlaskConical size={17}/>],
];

export default function ThirdSightDesktop(){
  const [payload,setPayload]=useState<ApiPayload>({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [query,setQuery]=useState("");
  const [view,setView]=useState<WorkspaceView>("home");
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [selectedRecord,setSelectedRecord]=useState<string|null>(null);
  const [tab,setTab]=useState<InspectorTab>("purpose");
  const [outputTab,setOutputTab]=useState<OutputTab>("response");
  const [dark,setDark]=useState(false);
  const [running,setRunning]=useState(false);
  const [runNote,setRunNote]=useState<string|null>(null);

  const load=async()=>{
    try{
      const response=await fetch("/api/console-events",{cache:"no-store"});
      if(!response.ok)throw new Error("Evidence feed unavailable");
      const next=await response.json() as ApiPayload;
      setPayload(next);
      setError(false);
      setSelectedKey(current=>current??next.exposureMap?.[0]?.key??null);
      setSelectedRecord(current=>current??next.history?.[0]?.recordId??null);
    }catch{
      setError(true);
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    void load();
    const id=window.setInterval(()=>void load(),7000);
    return()=>window.clearInterval(id);
  },[]);

  const exposure=payload.exposureMap??[];
  const history=payload.history??[];
  const normalized=query.trim().toLowerCase();
  const filteredExposure=useMemo(()=>exposure.filter(row=>{
    if(!normalized)return true;
    const profile=row.vendorIntelligence.profiles[0];
    return [
      row.label,row.integrationId??"",row.resolution,...row.destinations,...row.findings,
      profile?.vendor??"",profile?.family??"",profile?.category??"",
    ].join(" ").toLowerCase().includes(normalized);
  }),[exposure,normalized]);

  const selectedRow=exposure.find(row=>row.key===selectedKey)??filteredExposure[0]??exposure[0]??null;
  const rowEvents=selectedRow?history.filter(event=>eventMatchesRow(event,selectedRow)):[];
  const selectedEvent=rowEvents.find(event=>event.recordId===selectedRecord)
    ??history.find(event=>event.recordId===selectedRecord)
    ??rowEvents[0]
    ??history[0]
    ??null;

  const chooseRow=(row:ExposureRow)=>{
    setSelectedKey(row.key);
    const event=history.find(item=>eventMatchesRow(item,row))??null;
    setSelectedRecord(event?.recordId??null);
    setView("integrations");
    setTab("purpose");
    setOutputTab("response");
  };

  const chooseEvent=(event:ConsoleEvent)=>{
    const row=exposure.find(candidate=>eventMatchesRow(event,candidate))??null;
    if(row)setSelectedKey(row.key);
    setSelectedRecord(event.recordId);
    setView("integrations");
    setTab("observed");
    setOutputTab("response");
  };

  const runScopeProof=async()=>{
    setRunning(true);
    setRunNote(null);
    try{
      const response=await fetch("/api/stage5-proof",{cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw new Error(body?.message??"Scope proof failed");
      setRunNote("Controlled scope proof persisted. Refreshing evidence…");
      await load();
      const newest=(body?.managed?.recordId??body?.managedRecordId??body?.recordId) as string|undefined;
      if(newest)setSelectedRecord(newest);
    }catch(err){
      setRunNote(err instanceof Error?err.message:"Scope proof failed");
    }finally{
      setRunning(false);
    }
  };

  return <div className={"shipclone "+(dark?"dark":"light")}>
    <aside className="ship-rail">
      <a className="ship-mark" href="/" aria-label="ThirdSight home"><ShieldCheck size={18}/></a>
      <nav>
        {railItems.map(([id,label,icon])=><button key={id} title={label} className={view===id?"active":""} onClick={()=>setView(id)}>
          {icon}<span>{label}</span>
        </button>)}
      </nav>
      <div className="ship-rail-bottom">
        <button title="Theme" onClick={()=>setDark(value=>!value)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button>
        <button title="Settings"><Settings2 size={17}/></button>
        <span className="ship-avatar">D</span>
      </div>
    </aside>

    <aside className="ship-collection">
      <div className="ship-workspace-switch">
        <span className="ship-workspace-glyph">C</span>
        <div><strong>Commerce Lab</strong><small>Production evidence</small></div>
        <ChevronDown size={14}/>
      </div>

      <label className="ship-search">
        <Search size={14}/>
        <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search integrations"/>
        <kbd>⌘K</kbd>
      </label>

      <div className="ship-collection-section">
        <div className="ship-collection-title"><span>Integrations</span><button><MoreHorizontal size={14}/></button></div>
        <div className="ship-tree">
          {filteredExposure.map(row=><button key={row.key} className={selectedRow?.key===row.key?"active":""} onClick={()=>chooseRow(row)}>
            <span className={"ship-status-dot "+rowTone(row)}/>
            <div><strong>{rowName(row)}</strong><small>{rowSubtitle(row)}</small></div>
            <em>{row.observations}</em>
          </button>)}
          {filteredExposure.length===0?<div className="ship-sidebar-empty">No matches</div>:null}
        </div>
      </div>

      <div className="ship-collection-section recent">
        <div className="ship-collection-title"><span>Recent evidence</span></div>
        <div className="ship-recent-list">
          {history.slice(0,6).map(event=><button key={event.recordId} onClick={()=>chooseEvent(event)}>
            <span className={"ship-method "+eventTone(event)}>{boundaryLabel(event)}</span>
            <div><strong>{eventName(event)}</strong><small>{eventOutcome(event)} · {relative(event.observedAt)}</small></div>
          </button>)}
        </div>
      </div>

      <div className="ship-sidebar-foot">
        <span><CircleDot size={11}/> {error?"Evidence interrupted":"Evidence live"}</span>
        <a href="/commerce-lab">Commerce Lab <ArrowRight size={11}/></a>
      </div>
    </aside>

    <section className="ship-workbench">
      <header className="ship-topbar">
        <div className="ship-breadcrumbs">
          <span>Commerce Lab</span><ChevronRight size={12}/><strong>{viewLabel(view)}</strong>
        </div>
        <div className="ship-top-actions">
          <span className="ship-sync"><i/> Synced</span>
          <button onClick={()=>void load()} title="Refresh"><RefreshCw size={14}/></button>
          <a href="/commerce-lab/control">Lab controls</a>
          <span className="ship-avatar small">D</span>
        </div>
      </header>

      {view==="home"?<WorkspaceHome
        payload={payload}
        loading={loading}
        error={error}
        onSelectRow={chooseRow}
        onSelectEvent={chooseEvent}
        onRunProof={runScopeProof}
        running={running}
      />:null}

      {view==="integrations"?<IntegrationWorkbench
        row={selectedRow}
        event={selectedEvent}
        rowEvents={rowEvents}
        tab={tab}
        outputTab={outputTab}
        onTab={setTab}
        onOutputTab={setOutputTab}
        onEvent={event=>setSelectedRecord(event.recordId)}
        onRunProof={runScopeProof}
        running={running}
        runNote={runNote}
      />:null}

      {view==="activity"?<ActivityWorkspace events={history} onOpen={chooseEvent}/>:null}
      {view==="incidents"?<IncidentWorkspace events={history} onOpen={chooseEvent}/>:null}
      {view==="validation"?<ValidationWorkspace payload={payload} onRunProof={runScopeProof} running={running}/>:null}
    </section>
  </div>;
}

function WorkspaceHome({
  payload,loading,error,onSelectRow,onSelectEvent,onRunProof,running,
}:{
  payload:ApiPayload;loading:boolean;error:boolean;
  onSelectRow:(row:ExposureRow)=>void;onSelectEvent:(event:ConsoleEvent)=>void;
  onRunProof:()=>void;running:boolean;
}){
  const rows=payload.exposureMap??[];
  const events=payload.history??[];
  const findings=events.filter(isIncident);
  const unresolved=rows.filter(row=>!row.integrationId);
  const proof=payload.challengeProof;

  return <div className="ship-home">
    <div className="ship-home-head">
      <div><span className="ship-eyebrow">Workspace</span><h1>Commerce Lab</h1><p>{payload.productThesis??"ThirdSight proves what can be proven, and learns where proof stops."}</p></div>
      <button className="ship-orange-action" onClick={onRunProof} disabled={running}><Play size={13}/>{running?"Running…":"Run scope proof"}</button>
    </div>

    {error?<div className="ship-inline-error"><AlertTriangle size={14}/> Evidence feed unavailable. ThirdSight is not substituting mock data.</div>:null}

    <div className="ship-summary-row">
      <SummaryBlock label="Observed origins" value={loading?"—":String(rows.length)} note="Current workspace"/>
      <SummaryBlock label="Unresolved" value={loading?"—":String(unresolved.length)} note="Identity or approval missing"/>
      <SummaryBlock label="Findings" value={loading?"—":String(findings.length)} note="Deterministic only"/>
      <SummaryBlock label="Pre-send" value={proof?.scopePrevention.proven?"Proven":"No proof"} note="Managed boundary"/>
    </div>

    <div className="ship-home-grid">
      <section className="ship-home-pane">
        <div className="ship-pane-title"><div><span>Integrations</span><small>Observed in this workspace</small></div><b>{rows.length}</b></div>
        <div className="ship-home-rows">
          {rows.slice(0,8).map(row=><button key={row.key} onClick={()=>onSelectRow(row)}>
            <span className={"ship-status-dot "+rowTone(row)}/>
            <div><strong>{rowName(row)}</strong><small>{rowSubtitle(row)}</small></div>
            <span className={"ship-mini-pill "+rowTone(row)}>{rowStateLabel(row)}</span>
            <ChevronRight size={13}/>
          </button>)}
        </div>
      </section>

      <section className="ship-home-pane">
        <div className="ship-pane-title"><div><span>Recent evidence</span><small>Persisted events</small></div><b>{events.length}</b></div>
        <div className="ship-event-rows">
          {events.slice(0,8).map(event=><button key={event.recordId} onClick={()=>onSelectEvent(event)}>
            <span className={"ship-method "+eventTone(event)}>{boundaryLabel(event)}</span>
            <div><strong>{eventName(event)}</strong><small>{eventSummary(event)}</small></div>
            <span>{relative(event.observedAt)}</span>
          </button>)}
          {events.length===0?<div className="ship-empty">Waiting for persisted evidence.</div>:null}
        </div>
      </section>
    </div>

    <section className="ship-proof-bar">
      <div><CircleCheck size={15}/><span>Flash sale</span><strong>{proof?.busySale.passed?"0 false alarms":"Awaiting proof"}</strong></div>
      <div><AlertTriangle size={15}/><span>Abnormal behaviour</span><strong>{proof?.abnormalBehavior.observed?"Caught":"Not observed"}</strong></div>
      <div><ShieldCheck size={15}/><span>Scope control</span><strong>{proof?.scopePrevention.proven?"Prevented":"Awaiting proof"}</strong></div>
    </section>
  </div>;
}

function SummaryBlock({label,value,note}:{label:string;value:string;note:string}){
  return <div className="ship-summary-block"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function IntegrationWorkbench({
  row,event,rowEvents,tab,outputTab,onTab,onOutputTab,onEvent,onRunProof,running,runNote,
}:{
  row:ExposureRow|null;event:ConsoleEvent|null;rowEvents:readonly ConsoleEvent[];
  tab:InspectorTab;outputTab:OutputTab;
  onTab:(tab:InspectorTab)=>void;onOutputTab:(tab:OutputTab)=>void;
  onEvent:(event:ConsoleEvent)=>void;onRunProof:()=>void;running:boolean;runNote:string|null;
}){
  if(!row&&!event)return <div className="ship-empty-workbench"><Box size={24}/><h2>No integration selected</h2><p>Select an integration from the workspace sidebar.</p></div>;

  const title=row?rowName(row):eventName(event!);
  const destination=row?.destinations[0]??event?.did.value?.destinationOrigin??"No destination observed";
  const response=event?.outcome??event?.decision??row?.latestResponse??"DISCOVERY";
  const inspectorTabs:[InspectorTab,string][]=[
    ["purpose","Purpose"],
    ["capability","Capability"],
    ["observed","Observed"],
    ["context","Context"],
    ["evidence","Evidence"],
  ];

  return <div className="ship-inspector">
    <div className="ship-object-head">
      <div className="ship-object-title">
        <span className={"ship-vendor-glyph "+rowTone(row)}>{glyph(title)}</span>
        <div><h1>{title}</h1><p>{row?.integrationId??event?.integrationId??"Unregistered integration"}</p></div>
      </div>
      <div className="ship-object-actions">
        <button><MoreHorizontal size={15}/></button>
        <button className="ship-orange-action" onClick={onRunProof} disabled={running}><Play size={13}/>{running?"Running…":"Run proof"}</button>
      </div>
    </div>

    <div className="ship-request-bar">
      <span className={"ship-method large "+eventTone(event)}>{event?boundaryLabel(event):(row?.boundaries[0]?.toUpperCase()??"BROWSER")}</span>
      <div className="ship-destination"><Globe2 size={13}/><span>{destination}</span></div>
      <span className="ship-env-label">Commerce Lab</span>
      <span className={"ship-response-button "+responseTone(response)}>{response}</span>
    </div>

    <div className="ship-tabbar">
      {inspectorTabs.map(([id,label])=><button key={id} className={tab===id?"active":""} onClick={()=>onTab(id)}>{label}</button>)}
    </div>

    <div className="ship-editor">
      <div className="ship-editor-main">
        {tab==="purpose"?<PurposePane row={row} event={event}/>:null}
        {tab==="capability"?<CapabilityPane row={row} event={event}/>:null}
        {tab==="observed"?<ObservedPane row={row} event={event}/>:null}
        {tab==="context"?<ContextPane event={event}/>:null}
        {tab==="evidence"?<EvidencePane event={event}/>:null}
      </div>
      <aside className="ship-history-panel">
        <div className="ship-history-title"><span>History</span><b>{rowEvents.length}</b></div>
        {rowEvents.length?rowEvents.slice(0,12).map(item=><button key={item.recordId} className={item.recordId===event?.recordId?"active":""} onClick={()=>onEvent(item)}>
          <span className={"ship-status-dot "+eventTone(item)}/><div><strong>{eventOutcome(item)}</strong><small>{relative(item.observedAt)}</small></div>
        </button>):<div className="ship-history-empty">No persisted event for this integration.</div>}
      </aside>
    </div>

    <div className="ship-output">
      <div className="ship-output-tabs">
        <button className={outputTab==="response"?"active":""} onClick={()=>onOutputTab("response")}>Response</button>
        <button className={outputTab==="timeline"?"active":""} onClick={()=>onOutputTab("timeline")}>Timeline</button>
        <button className={outputTab==="raw"?"active":""} onClick={()=>onOutputTab("raw")}>Raw</button>
        <span className={"ship-output-state "+responseTone(response)}>{response}</span>
      </div>
      <div className="ship-output-body">
        {runNote?<div className="ship-run-note">{runNote}</div>:null}
        {outputTab==="response"?<ResponsePane event={event} row={row}/>:null}
        {outputTab==="timeline"?<TimelinePane event={event}/>:null}
        {outputTab==="raw"?<pre className="ship-json">{JSON.stringify(event??row,null,2)}</pre>:null}
      </div>
    </div>
  </div>;
}

function PurposePane({row,event}:{row:ExposureRow|null;event:ConsoleEvent|null}){
  const profile=row?.vendorIntelligence.profiles[0]??event?.vendorIntelligence.profiles[0]??null;
  const purpose=event?.should.value?.purpose??profile?.expectedPurposes[0]??null;
  const approved=row?.approvedFields??event?.should.value?.allowedFields??[];
  return <Pane title="Purpose contract" description="Merchant approval is the authority. Vendor documentation is supporting context, never approval.">
    <EditorRow label="Integration"><strong>{row?.integrationId??event?.integrationId??"Not registered"}</strong></EditorRow>
    <EditorRow label="Purpose"><span>{purpose??"No merchant-approved purpose is available."}</span></EditorRow>
    <EditorRow label="Approved data">
      <TokenList values={approved} empty="No approved field list registered"/>
    </EditorRow>
    <EditorRow label="Vendor expectation"><span>{profile?.expectedPurposes[0]??"No documentation-backed expectation matched."}</span></EditorRow>
    <EditorRow label="Authority"><span className="ship-muted">{row?.vendorIntelligence.authorityBoundary??event?.vendorIntelligence.authorityBoundary??"Unknown"}</span></EditorRow>
  </Pane>;
}

function CapabilityPane({row,event}:{row:ExposureRow|null;event:ConsoleEvent|null}){
  const profile=row?.vendorIntelligence.profiles[0]??event?.vendorIntelligence.profiles[0]??null;
  const capabilities=[...(row?.canReachFields??[]),...(profile?.documentedCapabilities??[])];
  return <Pane title="Technical capability" description="What documentation, local grants or runtime reach establish this integration could do.">
    <EditorRow label="Evidence status"><EvidenceStatus claim={event?.could}/></EditorRow>
    <EditorRow label="Reach"><TokenList values={row?.canReachFields??[]} empty="No merchant field-level reach proven"/></EditorRow>
    <EditorRow label="Documented capability"><BulletList values={capabilities} empty="No documented capability matched"/></EditorRow>
  </Pane>;
}

function ObservedPane({row,event}:{row:ExposureRow|null;event:ConsoleEvent|null}){
  const fields=[...(event?.did.value?.dataCategories??[]),...(row?.attemptedFields??[])];
  return <Pane title="Observed access" description="What a sensor actually saw at the boundary. Missing payload semantics stay unresolved.">
    <EditorRow label="Boundary"><strong>{event?.did.value?.boundary??row?.boundaries.join(", ")??"Unknown"}</strong></EditorRow>
    <EditorRow label="Destination"><code>{event?.did.value?.destinationOrigin??row?.destinations[0]??"Unknown"}</code></EditorRow>
    <EditorRow label="Method"><span>{event?.did.value?.method??"Not captured"}</span></EditorRow>
    <EditorRow label="Attempted data"><TokenList values={fields} empty="Payload semantics not observed"/></EditorRow>
    <EditorRow label="Sensor status"><EvidenceStatus claim={event?.did}/></EditorRow>
  </Pane>;
}

function ContextPane({event}:{event:ConsoleEvent|null}){
  return <Pane title="Business context" description="Trusted first-party context used to explain why this access happened.">
    <EditorRow label="Status"><EvidenceStatus claim={event?.why}/></EditorRow>
    <EditorRow label="Event"><strong>{event?.why.value?.eventType??event?.why.value?.event?.type??"No correlated event"}</strong></EditorRow>
    <EditorRow label="Correlation"><span>{event?.why.value?.correlationStrength??"Unknown"}</span></EditorRow>
    <EditorRow label="Reason"><span className="ship-muted">{event?.why.reason??"No business context recorded."}</span></EditorRow>
  </Pane>;
}

function EvidencePane({event}:{event:ConsoleEvent|null}){
  if(!event)return <Pane title="Evidence record" description="Select a persisted event to inspect its evidence graph."><div className="ship-empty">No event selected.</div></Pane>;
  return <Pane title="Evidence record" description="The four evidence dimensions remain separate through verification.">
    <div className="ship-evidence-quads">
      <EvidenceQuad label="SHOULD" claim={event.should}/>
      <EvidenceQuad label="COULD" claim={event.could}/>
      <EvidenceQuad label="DID" claim={event.did}/>
      <EvidenceQuad label="WHY" claim={event.why}/>
    </div>
  </Pane>;
}

function Pane({title,description,children}:{title:string;description:string;children:React.ReactNode}){
  return <div className="ship-pane">
    <div className="ship-pane-head"><span>{title}</span><p>{description}</p></div>
    <div className="ship-editor-rows">{children}</div>
  </div>;
}

function EditorRow({label,children}:{label:string;children:React.ReactNode}){
  return <div className="ship-editor-row"><label>{label}</label><div>{children}</div></div>;
}

function TokenList({values,empty}:{values:readonly string[];empty:string}){
  if(!values.length)return <span className="ship-muted">{empty}</span>;
  return <div className="ship-tokens">{Array.from(new Set(values)).map(value=><code key={value}>{value}</code>)}</div>;
}

function BulletList({values,empty}:{values:readonly string[];empty:string}){
  if(!values.length)return <span className="ship-muted">{empty}</span>;
  return <div className="ship-bullets">{Array.from(new Set(values)).map(value=><span key={value}><Check size={12}/>{value}</span>)}</div>;
}

function EvidenceStatus({claim}:{claim:EvidenceClaim|undefined}){
  if(!claim)return <span className="ship-evidence-status unknown">UNKNOWN</span>;
  return <span className={"ship-evidence-status "+claim.status.toLowerCase()}>{claim.status}</span>;
}

function EvidenceQuad({label,claim}:{label:string;claim:EvidenceClaim}){
  return <div><header><b>{label}</b><EvidenceStatus claim={claim}/></header><pre>{JSON.stringify(claim.value,null,2)}</pre><small>{claim.reason??"No additional reason recorded."}</small></div>;
}

function ResponsePane({event,row}:{event:ConsoleEvent|null;row:ExposureRow|null}){
  const response=event?.outcome??event?.decision??row?.latestResponse??"DISCOVERY";
  const findings=event?.findings??[];
  return <div className="ship-response-grid">
    <div className="ship-response-summary">
      <span>Deterministic response</span><strong className={responseTone(response)}>{response}</strong>
      <p>{responseCopy(event,row)}</p>
    </div>
    <div className="ship-response-details">
      <div><span>Finding</span><strong>{findings[0]?.type??row?.findings[0]??"None"}</strong></div>
      <div><span>Removed</span><strong>{event?.enforcement?.removedFields.join(", ")||"—"}</strong></div>
      <div><span>Continued</span><strong>{event?.enforcement?.continuedFields.join(", ")||"—"}</strong></div>
      <div><span>Forbidden received</span><strong>{event?.enforcement?String(event.enforcement.receiver.forbiddenFieldReceived):"—"}</strong></div>
    </div>
  </div>;
}

function TimelinePane({event}:{event:ConsoleEvent|null}){
  if(!event)return <div className="ship-empty">No event selected.</div>;
  const steps=[
    ["Observed",event.did.status,event.observedAt],
    ["Compared",event.findings.length?event.findings[0]?.type:"No deterministic finding",event.observedAt],
    ["Decision",event.decision??"No response",event.observedAt],
    ["Outcome",event.outcome??"No enforced outcome",event.observedAt],
  ];
  return <div className="ship-timeline">{steps.map(([label,value,time],index)=><div key={label}><b>{index+1}</b><span><strong>{label}</strong><small>{value} · {new Date(time).toLocaleString()}</small></span></div>)}</div>;
}

function ActivityWorkspace({events,onOpen}:{events:readonly ConsoleEvent[];onOpen:(event:ConsoleEvent)=>void}){
  return <ListWorkspace eyebrow="Evidence history" title="Activity" copy="Persisted access observations from the current workspace.">
    <div className="ship-big-list">
      {events.map(event=><button key={event.recordId} onClick={()=>onOpen(event)}>
        <span className={"ship-method "+eventTone(event)}>{boundaryLabel(event)}</span>
        <div><strong>{eventName(event)}</strong><small>{eventSummary(event)}</small></div>
        <span className={"ship-mini-pill "+eventTone(event)}>{eventOutcome(event)}</span>
        <time>{relative(event.observedAt)}</time>
        <ChevronRight size={14}/>
      </button>)}
    </div>
  </ListWorkspace>;
}

function IncidentWorkspace({events,onOpen}:{events:readonly ConsoleEvent[];onOpen:(event:ConsoleEvent)=>void}){
  const incidents=events.filter(isIncident);
  return <ListWorkspace eyebrow="Deterministic findings" title="Incidents" copy="Evidence-backed mismatches and enforced outcomes.">
    <div className="ship-big-list">
      {incidents.map(event=><button key={event.recordId} onClick={()=>onOpen(event)}>
        <span className={"ship-method "+eventTone(event)}>{eventOutcome(event)}</span>
        <div><strong>{eventName(event)}</strong><small>{event.findings[0]?.reason??eventSummary(event)}</small></div>
        <span className={"ship-mini-pill "+eventTone(event)}>{event.findings[0]?.type??"FINDING"}</span>
        <time>{relative(event.observedAt)}</time>
        <ChevronRight size={14}/>
      </button>)}
      {incidents.length===0?<div className="ship-empty">No persisted deterministic incident in the current feed.</div>:null}
    </div>
  </ListWorkspace>;
}

function ValidationWorkspace({payload,onRunProof,running}:{payload:ApiPayload;onRunProof:()=>void;running:boolean}){
  const proof=payload.challengeProof;
  return <ListWorkspace eyebrow="Ground truth" title="Validation" copy="Controlled correctness proof stays separate from public-web discovery breadth.">
    <div className="ship-validation-layout">
      <section>
        <div className="ship-validation-row"><span>Managed scope violation</span><strong>{proof?.scopePrevention.proven?"PREVENTED":"Awaiting proof"}</strong></div>
        <div className="ship-validation-row"><span>Legitimate flash sale</span><strong>{proof?.busySale.passed?"0 false alarms":"Awaiting proof"}</strong></div>
        <div className="ship-validation-row"><span>Abnormal partner behaviour</span><strong>{proof?.abnormalBehavior.observed?"Caught":"Not observed"}</strong></div>
        <div className="ship-validation-row"><span>Response ladder</span><strong>ALLOW · OBSERVE · CONSTRAIN · ISOLATE</strong></div>
      </section>
      <aside>
        <FlaskConical size={22}/><h3>Commerce Lab</h3><p>Run the controlled managed-boundary proof without changing verifier authority.</p>
        <button className="ship-orange-action" onClick={onRunProof} disabled={running}><Play size={13}/>{running?"Running…":"Run scope proof"}</button>
        <a href="/commerce-lab/control">Open all lab controls <ArrowRight size={13}/></a>
      </aside>
    </div>
  </ListWorkspace>;
}

function ListWorkspace({eyebrow,title,copy,children}:{eyebrow:string;title:string;copy:string;children:React.ReactNode}){
  return <div className="ship-list-workspace"><header><span>{eyebrow}</span><h1>{title}</h1><p>{copy}</p></header>{children}</div>;
}

function eventMatchesRow(event:ConsoleEvent,row:ExposureRow){
  if(row.integrationId&&event.integrationId===row.integrationId)return true;
  const origin=event.did.value?.destinationOrigin;
  return Boolean(origin&&row.destinations.includes(origin));
}
function rowName(row:ExposureRow){
  return row.vendorIntelligence.profiles[0]?.family??row.vendorIntelligence.profiles[0]?.vendor??row.label;
}
function rowSubtitle(row:ExposureRow){
  const profile=row.vendorIntelligence.profiles[0];
  if(profile)return profile.vendor+" · "+humanize(profile.category);
  return row.integrationId??host(row.destinations[0]??row.label);
}
function rowTone(row:ExposureRow|null){
  if(!row)return "unknown";
  const value=row.latestResponse.toUpperCase();
  if(value==="ALLOW")return "allow";
  if(value==="CONSTRAIN"||value==="PREVENTED")return "constrain";
  if(value==="ISOLATE"||value==="DETECTED")return "isolate";
  if(row.findings.length)return "observe";
  return row.integrationId?"allow":"unknown";
}
function rowStateLabel(row:ExposureRow){
  const tone=rowTone(row);
  if(tone==="allow")return "Normal";
  if(tone==="constrain")return "Constrained";
  if(tone==="isolate")return "Isolated";
  if(tone==="observe")return "Review";
  return "Unresolved";
}
function eventName(event:ConsoleEvent){
  return event.vendorIntelligence.profiles[0]?.family??event.vendorIntelligence.profiles[0]?.vendor??event.integrationId??host(event.did.value?.destinationOrigin??"Unknown integration");
}
function eventOutcome(event:ConsoleEvent){return event.outcome??event.decision??"OBSERVED"}
function eventTone(event:ConsoleEvent|null){
  const value=(event?.outcome??event?.decision??"OBSERVED").toUpperCase();
  if(value==="ALLOW")return "allow";
  if(value==="PREVENTED"||value==="CONSTRAIN")return "constrain";
  if(value==="DETECTED"||value==="ISOLATE")return "isolate";
  if(value==="OBSERVE")return "observe";
  return "unknown";
}
function boundaryLabel(event:ConsoleEvent){return String(event.did.value?.boundary??"OBS").slice(0,7).toUpperCase()}
function eventSummary(event:ConsoleEvent){
  if(event.enforcement?.removedFields.length)return "Removed "+event.enforcement.removedFields.join(", ")+" before transmission";
  if(event.findings[0]?.reason)return event.findings[0].reason;
  if(event.did.value?.destinationOrigin)return host(event.did.value.destinationOrigin)+" · "+(event.did.value?.method??"request");
  return "Persisted evidence record";
}
function responseCopy(event:ConsoleEvent|null,row:ExposureRow|null){
  if(event?.outcome==="PREVENTED")return "ThirdSight stopped the unsupported field before transmission while allowing approved data to continue.";
  if(event?.outcome==="DETECTED")return "ThirdSight detected the mismatch after access. The evidence does not support claiming pre-send prevention.";
  if(event?.decision==="ALLOW")return "The observed access is consistent with the available purpose and business context.";
  if(event?.decision==="OBSERVE")return "Evidence is incomplete or unresolved, so ThirdSight keeps the integration under observation.";
  if(event?.decision==="CONSTRAIN")return "The request exceeded supported scope. ThirdSight narrows the access where enforcement is available.";
  if(event?.decision==="ISOLATE")return "The evidence supports containing future integration access.";
  if(row?.latestResponse==="DISCOVERY")return "This destination is currently discovery evidence only. Missing approval or identity remains unresolved.";
  return "No deterministic response is available for this selection.";
}
function responseTone(value:string){
  const normalized=value.toUpperCase();
  if(normalized==="ALLOW"||normalized==="PROVEN")return "allow";
  if(normalized==="PREVENTED"||normalized==="CONSTRAIN")return "constrain";
  if(normalized==="DETECTED"||normalized==="ISOLATE")return "isolate";
  if(normalized==="OBSERVE"||normalized==="REVIEW")return "observe";
  return "unknown";
}
function isIncident(event:ConsoleEvent){return Boolean(event.outcome||event.findings.length||event.decision==="CONSTRAIN"||event.decision==="ISOLATE")}
function relative(value:string){
  const time=Date.parse(value);if(!Number.isFinite(time))return "—";
  const diff=Math.max(0,Date.now()-time);const minutes=Math.floor(diff/60000);
  if(minutes<1)return "now";if(minutes<60)return minutes+"m";const hours=Math.floor(minutes/60);
  if(hours<24)return hours+"h";return Math.floor(hours/24)+"d";
}
function host(value:string){try{return new URL(value).hostname}catch{return value}}
function humanize(value:string){return value.toLowerCase().replaceAll("_"," ").replace(/(^|\s)\S/g,match=>match.toUpperCase())}
function glyph(value:string){const clean=value.trim();return clean.slice(0,2).toUpperCase()||"?"}
function viewLabel(view:WorkspaceView){return ({home:"Overview",integrations:"Inspector",activity:"Activity",incidents:"Incidents",validation:"Validation"} as const)[view]}
