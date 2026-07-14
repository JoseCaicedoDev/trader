// Alert and Notification Manager
//
// Manages HTML5 Web Notifications, synthesized sound alerts via the Web Audio API,
// visual slide-in toast fallbacks, and synchronizes alert settings across all sidebars.
//
// Exposes global alert functions to live-feed.js. Must load after ui.js and before live-feed.js.

const lastAlertedKeys = new Set();

// Synchronize all settings checkboxes
// Will be called explicitly by main.js after DOM rendering

function initAlertManager() {
  const checkboxes = document.querySelectorAll('.chk-alert-sound');

  function syncCheckboxes(checked) {
    checkboxes.forEach(cb => {
      cb.checked = checked;
    });
  }

  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      syncCheckboxes(e.target.checked);
      if (e.target.checked && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            showVisualToast("Notificaciones Activas 🔔", "Las alertas de señales ahora se enviarán a tu escritorio.");
          }
        });
      }
    });
  });
}

// Generates custom synth sounds so we don't rely on external audio file hosting
function playNotificationSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'BUY') {
      // Ascending premium double beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Descending premium double beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.frequency.setValueAtTime(440.00, ctx.currentTime + 0.12); // A4
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    console.error("Audio Playback Error:", e);
  }
}

function showVisualToast(title, body) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  // Styling with Tailwinds glass-card structure
  toast.className = 'glass-card rounded-xl p-4 border border-neon-cyan/20 flex flex-col gap-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-slide-in pointer-events-auto bg-dark-sidebar/95 backdrop-blur-md w-72 select-none';
  toast.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="font-bold text-xs text-white tracking-wide uppercase">${title}</span>
      <button class="text-gray-400 hover:text-white text-[10px] leading-none p-1 cursor-pointer" onclick="this.parentElement.parentElement.remove()">✕</button>
    </div>
    <span class="text-xs text-gray-300 leading-relaxed font-medium">${body.replace(/\n/g, '<br>')}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition-opacity', 'duration-500');
    setTimeout(() => toast.remove(), 500);
  }, 8000);
}

// Global alert triggers called by live feed ticks
function checkAndTriggerAlert(symbol, strategyName, price, signalType, timestamp, eventLabel) {
  if (!signalType || (signalType !== 'BUY' && signalType !== 'SHORT')) return;

  // Deduplicate alerts: avoid alerting multiple times for the same candle bar + direction
  const key = `${symbol}_${strategyName}_${timestamp}_${signalType}`;
  if (lastAlertedKeys.has(key)) return;
  lastAlertedKeys.add(key);

  const direction = signalType === 'BUY' ? 'LONG 🟢' : 'SHORT 🔴';
  const strategyLabel = strategyName === 'wyckoff' ? 'Wyckoff Unificada' : 'VWAP + EMA Cross';
  const detail = eventLabel ? ` (${eventLabel})` : '';

  const title = `¡Señal ${direction} en ${symbol}!`;
  const body = `Estrategia: ${strategyLabel}${detail}\nPrecio actual: $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // 1. Play synthesized beep
  const sound1 = document.getElementById('chk-alert-sound');
  if (sound1 && sound1.checked) {
    playNotificationSound(signalType);
  }

  // 2. Browser native notification
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: "https://bin.re/signal.png" // placeholder/fallback icon
    });
  }

  // 3. Visual slide-in toast fallback/addition
  showVisualToast(title, body);
}
