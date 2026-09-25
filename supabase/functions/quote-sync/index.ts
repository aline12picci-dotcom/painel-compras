import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers={"Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const url=Deno.env.get('SUPABASE_URL')||'';
function key(){const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(legacy)return legacy;const raw=Deno.env.get('SUPABASE_SECRET_KEYS');if(raw){try{const x=JSON.parse(raw);return x.default||Object.values(x)[0] as string}catch{}}return Deno.env.get('SUPABASE_SECRET_KEY')||''}

Deno.serve(async req=>{
  if(!['GET','POST'].includes(req.method))return reply({error:'Método não permitido'},405);
  // Reuse the panel's authoritative credentials and identity, including revocations.
  const authorized=await fetch(url+'/functions/v1/panel-sync',{headers:{Authorization:req.headers.get('Authorization')||''},cache:'no-store'});
  if(!authorized.ok)return reply({error:'Acesso não autorizado'},401);
  const profile=(await authorized.json()).authProfile;
  if(!profile?.full_name)return reply({error:'Sessão inválida'},401);
  const secret=key();if(!secret)return reply({error:'Configuração indisponível'},503);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    if(req.method==='GET'){
      const rows:any[]=[];
      for(let from=0;;from+=500){const {data,error}=await db.from('panel_entities').select('entity_key,payload,revision').eq('kind','quote').order('entity_key').range(from,from+499);if(error)throw error;rows.push(...data||[]);if((data||[]).length<500)break}
      return reply({quotes:rows.map(x=>({...x.payload,_serverVersion:x.revision}))});
    }
    const body=await req.json(),q=body?.quote;
    if(!q||typeof q!=='object'||typeof q.id!=='string'||!/^COT-[0-9A-Za-z-]{10,80}$/.test(q.id)||q.company!=='Pharmabag'||!Array.isArray(q.items)||q.items.length<1||q.items.length>300||!Array.isArray(q.suppliers)||q.suppliers.length!==5)return reply({error:'Processo de cotação inválido'},400);
    if(q.items.some((x:any)=>typeof x.sc!=='string'||typeof x.item!=='string'||typeof x.description!=='string'||typeof x.quantity!=='string'||typeof x.unit!=='string'))return reply({error:'Itens incompletos'},400);
    if(q.suppliers.some((x:any)=>!x||typeof x!=='object'||typeof x.email!=='string'))return reply({error:'Fornecedores inválidos'},400);
    const payload={...q};delete payload._serverVersion;
    // A save is conditional on the version read by the editor; stale tabs cannot overwrite a colleague's changes.
    const revision=Number(body.expectedRevision||0),now=new Date().toISOString();
    if(revision){const {data,error}=await db.from('panel_entities').update({payload,revision:revision+1,mutation_at:now,updated_at:now,updated_by:profile.full_name}).eq('kind','quote').eq('entity_key',q.id).eq('revision',revision).select('revision').maybeSingle();if(error)throw error;if(!data)return reply({error:'Este processo mudou em outra sessão. Atualize antes de salvar.'},409);return reply({revision:data.revision})}
    const {data,error}=await db.from('panel_entities').insert({kind:'quote',entity_key:q.id,payload,revision:1,mutation_at:now,updated_at:now,updated_by:profile.full_name}).select('revision').single();
    if(error){if(error.code==='23505')return reply({error:'Processo já existe. Atualize a lista.'},409);throw error}
    return reply({revision:data.revision},201);
  }catch(e){console.error('[quote-sync]',e);return reply({error:'Não foi possível salvar a cotação'},500)}
});
