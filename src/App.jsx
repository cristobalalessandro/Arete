import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE CONFIG ────────────────────────────────────────────────
// Reemplaza estos valores con los tuyos de supabase.com
const SUPABASE_URL = "https://dhulanbexyskiejzjwlu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRodWxhbmJleHlza2llanpqd2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzUzMjQsImV4cCI6MjA5NDAxMTMyNH0.ldrioScuLFgMWJzfEs0Uhj1M2jcSKKkopLlxehwpENw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── RUTINA SEMANAL ─────────────────────────────────────────────────
const RUTINA = {
  1: {
    nombre: "Push",
    ejercicios: [
      "Press inclinado",
      "Fondos",
      "Apertura",
      "Press militar",
      "Laterales con mancuerna",
      "Trícep en press francés con polea",
    ],
  },
  2: {
    nombre: "Pull",
    ejercicios: [
      "Dominadas libres",
      "Jalón al pecho",
      "Remo T con mancuernas",
      "Pull over",
      "Curl martillo",
      "Curl bayesiano",
    ],
  },
  3: {
    nombre: "Pierna",
    ejercicios: [
      "Sentadilla",
      "Prensa",
      "Extensión de cuádriceps",
      "Curl femoral",
      "Elevación de talones",
      "Hip thrust",
    ],
  },
  4: {
    nombre: "Hombro / Bícep / Trícep",
    ejercicios: [
      "Press militar",
      "Laterales con mancuerna",
      "Peck deck hombro posterior",
      "Curl francés con barra",
      "Bíceps en polea",
    ],
  },
  5: {
    nombre: "Core + Combate",
    ejercicios: [
      "Plancha",
      "Abdominales",
      "Russian twist",
      "Boxeo / MMA",
      "Landmine press con barra olímpica",
    ],
  },
};

// ─── ELO HELPERS ────────────────────────────────────────────────────
function calcularPuntosDelDia({ sueño, estudio, gym, sensacion }) {
  let pts = 0;
  // Sueño (max 30 pts)
  if (sueño >= 7) pts += 30;
  else if (sueño >= 6) pts += 18;
  else pts += 8;
  // Estudio (max 40 pts)
  if (estudio >= 4) pts += 40;
  else if (estudio >= 2) pts += 20;
  else pts += 5;
  // Gym (max 30 pts)
  if (gym) pts += 15 + (sensacion || 3) * 3;
  return pts;
}

function calcularEloSemanal(registros) {
  const total = registros.reduce((acc, r) => acc + r.puntos, 0);
  return Math.round(total / registros.length);
}

// ─── QUOTES ─────────────────────────────────────────────────────────
const QUOTES = [
  "La disciplina es el puente entre las metas y los logros.",
  "No busques la perfección, busca la constancia.",
  "El dolor de hoy es la fuerza de mañana.",
  "Un día a la vez, una rep a la vez.",
  "El campeón no es el que nunca cae, sino el que siempre se levanta.",
  "Sé el arquitecto de tu propio cuerpo y mente.",
  "La excelencia no es un acto, es un hábito.",
];

