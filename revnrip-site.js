/*
Rev-N-Rip Popup + Form Controller
- Loads the mailing list popup on every page.
- Uses images/revnrip_logo_transparent.png
- Has X close button and Not now button.
- If Formspree is not connected, it opens a pre-filled email fallback.
*/

(function () {
  if (window.__REVNRIP_SITE_CONTROLLER_V6__) return;
  window.__REVNRIP_SITE_CONTROLLER_V6__ = true;

  const EMAIL_TO = "Info.revnrip@gmail.com";
  const FORM_ENDPOINT = "https://formspree.io/f/YOUR_FORMSPREE_FORM_ID";
  const LOGO_SRC = "./images/revnrip_logo_transparent.png";
  const POPUP_SESSION_KEY = "revnrip_popup_seen_v6";

  function isFormspreeConnected(action) {
    return action && action.includes("formspree.io/f/") && !action.includes("YOUR_FORMSPREE_FORM_ID");
  }

  function getFormLabel(form) {
    const hiddenType = form.querySelector('input[name="form_type"]')?.value;
    const subject = form.querySelector('input[name="_subject"]')?.value;
    if (hiddenType) return hiddenType;
    if (subject) return subject;
    if (form.id && form.id.toLowerCase().includes("popup")) return "Mailing List / Giveaway Signup";
    return "Rev-N-Rip Website Inquiry";
  }

  function formToText(form) {
    const data = new FormData(form);
    const lines = [];
    lines.push("Rev-N-Rip Website Submission");
    lines.push("Form Type: " + getFormLabel(form));
    lines.push("");
    for (const [key, value] of data.entries()) {
      if (value instanceof File) {
        if (value.name) lines.push(`${key}: ${value.name} (attach this file/photo manually if needed)`);
        continue;
      }
      if (key.startsWith("_") || key === "send_to" || key === "recipient") continue;
      lines.push(`${key}: ${value || "(blank)"}`);
    }
    lines.push("");
    lines.push("Generated from the Rev-N-Rip website.");
    return lines.join("\n");
  }

  function openMailFallback(form) {
    const subject = encodeURIComponent(getFormLabel(form));
    const body = encodeURIComponent(formToText(form));
    window.location.href = `mailto:${EMAIL_TO}?subject=${subject}&body=${body}`;
  }

  function setInlineStatus(form, message, type) {
    let status = form.querySelector(".rnr-form-message");
    if (!status) {
      status = document.createElement("div");
      status.className = "rnr-form-message";
      form.appendChild(status);
    }
    status.textContent = message;
    status.className = "rnr-form-message " + (type || "");
  }


  function shouldSkipGenericFormHandler(form) {
    if (!form) return false;

    const id = (form.id || "").toLowerCase();
    const className = (form.className || "").toString().toLowerCase();
    const page = (document.body?.dataset?.page || "").toLowerCase();

    // Supabase/auth/dashboard/admin/chat forms must NOT be handled by the generic
    // contact-form fallback, or they can accidentally open the user's email app.
    const skippedIds = [
      "loginform",
      "registerform",
      "bountyform",
      "startmessageform",
      "messagecomposer"
    ];

    if (skippedIds.includes(id)) return true;
    if (page === "auth" || page === "dashboard" || page === "admin") return true;
    if (className.includes("rnr-form") && id === "rnrpopupform") return false;

    // Any form explicitly marked as Supabase-controlled should be skipped.
    if (form.dataset.supabaseForm === "true") return true;
    if (form.closest("[data-supabase-zone='true']")) return true;

    return false;
  }

  async function handleFormSubmit(form, event) {
    if (shouldSkipGenericFormHandler(form)) return;
    event.preventDefault();

    const submit = form.querySelector('button[type="submit"], input[type="submit"]');
    const oldText = submit ? (submit.textContent || submit.value || "Submit") : "";

    if (submit) {
      submit.disabled = true;
      if (submit.tagName === "BUTTON") submit.textContent = "Sending...";
      else submit.value = "Sending...";
    }

    const action = form.getAttribute("action") || FORM_ENDPOINT;

    try {
      if (!isFormspreeConnected(action)) {
        setInlineStatus(form, "Opening your email app with the form details. Add your Formspree ID later for full on-page submissions.", "info");
        setTimeout(() => openMailFallback(form), 350);
        return;
      }

      const response = await fetch(action, {
        method: "POST",
        body: new FormData(form),
        headers: { "Accept": "application/json" }
      });

      if (response.ok) {
        form.reset();
        setInlineStatus(form, "Sent. Rev-N-Rip will review it and follow up.", "success");
      } else {
        setInlineStatus(form, "The form service returned an error. Opening email fallback now.", "error");
        setTimeout(() => openMailFallback(form), 600);
      }
    } catch (error) {
      setInlineStatus(form, "Could not submit through the form service. Opening email fallback now.", "error");
      setTimeout(() => openMailFallback(form), 600);
    } finally {
      setTimeout(() => {
        if (submit) {
          submit.disabled = false;
          if (submit.tagName === "BUTTON") submit.textContent = oldText;
          else submit.value = oldText;
        }
      }, 900);
    }
  }

  function injectStyles() {
    if (document.getElementById("revnrip-popup-styles-final")) return;

    const css = `
      .rnr-form-message{
        margin-top:12px;
        padding:12px 14px;
        border-radius:16px;
        border:1px solid rgba(255,255,255,.10);
        background:rgba(255,255,255,.055);
        color:#ffe4f6;
        font-weight:800;
        line-height:1.45;
      }
      .rnr-form-message.success{background:rgba(90,255,166,.08);border-color:rgba(90,255,166,.22)}
      .rnr-form-message.error{background:rgba(255,90,120,.08);border-color:rgba(255,90,120,.26)}
      .rnr-form-message.info{background:rgba(255,179,77,.08);border-color:rgba(255,179,77,.20)}

      .rnr-pop-overlay{
        position:fixed;
        inset:0;
        z-index:999999;
        display:none;
        align-items:center;
        justify-content:center;
        padding:22px;
        background:
          radial-gradient(circle at 20% 12%, rgba(255,47,152,.22), transparent 30%),
          radial-gradient(circle at 82% 18%, rgba(255,179,77,.16), transparent 28%),
          rgba(0,0,0,.76);
        backdrop-filter:blur(14px);
        font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .rnr-pop-overlay.rnr-show{display:flex;animation:rnrFadeIn .34s ease both}
      .rnr-pop{
        width:min(860px,100%);
        position:relative;
        overflow:hidden;
        border-radius:36px;
        border:1px solid rgba(255,255,255,.16);
        background:
          linear-gradient(135deg, rgba(123,51,255,.18), rgba(255,47,152,.11), rgba(255,179,77,.08)),
          linear-gradient(180deg, rgba(16,11,28,.97), rgba(8,6,18,.94));
        box-shadow:0 36px 120px rgba(0,0,0,.66),0 0 48px rgba(255,47,152,.20),inset 0 1px 0 rgba(255,255,255,.10);
        color:#fff;
        animation:rnrPopIn .42s cubic-bezier(.2,1.1,.2,1) both;
      }
      .rnr-pop::before{
        content:"";
        position:absolute;
        inset:-2px;
        background:linear-gradient(115deg, transparent 0%, rgba(255,255,255,.10) 28%, transparent 48%),radial-gradient(circle at 80% 8%, rgba(255,179,77,.18), transparent 28%);
        pointer-events:none;
      }
      .rnr-pop::after{
        content:"";
        position:absolute;
        right:-80px;
        bottom:-80px;
        width:260px;
        height:260px;
        border-radius:50%;
        background:radial-gradient(circle, rgba(255,47,152,.18), transparent 70%);
        pointer-events:none;
      }
      .rnr-pop-inner{position:relative;z-index:1;display:grid;grid-template-columns:1.08fr .92fr}
      .rnr-pop-content{padding:34px}
      .rnr-pop-visual{padding:28px;display:grid;place-items:center;background:radial-gradient(circle at center, rgba(255,179,77,.13), transparent 46%),rgba(255,255,255,.035);border-left:1px solid rgba(255,255,255,.08)}
      .rnr-badge{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#ffe4f6;font-size:12px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
      .rnr-logo-row{display:flex;align-items:center;gap:12px;margin:16px 0 8px}
      .rnr-logo-orb{position:relative;width:84px;height:84px;display:grid;place-items:center;flex:0 0 auto}
      .rnr-logo-orb::before{content:"";position:absolute;inset:-12px;border-radius:50%;background:radial-gradient(circle, rgba(255,47,152,.24), transparent 65%);animation:rnrLogoPulse 2.8s ease-in-out infinite}
      .rnr-logo-orb img{position:relative;max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 0 24px rgba(255,255,255,.14)) drop-shadow(0 0 16px rgba(255,47,152,.28));animation:rnrLogoFloat 3.4s ease-in-out infinite}
      .rnr-logo-label{color:#ffcf8a;font-size:13px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}
      .rnr-pop h2{margin:12px 0 10px;font-size:clamp(34px,5vw,60px);line-height:.96;letter-spacing:-.04em}
      .rnr-gradient{background:linear-gradient(135deg,#fff,#ffd6f0 36%,#ff2f98 60%,#ffcf8a 94%);-webkit-background-clip:text;background-clip:text;color:transparent}
      .rnr-pop p{margin:0;color:#eadff7;line-height:1.6;font-size:16px}
      .rnr-perks{display:grid;gap:10px;margin-top:18px}
      .rnr-perk{display:flex;gap:10px;align-items:flex-start;color:#f1e6f8;font-size:14px}
      .rnr-perk span{width:26px;height:26px;border-radius:9px;display:grid;place-items:center;flex:0 0 auto;background:linear-gradient(135deg,#7b33ff,#ff2f98,#ffb34d)}
      .rnr-form{display:grid;gap:12px;margin-top:20px}
      .rnr-form input{width:100%;box-sizing:border-box;padding:15px 16px;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;outline:none;font:inherit}
      .rnr-form input::placeholder{color:rgba(255,255,255,.52)}
      .rnr-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
      .rnr-submit{border:0;border-radius:999px;padding:14px 18px;font-weight:950;color:#fff;cursor:pointer;background:linear-gradient(135deg,#7b33ff,#ff2f98,#ffb34d);box-shadow:0 14px 32px rgba(255,47,152,.18)}
      .rnr-skip{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:#fff;border-radius:999px;padding:13px 17px;font-weight:900;cursor:pointer}
      .rnr-close{position:absolute;top:16px;right:16px;z-index:3;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#fff;font-size:28px;line-height:1;cursor:pointer}
      .rnr-card{width:100%;max-width:310px;aspect-ratio:3/4;border-radius:30px;border:1px solid rgba(255,255,255,.12);background:radial-gradient(circle at 30% 14%, rgba(255,255,255,.18), transparent 22%),linear-gradient(145deg, rgba(123,51,255,.44), rgba(255,47,152,.34), rgba(255,179,77,.24));box-shadow:0 24px 76px rgba(0,0,0,.48),0 0 36px rgba(255,47,152,.20);display:grid;place-items:center;text-align:center;padding:26px;position:relative;overflow:hidden}
      .rnr-card::before{content:"";position:absolute;inset:-40%;background:conic-gradient(from 0deg, transparent 0 70%, rgba(255,255,255,.20) 75%, transparent 80% 100%);animation:rnrGlint 6s linear infinite}
      .rnr-card img{position:relative;z-index:1;max-width:76%;height:auto;object-fit:contain;filter:drop-shadow(0 0 24px rgba(255,255,255,.16));animation:rnrLogoFloat 3.1s ease-in-out infinite}
      .rnr-card strong{position:relative;z-index:1;display:block;font-size:30px;line-height:1;color:#fff;margin-top:14px}
      .rnr-card small{position:relative;z-index:1;display:block;margin-top:10px;color:#fff2cc;font-weight:950;letter-spacing:.12em;text-transform:uppercase;font-size:12px}
      .rnr-small{margin-top:6px;font-size:12px;color:#cfc1da}
      @keyframes rnrFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes rnrPopIn{from{opacity:0;transform:translateY(20px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes rnrLogoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
      @keyframes rnrLogoPulse{0%,100%{transform:scale(1);opacity:.72}50%{transform:scale(1.13);opacity:1}}
      @keyframes rnrGlint{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @media(max-width:760px){
        .rnr-pop-inner{grid-template-columns:1fr}
        .rnr-pop-visual{display:none}
        .rnr-pop-content{padding:28px 22px}
        .rnr-logo-orb{width:68px;height:68px}
        .rnr-actions{display:grid;grid-template-columns:1fr}
        .rnr-submit,.rnr-skip{width:100%}
      }
    `;

    const style = document.createElement("style");
    style.id = "revnrip-popup-styles-final";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function injectPopup() {
    if (document.getElementById("rnrPopupOverlay")) return;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="rnr-pop-overlay" id="rnrPopupOverlay" aria-hidden="true">
        <div class="rnr-pop" role="dialog" aria-modal="true" aria-labelledby="rnrPopupTitle">
          <button class="rnr-close" type="button" id="rnrPopupClose" aria-label="Close popup">×</button>
          <div class="rnr-pop-inner">
            <div class="rnr-pop-content">
              <span class="rnr-badge">Rev-N-Rip Inner Lane</span>
              <div class="rnr-logo-row">
                <div class="rnr-logo-orb"><img src="${LOGO_SRC}" alt="Rev-N-Rip logo"></div>
                <div class="rnr-logo-label">Premium collector access</div>
              </div>
              <h2 id="rnrPopupTitle"><span class="rnr-gradient">Get codes. Catch drops. Enter giveaways.</span></h2>
              <p>Join the Rev-N-Rip mailing list for future promo codes, drop alerts, bounty updates, and giveaway entry opportunities.</p>
              <div class="rnr-perks">
                <div class="rnr-perk"><span>⚡</span><div>Get early notice on drops and bounty updates.</div></div>
                <div class="rnr-perk"><span>🎁</span><div>Be in line for future giveaway announcements and promo-code offers.</div></div>
                <div class="rnr-perk"><span>🏁</span><div>Stay in the fast lane for Pokémon, MetaZoo, bounties, and vault activity.</div></div>
              </div>
              <form class="rnr-form" id="rnrPopupForm" action="${FORM_ENDPOINT}" method="POST">
                <input type="hidden" name="_subject" value="New Rev-N-Rip Mailing List Signup">
                <input type="hidden" name="send_to" value="${EMAIL_TO}">
                <input type="hidden" name="recipient" value="${EMAIL_TO}">
                <input type="hidden" name="form_type" value="Mailing List / Giveaway Signup">
                <input type="text" name="name" placeholder="Name or collector handle">
                <input type="email" name="email" placeholder="Email address" required>
                <div class="rnr-actions">
                  <button class="rnr-submit" type="submit">Join + Enter</button>
                  <button class="rnr-skip" type="button" id="rnrPopupSkip">Not now</button>
                </div>
                <div class="rnr-small">No spam. Just drops, codes, and collector fuel.</div>
              </form>
            </div>
            <div class="rnr-pop-visual">
              <div class="rnr-card">
                <div>
                  <img src="${LOGO_SRC}" alt="Rev-N-Rip logo">
                  <strong>VAULT<br>ACCESS</strong>
                  <small>Codes • Drops • Giveaways</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(wrapper.firstElementChild);
  }

  function setupPopup() {
    const overlay = document.getElementById("rnrPopupOverlay");
    const closeBtn = document.getElementById("rnrPopupClose");
    const skipBtn = document.getElementById("rnrPopupSkip");
    const form = document.getElementById("rnrPopupForm");

    if (!overlay || !closeBtn || !skipBtn || !form) return;

    function closePopup() {
      overlay.classList.remove("rnr-show");
      overlay.setAttribute("aria-hidden", "true");
    }

    function showPopup() {
      if (sessionStorage.getItem(POPUP_SESSION_KEY)) return;
      setTimeout(function () {
        overlay.classList.add("rnr-show");
        overlay.setAttribute("aria-hidden", "false");
        sessionStorage.setItem(POPUP_SESSION_KEY, "yes");
      }, 700);
    }

    closeBtn.addEventListener("click", closePopup);
    skipBtn.addEventListener("click", closePopup);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closePopup();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && overlay.classList.contains("rnr-show")) closePopup();
    });
    form.addEventListener("submit", function (event) {
      handleFormSubmit(form, event);
    });

    showPopup();
  }

  function wireForms() {
    document.querySelectorAll("form").forEach(function (form) {
      if (form.id === "rnrPopupForm") return;
      if (shouldSkipGenericFormHandler(form)) return;
      if (form.dataset.revnripWired === "yes") return;
      form.dataset.revnripWired = "yes";

      if (!form.querySelector('input[name="recipient"]')) {
        const recipient = document.createElement("input");
        recipient.type = "hidden";
        recipient.name = "recipient";
        recipient.value = EMAIL_TO;
        form.prepend(recipient);
      }

      if (!form.querySelector('input[name="send_to"]')) {
        const sendTo = document.createElement("input");
        sendTo.type = "hidden";
        sendTo.name = "send_to";
        sendTo.value = EMAIL_TO;
        form.prepend(sendTo);
      }

      form.addEventListener("submit", function (event) {
        handleFormSubmit(form, event);
      });
    });
  }

  function init() {
    injectStyles();
    injectPopup();
    setupPopup();
    wireForms();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
