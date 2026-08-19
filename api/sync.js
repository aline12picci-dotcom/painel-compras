const SYNC_URL='https://tgrlhiznrguxdlbrluqq.supabase.co/functions/v1/panel-sync';

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','https://painel-compras.vercel.app');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método não permitido'});
  try{
    const upstream=await fetch(SYNC_URL,{
      method:req.method,
      headers:{Authorization:String(req.headers.authorization||''),'Content-Type':'application/json','Cache-Control':'no-store'},
      body:req.method==='POST'?JSON.stringify(req.body||{}):undefined,
      cache:'no-store'
    });
    const text=await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type',upstream.headers.get('content-type')||'application/json');
    return res.send(text);
  }catch(error){
    console.error('[sync proxy]',error);
    return res.status(502).json({error:'Base protegida temporariamente indisponível'});
  }
}
