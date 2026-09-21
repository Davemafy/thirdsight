export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { [key:string]: JsonValue }

const FORBIDDEN_KEYS=new Set(["__proto__","prototype","constructor"]);
const MAX_DEPTH=32;
const MAX_NODES=10_000;

export class ManagedPayloadError extends Error {
  constructor(message:string){
    super(message);
    this.name="ManagedPayloadError";
  }
}

export function assertJsonObject(input:unknown): asserts input is JsonObject {
  if(!isPlainObject(input)) throw new ManagedPayloadError("Managed payload must be a JSON object.");
  const seen=new Set<object>();
  let nodes=0;

  const visit=(value:unknown,depth:number):void=>{
    if(depth>MAX_DEPTH) throw new ManagedPayloadError("Managed payload exceeds the maximum nesting depth.");
    nodes+=1;
    if(nodes>MAX_NODES) throw new ManagedPayloadError("Managed payload is too structurally complex.");

    if(value===null||typeof value==="string"||typeof value==="boolean") return;
    if(typeof value==="number"){
      if(!Number.isFinite(value)) throw new ManagedPayloadError("Managed payload numbers must be finite.");
      return;
    }
    if(typeof value!=="object") throw new ManagedPayloadError("Managed payload must contain JSON-compatible values only.");
    if(seen.has(value)) throw new ManagedPayloadError("Managed payload must not contain cycles.");
    seen.add(value);

    if(Array.isArray(value)){
      for(const item of value) visit(item,depth+1);
      seen.delete(value);
      return;
    }
    if(!isPlainObject(value)) throw new ManagedPayloadError("Managed payload objects must use a plain object prototype.");
    for(const [key,item] of Object.entries(value)){
      assertSafeKey(key);
      visit(item,depth+1);
    }
    seen.delete(value);
  };

  visit(input,0);
}

export function flattenJsonObject(input:JsonObject):Record<string,unknown>{
  assertJsonObject(input);
  const result:Record<string,unknown>={};

  const walk=(value:JsonValue,path:string):void=>{
    if(value===null||typeof value!=="object"){
      if(path) result[path]=value;
      return;
    }
    if(Array.isArray(value)){
      const arrayPath=path?path+"[]":"[]";
      if(value.length===0){
        if(path) result[arrayPath]=[];
        return;
      }
      for(const item of value) walk(item,arrayPath);
      return;
    }
    const entries=Object.entries(value);
    if(entries.length===0){
      if(path) result[path]={};
      return;
    }
    for(const [key,item] of entries){
      assertSafeKey(key);
      walk(item,path?path+"."+key:key);
    }
  };

  walk(input,"");
  return result;
}

export function removeJsonPaths(input:JsonObject,paths:readonly string[]):JsonObject{
  assertJsonObject(input);
  const clone=cloneJson(input) as JsonObject;
  for(const path of [...new Set(paths)]){
    if(!path.trim()) continue;
    if(Object.prototype.hasOwnProperty.call(clone,path)){
      delete clone[path];
      continue;
    }
    const tokens=parsePath(path);
    removeAt(clone,tokens,0);
  }
  return clone;
}

export function parseJsonBody(input:unknown):JsonObject{
  if(typeof input==="string"){
    let parsed:unknown;
    try{parsed=JSON.parse(input)}catch{throw new ManagedPayloadError("Request body is not valid JSON.");}
    assertJsonObject(parsed);
    return parsed;
  }
  assertJsonObject(input);
  return input;
}

interface PathToken { key:string; array:boolean }

function parsePath(path:string):PathToken[]{
  const raw=path.split(".");
  if(raw.length===0) throw new ManagedPayloadError("Managed field path is empty.");
  return raw.map((part)=>{
    const array=part.endsWith("[]");
    const key=array?part.slice(0,-2):part;
    if(!key) throw new ManagedPayloadError("Managed field path contains an empty segment.");
    assertSafeKey(key);
    if(!/^[A-Za-z0-9_$-]+$/.test(key)) throw new ManagedPayloadError("Managed field path contains an unsupported segment.");
    return {key,array};
  });
}

function removeAt(node:JsonValue,tokens:readonly PathToken[],index:number):void{
  if(index>=tokens.length||node===null||typeof node!=="object"||Array.isArray(node)) return;
  const token=tokens[index];
  if(!Object.prototype.hasOwnProperty.call(node,token.key)) return;
  const child=node[token.key];

  if(index===tokens.length-1){
    if(token.array){
      if(Array.isArray(child)) delete node[token.key];
    }else{
      delete node[token.key];
    }
    return;
  }

  if(token.array){
    if(!Array.isArray(child)) return;
    for(const item of child) removeAt(item,tokens,index+1);
    return;
  }
  removeAt(child,tokens,index+1);
}

function cloneJson(value:JsonValue):JsonValue{
  if(value===null||typeof value!=="object") return value;
  if(Array.isArray(value)) return value.map((item)=>cloneJson(item));
  const output:JsonObject={};
  for(const [key,item] of Object.entries(value)){
    assertSafeKey(key);
    output[key]=cloneJson(item);
  }
  return output;
}

function isPlainObject(value:unknown):value is Record<string,unknown>{
  if(typeof value!=="object"||value===null||Array.isArray(value)) return false;
  const proto=Object.getPrototypeOf(value);
  return proto===Object.prototype||proto===null;
}

function assertSafeKey(key:string):void{
  if(FORBIDDEN_KEYS.has(key)) throw new ManagedPayloadError("Managed payload contains a forbidden object key.");
}
