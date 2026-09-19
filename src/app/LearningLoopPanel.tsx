import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

type HumanOutcome="REVIEW"|"OBSERVE"|"ABSTAIN";
type ReviewPriority="HIGH"|"MEDIUM"|"LOW";

type Metrics={
  cases:number;
  priorityAccuracy:number;
  highPriorityRecall:number;
  lowPriorityFalseHighRate:number;
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
    reasons:readonly string[];
    feedback:null|{
      feedbackId:string;
      recordId:string;
      label:HumanOutcome;
      createdAt:string;
    };
    activePrediction:null|{
      priority:ReviewPriority;
      reviewScore:number;
      probabilities:Record<ReviewPriority,number>;
    };
  };
};

export function LearningLoopPanel({
  recordId,
  deterministicResult,
}:{
  recordId:string;
  deterministicResult:string;
}){
  const [status,setStatus]=useState<LearningStatus|null>(null);
  const [busy,setBusy]=useState<"review"|"train"|null>(null);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    try{
      const response=await fetch(`/api/learning?recordId=${encodeURIComponent(recordId)}`,{cache:"no-store"});
      if(!response.ok)throw new Error("Verified Learning status unavailable");
      const next=await response.json() as LearningStatus;
      setStatus(next);
      setError("");
    }catch{
      setError("Verified Learning unavailable");
    }
  },[recordId]);

  useEffect(()=>{
    setNotice("");
    void load();
  },[load]);

  if(error&&!status) return null;
  if(!status?.record.eligible) return null;

  const review=async(label:HumanOutcome)=>{
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
      setNotice(body.inserted?"Verified human outcome appended.":"Existing verified outcome preserved.");
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
      setNotice(
        body.reused
          ?"No new verified outcomes — existing candidate reused."
          :body.run?.promoted
            ?"Candidate passed the frozen promotion gate."
            :"Candidate failed the frozen gate; previous promoted model retained.",
      );
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
  const prediction=status.record.activePrediction;

  return <section className="learning-panel">
    <div className="learning-head">
      <div>
        <span className="eyebrow">Verified Learning</span>
        <h2>{prediction?<>Review priority: <b>{prediction.priority}</b> <small>{prediction.reviewScore}/100</small></>:"Residual uncertainty, queued for human judgment"}</h2>
      </div>
      <span className={"learning-badge "+(active?"promoted":"idle")}>{active?"PROMOTED":"NO ACTIVE PRIORITY MODEL"}</span>
    </div>

    <div className="product-spine" aria-label="ThirdSight decision path">
      <span><b>Evidence</b></span>
      <i>→</i>
      <span><b>Deterministic verification</b><small>{deterministicResult}</small></span>
      <i>→</i>
      <span className="current"><b>Verified Learning</b><small>only because proof stopped</small></span>
      <i>→</i>
      <span><b>Human review</b></span>
    </div>

    <div className="learning-unchanged">
      <ShieldCheck size={15}/>
      <span><b>Deterministic result remains unchanged: {deterministicResult}.</b> The learned layer can only rank unresolved review priority.</span>
    </div>

    <div className="learning-reasons">
      <span>Why this case entered Verified Learning</span>
      <p>{status.record.reasons.join(" ")}</p>
    </div>

    {prediction?<div className="priority-card">
      <div><span>Learned review priority</span><strong>{prediction.priority}</strong><small>{prediction.reviewScore}/100 advisory score</small></div>
      <div><span>HIGH</span><b>{pct(prediction.probabilities.HIGH)}</b></div>
      <div><span>MEDIUM</span><b>{pct(prediction.probabilities.MEDIUM)}</b></div>
      <div><span>LOW</span><b>{pct(prediction.probabilities.LOW)}</b></div>
    </div>:<div className="learning-ready"><BrainCircuit size={17}/><span><b>Residual learning benchmark is ready.</b><small>Train the seed candidate before using learned priority in the demo.</small></span></div>}

    <div className="learning-review">
      <div>
        <span>Human-confirmed outcome</span>
        <small>Immutable per evidence record. Stored features are PII-minimized.</small>
      </div>
      <div className="learning-buttons">
        {([
          ["REVIEW","Needs review"],
          ["OBSERVE","Monitor"],
          ["ABSTAIN","No review"],
        ] as const).map(([value,label])=><button
          key={value}
          disabled={Boolean(feedback)||busy!==null}
          className={feedback?.label===value?"selected":""}
          onClick={()=>void review(value)}
        >{feedback?.label===value?<CheckCircle2 size={13}/>:null}{label}</button>)}
      </div>
    </div>

    <div className="learning-flow">
      <div className={feedback?"done":""}><span>01</span><b>Verified outcome</b><small>{feedback?humanLabel(feedback.label):"awaiting human confirmation"}</small></div>
      <div className={latest?"done":""}><span>02</span><b>Offline candidate</b><small>{latest?latest.modelVersion:"not trained"}</small></div>
      <div className={latest?.promoted?"done":""}><span>03</span><b>Frozen benchmark</b><small>{latest?(latest.promoted?"PROMOTED":"REJECTED"):"waiting"}</small></div>
    </div>

    {latest?<div className="learning-metrics">
      <Metric label="Priority accuracy" before={latest.baselineMetrics.priorityAccuracy} after={latest.candidateMetrics.priorityAccuracy}/>
      <Metric label="HIGH-priority recall" before={latest.baselineMetrics.highPriorityRecall} after={latest.candidateMetrics.highPriorityRecall}/>
      <Metric label="LOW → false HIGH" before={latest.baselineMetrics.lowPriorityFalseHighRate} after={latest.candidateMetrics.lowPriorityFalseHighRate} inverse/>
      <div><span>Authority violations</span><strong>{latest.candidateMetrics.authorityViolations}</strong><small>harmful responses {pct(latest.candidateMetrics.harmfulResponseRate)}</small></div>
    </div>:null}

    <div className="learning-footer">
      <div><span>Human-verified examples</span><b>{status.verifiedExamples}</b>{latest?<small>{latest.trainingExamples} weighted training rows · {latest.benchmarkId}</small>:null}</div>
      <button disabled={busy!==null||Boolean(feedback)===false&&status.verifiedExamples===0&&Boolean(active)} onClick={()=>void train()}>
        <RefreshCw size={13} className={busy==="train"?"spin":""}/>
        {busy==="train"?"Training candidate…":"Train candidate"}
      </button>
    </div>

    {latest?<div className={"learning-result "+(latest.promoted?"pass":"fail")}>
      <b>{latest.promoted?"PROMOTED":"REJECTED"}</b>
      <span>{latest.promotionReason}</span>
    </div>:null}
    {notice?<div className="learning-notice">{notice}</div>:null}
    <small className="learning-boundary">Advisory only — deterministic enforcement unchanged. Verified Learning cannot invent facts, change Purpose Contracts, rewrite SHOULD / COULD / DID / WHY, or gain CONSTRAIN / ISOLATE authority.</small>
  </section>;
}

function Metric({label,before,after,inverse=false}:{label:string;before:number;after:number;inverse?:boolean}){
  const improved=inverse?after<=before:after>=before;
  return <div><span>{label}</span><strong>{pct(after)}</strong><small>{pct(before)} baseline · {improved?"gate-safe":"regressed"}</small></div>;
}

function pct(value:number){return `${(value*100).toFixed(value===0||value===1?0:1)}%`;}
function humanLabel(value:HumanOutcome){return value==="REVIEW"?"Needs review":value==="OBSERVE"?"Monitor":"No review";}
