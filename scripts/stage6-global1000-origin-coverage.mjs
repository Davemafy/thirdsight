import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const [inputPath, inventoryPath, summaryPath] = process.argv.slice(2);
if(!inputPath||!inventoryPath||!summaryPath){
  console.error("Usage: node scripts/stage6-global1000-origin-coverage.mjs <discovery.json> <inventory.json> <summary.json>");
  process.exit(1);
}

const input=JSON.parse(fs.readFileSync(inputPath,"utf8"));
const rows=new Map();

for(const site of input.sites??[]){
  const sourceDomain=String(site.domain??"").toLowerCase();
  for(const origin of site.uniqueCrossOriginOrigins??[]){
    let hostname="";
    try{hostname=new URL(origin).hostname.toLowerCase();}catch{hostname=String(origin);}
    let row=rows.get(origin);
    if(!row){
      row={
        origin,
        hostname,
        sites:new Set(),
        sourceNamespaceSites:new Set(),
        externalSites:new Set(),
      };
      rows.set(origin,row);
    }

    row.sites.add(sourceDomain);
    if(hostname===sourceDomain||hostname.endsWith(`.${sourceDomain}`)){
      row.sourceNamespaceSites.add(sourceDomain);
    }else{
      row.externalSites.add(sourceDomain);
    }
  }
}

const entries=[...rows.values()].map(row=>{
  const siteCount=row.sites.size;
  const sourceNamespaceSiteCount=row.sourceNamespaceSites.size;
  const externalSiteCount=row.externalSites.size;
  const relationshipClass=
    externalSiteCount===0
      ?"SOURCE_NAMESPACE_ONLY"
      :sourceNamespaceSiteCount>0
        ?"MIXED_SOURCE_AND_EXTERNAL"
        :siteCount>1
          ?"SHARED_EXTERNAL"
          :"SINGLE_EXTERNAL";

  return {
    coverageState:"INDEXED",
    origin:row.origin,
    hostname:row.hostname,
    siteCount,
    sourceNamespaceSiteCount,
    externalSiteCount,
    relationshipClass,
    exampleSites:[...row.sites].sort().slice(0,8),
  };
}).sort((a,b)=>b.siteCount-a.siteCount||a.origin.localeCompare(b.origin));

const expected=input.summary?.uniqueObservedCrossOriginOrigins;
if(entries.length!==expected){
  throw new Error(`Origin inventory mismatch: expected ${expected}, generated ${entries.length}`);
}

const counts=entries.reduce((acc,row)=>{
  acc[row.relationshipClass]=(acc[row.relationshipClass]??0)+1;
  return acc;
},{});

const entriesCanonical=JSON.stringify(entries);
const inventorySha256=crypto.createHash("sha256").update(entriesCanonical).digest("hex");

const inventory={
  schemaVersion:"thirdsight-global1000-origin-inventory.v1",
  generatedAt:new Date().toISOString(),
  benchmark:{
    runId:input.runId,
    source:input.source,
    mode:input.mode,
    sitesAttempted:input.summary?.sitesAttempted,
    uniqueObservedCrossOriginOrigins:expected,
  },
  semantics:{
    coverage:"Every unique browser-observed cross-origin origin is indexed exactly once.",
    sourceNamespace:"Hostname equals or is nested beneath the benchmark source domain. This is a namespace relationship, not a legal ownership claim.",
    external:"Hostname is outside the benchmark source domain namespace.",
    documentation:"Documentation resolution is a separate Vendor Intelligence layer. INDEXED does not mean vendor identity or purpose is known.",
  },
  inventorySha256,
  entries,
};

const summary={
  schemaVersion:"thirdsight-global1000-origin-coverage.v1",
  generatedAt:inventory.generatedAt,
  benchmarkRunId:input.runId,
  source:input.source,
  inventorySha256,
  uniqueOriginsExpected:expected,
  uniqueOriginsIndexed:entries.length,
  inventoryCoveragePct:Number(((entries.length/expected)*100).toFixed(3)),
  relationshipCounts:{
    sourceNamespaceOnly:counts.SOURCE_NAMESPACE_ONLY??0,
    mixedSourceAndExternal:counts.MIXED_SOURCE_AND_EXTERNAL??0,
    sharedExternal:counts.SHARED_EXTERNAL??0,
    singleExternal:counts.SINGLE_EXTERNAL??0,
  },
  claimBoundary:"100% inventory coverage means every observed origin has a reproducible disposition. It does not mean every origin has a verified vendor identity, documented product purpose or merchant authorization.",
};

fs.mkdirSync(path.dirname(inventoryPath),{recursive:true});
fs.mkdirSync(path.dirname(summaryPath),{recursive:true});
fs.writeFileSync(inventoryPath,JSON.stringify(inventory,null,2)+"\n");
fs.writeFileSync(summaryPath,JSON.stringify(summary,null,2)+"\n");

console.log(JSON.stringify({
  uniqueOriginsIndexed:entries.length,
  inventoryCoveragePct:summary.inventoryCoveragePct,
  relationshipCounts:summary.relationshipCounts,
  inventorySha256,
},null,2));
