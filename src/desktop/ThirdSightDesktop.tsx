import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  FileJson2,
  Folder,
  Globe2,
  History,
  Layers3,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import "./ThirdSightDesktop.css";

type EvidenceClaim={value:any;status:string;reason?:string;confidence?:string};
type Finding={type:string;action?:string;field?:string;reason?:string};
type VendorProfile={
  vendor:string;family:string;category:string;
  expectedPurposes:readonly string[];
  documentedCapabilities:readonly string[];
  documentedDataOrEvents:readonly string[];
};
type VendorIntelligence={status:string;profiles:readonly VendorProfile[];unresolvedOrigins:readonly string[];authorityBoundary:string};
type ConsoleEvent={
  recordId:string;observedAt:string;integrationId:string|null;integrationResolution:string;
  should:EvidenceClaim;could:EvidenceClaim;did:EvidenceClaim;why:EvidenceClaim;
  findings:readonly Finding[];
  enforcement:null|{action:string;outcome:"PREVENTED";removedFields:readonly string[];continuedFields:readonly string[];receiver:{receivedFields:readonly string[];forbiddenFieldReceived:boolean}};
  containment:null|{action:string;credentialId:string;applied:boolean};
  decision:"ALLOW"|"OBSERVE"|"CONSTRAIN"|"ISOLATE"|null;
  outcome:"PREVENTED"|"DETECTED"|null;
  coverage:{label:string;boundaries:readonly string[];limitations:readonly string[]};
  vendorIntelligence:VendorIntelligence;
};
type ExposureRow={
  key:string;integrationId:string|null;label:string;resolution:string;
  approvedFields:readonly string[];canReachFields:readonly string[];attemptedFields:readonly string[];
  receivedFields:readonly string[];preventedFields:readonly string[];
  destinations:readonly string[];findings:readonly string[];boundaries:readonly string[];
  observations:number;lastSeen:string;latestResponse:string;reachSource:string;vendorIntelligence:VendorIntelligence;
};
type ChallengeProof={
  busySale:{observed:number;allowed:number;falseAlarms:number;passed:boolean};
  abnormalBehavior:{persistedFindings:number;findingTypes:readonly string[];observed:boolean};
  gradedResponse:{levels:readonly string[];observedResponses:readonly string[]};
  scopePrevention:{proven:boolean;recordId:string|null;removedFields:readonly string[];receivedFields:readonly string[];forbiddenFieldReceived:boolean|null};
};
type ApiPayload={productThesis?:string;exposureMap?:ExposureRow[];history?:ConsoleEvent[];challengeProof?:ChallengeProof};
type InspectorTab="purpose"|"capability"|"observed"|"context"|"history";
type ResponseTab="summary"|"evidence"|"raw";

