export type DecorCategory = "widgets" | "notes" | "tapes" | "food" | "life" | "arrows"

export type Decor = {
  id: string
  label: string
  w: number
  h: number
  src: string
  kind?: "sticker" | "widget"
}

export type DecorGroup = {
  id: DecorCategory
  group: string
  items: Decor[]
}

const url = (svg: string) => "data:image/svg+xml;utf8," + encodeURIComponent(svg)
const mk = (id: string, label: string, w: number, h: number, src: string, kind: "sticker" | "widget" = "sticker"): Decor => ({
  id,
  label,
  w,
  h,
  src,
  kind,
})

const SHADOW =
  '<defs><filter id="s" x="-12%" y="-12%" width="130%" height="135%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#2a221b" flood-opacity=".22"/></filter></defs>'

// ---- Washi Tapes, Pins & Clips --------------------------------------------
function tape(c: string, pat: "solid" | "stripes" | "dots" | "gingham" | "sakura"): string {
  const pts = "6,0 254,0 260,8 254,16 260,24 254,32 260,40 254,48 260,56 254,64 6,64 0,56 6,48 0,40 6,32 0,24 6,16 0,8"
  let defs = ""
  if (pat === "stripes") {
    defs = '<pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#fff" opacity=".5"/></pattern>'
  } else if (pat === "dots") {
    defs = '<pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="3" fill="#fff" opacity=".68"/></pattern>'
  } else if (pat === "gingham") {
    defs = '<pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="10" fill="#fff" opacity=".32"/><rect width="10" height="20" fill="#fff" opacity=".32"/></pattern>'
  } else if (pat === "sakura") {
    defs = '<pattern id="p" width="36" height="32" patternUnits="userSpaceOnUse"><circle cx="18" cy="16" r="6" fill="#fff" opacity=".7"/><circle cx="18" cy="16" r="2.2" fill="#f2849e"/></pattern>'
  }
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="64" viewBox="0 0 260 64"><defs>${defs}</defs><polygon points="${pts}" fill="${c}" opacity=".88"/>${pat === "solid" ? "" : `<polygon points="${pts}" fill="url(#p)"/>`}</svg>`,
  )
}

function pushPin(headColor: string, darkColor: string): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="110" viewBox="0 0 96 110"><ellipse cx="52" cy="96" rx="18" ry="6" fill="#000" opacity=".22"/><path d="M46 62 L50 96 L54 62 Z" fill="#b4b8c2"/><circle cx="48" cy="48" r="20" fill="${darkColor}"/><path d="M40 30 L56 30 L64 46 L32 46 Z" fill="${headColor}"/><circle cx="48" cy="24" r="18" fill="${headColor}"/><ellipse cx="42" cy="18" rx="6" ry="3.5" fill="#fff" opacity=".55" transform="rotate(-20 42 18)"/></svg>`,
  )
}

function dotTape(color: string): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="${color}" opacity=".62"/></svg>`,
  )
}

function paperClip(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="130" viewBox="0 0 76 130">${SHADOW}<path filter="url(#s)" d="M24 92 V32 A16 16 0 0 1 56 32 V98 A22 22 0 0 1 12 98 V40" fill="none" stroke="#d4a74a" stroke-width="6.5" stroke-linecap="round"/></svg>`,
  )
}

// ---- Notes & Post-its ------------------------------------------------------
const note = (c: string) =>
  url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">${SHADOW}<g filter="url(#s)"><path d="M12 8H306V250L250 306H12Z" fill="${c}"/><path d="M306 250L250 306V250Z" fill="#000" opacity=".14"/></g></svg>`,
  )

const pill = (c: string) =>
  url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="80" viewBox="0 0 280 80"><rect x="2" y="4" width="276" height="72" rx="36" fill="${c}" opacity=".92"/></svg>`,
  )

const torn = (c: string) =>
  url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="230" viewBox="0 0 340 230">${SHADOW}<g filter="url(#s)"><path d="M12 10H328V196L300 206L272 195L244 207L216 195L188 207L160 195L132 207L104 195L76 207L48 195L12 204Z" fill="${c}"/></g></svg>`,
  )

