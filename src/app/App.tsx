import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  CircleCheck,
  Code2,
  Database,
  Eye,
  Globe2,
  Network,
  Search,
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

const V4_CSS="\n.ts-v4-app{min-height:100vh;background:#f7f6f2;color:#121714}\n.ts-v4-topbar{height:68px;display:grid;grid-template-columns:220px 1fr 220px;align-items:center;padding:0 34px;border-bottom:1px solid #d3d5cf;background:#f7f6f2}\n.ts-v4-brand{border:0;background:transparent;color:#121714;padding:0;text-align:left;font-size:20px;font-weight:760;letter-spacing:-.035em;cursor:pointer}\n.ts-v4-nav{display:flex;justify-content:center;gap:28px}.ts-v4-nav button{padding:24px 0 20px;border:0;border-bottom:2px solid transparent;background:transparent;color:#6a736d;font-size:14px;cursor:pointer}\n.ts-v4-nav button.active{color:#121714;border-bottom-color:#121714;font-weight:700}.ts-v4-context{text-align:right;font-size:13px;color:#687069}.ts-v4-context b{color:#121714;font-weight:700}\n.ts-v4-main{max-width:1480px;width:100%;margin:0 auto;padding:28px 40px 42px}\n.ts-boundary-page{--paper:#f7f6f2;--ink:#121714;--muted:#687069;--line:#d3d5cf;--faint:#e8e7e2;--alert:#b9491f;--ok:#285d3d;color:var(--ink)}\n.ts-demo-strip{display:flex;gap:22px;align-items:center;padding-bottom:20px;border-bottom:1px solid var(--line);font-size:14px;overflow:auto}.ts-demo-strip button{border:0;background:transparent;padding:0 0 8px;color:#778079;white-space:nowrap;cursor:pointer}.ts-demo-strip button.active{color:var(--ink);font-weight:750;border-bottom:2px solid var(--ink)}.ts-demo-strip span{margin-left:auto;color:#7c857f;white-space:nowrap}\n.ts-boundary-hero{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:42px;align-items:end;padding:26px 0 28px;border-bottom:1px solid var(--line)}.ts-boundary-hero h1{margin:0;max-width:920px;font-size:54px;line-height:.98;letter-spacing:-.058em;font-weight:760}.ts-boundary-hero p{margin:12px 0 0;max-width:760px;font-size:17px;line-height:1.55;color:var(--muted)}\n.ts-boundary-verdict{text-align:right}.ts-boundary-verdict strong{display:block;font-size:28px;letter-spacing:-.04em;color:var(--alert)}.ts-boundary-verdict span{display:block;margin-top:8px;font-size:14px;line-height:1.4;color:var(--muted)}\n.ts-map-wrap{padding:24px 0 0}.ts-map-title{display:grid;grid-template-columns:260px 1fr 320px;align-items:end;padding:0 0 12px;font-size:14px;color:#535d56;font-weight:700}.ts-map-title div:nth-child(2){text-align:center}.ts-map-title div:nth-child(3){text-align:right}\n.ts-boundary-map{position:relative;display:grid;grid-template-columns:260px 1fr 320px;min-height:500px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.ts-map-left,.ts-map-right{position:relative;z-index:2;padding:24px 0}.ts-map-left{border-right:1px solid var(--line)}.ts-map-right{border-left:1px solid var(--line);padding-left:28px}\n.ts-field-group{padding:0 22px 18px 0;margin-bottom:18px;border-bottom:1px solid var(--faint)}.ts-field-group:last-child{border-bottom:0;margin-bottom:0}.ts-field-group h3{margin:0 0 10px;font-size:15px;letter-spacing:-.015em}\n.ts-map-field{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:10px 0;font-size:14px}.ts-map-field code{font:700 14px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}.ts-map-field span{color:#7a837d;font-size:13px}.ts-map-field.bad code{color:var(--alert)}\n.ts-map-center{position:relative;overflow:hidden}.ts-contract-line{position:absolute;left:50%;top:0;bottom:0;width:2px;background:var(--ink)}.ts-contract-name{position:absolute;left:50%;top:18px;transform:translateX(-50%);padding:0 12px;background:var(--paper);font-size:15px;font-weight:760;white-space:nowrap}.ts-contract-fields{position:absolute;left:50%;top:46px;transform:translateX(-50%);padding:0 10px;background:var(--paper);font-size:13px;color:var(--muted);white-space:nowrap}\n.ts-map-center svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.ts-path{fill:none;stroke:#32453a;stroke-width:2.4}.ts-path.bad{stroke:var(--alert);stroke-width:4}.ts-path-label{font:700 13px Inter,system-ui,sans-serif;fill:#4b5750}.ts-path-label.bad{fill:var(--alert)}.ts-stop{fill:var(--paper);stroke:var(--alert);stroke-width:3}.ts-stop-x{stroke:var(--alert);stroke-width:3}\n.ts-map-integration{padding:0 0 20px;margin-bottom:18px;border-bottom:1px solid var(--faint)}.ts-map-integration:last-child{border-bottom:0}.ts-map-integration>strong{display:block;font-size:18px;letter-spacing:-.025em}.ts-map-integration .purpose{display:block;margin-top:6px;font-size:14px;color:var(--muted)}\n.ts-receiver{margin-top:14px;display:grid;gap:8px}.ts-receiver div{display:flex;justify-content:space-between;gap:16px;font-size:14px}.ts-receiver span{color:#6f7972}.ts-receiver b{font-weight:700}.ts-receiver .blocked b{color:var(--alert)}.ts-receiver .ok b{color:var(--ok)}\n.ts-map-evidence{margin-top:14px;padding:8px 10px;border:1px solid #121714;border-radius:4px;background:#121714;color:#fff;font-size:13px;font-weight:700;cursor:pointer}\n.ts-boundary-after{display:grid;grid-template-columns:1fr 1fr;gap:34px;padding-top:26px}.ts-boundary-section{border-top:1px solid var(--line);padding-top:16px}.ts-boundary-section h2{margin:0 0 14px;font-size:20px;letter-spacing:-.025em}\n.ts-reason{display:grid;grid-template-columns:180px 1fr;gap:14px;padding:12px 0;border-top:1px solid var(--faint);font-size:14px}.ts-reason:first-of-type{border-top:0}.ts-reason span{color:var(--muted)}.ts-reason b{font-weight:700}\n.ts-proof-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid var(--faint)}.ts-proof-grid div{padding:14px 0;border-bottom:1px solid var(--faint)}.ts-proof-grid div:nth-child(odd){padding-right:20px}.ts-proof-grid div:nth-child(even){padding-left:20px;border-left:1px solid var(--faint)}.ts-proof-grid span,.ts-proof-grid b{display:block}.ts-proof-grid span{font-size:13px;color:var(--muted)}.ts-proof-grid b{margin-top:5px;font-size:15px;line-height:1.35}\n.ts-boundary-note{margin-top:14px;font-size:14px;line-height:1.5;color:var(--muted)}\n.ts-scenario-sheet{padding-top:30px}.ts-scenario-head{display:grid;grid-template-columns:minmax(0,1fr) 200px;gap:32px;align-items:end;padding-bottom:28px;border-bottom:1px solid var(--line)}.ts-scenario-head h1{margin:0;max-width:900px;font-size:48px;line-height:1;letter-spacing:-.05em}.ts-scenario-head p{margin:12px 0 0;font-size:16px;line-height:1.5;color:var(--muted)}.ts-scenario-head>strong{text-align:right;font-size:27px;color:var(--ok);letter-spacing:-.035em}\n.ts-scenario-facts{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--line)}.ts-scenario-facts>div{padding:18px 16px;border-left:1px solid var(--faint)}.ts-scenario-facts>div:first-child{padding-left:0;border-left:0}.ts-scenario-facts span,.ts-scenario-facts b{display:block}.ts-scenario-facts span{font-size:13px;color:var(--muted)}.ts-scenario-facts b{margin-top:6px;font-size:15px;line-height:1.4}.ts-scenario-actions{display:flex;gap:10px;padding-top:18px}.ts-scenario-actions button{padding:9px 12px;border:1px solid #cfd2cc;border-radius:4px;background:transparent;color:#26312a;font-size:13px;font-weight:700;cursor:pointer}\n@media(max-width:900px){.ts-v4-topbar{grid-template-columns:1fr auto;padding:0 18px}.ts-v4-nav{display:none}.ts-v4-context{font-size:12px}.ts-v4-main{padding:22px 18px 30px}.ts-boundary-hero{grid-template-columns:1fr}.ts-boundary-hero h1{font-size:42px}.ts-boundary-verdict{text-align:left}.ts-map-title{grid-template-columns:150px 1fr 180px}.ts-map-title div:nth-child(2){font-size:0}.ts-map-title div:nth-child(2):after{content:\"Boundary\";font-size:14px}.ts-boundary-map{grid-template-columns:150px 1fr 180px}.ts-field-group{padding-right:12px}.ts-map-right{padding-left:14px}.ts-contract-fields{display:none}.ts-map-field,.ts-map-field code{font-size:13px}.ts-map-integration>strong{font-size:15px}.ts-map-integration .purpose,.ts-receiver div{font-size:12px}.ts-boundary-after{grid-template-columns:1fr}.ts-reason{grid-template-columns:140px 1fr}.ts-scenario-head{grid-template-columns:1fr}.ts-scenario-head>strong{text-align:left}.ts-scenario-facts{grid-template-columns:1fr 1fr}}\n@media(max-width:560px){.ts-v4-topbar{height:58px}.ts-v4-brand{font-size:18px}.ts-v4-context{font-size:11px}.ts-demo-strip{font-size:13px;gap:16px}.ts-demo-strip span{display:none}.ts-boundary-hero{padding-top:20px}.ts-boundary-hero h1{font-size:36px}.ts-boundary-hero p{font-size:15px}.ts-boundary-verdict strong{font-size:24px}.ts-boundary-verdict span{font-size:13px}.ts-map-title{display:none}.ts-boundary-map{display:block;min-height:0;border-top:0}.ts-map-left,.ts-map-right{border:0;padding:18px 0}.ts-map-center{height:260px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.ts-contract-name{font-size:14px}.ts-map-field{padding:8px 0}.ts-boundary-after{padding-top:20px}.ts-reason{grid-template-columns:1fr;gap:4px}.ts-proof-grid{grid-template-columns:1fr}.ts-proof-grid div:nth-child(even){padding-left:0;border-left:0}.ts-proof-grid div:nth-child(odd){padding-right:0}.ts-scenario-head h1{font-size:36px}.ts-scenario-head p{font-size:15px}.ts-scenario-facts{grid-template-columns:1fr}.ts-scenario-facts>div{padding:14px 0;border-left:0;border-top:1px solid var(--faint)}.ts-scenario-facts>div:first-child{border-top:0}}\n";

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


  return <div className="ts-v4-app">
    <style>{V4_CSS}</style>
    <header className="ts-v4-topbar">
      <button className="ts-v4-brand" onClick={()=>setView("overview")}>ThirdSight</button>
      <nav className="ts-v4-nav" aria-label="Primary">
        <button className={view==="overview"?"active":""} onClick={()=>setView("overview")}>Boundary</button>
        <button className={view==="integrations"?"active":""} onClick={()=>setView("integrations")}>Integrations</button>
        <button className={view==="activity"||view==="incidents"?"active":""} onClick={()=>setView("activity")}>Evidence</button>
        <button className={view==="validation"?"active":""} onClick={()=>setView("validation")}>Validation</button>
      </nav>
      <div className="ts-v4-context"><b>Commerce Lab</b><span> · simulation</span></div>
    </header>

    <main className="ts-v4-main">
      {error?<div className="ts-error"><AlertTriangle size={16}/><div><strong>Evidence feed unavailable.</strong><span>ThirdSight will not substitute mock data.</span></div></div>:null}

      {view==="overview"?<Overview events={events} proof={challengeProof} onOpenEvent={openEvent} onViewIntegrations={()=>setView("integrations")}/>:null}
      {view==="integrations"?<Integrations rows={filteredExposure} query={query} onQuery={setQuery} onOpen={openRow}/>:null}
      {view==="activity"?<ActivityView events={events} onOpen={openEvent}/>:null}
      {view==="incidents"?<IncidentView events={events} onOpen={openEvent}/>:null}
      {view==="policies"?<Policies rows={registered} events={events} onOpen={openRow}/>:null}
      {view==="connections"?<Connections rows={exposureMap} proof={challengeProof}/>:null}
      {view==="validation"?<Validation rows={exposureMap} proof={challengeProof}/>:null}
    </main>

    {detailOpen&&selectedEvent?<EvidenceDrawer event={selectedEvent} aiPromoted={aiPromoted} onClose={()=>setDetailOpen(false)}/>:null}
  </div>;
}


