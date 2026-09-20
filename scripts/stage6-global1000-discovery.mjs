import { chromium } from "playwright";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { gunzipSync } from "node:zlib";

const base = process.env.THIRDSIGHT_URL ?? "https://thirdsight-five.vercel.app";
const SOURCE_URL = "https://raw.githubusercontent.com/wangmm001/tranco-top1m-cache/main/data/current.csv.gz";
const VERSION_URL = "https://raw.githubusercontent.com/wangmm001/tranco-top1m-cache/main/data/current.version.txt";
const TARGET_SITES = 1000;
const MAX_PERSISTED_PER_SITE = 2;
const MAX_CAPTURED_REQUESTS_PER_SITE = 1500;
const CONCURRENCY = 8;
const NAVIGATION_TIMEOUT_MS = 12_000;
const DWELL_MS = 2_000;

const source = await loadSource();
const SITES = source.sites;
if (SITES.length !== TARGET_SITES) {
  throw new Error(`Expected ${TARGET_SITES} source sites, received ${SITES.length}.`);
}

await fs.writeFile("stage6-global1000-sites.json", JSON.stringify({
  schemaVersion:"thirdsight-global1000-sites.v1",
  source:"Tranco Top 1M snapshot mirror",
  sourceUrl:SOURCE_URL,
  sourceVersionUrl:VERSION_URL,
  sourceVersion:source.version,
  selectedRange:"ranks 1-1000",
  selectedSha256:source.selectedSha256,
  sites:SITES,
}, null, 2));

const browser = await chromium.launch({
  headless:true,
  args:[
    "--disable-dev-shm-usage",
    "--no-default-browser-check",
    "--disable-background-networking",
  ],
});

const runId = `global1000-${Date.now()}`;
let cachedToken = process.env.THIRDSIGHT_OIDC_TOKEN?.trim() || null;
const results = new Array(SITES.length);
let cursor = 0;

try {
  await Promise.all(
    Array.from({ length:CONCURRENCY }, (_, index)=>worker(index + 1)),
  );

  const report = buildReport(results);
  await fs.writeFile("stage6-global1000-discovery.json", JSON.stringify(report, null, 2));
  await fs.writeFile("stage6-global1000-discovery.md", renderMarkdown(report));

  console.log("THIRDSIGHT_GLOBAL1000_REPORT=" + JSON.stringify({
    runId:report.runId,
    sourceVersion:report.source.version,
    sitesAttempted:report.summary.sitesAttempted,
    sitesLoadedNormally:report.summary.sitesLoadedNormally,
    sitesWithCrossOriginEvidence:report.summary.sitesWithCrossOriginEvidence,
    sitesWithPersistedRepresentativeEvidence:report.summary.sitesWithPersistedRepresentativeEvidence,
    representativeObservationsPersisted:report.summary.representativeObservationsPersisted,
    uniqueObservedCrossOriginOrigins:report.summary.uniqueObservedCrossOriginOrigins,
    blockedOrFailed:report.summary.blockedOrFailed,
  }));
} finally {
  await browser.close();
}

async function loadSource() {
  const [listResponse,versionResponse] = await Promise.all([
    fetch(SOURCE_URL,{headers:{"user-agent":"ThirdSight passive benchmark/1.0"}}),
    fetch(VERSION_URL,{headers:{"user-agent":"ThirdSight passive benchmark/1.0"}}),
  ]);
  if(!listResponse.ok) throw new Error(`Tranco snapshot fetch failed (${listResponse.status}).`);
  if(!versionResponse.ok) throw new Error(`Tranco version fetch failed (${versionResponse.status}).`);

  const raw = Buffer.from(await listResponse.arrayBuffer());
  const csv = raw[0]===0x1f&&raw[1]===0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  const version=(await versionResponse.text()).trim();
  const sites=[];

  for(const line of csv.split(/\r?\n/)){
    if(sites.length>=TARGET_SITES) break;
    const [rankText,domainRaw]=line.split(",");
    const rank=Number(rankText);
    const domain=String(domainRaw??"").trim().toLowerCase();
    if(!Number.isInteger(rank)||rank<1||!isSafeDomain(domain)) continue;
    sites.push({rank,domain,url:`https://${domain}/`});
  }

  const selectedSha256=crypto
    .createHash("sha256")
    .update(sites.map(site=>`${site.rank},${site.domain}`).join("\n"))
    .digest("hex");

  return {version,selectedSha256,sites};
}