function gridNote(bg: string, gridColor: string, tapeColor: string, title: string, titleColor: string): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="340" viewBox="0 0 320 340">
      <defs>
        <pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="${gridColor}" stroke-width="1"/></pattern>
        <filter id="s" x="-10%" y="-10%" width="125%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-opacity=".22"/></filter>
      </defs>
      <g filter="url(#s)">
        <rect x="14" y="24" width="292" height="300" rx="6" fill="${bg}"/>
        <rect x="14" y="24" width="292" height="300" rx="6" fill="url(#g)"/>
      </g>
      <polygon points="88,10 232,10 236,36 84,36" fill="${tapeColor}" opacity=".9"/>
      <text x="160" y="68" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="22" letter-spacing="1.5" fill="${titleColor}">${title}</text>
    </svg>`,
  )
}

function limeDotNote(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">${SHADOW}
      <g filter="url(#s)"><rect x="16" y="28" width="288" height="276" rx="4" fill="#c7dc1e"/></g>
      <circle cx="160" cy="28" r="22" fill="#b8d97c" opacity=".75"/>
    </svg>`,
  )
}

// ---- Planner Widgets (Reference Images) ------------------------------------
function moodWidget(): string {
  const faces = [
    ["#fde2e4", "^^"],
    ["#e2ece9", ":D"],
    ["#fff1e6", "<3"],
    ["#eae4e9", ":)"],
    ["#f0efeb", ":|"],
    ["#f8edeb", "x_x"],
    ["#dfe7fd", ":("],
    ["#ffcfd2", ">:("],
    ["#e5e5e5", "zZ"],
    ["#fefae0", "*_*"],
  ]
  const circles = faces
    .map(([, expr], idx) => {
      const col = idx % 5
      const row = Math.floor(idx / 5)
      const cx = 48 + col * 56
      const cy = 104 + row * 72
      return `<circle cx="${cx}" cy="${cy}" r="22" fill="#fff" stroke="#4a4046" stroke-width="2"/><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#4a4046">${expr.replace("<", "&lt;").replace(">", "&gt;")}</text>`
    })
    .join("")
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="236" viewBox="0 0 320 236">${SHADOW}
      <g filter="url(#s)"><rect x="10" y="10" width="300" height="214" rx="10" fill="#f4e6ea"/></g>
      <text x="160" y="44" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="22" fill="#3a3036">mood.</text>
      <line x1="28" y1="60" x2="292" y2="60" stroke="#7d6c75" stroke-width="1.5"/>
      ${circles}
    </svg>`,
  )
}

function clock24Widget(): string {
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = ((i * 15 - 90) * Math.PI) / 180
    const x1 = 160 + Math.cos(a) * 90
    const y1 = 170 + Math.sin(a) * 90
    const x2 = 160 + Math.cos(a) * 102
    const y2 = 170 + Math.sin(a) * 102
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#8f6572" stroke-width="1.5"/>`
  }).join("")
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <defs>
        <pattern id="pg" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="#e3c0c8" stroke-width="0.9"/></pattern>
        <filter id="s" x="-10%" y="-10%" width="125%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-opacity=".22"/></filter>
      </defs>
      <g filter="url(#s)"><rect x="10" y="10" width="300" height="300" rx="12" fill="#edd3d9"/></g>
      <text x="26" y="38" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#7c5460">24</text>
      <text x="294" y="38" text-anchor="end" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#7c5460">Hours</text>
      <circle cx="160" cy="170" r="102" fill="#fbf5f6" stroke="#b98e9a" stroke-width="2"/>
      <circle cx="160" cy="170" r="102" fill="url(#pg)" opacity=".75"/>
      ${ticks}
      <text x="160" y="58" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#7c5460">00</text>
      <text x="275" y="174" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#7c5460">06</text>
      <text x="160" y="290" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#7c5460">12</text>
      <text x="45" y="174" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#7c5460">18</text>
      <circle cx="160" cy="170" r="4" fill="#7c5460"/>
    </svg>`,
  )
}

function todoPriorityWidget(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="240" viewBox="0 0 340 240">${SHADOW}
      <g filter="url(#s)"><rect x="10" y="10" width="320" height="220" rx="8" fill="#e9e4db" stroke="#c7bfb0" stroke-width="1.5"/></g>
      <rect x="24" y="24" width="292" height="192" rx="4" fill="none" stroke="#998f80" stroke-width="1.2"/>
      <text x="170" y="54" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="18" fill="#5e564c">to-do</text>
      <line x1="40" y1="130" x2="300" y2="130" stroke="#bdb4a4" stroke-width="1.4"/>
      <circle cx="80" cy="164" r="11" fill="none" stroke="#7c7366" stroke-width="1.8"/>
      <circle cx="170" cy="164" r="11" fill="none" stroke="#7c7366" stroke-width="1.8"/>
      <circle cx="260" cy="164" r="11" fill="none" stroke="#7c7366" stroke-width="1.8"/>
      <text x="80" y="190" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#7c7366">HIGH</text>
      <text x="80" y="202" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#8b8274">PRIORITY</text>
      <text x="170" y="190" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#7c7366">MEDIUM</text>
      <text x="170" y="202" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#8b8274">PRIORITY</text>
      <text x="260" y="190" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#7c7366">LOW</text>
      <text x="260" y="202" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#8b8274">PRIORITY</text>
    </svg>`,
  )
}

