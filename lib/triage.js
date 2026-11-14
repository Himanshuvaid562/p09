// MODULE 3 - Triage: decide category, priority and which faculty gets the query

// course -> faculty (change these to real names)
export const courseFaculty = {
  CSE310: "Dr. Sharma",
  CSE326: "Prof. Singh",
  MTH174: "Dr. Kaur",
};

export function triage(course, question) {
  const text = question.toLowerCase();

  let category = "Concept Doubt";
  if (/exam|marks|result|grade|paper/.test(text)) category = "Exam / Marks";
  else if (/assignment|submission|deadline|project/.test(text)) category = "Assignment";
  else if (/attendance|leave|absent|medical/.test(text)) category = "Attendance";
  else if (/meet|appointment|office hour|discuss/.test(text)) category = "Meeting Request";

  const priority = /urgent|today|tomorrow|asap|deadline/.test(text) ? "High" : "Normal";
  const assignedTo = courseFaculty[course] || "Unassigned";

  return { category, priority, assignedTo };
}

// ---- Similar doubts: same course + at least 2 shared keywords ----
const stopWords = [
  "what", "when", "where", "which", "about", "doubt", "please", "this", "that",
  "with", "from", "have", "does", "explain", "question", "need", "help", "how",
  "the", "and", "for", "can", "not", "are", "why", "you", "your", "class", "sir",
];

function keywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((w) => w.length > 3 && !stopWords.includes(w));
}

// returns { queryId: [ids of other queries with a similar doubt] }
export function findSimilar(queries) {
  const result = {};
  for (const a of queries) {
    const wordsA = keywords(a.question);
    result[a.id] = queries
      .filter((b) => {
        if (b.id === a.id || b.course !== a.course) return false;
        const shared = keywords(b.question).filter((w) => wordsA.includes(w));
        return shared.length >= 2;
      })
      .map((b) => b.id);
  }
  return result;
}

// Personal topics (marks, attendance) are never shown to other students
export function isPersonal(category) {
  return category === "Attendance" || category === "Exam / Marks";
}

// Doubts already on the class board that look like the text a student is typing
export function similarDoubts(text, course, board) {
  const typed = keywords(text);
  if (typed.length === 0) return [];
  const need = Math.min(2, typed.length); // short questions need only 1 shared keyword

  return board
    .filter((b) => b.course === course && !b.mine)
    .map((b) => ({ ...b, score: keywords(b.question).filter((w) => typed.includes(w)).length }))
    .filter((b) => b.score >= need)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// number of keywords two texts share
export function sharedKeywords(a, b) {
  const wordsB = keywords(b);
  return keywords(a).filter((w) => wordsB.includes(w)).length;
}

// number of keywords in a text
export function keywordTotal(text) {
  return keywords(text).length;
}
