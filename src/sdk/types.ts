import type { ManagedRequestContext } from "../managed/types.js";
import type { JsonObject } from "../managed/payload-paths.js";

export interface ThirdSightOptions {
  baseUrl:string;
  apiKey:string;
  environment?:string;
  fetchImpl?:typeof fetch;
}

export interface ThirdSightFetchOptions {
  method?:string;
  body?:JsonObject;
  headers?:Record<string,string>;
  context?:ManagedRequestContext;
}
