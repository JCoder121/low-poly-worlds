// low-poly-worlds landing — a full-bleed 2D atlas. Two clickable pins (fixed
// for musashi's hill, CSS-drifting for sparrow's wake) navigate to each
// diorama's expanse page. Deliberately simple: no 3D, no build-up — the map
// itself is the whole page.
const labelEl = document.getElementById("marker-label");

for (const marker of document.querySelectorAll(".marker")) {
  const href = marker.dataset.href;
  const label = marker.dataset.label;

  marker.addEventListener("mouseenter", () => {
    labelEl.textContent = label;
    labelEl.classList.add("visible");
  });
  marker.addEventListener("mousemove", (e) => {
    labelEl.style.left = `${e.clientX}px`;
    labelEl.style.top = `${e.clientY}px`;
  });
  marker.addEventListener("mouseleave", () => labelEl.classList.remove("visible"));

  const navigate = () => { window.location.href = import.meta.env.BASE_URL + href; };
  marker.addEventListener("click", navigate);
  marker.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(); }
  });
}

// ---------- themed loader ----------
const LOADER_LINES = ["unrolling the map…", "placing the markers…"];
const loaderEl = document.getElementById("loader");
const loaderMsg = document.getElementById("loader-msg");
const loaderFill = document.getElementById("loader-fill");
LOADER_LINES.forEach((line, i) => {
  setTimeout(() => {
    loaderMsg.textContent = line;
    loaderFill.style.width = `${((i + 1) / LOADER_LINES.length) * 100}%`;
  }, 260 * i);
});
setTimeout(() => loaderEl.classList.add("done"), 260 * LOADER_LINES.length + 260);
