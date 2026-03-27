const STORAGE_KEY = "black-bracket-studio-v1";

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

function getRoundLabel(roundIndex, totalRounds, matchCount) {
  if (roundIndex === totalRounds - 1) return "결승";
  if (roundIndex === totalRounds - 2) return "준결승";
  return `${matchCount * 2}강`;
}

function createSlots(participants, bracketSize) {
  const seedOrder = getSeedOrder(bracketSize);
  const slots = new Array(bracketSize).fill(null);

  seedOrder.forEach((seedNumber, slotIndex) => {
    slots[slotIndex] = participants[seedNumber - 1] || null;
  });

  return slots;
}

function createRounds(participants) {
  const bracketSize = nextPowerOfTwo(participants.length);
  const totalRounds = Math.log2(bracketSize);
  const seededSlots = createSlots(participants, bracketSize);
  const rounds = [];
  let currentRoundPlayers = seededSlots;

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const matchCount = currentRoundPlayers.length / 2;
    const label = getRoundLabel(roundIndex, totalRounds, matchCount);
    const matches = [];
    const nextRoundPlayers = [];

    for (let matchIndex = 0; matchIndex < currentRoundPlayers.length; matchIndex += 2) {
      const player1 = currentRoundPlayers[matchIndex];
      const player2 = currentRoundPlayers[matchIndex + 1];

      let autoWinner = null;
      let note = "";

      if (player1 && !player2) {
        autoWinner = {
          name: player1.name,
          seed: player1.seed,
          placeholder: false,
          autoAdvanced: true,
        };
        note = `${player1.name} 자동 진출`;
      } else if (!player1 && player2) {
        autoWinner = {
          name: player2.name,
          seed: player2.seed,
          placeholder: false,
          autoAdvanced: true,
        };
        note = `${player2.name} 자동 진출`;
      }

      const nextPlayer =
        autoWinner ||
        ({
          name: `${label} ${Math.floor(matchIndex / 2) + 1}경기 승자`,
          placeholder: true,
        });

      nextRoundPlayers.push(nextPlayer);
      matches.push({
        id: `${roundIndex + 1}-${Math.floor(matchIndex / 2) + 1}`,
        player1,
        player2,
        note,
        isBye: Boolean(autoWinner),
        winner: autoWinner,
      });
    }

    rounds.push({
      label,
      subtitle: `${matchCount}경기`,
      matches,
    });

    currentRoundPlayers = nextRoundPlayers;
  }

  return {
    rounds,
    bracketSize,
    roundCount: totalRounds,
    byeCount: bracketSize - participants.length,
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

  const created = createRounds(participants);

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    eventTitle,
    divisionName,
    grade,
    gender,
    shuffle,
    participantCount: participants.length,
    participants,
    bracketSize: created.bracketSize,
    roundCount: created.roundCount,
    byeCount: created.byeCount,
    rounds: created.rounds,
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
      <h3>아직 생성된 대진표가 없습니다.</h3>
      <p>왼쪽에서 학년, 성별, 참가자 명단을 입력하면 자동으로 토너먼트 브래킷이 만들어집니다.</p>
    </div>
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
    { label: "대진 규모", value: `${bracket.bracketSize}강` },
    { label: "부전승", value: `${bracket.byeCount}명` },
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

  const roundsMarkup = bracket.rounds
    .map(
      (round) => `
        <section class="round-column">
          <header class="round-header">
            <h4>${escapeHtml(round.label)}</h4>
            <span class="round-subtitle">${escapeHtml(round.subtitle)}</span>
          </header>
          ${round.matches
            .map((match) => {
              const cardClass = match.isBye ? "match-card is-bye" : "match-card is-pending";
              return `
                <article class="${cardClass}">
                  <div class="match-index">Match ${escapeHtml(match.id)}</div>
                  ${renderPlayerSlot(match.player1, match.winner)}
                  ${renderPlayerSlot(match.player2, match.winner)}
                  ${match.note ? `<div class="match-note">${escapeHtml(match.note)}</div>` : ""}
                </article>
              `;
            })
            .join("")}
        </section>
      `
    )
    .join("");

  bracketStage.innerHTML = `
    <article class="bracket-shell">
      <header class="bracket-header">
        <div class="bracket-title-group">
          <p>${escapeHtml(formatDate(bracket.createdAt))} 생성</p>
          <h3>${escapeHtml(bracket.divisionName)}</h3>
          <p>${escapeHtml(bracket.eventTitle)}</p>
        </div>
        <div class="bracket-actions">
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

      <section class="participant-list">
        <div class="participant-list-header">
          <h4>참가자 시드 목록</h4>
          <span>${bracket.shuffle ? "무작위 배치 사용" : "입력 순서 유지"}</span>
        </div>
        <div class="participant-tags">${participantTags}</div>
      </section>

      <section class="bracket-board">
        ${roundsMarkup}
      </section>
    </article>
  `;
}

function renderPlayerSlot(player, winner) {
  if (!player) {
    return `
      <div class="player-slot placeholder">
        <span class="player-name">BYE</span>
        <span class="player-meta">부전승 자리</span>
      </div>
    `;
  }

  const isPlaceholder = Boolean(player.placeholder);
  const isWinner = Boolean(winner && !player.placeholder && winner.name === player.name);

  return `
    <div class="player-slot ${isPlaceholder ? "placeholder" : ""} ${isWinner ? "winner" : ""}">
      <span class="player-name">${escapeHtml(player.name)}</span>
      <span class="player-meta">
        ${isPlaceholder ? "자동 연결 예정" : `Seed ${escapeHtml(player.seed ?? "-")}`}
      </span>
    </div>
  `;
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
  summaryByes.textContent = `${byeCount}명`;
}

function renderAll() {
  renderDivisionList();
  renderBracket();
  updateSummary();
}

function resetFormFields() {
  form.reset();
  gradeInput.value = "초4";
  genderInput.value = "남자";
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
  const hasBrackets = state.brackets.length > 0;

  if (!hasBrackets) return;

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
