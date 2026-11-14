"use client";
import { useState, useEffect } from "react";

const filters = ["All", "Open", "Answered", "Scheduled"];
const json = { "Content-Type": "application/json" };

export default function FacultyView({ user }) {
  const [queries, setQueries] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [view, setView] = useState("queries"); // "queries" or "sessions"
  const [filter, setFilter] = useState("All");
  const [answers, setAnswers] = useState({});
  const [slots, setSlots] = useState({});
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({ title: "", scheduledAt: "", meetLink: "" });
  const [recordings, setRecordings] = useState({});
  const [error, setError] = useState("");
  const [matching, setMatching] = useState("");

  // the server already checked the login, so just load the data
  useEffect(() => { load(); }, []);

  async function load() {
    const q = await fetch("/api/queries");
    if (!q.ok) { window.location.replace("/login"); return; }
    setMatching(q.headers.get("X-Matching") || "");
    setQueries(await q.json());
    const s = await fetch("/api/sessions");
    setSessions(await s.json());
  }

  async function update(id, data) {
    await fetch("/api/queries/" + id, { method: "PATCH", headers: json, body: JSON.stringify(data) });
    load();
  }

  function toggle(id) {
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  async function createSession() {
    setError("");
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ ...form, queryIds: selected }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }

    setSelected([]);
    setForm({ title: "", scheduledAt: "", meetLink: "" });
    setView("sessions");
    load();
  }

  async function saveRecording(id) {
    setError("");
    const res = await fetch("/api/sessions/" + id, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ recordingLink: recordings[id] }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    load();
  }

  const count = (status) => queries.filter((q) => q.status === status).length;
  const shown = filter === "All" ? queries : queries.filter((q) => q.status === filter);
  // the server worked out which doubts are alike (by meaning when Ollama is running)
  const similar = {};
  for (const q of queries) similar[q.id] = q.similarIds || [];

  return (
    <div>
      <h1 className="page-title">Welcome, {user.name}</h1>
      <p className="page-sub">Answer queries, or bring students with the same doubt into one Google Meet.</p>
      {matching && (
        <p className="muted" style={{ marginTop: -12 }}>
          Similar doubts are matched by {matching === "meaning" ? "meaning (AI)" : "keywords only"}.
        </p>
      )}

      <div className="tabs">
        <button className={"tab " + (view === "queries" ? "active" : "")} onClick={() => setView("queries")}>
          Queries ({queries.length})
        </button>
        <button className={"tab " + (view === "sessions" ? "active" : "")} onClick={() => setView("sessions")}>
          Group Sessions ({sessions.length})
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {/* ================= QUERIES VIEW ================= */}
      {view === "queries" && (
        <div>
          <div className="stats">
            <div className="card stat"><div className="num">{queries.length}</div><div className="label">Total</div></div>
            <div className="card stat"><div className="num">{count("Open")}</div><div className="label">Open</div></div>
            <div className="card stat"><div className="num">{count("Answered")}</div><div className="label">Answered</div></div>
            <div className="card stat"><div className="num">{count("Scheduled")}</div><div className="label">Scheduled</div></div>
          </div>

          {/* create-session panel, shows when queries are selected */}
          {selected.length > 0 && (
            <div className="card panel">
              <h3>Create group session ({selected.length} student{selected.length > 1 ? "s" : ""})</h3>
              <label>Session title</label>
              <input
                placeholder="e.g. Binary Search - doubt clearing"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <label>Date and time</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
              <label>Google Meet link</label>
              <div className="row">
                <input
                  placeholder="https://meet.google.com/abc-defg-hij"
                  value={form.meetLink}
                  onChange={(e) => setForm({ ...form, meetLink: e.target.value })}
                />
                <a href="https://meet.google.com/new" target="_blank" rel="noreferrer" className="btn btn-light" style={{ flex: "0 0 auto", marginBottom: 14 }}>
                  Create Google Meet
                </a>
              </div>
              <p className="muted" style={{ marginTop: 0 }}>
                Click "Create Google Meet", copy the link from the new tab and paste it here.
              </p>
              <div className="row">
                <button className="btn" onClick={createSession}>Create Session</button>
                <button className="btn btn-light" onClick={() => setSelected([])}>Cancel</button>
              </div>
            </div>
          )}

          <div className="tabs">
            {filters.map((f) => (
              <button key={f} className={"tab " + (filter === f ? "active" : "")} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>

          {shown.length === 0 && <div className="card empty">No queries here yet 🎉</div>}

          {shown.map((q) => {
            const others = similar[q.id] || [];
            return (
              <div className={"card query-card " + q.priority.toLowerCase()} key={q.id}>
                <div className="badges">
                  <span className={"badge " + q.priority.toLowerCase()}>{q.priority}</span>
                  <span className="badge">{q.course}</span>
                  <span className="badge">{q.category}</span>
                  <span className={"badge " + q.status.toLowerCase()}>{q.status}</span>
                  {q.private && <span className="badge">🔒 Private</span>}
                  {q.sessionId && <span className="badge group">👥 In group session</span>}
                  {(q.alsoAsked || []).length > 0 && (
                    <span className="badge group">🙋 {q.alsoAsked.length === 1 ? "1 classmate has" : q.alsoAsked.length + " classmates have"} this too</span>
                  )}
                  {others.length > 0 && <span className="badge group">👥 {others.length} similar doubt{others.length > 1 ? "s" : ""}</span>}
                </div>

                <p><b>{q.question}</b></p>
                <p className="muted">
                  Asked by {q.name} ({q.roll}) on {new Date(q.createdAt).toLocaleDateString()}
                  {(q.alsoAsked || []).length > 0 && " · Also: " + q.alsoAsked.map((a) => a.name).join(", ")}
                </p>

                {q.answer && <div className="answer-box"><b>Answer:</b> {q.answer}</div>}
                {q.appointment && (
                  <div className="slot-box">🗓 <b>Scheduled:</b> {new Date(q.appointment).toLocaleString()}</div>
                )}

                {/* select for a group session */}
                {!q.sessionId && (
                  <div style={{ marginTop: 12 }} className="row">
                    <label className="check" style={{ marginBottom: 0 }}>
                      <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggle(q.id)} />
                      Select for group session
                    </label>
                    {others.length > 0 && (
                      <button className="btn btn-light" onClick={() => setSelected([q.id, ...others])}>
                        Select all {others.length + 1} similar
                      </button>
                    )}
                  </div>
                )}

                {!q.sessionId && (
                  <div style={{ marginTop: 14 }}>
                    <textarea
                      rows={2}
                      placeholder="Write your answer..."
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                    <div className="row">
                      <button className="btn" onClick={() => update(q.id, { answer: answers[q.id] })}>
                        Send Answer
                      </button>
                      <input
                        type="datetime-local"
                        style={{ marginBottom: 0 }}
                        value={slots[q.id] || ""}
                        onChange={(e) => setSlots({ ...slots, [q.id]: e.target.value })}
                      />
                      <button className="btn btn-light" onClick={() => update(q.id, { appointment: slots[q.id] })}>
                        Schedule
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ================= SESSIONS VIEW ================= */}
      {view === "sessions" && (
        <div>
          {sessions.length === 0 && (
            <div className="card empty">
              No group sessions yet. Select queries with the same doubt in the Queries tab.
            </div>
          )}

          {sessions.map((s) => (
            <div className="card session-card" key={s.id}>
              <div className="badges">
                <span className="badge group">👥 {s.students.length} student{s.students.length > 1 ? "s" : ""}</span>
                <span className="badge">{s.course}</span>
              </div>
              <h3>{s.title}</h3>
              <p className="muted">🗓 {new Date(s.scheduledAt).toLocaleString()}</p>
              <p className="muted">Students: {s.students.join(", ")}</p>

              <a href={s.meetLink} target="_blank" rel="noreferrer" className="btn">Join Google Meet</a>

              {s.recordingLink ? (
                <div className="rec-box">
                  🎥 Recording saved:{" "}
                  <a href={s.recordingLink} target="_blank" rel="noreferrer">Open recording</a>
                </div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <label>Recording link (Google Drive)</label>
                  <div className="row">
                    <input
                      style={{ marginBottom: 0 }}
                      placeholder="Paste the recording link after the session"
                      value={recordings[s.id] || ""}
                      onChange={(e) => setRecordings({ ...recordings, [s.id]: e.target.value })}
                    />
                    <button className="btn" style={{ flex: "0 0 auto" }} onClick={() => saveRecording(s.id)}>
                      Save Recording
                    </button>
                  </div>
                  <p className="muted">
                    In Meet: Activities, then Recording, then Start recording. Meet saves the file to your Drive.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
