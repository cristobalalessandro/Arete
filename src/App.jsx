import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Faltan las variables de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env (local) o la configuración de Netlify (producción).");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DIAS_DESCANSO = [0, 6];
const POMODORO_WORK = 50 * 60;
const POMODORO_BREAK = 10 * 60;
const USUARIO = "Cristóbal";

// Metas personalizables: se guardan en localStorage (solo en este dispositivo).
const DEFAULT_METAS = { sueno: 7, estudio: 4, racha: 50, gymDias: 5 };
const METAS_KEY = "arete_metas_v1";

function loadMetas() {
  try {
    const raw = localStorage.getItem(METAS_KEY);
    if (raw) return { ...DEFAULT_METAS, ...JSON.parse(raw) };
  } catch (e) { /* localStorage no disponible o corrupto: usamos default */ }
  return { ...DEFAULT_METAS };
}

function saveMetas(metas) {
  try { localStorage.setItem(METAS_KEY, JSON.stringify(metas)); }
  catch (e) { console.error("No se pudo guardar la configuración local", e); }
}

// ─── MODO OFFLINE ──────────────────────────────────────
// Si un guardado falla (sin internet, Supabase caído, etc.), lo encolamos
// en localStorage y lo reintentamos cuando vuelva la conexión, en vez de
// perder el dato silenciosamente.
const PENDING_KEY = "arete_pending_writes_v1";
function loadPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); }
  catch (e) { return []; }
}
function savePending(arr) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(arr)); }
  catch (e) { console.error("No se pudo guardar la cola offline", e); }
}

const RUTINA = {
  1: { nombre: "Push", ejercicios: ["Press inclinado","Fondos","Apertura","Press militar","Laterales con mancuerna","Trícep en press francés con polea"] },
  2: { nombre: "Pull", ejercicios: ["Dominadas libres","Jalón al pecho","Remo T con mancuernas","Pull over","Curl martillo","Curl bayesiano"] },
  3: { nombre: "Pierna", ejercicios: ["Sentadilla","Prensa","Extensión de cuádriceps","Curl femoral","Elevación de talones","Hip thrust"] },
  4: { nombre: "Hombro / Bícep / Trícep", ejercicios: ["Press militar","Laterales con mancuerna","Peck deck hombro posterior","Curl francés con barra","Bíceps en polea"] },
  5: { nombre: "Core + Combate", ejercicios: ["Plancha","Abdominales","Russian twist","Boxeo / MMA","Landmine press con barra olímpica"] },
};

const QUOTES = [
  "La disciplina es el puente entre las metas y los logros.",
  "No busques la perfección, busca la constancia.",
  "El dolor de hoy es la fuerza de mañana.",
  "Un día a la vez, una rep a la vez.",
  "El campeón no es el que nunca cae, sino el que siempre se levanta.",
  "Sé el arquitecto de tu propio cuerpo y mente.",
  "La excelencia no es un acto, es un hábito.",
];

const DIAS_CORTOS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function getLocalDateStr(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

// Parsea un string "YYYY-MM-DD" como fecha LOCAL (no UTC).
// new Date("2026-07-11") se interpreta como medianoche UTC, lo que en
// zonas horarias negativas (como Chile) corre el día hacia atrás y
// rompe cálculos de día de la semana (descanso, racha, etc).
function parseLocalDate(fechaStr) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getSaludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function calcularDesglose({ sueno, estudio, gym, sensacion, esDescanso, metaSueno = 7, metaEstudio = 4 }) {
  const items = [];
  let pts = 0;
  if (sueno >= metaSueno) { items.push({ label: `${sueno}h de sueño`, pts: 30, ok: true }); pts += 30; }
  else if (sueno >= metaSueno - 1) { items.push({ label: `${sueno}h de sueño (bajo meta)`, pts: 18, ok: true }); pts += 18; }
  else { items.push({ label: `${sueno}h de sueño (insuficiente)`, pts: 8, ok: false }); pts += 8; }
  if (estudio >= metaEstudio) { items.push({ label: `${estudio}h de estudio`, pts: 40, ok: true }); pts += 40; }
  else if (estudio >= metaEstudio / 2) { items.push({ label: `${estudio}h de estudio (bajo meta)`, pts: 20, ok: true }); pts += 20; }
  else { items.push({ label: `${estudio}h de estudio`, pts: 5, ok: false }); pts += 5; }
  if (esDescanso) { items.push({ label: "Día de descanso programado", pts: 0, ok: true, neutral: true }); }
  else if (gym) { const gp = sensacion >= 4 ? 30 : sensacion >= 3 ? 24 : 18; items.push({ label: `Gym completado (sensación ${sensacion}/5)`, pts: gp, ok: true }); pts += gp; }
  else { items.push({ label: "No fuiste al gym", pts: 0, ok: false }); }
  return { items, total: pts };
}

function calcularPuntosDelDia(args) { return calcularDesglose(args).total; }

function mediaMovil(data, v = 7) {
  return data.map((_, i) => {
    const s = data.slice(Math.max(0,i-v+1),i+1).filter(x=>x!==null);
    return s.length ? s.reduce((a,b)=>a+b,0)/s.length : null;
  });
}

function LineChart({ data, color="#fff", height=80, showArea=true }) {
  if (!data||data.length<2) return null;
  const valid = data.filter(d=>d!==null&&d!==undefined);
  if (valid.length<2) return null;
  const min = Math.min(...valid)-2, max = Math.max(...valid)+2;
  const w=300, h=height;
  const toX=i=>(i/(data.length-1))*w;
  const toY=v=>v===null?null:h-((v-min)/(max-min))*(h-8)-4;
  const segs=[]; let cur=[];
  data.forEach((v,i)=>{ if(v!==null){cur.push([toX(i),toY(v)]);}else if(cur.length){segs.push(cur);cur=[];} });
  if(cur.length) segs.push(cur);
  const lastSeg=segs[segs.length-1];
  const lastPt=lastSeg?lastSeg[lastSeg.length-1]:null;
  const trend=lastSeg&&lastSeg.length>1?(lastSeg[lastSeg.length-1][1]<lastSeg[0][1]?"up":"down"):"up";
  const lc=color==="auto"?(trend==="up"?"#4ade80":"#f87171"):color;
  const areaPath=segs.map(s=>{if(s.length<2)return"";return`M${s[0][0]},${h} L${s.map(([x,y])=>`${x},${y}`).join(" ")} L${s[s.length-1][0]},${h} Z`;}).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h}>
      {showArea&&<path d={areaPath} fill={lc} fillOpacity="0.06"/>}
      {segs.map((s,si)=><polyline key={si} points={s.map(([x,y])=>`${x},${y}`).join(" ")} fill="none" stroke={lc} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>)}
      {lastPt&&<circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill={lc}/>}
    </svg>
  );
}

