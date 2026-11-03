// --- Estado de la Aplicación ---
const state = {
  currentType: 'sine',
  amplitude: 1.0,
  frequency: 440,
  isRunning: true,
  speed: 1.0,
  nTerms: 10,
  timeOffset: 0,
  audioActive: false
};

// --- Web Audio API ---
let audioCtx = null;
let masterGain = null;
let activeOscillators = [];

// --- Referencias DOM ---
const canvas = document.getElementById('wave-canvas');
const ctx = canvas.getContext('2d');
const ampSlider = document.getElementById('amp-slider');
const ampVal = document.getElementById('amp-val');
const freqSlider = document.getElementById('freq-slider');
const freqVal = document.getElementById('freq-val');
const speedSlider = document.getElementById('speed-slider');
const runBtn = document.getElementById('run-btn');
const runIcon = document.getElementById('run-icon');
const runText = document.getElementById('run-text');
const fourierControls = document.getElementById('fourier-controls');
const waveBadge = document.getElementById('wave-badge');
const idealLegend = document.getElementById('ideal-legend');
const equationDisplay = document.getElementById('equation-display');
const hoverCoords = document.getElementById('hover-coords');
const audioToggle = document.getElementById('audio-toggle');
const audioText = document.getElementById('audio-text');

// --- Inicialización del Canvas ---
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Funciones de Ondas y Fourier ---
function evaluateWave(t, type, A, f, N) {
  const w = 2 * Math.PI * f;
  let val = 0;

  switch (type) {
    case 'sine':
      return A * Math.sin(w * t);

    case 'square':
      for (let k = 1; k <= N; k++) {
        const n = 2 * k - 1;
        val += (4 / Math.PI) * (1 / n) * Math.sin(n * w * t);
      }
      return A * val;

    case 'sawtooth':
      for (let n = 1; n <= N; n++) {
        val += (2 / Math.PI) * (Math.pow(-1, n + 1) / n) * Math.sin(n * w * t);
      }
      return A * val;

    case 'triangle':
      for (let k = 0; k < N; k++) {
        const n = 2 * k + 1;
        const sign = Math.pow(-1, k);
        val += (8 / (Math.PI * Math.PI)) * (sign / (n * n)) * Math.sin(n * w * t);
      }
      return A * val;
  }
}

function evaluateIdealWave(t, type, A, f) {
  const period = 1 / f;
  const phase = (t % period) / period;
  const normPhase = phase < 0 ? phase + 1 : phase;

  switch (type) {
    case 'square':
      return normPhase < 0.5 ? A : -A;
    case 'sawtooth':
      return A * (2 * normPhase - 1);
    case 'triangle':
      return normPhase < 0.5 ? A * (4 * normPhase - 1) : A * (3 - 4 * normPhase);
    default:
      return evaluateWave(t, type, A, f, 1);
  }
}