async function worker(workerId){
  while(true){
    const index=cursor++;
    if(index>=SITES.length) return;
    const site=SITES[index];
    results[index]=await inspectSite(site,workerId);
  }
}

async function inspectSite(site,workerId){
  const context=await browser.newContext({
    viewport:{width:1365,height:900},
    locale:"en-NG",
    timezoneId:"Africa/Lagos",
    serviceWorkers:"allow",
  });
  const page=await context.newPage();
  const requests=[];
  const errors=[];
  let requestCaptureCapped=false;
  let responseStatus=null;
  let finalUrl=null;
  let loadedNormally=false;

  page.on("request",(request)=>{
    if(requests.length>=MAX_CAPTURED_REQUESTS_PER_SITE){
      requestCaptureCapped=true;
      return;
    }
    const destinationUrl=sanitizeHttpUrl(request.url());
    if(!destinationUrl) return;
    requests.push({
      destinationUrl,
      method:request.method().toUpperCase(),
      resourceType:normalizeResourceType(request.resourceType()),
    });
  });

  page.on("pageerror",(error)=>{
    if(errors.length<3) errors.push(`pageerror: ${String(error.message??error).slice(0,180)}`);
  });

  try{
    if(site.rank%50===0||site.rank<=10){
      console.log(`[worker ${workerId}] rank ${site.rank}: loading ${site.domain}`);
    }
    const response=await page.goto(site.url,{
      waitUntil:"domcontentloaded",
      timeout:NAVIGATION_TIMEOUT_MS,
    });
    responseStatus=response?.status()??null;
    finalUrl=sanitizeHttpUrl(page.url());
    loadedNormally=responseStatus!==null&&responseStatus>=200&&responseStatus<400;

    if(!loadedNormally){
      errors.push(`Navigation returned HTTP ${responseStatus??"unknown"}; no bypass attempted.`);
    }else{
      await page.waitForTimeout(DWELL_MS);
    }
  }catch(error){
    finalUrl=sanitizeHttpUrl(page.url());
    errors.push(`Navigation failed: ${error instanceof Error?error.message.slice(0,220):String(error).slice(0,220)}`);
  }

  const pageUrl=finalUrl??sanitizeHttpUrl(site.url);
  const pageOrigin=pageUrl?new URL(pageUrl).origin:new URL(site.url).origin;
  const crossOrigin=requests.filter((item)=>{
    try{return new URL(item.destinationUrl).origin!==pageOrigin;}catch{return false;}
  });

  const uniqueOrigins=[...new Set(crossOrigin.map((item)=>new URL(item.destinationUrl).origin))].sort();
  const methodCounts=countValues(crossOrigin.map(item=>item.method));
  const resourceTypeCounts=countValues(crossOrigin.map(item=>item.resourceType));

  // Persist only body-free representative requests. The landscape artifact still
  // aggregates all observed cross-origin origins and methods.
  const representative=dedupeRepresentative(
    crossOrigin.filter((item)=>["GET","HEAD","OPTIONS"].includes(item.method)),
  ).slice(0,MAX_PERSISTED_PER_SITE);

  const persisted=[];
  if(loadedNormally){
    for(const [index,item] of representative.entries()){
      const observation={
        schemaVersion:"browser-observation.v1",
        observationId:`${runId}-r${site.rank}-${index+1}-${crypto.randomUUID()}`,
        sensorId:`benchmark1000:r${site.rank}:${safeSlug(site.domain)}`,
        observedAt:new Date().toISOString(),
        pageUrl,
        destinationUrl:item.destinationUrl,
        method:item.method,
        resourceType:item.resourceType,
        initiatorType:"passive-page-load",
        hasPostData:false,
      };

      try{
        const accepted=await persistObservation(observation);
        assertDiscoverySemantics(accepted);
        persisted.push({
          recordId:accepted.evidence?.recordId??null,
          destinationOrigin:accepted.evidence?.did?.value?.destinationOrigin??new URL(item.destinationUrl).origin,
          method:item.method,
          resourceType:item.resourceType,
        });
      }catch(error){
        errors.push(`Persistence failed: ${error instanceof Error?error.message.slice(0,220):String(error).slice(0,220)}`);
      }
    }
  }

  await context.close();

  return {
    rank:site.rank,
    domain:site.domain,
    requestedUrl:site.url,
    finalUrl,
    responseStatus,
    loadedNormally,
    requestsObserved:requests.length,
    requestCaptureCapped,
    crossOriginRequestsObserved:crossOrigin.length,
    uniqueCrossOriginOrigins:uniqueOrigins,
    methodCounts,
    resourceTypeCounts,
    persistedObservations:persisted,
    errors,
  };
}

