import type { BusinessObjectRefs } from "../domain/evidence.js";
import type { ManagedRequestContext, ManagedBusinessEventContext } from "./types.js";
import { ManagedPayloadError } from "./payload-paths.js";

const REF_KEYS=["customerRefHash","orderRefHash","paymentRefHash","deliveryRefHash","campaignRef"] as const;

export function parseManagedRequestContext(input:unknown):ManagedRequestContext|undefined{
  if(input===undefined||input===null) return undefined;
  if(!isRecord(input)) throw new ManagedPayloadError("Managed request context must be an object.");

  const result:ManagedRequestContext={};
  if(input.businessEvent!==undefined){
    if(!isRecord(input.businessEvent)) throw new ManagedPayloadError("businessEvent must be an object.");
    result.businessEvent=parseBusinessEvent(input.businessEvent);
  }
  if(input.requestRefs!==undefined){
    if(!isRecord(input.requestRefs)) throw new ManagedPayloadError("requestRefs must be an object.");
    const refs=parseRefs(input.requestRefs);
    if(Object.keys(refs).length>0) result.requestRefs=refs;
  }
  return Object.keys(result).length>0?result:undefined;
}

function parseBusinessEvent(input:Record<string,unknown>):ManagedBusinessEventContext{
  const id=readString(input,"id",160);
  const type=readString(input,"type",160);
  const timestamp=input.timestamp===undefined?undefined:readTimestamp(input,"timestamp");
  const refs=parseRefs(input);
  return {id,type,...(timestamp?{timestamp}:{}),...refs};
}

function parseRefs(input:Record<string,unknown>):BusinessObjectRefs{
  const refs:BusinessObjectRefs={};
  for(const key of REF_KEYS){
    const value=input[key];
    if(value===undefined) continue;
    if(typeof value!=="string"||value.trim().length===0||value.length>128){
      throw new ManagedPayloadError(key+" must be a non-empty string of at most 128 characters.");
    }
    refs[key]=value.trim();
  }
  return refs;
}

function readString(input:Record<string,unknown>,key:string,max:number):string{
  const value=input[key];
  if(typeof value!=="string"||value.trim().length<2||value.length>max){
    throw new ManagedPayloadError(key+" must be a string between 2 and "+max+" characters.");
  }
  return value.trim();
}

function readTimestamp(input:Record<string,unknown>,key:string):string{
  const value=readString(input,key,64);
  if(!Number.isFinite(Date.parse(value))) throw new ManagedPayloadError(key+" must be a valid ISO timestamp.");
  return value;
}

function isRecord(value:unknown):value is Record<string,unknown>{
  return typeof value==="object"&&value!==null&&!Array.isArray(value);
}