function todayTaskWidget(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">${SHADOW}
      <g filter="url(#s)"><rect x="10" y="10" width="280" height="280" rx="8" fill="#d8d4e8"/></g>
      <text x="150" y="56" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#2e2a3b">today task.</text>
      <line x1="28" y1="84" x2="272" y2="84" stroke="#9e98b8" stroke-width="1.5"/>
      <text x="32" y="126" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#4c4566">1</text>
      <line x1="28" y1="142" x2="272" y2="142" stroke="#9e98b8" stroke-width="1.5"/>
      <text x="32" y="184" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#4c4566">2</text>
      <line x1="28" y1="200" x2="272" y2="200" stroke="#9e98b8" stroke-width="1.5"/>
      <text x="32" y="242" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#4c4566">3</text>
      <line x1="28" y1="258" x2="272" y2="258" stroke="#9e98b8" stroke-width="1.5"/>
    </svg>`,
  )
}

function readingWidget(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="170" viewBox="0 0 360 170">${SHADOW}
      <g filter="url(#s)"><rect x="10" y="10" width="340" height="150" rx="14" fill="#f7b23b"/></g>
      <rect x="26" y="28" width="76" height="114" rx="6" fill="#2b4c57" stroke="#fff" stroke-width="2"/>
      <rect x="36" y="42" width="56" height="36" rx="2" fill="#f7d08a"/>
      <line x1="36" y1="92" x2="90" y2="92" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <line x1="36" y1="106" x2="78" y2="106" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".75"/>
      <text x="120" y="54" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#fff">Currently reading</text>
      <line x1="120" y1="84" x2="326" y2="84" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 4" opacity=".8"/>
      <line x1="120" y1="112" x2="326" y2="112" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 4" opacity=".8"/>
      <rect x="120" y="128" width="180" height="12" rx="6" fill="#fde3a7"/>
      <rect x="120" y="128" width="90" height="12" rx="6" fill="#6d4c9c"/>
      <text x="308" y="138" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#fff">50%</text>
    </svg>`,
  )
}

function nextWeekNotesWidget(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="220" viewBox="0 0 380 220">${SHADOW}
      <g filter="url(#s)"><rect x="10" y="10" width="360" height="200" rx="16" fill="#e9e7e0" stroke="#cbc7bc" stroke-width="1.5"/></g>
      <text x="190" y="42" text-anchor="middle" font-family="Georgia,serif" font-size="18" fill="#5e5a52">Notes to next week</text>
      <line x1="28" y1="54" x2="352" y2="54" stroke="#ccc8be" stroke-width="1.2"/>
      ${[86, 120, 154, 188]
        .map(
          (y) =>
            `<circle cx="38" cy="${y - 5}" r="7" fill="none" stroke="#999488" stroke-width="1.5"/><line x1="56" y1="${y}" x2="346" y2="${y}" stroke="#d5d1c7" stroke-width="1.2"/>`,
        )
        .join("")}
    </svg>`,
  )
}

function watchingWidget(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260">
      <defs>
        <pattern id="pw" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="#eed4de" stroke-width="1"/></pattern>
        <filter id="s" x="-10%" y="-10%" width="125%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity=".18"/></filter>
      </defs>
      <g filter="url(#s)"><rect x="10" y="10" width="240" height="240" rx="8" fill="#faedf2"/></g>
      <rect x="10" y="10" width="240" height="240" rx="8" fill="url(#pw)"/>
      <rect x="52" y="24" width="156" height="32" rx="16" fill="#f3b8d0"/>
      <text x="130" y="46" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#4f2d3b">+ Watching</text>
      ${[96, 134, 172, 210]
        .map((y) => `<text x="34" y="${y}" font-family="system-ui,sans-serif" font-size="16" fill="#c06c8e">✦</text><line x1="56" y1="${y + 4}" x2="228" y2="${y + 4}" stroke="#e7bfd0" stroke-width="1.4"/>`)
        .join("")}
    </svg>`,
  )
}