function ProgressRing({ value, max, size=120, stroke=8, color="#fff", label, sublabel }) {
  const r=(size-stroke*2)/2, circ=2*Math.PI*r, pct=Math.min(value/max,1);
  return (
    <div style={{position:"relative",width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width={size} height={size} style={{position:"absolute",top:0,left:0}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dashoffset 0.6s ease"}}/>
      </svg>
      <div style={{textAlign:"center",zIndex:1}}>
        <div style={{fontSize:"20px",fontWeight:"700",color:"#fff",fontFamily:"'Syne',sans-serif",letterSpacing:"-1px"}}>{label}</div>
        {sublabel&&<div style={{fontSize:"9px",color:"rgba(255,255,255,0.3)",fontFamily:"monospace",letterSpacing:"0.5px",marginTop:"1px"}}>{sublabel}</div>}
      </div>
    </div>
  );
}

// NUEVO ÍCONO DE CORREDOR MODERNO (Estilo Continuo Minimalista)
function RunnerIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.5 5.5C14.3284 5.5 15 4.82843 15 4C15 3.17157 14.3284 2.5 13.5 2.5C12.6716 2.5 12 3.17157 12 4C12 4.82843 12.6716 5.5 13.5 5.5Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15 8.5L12 11.5L13.5 15.5L17.5 19" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 12.5L9.5 11L12 8.5L15 9.5L18.5 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 14L8.5 18L5 19.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// El estado y el intervalo del Pomodoro viven en este hook, usado directamente
// en App (siempre montado). Así el conteo sigue corriendo aunque el usuario
// cambie de pestaña; antes vivía dentro de PomodoroPage y se perdía al desmontar.
function usePomodoroTimer(onAddEstudio) {
  const [mode, setMode] = useState("work");
  const [timeLeft, setTimeLeft] = useState(POMODORO_WORK);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [totalWork, setTotalWork] = useState(0);
  const intervalRef = useRef(null);
  const reset = useCallback((m) => { setMode(m); setTimeLeft(m==="work"?POMODORO_WORK:POMODORO_BREAK); setRunning(false); }, []);
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t<=1) {
            clearInterval(intervalRef.current);
            if (mode==="work") { const ns=sessions+1; setSessions(ns); const nt=totalWork+POMODORO_WORK; setTotalWork(nt); onAddEstudio(nt/3600); reset("break"); }
            else { reset("work"); }
            return 0;
          }
          return t-1;
        });
      }, 1000);
    } else { clearInterval(intervalRef.current); }
    return ()=>clearInterval(intervalRef.current);
  }, [running, mode]);
  return { mode, timeLeft, running, sessions, totalWork, setRunning, reset };
}

