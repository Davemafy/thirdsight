import type { ThirdSightFetchOptions, ThirdSightOptions } from "./types.js";

export class ThirdSight {
  private readonly baseUrl:string;
  private readonly apiKey:string;
  private readonly environment?:string;
  private readonly fetchImpl:typeof fetch;

  constructor(options:ThirdSightOptions){
    const url=new URL(options.baseUrl);
    const local=url.hostname==="localhost"||url.hostname==="127.0.0.1";
    if(url.protocol!=="https:"&&!(local&&url.protocol==="http:")){
      throw new Error("ThirdSight baseUrl must use HTTPS outside localhost.");
    }
    if(options.apiKey.trim().length<16) throw new Error("ThirdSight apiKey must be at least 16 characters.");
    this.baseUrl=url.origin;
    this.apiKey=options.apiKey.trim();
    this.environment=options.environment;
    this.fetchImpl=options.fetchImpl??fetch;
  }

  integration(id:string):ThirdSightIntegration{
    const normalized=id.trim();
    if(!normalized) throw new Error("ThirdSight integration id is required.");
    return new ThirdSightIntegration(this,normalized);
  }

  wrapFetch(id:string){
    const integration=this.integration(id);
    return (path:string,options:ThirdSightFetchOptions={})=>integration.fetch(path,options);
  }

  async request(integrationId:string,path:string,options:ThirdSightFetchOptions={}):Promise<Response>{
    if(!path.startsWith("/")) throw new Error("ThirdSight integration path must start with /.");
    const endpoint=new URL("/api/managed-gateway",this.baseUrl);
    endpoint.searchParams.set("integration",integrationId);
    endpoint.searchParams.set("path",path);
    if(this.environment) endpoint.searchParams.set("environment",this.environment);

    const method=(options.method??"POST").toUpperCase();
    const headers=new Headers(options.headers);
    headers.set("authorization","Bearer "+this.apiKey);
    if(!headers.has("content-type")) headers.set("content-type","application/json");
    if(options.context){
      const encoded=JSON.stringify(options.context);
      if(encoded.length>4096) throw new Error("ThirdSight request context exceeds the 4096-character header limit.");
      headers.set("x-thirdsight-context",encoded);
    }

    return this.fetchImpl(endpoint,{
      method,
      headers,
      body:method==="GET"||method==="HEAD"?undefined:JSON.stringify(options.body??{}),
      redirect:"manual",
    });
  }
}

export class ThirdSightIntegration {
  constructor(private readonly client:ThirdSight,readonly id:string){}

  fetch(path:string,options:ThirdSightFetchOptions={}):Promise<Response>{
    return this.client.request(this.id,path,options);
  }
}
