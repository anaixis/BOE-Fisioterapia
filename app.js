'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='fisiomadrid-v2';
const fresh=()=>({version:2,studied:{},records:{},draft:null});
let state=fresh(),storageOK=true,active=null,answers=[],graded=false,endAt=0,timerId=null,lastQuestion=null;
try{const raw=localStorage.getItem(KEY);if(raw)state=normalize(JSON.parse(raw));localStorage.setItem(KEY,JSON.stringify(state));}catch(e){storageOK=false;}
function validId(k){return Object.prototype.hasOwnProperty.call(DATA.tests,k);}
function normalize(x){
 if(!x||x.version!==2||typeof x.studied!=='object'||typeof x.records!=='object')throw Error('Formato de copia no reconocido.');
 const s=fresh();for(let n=1;n<=50;n++)if(x.studied[n]===true)s.studied[n]=true;
 for(const [id,r]of Object.entries(x.records||{})){
  if(!validId(id)||!r||!Number.isFinite(r.best)||!Number.isInteger(r.attempts)||r.attempts<1)continue;
  const total=id.startsWith('m')?80:20;
  if(r.best< -total/3-.001||r.best>total)continue;
  if(!Number.isFinite(r.net)||r.net< -total/3-.001||r.net>total)continue;
  if(![r.correct,r.wrong,r.blank].every(v=>Number.isInteger(v)&&v>=0&&v<=total)||r.correct+r.wrong+r.blank!==total)continue;
  s.records[id]={best:r.best,net:r.net,correct:r.correct,wrong:r.wrong,blank:r.blank,attempts:Math.min(r.attempts,100000),at:typeof r.at==='string'&&Number.isFinite(Date.parse(r.at))?r.at:new Date().toISOString()};
 }
 const d=x.draft;if(d&&validId(d.id)&&Array.isArray(d.answers)&&d.answers.length===DATA.tests[d.id].length&&d.answers.every(v=>Number.isInteger(v)&&v>=-1&&v<4)&&Number.isFinite(d.endAt))s.draft={id:d.id,answers:d.answers,endAt:d.endAt};
 return s;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch(e){storageOK=false;}$('storagewarning').hidden=storageOK;}
