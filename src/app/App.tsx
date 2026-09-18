import { useEffect, useState } from "react";
import { Activity, CircleAlert, Radio, ShieldCheck } from "lucide-react";
import type { EvidenceClaim, PurposeEvidence, BrowserCapabilityLowerBound, RuntimeAccessEvidence, BusinessContextEvidence } from "../domain/evidence";

type Finding={type:string;action:string;field?:string;reason?:string};
type Enforcement={action:"CONSTRAIN"|"ISOLATE";outcome:"PREVENTED";removedFields:readonly string[];continuedFields:readonly string[];receiver:{receivedFields:readonly string[];forbiddenFieldReceived:boolean}};
type ConsoleEvent={recordId:string;observedAt:string;integrationId:string|null;integrationResolution:string;should:EvidenceClaim<PurposeEvidence>;could:EvidenceClaim<BrowserCapabilityLowerBound>;did:EvidenceClaim<RuntimeAccessEvidence>;why:EvidenceClaim<BusinessContextEvidence>;findings:readonly Finding[];enforcement:Enforcement|null;outcome:"PREVENTED"|"DETECTED"|null};

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

  return <div className="console-shell">
    <aside>
      <div className="brand"><span className="brandmark"><ShieldCheck size={19}/></span><div><strong>ThirdSight</strong><small>Evidence console</small></div></div>
      <nav><span>LIVE EVIDENCE</span>{events.map((item,index)=><button className={index===selected?"active":""} onClick={()=>setSelected(index)} key={item.recordId}><Activity size={14}/><div><strong>{item.integrationId??"Unresolved integration"}</strong><small>{item.outcome??"NO OUTCOME"} · {new Date(item.observedAt).toLocaleTimeString()}</small></div></button>)}</nav>
    </aside>
    <main>
      <header><div><span className="eyebrow">Continuous access verification</span><h1>What happened, and what can we prove?</h1><p>Every answer below comes from persisted ThirdSight evidence. Unknown stays unknown.</p></div><span className="live"><Radio size={14}/> Live</span></header>
      {error?<Empty text="Live evidence is unavailable. ThirdSight will not substitute mock data."/>:!event?<Empty text="Waiting for persisted evidence. No demonstration cards are generated."/>:<>
        <section className="event-head"><div><span className="eyebrow">Evidence record</span><strong>{event.integrationId??"Identity unresolved"}</strong><small>{event.recordId}</small></div><Outcome value={event.outcome}/></section>
        <section className="questions"><Claim title="Should?" claim={event.should}/><Claim title="Could?" claim={event.could}/><Claim title="Did?" claim={event.did}/><Claim title="Why?" claim={event.why}/></section>
        <ActionPanel event={event}/>
      </>}
    </main>
  </div>;
}

function Claim({title,claim}:{title:string;claim:EvidenceClaim<unknown>}){
  return <article className="claim"><div><span className="question">{title}</span><span className={"status "+claim.status.toLowerCase()}>{claim.status}</span></div><pre>{claim.value?JSON.stringify(claim.value,null,2):"Unknown"}</pre><p>{claim.reason??"Evidence recorded without an explanatory note."}</p><footer><b>{claim.confidence}</b><span>{claim.provenance.map(p=>p.source).join(" · ")||"no provenance"}</span></footer></article>;
}

function ActionPanel({event}:{event:ConsoleEvent}){
  return <section className="action"><span className="eyebrow">What ThirdSight actually did</span>
    {event.outcome?<><h2>{event.outcome}</h2><p>{event.outcome==="PREVENTED"?"The managed boundary constrained the unjustified field before transmission.":"The receiver confirmed transmission before ThirdSight recorded the finding. This is detection, not prevention."}</p></>:<><h2>NO ENFORCEMENT OUTCOME RECORDED</h2><p>The stored evidence proves neither prevention nor post-transmission detection, so the console labels neither.</p></>}
    {event.findings.length>0?<div className="action-grid"><div><span>Finding</span><b>{event.findings[0].type}</b></div><div><span>Response</span><b>{event.findings[0].action}</b></div></div>:null}
    {event.enforcement?<div className="proof-grid"><div><span>Removed before send</span><b>{event.enforcement.removedFields.join(", ")||"none"}</b></div><div><span>Continued</span><b>{event.enforcement.continuedFields.join(", ")||"none"}</b></div><div><span>Receiver got</span><b>{event.enforcement.receiver.receivedFields.join(", ")||"none"}</b></div><div><span>customer.phone at receiver</span><b>{event.enforcement.receiver.forbiddenFieldReceived?"YES":"NO"}</b></div></div>:null}
    <div className="meta"><span>Identity <b>{event.integrationResolution}</b></span><span>Observed <b>{new Date(event.observedAt).toLocaleString()}</b></span></div>
  </section>;
}

function Outcome({value}:{value:ConsoleEvent["outcome"]}){return <span className={"outcome "+(value?.toLowerCase()??"unknown")}>{value??"UNRESOLVED OUTCOME"}</span>}
function Empty({text}:{text:string}){return <div className="empty"><CircleAlert/><strong>{text}</strong></div>}