// ---- Coffee, Food & Lifestyle Stickers ------------------------------------
function coffeeCup(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="190" viewBox="0 0 180 190">
      <path d="M62 36 Q54 22 64 12 M86 36 Q78 20 88 10 M110 36 Q102 22 112 12" fill="none" stroke="#3a332d" stroke-width="4" stroke-linecap="round"/>
      <path d="M36 56 H132 V128 A42 42 0 0 1 36 128 Z" fill="#fff" stroke="#2c2623" stroke-width="5"/>
      <ellipse cx="84" cy="56" rx="48" ry="11" fill="#6b442a" stroke="#2c2623" stroke-width="4"/>
      <path d="M132 72 C158 72 158 112 130 112" fill="none" stroke="#2c2623" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="84" cy="166" rx="64" ry="12" fill="#e9e1d4" stroke="#2c2623" stroke-width="4"/>
    </svg>`,
  )
}

function takeawayCoffee(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="170" height="230" viewBox="0 0 170 230">
      <rect x="64" y="10" width="42" height="14" rx="4" fill="#2c6e63"/>
      <path d="M30 24 H140 L146 44 H24 Z" fill="#3a8b7d"/>
      <path d="M34 44 H136 L122 212 H48 Z" fill="#f4ecd8" stroke="#d4c7ac" stroke-width="2"/>
      <path d="M38 88 H132 L126 164 H44 Z" fill="#e7d6b5"/>
      <ellipse cx="85" cy="126" rx="22" ry="16" fill="#7b4b2a"/>
      <path d="M72 124 Q85 114 98 128" fill="none" stroke="#f4ecd8" stroke-width="3" stroke-linecap="round"/>
      <text x="85" y="196" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#6d5642">CAFÉ</text>
    </svg>`,
  )
}

function avocadoToast(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="210" viewBox="0 0 210 210">
      <path d="M34 90 C28 54 62 34 105 38 C148 34 182 54 176 90 L166 172 C164 186 46 186 44 172 Z" fill="#d9a15b" stroke="#8f5b28" stroke-width="5"/>
      <path d="M46 94 C42 66 68 50 105 52 C142 50 168 66 164 94 L156 162 H54 Z" fill="#f3dcb2"/>
      <ellipse cx="105" cy="116" rx="48" ry="38" fill="#89b846"/>
      <ellipse cx="92" cy="108" rx="28" ry="20" fill="#fffdf7"/>
      <circle cx="94" cy="108" r="13" fill="#f7b529"/>
      <circle cx="90" cy="104" r="4" fill="#ffe18c"/>
    </svg>`,
  )
}

function ramenBowl(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
      <circle cx="110" cy="110" r="94" fill="#e9e4d9" stroke="#5e574e" stroke-width="4"/>
      <circle cx="110" cy="110" r="78" fill="#e8b85b"/>
      <path d="M52 106 Q80 86 110 106 T168 106 M58 124 Q86 104 114 124 T166 124" fill="none" stroke="#f7dc88" stroke-width="7" stroke-linecap="round"/>
      <ellipse cx="128" cy="96" rx="24" ry="18" fill="#fff"/>
      <circle cx="128" cy="96" r="11" fill="#f59e0b"/>
      <circle cx="76" cy="90" r="16" fill="#4f9d53"/>
      <rect x="132" y="128" width="28" height="22" rx="4" fill="#f48fb1" stroke="#fff" stroke-width="2"/>
    </svg>`,
  )
}