// --- Renderizado Gráfico ---
function drawGrid(width, height) {
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;

  const gridStep = 40;
  for (let x = 0; x < width; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Eje Central (X)
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function render() {
  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);
  const centerY = height / 2;
  const scaleY = (height / 2 - 40) / 5; // Escalado para max amplitud 5V

  ctx.clearRect(0, 0, width, height);
  drawGrid(width, height);

  const timeWindow = 0.01; // 10ms visibles en pantalla

  // Dibujar Onda Ideal (Si no es senoidal)
  if (state.currentType !== 'sine') {
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const t = state.timeOffset + (x / width) * timeWindow;
      const yVal = evaluateIdealWave(t, state.currentType, state.amplitude, state.frequency);
      const y = centerY - yVal * scaleY;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Dibujar Onda Real / Serie de Fourier
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(34, 211, 238, 0.4)';
  ctx.shadowBlur = 8;
  ctx.beginPath();

  for (let x = 0; x < width; x++) {
    const t = state.timeOffset + (x / width) * timeWindow;
    const yVal = evaluateWave(t, state.currentType, state.amplitude, state.frequency, state.nTerms);
    const y = centerY - yVal * scaleY;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Actualizar animación si está corriendo
  if (state.isRunning) {
    state.timeOffset += 0.00005 * state.speed;
  }

  requestAnimationFrame(render);
}

// --- Actualización de Ecuación Teórica ---
function updateEquationUI() {
  const A = state.amplitude.toFixed(1);
  const f = state.frequency;
  const N = state.nTerms;

  let eq = '';
  switch (state.currentType) {
    case 'sine':
      eq = `f(t) = ${A} · sin(2π · ${f} · t)`;
      break;
    case 'square':
      eq = `f(t) = (4·${A}/π) · ∑_{k=1}^{${N}} [ sin((2k-1) · 2π·${f}·t) / (2k-1) ]`;
      break;
    case 'sawtooth':
      eq = `f(t) = (2·${A}/π) · ∑_{n=1}^{${N}} [ (-1)^{n+1} · sin(n · 2π·${f}·t) / n ]`;
      break;
    case 'triangle':
      eq = `f(t) = (8·${A}/π²) · ∑_{k=0}^{${N-1}} [ (-1)^k · sin((2k+1) · 2π·${f}·t) / (2k+1)² ]`;
      break;
  }
  equationDisplay.textContent = eq;
}

// --- Motor de Audio (Síntesis Aditiva) ---
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.1;
    masterGain.connect(audioCtx.destination);
  }
}

function updateAudioSynthesizer() {
  if (!state.audioActive || !audioCtx) return;

  // Limpiar osciladores existentes
  activeOscillators.forEach(osc => {
    try { osc.stop(); osc.disconnect(); } catch (e) {}
  });
  activeOscillators = [];

  const baseFreq = state.frequency;
  const A = state.amplitude / 5.0; // Normalizado para volumen
  masterGain.gain.setTargetAtTime(A * 0.15, audioCtx.currentTime, 0.02);

  if (state.currentType === 'sine') {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
    osc.connect(masterGain);
    osc.start();
    activeOscillators.push(osc);
    return;
  }

  // Síntesis Aditiva por Armónicos para Fourier
  for (let i = 1; i <= state.nTerms; i++) {
    let harmFreq = baseFreq;
    let harmAmp = 0;

    if (state.currentType === 'square') {
      const n = 2 * i - 1;
      harmFreq = baseFreq * n;
      harmAmp = (4 / Math.PI) * (1 / n);
    } else if (state.currentType === 'sawtooth') {
      const n = i;
      harmFreq = baseFreq * n;
      harmAmp = (2 / Math.PI) * (1 / n);
    } else if (state.currentType === 'triangle') {
      const n = 2 * (i - 1) + 1;
      harmFreq = baseFreq * n;
      harmAmp = (8 / (Math.PI * Math.PI)) * (1 / (n * n));
    }

    if (harmFreq < 20000) { // Límite auditivo humano
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(harmFreq, audioCtx.currentTime);
      gain.gain.setValueAtTime(harmAmp, audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start();
      activeOscillators.push(osc);
    }
  }
}

// --- Event Listeners ---
ampSlider.addEventListener('input', (e) => {
  state.amplitude = parseFloat(e.target.value);
  ampVal.textContent = state.amplitude.toFixed(1);
  updateEquationUI();
  updateAudioSynthesizer();
});

freqSlider.addEventListener('input', (e) => {
  state.frequency = parseInt(e.target.value);
  freqVal.textContent = `${state.frequency} Hz`;
  updateEquationUI();
  updateAudioSynthesizer();
});

speedSlider.addEventListener('input', (e) => {
  state.speed = parseFloat(e.target.value);
});

runBtn.addEventListener('click', () => {
  state.isRunning = !state.isRunning;
  runIcon.textContent = state.isRunning ? '⏸' : '▶';
  runText.textContent = state.isRunning ? 'PAUSA' : 'REANUDAR';
  runBtn.classList.toggle('bg-emerald-600', state.isRunning);
  runBtn.classList.toggle('bg-amber-600', !state.isRunning);
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    state.currentType = e.target.dataset.type;
    waveBadge.textContent = e.target.textContent;

    if (state.currentType === 'sine') {
      fourierControls.classList.add('hidden');
      idealLegend.classList.add('hidden');
    } else {
      fourierControls.classList.remove('hidden');
      idealLegend.classList.remove('hidden');
    }

    updateEquationUI();
    updateAudioSynthesizer();
  });
});

document.querySelectorAll('.n-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.n-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    state.nTerms = parseInt(e.target.dataset.n);
    updateEquationUI();
    updateAudioSynthesizer();
  });
});

audioToggle.addEventListener('click', () => {
  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  state.audioActive = !state.audioActive;
  audioText.textContent = state.audioActive ? 'Desactivar Sonido' : 'Activar Sonido';
  audioToggle.classList.toggle('bg-cyan-600', !state.audioActive);
  audioToggle.classList.toggle('bg-rose-600', state.audioActive);

  if (!state.audioActive) {
    activeOscillators.forEach(osc => { try { osc.stop(); } catch (e) {} });
    activeOscillators = [];
  } else {
    updateAudioSynthesizer();
  }
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const width = rect.width;
  const height = rect.height;
  const centerY = height / 2;
  const scaleY = (height / 2 - 40) / 5;

  const t = (x / width) * 10; // ms
  const yVal = evaluateWave((state.timeOffset + (x / width) * 0.01), state.currentType, state.amplitude, state.frequency, state.nTerms);

  hoverCoords.textContent = `t: ${t.toFixed(2)} ms | V: ${yVal.toFixed(2)} V`;
});

// --- Iniciar App ---
updateEquationUI();
requestAnimationFrame(render);