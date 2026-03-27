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
const JPG_EXPORT_CLASS = "jpg-export-surface";

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

function previousPowerOfTwo(value) {
  let size = 1;
  while (size * 2 <= value) size *= 2;
  return size;
}

function getMainBracketLabel(participantCount) {
  if (participantCount <= 1) return "대기";

  const isPowerOfTwo = participantCount === nextPowerOfTwo(participantCount);
  if (isPowerOfTwo) return `${participantCount}강`;

  return `${previousPowerOfTwo(participantCount)}강 본선`;
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
  const hasPreliminaryRound = participants.length !== bracketSize;
  let currentRoundPlayers = seededSlots;
  let currentRoundIndex = 0;

  if (hasPreliminaryRound) {
    const matchCount = currentRoundPlayers.length / 2;
    const matches = [];
    const nextRoundPlayers = [];
    let actualMatchCount = 0;

    for (let matchIndex = 0; matchIndex < currentRoundPlayers.length; matchIndex += 2) {
      const player1 = currentRoundPlayers[matchIndex];
      const player2 = currentRoundPlayers[matchIndex + 1];

      let autoWinner = null;
      let note = "";
      let hidden = false;

      if (player1 && !player2) {
        autoWinner = {
          name: player1.name,
          seed: player1.seed,
          placeholder: false,
          autoAdvanced: true,
        };
        note = `${player1.name} 자동 진출`;
        hidden = true;
      } else if (!player1 && player2) {
        autoWinner = {
          name: player2.name,
          seed: player2.seed,
          placeholder: false,
          autoAdvanced: true,
        };
        note = `${player2.name} 자동 진출`;
        hidden = true;
      } else {
        actualMatchCount += 1;
      }

      nextRoundPlayers.push(
        autoWinner || {
          name: `예선 ${Math.floor(matchIndex / 2) + 1}경기 승자`,
          placeholder: true,
        }
      );

      matches.push({
        id: `${currentRoundIndex + 1}-${Math.floor(matchIndex / 2) + 1}`,
        player1,
        player2,
        note,
        isBye: Boolean(autoWinner),
        winner: autoWinner,
        hidden,
      });
    }

    rounds.push({
      label: "예선",
      subtitle: `실경기 ${actualMatchCount}경기`,
      matches,
    });

    currentRoundPlayers = nextRoundPlayers;
    currentRoundIndex += 1;
  }

  const remainingRounds = Math.log2(currentRoundPlayers.length);

  for (let roundIndex = 0; roundIndex < remainingRounds; roundIndex += 1) {
    const matchCount = currentRoundPlayers.length / 2;
    const label = getRoundLabel(roundIndex, remainingRounds, matchCount);
    const matches = [];
    const nextRoundPlayers = [];

    for (let matchIndex = 0; matchIndex < currentRoundPlayers.length; matchIndex += 2) {
      const player1 = currentRoundPlayers[matchIndex];
      const player2 = currentRoundPlayers[matchIndex + 1];

      nextRoundPlayers.push({
        name: `${label} ${Math.floor(matchIndex / 2) + 1}경기 승자`,
        placeholder: true,
      });

      matches.push({
        id: `${currentRoundIndex + 1}-${Math.floor(matchIndex / 2) + 1}`,
        player1,
        player2,
        note: "",
        isBye: false,
        winner: null,
        hidden: false,
      });
    }

    rounds.push({
      label,
      subtitle: `${matchCount}경기`,
      matches,
    });

    currentRoundPlayers = nextRoundPlayers;
    currentRoundIndex += 1;
  }

  return {
    rounds,
    bracketSize,
    roundCount: rounds.length,
    byeCount: bracketSize - participants.length,
    hasPreliminaryRound,
    preliminaryMatchCount: hasPreliminaryRound ? participants.length - previousPowerOfTwo(participants.length) : 0,
    mainBracketSize: hasPreliminaryRound ? previousPowerOfTwo(participants.length) : participants.length,
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
    hasPreliminaryRound: created.hasPreliminaryRound,
    preliminaryMatchCount: created.preliminaryMatchCount,
    mainBracketSize: created.mainBracketSize,
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
      <p>왼쪽에서 학년, 성별, 참가자 명단을 입력하면 좌우 대칭형 토너먼트 대진표가 자동으로 만들어집니다.</p>
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

function splitRoundsForSides(rounds) {
  const finalRound = rounds.at(-1);
  const nonFinalRounds = rounds.slice(0, -1);

  return {
    finalRound,
    leftRounds: nonFinalRounds.map((round) => ({
      ...round,
      matches: round.matches.slice(0, round.matches.length / 2),
    })),
    rightRounds: nonFinalRounds.map((round) => ({
      ...round,
      matches: round.matches.slice(round.matches.length / 2),
    })),
  };
}

function buildSideLayout(rounds, side) {
  const cardWidth = 212;
  const cardHeight = 92;
  const columnGap = 78;
  const rowGap = 28;

  if (rounds.length === 0) {
    return {
      width: 0,
      height: cardHeight,
      columns: [],
      lines: [],
      championNode: null,
      config: { cardWidth, cardHeight, columnGap, rowGap },
    };
  }

  const columns = [];
  const lines = [];
  let previousCenters = [];

  rounds.forEach((round, roundIndex) => {
    const x =
      side === "left"
        ? roundIndex * (cardWidth + columnGap)
        : (rounds.length - 1 - roundIndex) * (cardWidth + columnGap);

    const nodes = round.matches.map((match, matchIndex) => {
      const centerY =
        roundIndex === 0
          ? cardHeight / 2 + matchIndex * (cardHeight + rowGap)
          : (previousCenters[matchIndex * 2] + previousCenters[matchIndex * 2 + 1]) / 2;

      return {
        match,
        x,
        y: centerY - cardHeight / 2,
        centerY,
      };
    });

    columns.push({
      label: round.label,
      subtitle: round.subtitle,
      nodes,
    });

    previousCenters = nodes.map((node) => node.centerY);
  });

  for (let roundIndex = 0; roundIndex < columns.length - 1; roundIndex += 1) {
    const currentNodes = columns[roundIndex].nodes;
    const nextNodes = columns[roundIndex + 1].nodes;

    nextNodes.forEach((parentNode, parentIndex) => {
      const firstChild = currentNodes[parentIndex * 2];
      const secondChild = currentNodes[parentIndex * 2 + 1];

      if (side === "left") {
        const mergeX = firstChild.x + cardWidth + columnGap / 2;

        lines.push(createLine(firstChild.x + cardWidth, firstChild.centerY, mergeX, firstChild.centerY));
        lines.push(createLine(secondChild.x + cardWidth, secondChild.centerY, mergeX, secondChild.centerY));
        lines.push(createLine(mergeX, firstChild.centerY, mergeX, secondChild.centerY));
        lines.push(createLine(mergeX, parentNode.centerY, parentNode.x, parentNode.centerY));
      } else {
        const mergeX = firstChild.x - columnGap / 2;

        lines.push(createLine(firstChild.x, firstChild.centerY, mergeX, firstChild.centerY));
        lines.push(createLine(secondChild.x, secondChild.centerY, mergeX, secondChild.centerY));
        lines.push(createLine(mergeX, firstChild.centerY, mergeX, secondChild.centerY));
        lines.push(createLine(mergeX, parentNode.centerY, parentNode.x + cardWidth, parentNode.centerY));
      }
    });
  }

  const lastNode = columns[0].nodes.at(-1);
  const height = lastNode ? lastNode.y + cardHeight : cardHeight;
  const width = (columns.length - 1) * (cardWidth + columnGap) + cardWidth;

  return {
    width,
    height,
    columns,
    lines,
    championNode: columns.at(-1)?.nodes[0] || null,
    config: { cardWidth, cardHeight, columnGap, rowGap },
  };
}

function createSymmetricBracketLayout(bracket) {
  const { leftRounds, rightRounds, finalRound } = splitRoundsForSides(bracket.rounds);
  const leftLayout = buildSideLayout(leftRounds, "left");
  const rightLayout = buildSideLayout(rightRounds, "right");

  const cardWidth = leftLayout.config.cardWidth;
  const cardHeight = leftLayout.config.cardHeight;
  const finalWidth = 244;
  const finalHeight = 132;
  const sideGap = 118;
  const horizontalPadding = 26;
  const topPadding = 82;
  const bottomPadding = 34;
  const contentHeight = Math.max(leftLayout.height, rightLayout.height, finalHeight);
  const totalHeight = contentHeight + topPadding + bottomPadding;
  const leftOffsetX = horizontalPadding;
  const leftOffsetY = topPadding + (contentHeight - leftLayout.height) / 2;

  const leftWidth = leftLayout.width;
  const hasSideRounds = leftRounds.length > 0;
  const finalX = hasSideRounds ? leftOffsetX + leftWidth + sideGap : horizontalPadding + 150;
  const finalY = topPadding + contentHeight / 2 - finalHeight / 2;
  const rightOffsetX = finalX + finalWidth + sideGap;
  const rightOffsetY = topPadding + (contentHeight - rightLayout.height) / 2;
  const totalWidth = Math.max(
    finalX + finalWidth + horizontalPadding,
    rightOffsetX + rightLayout.width + horizontalPadding
  );

  const nodes = [
    ...leftLayout.columns.flatMap((column) =>
      column.nodes.map((node) => ({
        ...node,
        side: "left",
        x: node.x + leftOffsetX,
        y: node.y + leftOffsetY,
        centerY: node.centerY + leftOffsetY,
      }))
    ),
    ...rightLayout.columns.flatMap((column) =>
      column.nodes.map((node) => ({
        ...node,
        side: "right",
        x: node.x + rightOffsetX,
        y: node.y + rightOffsetY,
        centerY: node.centerY + rightOffsetY,
      }))
    ),
  ];

  const lines = [
    ...offsetLines(leftLayout.lines, leftOffsetX, leftOffsetY),
    ...offsetLines(rightLayout.lines, rightOffsetX, rightOffsetY),
  ];

  const finalMatch = finalRound.matches[0];
  const finalTopSlotY = finalY + 48;
  const finalBottomSlotY = finalY + 92;

  if (leftLayout.championNode) {
    const leftChampionX = leftLayout.championNode.x + leftOffsetX + cardWidth;
    const leftChampionY = leftLayout.championNode.centerY + leftOffsetY;
    const mergeX = finalX - 34;

    lines.push(createLine(leftChampionX, leftChampionY, mergeX, leftChampionY));
    lines.push(createLine(mergeX, leftChampionY, mergeX, finalTopSlotY));
    lines.push(createLine(mergeX, finalTopSlotY, finalX, finalTopSlotY));
  }

  if (rightLayout.championNode) {
    const rightChampionX = rightLayout.championNode.x + rightOffsetX;
    const rightChampionY = rightLayout.championNode.centerY + rightOffsetY;
    const mergeX = finalX + finalWidth + 34;

    lines.push(createLine(rightChampionX, rightChampionY, mergeX, rightChampionY));
    lines.push(createLine(mergeX, rightChampionY, mergeX, finalBottomSlotY));
    lines.push(createLine(mergeX, finalBottomSlotY, finalX + finalWidth, finalBottomSlotY));
  }

  const labels = [
    ...leftLayout.columns.map((column, index) => ({
      text: column.label,
      subtitle: column.subtitle,
      x: leftOffsetX + index * (cardWidth + leftLayout.config.columnGap) + cardWidth / 2,
      align: "center",
    })),
    ...rightLayout.columns.map((column, index) => ({
      text: column.label,
      subtitle: column.subtitle,
      x:
        rightOffsetX +
        (rightLayout.columns.length - 1 - index) * (cardWidth + rightLayout.config.columnGap) +
        cardWidth / 2,
      align: "center",
    })),
    {
      text: "챔피언십",
      subtitle: finalRound.label,
      x: finalX + finalWidth / 2,
      align: "center",
    },
  ];

  return {
    width: totalWidth,
    height: totalHeight,
    nodes,
    lines,
    labels,
    finalCard: {
      match: finalMatch,
      x: finalX,
      y: finalY,
      width: finalWidth,
      height: finalHeight,
    },
  };
}

function renderLines(lines) {
  return lines
    .map(
      (line) =>
        `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="rgba(240, 230, 208, 0.88)" stroke-width="3.4" stroke-linecap="round" />`
    )
    .join("");
}

function renderBoardSlot(player, winner) {
  if (!player) {
    return `
      <div class="node-slot placeholder">
        <span class="slot-name">BYE</span>
        <span class="slot-meta">부전승</span>
      </div>
    `;
  }

  const isPlaceholder = Boolean(player.placeholder);
  const isWinner = Boolean(winner && !player.placeholder && winner.name === player.name);

  return `
    <div class="node-slot ${isPlaceholder ? "placeholder" : ""} ${isWinner ? "winner" : ""}">
      <span class="slot-name">${escapeHtml(player.name)}</span>
      <span class="slot-meta">${isPlaceholder ? "승자 대기" : `Seed ${escapeHtml(player.seed ?? "-")}`}</span>
    </div>
  `;
}

function renderMatchNode(node) {
  if (node.match.hidden) {
    return "";
  }

  const badge = node.match.note
    ? `<div class="node-badge">${escapeHtml(node.match.note)}</div>`
    : `<div class="node-badge subtle">${escapeHtml(node.match.id)}경기</div>`;

  return `
    <article class="match-node ${node.side} ${node.match.isBye ? "is-bye" : ""}" style="left:${node.x}px; top:${node.y}px;">
      ${badge}
      ${renderBoardSlot(node.match.player1, node.match.winner)}
      ${renderBoardSlot(node.match.player2, node.match.winner)}
    </article>
  `;
}

function renderFinalCard(finalCard) {
  return `
    <article class="final-match-card" style="left:${finalCard.x}px; top:${finalCard.y}px; width:${finalCard.width}px; height:${finalCard.height}px;">
      <div class="final-head">
        <span class="final-head-label">Final Match</span>
        <strong>우승 결정전</strong>
      </div>
      ${renderBoardSlot(finalCard.match.player1, finalCard.match.winner)}
      ${renderBoardSlot(finalCard.match.player2, finalCard.match.winner)}
    </article>
  `;
}

function renderRoundPills(labels) {
  return labels
    .map(
      (label) => `
        <div class="round-pill" style="left:${label.x}px;">
          <strong>${escapeHtml(label.text)}</strong>
          <span>${escapeHtml(label.subtitle)}</span>
        </div>
      `
    )
    .join("");
}

function renderBracketBoard(bracket) {
  const layout = createSymmetricBracketLayout(bracket);
  const nodesMarkup = layout.nodes.map((node) => renderMatchNode(node)).join("");
  const linesMarkup = renderLines(layout.lines);
  const labelsMarkup = renderRoundPills(layout.labels);
  const finalMarkup = renderFinalCard(layout.finalCard);

  return `
    <section class="bracket-visual-shell">
      <div class="bracket-visual-head">
        <div>
          <p class="panel-kicker">Visual Bracket</p>
          <h4>좌우 대칭 토너먼트 보드</h4>
        </div>
        <p>${escapeHtml(
          bracket.hasPreliminaryRound
            ? `${bracket.participantCount}명 기준 예선 후 ${bracket.mainBracketSize}강 본선으로 편성됩니다.`
            : `${bracket.participantCount}명 기준 ${bracket.mainBracketSize}강부터 바로 시작합니다.`
        )}</p>
      </div>

      <div class="bracket-board-viewport">
        <div class="symmetric-bracket" style="width:${layout.width}px; height:${layout.height}px;">
          ${labelsMarkup}
          <div class="champion-mark" style="left:${layout.finalCard.x + layout.finalCard.width / 2}px; top:${layout.finalCard.y - 72}px;">
            <span>🏆</span>
            <strong>Champion</strong>
          </div>
          <svg class="connector-layer" viewBox="0 0 ${layout.width} ${layout.height}" preserveAspectRatio="none" aria-hidden="true">
            ${linesMarkup}
          </svg>
          ${nodesMarkup}
          ${finalMarkup}
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
    {
      label: "시작 라운드",
      value: bracket.hasPreliminaryRound
        ? `예선 후 ${bracket.mainBracketSize}강`
        : `${bracket.mainBracketSize}강`,
    },
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

        ${renderBracketBoard(bracket)}
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
  const baseName = [bracket.eventTitle, bracket.divisionName, "bracket"]
    .map((item) => slugifyFileName(item))
    .filter(Boolean)
    .join("-");

  return `${baseName || "tournament-bracket"}.jpg`;
}

function createExportSurface(bracket) {
  const source = bracketStage.querySelector(`.${JPG_EXPORT_CLASS}`);
  const board = bracketStage.querySelector(".symmetric-bracket");

  if (!source || !board) return null;

  const metaMarkup = [
    { label: "대회명", value: bracket.eventTitle },
    { label: "부문", value: bracket.divisionName },
    { label: "참가자", value: `${bracket.participantCount}명` },
    { label: "대진 규모", value: `${bracket.bracketSize}강` },
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
      <strong>${escapeHtml(bracket.eventTitle)}</strong>
    </div>
    <div class="jpg-export-meta">${metaMarkup}</div>
    <div class="jpg-export-board-wrap"></div>
  `;

  const boardClone = board.cloneNode(true);
  exportSurface.querySelector(".jpg-export-board-wrap").append(boardClone);

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
  const roundCount = participantNames.length >= 2 ? Math.log2(nextPowerOfTwo(participantNames.length)) : 0;
  const byeCount = bracketSize ? bracketSize - participantNames.length : 0;
  const startLabel = participantNames.length >= 2 ? getMainBracketLabel(participantNames.length) : "0강";

  divisionPreview.textContent = previewName;
  summaryCount.textContent = `${participantNames.length}명`;
  summaryRounds.textContent = `${roundCount}라운드`;
  summaryBracket.textContent = startLabel;
  summaryByes.textContent = `${byeCount}명`;
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
