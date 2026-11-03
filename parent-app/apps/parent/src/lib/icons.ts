const PATHS: Record<string, string> = {
  today:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  train: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  data: '<path d="M4 19V5M4 19h16"/><path d="M7 15l3-4 3 3 4-6"/>',
  device:
    '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  profile:
    '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>',
};

export function icon(name: keyof typeof PATHS | string, size = 22): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "icon";
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;
  wrap.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] ?? ""}</svg>`;
  return wrap;
}
