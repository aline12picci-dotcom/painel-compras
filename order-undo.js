
let UNDO_ORDER_ID='',UNDO_ORDER_BUSY=false;
function undoItemKey(x){return String(x.sc)+'|'+String(x.item);}
function undoOrderItems(o){return o.sourceItems?.length?o.sourceItems:(o.sourceSC?[{sc:o.sourceSC,item:o.sourceItem,descricao:o.sourceDescription||''}]:[]);}
function undoPreviousStatus(o,x,audit){const entries=audit.filter(a=>a.empresa===o.company&&String(a.sc)===String(x.sc)&&String(a.item)===String(x.item)&&/status/i.test(a.field||'')&&String(a.after||'').startsWith('Finalizada')&&String(a.after||'').includes(String(o.orderNumber))).sort((a,b)=>Number(b.ts)-Number(a.ts));return ['Em cotação','Aguarda cotação','Emitir PC'].includes(entries[0]?.before)?entries[0].before:'';}
function openUndoOrder(id){
 const o=ORDERS.find(x=>x.id===id);if(!o||o.voidedAt)return;const items=undoOrderItems(o);
 if(!items.length)return toast('Este pedido não tem SC vinculada para desfazer a baixa.','info');
 UNDO_ORDER_ID=id;qel('undo-order-title').textContent='Desfazer ação · PC '+o.orderNumber+' · '+o.company;
 qel('undo-order-reason').value='';
 qel('undo-order-items').innerHTML=items.map((x,i)=>{const prior=undoPreviousStatus(o,x,AUDIT);return `<div class="undo-item"><label><input type="checkbox" data-undo-index="${i}"> <strong>SC ${esc(x.sc)} / ${esc(x.item)}</strong> · ${esc(x.descricao||'')}</label><label>Retornar para <select data-undo-status="${i}"><option value="">${prior?'Selecione':'Status anterior não localizado — selecione'}</option>${['Em cotação','Aguarda cotação','Emitir PC'].map(st=>'<option '+(st===prior?'selected':'')+'>'+st+'</option>').join('')}</select></label></div>`;}).join('');
 openModal('undo-order-modal');
}
function buildOrderUndo(state,id,keys,statuses,reason,actor){
 const o=state.orders.find(x=>x.id===id);if(!o||o.voidedAt)throw Error('O pedido mudou. Atualize o painel.');
 const items=undoOrderItems(o),selected=items.filter(x=>keys.includes(undoItemKey(x)));
 if(!selected.length||selected.length!==new Set(keys).size)throw Error('Selecione itens ainda vinculados ao pedido.');
 if(!String(reason).trim())throw Error('Informe o motivo da correção.');
 const now=new Date().toISOString();
 for(const x of selected){
  const r=state.data.find(r=>r.empresa===o.company&&String(r.sc)===String(x.sc)&&String(r.item)===String(x.item));
  if(!r||r.status!=='Finalizada')throw Error('SC '+x.sc+' / '+x.item+' mudou ou não está finalizada. Atualize o painel.');
  if(!['Em cotação','Aguarda cotação','Emitir PC'].includes(statuses[undoItemKey(x)]))throw Error('Escolha o status de retorno de cada item.');
  if(state.orders.some(other=>other.id!==id&&!other.voidedAt&&other.company===o.company&&undoOrderItems(other).some(t=>undoItemKey(t)===undoItemKey(x))))throw Error('Há outro pedido vinculado à SC '+x.sc+' / '+x.item+'. Confira antes de desfazer.');
 }
 const original=JSON.parse(JSON.stringify(o));o.sourceItems=items.filter(x=>!keys.includes(undoItemKey(x)));
 if(!o.sourceItems.length){o.voidedAt=now;o.statusBeforeUndo=o.status;o.status='Baixa desfeita';o.sourceSC='';o.sourceItem='';}
 else if(keys.includes(undoItemKey({sc:o.sourceSC,item:o.sourceItem}))){o.sourceSC=o.sourceItems[0].sc;o.sourceItem=o.sourceItems[0].item;o.sourceDescription=o.sourceItems[0].descricao||'';}
 o.undoHistory??=[];o.undoHistory.push({at:now,by:actor,reason:reason.trim(),items:selected,previousOrderStatus:original.status});
 o.clientMutationAt=now;o.lastMovementAt=now;o.lastUpdatedBy=actor;
 for(const x of selected){const r=state.data.find(r=>r.empresa===o.company&&String(r.sc)===String(x.sc)&&String(r.item)===String(x.item));delete r.closedAt;delete r.closedBy;r.status=statuses[undoItemKey(x)];r.clientMutationAt=now;r.lastMovementAt=now;r.lastUpdatedBy=actor;
 state.audit.unshift({ts:Date.now(),user:actor,empresa:o.company,sc:x.sc,item:x.item,field:'Desfazer ação',before:'Finalizada — PC '+o.orderNumber,after:r.status+' · Motivo: '+reason.trim(),reason:reason.trim()});}
 state.audit.unshift({ts:Date.now(),user:actor,empresa:o.company,sc:o.orderNumber,item:'Pedido',field:'Desfazer ação — vínculos',before:JSON.stringify(original.sourceItems||[]),after:JSON.stringify(o.sourceItems),reason:reason.trim()});
 return {state,order:o,selected,original,at:now};
}
function undoQuoteItems(q,order,keys,reason,actor){
 if(q.company!==order.company)return null;
 const matches=keys.filter(key=>q.completedItems?.[key]&&sameOrderNumber(q.completedItems[key].pc,order.orderNumber));
 if(!matches.length)return null;if(q.closingPlan?.state==='pending')throw Error('Há um fechamento pendente nesta cotação. Conclua a sincronização antes de desfazer.');
 const copy=JSON.parse(JSON.stringify(q));for(const key of matches){delete copy.completedItems[key];if(copy.itemAwards)delete copy.itemAwards[key];}
 if(copy.closingPlan?.groups){copy.closingPlan.groups=copy.closingPlan.groups.map(g=>({...g,items:g.items.filter(x=>!matches.includes(undoItemKey(x)))})).filter(g=>g.items.length);if(!copy.closingPlan.groups.length)copy.closingPlan=null;}
 copy.status=Object.keys(copy.completedItems||{}).length?'Parcialmente finalizado':copy.suppliers.some(s=>s.sentAt)?'Aguardando propostas':'Em preparação';copy.finishedAt=null;copy.updatedAt=new Date().toISOString();copy.events??=[];copy.events.push({action:'baixa_desfeita',at:copy.updatedAt,by:actor,detail:'PC '+order.orderNumber+' · '+matches.join(', ')+' · '+reason});return copy;
}
async function confirmUndoOrder(event){
 event.preventDefault();if(UNDO_ORDER_BUSY)return;if(quoteDirty)return toast('Salve as alterações abertas na cotação antes de desfazer a baixa.','err');
 const old=ORDERS.find(o=>o.id===UNDO_ORDER_ID);if(!old)return;
 const items=undoOrderItems(old),keys=[...document.querySelectorAll('[data-undo-index]:checked')].map(el=>undoItemKey(items[+el.dataset.undoIndex])),statuses={};
 document.querySelectorAll('[data-undo-status]').forEach(el=>statuses[undoItemKey(items[+el.dataset.undoStatus])]=el.value);
 const reason=qel('undo-order-reason').value.trim();if(!keys.length||!reason)return toast('Selecione os itens e informe o motivo.','err');
 UNDO_ORDER_BUSY=true;qel('undo-order-submit').disabled=true;
 try{
  if(!await flushClosingPanel())throw Error('Há alterações pendentes de gravação. Tente novamente após sincronizar.');
  const version=_changeVersion,server=await jbRead(),state={data:JSON.parse(JSON.stringify(server.data||[])),orders:JSON.parse(JSON.stringify(server.orders||[])),audit:JSON.parse(JSON.stringify(server.audit||[])),users:server.users||USERS};
  const result=buildOrderUndo(state,UNDO_ORDER_ID,keys,statuses,reason,ACTIVE_USER);
  const quotes=(await qRequest('GET')).quotes||[];
  for(const q of quotes){const updated=undoQuoteItems(q,result.original,keys,reason,ACTIVE_USER);if(updated)await qRequest('POST',{quote:updated,expectedRevision:q._serverVersion||0});}
  if(_changeVersion!==version)throw Error('O painel recebeu outra alteração durante a correção. Tente novamente.');
  await jbWrite(state);
  const verified=await jbRead(),savedOrder=(verified.orders||[]).find(o=>o.id===UNDO_ORDER_ID);
  if(!savedOrder||keys.some(key=>undoOrderItems(savedOrder).some(x=>undoItemKey(x)===key))||keys.some(key=>!verified.data.some(r=>r.empresa===result.original.company&&undoItemKey(r)===key&&r.status===statuses[key])))throw Error('A correção não foi confirmada na base. Atualize e confira antes de tentar novamente.');
  if(_changeVersion===version)loadAuthoritativeServerState(verified);else mergeServerState(verified);
  saveLocal();closeModal('undo-order-modal');refreshAll();await loadQuotes();if(QUOTE&&!quoteDirty){const fresh=QUOTES.find(q=>q.id===QUOTE.id);if(fresh){QUOTE=qNormalize(JSON.parse(JSON.stringify(fresh)));renderQuote();}}
  toast('Ação desfeita. Itens devolvidos à fila e vínculos corrigidos no painel. O Protheus não foi alterado.','ok',8500);
 }catch(e){toast('Não foi possível concluir: '+e.message+' Se a cotação já foi reaberta, a correção pode ser retomada.','err',11000);}
 finally{UNDO_ORDER_BUSY=false;qel('undo-order-submit').disabled=false;}
}
