import { useEffect, useState } from "react";
import { Activity, CircleAlert, Radio, ShieldCheck } from "lucide-react";
import type { EvidenceClaim, PurposeEvidence, BrowserCapabilityLowerBound, RuntimeAccessEvidence, BusinessContextEvidence, EvidenceCoverage } from "../domain/evidence";

type Finding={type:string;action:string;field?:string;reason?:string};
type Enforcement={action:"CONSTRAIN"|"ISOLATE";outcome:"PREVENTED";removedFields:readonly string[];continuedFields:readonly string[];receiver:{receivedFields:readonly string[];forbiddenFieldReceived:boolean}};
type ConsoleEvent={recordId:string;observedAt:string;integrationId:string|null;integrationResolution:string;should:EvidenceClaim<PurposeEvidence>;could:EvidenceClaim<BrowserCapabilityLowerBound>;did:EvidenceClaim<RuntimeAccessEvidence>;why:EvidenceClaim<BusinessContextEvidence>;coverage:EvidenceCoverage;findings:readonly Finding[];enforcement:Enforcement|null;outcome:"PREVENTED"|"DETECTED"|null};

export default function App(){
  const [events,setEvents]=useState<ConsoleEvent[]>([]);
  const [selected,setSelected]=useState(0);
  const [error,setError]=useState(false);

  useEffect(()=>{
    let live=true;
    const load=()=>fetch("/api/console-events",{cache:"no-store"})
      .then(r=>{if(!r.ok)throw new Error("evidence unavailable");return r.json()})
      .then(d=>{if(!live)return;const history=(d.history??[]) as ConsoleEvent[];setEvents(history);setSelected(current=>current<history.length?current:0);setError(false)})
      .catch(()=>live&&setError(true));
    load();
    const id=window.setInterval(load,5000);
    return()=>{live=false;window.clearInterval(id)};
  },[]);

  const event=events[selected]??events[0];
  const destination=event?.did.value?.destinationOrigin;
  const discoveryOnly=Boolean(event && event.coverage.label==="BROWSER_ONLY" && event.should.status==="UNKNOWN" && event.why.status==="UNKNOWN");

  return <div className="console-shell">
    <aside>
      <div className="brand"><span className="brandmark"><ShieldCheck size={19}/></span><div><strong>ThirdSight</strong><small>Evidence console</small></div></div>
      <nav><span>LIVE EVIDENCE</span>{events.map((item,index)=><button className={index===selected?"active":""} onClick={()=>setSelected(index)} key={item.recordId}><Activity size={14}/><div><strong>{item.integrationId??item.did.value?.destinationOrigin??"Unresolved destination"}</strong><small>{item.outcome??"DISCOVERY"} · {new Date(item.observedAt).toLocaleTimeString()}</small></div></button>)}</nav>
    </aside>
    <main>
      <header><div><span className="eyebrow">Continuous access verification</span><h1>What happened, and what can we prove?</h1><p>Every answer below comes from persisted ThirdSight evidence. Unknown stays unknown.</p></div><span className="live"><Radio size={14}/> Live</span></header>
      {error?<Empty text="Live evidence is unavailable. ThirdSight will not substitute mock data."/>:!event?<Empty text="Waiting for persisted evidence. No demonstration cards are generated."/>:<>
        <section className="event-head"><div><span className="eyebrow">Evidence record</span><strong>{event.integrationId??destination??"Identity unresolved"}</strong><small>{event.recordId}</small></div><Outcome value={event.outcome}/></section>
        {discoveryOnly?<section className="discovery-note"><b>Discovery only — browser visibility</b><span>No merchant Purpose Contract or business justification is available. ThirdSight does not infer backend permissions, server-to-server activity, database access, or downstream vendor behavior from this record.</span></section>:null}
        <section className="questions">
          <Claim title="Should?" claim={event.should} summary={event.should.status==="UNKNOWN"?"Not provided":undefined}/>
          <Claim title="Could?" claim={event.could} summary={event.could.value?.kind==="BROWSER_REQUEST_EXECUTION"?"Partial / browser-visible":undefined}/>
          <Claim title="Did?" claim={event.did} summary={event.did.status==="KNOWN"?"Observed":undefined}/>
          <Claim title="Why?" claim={event.why} summary={event.why.status==="UNKNOWN"?"Not available":undefined}/>
          <Coverage coverage={event.coverage}/>
        </section>
        <ActionPanel event={event} discoveryOnly={discoveryOnly}/>
      </>}
    </main>
  </div>;
}

