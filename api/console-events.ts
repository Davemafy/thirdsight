import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import type { EvidenceHistoryEntry } from "../src/infrastructure/evidence-history/evidence-history-store.js";
import { SupabaseAiAssessmentStore } from "../src/ai-analyst/ai-assessment-store.js";
import { SupabaseLearningStore } from "../src/learning-loop/supabase-learning-store.js";

interface ApiRequest { method?: string }
interface ApiResponse { status(code:number):ApiResponse; setHeader(name:string,value:string):void; json(body:unknown):void; end():void }

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(request.method==="OPTIONS"){response.status(204).end();return;}
  if(request.method!=="GET"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}

  const runtime=globalThis as typeof globalThis & {process?:{env?:Record<string,string|undefined>}};
  const url=runtime.process?.env?.THIRDSIGHT_SUPABASE_URL?.trim();
  const key=runtime.process?.env?.THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}

  try{
    const store=new SupabaseEvidenceHistoryStore({projectUrl:url,serviceRoleKey:key});
    const aiStore=new SupabaseAiAssessmentStore({projectUrl:url,serviceRoleKey:key});
    const learningStore=new SupabaseLearningStore({projectUrl:url,serviceRoleKey:key});
    const [allHistory,learningFeedback]=await Promise.all([
      store.list(900),
      learningStore.listFeedback(5),
    ]);
    const reviewedEntries=(await Promise.all(
      [...learningFeedback].reverse().map((feedback)=>store.findByRecordId(feedback.recordId)),
    )).filter((entry):entry is EvidenceHistoryEntry=>entry!==null);
    const representative=selectRepresentativeHistory(allHistory);
    const history=[
      ...reviewedEntries,
      ...representative.filter((entry)=>!reviewedEntries.some((reviewed)=>reviewed.recordId===entry.recordId)),
    ];
    const [latestAiEvaluation,promotedAiEvaluation]=await Promise.all([
      aiStore.latestEvaluationRun(),
      aiStore.latestPromotedEvaluationRun(),
    ]);
    const aiByRecord=promotedAiEvaluation
      ? await aiStore.latestForRecords(
          history.map((entry)=>entry.recordId),
          {
            analystVersion:promotedAiEvaluation.analystVersion,
            model:promotedAiEvaluation.model,
            acceptedOnly:true,
          },
        )
      : new Map();

    response.status(200).json({
      productThesis:"ThirdSight proves what can be proven, and learns where proof stops.",
      exposureMap:buildExposureMap(allHistory),
      challengeProof:buildChallengeProof(allHistory),
      aiAnalyst:{
        promoted:Boolean(promotedAiEvaluation),
        activePromotion:promotedAiEvaluation,
        latestEvaluation:latestAiEvaluation,
      },
      history:history.map(entry=>({
        recordId:entry.recordId,
        acceptedAt:entry.acceptedAt,
        observedAt:entry.evidence.observedAt,
        integrationId:entry.evidence.integrationId,
        integrationResolution:entry.evidence.integrationResolution,
        should:entry.evidence.should,
        could:entry.evidence.could,
        did:entry.evidence.did,
        why:entry.evidence.why,
        findings:entry.findings??[],
        enforcement:entry.enforcement??null,
        containment:entry.containment??null,
        blindSpotAssessment:entry.blindSpotAssessment??null,
        decision:entry.decision??null,
        coverage:entry.evidence.coverage??inferCoverage(entry.evidence.did.value?.boundary),
        outcome:entry.outcome??derivePassiveOutcome(entry.evidence.did.value?.phase),
        aiAssessment:aiByRecord.get(entry.recordId)??null,
      })),
    });
  }catch{
    response.status(503).json({error:"EVIDENCE_READ_FAILED"});
  }
}

function derivePassiveOutcome(phase:string|undefined):"DETECTED"|null{
  // Only post-access evidence may be labelled DETECTED. ATTEMPTED is not transmission proof.
  return phase==="TRANSMITTED"||phase==="ACCESSED"?"DETECTED":null;
}

function inferCoverage(boundary:string|undefined){
  if(boundary==="browser") return {
    label:"BROWSER_ONLY",
    boundaries:["browser"],
    limitations:["Only browser-visible request metadata is covered by this observation."],
  };
  return {label:"MULTI_BOUNDARY",boundaries:boundary?[boundary]:[],limitations:[]};
}

