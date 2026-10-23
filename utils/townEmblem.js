/** An eight-point star, the Libot logo's: long rays on the compass points. */
export function starPath(cx, cy, long, short, waist) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI / 8) * i - Math.PI / 2;
    const r = i % 4 === 0 ? long : i % 2 === 0 ? short : waist;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}
