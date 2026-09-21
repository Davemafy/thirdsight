const INTEGRATION_ID=/^[a-z0-9][a-z0-9-]{1,79}$/;

export class ThirdSight {
  #baseUrl;
  #apiKey;
  #environment;
  #fetch;

  constructor(options={}){
    if(typeof options!=="object"||options===null) throw new TypeError("ThirdSight options are required.");
    let baseUrl;
    try{baseUrl=new URL(options.baseUrl)}catch{throw new TypeError("ThirdSight baseUrl must be a valid HTTPS URL.");}
    if(baseUrl.protocol!=="https:") throw new TypeError("ThirdSight baseUrl must use HTTPS.");
    if(baseUrl.username||baseUrl.password) throw new TypeError("ThirdSight baseUrl must not contain credentials.");
    if(baseUrl.search||baseUrl.hash) throw new TypeError("ThirdSight baseUrl must not contain a query string or fragment.");
    if(typeof options.apiKey!=="string"||options.apiKey.trim().length<16) throw new TypeError("ThirdSight apiKey must be at least 16 characters.");
    if(options.environment!==undefined&&(typeof options.environment!=="string"||!options.environment.trim())) throw new TypeError("ThirdSight environment must be a non-empty string when provided.");
    if(options.fetch!==undefined&&typeof options.fetch!=="function") throw new TypeError("ThirdSight fetch must be a function when provided.");
    this.#baseUrl=baseUrl.origin;
    this.#apiKey=options.apiKey.trim();
    this.#environment=options.environment?.trim();
    this.#fetch=options.fetch??globalThis.fetch;
    if(typeof this.#fetch!=="function") throw new TypeError("A Fetch API implementation is required.");
  }

  integration(integrationId){
    const id=validateIntegrationId(integrationId);
    return new ThirdSightIntegration(this,id);
  }

  async request(integrationId,path,options={}){
    const id=validateIntegrationId(integrationId);
    const requestPath=validatePath(path);
    if(typeof options!=="object"||options===null) throw new TypeError("ThirdSight request options must be an object.");

    const endpoint=new URL("/api/managed-gateway",this.#baseUrl);
    endpoint.searchParams.set("integration",id);
    endpoint.searchParams.set("path",requestPath);
    if(this.#environment) endpoint.searchParams.set("environment",this.#environment);

    const method=String(options.method??"POST").trim().toUpperCase();
    if(!/^[A-Z]+$/.test(method)) throw new TypeError("ThirdSight method is invalid.");
    const headers=new Headers(options.headers);
    headers.set("authorization",`Bearer ${this.#apiKey}`);
    if(!headers.has("content-type")) headers.set("content-type","application/json");

    if(options.context!==undefined){
      const context=JSON.stringify(options.context);
      if(context.length>4096) throw new TypeError("ThirdSight context exceeds the 4096-character header limit.");
      headers.set("x-thirdsight-context",context);
    }

    const body=method==="GET"||method==="HEAD"
      ?undefined
      :JSON.stringify(options.body??{});

    return this.#fetch(endpoint,{
      method,
      headers,
      body,
      redirect:"manual",
    });
  }
}

export class ThirdSightIntegration {
  constructor(client,id){
    this.client=client;
    this.id=id;
  }

  fetch(path,options={}){
    return this.client.request(this.id,path,options);
  }

  request(path,options={}){
    return this.client.request(this.id,path,options);
  }
}

function validateIntegrationId(value){
  if(typeof value!=="string") throw new TypeError("ThirdSight integration id must be a string.");
  const id=value.trim();
  if(!INTEGRATION_ID.test(id)) throw new TypeError("ThirdSight integration id is invalid.");
  return id;
}

function validatePath(value){
  if(typeof value!=="string") throw new TypeError("ThirdSight integration path must be a string.");
  const path=value.trim();
  if(!path.startsWith("/")||path.startsWith("//")||path.includes("\\")||/[\r\n]/.test(path)){
    throw new TypeError("ThirdSight integration path must be a safe absolute path.");
  }
  return path;
}