interface ExposureAccumulator {
  key:string;
  integrationId:string|null;
  label:string;
  resolution:string;
  approvedFields:Set<string>;
  canReachFields:Set<string>;
  attemptedFields:Set<string>;
  receivedFields:Set<string>;
  preventedFields:Set<string>;
  destinations:Set<string>;
  findings:Set<string>;
  boundaries:Set<string>;
  observations:number;
  lastSeen:string;
  latestResponse:string;
  latestAt:number;
  reachSource:"DECLARED_CAPABILITY"|"OBSERVED_LOWER_BOUND"|"UNKNOWN";
}

function buildExposureMap(entries:readonly EvidenceHistoryEntry[]){
  const rows=new Map<string,ExposureAccumulator>();

  for(const entry of entries){
    const did=entry.evidence.did.value;
    if(!did) continue;
    if(entry.evidence.integrationId===null&&did.originRelationship!=="CROSS_ORIGIN") continue;

    const key=entry.evidence.integrationId??did.destinationOrigin;
    let row=rows.get(key);
    if(!row){
      row={
        key,
        integrationId:entry.evidence.integrationId,
        label:entry.evidence.integrationId
          ? humanize(entry.evidence.integrationId)
          : hostname(did.destinationOrigin),
        resolution:entry.evidence.integrationResolution,
        approvedFields:new Set(),
        canReachFields:new Set(),
        attemptedFields:new Set(),
        receivedFields:new Set(),
        preventedFields:new Set(),
        destinations:new Set(),
        findings:new Set(),
        boundaries:new Set(),
        observations:0,
        lastSeen:entry.evidence.observedAt,
        latestResponse:"DISCOVERY",
        latestAt:0,
        reachSource:"UNKNOWN",
      };
      rows.set(key,row);
    }

    row.observations+=1;
    row.destinations.add(did.destinationOrigin);
    row.boundaries.add(did.boundary);
    for(const field of entry.evidence.should.value?.fields??[]) row.approvedFields.add(field);
    for(const field of entry.evidence.did.value?.dataCategories??[]) row.attemptedFields.add(field);
    for(const field of entry.enforcement?.continuedFields??[]) row.attemptedFields.add(field);
    for(const field of entry.enforcement?.removedFields??[]){
      row.attemptedFields.add(field);
      row.preventedFields.add(field);
    }
    for(const field of entry.enforcement?.receiver.receivedFields??[]) row.receivedFields.add(field);
    for(const finding of entry.findings??[]) row.findings.add(finding.type);

    const capabilityFields=capabilityFieldsFromStatement(entry.evidence.could.value?.statement);
    for(const field of capabilityFields) row.canReachFields.add(field);
    if(capabilityFields.length>0) row.reachSource="DECLARED_CAPABILITY";
    else if(row.reachSource==="UNKNOWN"&&entry.evidence.could.status!=="UNKNOWN") row.reachSource="OBSERVED_LOWER_BOUND";

    const observedAt=Date.parse(entry.evidence.observedAt);
    if(Number.isFinite(observedAt)&&observedAt>=row.latestAt){
      row.latestAt=observedAt;
      row.lastSeen=entry.evidence.observedAt;
      row.latestResponse=entry.outcome??entry.decision??(
        entry.evidence.coverage?.label==="BROWSER_ONLY"?"DISCOVERY":"UNRESOLVED"
      );
      row.resolution=entry.evidence.integrationResolution;
    }
  }

  return [...rows.values()]
    .sort((a,b)=>{
      const resolved=Number(Boolean(b.integrationId))-Number(Boolean(a.integrationId));
      if(resolved!==0) return resolved;
      const findings=b.findings.size-a.findings.size;
      if(findings!==0) return findings;
      return b.latestAt-a.latestAt;
    })
    .slice(0,10)
    .map((row)=>({
      key:row.key,
      integrationId:row.integrationId,
      label:row.label,
      resolution:row.resolution,
      approvedFields:[...row.approvedFields].sort(),
      canReachFields:[...row.canReachFields].sort(),
      attemptedFields:[...row.attemptedFields].sort(),
      receivedFields:[...row.receivedFields].sort(),
      preventedFields:[...row.preventedFields].sort(),
      destinations:[...row.destinations].sort(),
      findings:[...row.findings].sort(),
      boundaries:[...row.boundaries].sort(),
      observations:row.observations,
      lastSeen:row.lastSeen,
      latestResponse:row.latestResponse,
      reachSource:row.reachSource,
    }));
}