function Overview({
  events,
  proof,
  onOpenEvent,
  onViewIntegrations,
}:{
  events:readonly ConsoleEvent[];
  proof:ChallengeProof|null;
  onOpenEvent:(index:number)=>void;
  onViewIntegrations:()=>void;
}){
  const [scenario,setScenario]=useState<"normal"|"scope"|"busy"|"abuse"|"shadow">("scope");
  const scopeEvent=(proof?.scopePrevention.recordId
    ?events.find(event=>event.recordId===proof.scopePrevention.recordId)
    :undefined)??events.find(event=>event.outcome==="PREVENTED"&&Boolean(event.enforcement));
  const normalEvent=events.find(event=>event.decision==="ALLOW"&&!event.recordId.toLowerCase().includes("flash"));
  const abuseEvent=events.find(event=>event.findings.some(finding=>finding.type==="PURPOSE_MISMATCH"));
  const shadowEvent=events.find(event=>event.findings.some(finding=>finding.type==="SHADOW_INTEGRATION"));

  const scopeIndex=scopeEvent?events.findIndex(event=>event.recordId===scopeEvent.recordId):-1;
  const approved=(scopeEvent?.should.value?.fields??[]).slice(0,3);
  const removed=scopeEvent?.enforcement?.removedFields??proof?.scopePrevention.removedFields??[];
  const continued=scopeEvent?.enforcement?.continuedFields??approved;
  const received=scopeEvent?.enforcement?.receiver.receivedFields??proof?.scopePrevention.receivedFields??[];
  const blockedField=removed[0]??"unapproved field";
  const purpose=scopeEvent?.should.value?.purpose?humanize(scopeEvent.should.value.purpose):"Approved purpose";
  const integration=scopeEvent?integrationLabel(scopeEvent):"Integration";
  const scopeProven=Boolean(proof?.scopePrevention.proven&&scopeEvent);

  const scenarioTabs=[
    ["normal","Normal traffic"],
    ["scope","Scope violation"],
    ["busy","Busy sale"],
    ["abuse","Proportional abuse"],
    ["shadow","Shadow integration"],
  ] as const;

  return <div className="ts-boundary-page">
    <div className="ts-demo-strip">
      {scenarioTabs.map(([id,label])=><button key={id} className={scenario===id?"active":""} onClick={()=>setScenario(id)}>{label}</button>)}
      <span>Controlled judge scenario</span>
    </div>

    {scenario==="scope"?<>
      <section className="ts-boundary-hero">
        <div>
          <h1>{scopeProven?`${integration} tried to take ${fieldPhrase(blockedField)}.`:"Scope-prevention proof is not available yet."}</h1>
          <p>{scopeProven
            ?`The contract allows ${purpose.toLowerCase()} data only. ThirdSight removed ${fieldShort(blockedField)} and let approved fields continue.`
            :"ThirdSight will not manufacture a prevention story without persisted enforcement evidence."}</p>
        </div>
        <div className="ts-boundary-verdict">
          <strong>{scopeProven?"Prevented":"Unproven"}</strong>
          <span>{scopeProven?`${blockedField} never reached ${integration}`:"No persisted pre-send prevention record"}</span>
        </div>
      </section>

      {scopeProven?<section className="ts-map-wrap">
        <div className="ts-map-title"><div>Store data</div><div>Purpose contract</div><div>{integration}</div></div>
        <div className="ts-boundary-map">
          <div className="ts-map-left">
            <div className="ts-field-group">
              <h3>Approved</h3>
              {approved.map(field=><div className="ts-map-field" key={field}><code>{field}</code><span>approved</span></div>)}
            </div>
            <div className="ts-field-group">
              <h3>Outside contract</h3>
              {removed.map(field=><div className="ts-map-field bad" key={field}><code>{field}</code><span>not approved</span></div>)}
            </div>
          </div>

          <div className="ts-map-center">
            <div className="ts-contract-line"/>
            <div className="ts-contract-name">{purpose}</div>
            <div className="ts-contract-fields">{approved.join(" · ")}</div>
            <svg viewBox="0 0 760 500" preserveAspectRatio="none" aria-hidden="true">
              <path className="ts-path" d="M0 94 C185 94 520 94 760 94"/>
              <path className="ts-path" d="M0 150 C185 150 520 150 760 150"/>
              <path className="ts-path" d="M0 206 C185 206 520 206 760 206"/>
              <path className="ts-path bad" d="M0 360 C150 360 265 360 374 360"/>
              <circle className="ts-stop" cx="380" cy="360" r="14"/>
              <path className="ts-stop-x" d="M372 352 L388 368 M388 352 L372 368"/>
              <text className="ts-path-label" x="520" y="88">continued</text>
              <text className="ts-path-label" x="520" y="144">continued</text>
              <text className="ts-path-label" x="520" y="200">continued</text>
              <text className="ts-path-label bad" x="414" y="352">removed here</text>
            </svg>
          </div>

          <div className="ts-map-right">
            <div className="ts-map-integration">
              <strong>{integration}</strong>
              <span className="purpose">Purpose: {purpose.toLowerCase()}</span>
              <div className="ts-receiver">
                {continued.slice(0,3).map(field=><div className="ok" key={field}><span>{field}</span><b>{received.includes(field)?"received":"continued"}</b></div>)}
                {removed.map(field=><div className="blocked" key={field}><span>{field}</span><b>{received.includes(field)?"received":"not received"}</b></div>)}
              </div>
            </div>
            <div className="ts-map-integration">
              <strong>Response</strong>
              <span className="purpose">Constrain only the field outside the contract.</span>
              {scopeIndex>=0?<button className="ts-map-evidence" onClick={()=>onOpenEvent(scopeIndex)}>Open evidence</button>:null}
            </div>
          </div>
        </div>
      </section>:null}

      <div className="ts-boundary-after">
        <section className="ts-boundary-section">
          <h2>Why it was stopped</h2>
          <div className="ts-reason"><span>Approved purpose</span><b>{purpose}</b></div>
          <div className="ts-reason"><span>Observed access</span><b>{blockedField}</b></div>
          <div className="ts-reason"><span>Finding</span><b>{scopeEvent?.findings[0]?humanize(scopeEvent.findings[0].type):"Scope drift"}</b></div>
          <div className="ts-reason"><span>Response</span><b>Constrain the unapproved field</b></div>
        </section>

        <section className="ts-boundary-section">
          <h2>Proof</h2>
          <div className="ts-proof-grid">
            <div><span>Legitimate fields</span><b>{continued.length>0?"continued":"not recorded"}</b></div>
            <div><span>{fieldShort(blockedField)}</span><b>{removed.length>0?"removed before send":"not recorded"}</b></div>
            <div><span>Receiver evidence</span><b>{proof?.scopePrevention.forbiddenFieldReceived===false?"forbidden field absent":"not proven"}</b></div>
            <div><span>Outcome</span><b>{scopeEvent?.outcome??"UNPROVEN"}</b></div>
          </div>
          <p className="ts-boundary-note">Public browser discovery stays separate. It can prove a request happened, but not merchant intent, backend access, downstream receipt, or maliciousness.</p>
        </section>
      </div>
    </>:<ScenarioSummary scenario={scenario} normalEvent={normalEvent} abuseEvent={abuseEvent} shadowEvent={shadowEvent} proof={proof} onOpenEvent={onOpenEvent} events={events} onViewIntegrations={onViewIntegrations}/>}
  </div>;
}

