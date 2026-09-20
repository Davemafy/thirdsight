import { useEffect, useState, type ReactNode } from "react";
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

type VariantData={
  exposure:readonly ExposureRow[];
  registered:readonly ExposureRow[];
  findings:readonly ExposureRow[];
  unresolved:readonly ExposureRow[];
  review:readonly ExposureRow[];
  proof:ChallengeProof|null;
};

const variantNames=["Quiet Ops","Signal Rail","Evidence Map"] as const;

export function OverviewTierOneLab({exposure,proof}:Props){
  const initial=Number(new URLSearchParams(window.location.search).get("v")??"1");
  const [current,setCurrent]=useState(initial>=1&&initial<=3?initial-1:0);

  const choose=(index:number)=>{
    if(index<0||index>2)return;
    setCurrent(index);
    const url=new URL(window.location.href);
    url.searchParams.set("prototype","tier1");
    url.searchParams.set("v",String(index+1));
    window.history.replaceState(null,"",url);
  };

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target&&(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.isContentEditable))return;
      if(event.metaKey||event.ctrlKey||event.altKey)return;
      if(event.key==="1"||event.key==="2"||event.key==="3")choose(Number(event.key)-1);
      if(event.key==="ArrowRight")choose((current+1)%3);
      if(event.key==="ArrowLeft")choose((current+2)%3);
    };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[current]);

  const registered=exposure.filter(row=>Boolean(row.integrationId));
  const findings=exposure.filter(row=>row.findings.length>0);
  const unresolved=exposure.filter(row=>!row.integrationId);
  const review=[
    ...findings,
    ...unresolved.filter(row=>row.findings.length===0),
    ...registered.filter(row=>row.findings.length===0),
  ].slice(0,5);

  const data:VariantData={exposure,registered,findings,unresolved,review,proof};

  return <div className="tier1-lab">
    <div className="tier1-stage">
      {current===0?<QuietOps data={data}/>:null}
      {current===1?<SignalRail data={data}/>:null}
      {current===2?<EvidenceMap data={data}/>:null}
    </div>

    <nav className={"proto-picker proto-v"+current} aria-label="Prototype variants" data-position="top" data-ready>
      <span className="proto-picker-highlight" aria-hidden="true"/>
      {variantNames.map((name,index)=><button
        key={name}
        className="proto-picker-item"
        data-active={index===current?"":undefined}
        aria-current={index===current}
        onClick={()=>choose(index)}
      >{name}</button>)}
    </nav>
  </div>;
}

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

function QuietOps({data}:{data:VariantData}){
  const {exposure,registered,findings,unresolved,review,proof}=data;
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
        <SectionHead eyebrow="Review next" title="Resolve the unknowns first." accessory="All integrations"/>
        <ReviewRows rows={review.slice(0,4)}/>
      </section>
    </section>
  </AppFrame>;
}

function SignalRail({data}:{data:VariantData}){
  const {exposure,registered,findings,unresolved,review}=data;
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
        <span><b>{registered.length}</b> purpose-aware</span>
        <span><b>{unresolved.length}</b> unresolved</span>
        <span><b>{findings.length}</b> findings</span>
      </div>

      <section className="rail-queue">
        <div className="tier1-section-head">
          <div><span className="tier1-eyebrow">Triage rail</span><h2>Work the highest-uncertainty surfaces.</h2></div>
          <span className="rail-filter">Unresolved first</span>
        </div>
        <ReviewRows rows={review}/>
      </section>
    </section>
  </AppFrame>;
}

function EvidenceMap({data}:{data:VariantData}){
  const {exposure,registered,findings,unresolved,review}=data;
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
          {nodes.map(row=>{
            const finding=row.findings[0]??null;
            const state=finding?"finding":row.integrationId?"known":"unknown";
            return <button className="map-node" key={row.key}>
              <span className={"map-node-status "+state}/>
              <div>
                <strong>{row.label}</strong>
                <small>{finding?humanize(finding):row.integrationId?"purpose-aware":"purpose unresolved"}</small>
              </div>
              <span>{row.observations}</span>
            </button>;
          })}
          {nodes.length===0?<div className="map-empty">Waiting for observed third-party destinations.</div>:null}
        </div>
      </div>

      <div className="map-footer">
        <MapMetric label="Observed" value={exposure.length}/>
        <MapMetric label="Purpose-aware" value={registered.length}/>
        <MapMetric label="Unresolved" value={unresolved.length}/>
        <MapMetric label="Findings" value={findings.length}/>
      </div>
    </section>
  </AppFrame>;
}

function SectionHead({eyebrow,title,accessory}:{eyebrow:string;title:string;accessory:string}){
  return <div className="tier1-section-head">
    <div><span className="tier1-eyebrow">{eyebrow}</span><h2>{title}</h2></div>
    <button>{accessory}<ChevronRight size={14}/></button>
  </div>;
}

function Metric({value,label,note}:{value:string;label:string;note:string}){
  return <div className="quiet-metric"><strong>{value}</strong><span>{label}</span><small>{note}</small></div>;
}

function MapMetric({label,value}:{label:string;value:number}){
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function ReviewRows({rows}:{rows:readonly ExposureRow[]}){
  if(rows.length===0)return <div className="tier1-empty"><Check size={16}/><span>No unresolved or evidence-backed item is queued.</span></div>;
  return <div className="tier1-review-rows">
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
