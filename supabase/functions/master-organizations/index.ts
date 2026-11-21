import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const fail=(message:string,status=400)=>reply({error:message},status);
const slugOk=(v:string)=>/^[a-z0-9-]{2,80}$/.test(v);
const usernameOk=(v:string)=>/^[a-z0-9._-]{3,40}$/.test(v);
const colorOk=(v:unknown)=>typeof v==="string"&&/^#[0-9a-fA-F]{6}$/.test(v);
const statusOk=(v:unknown)=>["active","suspended","trial","cancelled"].includes(String(v));
const safeLogo=(v:unknown)=>v===null||v===""||(typeof v==="string"&&v.length<=2048&&/^https:\/\//i.test(v));

export default {fetch:withSupabase({auth:"user"},async(req,ctx)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return fail("Método não permitido.",405);
  const actorId=ctx.userClaims?.id;
  if(!actorId)return fail("Faça login novamente.",401);
  let body:Record<string,unknown>;
  try{body=await req.json()}catch{return fail("Solicitação inválida.")}
  const action=String(body.action??"");
  if(!["list","create","update","status"].includes(action))return fail("Ação inválida.");
  const {data:master,error:masterError}=await ctx.supabaseAdmin.from("platform_admins")
    .select("user_id").eq("user_id",actorId).eq("active",true).maybeSingle();
  if(masterError){console.error("Falha ao validar Master:",masterError);return fail("Não foi possível validar o acesso.",500)}
  if(!master)return fail("Acesso restrito ao administrador da plataforma.",403);

  if(action==="list"){
    const {data,error}=await ctx.supabaseAdmin.from("organizations")
      .select("id,name,slug,brand_name,logo_url,primary_color,secondary_color,accent_color,status,created_at,updated_at")
      .order("created_at",{ascending:false});
    if(error){console.error("Falha ao listar empresas:",error);return fail("Não foi possível listar as empresas.",500)}
    return reply({ok:true,organizations:data??[]});
  }

  if(action==="create"){
    const name=String(body.name??"").trim().slice(0,160);
    const slug=String(body.slug??"").trim().toLowerCase();
    const brandName=String(body.brand_name??name).trim().slice(0,160);
    const username=String(body.admin_username??"").trim().toLowerCase();
    const password=String(body.admin_password??"");
    const displayName=String(body.admin_display_name??"").trim().slice(0,120);
    const primary=body.primary_color??"#14532d",secondary=body.secondary_color??"#166534",accent=body.accent_color??"#f59e0b";
    const logo=body.logo_url??null;
    if(!name||!slugOk(slug)||!brandName)return fail("Nome, marca ou identificador da empresa inválido.");
    if(!usernameOk(username)||password.length<8||password.length>128||!displayName)return fail("Dados do administrador inicial inválidos.");
    if(!colorOk(primary)||!colorOk(secondary)||!colorOk(accent)||!safeLogo(logo))return fail("Personalização inválida. Use cores hexadecimais e uma URL HTTPS para a logo.");
    const {data:existing,error:existsError}=await ctx.supabaseAdmin.from("organizations").select("id").eq("slug",slug).maybeSingle();
    if(existsError)return fail("Não foi possível validar o identificador.",500);
    if(existing)return fail("Este identificador de empresa já está em uso.",409);
    const {data:org,error:orgError}=await ctx.supabaseAdmin.from("organizations").insert({
      name,slug,brand_name:brandName,logo_url:logo,primary_color:primary,secondary_color:secondary,accent_color:accent,status:"trial"
    }).select("id,name,slug,status").single();
    if(orgError||!org){console.error("Falha ao criar empresa:",orgError);return fail("Não foi possível criar a empresa.",400)}
    const email=username+"."+org.id.slice(0,8)+"@login.supertudo.app";
    const {data:created,error:authError}=await ctx.supabaseAdmin.auth.admin.createUser({
      email,password,email_confirm:true,user_metadata:{display_name:displayName,username,internal_account:true}
    });
    if(authError||!created.user){
      await ctx.supabaseAdmin.from("organizations").delete().eq("id",org.id);
      console.error("Falha ao criar administrador inicial:",authError);
      return fail("Empresa não criada: não foi possível criar o administrador inicial.",400);
    }
    const uid=created.user.id;
    const {error:profileError}=await ctx.supabaseAdmin.from("profiles").insert({
      id:uid,username:username+"."+org.id.slice(0,8),login_email:email,display_name:displayName,full_name:displayName,active:true
    });
    if(profileError){
      await ctx.supabaseAdmin.auth.admin.deleteUser(uid);
      await ctx.supabaseAdmin.from("organizations").delete().eq("id",org.id);
      console.error("Falha ao criar perfil Master:",profileError);
      return fail("Empresa não criada: falha ao registrar o administrador.",400);
    }
    const {error:memberError}=await ctx.supabaseAdmin.from("org_members").insert({
      org_id:org.id,user_id:uid,role:"admin",active:true,username,permissions:[]
    });
    if(memberError){
      await ctx.supabaseAdmin.from("profiles").delete().eq("id",uid);
      await ctx.supabaseAdmin.auth.admin.deleteUser(uid);
      await ctx.supabaseAdmin.from("organizations").delete().eq("id",org.id);
      console.error("Falha ao vincular administrador inicial:",memberError);
      return fail("Empresa não criada: falha ao vincular o administrador.",400);
    }
    const {error:auditError}=await ctx.supabaseAdmin.from("platform_admin_audit").insert({
      actor_user_id:actorId,action:"organization.created",target_org_id:org.id,
      details:{name,slug,admin_username:username}
    });
    if(auditError)console.error("Falha ao registrar auditoria de criação:",auditError);
    return reply({ok:true,organization:org,admin:{user_id:uid,username}});
  }

  const orgId=String(body.org_id??"").trim();
  if(!orgId)return fail("Empresa não identificada.");
  if(action==="status"){
    const status=body.status;
    if(!statusOk(status))return fail("Situação inválida.");
    const {data:before,error:readError}=await ctx.supabaseAdmin.from("organizations").select("id,status").eq("id",orgId).maybeSingle();
    if(readError||!before)return fail("Empresa não encontrada.",404);
    const {data:updated,error}=await ctx.supabaseAdmin.from("organizations").update({status,updated_at:new Date().toISOString()})
      .eq("id",orgId).select("id,name,slug,status").single();
    if(error||!updated)return fail("Não foi possível alterar a situação da empresa.",500);
    const {error:auditError}=await ctx.supabaseAdmin.from("platform_admin_audit").insert({
      actor_user_id:actorId,action:"organization.status_changed",target_org_id:orgId,
      details:{from:before.status,to:status}
    });
    if(auditError)console.error("Falha ao registrar auditoria de situação:",auditError);
    return reply({ok:true,organization:updated});
  }

  const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
  const allowed=["name","brand_name","logo_url","primary_color","secondary_color","accent_color","slug"];
  for(const key of allowed)if(Object.prototype.hasOwnProperty.call(body,key)){
    const value=body[key];
    if(key==="slug"){const s=String(value??"").trim().toLowerCase();if(!slugOk(s))return fail("Identificador inválido.");patch.slug=s;}
    else if(key==="name"||key==="brand_name"){const s=String(value??"").trim().slice(0,160);if(!s)return fail("Nome inválido.");patch[key]=s;}
    else if(key==="logo_url"){if(!safeLogo(value))return fail("A logo precisa usar uma URL HTTPS.");patch.logo_url=value||null;}
    else {if(!colorOk(value))return fail("Cor inválida.");patch[key]=value;}
  }
  if(Object.keys(patch).length===1)return fail("Nenhuma alteração enviada.");
  const {data:updated,error}=await ctx.supabaseAdmin.from("organizations").update(patch).eq("id",orgId)
    .select("id,name,slug,brand_name,logo_url,primary_color,secondary_color,accent_color,status,updated_at").maybeSingle();
  if(error||!updated){console.error("Falha ao atualizar empresa:",error);return fail("Não foi possível atualizar a empresa. Verifique se o identificador já existe.",400)}
  const {error:auditError}=await ctx.supabaseAdmin.from("platform_admin_audit").insert({
    actor_user_id:actorId,action:"organization.updated",target_org_id:orgId,
    details:{fields:Object.keys(patch).filter(k=>k!=="updated_at")}
  });
  if(auditError)console.error("Falha ao registrar auditoria de atualização:",auditError);
  return reply({ok:true,organization:updated});
})};
