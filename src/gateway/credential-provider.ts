import type { CredentialSpec } from "./gateway-types.js";
import type { JsonObject } from "../managed/payload-paths.js";

export class CredentialUnavailableError extends Error {
  constructor(message:string){
    super(message);
    this.name="CredentialUnavailableError";
  }
}

export interface AppliedCredential {
  url:URL;
  headers:Headers;
  body:JsonObject;
}

export function applyCredential(input:{
  spec:CredentialSpec;
  env:Record<string,string|undefined>;
  url:URL;
  headers:Headers;
  body:JsonObject;
}):AppliedCredential{
  const url=new URL(input.url.toString());
  const headers=new Headers(input.headers);
  const body=cloneObject(input.body);
  if(input.spec.kind==="NONE") return {url,headers,body};

  const value=input.env[input.spec.env]?.trim();
  if(!value) throw new CredentialUnavailableError("Credential environment variable is not configured for this integration.");

  if(input.spec.kind==="BEARER"){
    headers.set("authorization","Bearer "+value);
  }else if(input.spec.kind==="HEADER"||input.spec.kind==="API_KEY_HEADER"){
    headers.set(input.spec.header,(input.spec.kind==="HEADER"&&input.spec.prefix?input.spec.prefix:"")+value);
  }else if(input.spec.kind==="BODY_FIELD"){
    if(input.spec.field.includes(".")||input.spec.field.includes("[")||input.spec.field.includes("]")) throw new CredentialUnavailableError("Credential body field must be a top-level safe key.");
    body[input.spec.field]=value;
  }else if(input.spec.kind==="QUERY_PARAM"){
    url.searchParams.set(input.spec.param,value);
  }

  return {url,headers,body};
}

function cloneObject(input:JsonObject):JsonObject{
  return JSON.parse(JSON.stringify(input)) as JsonObject;
}