function dedupeRepresentative(items){
  const byOrigin=new Map();
  for(const item of items){
    const origin=new URL(item.destinationUrl).origin;
    if(!byOrigin.has(origin)) byOrigin.set(origin,item);
  }
  return [...byOrigin.values()];
}

async function persistObservation(observation){
  let response=await postWithToken(observation,await getToken(false));
  if(response.status===401){
    cachedToken=null;
    response=await postWithToken(observation,await getToken(true));
  }
  const body=await response.json().catch(()=>null);
  if(!response.ok||body?.accepted!==true||body?.persisted!==true){
    throw new Error(`ingestion HTTP ${response.status}: ${JSON.stringify(body).slice(0,500)}`);
  }
  return body;
}

async function postWithToken(observation,token){
  return fetch(`${base}/api/browser-observations`,{
    method:"POST",
    headers:{
      authorization:`Bearer ${token}`,
      "content-type":"application/json",
    },
    body:JSON.stringify(observation),
  });
}

async function getToken(forceRefresh){
  if(!forceRefresh&&cachedToken) return cachedToken;
  const requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL?.trim();
  const requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN?.trim();
  if(!requestUrl||!requestToken){
    throw new Error("GitHub OIDC environment is unavailable for Stage 6 benchmark ingestion.");
  }
  const separator=requestUrl.includes("?")?"&":"?";
  const response=await fetch(`${requestUrl}${separator}audience=thirdsight-stage6`,{
    headers:{authorization:`bearer ${requestToken}`},
  });
  if(!response.ok) throw new Error(`GitHub OIDC refresh failed (${response.status}).`);
  const body=await response.json();
  if(typeof body?.value!=="string"||body.value.length===0){
    throw new Error("GitHub OIDC refresh returned no token.");
  }
  cachedToken=body.value;
  return cachedToken;
}

function assertDiscoverySemantics(body){
  const evidence=body?.evidence;
  const checks=[
    [evidence?.should?.status,"UNKNOWN","SHOULD"],
    [evidence?.could?.status,"PARTIAL","COULD"],
    [evidence?.did?.status,"KNOWN","DID"],
    [evidence?.did?.confidence,"OBSERVED","DID confidence"],
    [evidence?.why?.status,"UNKNOWN","WHY"],
    [evidence?.coverage?.label,"BROWSER_ONLY","coverage"],
  ];
  for(const [actual,expected,label] of checks){
    if(actual!==expected) throw new Error(`${label} expected ${expected}, received ${actual}`);
  }
}