export default function ThirdSightDesktop(){
  const [payload,setPayload]=useState<ApiPayload>({});
  const [query,setQuery]=useState("");
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [selectedRecord,setSelectedRecord]=useState<string|null>(null);
  const [openTabs,setOpenTabs]=useState<string[]>([]);
  const [tab,setTab]=useState<InspectorTab>("observed");
  const [responseTab,setResponseTab]=useState<ResponseTab>("summary");
  const [running,setRunning]=useState(false);
  const [error,setError]=useState(false);

  const load=async()=>{
    try{
      const response=await fetch("/api/console-events",{cache:"no-store"});
      if(!response.ok)throw new Error("feed");
      const body=await response.json() as ApiPayload;
      setPayload(body);
      setError(false);
      const first=body.exposureMap?.[0];
      if(first){
        setSelectedKey(current=>current??first.key);
        setOpenTabs(current=>current.length?current:[first.key]);
      }
      const firstEvent=body.history?.[0];
      if(firstEvent)setSelectedRecord(current=>current??firstEvent.recordId);
    }catch{
      setError(true);
    }
  };

  useEffect(()=>{
    void load();
    const id=window.setInterval(()=>void load(),8000);
    return()=>window.clearInterval(id);
  },[]);

  const exposure=payload.exposureMap??[];
  const history=payload.history??[];
  const normalized=query.trim().toLowerCase();
  const filtered=useMemo(()=>exposure.filter(row=>{
    if(!normalized)return true;
    const profile=row.vendorIntelligence.profiles[0];
    return [rowName(row),row.integrationId??"",...row.destinations,profile?.vendor??"",profile?.category??""].join(" ").toLowerCase().includes(normalized);
  }),[exposure,normalized]);

  const row=exposure.find(item=>item.key===selectedKey)??filtered[0]??exposure[0]??null;
  const rowEvents=row?history.filter(event=>matches(event,row)):[];
  const event=rowEvents.find(item=>item.recordId===selectedRecord)
    ??history.find(item=>item.recordId===selectedRecord)
    ??rowEvents[0]
    ??history[0]
    ??null;

  const chooseRow=(next:ExposureRow)=>{
    setSelectedKey(next.key);
    setOpenTabs(current=>current.includes(next.key)?current:[...current.slice(-3),next.key]);
    const nextEvent=history.find(item=>matches(item,next));
    if(nextEvent)setSelectedRecord(nextEvent.recordId);
  };

  const closeTab=(key:string)=>{
    setOpenTabs(current=>{
      const next=current.filter(item=>item!==key);
      if(selectedKey===key){
        const fallback=next.at(-1)??exposure[0]?.key??null;
        setSelectedKey(fallback);
      }
      return next;
    });
  };

  const runProof=async()=>{
    setRunning(true);
    try{
      const response=await fetch("/api/stage5-proof",{cache:"no-store"});
      if(!response.ok)throw new Error("proof");
      await load();
    }finally{
      setRunning(false);
    }
  };

  return <div className="ts-shippy-app">
    <header className="ts-app-chrome">
      <div className="ts-window-controls"><i/><i/><i/></div>
      <button className="ts-workspace-picker"><span>Commerce Lab</span><ChevronDown size={12}/></button>
      <label className="ts-global-search"><Search size={13}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search"/><kbd>⌘K</kbd></label>
      <div className="ts-chrome-actions">
        <div className="ts-collaborators"><span>D</span><span>A</span><span>R</span></div>
        <button className="ts-team"><span className="ts-team-mark">T</span><b>ThirdSight</b><ChevronDown size={11}/></button>
        <button><Bell size={14}/></button>
        <button><Settings2 size={14}/></button>
        <span className="ts-user-avatar">D</span>
        <small>PRO</small>
      </div>
    </header>

    <div className="ts-app-body">
      <aside className="ts-icon-rail">
        <button className="active"><Folder size={15}/></button>
        <button><Globe2 size={15}/></button>
        <button><Clock3 size={15}/></button>
        <button><Activity size={15}/></button>
      </aside>

      <aside className="ts-collections">
        <div className="ts-collections-label">COLLECTIONS</div>
        <div className="ts-collection-title"><ChevronDown size={11}/><Folder size={13}/><strong>Commerce_Lab</strong><Plus size={12}/></div>
        <div className="ts-collection-list">
          {filtered.map(item=><button key={item.key} className={row?.key===item.key?"active":""} onClick={()=>chooseRow(item)}>
            <span className={"ts-method-chip "+rowTone(item)}>{rowMethod(item)}</span>
            <span>{rowName(item)}</span>
          </button>)}
        </div>
        <button className="ts-import"><Plus size={13}/> Add integration</button>
      </aside>

      <section className="ts-main-workspace">
        <div className="ts-open-tabs">
          {openTabs.map(key=>{
            const item=exposure.find(candidate=>candidate.key===key);
            if(!item)return null;
            return <div key={key} className={row?.key===key?"active":""}>
              <button onClick={()=>chooseRow(item)}><span className={"ts-method-chip "+rowTone(item)}>{rowMethod(item)}</span>{rowName(item)}</button>
              <button className="ts-tab-close" onClick={()=>closeTab(key)}><X size={10}/></button>
            </div>;
          })}
          <button className="ts-new-tab"><Plus size={13}/></button>
          <button className="ts-tab-menu"><ChevronDown size={12}/></button>
          <div className="ts-env-picker"><Globe2 size={12}/><span>Commerce Lab</span><ChevronDown size={11}/></div>
        </div>

        <div className="ts-object-toolbar">
          <div className="ts-breadcrumb"><span>Commerce_Lab</span><span>/</span><strong>{row?rowName(row):"No selection"}</strong></div>
          <button><MoreHorizontal size={15}/></button>
        </div>

        <div className="ts-request-row">
          <button className="ts-boundary-select"><span className={"ts-method-chip large "+(row?rowTone(row):"unknown")}>{row?rowMethod(row):"OBS"}</span><ChevronDown size={11}/></button>
          <div className="ts-target-input">
            <code>{row?.destinations[0]??"Select an integration"}</code>
            {event?.did.value?.destinationPath?<span>{event.did.value.destinationPath}</span>:null}
          </div>
          <button className="ts-run-button" onClick={runProof} disabled={running}><ShieldCheck size={15}/>{running?"Running":"Verify"}</button>
        </div>

        <div className="ts-query-preview">
          <span>{event?.did.value?.method??"OBSERVE"}</span>
          <code>{event?.integrationId??row?.integrationId??"unregistered"}</code>
          <small>{relative(event?.observedAt??row?.lastSeen??"")}</small>
        </div>

        <div className="ts-inspector-tabs">
          {([
            ["purpose","Purpose",event?.should],
            ["capability","Capability",event?.could],
            ["observed","Observed",event?.did],
            ["context","Context",event?.why],
            ["history","History",null],
          ] as const).map(([id,label,claim])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>
            {label}{claim?<span>{claim.status==="KNOWN"?"1":claim.status==="PARTIAL"?"~":"?"}</span>:rowEvents.length?<span>{rowEvents.length}</span>:null}
          </button>)}
        </div>

        <div className="ts-editor-area">
          {tab==="purpose"?<PurposeEditor row={row} event={event}/>:null}
          {tab==="capability"?<CapabilityEditor row={row} event={event}/>:null}
          {tab==="observed"?<ObservedEditor row={row} event={event}/>:null}
          {tab==="context"?<ContextEditor event={event}/>:null}
          {tab==="history"?<HistoryEditor events={rowEvents.length?rowEvents:history} onChoose={setSelectedRecord} selected={event?.recordId??null}/>:null}
        </div>

        <div className="ts-response-pane">
          <div className="ts-response-head">
            <div><strong>Response</strong><span className={"ts-response-code "+responseTone(event,row)}>{responseLabel(event,row)}</span><span>{event?event.findings.length+" findings":"0 findings"}</span><span>{event?.coverage.label??"DISCOVERY"}</span></div>
            <button><Copy size={13}/> Pop Out</button>
          </div>
          <div className="ts-response-tabs">
            <button className={responseTab==="summary"?"active":""} onClick={()=>setResponseTab("summary")}>Body</button>
            <button className={responseTab==="evidence"?"active":""} onClick={()=>setResponseTab("evidence")}>Evidence <span>{event?4:0}</span></button>
            <button className={responseTab==="raw"?"active":""} onClick={()=>setResponseTab("raw")}>Console <span>{event?.findings.length??0}</span></button>
            <div className="ts-response-tools"><button><Search size={12}/> Find</button><button><Terminal size={12}/> cURL</button><button><Copy size={12}/> Copy</button></div>
          </div>
          <div className="ts-response-body">
            {responseTab==="summary"?<ResponseBody row={row} event={event} error={error}/>:null}
            {responseTab==="evidence"?<EvidenceBody event={event}/>:null}
            {responseTab==="raw"?<pre>{JSON.stringify(event??row,null,2)}</pre>:null}
          </div>
        </div>
      </section>
    </div>
  </div>;
}