function Claim({title,claim,summary}:{title:string;claim:EvidenceClaim<unknown>;summary?:string}){
  return <article className="claim"><div><span className="question">{title}</span><span className={"status "+claim.status.toLowerCase()}>{summary??claim.status}</span></div><pre>{claim.value?JSON.stringify(claim.value,null,2):summary??"Unknown"}</pre><p>{claim.reason??"Evidence recorded without an explanatory note."}</p><footer><b>{claim.confidence}</b><span>{claim.provenance.map(p=>p.source).join(" · ")||"no provenance"}</span></footer></article>;
}

function Coverage({coverage}:{coverage:EvidenceCoverage}){
  return <article className="claim coverage-card"><div><span className="question">Coverage</span><span className="status partial">{coverage.label==="BROWSER_ONLY"?"Browser only":"Multi-boundary"}</span></div><pre>{coverage.boundaries.join("\n")||"No active sensor boundary recorded"}</pre><p>{coverage.limitations.join(" ")}</p><footer><b>{coverage.label}</b><span>visibility boundary</span></footer></article>;
}

function ActionPanel({event,discoveryOnly}:{event:ConsoleEvent;discoveryOnly:boolean}){
  if(discoveryOnly) return <section className="action discovery-action"><span className="eyebrow">What ThirdSight actually did</span><h2>DISCOVERED</h2><p>ThirdSight persisted browser-visible request metadata only. This is not a prevention claim and not a judgment about whether the destination is appropriate for the merchant.</p><div className="meta"><span>Coverage <b>Browser only</b></span><span>Observed <b>{new Date(event.observedAt).toLocaleString()}</b></span></div></section>;
  return <section className="action"><span className="eyebrow">What ThirdSight actually did</span>
    {event.outcome?<><h2>{event.outcome}</h2><p>{event.outcome==="PREVENTED"?"The managed boundary constrained the unjustified field before transmission.":"The receiver confirmed transmission before ThirdSight recorded the finding. This is detection, not prevention."}</p></>:<><h2>NO ENFORCEMENT OUTCOME RECORDED</h2><p>The stored evidence proves neither prevention nor post-transmission detection, so the console labels neither.</p></>}
    {event.findings.length>0?<div className="action-grid"><div><span>Finding</span><b>{event.findings[0].type}</b></div><div><span>Response</span><b>{event.findings[0].action}</b></div></div>:null}
    {event.enforcement?<div className="proof-grid"><div><span>Removed before send</span><b>{event.enforcement.removedFields.join(", ")||"none"}</b></div><div><span>Continued</span><b>{event.enforcement.continuedFields.join(", ")||"none"}</b></div><div><span>Receiver got</span><b>{event.enforcement.receiver.receivedFields.join(", ")||"none"}</b></div><div><span>customer.phone at receiver</span><b>{event.enforcement.receiver.forbiddenFieldReceived?"YES":"NO"}</b></div></div>:null}
    <div className="meta"><span>Identity <b>{event.integrationResolution}</b></span><span>Observed <b>{new Date(event.observedAt).toLocaleString()}</b></span></div>
  </section>;
}

function Outcome({value}:{value:ConsoleEvent["outcome"]}){return <span className={"outcome "+(value?.toLowerCase()??"unknown")}>{value??"DISCOVERY"}</span>}
function Empty({text}:{text:string}){return <div className="empty"><CircleAlert/><strong>{text}</strong></div>}
