/* Tack-Eat! — footer animation + live clock */

const footer    = document.getElementById('footer');
const brandWrap = document.getElementById('brandWrap');
const cols      = document.getElementById('cols');
const cover     = footer.previousElementSibling;   // whichever section sits right above the footer

/* 1. Trigger the slide-ins once each part is UNCOVERED by the section above
      (the footer sits underneath it, so "on screen" isn't enough).
      Covering it again resets the animation so it replays. */
function revealed(el) {
  const r = el.getBoundingClientRect();
  const coverEdge = Math.max(cover.getBoundingClientRect().bottom, 0);
  const visible = Math.min(r.bottom, innerHeight) - Math.max(r.top, coverEdge);
  return visible / r.height;
}

function update() {
  /* only tuck the footer underneath when the whole footer fits on screen */
  footer.classList.toggle('is-pinned', footer.offsetHeight <= innerHeight);

  const b = revealed(brandWrap);
  if (b >= 0.35) brandWrap.classList.add('is-in');
  else if (b <= 0) brandWrap.classList.remove('is-in');

  const c = revealed(cols);
  if (c >= 0.35) footer.classList.add('is-in');
  else if (c <= 0) footer.classList.remove('is-in');
}

let queued = false;
function onScroll() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; update(); });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
update();
addEventListener('load', update);   // re-check once fonts/images have loaded

/* 2. Live Kuala Lumpur time (optional; delete if you want static text) */
function tick() {
  const t = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur'
  });
  document.getElementById('localTime').textContent = `${t} (SGT +8)`;
}
tick(); setInterval(tick, 30000);
