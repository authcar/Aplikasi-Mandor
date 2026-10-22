// Garis tipis bercahaya berbentuk siluet kota, hiasan kartu Progres. Murni dekoratif.
const GEDUNG = [
  "M20 110V84H52V110", "M62 110V54H102V110M72 54V42H92V54", "M112 110V72H142L152 62V110",
  "M162 110V32H206V110M184 32V10", "M216 110V62H250V110", "M262 110V42H310V110",
  "M322 110V78H350V110", "M362 110V22H410V110M386 22V12", "M420 110V66H455V110",
  "M465 110V46H520V110", "M530 110V86H575V110",
];
// Jendela: [x, y, panjang]
const JENDELA = [
  [72, 66, 10], [88, 78, 8], [172, 46, 12], [190, 62, 10], [172, 84, 14], [272, 58, 12], [292, 74, 10],
  [372, 38, 12], [390, 56, 10], [372, 82, 14], [478, 62, 12], [498, 80, 10], [226, 78, 10], [122, 88, 10],
];

export default function KotaGlow() {
  return (
    <svg className="kota" viewBox="0 0 600 120" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
      <g className="kota-garis">
        <path d="M0 110H600" style={{ "--i": 0 }} />
        {GEDUNG.map((d, n) => <path key={n} d={d} style={{ "--i": n + 1 }} />)}
      </g>
      <g className="kota-jendela">
        {JENDELA.map(([x, y, w], n) => (
          <path key={n} d={`M${x} ${y}h${w}`} style={{ "--d": `${(n * 0.7) % 5}s` }} />
        ))}
      </g>
    </svg>
  );
}