function PurposeEditor({row,event}:{row:ExposureRow|null;event:ConsoleEvent|null}){
  const profile=row?.vendorIntelligence.profiles[0]??event?.vendorIntelligence.profiles[0]??null;
  const fields=row?.approvedFields??event?.should.value?.allowedFields??[];
  return <EditorTable title="PURPOSE CONTRACT">
    <EditorTableRow enabled label="Merchant approval" value={event?.should.value?.purpose??"Not supplied"} state={event?.should.status??"UNKNOWN"}/>
    <EditorTableRow enabled label="Approved fields" value={fields.length?fields.join(", "):"None registered"} state={fields.length?"KNOWN":"UNKNOWN"}/>
    <EditorTableRow enabled label="Vendor expectation" value={profile?.expectedPurposes[0]??"No documentation match"} state={profile?"PARTIAL":"UNKNOWN"}/>
    <EditorAddRow/>
  </EditorTable>;
}

function CapabilityEditor({row,event}:{row:ExposureRow|null;event:ConsoleEvent|null}){
  const profile=row?.vendorIntelligence.profiles[0]??event?.vendorIntelligence.profiles[0]??null;
  const caps=[...(row?.canReachFields??[]),...(profile?.documentedCapabilities??[])];
  return <EditorTable title="TECHNICAL CAPABILITY">
    <EditorTableRow enabled label="Capability status" value={event?.could.reason??"No complete permission surface proven"} state={event?.could.status??"UNKNOWN"}/>
    {caps.slice(0,5).map((value,index)=><EditorTableRow key={value+index} enabled label={index===0?"Documented reach":""} value={value} state="PARTIAL"/>)}
    <EditorAddRow/>
  </EditorTable>;
}

