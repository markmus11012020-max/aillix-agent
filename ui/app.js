const $ = (id) => document.getElementById(id);
let data = null;
let currentTab = "dashboard";
let lastLint = null;

function token() {
  return localStorage.getItem("aillix-ui-token") || "";
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const t = token();
  if (t) headers["x-ui-token"] = t;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    setTab("settings");
    throw new Error("Нужен UI token. Откройте Настройки.");
  }
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Ошибка запроса");
  return json;
}

function setTab(name) {
  currentTab = name;
  document.querySelectorAll(".nav").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === name);
  });
  document.querySelectorAll(".tab").forEach((section) => {
    section.classList.toggle("active", section.id === `tab-${name}`);
  });
  if (name === "settings") $("uiToken").value = token();
}

function fmtMin(minutes) {
  const safe = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return h ? `${h} ч ${m} мин` : `${m} мин`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function empty(text) {
  return el("div", "empty", text);
}

function render() {
  if (!data) return;
  if (!data.initialized) {
    $("startPanel").style.display = "block";
    $("dashboardBody").style.display = "none";
    $("stepline").textContent = "Aillix Agent не запущен";
    $("timer").textContent = "—";
    return;
  }
  $("startPanel").style.display = "none";
  $("dashboardBody").style.display = "block";
  const { state, dashboard, board, card } = data;
  const questions = state.questions || [];
  const recommendations = state.recommendations || [];
  const decisions = state.decisions || [];
  const openQuestions = questions.filter((q) => q.status === "open");
  const proposed = recommendations.filter((r) => r.status === "proposed");

  $("stepline").textContent = `Шаг ${dashboard.stepNumber} из 11 · ${dashboard.stepTitle}`;
  $("timer").textContent = `до 20:00: ${fmtMin(dashboard.remainingMin)}`;
  $("stepTitle").textContent = `${dashboard.stepNumber}. ${dashboard.stepTitle}`;
  $("stepOwner").textContent = `Владелец: ${dashboard.owner} · ${dashboard.status}`;
  $("progressBar").style.width = `${dashboard.progress}%`;
  $("progressText").textContent = `${dashboard.progress}%`;
  $("elapsed").textContent = fmtMin(dashboard.elapsedMin);
  $("remaining").textContent = fmtMin(dashboard.remainingMin);
  $("nextStop").textContent = dashboard.nextStopLabel;
  $("warning").textContent = dashboard.warning || "";
  $("qcount").textContent = openQuestions.length;
  $("rcount").textContent = proposed.length;

  const blockers = $("blockers");
  blockers.innerHTML = "";
  if (!dashboard.blockers || dashboard.blockers.length === 0) {
    blockers.appendChild(empty("Блокеров нет."));
  } else {
    for (const blocker of dashboard.blockers) blockers.appendChild(el("div", "item", blocker));
  }

  const dashQ = $("dashQuestions");
  dashQ.innerHTML = "";
  if (openQuestions.length === 0) dashQ.appendChild(empty("Открытых вопросов нет."));
  else {
    for (const q of openQuestions.slice(0, 3)) {
      const item = el("div", "item");
      item.appendChild(el("div", "", `${q.id}: ${q.text}`));
      item.appendChild(el("div", "tiny", q.why));
      dashQ.appendChild(item);
    }
  }

  const dashR = $("dashRecommendations");
  dashR.innerHTML = "";
  if (proposed.length === 0) dashR.appendChild(empty("Нет рекомендаций, ждущих решения."));
  else {
    for (const r of proposed.slice(0, 3)) {
      const item = el("div", "item");
      item.appendChild(el("div", "", `${r.id}: ${r.text}`));
      item.appendChild(el("div", "tiny", `Уверенность: ${r.confidence}`));
      dashR.appendChild(item);
    }
  }

  $("taskText").textContent = state.task || "—";
  $("intakeArtifact").textContent = state.artifacts.intake || "—";
  $("optionsArtifact").textContent = state.artifacts.options || "—";
  $("compareArtifact").textContent = state.artifacts.compare || "—";

  if (document.activeElement !== $("cardText")) {
    $("cardText").value = card || "";
  }

  const ql = $("questionsList");
  ql.innerHTML = "";
  if (questions.length === 0) ql.appendChild(empty("Вопросов нет."));
  else {
    for (const q of questions.slice().reverse()) {
      const item = el("div", "item");
      item.appendChild(el("div", "", `${q.id} · шаг ${q.step} · ${q.status}`));
      item.appendChild(el("div", "", q.text));
      item.appendChild(el("div", "tiny", `Почему: ${q.why}`));
      if (q.blocking) item.appendChild(el("div", "tiny", "Блокирует шаг"));
      if (q.status === "open") {
        const inline = el("div", "inline");
        const input = el("input");
        input.placeholder = "Ответ";
        const button = el("button", "primary", "Ответить");
        button.onclick = async () => {
          try {
            await api("/api/answer", { method: "POST", body: JSON.stringify({ id: q.id, answer: input.value }) });
            await load();
          } catch (e) { alert(e.message); }
        };
        inline.append(input, button);
        item.appendChild(inline);
      } else if (q.answer) {
        item.appendChild(el("div", "tiny", `Ответ: ${q.answer}`));
      }
      ql.appendChild(item);
    }
  }

  const rl = $("recommendationsList");
  rl.innerHTML = "";
  if (recommendations.length === 0) rl.appendChild(empty("Рекомендаций нет."));
  else {
    for (const r of recommendations.slice().reverse()) {
      const item = el("div", "item");
      item.appendChild(el("div", "", `${r.id} · ${r.status}`));
      item.appendChild(el("div", "", r.text));
      item.appendChild(el("div", "tiny", `Почему: ${r.rationale}`));
      item.appendChild(el("div", "tiny", `Уверенность: ${r.confidence}. Что изменит: ${r.changeCondition}`));
      if (r.status === "proposed") {
        const inline = el("div", "inline");
        for (const action of ["accepted", "rejected", "deferred"]) {
          const label = action === "accepted" ? "Принять" : action === "rejected" ? "Отклонить" : "Отложить";
          const button = el("button", action === "accepted" ? "primary" : "", label);
          button.onclick = async () => {
            const decision = prompt("Комментарий к решению:", label) || label;
            try {
              await api("/api/recommendation", {
                method: "POST",
                body: JSON.stringify({ id: r.id, action, decision }),
              });
              await load();
            } catch (e) { alert(e.message); }
          };
          inline.appendChild(button);
        }
        item.appendChild(inline);
      }
      rl.appendChild(item);
    }
  }

  const dl = $("decisionsList");
  dl.innerHTML = "";
  if (decisions.length === 0) dl.appendChild(empty("Решений пока нет."));
  else {
    for (const d of decisions.slice().reverse()) {
      const item = el("div", "item");
      item.appendChild(el("div", "", `${d.id} · ${d.step} · ${d.who}`));
      item.appendChild(el("div", "", d.text));
      item.appendChild(el("div", "tiny", `Причина: ${d.reason}`));
      dl.appendChild(item);
    }
  }

  $("boardInfo").innerHTML = "";
  $("boardInfo").appendChild(el("div", "item", `Доска: ${board.kind}`));
  $("boardInfo").appendChild(el("div", "item", board.health?.message || "—"));
  $("boardInfo").appendChild(el("div", "item", `Карточек в state: ${Object.keys(state.board.cards || {}).length}`));

  if (lastLint) $("lintReport").textContent = JSON.stringify(lastLint, null, 2);
}

async function load() {
  try {
    data = await api("/api/state");
    render();
  } catch (e) {
    $("stepline").textContent = e.message;
  }
}

$("refresh").onclick = load;
$("nextStep").onclick = async () => {
  try {
    const result = await api("/api/next", { method: "POST" });
    if (result.message) alert(result.message);
    await load();
  } catch (e) { alert(e.message); }
};
$("assembleCard").onclick = async () => {
  try {
    const result = await api("/api/card/assemble", { method: "POST" });
    if (result.message) alert(result.message);
    await load();
  } catch (e) { alert(e.message); }
};
$("checkCard").onclick = async () => {
  try {
    lastLint = await api("/api/check", { method: "POST" });
    $("lintReport").textContent = JSON.stringify(lastLint, null, 2);
  } catch (e) { alert(e.message); }
};
$("copyCard").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("cardText").value);
    alert("Карточка скопирована.");
  } catch {
    alert("Не удалось скопировать. Выделите текст вручную.");
  }
};
$("syncBoard").onclick = async () => {
  try {
    const result = await api("/api/sync", { method: "POST" });
    alert(`Синхронизация: ${result.message}`);
    await load();
  } catch (e) { alert(e.message); }
};
$("saveDecision").onclick = async () => {
  try {
    await api("/api/decision", {
      method: "POST",
      body: JSON.stringify({ text: $("decisionText").value, reason: $("decisionReason").value }),
    });
    $("decisionText").value = "";
    $("decisionReason").value = "";
    await load();
  } catch (e) { alert(e.message); }
};
$("saveToken").onclick = () => {
  localStorage.setItem("aillix-ui-token", $("uiToken").value.trim());
  load();
};
$("startAgent").onclick = async () => {
  const task = $("startTask").value.trim();
  if (!task) {
    alert("Вставьте текст задания.");
    return;
  }
  try {
    await api("/api/init", { method: "POST", body: JSON.stringify({ task }) });
    await load();
  } catch (e) { alert(e.message); }
};

document.querySelectorAll(".nav").forEach((button) => {
  button.onclick = () => setTab(button.dataset.tab);
});

load();
setInterval(load, 5000);
