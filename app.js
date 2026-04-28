'use strict';

const TEAMS = [
  { id: 'mercedes',    name: 'Mercedes',     color: '#00DCFF' },
  { id: 'ferrari',     name: 'Ferrari',      color: '#ED1C24' },
  { id: 'mclaren',     name: 'McLaren',      color: '#FF8000' },
  { id: 'redbull',     name: 'Red Bull',     color: '#1E2D6B' },
  { id: 'alpine',      name: 'Alpine',       color: '#FF87BC' },
  { id: 'racingbulls', name: 'Racing Bulls', color: '#6692FF' },
  { id: 'haas',        name: 'Haas',         color: '#FFFFFF' },
  { id: 'audi',        name: 'Audi',         color: '#BFBFBF' },
  { id: 'williams',    name: 'Williams',     color: '#1B5BE0' },
  { id: 'cadillac',    name: 'Cadillac',     color: '#FFD23F' },
  { id: 'astonmartin', name: 'Aston Martin', color: '#00665C' },
];

// Spa-Francorchamps inspired loop. Top-down view. Counter-clockwise.
// Anchor points roughly evoke: start/finish straight, La Source hairpin,
// Eau Rouge / Raidillon kink, Kemmel straight, Les Combes, Bruxelles,
// Pouhon, Fagnes, Stavelot, Blanchimont sweep, Bus Stop chicane, back to start.
const TRACK_PATH = [
  'M 250 600',
  'L 250 350',
  'C 250 280, 350 268, 360 360',
  'L 405 470',
  'C 415 510, 470 512, 492 432',
  'L 540 350',
  'L 950 200',
  'C 1080 170, 1135 230, 1090 300',
  'C 1070 360, 1020 380, 1090 440',
  'C 1180 520, 1100 600, 950 580',
  'C 870 575, 830 625, 875 670',
  'C 925 705, 820 720, 700 700',
  'C 500 680, 350 650, 305 605',
  'C 285 588, 270 600, 250 600',
  'Z',
].join(' ');

const TOTAL_LAPS = 1;
const SVG_NS = 'http://www.w3.org/2000/svg';

const state = {
  drivers: [],
  cars: [],
  totalLength: 0,
  totalRaceDistance: 0,
  finishOrder: [],
  rafId: null,
  lastFrameTime: 0,
  raceRunning: false,
};

const els = {
  setup:        document.getElementById('setup'),
  race:         document.getElementById('race'),
  results:      document.getElementById('results'),
  drivers:      document.getElementById('drivers'),
  addDriver:    document.getElementById('addDriver'),
  startRace:    document.getElementById('startRace'),
  restart:      document.getElementById('restart'),
  trackPath:    document.getElementById('track'),
  trackShadow:  document.getElementById('track-shadow'),
  trackLine:    document.getElementById('track-line'),
  finishLine:   document.getElementById('finish-line'),
  carsLayer:    document.getElementById('cars'),
  standings:    document.getElementById('standings'),
  finalOrder:   document.getElementById('finalOrder'),
  countdown:    document.getElementById('countdown'),
};

// ---------- Screens ----------

function showScreen(name) {
  ['setup', 'race', 'results'].forEach(s => {
    els[s].classList.toggle('active', s === name);
  });
}

// ---------- Setup ----------

function addDriverRow() {
  if (state.drivers.length >= 10) return;
  const idx = state.drivers.length;
  const usedTeams = new Set(state.drivers.map(d => d.teamId));
  const nextTeam = TEAMS.find(t => !usedTeams.has(t.id)) || TEAMS[idx % TEAMS.length];
  state.drivers.push({ name: '', teamId: nextTeam.id });
  renderDrivers();
}

function removeDriver(idx) {
  state.drivers.splice(idx, 1);
  renderDrivers();
}