function buildChallengeProof(entries:readonly EvidenceHistoryEntry[]){
  const flashSale=entries.filter((entry)=>entry.recordId.includes(":flash-sale:"));
  const flashSaleFalseAlarms=flashSale.filter((entry)=>
    entry.decision!=="ALLOW"||
    (entry.findings?.length??0)>0||
    Boolean(entry.outcome)
  ).length;
  const abnormal=entries.filter((entry)=>(entry.findings?.length??0)>0);
  const findings=[...new Set(abnormal.flatMap((entry)=>(entry.findings??[]).map((finding)=>finding.type)))].sort();
  const responses=[...new Set(entries.flatMap((entry)=>[
    entry.decision,
    entry.outcome,
  ].filter((value):value is NonNullable<typeof value>=>value!==null&&value!==undefined)))];
  const scopePrevention=entries.find((entry)=>
    entry.outcome==="PREVENTED"&&
    (entry.findings??[]).some((finding)=>finding.type==="SCOPE_DRIFT")
  );

  return {
    busySale:{
      scenario:"Legitimate flash-sale traffic",
      observed:flashSale.length,
      allowed:flashSale.filter((entry)=>entry.decision==="ALLOW").length,
      falseAlarms:flashSaleFalseAlarms,
      passed:flashSale.length>0&&flashSaleFalseAlarms===0,
    },
    abnormalBehavior:{
      persistedFindings:abnormal.length,
      findingTypes:findings,
      observed:abnormal.length>0,
    },
    gradedResponse:{
      levels:["ALLOW","OBSERVE","CONSTRAIN","ISOLATE"],
      observedResponses:responses,
    },
    scopePrevention:scopePrevention?{
      proven:true,
      recordId:scopePrevention.recordId,
      removedFields:scopePrevention.enforcement?.removedFields??[],
      receivedFields:scopePrevention.enforcement?.receiver.receivedFields??[],
      forbiddenFieldReceived:scopePrevention.enforcement?.receiver.forbiddenFieldReceived??null,
    }:{
      proven:false,
      recordId:null,
      removedFields:[],
      receivedFields:[],
      forbiddenFieldReceived:null,
    },
  };
}

function capabilityFieldsFromStatement(statement:string|undefined):string[]{
  if(!statement) return [];
  const match=statement.match(/fields\s*\[([^\]]+)\]/i);
  if(!match?.[1]) return [];
  return match[1].split(",").map((value)=>value.trim()).filter(Boolean);
}

function humanize(value:string):string{
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part)=>part.charAt(0).toUpperCase()+part.slice(1))
    .join(" ");
}

function hostname(origin:string):string{
  try{return new URL(origin).hostname;}catch{return origin;}
}

function selectRepresentativeHistory(entries:readonly EvidenceHistoryEntry[]):readonly EvidenceHistoryEntry[]{
  const selected:EvidenceHistoryEntry[]=[];
  const add=(predicate:(entry:EvidenceHistoryEntry)=>boolean)=>{
    const match=entries.find(predicate);
    if(match&&!selected.some((entry)=>entry.recordId===match.recordId)) selected.push(match);
  };

  // Judge path first: legitimate -> constrained/prevented -> busy-day proof -> ambiguous -> post-access detection.
  add((entry)=>
    entry.decision==="ALLOW"&&
    entry.evidence.why.value?.correlationStrength==="BUSINESS_OBJECT_HASH"&&
    !entry.recordId.includes(":flash-sale:")
  );
  add((entry)=>entry.outcome==="PREVENTED");
  add((entry)=>entry.recordId.includes(":flash-sale:")&&entry.decision==="ALLOW");
  add((entry)=>
    entry.evidence.coverage?.label==="BROWSER_ONLY"&&
    entry.evidence.integrationId===null&&
    entry.evidence.did.value?.originRelationship==="CROSS_ORIGIN"&&
    entry.evidence.did.value?.method==="POST"
  );
  add((entry)=>entry.outcome==="DETECTED");
  add((entry)=>entry.findings?.some((finding)=>finding.type==="STALE_INTEGRATION")??false);
  add((entry)=>entry.findings?.some((finding)=>finding.type==="SHADOW_INTEGRATION")??false);
  add((entry)=>entry.findings?.some((finding)=>finding.type==="PURPOSE_MISMATCH")??false);
  add((entry)=>entry.findings?.some((finding)=>finding.type==="SCOPE_DRIFT")??false);
  add((entry)=>Boolean(entry.blindSpotAssessment));
  add((entry)=>entry.evidence.should.value?.contractVersion==="4");
  add((entry)=>entry.evidence.should.value?.contractVersion==="5"&&entry.decision==="ALLOW");

  for(const entry of entries.slice(0,28)){
    if(!selected.some((item)=>item.recordId===entry.recordId)) selected.push(entry);
  }
  return selected;
}