function ScenarioSummary({
  scenario,
  normalEvent,
  abuseEvent,
  shadowEvent,
  proof,
  onOpenEvent,
  events,
  onViewIntegrations,
}:{
  scenario:"normal"|"busy"|"abuse"|"shadow";
  normalEvent:ConsoleEvent|undefined;
  abuseEvent:ConsoleEvent|undefined;
  shadowEvent:ConsoleEvent|undefined;
  proof:ChallengeProof|null;
  onOpenEvent:(index:number)=>void;
  events:readonly ConsoleEvent[];
  onViewIntegrations:()=>void;
}){
  const event=scenario==="normal"?normalEvent:scenario==="abuse"?abuseEvent:scenario==="shadow"?shadowEvent:undefined;
  const index=event?events.findIndex(item=>item.recordId===event.recordId):-1;
  const busy=proof?.busySale;

  const title=scenario==="normal"
    ?"Normal integration traffic stayed inside its contract."
    :scenario==="busy"
      ?"Busy-sale traffic did not trigger a false alarm."
      :scenario==="abuse"
        ?"Plausible volume. Wrong business context."
        :"An integration appeared with no merchant rule.";

  const verdict=scenario==="normal"
    ?"Allowed"
    :scenario==="busy"
      ?busy?.passed?"Allowed":"Not proven"
      :scenario==="abuse"
        ?proof?.abnormalBehavior.observed?"Detected":"Not proven"
        :"Review";

  const detail=scenario==="busy"
    ?busy&&busy.observed>0?`${busy.allowed}/${busy.observed} legitimate events allowed · ${busy.falseAlarms} false alarms.`:"No persisted busy-sale proof."
    :event?eventSummary(event):"No persisted evidence for this scenario.";

  return <section className="ts-scenario-sheet">
    <div className="ts-scenario-head">
      <div><h1>{title}</h1><p>{detail}</p></div>
      <strong>{verdict}</strong>
    </div>
    <div className="ts-scenario-facts">
      {event?<>
        <div><span>Approved</span><b>{event.should.value?.purpose?humanize(event.should.value.purpose):"Not provided"}</b></div>
        <div><span>Observed</span><b>{didSummary(event)}</b></div>
        <div><span>Business context</span><b>{event.why.value?.eventType?humanize(event.why.value.eventType):"Not provided"}</b></div>
        <div><span>Decision</span><b>{humanize(event.outcome??event.decision??"OBSERVE")}</b></div>
      </>:scenario==="busy"&&busy?<>
        <div><span>Observed</span><b>{busy.observed}</b></div>
        <div><span>Allowed</span><b>{busy.allowed}</b></div>
        <div><span>False alarms</span><b>{busy.falseAlarms}</b></div>
        <div><span>Result</span><b>{busy.passed?"Passed":"Not proven"}</b></div>
      </>:null}
    </div>
    <div className="ts-scenario-actions">
      {index>=0?<button onClick={()=>onOpenEvent(index)}>Open evidence</button>:null}
      <button onClick={onViewIntegrations}>View integrations</button>
    </div>
  </section>;
}

function fieldShort(field:string){
  if(field==="unapproved field")return field;
  return field.split(".").at(-1)??field;
}

function fieldPhrase(field:string){
  if(field.toLowerCase().endsWith(".phone"))return "a customer phone number";
  if(field==="unapproved field")return "an unapproved field";
  return field.replaceAll("."," ");
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