function buildReport(siteResults){
  const loaded=siteResults.filter(site=>site.loadedNormally);
  const withEvidence=siteResults.filter(site=>site.crossOriginRequestsObserved>0);
  const withPersisted=siteResults.filter(site=>site.persistedObservations.length>0);
  const destinationStats=new Map();
  let representativeObservationsPersisted=0;
  let totalCrossOriginRequestsObserved=0;
  let cappedSiteCount=0;

  for(const site of siteResults){
    representativeObservationsPersisted+=site.persistedObservations.length;
    totalCrossOriginRequestsObserved+=site.crossOriginRequestsObserved;
    if(site.requestCaptureCapped) cappedSiteCount+=1;
    for(const origin of site.uniqueCrossOriginOrigins){
      const current=destinationStats.get(origin)??{origin,siteCount:0,exampleDomains:[]};
      current.siteCount+=1;
      if(current.exampleDomains.length<8) current.exampleDomains.push(site.domain);
      destinationStats.set(origin,current);
    }
  }

  const destinationLandscape=[...destinationStats.values()]
    .sort((a,b)=>b.siteCount-a.siteCount||a.origin.localeCompare(b.origin));

  return {
    schemaVersion:"thirdsight-global1000-discovery.v1",
    runId,
    generatedAt:new Date().toISOString(),
    mode:"public logged-out passive homepage discovery",
    source:{
      name:"Tranco Top 1M snapshot mirror",
      url:SOURCE_URL,
      version:source.version,
      selectedRange:"ranks 1-1000",
      selectedSha256:source.selectedSha256,
    },
    thesis:"This run measures browser-visible integration landscape breadth across a reproducible high-traffic public-web sample. It does not measure ten percent of the global or Nigerian B2C market because no defensible denominator is asserted.",
    summary:{
      sitesAttempted:siteResults.length,
      sitesLoadedNormally:loaded.length,
      blockedOrFailed:siteResults.length-loaded.length,
      sitesWithCrossOriginEvidence:withEvidence.length,
      sitesWithPersistedRepresentativeEvidence:withPersisted.length,
      totalCrossOriginRequestsObserved,
      representativeObservationsPersisted,
      uniqueObservedCrossOriginOrigins:destinationStats.size,
      requestCaptureCappedSites:cappedSiteCount,
    },
    evidenceSemantics:{
      should:"No merchant-authoritative Purpose Contract supplied by this passive sensor; persisted schema status remains UNKNOWN.",
      could:"Partial / browser-visible lower bound.",
      did:"Observed browser request metadata.",
      why:"No authoritative first-party business event supplied by this passive sensor; persisted schema status remains UNKNOWN.",
      coverage:"Browser only.",
      enforcementClaim:"None. Public discovery does not claim PREVENTED or DETECTED.",
    },
    safety:{
      publicPagesOnly:true,
      loggedOutOnly:true,
      homepageNavigationOnly:true,
      onePagePerDomain:true,
      concurrency:CONCURRENCY,
      navigationTimeoutMs:NAVIGATION_TIMEOUT_MS,
      dwellMs:DWELL_MS,
      formsSubmitted:false,
      authenticationUsed:false,
      clicksUsed:false,
      fuzzingUsed:false,
      requestMutationUsed:false,
      controlsBypassed:false,
      retriesToDefeatBlocks:false,
      requestBodiesInspected:false,
      responseBodiesInspectedForTelemetry:false,
      cookiesPersisted:false,
      queryStringsPersisted:false,
      rawCustomerPayloadsPersisted:false,
      piiPersisted:false,
      botChallengesBypassed:false,
      note:"A non-2xx/3xx response, timeout, CAPTCHA, or bot challenge is retained as unavailable. The harness does not try a second technique to defeat it.",
    },
    topDestinations:destinationLandscape.slice(0,200),
    sites:siteResults,
  };
}

