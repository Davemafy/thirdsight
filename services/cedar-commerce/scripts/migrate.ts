import { readFile,readdir } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const url=process.env.DATABASE_URL;
if(!url)throw new Error("DATABASE_URL is required.");
const sql=postgres(url,{max:1});
await sql`create schema if not exists cedar_meta`;
await sql`create table if not exists cedar_meta.migrations(name text primary key,applied_at timestamptz not null default now())`;
for(const name of (await readdir(join(process.cwd(),"migrations"))).filter(f=>f.endsWith(".sql")).sort()){
  const [existing]=await sql`select name from cedar_meta.migrations where name=${name}`;
  if(existing)continue;
  const source=await readFile(join(process.cwd(),"migrations",name),"utf8");
  await sql.begin(async tx=>{await tx.unsafe(source);await tx`insert into cedar_meta.migrations(name) values(${name})`;});
  console.log(`Applied ${name}`);
}
await sql.end();