function cuteApple(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="190" viewBox="0 0 180 190">
      <path d="M90 38 Q94 16 110 14" fill="none" stroke="#6b4423" stroke-width="6" stroke-linecap="round"/>
      <path d="M92 34 C112 16 136 22 128 40 C114 48 96 42 92 34 Z" fill="#6ec052"/>
      <path d="M90 46 C52 30 24 64 30 112 C36 156 66 174 90 166 C114 174 144 156 150 112 C156 64 128 30 90 46 Z" fill="#ef4444"/>
      <circle cx="68" cy="98" r="5" fill="#2b1d1d"/><circle cx="112" cy="98" r="5" fill="#2b1d1d"/>
      <path d="M78 114 Q90 124 102 114" fill="none" stroke="#2b1d1d" stroke-width="4" stroke-linecap="round"/>
    </svg>`,
  )
}

function laptopDoodle(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="190" viewBox="0 0 230 190">
      <polygon points="44,24 188,24 176,118 32,118" fill="#2b2d38" stroke="#181920" stroke-width="5" stroke-linejoin="round"/>
      <polygon points="52,32 178,32 168,110 42,110" fill="#f3f5f8"/>
      <polygon points="32,118 176,118 206,158 14,158" fill="#d9dde4" stroke="#181920" stroke-width="5" stroke-linejoin="round"/>
      <polygon points="46,126 164,126 178,144 34,144" fill="#9ca3af"/>
    </svg>`,
  )
}

function sofaCozy(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="170" viewBox="0 0 260 170">
      <rect x="34" y="42" width="192" height="72" rx="20" fill="#c98b5b"/>
      <rect x="20" y="72" width="34" height="62" rx="14" fill="#b47547"/>
      <rect x="206" y="72" width="34" height="62" rx="14" fill="#b47547"/>
      <rect x="44" y="92" width="172" height="42" rx="10" fill="#d99f72"/>
      <path d="M62 42 H104 L96 124 H54 Z" fill="#8b7bb8" opacity=".9"/>
      <rect x="36" y="134" width="10" height="18" rx="3" fill="#5c3d24"/>
      <rect x="214" y="134" width="10" height="18" rx="3" fill="#5c3d24"/>
    </svg>`,
  )
}

function sakuraFlower(c1 = "#fbcfe8", c2 = "#f472b6"): string {
  const petals = [0, 72, 144, 216, 288]
    .map(
      (deg) =>
        `<path d="M80 80 C62 48 66 20 80 18 C94 20 98 48 80 80 Z" fill="${c1}" stroke="${c2}" stroke-width="1.2" transform="rotate(${deg} 80 80)"/>`,
    )
    .join("")
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">${petals}<circle cx="80" cy="80" r="12" fill="#fde047"/><circle cx="76" cy="76" r="2" fill="#be185d"/><circle cx="84" cy="76" r="2" fill="#be185d"/><circle cx="80" cy="85" r="2" fill="#be185d"/></svg>`,
  )
}

function reminderFlag(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="130" viewBox="0 0 120 130">
      <path d="M24 14 H96 V114 L60 92 L24 114 Z" fill="#ff7d6b" stroke="#2c2422" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="48" cy="52" r="4" fill="#2c2422"/><circle cx="72" cy="52" r="4" fill="#2c2422"/>
      <path d="M54 64 Q60 70 66 64" fill="none" stroke="#2c2422" stroke-width="3.5" stroke-linecap="round"/>
    </svg>`,
  )
}

function envelopeBadge(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="140" viewBox="0 0 180 140">${SHADOW}
      <g filter="url(#s)"><rect x="14" y="28" width="146" height="96" rx="14" fill="#dbeafe" stroke="#93c5fd" stroke-width="3"/></g>
      <path d="M18 34 L87 84 L156 34" fill="none" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="152" cy="30" r="18" fill="#ef4444"/><text x="152" y="36" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" font-weight="800" fill="#fff">1</text>
    </svg>`,
  )
}

function checkDoodle(): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="140" viewBox="0 0 190 140">
      <rect x="20" y="24" width="44" height="44" rx="6" fill="none" stroke="#1f1f24" stroke-width="5"/>
      <path d="M26 42 L42 60 L72 18" fill="none" stroke="#e11d48" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="96" cy="48" r="14" fill="none" stroke="#1f1f24" stroke-width="5"/><circle cx="96" cy="48" r="4" fill="#1f1f24"/>
      <circle cx="144" cy="48" r="14" fill="none" stroke="#1f1f24" stroke-width="5"/><circle cx="144" cy="48" r="4" fill="#1f1f24"/>
      <path d="M110 66 Q120 78 130 66" fill="none" stroke="#1f1f24" stroke-width="5" stroke-linecap="round"/>
      <text x="95" y="118" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="34" letter-spacing="2" fill="#1f1f24">CHECK</text>
    </svg>`,
  )
}

// ---- Hand-drawn Arrows & Tag Badges ----------------------------------------
function curvedArrow(color = "#1f1f24", flip = false): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">
      <g ${flip ? 'transform="scale(-1,1) translate(-160,0)"' : ""}>
        <path d="M20 96 C26 48 64 24 128 32" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/>
        <path d="M106 16 L134 32 L110 52" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg>`,
  )
}

