import { describe, expect, it } from "vitest";
import { assertJsonObject, flattenJsonObject, ManagedPayloadError, removeJsonPaths } from "./payload-paths.js";

describe("managed JSON paths",()=>{
  it("flattens nested objects and arrays with a stable [] convention",()=>{
    const paths=Object.keys(flattenJsonObject({customer:{phone:"+234",name:"Ada"},items:[{sku:"A",qty:1},{sku:"B",qty:2}],tags:["new","sale"]})).sort();
    expect(paths).toEqual(["customer.name","customer.phone","items[].qty","items[].sku","tags[]"]);
  });

  it("removes legacy flat semantic keys without touching siblings",()=>{
    const result=removeJsonPaths({"product.id":"p1","customer.phone":"+234"},["customer.phone"]);
    expect(result).toEqual({"product.id":"p1"});
  });

  it("removes a nested field without touching siblings",()=>{
    const result=removeJsonPaths({customer:{phone:"+234",name:"Ada"},product:{id:"p1"}},["customer.phone"]);
    expect(result).toEqual({customer:{name:"Ada"},product:{id:"p1"}});
  });

  it("removes a field from every object in an array",()=>{
    const result=removeJsonPaths({items:[{sku:"A",secret:"x"},{sku:"B",secret:"y"}]},["items[].secret"]);
    expect(result).toEqual({items:[{sku:"A"},{sku:"B"}]});
  });

  it("handles null and empty objects without inventing fields",()=>{
    expect(flattenJsonObject({profile:null,metadata:{},items:[]})).toEqual({profile:null,metadata:{}, "items[]":[]});
  });

  it("rejects cycles",()=>{
    const value:Record<string,unknown>={};
    value.self=value;
    expect(()=>assertJsonObject(value)).toThrow(ManagedPayloadError);
  });

  it("rejects prototype-pollution keys",()=>{
    const value=JSON.parse('{"safe":1,"__proto__":{"polluted":true}}');
    expect(()=>assertJsonObject(value)).toThrow(ManagedPayloadError);
  });

  it("deduplicates removal paths",()=>{
    expect(removeJsonPaths({a:{b:1,c:2}},["a.b","a.b"])).toEqual({a:{c:2}});
  });
});
