// 타일과 피드에 들어가는 생성형 미디어. 영상·이미지 파일 대신 캔버스로 그립니다.
(function () {
  const TAU = Math.PI * 2;
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const SCENES = {
    orbit(ctx, w, h, t, hue) {
      ctx.fillStyle = hsl(hue, 45, 10); ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, m = Math.min(w, h);
      for (let i = 1; i <= 6; i++) {
        const r = m * 0.07 * i;
        ctx.strokeStyle = hsl(hue, 40, 40, 0.35); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.3, r, 0, 0, TAU); ctx.stroke();
        const a = t * (0.9 / i) + i * 1.7;
        ctx.fillStyle = hsl(hue + i * 25, 85, 62);
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r, m * 0.012 * (7 - i) + 3, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#C8F31D'; ctx.beginPath(); ctx.arc(cx, cy, m * 0.05, 0, TAU); ctx.fill();
    },
    waves(ctx, w, h, t, hue) {
      ctx.fillStyle = hsl(hue, 50, 94); ctx.fillRect(0, 0, w, h);
      for (let k = 0; k < 9; k++) {
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) {
          const y = h * (0.25 + k * 0.08) + Math.sin(x * 0.012 + t * (0.6 + k * 0.08) + k) * h * 0.05 + Math.sin(x * 0.03 - t) * h * 0.012;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = hsl(hue + k * 6, 60, 70 - k * 6, 0.55); ctx.fill();
      }
    },
    voxel(ctx, w, h, t, hue) {
      ctx.fillStyle = hsl(hue, 55, 86); ctx.fillRect(0, 0, w, h);
      const s = Math.min(w, h) / 16, ox = w / 2, oy = h * 0.3, N = 7;
      const cube = (x, y, z, c) => {
        const px = ox + (x - y) * s, py = oy + (x + y) * s * 0.5 - z * s;
        ctx.fillStyle = hsl(c, 55, 62); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + s, py + s / 2); ctx.lineTo(px, py + s); ctx.lineTo(px - s, py + s / 2); ctx.fill();
        ctx.fillStyle = hsl(c, 50, 46); ctx.beginPath(); ctx.moveTo(px - s, py + s / 2); ctx.lineTo(px, py + s); ctx.lineTo(px, py + 2 * s); ctx.lineTo(px - s, py + 1.5 * s); ctx.fill();
        ctx.fillStyle = hsl(c, 50, 36); ctx.beginPath(); ctx.moveTo(px + s, py + s / 2); ctx.lineTo(px, py + s); ctx.lineTo(px, py + 2 * s); ctx.lineTo(px + s, py + 1.5 * s); ctx.fill();
      };
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
        const hgt = Math.max(1, Math.round(2 + Math.sin(x * 0.9 + t * 0.8) * 1.2 + Math.cos(y * 0.8 + t * 0.6) * 1.2));
        for (let z = 0; z < hgt; z++) cube(x, y, z, z === hgt - 1 ? hue - 80 : hue - 140);
      }
    },
    particles(ctx, w, h, t, hue) {
      ctx.fillStyle = '#0D0D0D'; ctx.fillRect(0, 0, w, h);
      const r = rand(7), cx = w / 2, cy = h / 2, m = Math.min(w, h);
      const k = (Math.sin(t * 0.7) + 1) / 2; // 0: 흩어짐, 1: 모임
      for (let i = 0; i < 900; i++) {
        const a = (i / 900) * TAU, ring = m * 0.28 * (1 + 0.15 * Math.sin(a * 5));
        const tx = cx + Math.cos(a) * ring, ty = cy + Math.sin(a) * ring;
        const sx = r() * w, sy = r() * h;
        ctx.fillStyle = hsl(hue + (i % 60), 90, 65, 0.85);
        ctx.fillRect(sx + (tx - sx) * k, sy + (ty - sy) * k, 2, 2);
      }
    },
    grid(ctx, w, h, t, hue) {
      ctx.fillStyle = hsl(hue, 30, 96); ctx.fillRect(0, 0, w, h);
      const c = 14, cw = w / c, rows = Math.ceil(h / cw), r = rand(hue + 3);
      for (let y = 0; y < rows; y++) for (let x = 0; x < c; x++) {
        const v = r(), on = (Math.sin(t * 1.4 + v * 20) + 1) / 2;
        const road = x % 4 === 0 || y % 4 === 0;
        ctx.fillStyle = road ? hsl(hue, 10, 82) : hsl(hue + v * 40, 55, 75 - on * 35);
        const pad = road ? 0 : cw * (0.12 + (1 - on) * 0.2);
        ctx.fillRect(x * cw + pad, y * cw + pad, cw - pad * 2, cw - pad * 2);
      }
    },
    bars(ctx, w, h, t, hue) {
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
      const n = 12, bw = w / (n * 1.5);
      for (let i = 0; i < n; i++) {
        const v = 0.25 + 0.6 * (Math.sin(t * 1.2 + i * 0.7) + 1) / 2;
        ctx.fillStyle = i % 4 === 0 ? '#C8F31D' : hsl(hue + i * 4, 55, 55);
        const x = bw * 0.75 + i * bw * 1.5;
        ctx.beginPath(); ctx.roundRect(x, h * 0.9 - v * h * 0.75, bw, v * h * 0.75, 6); ctx.fill();
      }
      ctx.fillStyle = '#D9D9D9'; ctx.fillRect(0, h * 0.9, w, 2);
    },
    stripes(ctx, w, h, t, hue) {
      ctx.fillStyle = hsl(hue, 70, 55); ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-0.4);
      const d = Math.hypot(w, h), sw = d / 18;
      for (let i = -12; i < 12; i++) {
        const off = ((t * 60) % (sw * 2));
        ctx.fillStyle = i % 2 ? hsl(hue + 30, 80, 88) : hsl(hue - 20, 70, 40);
        ctx.fillRect(i * sw * 2 + off - d / 2, -d, sw, d * 2);
      }
      ctx.restore();
    },
    rings(ctx, w, h, t, hue) {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, hsl(hue, 40, 30)); g.addColorStop(1, hsl(hue, 50, 6));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const m = Math.min(w, h);
      for (let i = 0; i < 14; i++) {
        ctx.strokeStyle = hsl(hue + i * 8, 80, 70, 0.6 - i * 0.03); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(w / 2, h / 2, m * 0.06 * i + 10, m * 0.025 * i + 6, t * 0.3 + i * 0.12, 0, TAU); ctx.stroke();
      }
    },
    tiles(ctx, w, h, t, hue) {
      ctx.fillStyle = '#F7F7F7'; ctx.fillRect(0, 0, w, h);
      const n = 8, s = Math.min(w, h) / (n + 2), ox = (w - s * n) / 2, oy = (h - s * n) / 2, step = Math.floor(t * 4) % n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const on = (x * 7 + y * 3 + hue) % 5 === 0 || x === step;
        ctx.fillStyle = on ? (x === step ? '#9ACD00' : hsl(hue, 65, 50)) : '#DADADA';
        const g = s * 0.1; ctx.beginPath(); ctx.roundRect(ox + x * s + g, oy + y * s + g, s - 2 * g, s - 2 * g, s * 0.18); ctx.fill();
      }
    },
    aurora(ctx, w, h, t, hue) {
      ctx.fillStyle = '#050816'; ctx.fillRect(0, 0, w, h);
      const r = rand(11);
      for (let i = 0; i < 120; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; ctx.fillRect(r() * w, r() * h * 0.7, 1.5, 1.5); }
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        for (let x = 0; x <= w; x += 4) {
          const y = h * 0.35 + Math.sin(x * 0.006 + t * 0.5 + k) * h * 0.12 + Math.sin(x * 0.017 - t * 0.8) * h * 0.04;
          const g = ctx.createLinearGradient(0, y - h * 0.25, 0, y);
          g.addColorStop(0, hsl(hue + k * 40, 90, 55, 0));
          g.addColorStop(1, hsl(hue + k * 40, 90, 60, 0.12));
          ctx.fillStyle = g; ctx.fillRect(x, y - h * 0.25, 4, h * 0.25);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };

  // 캔버스 하나를 장면에 연결. play()/pause()로 움직임을 제어합니다.
  function mount(canvas, scene, hue) {
    const draw = SCENES[scene] || SCENES.orbit;
    const ctx = canvas.getContext('2d');
    let raf = 0, t0 = 0, tAcc = 1.3, playing = false;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      if (!r.width) return false;
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };
    const frame = () => { const r = canvas.getBoundingClientRect(); draw(ctx, r.width, r.height, tAcc, hue); };
    const loop = (ts) => {
      if (!t0) t0 = ts;
      tAcc += (ts - t0) / 1000; t0 = ts;
      frame(); raf = requestAnimationFrame(loop);
    };
    const api = {
      render() { if (fit()) frame(); },
      play() { if (playing) return; playing = true; t0 = 0; raf = requestAnimationFrame(loop); },
      pause() { playing = false; cancelAnimationFrame(raf); },
      get playing() { return playing; },
    };
    new ResizeObserver(() => api.render()).observe(canvas);
    return api;
  }

  window.Media = { mount, SCENES };
})();
