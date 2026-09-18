import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, CheckCircle2, RefreshCw } from "lucide-react";

type LearningLabel="REVIEW"|"OBSERVE"|"ABSTAIN";

type Metrics={
  cases:number;
  accuracy:number;
  reviewRecall:number;
  benignFalseReviewRate:number;
  authorityViolations:number;
  harmfulResponseRate:number;
};

type PublicRun={
  runId:string;
  modelVersion:string;
  algorithm:string;
  trainingExamples:number;
  humanVerifiedExamples:number;
  benchmarkId:string;
  baselineMetrics:Metrics;
  candidateMetrics:Metrics;
  promoted:boolean;
  promotionReason:string;
  createdAt:string;
};

type LearningStatus={
  ok:boolean;
  benchmark:string;
  verifiedExamples:number;
  latestRun:PublicRun|null;
  activePromotion:PublicRun|null;
  record:{
    recordId:string|null;
    eligible:boolean;
    feedback:null|{
      feedbackId:string;
      recordId:string;
      label:LearningLabel;
      createdAt:string;
    };
    activePrediction:LearningLabel|null;
  };
};

export function LearningLoopPanel({recordId}:{recordId:string}){
  const [status,setStatus]=useState<LearningStatus|null>(null);
  const [busy,setBusy]=useState<"review"|"train"|null>(null);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    try{
      const response=await fetch(`/api/learning?recordId=${encodeURIComponent(recordId)}`,{cache:"no-store"});
      if(!response.ok)throw new Error("Learning status unavailable");
      const next=await response.json() as LearningStatus;
      setStatus(next);
      setError("");
    }catch{
      setError("Learning loop unavailable");
    }
  },[recordId]);

  useEffect(()=>{
    setNotice("");
    void load();
  },[load]);

  if(error&&!status) return null;
  if(!status?.record.eligible) return null;

  const review=async(label:LearningLabel)=>{
    setBusy("review");
    setNotice("");
    try{
      const response=await fetch("/api/learning",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"review",recordId,label}),
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body?.reason??body?.error??"Review failed");
      setNotice(body.inserted?"Verified example appended.":"Existing verified outcome preserved.");
      await load();
    }catch(err){
      setNotice(err instanceof Error?err.message:"Review failed");
    }finally{
      setBusy(null);
    }
  };

  const train=async()=>{
    setBusy("train");
    setNotice("");
    try{
      const response=await fetch("/api/learning",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"train"}),
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body?.message??body?.error??"Training failed");
      setNotice(body.reused?"No new labels — existing candidate reused.":body.run?.promoted?"Candidate passed the promotion gate.":"Candidate trained but did not clear the gate.");
      await load();
    }catch(err){
      setNotice(err instanceof Error?err.message:"Training failed");
    }finally{
      setBusy(null);
    }
  };

  const latest=status.latestRun;
  const active=status.activePromotion;
  const feedback=status.record.feedback;

  return <section className="learning-panel">
    <div className="learning-head">
      <div>
        <span className="eyebrow">Verified learning loop · advisory only</span>
        <h2>{status.record.activePrediction?<>Learned advisory: <b>{status.record.activePrediction}</b></>:"Human review → candidate → frozen gate"}</h2>
      </div>
      <span className={"learning-badge "+(active?"promoted":"idle")}>{active?"PROMOTED MODEL":"NO ACTIVE LEARNED MODEL"}</span>
    </div>

    <p>ThirdSight can learn from a confirmed outcome, but it never rewrites evidence or enforcement. A new classifier is trained off the live decision path and only becomes active after passing the frozen <code>{status.benchmark}</code> benchmark.</p>

    <div className="learning-flow">
      <div className={feedback?"done":""}><span>01</span><b>Verify outcome</b><small>{feedback?feedback.label:"human label required"}</small></div>
      <div className={latest?"done":""}><span>02</span><b>Train candidate</b><small>{latest?latest.modelVersion:"not trained"}</small></div>
      <div className={latest?.promoted?"done":""}><span>03</span><b>Promotion gate</b><small>{latest?(latest.promoted?"passed":"rejected"):"waiting"}</small></div>
    </div>

    <div className="learning-review">
      <div>
        <span>Confirmed outcome for this ambiguous record</span>
        <small>One immutable label per evidence record. Stored features are PII-minimized.</small>
      </div>
      <div className="learning-buttons">
        {(["REVIEW","OBSERVE","ABSTAIN"] as const).map((label)=><button
          key={label}
          disabled={Boolean(feedback)||busy!==null}
          className={feedback?.label===label?"selected":""}
          onClick={()=>void review(label)}
        >{feedback?.label===label?<CheckCircle2 size={13}/>:null}{label}</button>)}
      </div>
    </div>

    {latest?<div className="learning-metrics">
      <Metric label="Held-out accuracy" before={latest.baselineMetrics.accuracy} after={latest.candidateMetrics.accuracy}/>
      <Metric label="Review recall" before={latest.baselineMetrics.reviewRecall} after={latest.candidateMetrics.reviewRecall}/>
      <Metric label="Benign false review" before={latest.baselineMetrics.benignFalseReviewRate} after={latest.candidateMetrics.benignFalseReviewRate} inverse/>
      <div><span>Authority violations</span><strong>{latest.candidateMetrics.authorityViolations}</strong><small>harmful responses {latest.candidateMetrics.harmfulResponseRate}</small></div>
    </div>:<div className="learning-ready"><BrainCircuit size={17}/><span><b>180 synthetic seed examples ready</b><small>96 frozen held-out cases remain outside training.</small></span></div>}

    <div className="learning-footer">
      <div><span>Human-verified examples</span><b>{status.verifiedExamples}</b>{latest?<small>{latest.trainingExamples} total weighted training rows</small>:null}</div>
      <button disabled={busy!==null||status.verifiedExamples===0} onClick={()=>void train()}>
        <RefreshCw size={13} className={busy==="train"?"spin":""}/>
        {busy==="train"?"Training candidate…":"Train candidate"}
      </button>
    </div>

    {notice?<div className="learning-notice">{notice}</div>:null}
    {active?<small className="learning-boundary">Active: {active.modelVersion}. Predictions remain REVIEW / OBSERVE / ABSTAIN only; deterministic CONSTRAIN / ISOLATE authority is unchanged.</small>:null}
  </section>;
}

function Metric({label,before,after,inverse=false}:{label:string;before:number;after:number;inverse?:boolean}){
  const improved=inverse?after<=before:after>=before;
  return <div><span>{label}</span><strong>{pct(after)}</strong><small>{pct(before)} baseline · {improved?"gate-safe":"regressed"}</small></div>;
}

function pct(value:number){return `${(value*100).toFixed(value===0||value===1?0:1)}%`;}