// ─── MAIN APP ───────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home");
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [today] = useState(new Date());
  const [dayOfWeek] = useState(today.getDay()); // 1=Lun ... 5=Vie
  const [todayStr] = useState(today.toISOString().split("T")[0]);

  // Data state
  const [registros, setRegistros] = useState([]);
  const [eloHistorico, setEloHistorico] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [sueno, setSueno] = useState(7);
  const [estudio, setEstudio] = useState(4);
  const [gym, setGym] = useState(false);
  const [sensacion, setSensacion] = useState(3);
  const [savedMsg, setSavedMsg] = useState("");

  // Gym log state
  const [gymLog, setGymLog] = useState({});
  const [gymSaved, setGymSaved] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: recs } = await supabase
        .from("registros")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(30);
      setRegistros(recs || []);

      const todayRec = (recs || []).find((r) => r.fecha === todayStr);
      setTodayRecord(todayRec || null);

      const { data: elo } = await supabase
        .from("elo_semanal")
        .select("*")
        .order("semana", { ascending: false })
        .limit(6);
      setEloHistorico(elo || []);

      // Load gym log for today
      const { data: glog } = await supabase
        .from("gym_log")
        .select("*")
        .eq("fecha", todayStr);
      if (glog && glog.length > 0) {
        const log = {};
        glog.forEach((item) => {
          log[item.ejercicio] = { series: item.series, reps: item.reps, peso: item.peso };
        });
        setGymLog(log);
        setGymSaved(true);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function registrarDia() {
    const puntos = calcularPuntosDelDia({ sueño: sueno, estudio, gym, sensacion });
    const payload = {
      fecha: todayStr,
      sueno,
      estudio,
      gym,
      sensacion: gym ? sensacion : null,
      puntos,
    };
    const { error } = await supabase.from("registros").upsert(payload, { onConflict: "fecha" });
    if (!error) {
      setSavedMsg(`¡Registrado! +${puntos} pts`);
      setTimeout(() => setSavedMsg(""), 3000);
      fetchData();

      // Si es viernes, calcular Elo semanal
      if (dayOfWeek === 5) {
        const semanaRecs = registros.filter((r) => {
          const d = new Date(r.fecha);
          const diff = (today - d) / 86400000;
          return diff <= 7;
        });
        semanaRecs.push(payload);
        const eloSem = calcularEloSemanal(semanaRecs);
        await supabase.from("elo_semanal").upsert(
          { semana: todayStr, elo: eloSem, dias: semanaRecs.length },
          { onConflict: "semana" }
        );
      }
    }
  }

  async function guardarGymLog() {
    const entries = Object.entries(gymLog).map(([ejercicio, vals]) => ({
      fecha: todayStr,
      ejercicio,
      series: parseInt(vals.series) || 0,
      reps: parseInt(vals.reps) || 0,
      peso: parseFloat(vals.peso) || 0,
    }));
    if (entries.length === 0) return;
    const { error } = await supabase
      .from("gym_log")
      .upsert(entries, { onConflict: "fecha,ejercicio" });
    if (!error) setGymSaved(true);
  }

  // ── Derived stats ──────────────────────────────────────────────────
  const eloActual = eloHistorico.length > 0 ? eloHistorico[0].elo : 0;
  const eloAnterior = eloHistorico.length > 1 ? eloHistorico[1].elo : 0;
  const eloDiff = eloActual - eloAnterior;

  const semanaActual = registros.slice(0, 5);
  const promSueno = semanaActual.length
    ? (semanaActual.reduce((a, r) => a + r.sueno, 0) / semanaActual.length).toFixed(1)
    : "—";
  const promEstudio = semanaActual.length
    ? (semanaActual.reduce((a, r) => a + r.estudio, 0) / semanaActual.length).toFixed(1)
    : "—";
  const diasGym = semanaActual.filter((r) => r.gym).length;

  const rutinaHoy = RUTINA[dayOfWeek] || null;

  const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const fechaFormato = `${DIAS_CORTOS[today.getDay()]} ${today.getDate()} ${MESES[today.getMonth()]}`;

  // ── Render helpers ─────────────────────────────────────────────────
  function updateGymLog(ejercicio, field, value) {
    setGymLog((prev) => ({
      ...prev,
      [ejercicio]: { ...(prev[ejercicio] || {}), [field]: value },
    }));
    setGymSaved(false);
  }

  const esBuenaSemana = eloDiff >= 0;

  return (
    <div className="app">
      {/* QUOTE */}
      <div className="quote-bar">
        <span className="quote-icon">✦</span>
        <span>{quote}</span>
      </div>

      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <h1 className="app-name">Areté</h1>
          <span className="fecha">{fechaFormato}</span>
        </div>
        <nav className="nav">
          {[
            { id: "home", icon: "⌂" },
            { id: "register", icon: "✎" },
            { id: "gym", icon: "◈" },
            { id: "weekly", icon: "◎" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`nav-btn ${page === tab.id ? "active" : ""}`}
              onClick={() => setPage(tab.id)}
            >
              {tab.icon}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {loading ? (
          <div className="loading">Cargando...</div>
        ) : (
          <>
            {/* ── HOME ── */}
            {page === "home" && (
              <div className="fade-in">
                {/* ELO CARD */}
                <div className="elo-hero">
                  <div className="elo-label">ELO SEMANAL</div>
                  <div className="elo-number">
                    {eloActual > 0 ? eloActual : "—"}
                  </div>
                  {eloHistorico.length > 1 && (
                    <div className={`elo-diff ${esBuenaSemana ? "up" : "down"}`}>
                      {esBuenaSemana ? "▲" : "▼"} {Math.abs(eloDiff)} vs semana anterior
                    </div>
                  )}
                  {eloHistorico.length > 0 && (
                    <div className={`elo-badge ${esBuenaSemana ? "green" : "red"}`}>
                      {esBuenaSemana ? "Semana excelente" : "Puedes mejorar"}
                    </div>
                  )}
                </div>

                {/* HOY */}
                <div className="section-label">HOY</div>
                {todayRecord ? (
                  <div className="metrics-row">
                    <div className="metric-box">
                      <div className="metric-val">{todayRecord.sueno}<span className="metric-unit">h</span></div>
                      <div className="metric-key">sueño</div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-val">{todayRecord.estudio}<span className="metric-unit">h</span></div>
                      <div className="metric-key">estudio</div>
                    </div>
                    <div className="metric-box">
                      <div className={`metric-val ${todayRecord.gym ? "green" : "muted"}`}>
                        {todayRecord.gym ? "✓" : "—"}
                      </div>
                      <div className="metric-key">gym</div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-val amber">{todayRecord.puntos}</div>
                      <div className="metric-key">puntos</div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-today" onClick={() => setPage("register")}>
                    Registra tu día →
                  </div>
                )}

                {/* SLEEP CHART */}
                {semanaActual.length > 0 && (
                  <div className="chart-card">
                    <div className="chart-title">Sueño esta semana <span className="chart-meta">meta 7h</span></div>
                    <div className="bars">
                      {[...semanaActual].reverse().map((r) => {
                        const pct = Math.min((r.sueno / 10) * 100, 100);
                        const ok = r.sueno >= 7;
                        const d = new Date(r.fecha);
                        return (
                          <div key={r.fecha} className="bar-col">
                            <div className="bar-wrap">
                              <div
                                className={`bar ${ok ? "bar-green" : "bar-red"}`}
                                style={{ height: `${pct}%` }}
                              />
                            </div>
                            <span className="bar-label">{DIAS_CORTOS[d.getDay()][0]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ELO HISTORY */}
                {eloHistorico.length > 1 && (
                  <div className="chart-card">
                    <div className="chart-title">Elo histórico</div>
                    <div className="elo-line">
                      <svg viewBox={`0 0 300 60`} preserveAspectRatio="none" width="100%" height="60">
                        {(() => {
                          const vals = [...eloHistorico].reverse().map((e) => e.elo);
                          const min = Math.min(...vals) - 5;
                          const max = Math.max(...vals) + 5;
                          const pts = vals
                            .map((v, i) => {
                              const x = (i / (vals.length - 1)) * 300;
                              const y = 60 - ((v - min) / (max - min)) * 55;
                              return `${x},${y}`;
                            })
                            .join(" ");
                          const lastX = 300;
                          const lastY =
                            60 -
                            ((vals[vals.length - 1] - min) / (max - min)) * 55;
                          return (
                            <>
                              <polyline
                                points={pts}
                                fill="none"
                                stroke="rgba(255,255,255,0.5)"
                                strokeWidth="1.5"
                              />
                              <circle cx={lastX} cy={lastY} r="3" fill="#fff" />
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── REGISTRO ── */}
            {page === "register" && (
              <div className="fade-in">
                <div className="section-label">REGISTRO DEL DÍA</div>

                <div className="form-card">
                  <div className="form-row-header">
                    <span>🌙 Sueño</span>
                    <span className="form-val">{sueno}h</span>
                  </div>
                  <input
                    type="range" min="4" max="10" step="0.5"
                    value={sueno}
                    onChange={(e) => setSueno(parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-labels"><span>4h</span><span>Meta: 7h</span><span>10h</span></div>
                </div>

                <div className="form-card">
                  <div className="form-row-header">
                    <span>📖 Estudio efectivo</span>
                    <span className="form-val">{estudio}h</span>
                  </div>
                  <input
                    type="range" min="0" max="8" step="0.5"
                    value={estudio}
                    onChange={(e) => setEstudio(parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-labels"><span>0h</span><span>Meta: 4h</span><span>8h</span></div>
                </div>

                <div className="form-card">
                  <div className="toggle-row">
                    <span>🏋️ ¿Fuiste al gym?</span>
                    <div
                      className={`toggle ${gym ? "on" : ""}`}
                      onClick={() => setGym(!gym)}
                    >
                      <div className="toggle-dot" />
                    </div>
                  </div>
                  {gym && (
                    <div className="feel-section">
                      <div className="form-row-header" style={{ marginTop: "16px" }}>
                        <span>¿Cómo te sentiste?</span>
                        <span className="form-val">{sensacion}/5</span>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={sensacion}
                        onChange={(e) => setSensacion(parseInt(e.target.value))}
                        className="slider"
                      />
                      <div className="slider-labels"><span>Mal</span><span>Regular</span><span>Excelente</span></div>
                    </div>
                  )}
                </div>

                <div className="puntos-preview">
                  Puntos estimados: <strong>{calcularPuntosDelDia({ sueño: sueno, estudio, gym, sensacion })}</strong> / 100
                </div>

                {savedMsg ? (
                  <div className="success-msg">{savedMsg}</div>
                ) : (
                  <button className="btn-primary" onClick={registrarDia}>
                    Registrar día
                  </button>
                )}
              </div>
            )}

            {/* ── GYM ── */}
            {page === "gym" && (
              <div className="fade-in">
                <div className="section-label">
                  GYM HOY
                  {rutinaHoy && (
                    <span className="rutina-badge">{rutinaHoy.nombre}</span>
                  )}
                </div>

                {rutinaHoy ? (
                  <>
                    {rutinaHoy.ejercicios.map((ej) => {
                      const log = gymLog[ej] || {};
                      return (
                        <div key={ej} className="ejercicio-card">
                          <div className="ejercicio-name">{ej}</div>
                          <div className="ejercicio-inputs">
                            <div className="input-group">
                              <label>Series</label>
                              <input
                                type="number" min="0" placeholder="3"
                                value={log.series || ""}
                                onChange={(e) => updateGymLog(ej, "series", e.target.value)}
                              />
                            </div>
                            <div className="input-group">
                              <label>Reps</label>
                              <input
                                type="number" min="0" placeholder="10"
                                value={log.reps || ""}
                                onChange={(e) => updateGymLog(ej, "reps", e.target.value)}
                              />
                            </div>
                            <div className="input-group">
                              <label>Peso kg</label>
                              <input
                                type="number" min="0" step="0.5" placeholder="BW"
                                value={log.peso || ""}
                                onChange={(e) => updateGymLog(ej, "peso", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {gymSaved ? (
                      <div className="success-msg">✓ Sesión guardada</div>
                    ) : (
                      <button className="btn-primary" onClick={guardarGymLog}>
                        Guardar sesión
                      </button>
                    )}
                  </>
                ) : (
                  <div className="empty-today">No entrenas hoy — descansa y recupera.</div>
                )}
              </div>
            )}

            {/* ── WEEKLY ── */}
            {page === "weekly" && (
              <div className="fade-in">
                <div className="section-label">SEMANA</div>

                {dayOfWeek === 5 && eloHistorico.length >= 2 && (
                  <div className={`weekly-msg ${esBuenaSemana ? "green" : "red"}`}>
                    {esBuenaSemana
                      ? `🏆 ¡Semana excelente! Subiste ${eloDiff} pts de Elo. Sigue así.`
                      : `⚠️ Bajaste ${Math.abs(eloDiff)} pts vs la semana pasada. ¡La próxima remontas!`}
                  </div>
                )}

                <div className="metrics-row" style={{ marginBottom: "16px" }}>
                  <div className="metric-box">
                    <div className="metric-val">{promSueno}<span className="metric-unit">h</span></div>
                    <div className="metric-key">sueño prom</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-val">{promEstudio}<span className="metric-unit">h</span></div>
                    <div className="metric-key">estudio prom</div>
                  </div>
                  <div className="metric-box">
                    <div className={`metric-val ${diasGym >= 4 ? "green" : diasGym >= 2 ? "amber" : "red"}`}>
                      {diasGym}/5
                    </div>
                    <div className="metric-key">días gym</div>
                  </div>
                </div>

                {/* Tabla semana */}
                {semanaActual.length > 0 && (
                  <div className="week-table-card">
                    <div className="week-table-head">
                      <span>Día</span><span>Sueño</span><span>Estudio</span><span>Gym</span><span>Pts</span>
                    </div>
                    {[...semanaActual].reverse().map((r) => {
                      const d = new Date(r.fecha);
                      return (
                        <div key={r.fecha} className="week-row">
                          <span className="week-day">{DIAS_CORTOS[d.getDay()]}</span>
                          <span>{r.sueno}h</span>
                          <span>{r.estudio}h</span>
                          <span className={r.gym ? "green" : "muted"}>{r.gym ? "✓" : "—"}</span>
                          <span className="amber">{r.puntos}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Elo histórico */}
                {eloHistorico.length > 0 && (
                  <div className="chart-card" style={{ marginTop: "16px" }}>
                    <div className="chart-title">Elo por semana</div>
                    {eloHistorico.slice(0, 5).map((e) => (
                      <div key={e.semana} className="elo-history-row">
                        <span className="elo-hist-label">{e.semana}</span>
                        <div className="elo-hist-bar-wrap">
                          <div
                            className="elo-hist-bar"
                            style={{ width: `${Math.min((e.elo / 100) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="elo-hist-val">{e.elo}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