function ObservedEditor({row,event}:{row:ExposureRow|null;event:ConsoleEvent|null}){
  const fields=[...(event?.did.value?.dataCategories??[]),...(row?.attemptedFields??[])];
  const values=[
    ["Boundary",String(event?.did.value?.boundary??row?.boundaries[0]??"Unknown")],
    ["Method",String(event?.did.value?.method??"Not captured")],
    ["Destination",String(event?.did.value?.destinationOrigin??row?.destinations[0]??"Unknown")],
    ["Data",fields.length?fields.join(", "):"Payload semantics not observed"],
  ];
  return <EditorTable title="OBSERVED ACCESS">
    {values.map(([label,value])=><EditorTableRow key={label} enabled label={label} value={value} state={event?.did.status??"UNKNOWN"}/>)}
    <EditorAddRow/>
  </EditorTable>;
}

function ContextEditor({event}:{event:ConsoleEvent|null}){
  return <EditorTable title="BUSINESS CONTEXT">
    <EditorTableRow enabled label="Trusted event" value={String(event?.why.value?.eventType??event?.why.value?.event?.type??"No correlated business event")} state={event?.why.status??"UNKNOWN"}/>
    <EditorTableRow enabled label="Reason" value={event?.why.reason??"No first-party justification available"} state={event?.why.status??"UNKNOWN"}/>
    <EditorAddRow/>
  </EditorTable>;
}

function HistoryEditor({events,onChoose,selected}:{events:readonly ConsoleEvent[];onChoose:(id:string)=>void;selected:string|null}){
  return <div className="ts-history-table">
    <div className="ts-editor-section-title">EVIDENCE HISTORY</div>
    {events.slice(0,18).map(event=><button key={event.recordId} className={event.recordId===selected?"active":""} onClick={()=>onChoose(event.recordId)}>
      <span className={"ts-method-chip "+eventTone(event)}>{boundary(event)}</span>
      <span>{eventName(event)}</span>
      <small>{responseLabel(event,null)}</small>
      <time>{relative(event.observedAt)}</time>
      <ChevronRight size={12}/>
    </button>)}
  </div>;
}

function EditorTable({title,children}:{title:string;children:React.ReactNode}){
  return <div className="ts-editor-table"><div className="ts-editor-section-title">{title}</div>{children}</div>;
}
function EditorTableRow({enabled,label,value,state}:{enabled:boolean;label:string;value:string;state:string}){
  return <div className="ts-editor-row">
    <span className="ts-check">{enabled?"✓":""}</span>
    <div className="ts-editor-key">{label||"Key"}</div>
    <div className="ts-editor-value">{value}</div>
    <span className={"ts-evidence-state "+state.toLowerCase()}>{state}</span>
  </div>;
}
function EditorAddRow(){return <button className="ts-add-row">+ Add Row</button>}

