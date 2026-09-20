import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  Layers3,
  MoreHorizontal,
  PlugZap,
  Radio,
  ShieldCheck,
} from "lucide-react";
import type { ChallengeProof, ExposureRow } from "./IntegrationExposureMap";
import "./OverviewTierOneLab.css";

type Props={
  exposure:readonly ExposureRow[];
  proof:ChallengeProof|null;
};

const variants=["Quiet Ops","Signal Rail","Evidence Map"] as const;

export function OverviewTierOneLab({exposure,proof}:Props){
  const [current,setCurrent]=useState(()=>{
    const raw=Number(new URLSearchParams(window.location.search).get("v")??"1");
    return Number.isInteger(raw)&&raw>=1&&raw<=variants.length?raw-1:0;
  });
  const pickerRef=useRef<HTMLElement|null>(null);
  const itemRefs=useRef<Array<HTMLButtonElement|null>>([]);
  const [ready,setReady]=useState(false);

  const setVariant=(index:number)=>{
    if(index<0||index>=variants.length)return;
    setCurrent(index);
    const url=new URL(window.location.href);
    url.searchParams.set("prototype","tier1");
    url.searchParams.set("v",String(index+1));
    window.history.replaceState(null,"",url);
  };

  useLayoutEffect(()=>{
    const picker=pickerRef.current;
    const item=itemRefs.current[current];
    const highlight=picker?.querySelector<HTMLElement>(".proto-picker-highlight");
    if(!picker||!item||!highlight)return;
    highlight.style.width=`${item.offsetWidth}px`;
    highlight.style.transform=`translateX(${item.offsetLeft}px)`;
  },[current]);

  useEffect(()=>{
    const first=window.requestAnimationFrame(()=>{
      const second=window.requestAnimationFrame(()=>setReady(true));
      return()=>window.cancelAnimationFrame(second);
    });
    return()=>window.cancelAnimationFrame(first);
  },[]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target&&(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.isContentEditable))return;
      if(event.metaKey||event.ctrlKey||event.altKey)return;
      const num=Number.parseInt(event.key,10);
      if(num>=1&&num<=variants.length)setVariant(num-1);
      else if(event.key==="ArrowRight")setVariant((current+1)%variants.length);
      else if(event.key==="ArrowLeft")setVariant((current-1+variants.length)%variants.length);
    };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[current]);

  useEffect(()=>{
    const onResize=()=>setVariant(current);
    window.addEventListener("resize",onResize);
    return()=>window.removeEventListener("resize",onResize);
  },[current]);

  const registered=exposure.filter(row=>Boolean(row.integrationId));
  const findings=exposure.filter(row=>row.findings.length>0);
  const unresolved=exposure.filter(row=>!row.integrationId);
  const review=[
    ...findings,
    ...unresolved.filter(row=>row.findings.length===0),
    ...registered.filter(row=>row.findings.length===0),
  ].slice(0,5);

  const data={exposure,registered,findings,unresolved,review,proof};

  return <div className="tier1-lab">
    <div className="tier1-stage">
      {current===0?<QuietOps {...data}/>:null}
      {current===1?<SignalRail {...data}/>:null}
      {current===2?<EvidenceMap {...data}/>:null}
    </div>

    <nav ref={pickerRef} className="proto-picker" aria-label="Prototype variants" data-position="top" data-ready={ready?"":undefined}>
      <span className="proto-picker-highlight" aria-hidden="true"/>
      {variants.map((name,index)=><button
        key={name}
        ref={node=>{itemRefs.current[index]=node}}
        className="proto-picker-item"
        data-active={index===current?"":undefined}
        aria-current={index===current?"true":undefined}
        onClick={()=>setVariant(index)}
      >{name}</button>)}
    </nav>
  </div>;
}

type VariantProps={
  exposure:readonly ExposureRow[];
  registered:readonly ExposureRow[];
  findings:readonly ExposureRow[];
  unresolved:readonly ExposureRow[];
  review:readonly ExposureRow[];
  proof:ChallengeProof|null;
};

function AppFrame({children,mode}:{children:ReactNode;mode:string}){
  return <div className="tier1-app">
    <header className="tier1-header">
      <div className="tier1-brand">
        <span className="tier1-mark"><ShieldCheck size={17}/></span>
        <div><strong>ThirdSight</strong><small>{mode}</small></div>
      </div>
      <div className="tier1-head-actions">
        <button aria-label="Connect platform"><PlugZap size={16}/></button>
        <button aria-label="More"><MoreHorizontal size={18}/></button>
      </div>
    </header>
    <main>{children}</main>
    <nav className="tier1-bottom-nav" aria-label="Primary">
      <button data-active><Layers3 size={19}/><span>Overview</span></button>
      <button><PlugZap size={19}/><span>Integrations</span></button>
      <button><Activity size={19}/><span>Activity</span></button>
      <button><AlertTriangle size={19}/><span>Incidents</span></button>
    </nav>
  </div>;
}