function loopArrow(color = "#1f1f24"): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
      <path d="M36 122 C28 84 82 64 88 86 C94 108 54 108 56 76 C58 46 88 30 112 28" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/>
      <path d="M94 14 L118 28 L98 46" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  )
}

function tagBadge(label: string, bg: string, fg: string, radius = 16): string {
  const w = Math.max(170, label.length * 14 + 44)
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="52" viewBox="0 0 ${w} 52">
      <rect x="2" y="4" width="${w - 4}" height="44" rx="${radius}" fill="${bg}"/>
      <text x="${w / 2}" y="33" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="21" fill="${fg}">${label}</text>
    </svg>`,
  )
}

function locationTag(place: string): string {
  const w = Math.max(190, place.length * 13 + 64)
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="56" viewBox="0 0 ${w} 56">${SHADOW}
      <g filter="url(#s)"><rect x="4" y="6" width="${w - 8}" height="42" rx="14" fill="#fff"/></g>
      <circle cx="28" cy="24" r="7" fill="#ea580c"/><circle cx="28" cy="23" r="2.5" fill="#fff"/>
      <text x="46" y="33" font-family="system-ui,sans-serif" font-weight="800" font-size="16" letter-spacing="1" fill="#475569">${place}</text>
    </svg>`,
  )
}

