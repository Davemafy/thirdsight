import type { JsonObject } from "../managed/payload-paths.js";

export interface ForwardRequestInput {
  url:URL;
  method:string;
  headers:Headers;
  body:JsonObject;
  timeoutMs:number;
  fetchImpl:typeof fetch;
}

export async function forwardRegisteredRequest(input:ForwardRequestInput):Promise<Response>{
  return forwardOnce({
    url:input.url,
    method:input.method,
    headers:input.headers,
    body:input.method.toUpperCase()==="GET"||input.method.toUpperCase()==="HEAD"
      ?undefined
      :JSON.stringify(input.body),
    timeoutMs:input.timeoutMs,
    fetchImpl:input.fetchImpl,
  });
}

export async function forwardOpaqueRequest(input:{
  url:URL;
  method:string;
  headers:Headers;
  body:string|undefined;
  timeoutMs:number;
  fetchImpl:typeof fetch;
}):Promise<Response>{
  return forwardOnce(input);
}

async function forwardOnce(input:{
  url:URL;
  method:string;
  headers:Headers;
  body:string|undefined;
  timeoutMs:number;
  fetchImpl:typeof fetch;
}):Promise<Response>{
  const controller=new AbortController();
  const timeout=globalThis.setTimeout(()=>controller.abort(),input.timeoutMs);
  try{
    return await input.fetchImpl(input.url,{
      method:input.method.toUpperCase(),
      headers:input.headers,
      body:input.body,
      redirect:"manual",
      cache:"no-store",
      signal:controller.signal,
    });
  }finally{
    globalThis.clearTimeout(timeout);
  }
}