function ResponseBody({row,event,error}:{row:ExposureRow|null;event:ConsoleEvent|null;error:boolean}){
  if(error)return <div className="ts-response-empty">Evidence feed unavailable. No mock response substituted.</div>;
  const response=responseLabel(event,row);
  const finding=event?.findings[0]??null;
  const body={
    response,
    integration:eventName(event??null,row),
    finding:finding?.type??null,
    removed:event?.enforcement?.removedFields??[],
    continued:event?.enforcement?.continuedFields??[],
    forbiddenFieldReceived:event?.enforcement?.receiver.forbiddenFieldReceived??null,
    coverage:event?.coverage.label??row?.boundaries.join(", ")??"DISCOVERY",
  };
  return <JsonTree value={body}/>;
}
function EvidenceBody({event}:{event:ConsoleEvent|null}){
  if(!event)return <div className="ts-response-empty">No persisted evidence selected.</div>;
  return <JsonTree value={{SHOULD:event.should,COULD:event.could,DID:event.did,WHY:event.why}}/>;
}
function JsonTree({value}:{value:any}){
  return <pre className="ts-json-tree">{JSON.stringify(value,null,2)}</pre>;
}

function rowName(row:ExposureRow){return row.vendorIntelligence.profiles[0]?.family??row.vendorIntelligence.profiles[0]?.vendor??row.label}
function rowMethod(row:ExposureRow){const b=row.boundaries[0]??"OBS";return b==="browser"?"OBS":b==="pre-send"?"PRE":"RUN"}
function rowTone(row:ExposureRow){const v=row.latestResponse.toUpperCase();if(v==="ALLOW")return"allow";if(v==="CONSTRAIN"||v==="PREVENTED")return"constrain";if(v==="ISOLATE"||v==="DETECTED")return"isolate";if(row.findings.length)return"observe";return"unknown"}
function eventTone(event:ConsoleEvent){const v=responseLabel(event,null);if(v==="ALLOW")return"allow";if(v==="CONSTRAIN"||v==="PREVENTED")return"constrain";if(v==="ISOLATE"||v==="DETECTED")return"isolate";if(v==="OBSERVE")return"observe";return"unknown"}
function boundary(event:ConsoleEvent){const b=String(event.did.value?.boundary??"OBS").toUpperCase();return b==="BROWSER"?"OBS":b.includes("PRE")?"PRE":"RUN"}
function matches(event:ConsoleEvent,row:ExposureRow){if(row.integrationId&&event.integrationId===row.integrationId)return true;const origin=event.did.value?.destinationOrigin;return Boolean(origin&&row.destinations.includes(origin))}
function eventName(event:ConsoleEvent|null,row?:ExposureRow|null){return event?.vendorIntelligence.profiles[0]?.family??event?.vendorIntelligence.profiles[0]?.vendor??event?.integrationId??(event?.did.value?.destinationOrigin?host(event.did.value.destinationOrigin):row?rowName(row):"Unknown integration")}
function responseLabel(event:ConsoleEvent|null,row:ExposureRow|null){return event?.outcome??event?.decision??row?.latestResponse??"DISCOVERY"}
function responseTone(event:ConsoleEvent|null,row:ExposureRow|null){const v=responseLabel(event,row);if(v==="ALLOW")return"allow";if(v==="CONSTRAIN"||v==="PREVENTED")return"constrain";if(v==="ISOLATE"||v==="DETECTED")return"isolate";if(v==="OBSERVE")return"observe";return"unknown"}
function relative(value:string){const t=Date.parse(value);if(!Number.isFinite(t))return"—";const d=Math.max(0,Date.now()-t),m=Math.floor(d/60000);if(m<1)return"now";if(m<60)return m+"m";const h=Math.floor(m/60);if(h<24)return h+"h";return Math.floor(h/24)+"d"}
function host(value:string){try{return new URL(value).hostname}catch{return value}}