$('storagewarning').hidden=storageOK;
function sourceLinks(topic){return DATA.topics[topic-1].sources.map(k=>{const s=DATA.sources[k];return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>${s.fallback?`<a href="${esc(s.fallback)}" target="_blank" rel="noopener noreferrer">Alternativa BOE 2010 (completar actualizaciones) ↗</a>`:''}`;}).join('');}
function syncChecks(){document.querySelectorAll('[data-studied]').forEach(c=>{c.checked=state.studied[c.dataset.studied]===true;});}
syncChecks();
document.querySelectorAll('[data-studied]').forEach(c=>c.addEventListener('change',()=>{state.studied[c.dataset.studied]=c.checked;save();renderProgress();}));
function filterTopics(){const q=$('search').value.toLocaleLowerCase('es').trim();const block=$('block').value;let found=0;document.querySelectorAll('details.topic').forEach(el=>{const n=Number(el.dataset.n);const match=(!q||el.textContent.toLocaleLowerCase('es').includes(q)||String(n)===q)&& (block==='all'||(block==='general'?n<=14:n>14));el.hidden=!match;if(match)found++;});$('topiccount').textContent=`${found} temas`;$('notopics').hidden=found>0;}
$('search').addEventListener('input',filterTopics);$('block').addEventListener('change',filterTopics);
function revealHash(){if(/^#tema-\d+$/.test(location.hash)){const el=document.querySelector(location.hash);if(el){el.open=true;el.hidden=false;}}}
window.addEventListener('hashchange',revealHash);revealHash();
function modeChange(){$('topiccontrol').hidden=$('mode').value==='mixed';}
$('mode').addEventListener('change',modeChange);
document.querySelectorAll('[data-train]').forEach(a=>a.addEventListener('click',()=>{$('mode').value='topic';$('topicselect').value=a.dataset.train;modeChange();$('examselect').value='1';}));
document.querySelectorAll('[data-prompt]').forEach(a=>a.addEventListener('click',()=>{$('prompttopic').value=a.dataset.prompt;updatePrompt();}));
function chosenId(){return $('mode').value==='mixed'?`m${$('examselect').value}`:`t${$('topicselect').value}-${$('examselect').value}`;}
function titleFor(id){if(id[0]==='m'){const e=Number(id.slice(1));return e===50?'Mixto 50 · Examen final':`Mixto ${e}`;}const [t,e]=id.slice(1).split('-');return `Tema ${t} · ${DATA.topics[Number(t)-1].title} · Test ${e}`;}
function draftSave(){if(active&&!graded){state.draft={id:active,answers:[...answers],endAt};save();}}
function start(force=false){
 const id=chosenId();if(!validId(id))return;
 active=id;graded=false;lastQuestion=null;
 const draft=!force&&state.draft&&state.draft.id===id?state.draft:null;
 answers=draft?[...draft.answers]:Array(DATA.tests[id].length).fill(-1);endAt=draft?draft.endAt:Date.now()+(id[0]==='m'?85:20)*60000;
 $('examtitle').textContent=titleFor(id);$('examhelp').textContent=id[0]==='m'?'80 preguntas puntuables: 10 generales y 70 específicas. Las preguntas 81–85 son reservas específicas y se corrigen por separado. Tiempo orientativo: 85 minutos.':'20 preguntas de repaso del tema. Tiempo orientativo: 20 minutos. Cada error resta un tercio de un acierto.';
 $('result').hidden=true;$('result').innerHTML='';$('reviewtools').hidden=true;$('grade').hidden=false;$('blank').hidden=false;$('examarea').hidden=false;
 $('questions').innerHTML=DATA.tests[id].map((qid,i)=>{const q=DATA.bank[qid];return `<fieldset class="question ${i>=80?'reserve':''}" data-index="${i}" id="pregunta-${i}"><legend><span class="qtag">TEMA ${q.t}${i>=80?' · RESERVA':''}</span>${i+1}. ${esc(q.q)}</legend>${q.o.map((o,j)=>`<label class="option" for="q${i}-${j}"><input type="radio" id="q${i}-${j}" name="q${i}" value="${j}" ${answers[i]===j?'checked':''}><span>${'ABCD'[j]}. ${esc(o)}</span></label>`).join('')}<div class="feedback" id="feed-${i}" hidden></div></fieldset>`;}).join('');
 updateCount();draftSave();clearInterval(timerId);tick();timerId=setInterval(tick,1000);
 $('examtitle').setAttribute('tabindex','-1');$('examtitle').focus();$('examarea').scrollIntoView({block:'start'});
}
function tick(){if(!active||graded)return;const left=Math.max(0,Math.ceil((endAt-Date.now())/1000));$('timer').textContent=left?`${Math.floor(left/60).toString().padStart(2,'0')}:${(left%60).toString().padStart(2,'0')}`:'Tiempo orientativo agotado';}
function updateCount(){$('answered').textContent=`${answers.filter(v=>v>=0).length} de ${answers.length} respondidas`;}
$('start').addEventListener('click',()=>start());
$('quiz').addEventListener('focusin',e=>{if(e.target.matches('input[type=radio]'))lastQuestion=Number(e.target.name.slice(1));});
$('quiz').addEventListener('change',e=>{if(graded||!e.target.matches('input[type=radio]'))return;const i=Number(e.target.name.slice(1));answers[i]=Number(e.target.value);lastQuestion=i;updateCount();draftSave();});
$('blank').addEventListener('click',()=>{if(graded||lastQuestion===null)return;answers[lastQuestion]=-1;document.querySelectorAll(`input[name="q${lastQuestion}"]`).forEach(el=>el.checked=false);updateCount();draftSave();});
function calculate(ids,values,count){let correct=0,wrong=0,blank=0;ids.slice(0,count).forEach((id,i)=>{if(values[i]<0)blank++;else if(values[i]===DATA.bank[id].a)correct++;else wrong++;});return {correct,wrong,blank,net:correct-wrong/3};}
function grade(e){
 if(e)e.preventDefault();if(graded||!active)return;graded=true;clearInterval(timerId);
 const ids=DATA.tests[active],count=active[0]==='m'?80:20,s=calculate(ids,answers,count);
 ids.forEach((id,i)=>{const q=DATA.bank[id],field=$('pregunta-'+i);field.dataset.right=answers[i]===q.a?'yes':'no';const labels=field.querySelectorAll('.option');labels[q.a].classList.add('correct');if(answers[i]>=0&&answers[i]!==q.a)labels[answers[i]].classList.add('incorrect');field.querySelectorAll('input').forEach(el=>el.disabled=true);const feed=$('feed-'+i);feed.hidden=false;feed.innerHTML=`<strong>${answers[i]<0?'En blanco':answers[i]===q.a?'Correcta':'Incorrecta'} · Respuesta ${'ABCD'[q.a]}</strong>${esc(q.why)}<p class="hint">Fuentes para ampliar y contrastar:</p>${sourceLinks(q.t)}`;});
 const old=state.records[active];state.records[active]={...s,best:Math.max(old?old.best:-Infinity,s.net),attempts:(old?old.attempts:0)+1,at:new Date().toISOString()};state.draft=null;save();renderProgress();
 const reserve=ids.length===85?calculate(ids.slice(80),answers.slice(80),5):null;
 $('result').className='result';$('result').innerHTML=`<h3>${s.net.toFixed(2)} netas / ${count}</h3><p>${s.correct} aciertos · ${s.wrong} errores · ${s.blank} en blanco.</p><p class="hint">Cálculo de práctica: aciertos − errores ÷ 3. No equivale a la calificación oficial ni establece aprobado.</p>${reserve?`<p><b>Reservas, por separado:</b> ${reserve.correct} aciertos, ${reserve.wrong} errores y ${reserve.blank} en blanco. No se incorporan a la nota de práctica.</p>`:''}<p class="hint">${storageOK?'Resultado guardado en este navegador.':'Resultado disponible en esta sesión. Exporta una copia para conservarlo.'}</p>`;
 $('result').hidden=false;$('reviewtools').hidden=false;$('grade').hidden=true;$('blank').hidden=true;$('result').focus();$('result').scrollIntoView({block:'start'});
}
$('quiz').addEventListener('submit',grade);
$('errors').addEventListener('click',()=>document.querySelectorAll('.question').forEach(el=>el.hidden=el.dataset.right==='yes'));
$('allquestions').addEventListener('click',()=>document.querySelectorAll('.question').forEach(el=>el.hidden=false));
$('retry').addEventListener('click',()=>{const id=active;if(id[0]==='m'){$('mode').value='mixed';$('examselect').value=id.slice(1);}else{const [t,e]=id.slice(1).split('-');$('mode').value='topic';$('topicselect').value=t;$('examselect').value=e;}modeChange();start(true);});
function promptFor(n){const t=DATA.topics[n-1];return `Estoy preparando la oposición de acceso libre a personal laboral de la Comunidad de Madrid: Titulado Medio, Especialidad de Fisioterapia (Grupo II, nivel 7, Área D), convocada por Orden 2119/2023, de 30 de agosto (BOCM de 13/11/2023), ampliada a 155 plazas. No es la convocatoria de personal estatutario del SERMAS.

Prepara un resumen para el TEMA ${n} de este examen. Su enunciado oficial es:
${t.program}

Trabaja solo con las fuentes que he subido y seleccionado. Primero identifica cuáles cubren este tema y qué contenidos del enunciado no están desarrollados en ellas. El BOCM contiene un programa, no un manual clínico: no inventes desarrollo que no esté en las fuentes.

Para normativa, utiliza la redacción vigente el 10/11/2026, conforme a la base séptima y a la fecha de publicación del listado definitivo. Comprueba las fechas de los documentos y avísame de versiones posteriores o insuficientes. Para guías clínicas indica fecha, población y límites de evidencia.

Entrega:
1. Un resumen estructurado que siga todos los apartados del enunciado, con citas a las fuentes y páginas cuando estén disponibles.
2. Una tabla de conceptos, diferencias que suelen confundirse, indicaciones, contraindicaciones y riesgos si procede, sin añadir datos no documentados.
3. Una lista de lagunas que debo completar con bibliografía fiable.
4. Diez preguntas de práctica de cuatro opciones y una sola correcta, con soluciones, explicación y cita. Identifícalas como preguntas generadas de práctica, nunca como oficiales ni como predicciones.
5. Una propuesta de repaso activo y, si procede, un supuesto práctico razonado para entrenar el segundo ejercicio.

El primer ejercicio oficial tiene 80 preguntas (10 generales y 70 específicas) y 5 reservas específicas en 85 minutos; cada error penaliza un tercio de un acierto. No atribuyas al tribunal criterios de dificultad o corte no publicados.

Al terminar, recuérdame: estudiar el tema → hacer los tests de este tema en la guía → revisar errores → continuar con los mixtos tras completar los 50 temas → reservar el mixto 50 como examen final.`;}
function updatePrompt(){$('prompt').value=promptFor(Number($('prompttopic').value));$('copystatus').textContent='';}
$('prompttopic').addEventListener('change',updatePrompt);updatePrompt();
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('prompt').value);$('copystatus').textContent='Prompt copiado.';}catch(e){$('prompt').focus();$('prompt').select();$('copystatus').textContent='Texto seleccionado. Usa Copiar en el menú del dispositivo.';}});
function renderProgress(){const entries=Object.entries(state.records),read=Object.values(state.studied).filter(Boolean).length,topicTests=entries.filter(([k])=>k[0]==='t').length,mixed=entries.length-topicTests;$('progressstats').innerHTML=`<div class="stats"><div class="stat"><strong>${read}/50</strong><span>temas marcados como estudiados</span></div><div class="stat"><strong>${topicTests}/2.500</strong><span>tests por tema realizados</span></div><div class="stat"><strong>${mixed}/50</strong><span>mixtos realizados</span></div><div class="stat"><strong>${entries.reduce((a,[,r])=>a+r.attempts,0)}</strong><span>intentos corregidos</span></div></div><p class="hint">Progreso de estudio: ${read} de 50 temas. Marcar un tema no certifica dominio.</p><div class="progressbar" role="progressbar" aria-label="Temas estudiados" aria-valuenow="${read}" aria-valuemin="0" aria-valuemax="50"><div style="width:${read*2}%"></div></div>`;
 $('history').innerHTML=entries.length?`<h3>Últimos resultados</h3><p class="hint">Se muestra el último resultado y la mejor puntuación de cada prueba; últimos 30 registros.</p><table><thead><tr><th>Prueba</th><th>Aciertos</th><th>Errores</th><th>Blancos</th><th>Última neta</th><th>Mejor neta</th><th>Intentos</th><th>Fecha</th></tr></thead><tbody>${entries.sort((a,b)=>b[1].at.localeCompare(a[1].at)).slice(0,30).map(([id,r])=>`<tr><td>${esc(titleFor(id))}</td><td>${r.correct}</td><td>${r.wrong}</td><td>${r.blank}</td><td>${r.net.toFixed(2)}</td><td>${r.best.toFixed(2)}</td><td>${r.attempts}</td><td>${new Date(r.at).toLocaleDateString('es-ES')}</td></tr>`).join('')}</tbody></table>`:'<p class="empty">Tu primer resultado aparecerá aquí al corregir una prueba.</p>';}
renderProgress();
function download(text,type,name){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('exportjson').addEventListener('click',()=>download(JSON.stringify(state,null,2),'application/json','progreso-fisioterapia.json'));
$('exportcsv').addEventListener('click',()=>{const rows=[['Prueba','Aciertos','Errores','Blancos','Ultima neta','Mejor neta','Intentos','Fecha'],...Object.entries(state.records).map(([id,r])=>[titleFor(id),r.correct,r.wrong,r.blank,r.net.toFixed(2),r.best.toFixed(2),r.attempts,r.at])];download('\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n'),'text/csv;charset=utf-8','resultados-fisioterapia.csv');});
$('importfile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5000000)throw Error('La copia supera el tamaño permitido.');const incoming=normalize(JSON.parse(await file.text()));for(const [n,v]of Object.entries(incoming.studied))if(v)state.studied[n]=true;for(const [id,r]of Object.entries(incoming.records)){const old=state.records[id];if(!old)state.records[id]=r;else state.records[id]={...(r.at>old.at?r:old),best:Math.max(r.best,old.best),attempts:Math.max(r.attempts,old.attempts)};}if(!state.draft&&incoming.draft)state.draft=incoming.draft;save();syncChecks();renderProgress();$('importstatus').textContent='Copia combinada con el progreso actual. No se han borrado resultados.';}catch(err){$('importstatus').textContent='No se ha importado la copia: '+err.message;}});
if(state.draft){const id=state.draft.id;if(id[0]==='m'){$('mode').value='mixed';$('examselect').value=id.slice(1);}else{const [t,e]=id.slice(1).split('-');$('topicselect').value=t;$('examselect').value=e;}modeChange();}