export const DECOR: DecorGroup[] = [
  {
    id: "widgets",
    group: "Planner Widgets",
    items: [
      mk("w_mood", "Mood Tracker", 300, 222, moodWidget(), "widget"),
      mk("w_clock", "24-Hour Clock", 280, 280, clock24Widget(), "widget"),
      mk("w_todo", "To-Do Priority", 320, 226, todoPriorityWidget(), "widget"),
      mk("w_today", "Today's Tasks", 270, 270, todayTaskWidget(), "widget"),
      mk("w_read", "Currently Reading", 340, 160, readingWidget(), "widget"),
      mk("w_next", "Note for Next Week", 350, 202, nextWeekNotesWidget(), "widget"),
      mk("w_watch", "Watch List", 240, 240, watchingWidget(), "widget"),
    ],
  },
  {
    id: "notes",
    group: "Notes & Labels",
    items: [
      mk("gn_notes", "NOTES (Purple Grid)", 260, 276, gridNote("#5e5a78", "#746f91", "#c5b6e8", "NOTES", "#ffffff")),
      mk("gn_forget", "DON'T FORGET", 260, 276, gridNote("#eef4fa", "#d8e6f4", "#7b8eb8", "DON'T FORGET", "#394867")),
      mk("n_lime", "Green Note", 260, 260, limeDotNote()),
      ...["#fff4a8", "#ffd1dc", "#cfe8ff", "#d9ccf3", "#ccefd5", "#ffe1b8"].map((c, i) =>
        mk("n" + i, "Post-it Note", 260, 260, note(c)),
      ),
      ...["#fbf8f1", "#f1ede2", "#e9e3d4"].map((c, i) => mk("r" + i, "Torn Paper", 320, 216, torn(c))),
      ...["#f4b6c2", "#f9cfa5", "#f6e58d", "#b8e0c0", "#a9d6e5", "#cbb7ea"].map((c, i) =>
        mk("p" + i, "Label", 240, 68, pill(c)),
      ),
    ],
  },
  {
    id: "tapes",
    group: "Tape, Pins & Clips",
    items: [
      mk("pin_red", "Red Pin", 72, 82, pushPin("#ef4444", "#991b1b")),
      mk("pin_blue", "Blue Pin", 72, 82, pushPin("#3b82f6", "#1e40af")),
      mk("pin_gold", "Yellow Pin", 72, 82, pushPin("#f59e0b", "#92400e")),
      mk("clip_gold", "Gold Paperclip", 64, 110, paperClip()),
      mk("dt_pink", "Dotted Tape Pink", 58, 58, dotTape("#f4a6b8")),
      mk("dt_green", "Dotted Tape Green", 58, 58, dotTape("#a9dcb4")),
      mk("dt_yellow", "Dotted Tape Yellow", 58, 58, dotTape("#f6d95e")),
      mk("dt_blue", "Dotted Tape Blue", 58, 58, dotTape("#8fc7e8")),
      mk("t1", "Pink striped", 240, 58, tape("#f4a6b8", "stripes")),
      mk("t2", "Yellow polka dot", 240, 58, tape("#f6d95e", "dots")),
      mk("t3", "Mint solid", 240, 58, tape("#a9dcb4", "solid")),
      mk("t4", "Blue plaid", 240, 58, tape("#8fc7e8", "gingham")),
      mk("t5", "Lilac polka dot", 240, 58, tape("#c0a6e8", "dots")),
      mk("t6", "Sakura tape", 240, 58, tape("#f8c8d8", "sakura")),
      mk("t7", "Kraft tape", 240, 58, tape("#d9b98c", "solid")),
    ],
  },
  {
    id: "food",
    group: "Coffee & Food",
    items: [
      mk("f_cup", "Coffee Mug", 145, 152, coffeeCup()),
      mk("f_cafe", "Takeaway Coffee", 136, 184, takeawayCoffee()),
      mk("f_avo", "Avocado Toast", 168, 168, avocadoToast()),
      mk("f_ramen", "Ramen Bowl", 176, 176, ramenBowl()),
      mk("f_apple", "Smiling Apple", 140, 148, cuteApple()),
    ],
  },
  {
    id: "life",
    group: "Life, Work & Nature",
    items: [
      mk("l_laptop", "Laptop", 190, 156, laptopDoodle()),
      mk("l_sofa", "Cozy Sofa", 220, 144, sofaCozy()),
      mk("l_sakura1", "Sakura Pink", 124, 124, sakuraFlower("#fbcfe8", "#f472b6")),
      mk("l_sakura2", "Sakura Light", 124, 124, sakuraFlower("#fce7f3", "#f9a8d4")),
      mk("l_rem", "Bookmark Reminder", 104, 114, reminderFlag()),
      mk("l_mail", "New Message", 150, 118, envelopeBadge()),
      mk("l_chk", "CHECK Doodle", 160, 118, checkDoodle()),
    ],
  },
  {
    id: "arrows",
    group: "Titles & Arrows",
    items: [
      mk("a_blk", "Curly Arrow (Black)", 130, 98, curvedArrow("#1f1f24")),
      mk("a_blk_f", "Curly Arrow (Reverse)", 130, 98, curvedArrow("#1f1f24", true)),
      mk("a_grn", "Curly Arrow (Green)", 130, 98, curvedArrow("#65a30d")),
      mk("a_loop", "Loop Arrow", 120, 120, loopArrow("#1f1f24")),
      mk("b_slow", "slow morning", 185, 48, tagBadge("slow morning", "#fbcfe8", "#6d2849", 24)),
      mk("b_high", "High priority", 185, 48, tagBadge("High priority", "#fecaca", "#7f1d1d", 24)),
      mk("b_low", "Low priority", 180, 48, tagBadge("Low priority", "#fef08a", "#713f12", 24)),
      mk("b_imp", "important", 170, 48, tagBadge("important", "#fed7aa", "#7c2d12", 24)),
      mk("b_pers", "Personal", 170, 48, tagBadge("Personal", "#c7d2fe", "#1e1b4b", 24)),
      mk("b_work", "work on", 165, 48, tagBadge("work on", "#dbeafe", "#1e3a8a", 24)),
      mk("b_due", "due today", 175, 48, tagBadge("due today", "#e0e7ff", "#312e81", 24)),
      mk("b_meal", "Meal Plan", 180, 48, tagBadge("Meal Plan", "#e9d5ff", "#4c1d95", 8)),
      mk("b_notes", "WEEKLY NOTES", 190, 48, tagBadge("WEEKLY NOTES", "#fde68a", "#78350f", 24)),
      mk("b_loc", "Location Tag", 195, 50, locationTag("KIBO NO KI")),
    ],
  },
]
