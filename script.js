const STORAGE_KEY = "black-bracket-studio-v1";
const JPG_EXPORT_CLASS = "jpg-export-surface";

const form = document.querySelector("#tournament-form");
const eventNameInput = document.querySelector("#event-name");
const gradeInput = document.querySelector("#grade");
const genderInput = document.querySelector("#gender");
const participantsInput = document.querySelector("#participants");
const shuffleInput = document.querySelector("#shuffle");
const sampleButton = document.querySelector("#sample-button");
const clearButton = document.querySelector("#clear-button");
const printButton = document.querySelector("#print-button");
const divisionList = document.querySelector("#division-list");
const bracketStage = document.querySelector("#bracket-stage");
const divisionPreview = document.querySelector("#division-preview");
const summaryCount = document.querySelector("#summary-count");
const summaryRounds = document.querySelector("#summary-rounds");
const summaryBracket = document.querySelector("#summary-bracket");
const summaryByes = document.querySelector("#summary-byes");

const state = {
  brackets: loadStoredBrackets(),
  selectedId: null,
};

if (state.brackets.length > 0) {
  state.selectedId = state.brackets[0].id;
}

function loadStoredBrackets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("저장된 대진표를 불러오지 못했습니다.", error);
    return [];
  }
}

function saveBrackets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.brackets));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getParticipantNames(rawText) {
  return rawText
    .split(/\r?\n|,/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function nextPowerOfTwo(value) {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

function getSeedOrder(size) {
  if (size === 1) return [1];

  const previous = getSeedOrder(size / 2);
  const result = [];

  previous.forEach((seed) => {
    result.push(seed);
    result.push(size + 1 - seed);
  });

  return result;
}

function shuffleArray(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function createSlots(participants, bracketSize) {
  const seedOrder = getSeedOrder(bracketSize);
  const slots = new Array(bracketSize).fill(null);

  seedOrder.forEach((seedNumber, slotIndex) => {
    slots[slotIndex] = participants[seedNumber - 1] || null;
  });

  return slots;
}

function getRoundLabel(roundIndex, totalRounds, matchCount) {
  if (roundIndex === totalRounds - 1) return "결승";
  if (roundIndex === totalRounds - 2) return "준결승";
  return `${matchCount * 2}강`;
}

function createTournamentRounds(participants) {
  const bracketSize = nextPowerOfTwo(participants.length);
  const totalRounds = Math.log2(bracketSize);
  const slots = createSlots(participants, bracketSize);
  const rounds = [];
  let currentPlayers = slots;
  let byeCount = 0;

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const matchCount = currentPlayers.length / 2;
    const label = getRoundLabel(roundIndex, totalRounds, matchCount);
    const matches = [];
    const nextPlayers = [];

    for (let matchIndex = 0; matchIndex < currentPlayers.length; matchIndex += 2) {
      const player1 = currentPlayers[matchIndex];
      const player2 = currentPlayers[matchIndex + 1];
      const isBye = Boolean((player1 && !player2) || (!player1 && player2));
      const autoWinner = isBye ? player1 || player2 : null;

      if (roundIndex === 0 && isBye) {
        byeCount += 1;
      }

      nextPlayers.push(
        autoWinner || {
          name: `${label} ${Math.floor(matchIndex / 2) + 1}경기 승자`,
          placeholder: true,
        }
      );

      matches.push({
        id: `${roundIndex + 1}-${Math.floor(matchIndex / 2) + 1}`,
        player1,
        player2,
        isBye,
        winner: autoWinner,
        note: isBye && autoWinner ? `${autoWinner.name} 부전승` : "",
      });
    }

    rounds.push({
      label,
      subtitle: `${matchCount}경기`,
      matches,
    });

    currentPlayers = nextPlayers;
  }

  return {
    bracketSize,
    totalRounds,
    byeCount,
    rounds,
    firstRoundMatchCount: rounds[0]?.matches.length || 0,
  };
}

function buildBracket({ eventName, grade, gender, rawParticipants, shuffle }) {
  const divisionName = `${grade} ${gender}부`;
  const eventTitle = eventName || "교내 토너먼트";
  const orderedNames = shuffle ? shuffleArray(rawParticipants) : rawParticipants;

  const participants = orderedNames.map((name, index) => ({
    name,
    seed: index + 1,
  }));

  const tournament = createTournamentRounds(participants);

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    eventTitle,
    divisionName,
    grade,
    gender,
    shuffle,
    participantCount: participants.length,
    participants,
    bracketSize: tournament.bracketSize,
    byeCount: tournament.byeCount,
    totalRounds: tournament.totalRounds,
    firstRoundMatchCount: tournament.firstRoundMatchCount,
    rounds: tournament.rounds,
    createdAt: new Date().toISOString(),
  };
}

function getSelectedBracket() {
  return state.brackets.find((bracket) => bracket.id === state.selectedId) || null;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderDivisionList() {
  if (state.brackets.length === 0) {
    divisionList.innerHTML = "";
    return;
  }

  divisionList.innerHTML = state.brackets
    .map((bracket) => {
      const isActive = bracket.id === state.selectedId;

      return `
        <button class="division-chip ${isActive ? "is-active" : ""}" type="button" data-select-id="${bracket.id}">
          <span>
            <strong>${escapeHtml(bracket.divisionName)}</strong>
            <small>${escapeHtml(bracket.eventTitle)} · ${bracket.participantCount}명</small>
          </span>
          <span class="chip-delete" data-delete-id="${bracket.id}" aria-label="대진표 삭제">삭제</span>
        </button>
      `;
    })
    .join("");
}

function renderEmptyState() {
  bracketStage.innerHTML = `
    <div class="empty-state">
      <p class="empty-kicker">Ready</p>
      <h3>아직 생성된 토너먼트 대진표가 없습니다.</h3>
      <p>왼쪽에서 학년, 성별, 참가자 명단을 입력하면 참가자 수에 맞는 토너먼트형 대진표가 자동으로 만들어집니다.</p>
    </div>
  `;
}

function createLine(x1, y1, x2, y2) {
  return { x1, y1, x2, y2 };
}

function offsetLines(lines, offsetX, offsetY) {
  return lines.map((line) => ({
    x1: line.x1 + offsetX,
    y1: line.y1 + offsetY,
    x2: line.x2 + offsetX,
    y2: line.y2 + offsetY,
  }));
}

function createBracketLayout(rounds) {
  const cardWidth = 186;
  const cardHeight = 88;
  const columnGap = 96;
  const rowGap = 24;
  const topPadding = 78;
  const sidePadding = 26;

  const columns = [];
  const lines = [];
  let previousCenters = [];

  rounds.forEach((round, roundIndex) => {
    const x = sidePadding + roundIndex * (cardWidth + columnGap);
    const nodes = round.matches.map((match, matchIndex) => {
      const centerY =
        roundIndex === 0
          ? topPadding + cardHeight / 2 + matchIndex * (cardHeight + rowGap)
          : (previousCenters[matchIndex * 2] + previousCenters[matchIndex * 2 + 1]) / 2;

      return {
        x,
        y: centerY - cardHeight / 2,
        centerY,
        match,
      };
    });

    columns.push({
      label: round.label,
      subtitle: round.subtitle,
      x,
      nodes,
    });

    previousCenters = nodes.map((node) => node.centerY);
  });

  for (let roundIndex = 0; roundIndex < columns.length - 1; roundIndex += 1) {
    const currentNodes = columns[roundIndex].nodes;
    const nextNodes = columns[roundIndex + 1].nodes;

    nextNodes.forEach((nextNode, nextIndex) => {
      const firstChild = currentNodes[nextIndex * 2];
      const secondChild = currentNodes[nextIndex * 2 + 1];
      const mergeX = firstChild.x + cardWidth + columnGap / 2;

      lines.push(createLine(firstChild.x + cardWidth, firstChild.centerY, mergeX, firstChild.centerY));
      lines.push(createLine(secondChild.x + cardWidth, secondChild.centerY, mergeX, secondChild.centerY));
      lines.push(createLine(mergeX, firstChild.centerY, mergeX, secondChild.centerY));
      lines.push(createLine(mergeX, nextNode.centerY, nextNode.x, nextNode.centerY));
    });
  }

  const lastColumn = columns.at(-1);
  const width = lastColumn ? lastColumn.x + cardWidth + sidePadding : 0;
  const height = Math.max(...columns.flatMap((column) => column.nodes.map((node) => node.y + cardHeight)), 320) + 32;

  return {
    width,
    height,
    columns,
    lines,
  };
}

function renderTournamentPlayer(player, winner) {
  if (!player) {
    return `
      <div class="tree-player-slot placeholder">
        <span class="tree-player-name">BYE</span>
        <span class="tree-player-meta">부전승 자리</span>
      </div>
    `;
  }

  const isPlaceholder = Boolean(player.placeholder);
  const isWinner = Boolean(winner && !player.placeholder && winner.name === player.name);

  return `
    <div class="tree-player-slot ${isPlaceholder ? "placeholder" : ""} ${isWinner ? "winner" : ""}">
      <span class="tree-player-name">${escapeHtml(player.name)}</span>
      <span class="tree-player-meta">${isPlaceholder ? "승자 대기" : `Seed ${escapeHtml(player.seed ?? "-")}`}</span>
    </div>
  `;
}

function renderTreeNode(node) {
  return `
    <article class="tree-match-card ${node.match.isBye ? "is-bye" : ""}" style="left:${node.x}px; top:${node.y}px;">
      <div class="tree-match-head">
        <span class="tree-match-index">Match ${escapeHtml(node.match.id)}</span>
        <span class="tree-match-state">${node.match.isBye ? "부전승" : "대진"}</span>
      </div>
      ${renderTournamentPlayer(node.match.player1, node.match.winner)}
      ${renderTournamentPlayer(node.match.player2, node.match.winner)}
      <p class="tree-match-note">${node.match.note ? escapeHtml(node.match.note) : "승자 다음 라운드 진출"}</p>
    </article>
  `;
}

function renderTreeLabels(columns) {
  return columns
    .map(
      (column) => `
        <div class="tree-round-pill" style="left:${column.x + 93}px;">
          <strong>${escapeHtml(column.label)}</strong>
          <span>${escapeHtml(column.subtitle)}</span>
        </div>
      `
    )
    .join("");
}

function renderTreeLines(lines) {
  return lines
    .map(
      (line) =>
        `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="rgba(240, 230, 208, 0.88)" stroke-width="3" stroke-linecap="round" />`
    )
    .join("");
}

function renderTournamentBoard(bracket) {
  const layout = createBracketLayout(bracket.rounds);
  const labelsMarkup = renderTreeLabels(layout.columns);
  const nodesMarkup = layout.columns.flatMap((column) => column.nodes.map((node) => renderTreeNode(node))).join("");
  const linesMarkup = renderTreeLines(layout.lines);
  const championX = layout.columns.at(-1)?.x + 93 || 0;
  const championY = layout.height / 2;

  return `
    <section class="tournament-board-shell">
      <div class="bracket-visual-head">
        <div>
          <p class="panel-kicker">Tournament View</p>
          <h4>토너먼트 대진표</h4>
        </div>
        <p>${escapeHtml(
          bracket.byeCount > 0
            ? `${bracket.participantCount}명 기준 ${bracket.bracketSize}강 대진으로 편성되며, 부전승 ${bracket.byeCount}개가 자동 배정됩니다.`
            : `${bracket.participantCount}명 기준 ${bracket.bracketSize}강 토너먼트로 바로 진행됩니다.`
        )}</p>
      </div>

      <div class="tournament-board-viewport">
        <div class="tournament-tree" style="width:${layout.width}px; height:${layout.height}px;">
          ${labelsMarkup}
          <div class="tree-champion-mark" style="left:${championX}px; top:${championY - 84}px;">
            <span>🏆</span>
            <strong>Champion</strong>
          </div>
          <svg class="tree-connector-layer" viewBox="0 0 ${layout.width} ${layout.height}" preserveAspectRatio="none" aria-hidden="true">
            ${linesMarkup}
          </svg>
          ${nodesMarkup}
        </div>
      </div>
    </section>
  `;
}

function renderBracket() {
  const bracket = getSelectedBracket();

  if (!bracket) {
    renderEmptyState();
    return;
  }

  const metaCards = [
    { label: "대회명", value: bracket.eventTitle },
    { label: "참가자", value: `${bracket.participantCount}명` },
    { label: "라운드", value: `${bracket.totalRounds}라운드` },
    { label: "부전승", value: `${bracket.byeCount}개` },
  ];

  const participantTags = bracket.participants
    .map(
      (participant) => `
        <div class="participant-tag">
          <span class="seed-tag">Seed ${participant.seed}</span>
          <strong>${escapeHtml(participant.name)}</strong>
        </div>
      `
    )
    .join("");

  bracketStage.innerHTML = `
    <article class="bracket-shell">
      <section class="${JPG_EXPORT_CLASS}">
        <header class="bracket-header">
          <div class="bracket-title-group">
            <p>${escapeHtml(formatDate(bracket.createdAt))} 생성</p>
            <h3>${escapeHtml(bracket.divisionName)}</h3>
            <p>${escapeHtml(bracket.eventTitle)}</p>
          </div>
          <div class="bracket-actions">
            <button type="button" class="bracket-action-button" data-download-jpg="${bracket.id}">JPG 저장</button>
            <button type="button" class="bracket-action-button" data-duplicate-id="${bracket.id}">복제</button>
            <button type="button" class="bracket-action-button" data-delete-id="${bracket.id}">삭제</button>
          </div>
        </header>

        <section class="bracket-meta">
          ${metaCards
            .map(
              (card) => `
                <article class="bracket-meta-card">
                  <span>${escapeHtml(card.label)}</span>
                  <strong>${escapeHtml(card.value)}</strong>
                </article>
              `
            )
            .join("")}
        </section>

        ${renderTournamentBoard(bracket)}
      </section>

      <section class="participant-list">
        <div class="participant-list-header">
          <h4>참가자 시드 목록</h4>
          <span>${bracket.shuffle ? "무작위 배치 사용" : "입력 순서 유지"}</span>
        </div>
        <div class="participant-tags">${participantTags}</div>
      </section>
    </article>
  `;
}

function slugifyFileName(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function buildExportFileName(bracket) {
  const baseName = [bracket.eventTitle, bracket.divisionName, "tournament-bracket"]
    .map((item) => slugifyFileName(item))
    .filter(Boolean)
    .join("-");

  return `${baseName || "tournament-bracket"}.jpg`;
}

function createExportSurface(bracket) {
  const board = bracketStage.querySelector(".tournament-board-shell");
  if (!board) return null;

  const metaMarkup = [
    { label: "대회명", value: bracket.eventTitle },
    { label: "부문", value: bracket.divisionName },
    { label: "참가자", value: `${bracket.participantCount}명` },
    { label: "부전승", value: `${bracket.byeCount}개` },
  ]
    .map(
      (item) => `
        <article class="jpg-export-meta-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </article>
      `
    )
    .join("");

  const exportSurface = document.createElement("section");
  exportSurface.className = "jpg-export-sheet";
  exportSurface.innerHTML = `
    <div class="jpg-export-header">
      <p>BLACK BRACKET STUDIO</p>
      <h2>${escapeHtml(bracket.divisionName)}</h2>
      <strong>${escapeHtml(bracket.eventTitle)} 토너먼트 대진표</strong>
    </div>
    <div class="jpg-export-meta">${metaMarkup}</div>
    <div class="jpg-export-board-wrap"></div>
  `;

  exportSurface.querySelector(".jpg-export-board-wrap").append(board.cloneNode(true));
  return exportSurface;
}

async function downloadBracketAsJpg(bracketId, triggerButton) {
  const bracket = state.brackets.find((item) => item.id === bracketId);
  if (!bracket) return;

  if (typeof window.html2canvas !== "function") {
    alert("이미지 저장 기능을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }

  const exportSurface = createExportSurface(bracket);
  if (!exportSurface) {
    alert("내보낼 대진표를 찾지 못했습니다.");
    return;
  }

  const originalLabel = triggerButton?.textContent ?? "";

  if (triggerButton) {
    triggerButton.disabled = true;
    triggerButton.textContent = "JPG 생성 중...";
  }

  exportSurface.style.position = "fixed";
  exportSurface.style.left = "-100000px";
  exportSurface.style.top = "0";
  exportSurface.style.zIndex = "-1";
  document.body.append(exportSurface);

  try {
    const canvas = await window.html2canvas(exportSurface, {
      backgroundColor: "#05070b",
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.download = buildExportFileName(bracket);
    link.click();
  } catch (error) {
    console.error("JPG 저장 중 오류가 발생했습니다.", error);
    alert("JPG 저장 중 오류가 발생했습니다. 다시 시도해 주세요.");
  } finally {
    exportSurface.remove();

    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.textContent = originalLabel;
    }
  }
}

function updateSummary() {
  const participantNames = getParticipantNames(participantsInput.value);
  const previewName = `${gradeInput.value} ${genderInput.value}부`;
  const bracketSize = participantNames.length >= 2 ? nextPowerOfTwo(participantNames.length) : 0;
  const roundCount = bracketSize ? Math.log2(bracketSize) : 0;
  const byeCount = bracketSize ? bracketSize - participantNames.length : 0;

  divisionPreview.textContent = previewName;
  summaryCount.textContent = `${participantNames.length}명`;
  summaryRounds.textContent = `${roundCount}라운드`;
  summaryBracket.textContent = bracketSize ? `${bracketSize}강` : "0강";
  summaryByes.textContent = `${byeCount}개`;
}

function renderAll() {
  renderDivisionList();
  renderBracket();
  updateSummary();
}

function fillSampleData() {
  eventNameInput.value = "2026 교내 스포츠 리그";
  gradeInput.value = "초4";
  genderInput.value = "남자";
  participantsInput.value = [
    "김민준",
    "이서준",
    "박지호",
    "최도윤",
    "정우성",
    "한지후",
    "유건우",
    "오현준",
    "서민재",
    "강지환",
  ].join("\n");
  shuffleInput.checked = true;
  updateSummary();
}

function deleteBracket(bracketId) {
  state.brackets = state.brackets.filter((bracket) => bracket.id !== bracketId);

  if (state.selectedId === bracketId) {
    state.selectedId = state.brackets[0]?.id || null;
  }

  saveBrackets();
  renderAll();
}

function duplicateBracket(bracketId) {
  const source = state.brackets.find((bracket) => bracket.id === bracketId);
  if (!source) return;

  const clone = {
    ...source,
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    eventTitle: `${source.eventTitle} 복사본`,
    createdAt: new Date().toISOString(),
  };

  state.brackets.unshift(clone);
  state.selectedId = clone.id;
  saveBrackets();
  renderAll();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const participantNames = getParticipantNames(participantsInput.value);

  if (participantNames.length < 2) {
    alert("참가자는 최소 2명 이상 입력해 주세요.");
    participantsInput.focus();
    return;
  }

  const bracket = buildBracket({
    eventName: eventNameInput.value.trim(),
    grade: gradeInput.value,
    gender: genderInput.value,
    rawParticipants: participantNames,
    shuffle: shuffleInput.checked,
  });

  state.brackets.unshift(bracket);
  state.selectedId = bracket.id;
  saveBrackets();
  renderAll();
});

form.addEventListener("reset", () => {
  window.setTimeout(() => {
    gradeInput.value = "초4";
    genderInput.value = "남자";
    updateSummary();
  }, 0);
});

[gradeInput, genderInput, participantsInput].forEach((element) => {
  element.addEventListener("input", updateSummary);
  element.addEventListener("change", updateSummary);
});

sampleButton.addEventListener("click", fillSampleData);

clearButton.addEventListener("click", () => {
  if (state.brackets.length === 0) return;

  const shouldDelete = window.confirm("저장된 모든 대진표를 삭제할까요?");
  if (!shouldDelete) return;

  state.brackets = [];
  state.selectedId = null;
  saveBrackets();
  renderAll();
});

printButton.addEventListener("click", () => {
  if (!getSelectedBracket()) {
    alert("인쇄할 대진표를 먼저 생성해 주세요.");
    return;
  }

  window.print();
});

divisionList.addEventListener("click", (event) => {
  const deleteTarget = event.target.closest("[data-delete-id]");
  if (deleteTarget) {
    event.stopPropagation();
    deleteBracket(deleteTarget.dataset.deleteId);
    return;
  }

  const selectTarget = event.target.closest("[data-select-id]");
  if (!selectTarget) return;

  state.selectedId = selectTarget.dataset.selectId;
  renderAll();
});

bracketStage.addEventListener("click", (event) => {
  const jpgTarget = event.target.closest("[data-download-jpg]");
  if (jpgTarget) {
    downloadBracketAsJpg(jpgTarget.dataset.downloadJpg, jpgTarget);
    return;
  }

  const deleteTarget = event.target.closest("[data-delete-id]");
  if (deleteTarget) {
    deleteBracket(deleteTarget.dataset.deleteId);
    return;
  }

  const duplicateTarget = event.target.closest("[data-duplicate-id]");
  if (duplicateTarget) {
    duplicateBracket(duplicateTarget.dataset.duplicateId);
  }
});

renderAll();
