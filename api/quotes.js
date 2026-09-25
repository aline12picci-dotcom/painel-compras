const URL='https://tgrlhiznrguxdlbrluqq.supabase.co/functions/v1/quote-sync';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método não permitido'});
  try{
    const upstream=await fetch(URL,{method:req.method,headers:{Authorization:String(req.headers.authorization||''),'Content-Type':'application/json'},body:req.method==='POST'?JSON.stringify(req.body||{}):undefined,cache:'no-store'});
    res.status(upstream.status).setHeader('Content-Type','application/json');
    return res.send(await upstream.text());
  }catch(e){return res.status(502).json({error:'Não foi possível acessar os processos de cotação'});}
}
