(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- header state ---------------- */
  const header = document.getElementById("siteHeader");
  const scrollBar = document.getElementById("scrollBar");
  const scrollHint = document.querySelector(".scroll-hint");

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle("scrolled", y > 8);
    if (scrollHint) scrollHint.classList.toggle("is-hidden", y > 24);

    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? (y / max) * 100 : 0;
    scrollBar.style.width = pct + "%";
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------- mobile nav ---------------- */
  const navToggle = document.getElementById("navToggle");
  navToggle.addEventListener("click", () => {
    const open = header.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll("#mainNav a").forEach((link) => {
    link.addEventListener("click", () => {
      header.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });

  /* ---------------- active nav link on scroll ---------------- */
  const sections = ["work", "capabilities", "process", "contact"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const navLinks = document.querySelectorAll("[data-nav]");

  if ("IntersectionObserver" in window && sections.length) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((section) => navObserver.observe(section));
  }

  /* ---------------- reveal on scroll ---------------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------------- rotating hero words ---------------- */
  const rotatorWords = document.documentElement.lang === "en"
    ? ["LLM agents", "RAG systems", "AI assistants", "automations", "AI pipelines"]
    : ["LLM-агентов", "RAG-системы", "AI-ассистентов", "автоматизации", "AI-пайплайны"];
  const rotatorEl = document.getElementById("rotator");
  if (rotatorEl && !prefersReducedMotion) {
    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % rotatorWords.length;
      rotatorEl.style.opacity = "0";
      rotatorEl.style.transform = "translateY(6px)";
      setTimeout(() => {
        rotatorEl.textContent = rotatorWords[idx];
        rotatorEl.style.transition = "opacity 0.35s ease, transform 0.35s ease";
        rotatorEl.style.opacity = "1";
        rotatorEl.style.transform = "translateY(0)";
      }, 220);
    }, 2600);
  }

  /* ---------------- case detail modal ---------------- */
  const caseOverlay = document.getElementById("caseOverlay");
  const caseModal = document.getElementById("caseModal");
  const caseClose = document.getElementById("caseClose");
  const casePanels = document.querySelectorAll(".case-panel");
  let lastCaseTrigger = null;

  function openCase(key, trigger) {
    casePanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.case === key);
    });
    const title = document.getElementById(`case-title-${key}`);
    if (title) caseModal.setAttribute("aria-labelledby", title.id);

    lastCaseTrigger = trigger || null;
    caseOverlay.classList.add("is-open");
    caseOverlay.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
    caseClose.focus();
  }

  function closeCase() {
    caseOverlay.classList.remove("is-open");
    caseOverlay.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
    if (lastCaseTrigger) lastCaseTrigger.focus();
  }

  if (caseOverlay) {
    document.querySelectorAll(".work-link[data-case]").forEach((btn) => {
      btn.addEventListener("click", () => openCase(btn.dataset.case, btn));
    });
    caseClose.addEventListener("click", closeCase);
    caseOverlay.addEventListener("click", (e) => {
      if (e.target === caseOverlay) closeCase();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && caseOverlay.classList.contains("is-open")) closeCase();
    });
  }

  /* ---------------- footer year ---------------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- hero background: 3D depth particles, 2D canvas fallback ---------------- */
  const canvas = document.getElementById("netCanvas");

  function init2DParticles() {
    const ctx = canvas.getContext("2d");
    let particles = [];
    let width, height, dpr;
    let mouse = { x: null, y: null };
    let animId;

    const PARTICLE_COUNT_BASE = 70;
    const LINK_DIST = 130;
    const MOUSE_DIST = 160;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round((width * height) / 18000);
      particles = Array.from({ length: Math.min(count, PARTICLE_COUNT_BASE + 40) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));
    }

    function step() {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            ctx.strokeStyle = `rgba(201, 255, 61, ${0.14 * (1 - dist / LINK_DIST)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (mouse.x !== null) {
          const dx = particles[i].x - mouse.x, dy = particles[i].y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_DIST) {
            ctx.strokeStyle = `rgba(110, 231, 255, ${0.35 * (1 - dist / MOUSE_DIST)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.fillStyle = "rgba(201, 255, 61, 0.55)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(step);
    }

    resize();
    step();

    window.addEventListener("resize", () => {
      cancelAnimationFrame(animId);
      resize();
      step();
    });

    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    document.addEventListener("mouseleave", () => {
      mouse.x = null;
      mouse.y = null;
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
      } else {
        step();
      }
    });
  }

  function init3DParticles() {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 20;

    function makeLayer(count, spread, size, color, opacity) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * spread;
        pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.55;
        pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false });
      return new THREE.Points(geo, mat);
    }

    const far = makeLayer(160, 46, 0.1, 0x6ee7ff, 0.3);
    const near = makeLayer(80, 26, 0.15, 0xc9ff3d, 0.5);
    scene.add(far, near);

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    let mx = 0, my = 0;
    window.addEventListener("mousemove", (e) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    document.addEventListener("mouseleave", () => { mx = 0; my = 0; });

    let animId;
    function animate() {
      animId = requestAnimationFrame(animate);
      far.rotation.y += 0.0004;
      near.rotation.y += 0.0009;
      camera.position.x += (mx * 2.4 - camera.position.x) * 0.02;
      camera.position.y += (-my * 1.4 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    animate();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(animId);
      else animate();
    });
  }

  if (canvas && !prefersReducedMotion) {
    if (typeof THREE !== "undefined") {
      init3DParticles();
    } else {
      init2DParticles();
    }
  }

  /* ---------------- hero stat count-up ---------------- */
  (function countUpStats() {
    const els = document.querySelectorAll(".stat-num[data-count]");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => { el.textContent = el.dataset.count + (el.dataset.suffix || ""); });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || "";
        if (prefersReducedMotion) {
          el.textContent = target + suffix;
        } else {
          let cur = 0;
          const step = Math.max(1, Math.round(target / 24));
          const timer = setInterval(() => {
            cur += step;
            if (cur >= target) { cur = target; clearInterval(timer); }
            el.textContent = cur + suffix;
          }, 35);
        }
        io.unobserve(el);
      });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  })();

  /* ---------------- live agent demo terminal ---------------- */
  (function agentDemo() {
    const section = document.getElementById("demo");
    const qEl = document.getElementById("demoQText");
    const aEl = document.getElementById("demoA");
    const cursor = document.getElementById("demoCursor");
    if (!section || !qEl || !aEl || !cursor) return;

    const isEn = document.documentElement.lang === "en";
    const question = isEn
      ? "How many vacation days do I get, and can I roll them over?"
      : "Сколько дней отпуска положено и можно перенести?";
    const answerText = isEn
      ? "28 days a year, up to 14 days can be carried over."
      : "28 дней в год, перенос — не более 14 дней.";
    const cite = "vacation_policy.md";

    let timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function play() {
      clearTimers();
      qEl.textContent = "";
      aEl.innerHTML = "";
      cursor.style.display = "inline-block";
      let i = 0;
      function typeChar() {
        if (i <= question.length) {
          qEl.textContent = question.slice(0, i);
          i++;
          timers.push(setTimeout(typeChar, 26));
        } else {
          cursor.style.display = "none";
          timers.push(setTimeout(() => {
            aEl.innerHTML = answerText + '<div class="cite">' + cite + "</div>";
          }, 480));
        }
      }
      typeChar();
    }

    if (prefersReducedMotion) {
      qEl.textContent = question;
      aEl.innerHTML = answerText + '<div class="cite">' + cite + "</div>";
      return;
    }

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) play();
          else clearTimers();
        });
      }, { threshold: 0.5 });
      io.observe(section);
    } else {
      play();
    }
  })();
})();
