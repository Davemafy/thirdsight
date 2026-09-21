import { isIP } from "node:net";
import type { AllowedRoute, GatewayIntegration } from "./gateway-types.js";

const HOP_BY_HOP=new Set([
  "connection","keep-alive","proxy-authenticate","proxy-authorization","te","trailer",
  "transfer-encoding","upgrade","host","content-length","cookie","authorization",
]);
const SAFE_REQUEST_HEADERS=new Set(["accept","content-type","idempotency-key","user-agent","x-request-id"]);
const SAFE_RESPONSE_HEADERS=new Set(["content-type","cache-control","retry-after"]);

export class GatewaySecurityError extends Error {
  constructor(message:string){
    super(message);
    this.name="GatewaySecurityError";
  }
}

export function resolveSafeUpstream(
  integration:GatewayIntegration,
  requestPath:string,
  method:string,
):{url:URL;route:AllowedRoute}{
  if(!integration.upstreamOrigin) throw new GatewaySecurityError("Integration is not configured with a routable upstream origin.");
  const origin=validateConfiguredOrigin(integration.upstreamOrigin);
  if(requestPath.length===0||requestPath.length>1024) throw new GatewaySecurityError("Gateway path is invalid.");
  if(requestPath.includes("\\")||requestPath.includes("\0")) throw new GatewaySecurityError("Gateway path contains unsupported characters.");

  let url:URL;
  try{url=new URL(requestPath,origin+"/");}catch{throw new GatewaySecurityError("Gateway path is not a valid relative HTTP path.");}
  if(url.origin!==origin) throw new GatewaySecurityError("Gateway path attempted to escape the registered upstream origin.");
  if(url.username||url.password||url.hash) throw new GatewaySecurityError("Gateway path contains forbidden URL components.");
  for(const segment of url.pathname.split("/")){
    if(!segment) continue;
    let decoded:string;
    try{decoded=decodeURIComponent(segment);}catch{throw new GatewaySecurityError("Gateway path contains invalid encoding.");}
    if(decoded==="."||decoded===".."||decoded.includes("/")||decoded.includes("\\")) throw new GatewaySecurityError("Gateway path traversal or encoded path separators are not allowed.");
  }

  const normalizedMethod=method.toUpperCase();
  const route=integration.allowedRoutes.find((candidate)=>
    candidate.method.toUpperCase()===normalizedMethod&&matchesRoute(candidate.path,url.pathname)
  );
  if(!route) throw new GatewaySecurityError("Method or path is not registered for this integration.");

  const allowedQuery=new Set(route.allowedQueryKeys??[]);
  for(const key of url.searchParams.keys()){
    if(!allowedQuery.has(key)) throw new GatewaySecurityError("Gateway query parameter is not registered for this integration.");
  }
  return {url,route};
}

export function filterClientHeaders(headers:Record<string,string>):Headers{
  const output=new Headers();
  for(const [rawName,value] of Object.entries(headers)){
    const name=rawName.toLowerCase();
    if(HOP_BY_HOP.has(name)||name.startsWith("proxy-")) continue;
    if(!SAFE_REQUEST_HEADERS.has(name)) continue;
    output.set(name,value);
  }
  return output;
}

export function safeResponseHeaders(headers:Headers):Record<string,string>{
  const output:Record<string,string>={};
  for(const [name,value] of headers.entries()){
    if(SAFE_RESPONSE_HEADERS.has(name.toLowerCase())) output[name.toLowerCase()]=value;
  }
  return output;
}

export function validateConfiguredOrigin(value:string):string{
  let url:URL;
  try{url=new URL(value);}catch{throw new GatewaySecurityError("Configured upstream origin is not a valid URL.");}
  if(url.protocol!=="https:") throw new GatewaySecurityError("Managed integration upstreams must use HTTPS.");
  if(url.username||url.password||url.pathname!=="/"||url.search||url.hash) throw new GatewaySecurityError("Configured upstream must be an origin only.");
  const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,"");
  if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")) throw new GatewaySecurityError("Local upstream origins are not allowed.");
  if(isIP(host)!==0&&isDisallowedIpLiteral(host)) throw new GatewaySecurityError("Private, link-local, reserved or non-routable upstream IPs are not allowed.");
  return url.origin;
}

export function assertResolvedAddressesPublic(addresses:readonly string[]):void{
  if(addresses.length===0) throw new GatewaySecurityError("Registered upstream DNS did not resolve to an address.");
  for(const address of addresses){
    if(isIP(address)===0) throw new GatewaySecurityError("Registered upstream resolver returned an invalid address.");
    if(isDisallowedIpLiteral(address)) throw new GatewaySecurityError("Registered upstream resolved to a private, link-local, reserved or non-routable address.");
  }
}

export function isDisallowedIpLiteral(address:string):boolean{
  const normalized=address.toLowerCase().replace(/^\[|\]$/g,"");
  if(normalized.startsWith("::ffff:")){
    const mapped=normalized.slice("::ffff:".length);
    if(isIP(mapped)===4) return isDisallowedIpv4(mapped);
  }
  if(isIP(normalized)===4) return isDisallowedIpv4(normalized);
  if(isIP(normalized)!==6) return true;

  if(normalized==="::"||normalized==="::1") return true;
  const first=firstIpv6Hextet(normalized);
  if(first===null) return true;
  if((first&0xfe00)===0xfc00) return true; // fc00::/7
  if((first&0xffc0)===0xfe80) return true; // fe80::/10
  if((first&0xff00)===0xff00) return true; // multicast
  return false;
}

function matchesRoute(pattern:string,pathname:string):boolean{
  const escaped=pattern.split("/").map((segment)=>{
    if(segment.startsWith(":")) return "[^/]+";
    return segment.replace(/[\\^$.*+?()[\]{}|]/g,"\\$&");
  }).join("/");
  return new RegExp("^"+escaped+"$").test(pathname);
}

function isDisallowedIpv4(host:string):boolean{
  const parts=host.split(".").map(Number);
  if(parts.length!==4||parts.some((part)=>part<0||part>255||!Number.isInteger(part))) return true;
  const [a,b,c]=parts;
  if(a===0||a===10||a===127) return true;
  if(a===100&&b>=64&&b<=127) return true;
  if(a===169&&b===254) return true;
  if(a===172&&b>=16&&b<=31) return true;
  if(a===192&&b===168) return true;
  if(a===192&&b===0&&c===0) return true;
  if(a===192&&b===0&&c===2) return true;
  if(a===198&&(b===18||b===19)) return true;
  if(a===198&&b===51&&c===100) return true;
  if(a===203&&b===0&&c===113) return true;
  if(a>=224) return true;
  return false;
}

function firstIpv6Hextet(address:string):number|null{
  const first=address.split(":")[0];
  if(!first) return 0;
  const value=Number.parseInt(first,16);
  return Number.isFinite(value)?value:null;
}