function PomodoroPage({ mode, timeLeft, running, sessions, totalWork, setRunning, reset }) {
  const mins=String(Math.floor(timeLeft/60)).padStart(2,"0");
  const secs=String(timeLeft%60).padStart(2,"0");
  const progress=mode==="work"?1-timeLeft/POMODORO_WORK:1-timeLeft/POMODORO_BREAK;
  const r=80, circ=2*Math.PI*r;
  return (
    <div className="fade-in">
      <div className="section-label">POMODORO</div>
      <div className="pomo-tabs">
        <button className={`pomo-tab ${mode==="work"?"active":""}`} onClick={()=>reset("work")}>Trabajo · 50m</button>
        <button className={`pomo-tab ${mode==="break"?"active":""}`} onClick={()=>reset("break")}>Descanso · 10m</button>
      </div>
      <div className="pomo-ring-wrap">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>
          <circle cx="100" cy="100" r={r} fill="none" stroke={mode==="work"?"#fff":"#4ade80"} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-progress)}
            transform="rotate(-90 100 100)" style={{transition:"stroke-dashoffset 0.5s"}}/>
        </svg>
        <div className="pomo-time">
          <div className="pomo-display">{mins}:{secs}</div>
          <div className="pomo-mode">{mode==="work"?"ENFOQUE":"DESCANSO"}</div>
        </div>
      </div>
      <div className="pomo-controls">
        <button className="pomo-btn-sec" onClick={()=>reset(mode)}>↺</button>
        <button className="btn-primary pomo-btn-main" onClick={()=>setRunning(r=>!r)}>{running?"Pausar":"Iniciar"}</button>
      </div>
      <div className="pomo-stats-row">
        <div className="pomo-stat"><div className="pomo-stat-val">{sessions}</div><div className="pomo-stat-key">sesiones hoy</div></div>
        <div className="pomo-stat"><div className="pomo-stat-val">{(totalWork/3600).toFixed(1)}h</div><div className="pomo-stat-key">acumulado</div></div>
        <div className="pomo-stat"><div className="pomo-stat-val">{sessions*50}m</div><div className="pomo-stat-key">minutos</div></div>
      </div>
      {totalWork>0&&<div className="success-msg" style={{marginTop:"12px"}}>✓ {(totalWork/3600).toFixed(1)}h registradas al completar sesiones</div>}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [quote] = useState(QUOTES[Math.floor(Math.random()*QUOTES.length)]);
  const today = new Date();
  const dayOfWeek = today.getDay();
  const todayStr = getLocalDateStr(today);
  const esDescanso = DIAS_DESCANSO.includes(dayOfWeek);

  const [registros, setRegistros] = useState([]);
  const [eloHistorico, setEloHistorico] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);
  const [pesoLog, setPesoLog] = useState([]);
  const [troteLog, setTroteLog] = useState([]);
  const [diarioLog, setDiarioLog] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sueno, setSueno] = useState(7);
  const [estudio, setEstudio] = useState(4);
  const [gym, setGym] = useState(false);
  const [sensacion, setSensacion] = useState(3);
  const [savedMsg, setSavedMsg] = useState("");

  const [pesoVal, setPesoVal] = useState("");
  const [grasaVal, setGrasaVal] = useState("");
  const [condicion, setCondicion] = useState("");
  const [pesoSaved, setPesoSaved] = useState(false);

  const [gymLog, setGymLog] = useState({});
  const [gymSaved, setGymSaved] = useState(false);

  const [troteKm, setTroteKm] = useState("");
  const [troteMins, setTroteMins] = useState("");
  const [troteSaved, setTroteSaved] = useState(false);

  const [diarioText, setDiarioText] = useState("");
  const [diarioSaved, setDiarioSaved] = useState(false);

  const [eloModal, setEloModal] = useState(false);
  const [eloModalData, setEloModalData] = useState(null);
  const [pomodoroEstudio, setPomodoroEstudio] = useState(0);
  const pomo = usePomodoroTimer(h=>setPomodoroEstudio(h));
  const [metas, setMetas] = useState(loadMetas);
  useEffect(() => { saveMetas(metas); }, [metas]);

  // Cola offline: cuántos cambios están pendientes de sincronizar
  const [pendingCount, setPendingCount] = useState(() => loadPending().length);

  async function upsertConCola(table, payload, onConflict, context) {
    try {
      const { error } = await supabase.from(table).upsert(payload, { onConflict });
      if (error) throw error;
      return { ok: true };
    } catch (e) {
      const pending = loadPending();
      pending.push({ table, payload, onConflict, context, ts: Date.now() });
      savePending(pending);
      setPendingCount(pending.length);
      return { ok: false, queued: true, error: e };
    }
  }

  const syncPending = useCallback(async () => {
    const pending = loadPending();
    if (!pending.length) return;
    const remaining = [];
    for (const item of pending) {
      try {
        const { error } = await supabase.from(item.table).upsert(item.payload, { onConflict: item.onConflict });
        if (error) remaining.push(item);
      } catch (e) { remaining.push(item); }
    }
    savePending(remaining);
    setPendingCount(remaining.length);
    if (remaining.length < pending.length) fetchData();
  }, []);

  useEffect(() => {
    syncPending();
    window.addEventListener("online", syncPending);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncPending(); });
    return () => window.removeEventListener("online", syncPending);
  }, [syncPending]);

  // Recordatorios locales (solo mientras la app está abierta/en background reciente;
  // iOS no permite push real sin backend — ver nota en config).
  const [remindersOn, setRemindersOn] = useState(() => localStorage.getItem("arete_reminders_v1") === "1");
  const notifiedTodayRef = useRef(false);
  useEffect(() => { localStorage.setItem("arete_reminders_v1", remindersOn ? "1" : "0"); }, [remindersOn]);
  useEffect(() => {
    if (!remindersOn || !("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission();
    const check = () => {
      if (Notification.permission !== "granted") return;
      const h = new Date().getHours();
      if (h >= 20 && !todayRecord && !esDescanso && !notifiedTodayRef.current) {
        new Notification("Areté", { body: "Aún no has registrado tu día de hoy.", icon: "/icons/icon-192.png" });
        notifiedTodayRef.current = true;
      }
    };
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [remindersOn, todayRecord, esDescanso]);
  const [toast, setToast] = useState(null); // {type:'success'|'error', msg:string}
  function showToast(type, msg, ms=3000) {
    setToast({ type, msg });
    setTimeout(()=>setToast(t=>(t&&t.msg===msg?null:t)), ms);
  }
  function showError(context, error) {
    console.error(context, error);
    showToast("error", `No se pudo guardar (${context}). ${error?.message||"Revisa tu conexión."}`, 5000);
  }

  useEffect(() => { fetchData(); }, []);

  // ─── EDICIÓN RETROACTIVA ───────────────────────────
  // Antes solo se podía registrar "hoy". Ahora se puede navegar a un día
  // anterior y editar sueño/estudio/gym/peso/trote/diario de esa fecha.
  const [fechaEditar, setFechaEditar] = useState(todayStr);
  const esHoyEditar = fechaEditar === todayStr;
  const esDescansoEditar = DIAS_DESCANSO.includes(parseLocalDate(fechaEditar).getDay());

  useEffect(() => {
    const rec = registros.find(r => r.fecha === fechaEditar);
    setSueno(rec ? rec.sueno : 7);
    setEstudio(rec ? rec.estudio : 4);
    setGym(rec ? !!rec.gym : false);
    setSensacion(rec && rec.sensacion ? rec.sensacion : 3);
    setSavedMsg("");

    const p = pesoLog.find(x => x.fecha === fechaEditar);
    setPesoVal(p ? p.peso : "");
    setGrasaVal(p && p.grasa ? p.grasa : "");
    setCondicion(p && p.condicion ? p.condicion : "");
    setPesoSaved(!!p);

    const t = troteLog.find(x => x.fecha === fechaEditar);
    setTroteKm(t ? t.km : "");
    setTroteMins(t ? t.minutos : "");
    setTroteSaved(!!t);

    const d = diarioLog.find(x => x.fecha === fechaEditar);
    setDiarioText(d ? d.texto : "");
    setDiarioSaved(!!d);
  }, [fechaEditar, registros, pesoLog, troteLog, diarioLog]);

  function irADia(delta) {
    const d = parseLocalDate(fechaEditar);
    d.setDate(d.getDate() + delta);
    const nuevaFecha = getLocalDateStr(d);
    if (nuevaFecha > todayStr) return; // no se puede editar el futuro
    setFechaEditar(nuevaFecha);
  }

  async function fetchData() {
    setLoading(true);
    try {
      const { data: recs } = await supabase.from("registros").select("*").order("fecha",{ascending:false}).limit(400);
      setRegistros(recs||[]);
      setTodayRecord((recs||[]).find(r=>r.fecha===todayStr)||null);

      const { data: elo } = await supabase.from("elo_semanal").select("*").order("semana",{ascending:false}).limit(52);
      setEloHistorico(elo||[]);

      const { data: glog } = await supabase.from("gym_log").select("*").eq("fecha",todayStr);
      if (glog?.length>0) { const log={}; glog.forEach(i=>{log[i.ejercicio]={series:i.series,reps:i.reps,peso:i.peso};}); setGymLog(log); setGymSaved(true); }

      const { data: plog } = await supabase.from("peso_log").select("*").order("fecha",{ascending:false}).limit(400);
      setPesoLog(plog||[]);

      const { data: tlog } = await supabase.from("trote_log").select("*").order("fecha",{ascending:false}).limit(200);
      setTroteLog(tlog||[]);

      const { data: dlog } = await supabase.from("diario").select("*").order("fecha",{ascending:false}).limit(400);
      setDiarioLog(dlog||[]);
    } catch(e){showError("carga de datos",e);}
    setLoading(false);
  }

  async function registrarDia() {
    const estudioTotal=esHoyEditar?Math.max(estudio,pomodoroEstudio):estudio;
    const puntos=calcularPuntosDelDia({sueno,estudio:estudioTotal,gym:esDescansoEditar?false:gym,sensacion,esDescanso:esDescansoEditar,metaSueno:metas.sueno,metaEstudio:metas.estudio});
    const payload={fecha:fechaEditar,sueno,estudio:estudioTotal,gym:esDescansoEditar?false:gym,sensacion:gym&&!esDescansoEditar?sensacion:null,puntos};
    const {ok,queued,error}=await upsertConCola("registros",payload,"fecha","registro del día");
    if(ok){
      setSavedMsg(`¡Registrado! +${puntos} pts`);
      showToast("success", `Registrado · +${puntos} pts`);
      setTimeout(()=>setSavedMsg(""),3000);
      fetchData();
      if(esHoyEditar&&dayOfWeek===5){
        const sr=registros.filter(r=>(today-parseLocalDate(r.fecha))/86400000<=7);
        sr.push(payload);
        const eloSem=Math.round(sr.reduce((a,r)=>a+r.puntos,0)/sr.length);
        const {error:eloError}=await supabase.from("elo_semanal").upsert({semana:todayStr,elo:eloSem,dias:sr.length},{onConflict:"semana"});
        if(eloError)showError("elo semanal",eloError);
      }
    } else if(queued){
      setSavedMsg(`Guardado localmente (sin conexión) · +${puntos} pts`);
      setTimeout(()=>setSavedMsg(""),4000);
    } else {
      showError("registro del día",error);
    }
  }

  async function guardarGymLog() {
    const entries=Object.entries(gymLog).map(([ej,v])=>({fecha:todayStr,ejercicio:ej,series:parseInt(v.series)||0,reps:parseInt(v.reps)||0,peso:parseFloat(v.peso)||0}));
    if(!entries.length)return;
    let anyError=null, anyQueued=false;
    for(const entry of entries){
      const {ok,queued,error}=await upsertConCola("gym_log",entry,"fecha,ejercicio","sesión de gym");
      if(queued)anyQueued=true;
      if(!ok&&!queued)anyError=error;
    }
    if(anyError)showError("sesión de gym",anyError);
    else setGymSaved(true);
  }

  async function guardarPeso() {
    if(!pesoVal)return;
    const {ok,queued,error}=await upsertConCola("peso_log",{fecha:fechaEditar,peso:parseFloat(pesoVal),grasa:grasaVal?parseFloat(grasaVal):null,condicion:condicion||null},"fecha","peso corporal");
    if(ok){setPesoSaved(true);fetchData();}
    else if(queued){setPesoSaved(true);}
    else showError("peso corporal",error);
  }

  async function guardarTrote() {
    if(!troteKm||!troteMins)return;
    const ritmo=troteMins/troteKm;
    const {ok,queued,error}=await upsertConCola("trote_log",{fecha:fechaEditar,km:parseFloat(troteKm),minutos:parseInt(troteMins),ritmo_min_km:parseFloat(ritmo.toFixed(2))},"fecha","trote");
    if(ok){setTroteSaved(true);fetchData();}
    else if(queued){setTroteSaved(true);}
    else showError("trote",error);
  }

  async function guardarDiario() {
    if(!diarioText.trim())return;
    const {ok,queued,error}=await upsertConCola("diario",{fecha:fechaEditar,texto:diarioText.trim()},"fecha","diario");
    if(ok){setDiarioSaved(true);fetchData();}
    else if(queued){setDiarioSaved(true);}
    else showError("diario",error);
  }

  function exportarDatos() {
    const payload = {
      exportado_en: new Date().toISOString(),
      metas,
      registros,
      eloHistorico,
      pesoLog,
      troteLog,
      diarioLog,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arete_backup_${todayStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function updateMeta(key, delta, min, max) {
    setMetas(m => ({ ...m, [key]: Math.min(max, Math.max(min, +(m[key]+delta).toFixed(1))) }));
  }

  function updateGymLog(ej,field,val){setGymLog(p=>({...p,[ej]:{...(p[ej]||{}),[field]:val}}));setGymSaved(false);}

  const eloActual=eloHistorico[0]?.elo||0;
  const eloAnterior=eloHistorico[1]?.elo||0;
  const eloDiff=eloActual-eloAnterior;
  const esBuenaSemana=eloDiff>=0;
  const semanaActual=registros.slice(0,5);
  const promSueno=semanaActual.length?(semanaActual.reduce((a,r)=>a+r.sueno,0)/semanaActual.length).toFixed(1):"—";
  const promEstudio=semanaActual.length?(semanaActual.reduce((a,r)=>a+r.estudio,0)/semanaActual.length).toFixed(1):"—";
  const diasGym=semanaActual.filter(r=>r.gym).length;
  const rutinaHoy=RUTINA[dayOfWeek]||null;
  const manana=RUTINA[(dayOfWeek%7)+1]||null;
  const fechaFormato=`${DIAS_CORTOS[dayOfWeek]} ${today.getDate()} ${MESES[today.getMonth()]}`;

  // Racha: camina día por día desde hoy hacia atrás por el calendario
  // (no solo por registros existentes), así un día saltado SÍ la corta.
  let racha=0;
  {
    const cursor=new Date(today.getFullYear(),today.getMonth(),today.getDate());
    let esHoy=true;
    while(true){
      const fechaStr=getLocalDateStr(cursor);
      const esDesc=DIAS_DESCANSO.includes(cursor.getDay());
      const rec=registros.find(r=>r.fecha===fechaStr);
      if(esDesc){
        // día de descanso: no suma ni corta la racha
      } else if(rec&&rec.puntos>=metas.racha){
        racha++;
      } else if(esHoy&&!rec){
        // hoy todavía no se registra: no corta la racha (el día no ha terminado)
      } else {
        break;
      }
      esHoy=false;
      cursor.setDate(cursor.getDate()-1);
      // límite de seguridad para no loopear infinito si no hay datos
      if(racha>365)break;
      if(cursor<new Date(2020,0,1))break;
    }
  }

  const diasSemana=[1,2,3,4,5,6,0];
  const getRecForDow=(dow)=>{
    const offset=(dayOfWeek-dow+7)%7;
    const d=new Date(today); d.setDate(d.getDate()-offset);
    return registros.find(r=>r.fecha===getLocalDateStr(d));
  };

  const chartData=[...registros].sort((a,b)=>new Date(a.fecha)-new Date(b.fecha)).slice(-30).map(r=>r.puntos);
  const pesoSorted=[...pesoLog].sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  const pesoVals=pesoSorted.map(p=>p.peso);
  const pesoMA=mediaMovil(pesoVals,7);
  const desglose=todayRecord?calcularDesglose({sueno:todayRecord.sueno,estudio:todayRecord.estudio,gym:todayRecord.gym,sensacion:todayRecord.sensacion,esDescanso:DIAS_DESCANSO.includes(parseLocalDate(todayRecord.fecha).getDay()),metaSueno:metas.sueno,metaEstudio:metas.estudio}):null;

  const ringPts=todayRecord?.puntos||0;
  const mesActual=registros.filter(r=>r.fecha.startsWith(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`));
  const horasEstudioMes=mesActual.reduce((a,r)=>a+r.estudio,0).toFixed(1);
  const diasGymMes=mesActual.filter(r=>r.gym).length;

  return (
    <div className="app">
      <div className="quote-bar"><span className="quote-icon">✦</span><span>{quote}</span></div>
      {toast&&(
        <div className="island-toast-wrap">
          <div className={`island-toast ${toast.type}`}>{toast.type==="error"?"⚠":"✓"} {toast.msg}</div>
        </div>
      )}
      <header className="header">
        <div className="header-left">
          <h1 className="app-name">Areté</h1>
          <span className="fecha">{fechaFormato}{esDescanso&&<span className="rest-badge">descanso</span>}{pendingCount>0&&<span className="sync-badge">↻ {pendingCount} sin subir</span>}</span>
        </div>
        <nav className="nav">
          {/* Barra limpia: Se eliminó la pestaña de Coach (id: coach) */}
          {[{id:"home",icon:"⌂"},{id:"register",icon:"✎"},{id:"gym",icon:"◈"},{id:"run",icon:"◉"},{id:"pomodoro",icon:"◷"},{id:"diario",icon:"✦"},{id:"weekly",icon:"◎"},{id:"config",icon:"⚙"}].map(tab=>(
            <button key={tab.id} className={`nav-btn ${page===tab.id?"active":""}`} onClick={()=>setPage(tab.id)}>{tab.icon}</button>
          ))}
        </nav>
      </header>

      <main className="main">
        {loading?<div className="loading">Cargando...</div>:(<>

          {/* HOME */}
          {page==="home"&&(
            <div className="fade-in">
              <div className="saludo-card">
                <div className="saludo-text">{getSaludo()}, {USUARIO}</div>
                <div className="saludo-sub">{todayRecord?"Tu día está registrado ✓":"Aún no has registrado tu día"}</div>
              </div>

              <div className="rings-row">
                <div className="ring-card" onClick={()=>{if(desglose){setEloModalData(desglose);setEloModal(true);}}} style={{cursor:desglose?"pointer":"default"}}>
                  <ProgressRing value={ringPts} max={100} size={110} stroke={7} color={ringPts>=50?"#4ade80":"#f87171"} label={`${ringPts}`} sublabel="PUNTOS HOY"/>
                  {desglose&&<div style={{fontSize:"10px",color:"rgba(255,255,255,0.25)",marginTop:"6px",textAlign:"center",fontFamily:"monospace"}}>tap → desglose</div>}
                </div>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:"8px"}}>
                  <div className="mini-stat-card">
                    <div className="mini-stat-val">{eloActual>0?eloActual:"—"}</div>
                    <div className="mini-stat-key">ELO SEMANAL</div>
                    {eloHistorico.length>1&&<div className={`mini-elo-diff ${esBuenaSemana?"up":"down"}`}>{esBuenaSemana?"▲":"▼"}{Math.abs(eloDiff)}</div>}
                  </div>
                  <div className="mini-stat-card">
                    <div className="mini-stat-val">🔥 {racha}</div>
                    <div className="mini-stat-key">DÍAS RACHA</div>
                  </div>
                </div>
              </div>

              <div className="chart-card">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
                  <span className="chart-title" style={{marginBottom:0}}>Esta semana</span>
                </div>
                <div className="week-circles">
                  {diasSemana.map(dow=>{
                    const rec=getRecForDow(dow);
                    const esHoy=dow===dayOfWeek;
                    const esDesc=DIAS_DESCANSO.includes(dow);
                    const cumplido=rec&&rec.puntos>=metas.racha;
                    return (
                      <div key={dow} className="day-circle-col">
                        <div className={`day-circle ${cumplido?"filled":""} ${esHoy?"today":""} ${esDesc?"rest":""}`}>
                          {esDesc?"—":cumplido?"✓":DIAS_CORTOS[dow][0]}
                        </div>
                        <span className="day-circle-label">{DIAS_CORTOS[dow]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {chartData.length>1&&(
                <div className="chart-card">
                  <div className="chart-title">Rendimiento <span className="chart-meta">últimos {chartData.length} días</span></div>
                  <LineChart data={chartData} color="auto" height={80}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px"}}>
                    <span style={{fontSize:"10px",color:"rgba(255,255,255,0.2)",fontFamily:"monospace"}}>hace {chartData.length}d</span>
                    <span style={{fontSize:"10px",color:"rgba(255,255,255,0.2)",fontFamily:"monospace"}}>hoy</span>
                  </div>
                </div>
              )}

              {!esDescanso&&rutinaHoy&&(
                <div className="chart-card" style={{cursor:"pointer"}} onClick={()=>setPage("gym")}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                    <span className="chart-title" style={{marginBottom:0}}>Hoy · {rutinaHoy.nombre}</span>
                    <span style={{fontSize:"11px",color:"rgba(255,255,255,0.3)"}}>ir →</span>
                  </div>
                  {rutinaHoy.ejercicios.slice(0,3).map(e=>(
                    <div key={e} style={{fontSize:"12px",color:"rgba(255,255,255,0.45)",padding:"4px 0",borderBottom:"0.5px solid rgba(255,255,255,0.04)",fontFamily:"monospace"}}>{e}</div>
                  ))}
                  {rutinaHoy.ejercicios.length>3&&<div style={{fontSize:"11px",color:"rgba(255,255,255,0.2)",marginTop:"6px",fontFamily:"monospace"}}>+{rutinaHoy.ejercicios.length-3} más</div>}
                </div>
              )}
              {(esDescanso||!rutinaHoy)&&manana&&(
                <div className="chart-card">
                  <div className="chart-title" style={{marginBottom:"8px"}}>Mañana · {manana.nombre}</div>
                  {manana.ejercicios.slice(0,3).map(e=>(
                    <div key={e} style={{fontSize:"12px",color:"rgba(255,255,255,0.35)",padding:"3px 0",fontFamily:"monospace"}}>{e}</div>
                  ))}
                </div>
              )}

              <div className="section-label" style={{marginTop:"4px"}}>ESTE MES</div>
              <div className="metrics-row">
                <div className="metric-box"><div className="metric-val">{horasEstudioMes}<span className="metric-unit">h</span></div><div className="metric-key">estudio</div></div>
                <div className="metric-box"><div className="metric-val amber">{diasGymMes}</div><div className="metric-key">días gym</div></div>
                <div className="metric-box"><div className="metric-val">{pesoSorted.length>0?`${pesoSorted[pesoSorted.length-1].peso}`:"-"}<span className="metric-unit">{pesoSorted.length>0?"kg":""}</span></div><div className="metric-key">peso actual</div></div>
              </div>

              {/* Contenedor del trote con el nuevo RunnerIcon integrado */}
              {troteLog.find(t=>t.fecha===todayStr)?(
                <div className="chart-card" style={{cursor:"pointer"}} onClick={()=>setPage("run")}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                      <RunnerIcon/>
                      <div>
                        <div style={{fontSize:"16px",fontWeight:"700",color:"#fff"}}>{troteLog.find(t=>t.fecha===todayStr).km} km</div>
                        <div style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",fontFamily:"monospace"}}>{troteLog.find(t=>t.fecha===todayStr).minutos} min · {troteLog.find(t=>t.fecha===todayStr).ritmo_min_km?.toFixed(1)} min/km</div>
                      </div>
                    </div>
                    <span style={{fontSize:"11px",color:"rgba(255,255,255,0.25)"}}>hoy</span>
                  </div>
                </div>
              ):(
                <div className="empty-today" style={{display:"flex",alignItems:"center",gap:"12px",justifyContent:"center"}} onClick={()=>setPage("run")}>
                  <RunnerIcon/><span>¿Trotaste hoy? Registrar →</span>
                </div>
              )}

              {pesoSorted.length>1&&(
                <div className="chart-card">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                    <span className="chart-title" style={{marginBottom:0}}>Peso corporal</span>
                    <span style={{fontSize:"13px",color:"#fff",fontFamily:"monospace"}}>{pesoSorted[pesoSorted.length-1].peso} kg</span>
                  </div>
                  <LineChart data={pesoMA} color="#fff" height={60} showArea={false}/>
                  <div style={{fontSize:"10px",color:"rgba(255,255,255,0.2)",marginTop:"4px",fontFamily:"monospace"}}>Media móvil 7 días</div>
                </div>
              )}
            </div>
          )}

          {/* REGISTRO */}
          {page==="register"&&(
            <div className="fade-in">
              <div className="date-nav">
                <button className="date-nav-btn" onClick={()=>irADia(-1)}>←</button>
                <div className="date-nav-current">
                  <span>{esHoyEditar?"Hoy":DIAS_CORTOS[parseLocalDate(fechaEditar).getDay()]} · {fechaEditar.slice(5)}</span>
                  {!esHoyEditar&&<button className="date-nav-hoy" onClick={()=>setFechaEditar(todayStr)}>volver a hoy</button>}
                </div>
                <button className="date-nav-btn" onClick={()=>irADia(1)} disabled={esHoyEditar} style={esHoyEditar?{opacity:0.25,cursor:"default"}:{}}>→</button>
              </div>
              <div className="section-label">REGISTRO DEL DÍA</div>
              <div className="form-card">
                <div className="form-row-header"><span>🌙 Sueño</span><span className="form-val">{sueno}h</span></div>
                <input type="range" min="4" max="10" step="0.5" value={sueno} onChange={e=>setSueno(parseFloat(e.target.value))} className="slider"/>
                <div className="slider-labels"><span>4h</span><span>Meta: {metas.sueno}h</span><span>10h</span></div>
              </div>
              <div className="form-card">
                <div className="form-row-header"><span>📖 Estudio efectivo</span><span className="form-val">{(esHoyEditar?Math.max(estudio,pomodoroEstudio):estudio).toFixed(1)}h</span></div>
                <input type="range" min="0" max="8" step="0.5" value={estudio} onChange={e=>setEstudio(parseFloat(e.target.value))} className="slider"/>
                <div className="slider-labels"><span>0h</span><span>Meta: {metas.estudio}h</span><span>8h</span></div>
                {esHoyEditar&&pomodoroEstudio>0&&<div style={{fontSize:"11px",color:"rgba(255,255,255,0.35)",marginTop:"6px",fontFamily:"monospace"}}>+ {pomodoroEstudio.toFixed(1)}h desde Pomodoro</div>}
              </div>
              {esDescansoEditar?(
                <div className="form-card" style={{opacity:0.5}}>
                  <div className="toggle-row"><span>🏋️ Día de descanso del gym</span><span style={{fontSize:"12px",color:"rgba(255,255,255,0.3)"}}>programado</span></div>
                </div>
              ):(
                <div className="form-card">
                  <div className="toggle-row">
                    <span>🏋️ ¿Fuiste al gym?</span>
                    <div className={`toggle ${gym?"on":""}`} onClick={()=>setGym(!gym)}><div className="toggle-dot"/></div>
                  </div>
                  {gym&&(
                    <div className="feel-section">
                      <div className="form-row-header" style={{marginTop:"16px"}}><span>¿Cómo te sentiste?</span><span className="form-val">{sensacion}/5</span></div>
                      <input type="range" min="1" max="5" step="1" value={sensacion} onChange={e=>setSensacion(parseInt(e.target.value))} className="slider"/>
                      <div className="slider-labels"><span>Mal</span><span>Regular</span><span>Excelente</span></div>
                    </div>
                  )}
                </div>
              )}
              <div className="puntos-preview">Puntos estimados: <strong>{calcularPuntosDelDia({sueno,estudio:esHoyEditar?Math.max(estudio,pomodoroEstudio):estudio,gym:esDescansoEditar?false:gym,sensacion,esDescanso:esDescansoEditar,metaSueno:metas.sueno,metaEstudio:metas.estudio})}</strong> / 100</div>
              {savedMsg?<div className="success-msg">{savedMsg}</div>:<button className="btn-primary" onClick={registrarDia}>Registrar día</button>}

              <div style={{marginTop:"24px"}}>
                <div className="section-label">PESO CORPORAL</div>
                <div className="form-card">
                  <div className="form-row-header"><span>⚖️ Peso (kg)</span></div>
                  <input type="number" step="0.1" placeholder="72.5" value={pesoVal} onChange={e=>{setPesoVal(e.target.value);setPesoSaved(false);}} style={{background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:"8px",padding:"10px",color:"#fff",fontFamily:"monospace",fontSize:"16px",width:"100%",outline:"none",marginBottom:"12px"}}/>
                  <div className="form-row-header" style={{marginTop:"4px"}}><span>% Grasa (opcional)</span></div>
                  <input type="number" step="0.1" placeholder="—" value={grasaVal} onChange={e=>{setGrasaVal(e.target.value);setPesoSaved(false);}} style={{background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:"8px",padding:"10px",color:"#fff",fontFamily:"monospace",fontSize:"16px",width:"100%",outline:"none",marginBottom:"12px"}}/>
                  <div style={{fontSize:"12px",color:"rgba(255,255,255,0.35)",marginBottom:"8px"}}>Condición de pesaje</div>
                  <div className="condicion-btns">
                    {["ayunas","post_bano","despertado"].map(c=>(
                      <button key={c} className={`condicion-btn ${condicion===c?"active":""}`} onClick={()=>{setCondicion(condicion===c?"":c);setPesoSaved(false);}}>
                        {c==="ayunas"?"🫙 Ayunas":c==="post_bano"?"🚿 Post-baño":"🛏️ Al despertar"}
                      </button>
                    ))}
                  </div>
                  {pesoSaved?<div className="success-msg" style={{marginTop:"10px"}}>✓ Peso guardado</div>:<button className="btn-primary" style={{marginTop:"12px"}} onClick={guardarPeso}>Guardar peso</button>}
                </div>
              </div>
            </div>
          )}

          {/* GYM */}
          {page==="gym"&&(
            <div className="fade-in">
              <div className="section-label">GYM HOY {rutinaHoy&&<span className="rutina-badge">{rutinaHoy.nombre}</span>}{esDescanso&&<span className="rutina-badge" style={{color:"rgba(255,255,255,0.3)"}}>descanso</span>}</div>
              {esDescanso?(
                <div className="empty-today">Hoy es día de descanso — tu cuerpo también necesita recuperarse.</div>
              ):rutinaHoy?(
                <>
                  {rutinaHoy.ejercicios.map(ej=>{
                    const log=gymLog[ej]||{};
                    return (
                      <div key={ej} className="ejercicio-card">
                        <div className="ejercicio-name">{ej}</div>
                        <div className="ejercicio-inputs">
                          <div className="input-group"><label>Series</label><input type="number" min="0" placeholder="3" value={log.series||""} onChange={e=>updateGymLog(ej,"series",e.target.value)}/></div>
                          <div className="input-group"><label>Reps</label><input type="number" min="0" placeholder="10" value={log.reps||""} onChange={e=>updateGymLog(ej,"reps",e.target.value)}/></div>
                          <div className="input-group"><label>Peso kg</label><input type="number" min="0" step="0.5" placeholder="BW" value={log.peso||""} onChange={e=>updateGymLog(ej,"peso",e.target.value)}/></div>
                        </div>
                      </div>
                    );
                  })}
                  {gymSaved?<div className="success-msg">✓ Sesión guardada</div>:<button className="btn-primary" onClick={guardarGymLog}>Guardar sesión</button>}
                </>
              ):(
                <div className="empty-today">No entrenas hoy — descansa y recupera.</div>
              )}
            </div>
          )}

          {/* TROTE */}
          {page==="run"&&(
            <div className="fade-in">
              <div className="section-label" style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <RunnerIcon/>TROTE {!esHoyEditar&&<span className="rutina-badge">{fechaEditar.slice(5)}</span>}
              </div>
              <div className="form-card">
                <div className="form-row-header"><span>📍 Distancia</span><span className="form-val">{troteKm||"—"} km</span></div>
                <input type="number" step="0.1" placeholder="5.0" value={troteKm} onChange={e=>{setTroteKm(e.target.value);setTroteSaved(false);}} style={{background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:"8px",padding:"10px",color:"#fff",fontFamily:"monospace",fontSize:"20px",width:"100%",outline:"none",marginBottom:"12px"}}/>
                <div className="form-row-header"><span>⏱ Tiempo</span><span className="form-val">{troteMins||"—"} min</span></div>
                <input type="number" placeholder="30" value={troteMins} onChange={e=>{setTroteMins(e.target.value);setTroteSaved(false);}} style={{background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:"8px",padding:"10px",color:"#fff",fontFamily:"monospace",fontSize:"20px",width:"100%",outline:"none",marginBottom:"8px"}}/>
                {troteKm&&troteMins&&<div style={{fontSize:"12px",color:"rgba(255,255,255,0.35)",fontFamily:"monospace",marginBottom:"8px"}}>Ritmo: {(troteMins/troteKm).toFixed(1)} min/km</div>}
                {troteSaved?<div className="success-msg">✓ Trote guardado</div>:<button className="btn-primary" onClick={guardarTrote}>Guardar sesión</button>}
              </div>

              {troteLog.length>0&&(
                <div className="chart-card">
                  <div className="chart-title">Historial de trote</div>
                  {troteLog.slice(0,8).map(t=>(
                    <div key={t.fecha} className="week-row" style={{gridTemplateColumns:"80px 1fr 1fr 1fr"}}>
                      <span className="week-day">{t.fecha.slice(5)}</span>
                      <span className="green">{t.km}km</span>
                      <span>{t.minutos}min</span>
                      <span style={{color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>{t.ritmo_min_km?.toFixed(1)}'/km</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* POMODORO */}
          {page==="pomodoro"&&<PomodoroPage {...pomo}/>}

          {/* DIARIO */}
          {page==="diario"&&(
            <div className="fade-in">
              <div className="section-label">DIARIO · {esHoyEditar?fechaFormato:fechaEditar}</div>
              <div className="form-card">
                <textarea
                  className="diario-textarea"
                  placeholder="Escribe lo que sientes, lo que piensas, lo que quieras desahogar..."
                  value={diarioText}
                  onChange={e=>{setDiarioText(e.target.value);setDiarioSaved(false);}}
                  rows={8}
                />
                {diarioSaved?<div className="success-msg" style={{marginTop:"10px"}}>✓ Guardado</div>:<button className="btn-primary" style={{marginTop:"12px"}} onClick={guardarDiario}>Guardar</button>}
              </div>
              {diarioLog.filter(d=>d.fecha!==fechaEditar).slice(0,5).map(d=>(
                <div key={d.fecha} className="chart-card" style={{marginBottom:"10px"}}>
                  <div style={{fontSize:"10px",color:"rgba(255,255,255,0.25)",fontFamily:"monospace",marginBottom:"8px"}}>{d.fecha}</div>
                  <div style={{fontSize:"13px",color:"rgba(255,255,255,0.55)",lineHeight:"1.6",whiteSpace:"pre-wrap"}}>{d.texto.slice(0,200)}{d.texto.length>200?"...":""}</div>
                </div>
              ))}
            </div>
          )}

          {/* WEEKLY */}
          {page==="weekly"&&(
            <div className="fade-in">
              <div className="section-label">SEMANA</div>
              {dayOfWeek===5&&eloHistorico.length>=2&&(
                <div className={`weekly-msg ${esBuenaSemana?"green":"red"}`}>
                  {esBuenaSemana?`🏆 ¡Semana excelente! Subiste ${eloDiff} pts de Elo. Sigue así.`:`⚠️ Bajaste ${Math.abs(eloDiff)} pts vs la semana pasada. ¡La próxima remontas!`}
                </div>
              )}
              <div className="metrics-row" style={{marginBottom:"16px"}}>
                <div className="metric-box"><div className="metric-val">{promSueno}<span className="metric-unit">h</span></div><div className="metric-key">sueño prom</div></div>
                <div className="metric-box"><div className="metric-val">{promEstudio}<span className="metric-unit">h</span></div><div className="metric-key">estudio prom</div></div>
                <div className="metric-box"><div className={`metric-val ${diasGym>=metas.gymDias?"green":diasGym>=Math.ceil(metas.gymDias/2)?"amber":"red"}`}>{diasGym}/{metas.gymDias}</div><div className="metric-key">días gym</div></div>
                <div className="metric-box"><div className="metric-val amber">{racha}</div><div className="metric-key">racha</div></div>
              </div>
              {semanaActual.length>0&&(
                <div className="week-table-card">
                  <div className="week-table-head"><span>Día</span><span>Sueño</span><span>Estudio</span><span>Gym</span><span>Pts</span></div>
                  {[...semanaActual].reverse().map(r=>{
                    const d=parseLocalDate(r.fecha);
                    return (<div key={r.fecha} className="week-row"><span className="week-day">{DIAS_CORTOS[d.getDay()]}</span><span>{r.sueno}h</span><span>{r.estudio}h</span><span className={r.gym?"green":"muted"}>{r.gym?"✓":"—"}</span><span className="amber">{r.puntos}</span></div>);
                  })}
                </div>
              )}
              {pesoSorted.length>1&&(
                <div className="chart-card" style={{marginTop:"16px"}}>
                  <div className="chart-title">Peso corporal <span className="chart-meta">media móvil 7d</span></div>
                  <LineChart data={pesoMA} color="#fff" height={70} showArea={false}/>
                </div>
              )}
              {eloHistorico.length>0&&(
                <div className="chart-card" style={{marginTop:"16px"}}>
                  <div className="chart-title">Elo por semana</div>
                  {eloHistorico.slice(0,12).map(e=>(
                    <div key={e.semana} className="elo-history-row">
                      <span className="elo-hist-label">{e.semana}</span>
                      <div className="elo-hist-bar-wrap"><div className="elo-hist-bar" style={{width:`${Math.min((e.elo/100)*100,100)}%`}}/></div>
                      <span className="elo-hist-val">{e.elo}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CONFIG */}
          {page==="config"&&(
            <div className="fade-in">
              <div className="section-label">METAS PERSONALIZADAS</div>
              <div className="form-card">
                <div className="config-row">
                  <div><div className="config-row-label">🌙 Meta de sueño</div><div className="config-row-sub">horas para puntaje completo</div></div>
                  <div className="config-stepper">
                    <button className="config-stepper-btn" onClick={()=>updateMeta("sueno",-0.5,4,10)}>−</button>
                    <span className="config-stepper-val">{metas.sueno}h</span>
                    <button className="config-stepper-btn" onClick={()=>updateMeta("sueno",0.5,4,10)}>+</button>
                  </div>
                </div>
                <div className="config-row">
                  <div><div className="config-row-label">📖 Meta de estudio</div><div className="config-row-sub">horas para puntaje completo</div></div>
                  <div className="config-stepper">
                    <button className="config-stepper-btn" onClick={()=>updateMeta("estudio",-0.5,1,8)}>−</button>
                    <span className="config-stepper-val">{metas.estudio}h</span>
                    <button className="config-stepper-btn" onClick={()=>updateMeta("estudio",0.5,1,8)}>+</button>
                  </div>
                </div>
                <div className="config-row">
                  <div><div className="config-row-label">🔥 Umbral de racha</div><div className="config-row-sub">puntos mínimos del día para no cortarla</div></div>
                  <div className="config-stepper">
                    <button className="config-stepper-btn" onClick={()=>updateMeta("racha",-5,10,100)}>−</button>
                    <span className="config-stepper-val">{metas.racha}</span>
                    <button className="config-stepper-btn" onClick={()=>updateMeta("racha",5,10,100)}>+</button>
                  </div>
                </div>
                <div className="config-row">
                  <div><div className="config-row-label">🏋️ Meta de días de gym</div><div className="config-row-sub">por semana</div></div>
                  <div className="config-stepper">
                    <button className="config-stepper-btn" onClick={()=>updateMeta("gymDias",-1,1,7)}>−</button>
                    <span className="config-stepper-val">{metas.gymDias}</span>
                    <button className="config-stepper-btn" onClick={()=>updateMeta("gymDias",1,1,7)}>+</button>
                  </div>
                </div>
              </div>

              <div className="section-label" style={{marginTop:"20px"}}>RECORDATORIOS</div>
              <div className="form-card">
                <div className="toggle-row">
                  <span>🔔 Avisarme si no he registrado el día (20:00)</span>
                  <div className={`toggle ${remindersOn?"on":""}`} onClick={()=>setRemindersOn(!remindersOn)}><div className="toggle-dot"/></div>
                </div>
                <div style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",marginTop:"10px",lineHeight:"1.5"}}>
                  Funciona mientras la app esté abierta o recién en segundo plano. iOS no permite notificaciones push reales en apps web sin un servidor — esta es la alternativa disponible dentro de Safari/PWA.
                </div>
              </div>

              <div className="section-label" style={{marginTop:"20px"}}>DATOS</div>
              <div className="form-card">
                <div className="config-row">
                  <div>
                    <div className="config-row-label">Estado de sincronización</div>
                    <div className="config-row-sub">{pendingCount>0?`${pendingCount} cambio(s) pendiente(s) de subir`:"todo sincronizado con Supabase"}</div>
                  </div>
                  {pendingCount>0&&<button className="config-stepper-btn" style={{width:"auto",padding:"0 10px"}} onClick={syncPending}>↻</button>}
                </div>
              </div>
              <button className="btn-primary" onClick={exportarDatos}>⬇ Exportar mis datos (JSON)</button>

              <div className="section-label" style={{marginTop:"20px"}}>ACERCA DE</div>
              <div className="form-card">
                <div style={{fontSize:"12px",color:"rgba(255,255,255,0.35)",lineHeight:"1.6"}}>
                  Areté · uso personal<br/>
                  Los datos se guardan en Supabase, con respaldo local si no hay conexión.
                </div>
              </div>
            </div>
          )}

        </>)}
      </main>

      {/* MODAL */}
      {eloModal&&eloModalData&&(
        <div className="modal-overlay" onClick={()=>setEloModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Desglose del día</div>
            {eloModalData.items.map((item,i)=>(
              <div key={i} className="desglose-row">
                <span className={`desglose-dot ${item.neutral?"neutral":item.ok?"ok":"fail"}`}/>
                <span className="desglose-label">{item.label}</span>
                <span className={`desglose-pts ${item.pts>0?"amber":""}`}>{item.pts>0?`+${item.pts}`:item.neutral?"—":"0"}</span>
              </div>
            ))}
            <div className="desglose-total"><span>Total</span><span className="amber">{eloModalData.total} pts</span></div>
            <button className="btn-primary" style={{marginTop:"16px"}} onClick={()=>setEloModal(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}