function renderMarkdown(report){
  const lines=[
    "# ThirdSight — 1,000-site passive discovery breadth benchmark",
    "",
    `**Run:** \`${report.runId}\`  `,
    `**Generated:** ${report.generatedAt}  `,
    `**Source:** Tranco snapshot version \`${report.source.version}\`, ranks 1–1000  `,
    `**Selection SHA-256:** \`${report.source.selectedSha256}\``,
    "",
    "## Result",
    "",
    `- Sites attempted: **${report.summary.sitesAttempted}**`,
    `- Loaded normally without bypass: **${report.summary.sitesLoadedNormally}**`,
    `- Blocked / failed / unavailable: **${report.summary.blockedOrFailed}**`,
    `- Sites with browser-visible cross-origin evidence: **${report.summary.sitesWithCrossOriginEvidence}**`,
    `- Sites with representative evidence persisted into ThirdSight: **${report.summary.sitesWithPersistedRepresentativeEvidence}**`,
    `- Cross-origin requests observed: **${report.summary.totalCrossOriginRequestsObserved}**`,
    `- Representative observations persisted: **${report.summary.representativeObservationsPersisted}**`,
    `- Unique observed cross-origin destination origins: **${report.summary.uniqueObservedCrossOriginOrigins}**`,
    `- Sites where local request capture hit its ${MAX_CAPTURED_REQUESTS_PER_SITE}-request cap: **${report.summary.requestCaptureCappedSites}**`,
    "",
    "This benchmark is a **1,000-site high-traffic public-web sample**, not a claim that 1,000 sites equal 10% of the Nigerian or global B2C landscape.",
    "",
    "## Evidence semantics",
    "",
    "| Dimension | Passive-browser meaning |",
    "| --- | --- |",
    `| SHOULD | ${report.evidenceSemantics.should} |`,
    `| COULD | ${report.evidenceSemantics.could} |`,
    `| DID | ${report.evidenceSemantics.did} |`,
    `| WHY | ${report.evidenceSemantics.why} |`,
    `| Coverage | ${report.evidenceSemantics.coverage} |`,
    `| Enforcement | ${report.evidenceSemantics.enforcementClaim} |`,
    "",
    "## Safety boundary",
    "",
    "- Public homepages only; logged out.",
    "- One navigation per source domain; no forms, authentication, clicks, fuzzing, or request mutation.",
    "- No CAPTCHA, anti-bot, access-control, or rate-limit bypass.",
    "- No retry technique is used to defeat a block or challenge.",
    "- No request bodies, telemetry response bodies, cookies, query strings, raw customer payloads, or PII are persisted.",
    "- Each site uses an isolated browser context.",
    "- Only up to two body-free representative requests per site are persisted. The artifact aggregates all observed cross-origin origins.",
    "",
    "## Most prevalent observed cross-origin origins",
    "",
    "| Destination origin | Sites observed on | Example source domains |",
    "| --- | ---: | --- |",
    ...report.topDestinations.slice(0,50).map(row=>`| ${escapeMd(row.origin)} | ${row.siteCount} | ${row.exampleDomains.map(escapeMd).join(", ")} |`),
    "",
    "## Per-site result",
    "",
    "| Rank | Domain | HTTP | Loaded | Cross-origin requests | Unique origins | Persisted |",
    "| ---: | --- | ---: | --- | ---: | ---: | ---: |",
    ...report.sites.map(site=>`| ${site.rank} | ${escapeMd(site.domain)} | ${site.responseStatus??"-"} | ${site.loadedNormally?"yes":"no"} | ${site.crossOriginRequestsObserved} | ${site.uniqueCrossOriginOrigins.length} | ${site.persistedObservations.length} |`),
    "",
    "## Interpretation",
    "",
    report.thesis,
    "",
    "The existing Nigeria-facing 40-site benchmark remains the locally focused breadth result. Commerce Lab remains the ground-truth environment for abuse, prevention, graded response and false-positive evaluation.",
    "",
  ];
  return lines.join("\n");
}

function sanitizeHttpUrl(value){
  try{
    const url=new URL(value);
    if(url.protocol!=="http:"&&url.protocol!=="https:") return null;
    return `${url.origin}${sanitizePathname(url.pathname)}`;
  }catch{return null;}
}

function sanitizePathname(pathname){
  const segments=pathname.split("/").map(segment=>{
    if(!segment) return segment;
    if(/^\d{6,}$/.test(segment)) return ":id";
    if(/^[0-9a-f]{16,}$/i.test(segment)) return ":id";
    if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return ":id";
    if(segment.length>64) return ":opaque";
    return segment;
  });
  return segments.join("/")||"/";
}

function normalizeResourceType(value){
  const normalized=String(value||"other").toLowerCase();
  const table={
    document:"Document",stylesheet:"Stylesheet",image:"Image",media:"Media",
    font:"Font",script:"Script",texttrack:"TextTrack",xhr:"XHR",fetch:"Fetch",
    eventsource:"EventSource",websocket:"WebSocket",manifest:"Manifest",other:"Other",
  };
  return table[normalized]??"Other";
}

function countValues(values){
  const counts={};
  for(const value of values) counts[value]=(counts[value]??0)+1;
  return counts;
}

function isSafeDomain(value){
  if(!value||value.length>253||value.includes("/")||value.includes(":")) return false;
  return /^[a-z0-9.-]+$/.test(value)&&value.includes(".")&&!value.startsWith(".")&&!value.endsWith(".");
}

function safeSlug(value){
  return value.replace(/[^a-z0-9.-]/g,"-").slice(0,120);
}

function escapeMd(value){
  return String(value).replace(/\|/g,"\\|");
}
