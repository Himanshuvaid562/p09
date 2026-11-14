"use client";
import { useState, useEffect } from "react";
import { similarDoubts } from "@/lib/triage";

export default function StudentView({ user, courses }) {
  const [form, setForm] = useState({ course: courses[0] || "", question: "", private: false });
  const [tab, setTab] = useState("board"); // "board" or "mine"
  const [board, setBoard] = useState([]);
  const [myQueries, setMyQueries] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [method, setMethod] = useState("");

  // the server already checked the login, so just load the data
  useEffect(() => { loadAll(); }, []);

  // look for doubts that mean the same thing, a moment after the student stops typing
  useEffect(() => {
    const text = form.question.trim();
    if (text.length < 8) { setSuggestions([]); setMethod(""); return; }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/board/similar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, course: form.course }),
        });
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (!cancelled) { setSuggestions(data.matches); setMethod(data.method); }
      } catch (e) {
        // server not reachable: plain keyword match in the browser
        if (!cancelled) { setSuggestions(similarDoubts(text, form.course, board)); setMethod("keywords"); }
      }
    }, 500);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.question, form.course]);

  async function loadAll() {
    const q = await fetch("/api/queries");
    if (!q.ok) { window.location.replace("/login"); return; }
    setMyQueries(await q.json());
    setBoard(await (await fetch("/api/board")).json());
    setMySessions(await (await fetch("/api/sessions")).json());
  }

  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setError("");

    const res = await fetch("/api/queries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const saved = await res.json();

    if (!res.ok) {
      setError(saved.error || "Please write your question.");
      return;
    }
    setMsg(
      "Sent to " + saved.assignedTo + " as " + saved.category + " (" + saved.priority + " priority)" +
      (saved.private ? ". Only faculty can see this one." : ". Your classmates can see it too.")
    );
    setForm({ ...form, question: "" });
    loadAll();
  }

  // "I have this doubt too" (press again to undo)
  async function meToo(id) {
    const res = await fetch("/api/queries/" + id + "/metoo", { method: "POST" });
    if (res.ok) {
      const r = await res.json();
      setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, iHaveThis: r.iHaveThis, alsoCount: r.alsoCount } : s)));
    }
    loadAll();
  }

  const date = (d) => new Date(d).toLocaleDateString();


  return (
    <div>
      <h1 className="page-title">Hi, {user.name} 👋</h1>
      <p className="page-sub">
        Roll no. {user.roll} · Courses: {courses.join(", ")}
      </p>

      <div className="grid-2">
        {/* ---- Left: form ---- */}
        <div className="card">
          <h3>Ask a question</h3>
          <form onSubmit={submit}>
            <label>Course</label>
            <select name="course" value={form.course} onChange={change}>
              {courses.map((c) => <option key={c}>{c}</option>)}
            </select>

            <label>Your doubt or request</label>
            <textarea
              name="question"
              rows={6}
              placeholder="Type your question here..."
              value={form.question}
              onChange={change}
            />

            {suggestions.length > 0 && (
              <div className="suggest">
                <b>Already asked in {form.course}</b>
                <p className="muted" style={{ margin: "2px 0 10px" }}>
                  Is one of these your doubt? Tap it instead of asking again.
                </p>

                {suggestions.map((s) => (
                  <div className="suggest-item" key={s.id}>
                    <p style={{ margin: "0 0 6px" }}><b>{s.question}</b></p>
                    <div className="badges">
                      <span className={"badge " + s.status.toLowerCase()}>{s.status}</span>
                      {s.alsoCount > 0 && <span className="badge">🙋 {s.alsoCount} more</span>}
                    </div>
                    {s.answer && <div className="answer-box" style={{ marginBottom: 8 }}><b>Answer:</b> {s.answer}</div>}
                    <button
                      type="button"
                      className={"btn btn-small " + (s.iHaveThis ? "btn-light" : "")}
                      onClick={() => meToo(s.id)}
                    >
                      {s.iHaveThis ? "✓ You have this doubt too (tap to undo)" : "🙋 Same doubt, I have this too"}
                    </button>
                  </div>
                ))}
                <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
                  Matched by {method === "meaning" ? "meaning (AI)" : "keywords"}
                </p>
              </div>
            )}

            <label className="check">
              <input
                type="checkbox"
                checked={form.private}
                onChange={(e) => setForm({ ...form, private: e.target.checked })}
              />
              Keep private (only faculty can see it)
            </label>

            {msg && <div className="toast">✅ {msg}</div>}
            {error && <div className="error">{error}</div>}

            <button type="submit" className={"btn btn-full " + (suggestions.length > 0 ? "btn-light" : "")}>
              {suggestions.length > 0 ? "It's different, submit my own query" : "Submit Query"}
            </button>
          </form>
          <p className="muted" style={{ marginBottom: 0 }}>
            Marks and attendance questions are always private. Classmates never see your name.
          </p>
        </div>

        {/* ---- Right: sessions + board / my queries ---- */}
        <div>
          {mySessions.length > 0 && (
            <div>
              <h3 style={{ marginTop: 0 }}>Group Sessions</h3>
              {mySessions.map((s) => (
                <div className="card session-card" key={s.id}>
                  <div className="badges">
                    <span className="badge group">👥 Group session</span>
                    <span className="badge">{s.course}</span>
                  </div>
                  <p><b>{s.title}</b></p>
                  <p className="muted">With {s.faculty} · {new Date(s.scheduledAt).toLocaleString()}</p>

                  <a href={s.meetLink} target="_blank" rel="noreferrer" className="btn">Join Google Meet</a>

                  {s.recordingLink ? (
                    <div className="rec-box">
                      🎥 <a href={s.recordingLink} target="_blank" rel="noreferrer"><b>Watch the recording</b></a>
                    </div>
                  ) : (
                    <p className="muted" style={{ marginTop: 10 }}>
                      The recording will appear here after the session.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="tabs">
            <button className={"tab " + (tab === "board" ? "active" : "")} onClick={() => setTab("board")}>
              Class Doubts ({board.length})
            </button>
            <button className={"tab " + (tab === "mine" ? "active" : "")} onClick={() => setTab("mine")}>
              My Queries ({myQueries.length})
            </button>
            <button className="tab" onClick={loadAll}>↻ Refresh</button>
          </div>

          {/* ===== Class Doubts: everyone's public doubts in my courses ===== */}
          {tab === "board" && (
            <div>
              <p className="muted" style={{ marginTop: 0 }}>
                Doubts from your courses. Have the same one? Tap the button instead of asking again.
              </p>

              {board.length === 0 && <div className="card empty">No doubts in your courses yet.</div>}

              {board.map((b) => (
                <div className="card query-card" key={b.id}>
                  <div className="badges">
                    <span className="badge">{b.course}</span>
                    <span className="badge">{b.category}</span>
                    <span className={"badge " + b.status.toLowerCase()}>{b.status}</span>
                    {b.mine && <span className="badge group">You asked</span>}
                    {b.inSession && <span className="badge group">👥 Group session planned</span>}
                  </div>

                  <p><b>{b.question}</b></p>
                  <p className="muted">
                    Asked by {b.mine ? "you" : "a classmate"} on {date(b.createdAt)}
                    {b.alsoCount > 0 && " · 🙋 " + b.alsoCount + " more " + (b.alsoCount > 1 ? "have" : "has") + " this doubt"}
                  </p>

                  {b.answer && <div className="answer-box"><b>Answer:</b> {b.answer}</div>}

                  {!b.mine && (
                    <button
                      className={"btn " + (b.iHaveThis ? "btn-light" : "")}
                      style={{ marginTop: 12 }}
                      onClick={() => meToo(b.id)}
                    >
                      {b.iHaveThis ? "✓ You have this doubt too (tap to undo)" : "🙋 I have this doubt too"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ===== My Queries ===== */}
          {tab === "mine" && (
            <div>
              {myQueries.length === 0 && (
                <div className="card empty">No queries yet. Submit your first question.</div>
              )}

              {myQueries.map((q) => (
                <div className={"card query-card " + q.priority.toLowerCase()} key={q.id}>
                  <div className="badges">
                    <span className="badge">{q.course}</span>
                    <span className="badge">{q.category}</span>
                    <span className={"badge " + q.status.toLowerCase()}>{q.status}</span>
                    {q.private && <span className="badge">🔒 Private</span>}
                    {q.sessionId && <span className="badge group">👥 Group session</span>}
                  </div>
                  <p><b>{q.question}</b></p>
                  <p className="muted">
                    Assigned to {q.assignedTo}
                    {q.alsoCount > 0 && " · 🙋 " + q.alsoCount + " classmate" + (q.alsoCount > 1 ? "s have" : " has") + " this doubt too"}
                  </p>

                  {q.answer && <div className="answer-box"><b>Answer:</b> {q.answer}</div>}
                  {q.appointment && (
                    <div className="slot-box">
                      🗓 <b>Scheduled:</b> {new Date(q.appointment).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