function QuietOps({exposure,registered,findings,unresolved,review,proof}:VariantProps){
  const clean=findings.length===0;
  return <AppFrame mode="Quiet Ops">
    <section className="quiet-shell">
      <div className="quiet-statusbar">
        <span><i/> Discovery active</span>
        <b>Commerce Lab</b>
      </div>

      <section className="quiet-summary">
        <div>
          <span className="tier1-eyebrow">Current posture</span>
          <h1>{clean?"No policy violation is proven.":`${findings.length} deterministic finding${findings.length===1?"":"s"} need review.`}</h1>
          <p>{exposure.length} third-party destinations observed. {unresolved.length} still lack a registered merchant purpose.</p>
        </div>
        <button className="tier1-primary">Review destinations <ArrowRight size={15}/></button>
      </section>

      <div className="quiet-metrics" aria-label="Current metrics">
        <Metric value={String(exposure.length)} label="Observed" note="third-party origins"/>
        <Metric value={String(registered.length)} label="Purpose-aware" note="merchant context"/>
        <Metric value={String(findings.length)} label="Findings" note={clean?"none proven":"evidence-backed"}/>
        <Metric value={proof?.scopePrevention.proven?"Yes":"—"} label="Pre-send proof" note={proof?.scopePrevention.proven?"field prevented":"not in current view"}/>
      </div>

      <section className="quiet-review">
        <div className="tier1-section-head">
          <div><span className="tier1-eyebrow">Review next</span><h2>Resolve the unknowns first.</h2></div>
          <button>All integrations <ChevronRight size={14}/></button>
        </div>
        <ReviewRows rows={review.slice(0,4)} density="quiet"/>
      </section>
    </section>
  </AppFrame>;
}

function SignalRail({exposure,registered,findings,unresolved,review}:VariantProps){
  const clean=findings.length===0;
  return <AppFrame mode="Signal Rail">
    <section className="rail-shell">
      <div className="rail-hero">
        <div className="rail-score">
          <span className="rail-pulse"><Radio size={14}/> live evidence</span>
          <strong>{exposure.length}</strong>
          <small>destinations observed</small>
        </div>
        <div className="rail-message">
          <span className="tier1-eyebrow">Attention</span>
          <h1>{clean?"Discovery is active. Nothing is proven malicious.":"Deterministic evidence needs attention."}</h1>
          <p>{unresolved.length} destinations remain unresolved. {registered.length} currently carry merchant purpose context.</p>
        </div>
      </div>

      <div className="rail-bar" aria-label="Posture distribution">
        <span style={{"--share":Math.max(8,registered.length/Math.max(1,exposure.length)*100)+"%"} as CSSProperties}><b>{registered.length}</b> purpose-aware</span>
        <span style={{"--share":Math.max(12,unresolved.length/Math.max(1,exposure.length)*100)+"%"} as CSSProperties}><b>{unresolved.length}</b> unresolved</span>
        <span style={{"--share":Math.max(6,findings.length/Math.max(1,exposure.length)*100)+"%"} as CSSProperties}><b>{findings.length}</b> findings</span>
      </div>

      <section className="rail-queue">
        <div className="tier1-section-head">
          <div><span className="tier1-eyebrow">Triage rail</span><h2>Work the highest-uncertainty surfaces.</h2></div>
          <span className="rail-filter">Unresolved first</span>
        </div>
        <ReviewRows rows={review.slice(0,5)} density="rail"/>
      </section>
    </section>
  </AppFrame>;
}

function EvidenceMap({exposure,registered,findings,unresolved,review}:VariantProps){
  const nodes=(review.length?review:exposure).slice(0,4);
  return <AppFrame mode="Evidence Map">
    <section className="map-shell">
      <div className="map-heading">
        <div><span className="tier1-eyebrow">Runtime map</span><h1>See the relationship before reading the evidence.</h1></div>
        <span className="map-legend"><i/> observed now</span>
      </div>

      <div className="map-canvas">
        <div className="map-origin">
          <span className="map-origin-ring"><ShieldCheck size={22}/></span>
          <strong>Your platform</strong>
          <small>Commerce Lab</small>
        </div>
        <div className="map-spine" aria-hidden="true"/>
        <div className="map-nodes">
          {nodes.map((row,index)=><button className="map-node" key={row.key}>
            <span className={"map-node-status "+(row.findings.length?"finding":row.integrationId?"known":"unknown")}/>
            <div><strong>{row.label}</strong><small>{row.findings.length?humanize(row.findings[0]??"finding"):row.integrationId?"purpose-aware":"purpose unresolved"}</small></div>
            <span>{row.observations}</span>
          </button>)}
          {nodes.length===0?<div className="map-empty">Waiting for observed third-party destinations.</div>:null}
        </div>
      </div>

      <div className="map-footer">
        <div>
          <span>Observed</span><strong>{exposure.length}</strong>
        </div>
        <div>
          <span>Purpose-aware</span><strong>{registered.length}</strong>
        </div>
        <div>
          <span>Unresolved</span><strong>{unresolved.length}</strong>
        </div>
        <div>
          <span>Findings</span><strong>{findings.length}</strong>
        </div>
      </div>
    </section>
  </AppFrame>;
}

function Metric({value,label,note}:{value:string;label:string;note:string}){
  return <div className="quiet-metric"><strong>{value}</strong><span>{label}</span><small>{note}</small></div>;
}

function ReviewRows({rows,density}:{rows:readonly ExposureRow[];density:"quiet"|"rail"}){
  if(rows.length===0)return <div className="tier1-empty"><Check size={16}/><span>No unresolved or evidence-backed item is queued.</span></div>;
  return <div className={"tier1-review-rows "+density}>
    {rows.map(row=>{
      const finding=row.findings[0]??null;
      const state=finding?"finding":row.integrationId?"known":"unknown";
      return <button key={row.key}>
        <span className={"tier1-row-icon "+state}>
          {finding?<AlertTriangle size={15}/>:row.integrationId?<Check size={15}/>:<Eye size={15}/>}
        </span>
        <div>
          <strong>{row.label}</strong>
          <span>{finding?humanize(finding):row.integrationId?"Purpose context registered":"Identity / merchant purpose unresolved"}</span>
        </div>
        <small>{row.observations} obs</small>
        <ChevronRight size={15}/>
      </button>;
    })}
  </div>;
}

function humanize(value:string){
  return value.split(/[-_]/g).filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1).toLowerCase()).join(" ");
}