function renderDrivers() {
  els.drivers.innerHTML = '';
  state.drivers.forEach((driver, i) => {
    const row = document.createElement('div');
    row.className = 'driver-row';

    const num = document.createElement('span');
    num.className = 'driver-num';
    num.textContent = String(i + 1).padStart(2, '0');

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Förare ${i + 1}`;
    input.value = driver.name;
    input.maxLength = 24;
    input.addEventListener('input', e => {
      driver.name = e.target.value;
      updateStartButton();
    });

    const teamWrap = document.createElement('label');
    teamWrap.className = 'team-select';
    const dot = document.createElement('span');
    dot.className = 'team-dot';
    const team = TEAMS.find(t => t.id === driver.teamId);
    dot.style.background = team.color;
    const select = document.createElement('select');
    TEAMS.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === driver.teamId) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', e => {
      driver.teamId = e.target.value;
      const t2 = TEAMS.find(t => t.id === driver.teamId);
      dot.style.background = t2.color;
    });
    teamWrap.appendChild(dot);
    teamWrap.appendChild(select);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-icon';
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', 'Ta bort förare');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeDriver(i));

    row.appendChild(num);
    row.appendChild(input);
    row.appendChild(teamWrap);
    row.appendChild(removeBtn);
    els.drivers.appendChild(row);
  });

  els.addDriver.disabled = state.drivers.length >= 10;
  updateStartButton();
}

function updateStartButton() {
  const valid = state.drivers.length >= 1 &&
                state.drivers.every(d => d.name.trim().length > 0);
  els.startRace.disabled = !valid;
}

// ---------- Race setup ----------

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// Top-down F1 silhouette built into the given <g>.
// Length spans roughly x ∈ [-13, 14.8], width spans y ∈ [-6.5, 6.5] including wheels.
// Front of the car points in +x direction.
function buildCarShape(group, color) {
  const dark = '#0a0b0d';
  const wheel = '#1a1c20';

  // Rear wing (broad, perpendicular to direction)
  group.appendChild(svgEl('rect', {
    x: -13, y: -6, width: 3, height: 12, rx: 0.6,
    fill: color, stroke: dark, 'stroke-width': 0.6,
  }));
  // Endplates
  group.appendChild(svgEl('rect', { x: -13, y: -6,   width: 3, height: 1, fill: dark }));
  group.appendChild(svgEl('rect', { x: -13, y:  5,   width: 3, height: 1, fill: dark }));
  // Connector to body
  group.appendChild(svgEl('rect', { x: -10.5, y: -1.5, width: 1.5, height: 3, fill: color }));

  // Rear wheels
  group.appendChild(svgEl('rect', { x: -9, y: -6.5, width: 4, height: 2.5, rx: 0.5,
    fill: wheel, stroke: dark, 'stroke-width': 0.4 }));
  group.appendChild(svgEl('rect', { x: -9, y:  4,   width: 4, height: 2.5, rx: 0.5,
    fill: wheel, stroke: dark, 'stroke-width': 0.4 }));

  // Main body — tapered: narrow tail, wide sidepods, narrow at nose root
  group.appendChild(svgEl('path', {
    d: 'M -10 -2.5 L -5 -4 L 3 -4 L 6 -3 L 11 -1.2 L 11 1.2 L 6 3 L 3 4 L -5 4 L -10 2.5 Z',
    fill: color, stroke: dark, 'stroke-width': 0.6,
  }));
  // Subtle sidepod accent strips
  group.appendChild(svgEl('path', {
    d: 'M -7 -3.6 L 2 -3.6 M -7 3.6 L 2 3.6',
    stroke: 'rgba(0,0,0,0.35)', 'stroke-width': 0.6, fill: 'none', 'stroke-linecap': 'round',
  }));

  // Front wheels
  group.appendChild(svgEl('rect', { x: 5, y: -6.5, width: 4, height: 2.5, rx: 0.5,
    fill: wheel, stroke: dark, 'stroke-width': 0.4 }));
  group.appendChild(svgEl('rect', { x: 5, y:  4,   width: 4, height: 2.5, rx: 0.5,
    fill: wheel, stroke: dark, 'stroke-width': 0.4 }));

  // Halo + cockpit
  group.appendChild(svgEl('path', {
    d: 'M -1.6 -2 A 2.6 2 0 0 1 3 -1.5 L 3 1.5 A 2.6 2 0 0 1 -1.6 2 Z',
    fill: dark,
  }));
  group.appendChild(svgEl('ellipse', { cx: 0.6, cy: 0, rx: 1.6, ry: 1.2, fill: '#000' }));
  group.appendChild(svgEl('circle',  { cx: 0.6, cy: 0, r: 0.85, fill: color, opacity: 0.65 }));

  // Nose taper from body to front wing
  group.appendChild(svgEl('path', {
    d: 'M 11 -1.2 L 13 -0.6 L 13 0.6 L 11 1.2 Z',
    fill: color, stroke: dark, 'stroke-width': 0.4,
  }));

  // Front wing (broader than body)
  group.appendChild(svgEl('rect', {
    x: 13, y: -6.5, width: 1.8, height: 13, rx: 0.5,
    fill: color, stroke: dark, 'stroke-width': 0.6,
  }));
  group.appendChild(svgEl('rect', { x: 13, y: -6.5, width: 1.8, height: 1, fill: dark }));
  group.appendChild(svgEl('rect', { x: 13, y:  5.5, width: 1.8, height: 1, fill: dark }));
}

function setupRace() {
  els.trackPath.setAttribute('d', TRACK_PATH);
  els.trackShadow.setAttribute('d', TRACK_PATH);
  els.trackLine.setAttribute('d', TRACK_PATH);

  state.totalLength = els.trackPath.getTotalLength();
  state.totalRaceDistance = state.totalLength * TOTAL_LAPS;

  // Finish line marker perpendicular to direction at start
  const startPoint = els.trackPath.getPointAtLength(0);
  const aheadPoint = els.trackPath.getPointAtLength(2);
  const dx = aheadPoint.x - startPoint.x;
  const dy = aheadPoint.y - startPoint.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny =  dx / len;
  const half = 28;
  els.finishLine.setAttribute('x1', startPoint.x - nx * half);
  els.finishLine.setAttribute('y1', startPoint.y - ny * half);
  els.finishLine.setAttribute('x2', startPoint.x + nx * half);
  els.finishLine.setAttribute('y2', startPoint.y + ny * half);

  // Build car DOM and state
  els.carsLayer.innerHTML = '';
  const laneOffsets = [-12, -4, 4, 12];

  state.cars = state.drivers.map((driver, i) => {
    const team = TEAMS.find(t => t.id === driver.teamId);
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('car');
    buildCarShape(group, team.color);
    els.carsLayer.appendChild(group);

    // Every car starts on the exact same point of the start line — no head start.
    // Lateral lanes only spread them visually so they don't overlap pixel-perfectly.
    const baseSpeed = 215 + Math.random() * 55;
    const lateralJitter = (Math.random() - 0.5) * 1.5;

    return {
      driver,
      team,
      element: group,
      distance: 0,
      baseSpeed,
      currentSpeed: 0,
      targetSpeed: baseSpeed * (0.62 + Math.random() * 0.78),
      laneOffset: laneOffsets[i % laneOffsets.length] + lateralJitter,
      finishOrder: null,
      changeTimer: Math.random() * 0.45,
    };
  });

  // Initial render at grid
  state.cars.forEach(updateCarTransform);

  state.finishOrder = [];
}

function updateCarTransform(car) {
  const total = state.totalLength;
  let dist = ((car.distance % total) + total) % total;
  const p  = els.trackPath.getPointAtLength(dist);
  const p2 = els.trackPath.getPointAtLength((dist + 1.5) % total);
  const angle = Math.atan2(p2.y - p.y, p2.x - p.x);
  const ox = -Math.sin(angle) * car.laneOffset;
  const oy =  Math.cos(angle) * car.laneOffset;
  const deg = angle * 180 / Math.PI;
  car.element.setAttribute(
    'transform',
    `translate(${(p.x + ox).toFixed(2)} ${(p.y + oy).toFixed(2)}) rotate(${deg.toFixed(2)})`
  );
}

// ---------- Countdown ----------

function showCountdownStep(text) {
  return new Promise(resolve => {
    els.countdown.textContent = text;
    els.countdown.classList.add('show');
    setTimeout(() => {
      els.countdown.classList.remove('show');
      setTimeout(resolve, 250);
    }, 650);
  });
}

async function runCountdown() {
  await showCountdownStep('3');
  await showCountdownStep('2');
  await showCountdownStep('1');
  await showCountdownStep('GO');
}

// ---------- Race loop ----------

async function startRace() {
  showScreen('race');
  // Wait one frame so the SVG is laid out before measuring
  await new Promise(r => requestAnimationFrame(r));
  setupRace();

  // Pre-race: cars wait on grid during countdown
  await runCountdown();

  state.raceRunning = true;
  state.lastFrameTime = performance.now();
  state.rafId = requestAnimationFrame(raceFrame);
}

function raceFrame(now) {
  const dt = Math.min((now - state.lastFrameTime) / 1000, 0.05);
  state.lastFrameTime = now;

  for (const car of state.cars) {
    if (car.finishOrder !== null) {
      // Coast smoothly after finishing
      car.targetSpeed = car.baseSpeed * 0.35;
      car.currentSpeed += (car.targetSpeed - car.currentSpeed) * Math.min(dt * 1.5, 1);
      car.distance += car.currentSpeed * dt;
      updateCarTransform(car);
      continue;
    }

    // Smoothed random speed adjustments — produces overtakes within a single lap
    car.changeTimer -= dt;
    if (car.changeTimer <= 0) {
      car.targetSpeed = car.baseSpeed * (0.62 + Math.random() * 0.78);
      car.changeTimer = 0.25 + Math.random() * 0.6;
    }
    car.currentSpeed += (car.targetSpeed - car.currentSpeed) * Math.min(dt * 2.4, 1);
    car.distance += car.currentSpeed * dt;

    if (car.distance >= state.totalRaceDistance) {
      car.distance = state.totalRaceDistance;
      car.finishOrder = state.finishOrder.length;
      state.finishOrder.push(car);
    }

    updateCarTransform(car);
  }

  updateLeaderboard();

  if (state.finishOrder.length === state.cars.length) {
    state.raceRunning = false;
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
    setTimeout(showResults, 1400);
    return;
  }

  state.rafId = requestAnimationFrame(raceFrame);
}

// ---------- Leaderboard ----------

function updateLeaderboard() {
  const finished = state.finishOrder.slice();
  const racing = state.cars
    .filter(c => c.finishOrder === null)
    .sort((a, b) => b.distance - a.distance);
  const ordered = finished.concat(racing);

  // Reuse list nodes if count unchanged for slightly smoother updates
  if (els.standings.childElementCount !== ordered.length) {
    els.standings.innerHTML = '';
    for (let i = 0; i < ordered.length; i++) {
      const li = document.createElement('li');
      li.className = 'standing';
      li.innerHTML = `
        <span class="standing-pos"></span>
        <span class="standing-color"></span>
        <span class="standing-name"></span>
        <span class="standing-prog"></span>`;
      els.standings.appendChild(li);
    }
  }

  ordered.forEach((car, i) => {
    const li = els.standings.children[i];
    li.classList.toggle('finished', car.finishOrder !== null);
    li.children[0].textContent = String(i + 1).padStart(2, '0');
    li.children[1].style.background = car.team.color;
    li.children[2].textContent = car.driver.name;
    if (car.finishOrder !== null) {
      li.children[3].textContent = '✓';
    } else {
      const pct = Math.max(0, Math.min(1, car.distance / state.totalRaceDistance)) * 100;
      li.children[3].textContent = `${pct.toFixed(0)}%`;
    }
  });
}

// ---------- Results ----------

function showResults() {
  showScreen('results');
  els.finalOrder.innerHTML = '';
  state.finishOrder.forEach((car, i) => {
    const li = document.createElement('li');
    li.className = 'final-row';

    const pos = document.createElement('span');
    pos.className = 'final-pos';
    pos.textContent = i + 1;

    const dot = document.createElement('span');
    dot.className = 'final-color';
    dot.style.background = car.team.color;

    const meta = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'final-name';
    name.textContent = car.driver.name;
    const team = document.createElement('div');
    team.className = 'final-team';
    team.textContent = car.team.name;
    meta.appendChild(name);
    meta.appendChild(team);

    li.appendChild(pos);
    li.appendChild(dot);
    li.appendChild(meta);
    els.finalOrder.appendChild(li);
  });
}

// ---------- Reset ----------

function reset() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  state.raceRunning = false;
  state.cars = [];
  state.finishOrder = [];
  els.carsLayer.innerHTML = '';
  els.standings.innerHTML = '';
  showScreen('setup');
}

// ---------- Init ----------

els.addDriver.addEventListener('click', addDriverRow);
els.startRace.addEventListener('click', () => {
  if (els.startRace.disabled) return;
  startRace();
});
els.restart.addEventListener('click', reset);

// Start with two empty rows
addDriverRow();
addDriverRow();
