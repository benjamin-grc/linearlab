const EPS = 1e-10;

let coeffInputs = [];
let rhsInputs = [];

// Convertit un nombre en LaTeX (fraction si nécessaire)
function fractionLatex(x) {
  try {
    const f = math.fraction(x);
    return f.d === 1 ? `${f.n}` : `\\frac{${f.n}}{${f.d}}`;
  } catch {
    return `${x}`;
  }
}

function approxString(value) {
  if (!isFinite(value)) return value.toString();
  return Number(value.toFixed(4)).toString();
}

function latexText(str) {
  return str.replace(/([{}])/g, "\\$1");
}

function alignedLatex(lines) {
  if (!lines.length) return "";
  return `\\begin{aligned} ${lines.join(" \\\\ ")} \\end{aligned}`;
}

function alignedEqualsLatex(lines) {
  if (!lines.length) return "";

  const processed = lines.map(line => {
    const idx = line.indexOf("=");
    if (idx === -1) {
      return `&${line}`;
    }

    const left = line.slice(0, idx).trim();
    const right = line.slice(idx + 1).trim();
    return `${left} &= ${right}`;
  });

  return alignedLatex(processed);
}

function displayLatex(lines) {
  const result = document.getElementById("result");
  if (!result) return;

  const blocks = lines
    .filter(line => !!line)
    .map(line => `<div class="math-line">\\[${line}\\]</div>`)
    .join("");

  result.innerHTML = blocks || "";

  if (window.MathJax && typeof MathJax.typesetPromise === "function") {
    MathJax.typesetPromise([result]).catch(err => console.error(err));
  }
}

// Récupère m et n à partir des inputs
function getDimensions() {
  const mInput = document.getElementById('m');
  const nInput = document.getElementById('n');

  if (!mInput || !nInput) {
    return { m: NaN, n: NaN };
  }

  const m = parseInt(mInput.value);
  const n = parseInt(nInput.value);
  return { m, n };
}

// Génère la grille des coefficients (m x n) + b
function generateSystem() {
  const { m, n } = getDimensions();
  const container = document.getElementById('systemContainer');
  const resultDiv = document.getElementById('result');

  if (!container) return;
  if (resultDiv) resultDiv.textContent = "";

  if (isNaN(m) || isNaN(n) || m <= 0 || n <= 0) {
    container.innerHTML = "Merci d'entrer m ≥ 1 et n ≥ 1.";
    return;
  }

  let html = '<table><tr>';
  for (let j = 0; j < n; j++) {
    html += `<th>a<sub>•${j + 1}</sub></th>`;
  }
  html += `<th>b</th></tr>`;

  for (let i = 0; i < m; i++) {
    html += '<tr>';
    for (let j = 0; j < n; j++) {
      html += `<td><input type="number" step="any" id="a_${i}_${j}" value="0"></td>`;
    }
    html += `<td><input type="number" step="any" id="b_${i}" value="0"></td>`;
    html += '</tr>';
  }
  html += '</table>';

  container.innerHTML = html;

  coeffInputs = Array.from({ length: m }, () => Array(n).fill(null));
  rhsInputs = Array(m).fill(null);

  const rows = container.querySelectorAll('table tr');
  rows.forEach((row, index) => {
    if (index === 0) return; // skip header
    const inputs = Array.from(row.querySelectorAll('input'));
    const coeffRow = inputs.slice(0, n);
    const rhs = inputs[n];
    coeffInputs[index - 1] = coeffRow;
    rhsInputs[index - 1] = rhs;
  });
}

// Exemple aléatoire
function generateExample() {
  const { m, n } = getDimensions();
  const resultDiv = document.getElementById('result');

  if (isNaN(m) || isNaN(n) || m <= 0 || n <= 0) {
    if (resultDiv) resultDiv.textContent = "Choisissez d'abord m ≥ 1 et n ≥ 1.";
    return;
  }

  const needsInit =
    !coeffInputs.length ||
    coeffInputs.length !== m ||
    coeffInputs.some(row => !row || row.length !== n) ||
    rhsInputs.length !== m ||
    rhsInputs.some(input => !input);

  if (needsInit) {
    generateSystem();
  }

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let v = Math.floor(Math.random() * 11) - 5; // -5..5
      if (v === 0) v = 1;
      coeffInputs[i][j].value = v;
    }
    rhsInputs[i].value = Math.floor(Math.random() * 21) - 10;
  }

  if (resultDiv) resultDiv.textContent = "";
}

// Formate une expression symbolique pour LaTeX (constante + somme coeff * xk)
function formatExprLatex(expr) {
  const parts = [];
  let first = true;

  if (Math.abs(expr.constant) > EPS) {
    const val = expr.constant;
    const absVal = Math.abs(val);
    const signStr = val < 0 ? "-" : "";
    parts.push(`${signStr}${fractionLatex(absVal)}`);
    first = false;
  }

  const vars = Object.keys(expr.deps).sort();
  for (const v of vars) {
    const coeff = expr.deps[v];
    if (Math.abs(coeff) < EPS) continue;

    const isNeg = coeff < 0;
    const absCoeff = Math.abs(coeff);
    const needsCoeff = Math.abs(absCoeff - 1) >= EPS;

    const signStr = first ? (isNeg ? "-" : "") : (isNeg ? " - " : " + ");
    const coeffStr = needsCoeff ? `${fractionLatex(absCoeff)}\\,` : "";
    const varLatex = v.replace(/x(\d+)/, "x_{$1}");

    parts.push(`${signStr}${coeffStr}${varLatex}`);
    first = false;
  }

  if (parts.length === 0) return "0";
  return parts.join("");
}

// Résout le système m×n
function solveSystem() {
  const { m, n } = getDimensions();
  const result = document.getElementById("result");
  const container = document.getElementById("systemContainer");

  if (!result || !container) return;
  result.textContent = "";

  if (isNaN(m) || isNaN(n) || m <= 0 || n <= 0) {
    result.textContent = "Veuillez d'abord créer un système valide (m, n).";
    return;
  }

  if (
    !coeffInputs.length ||
    coeffInputs.length !== m ||
    coeffInputs.some(row => !row || row.length !== n) ||
    rhsInputs.length !== m ||
    rhsInputs.some(input => !input)
  ) {
    result.textContent = "Veuillez d'abord générer le système.";
    return;
  }

  // matrice augmentée A|b
  let A = [];
  try {
    for (let i = 0; i < m; i++) {
      let row = [];
      for (let j = 0; j < n; j++) {
        const v = parseFloat(coeffInputs[i][j].value);
        if (isNaN(v)) throw new Error("Coefficient invalide");
        row.push(v);
      }
      const bi = parseFloat(rhsInputs[i].value);
      if (isNaN(bi)) throw new Error("Second membre invalide");
      row.push(bi);
      A.push(row);
    }
  } catch (e) {
    result.textContent = "❌ Erreur : coefficient ou second membre invalide.";
    return;
  }

  // Élimination de Gauss
  let row = 0;
  for (let col = 0; col < n && row < m; col++) {
    let pivotRow = row;
    for (let i = row + 1; i < m; i++) {
      if (Math.abs(A[i][col]) > Math.abs(A[pivotRow][col])) {
        pivotRow = i;
      }
    }

    if (Math.abs(A[pivotRow][col]) < EPS) continue;

    [A[row], A[pivotRow]] = [A[pivotRow], A[row]];

    let pivot = A[row][col];
    for (let i = row + 1; i < m; i++) {
      let f = A[i][col] / pivot;
      for (let j = col; j <= n; j++) {
        A[i][j] -= f * A[row][j];
      }
    }
    row++;
  }

  // rang(A), rang(A|b)
  let rankA = 0, rankAug = 0;
  for (let i = 0; i < m; i++) {
    let nzA = false, nzAug = false;
    for (let j = 0; j < n; j++) {
      if (Math.abs(A[i][j]) > EPS) {
        nzA = true;
        nzAug = true;
      }
    }
    if (Math.abs(A[i][n]) > EPS) nzAug = true;

    if (nzA) rankA++;
    if (nzAug) rankAug++;
  }

  const latexLines = [];
  latexLines.push(`\\operatorname{rang}(A) = ${rankA}`);
  latexLines.push(`\\operatorname{rang}(A\\mid b) = ${rankAug}`);

  // cas : aucune solution
  if (rankAug > rankA) {
    latexLines.push(`\\text{${latexText("Le système est incompatible : aucune solution.")}}`);
    displayLatex(latexLines);
    return;
  }

  // cas : solution unique (rangA = n)
  if (rankA === n) {
    latexLines.push(`\\text{${latexText("Le système admet une solution unique.")}}`);

    let x = Array(n).fill(0);

    for (let i = m - 1; i >= 0; i--) {
      let pivotCol = -1;
      for (let j = 0; j < n; j++) {
        if (Math.abs(A[i][j]) > EPS) {
          pivotCol = j;
          break;
        }
      }
      if (pivotCol === -1) continue;

      let sum = A[i][n];
      for (let j = pivotCol + 1; j < n; j++) {
        sum -= A[i][j] * x[j];
      }
      x[pivotCol] = sum / A[i][pivotCol];
    }

    const solutionLines = [];
    for (let j = 0; j < n; j++) {
      solutionLines.push(`x_{${j + 1}} = ${fractionLatex(x[j])}\\quad (\\approx ${approxString(x[j])})`);
    }

    latexLines.push(alignedEqualsLatex(solutionLines));
    displayLatex(latexLines);
    return;
  }

  // cas : infinité de solutions
  latexLines.push(`\\text{${latexText("Le système admet une infinité de solutions.")}}`);

  const pivotColForRow = Array(m).fill(-1);
  const isPivotCol = Array(n).fill(false);

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(A[i][j]) > EPS) {
        pivotColForRow[i] = j;
        isPivotCol[j] = true;
        break;
      }
    }
  }

  const freeCols = [];
  for (let j = 0; j < n; j++) {
    if (!isPivotCol[j]) freeCols.push(j);
  }

  if (freeCols.length > 0) {
    const freeLines = freeCols.map(c => `x_{${c + 1}} \\text{ libre}`);
    latexLines.push(alignedLatex(freeLines));
  }

  // expr[j] = { constant, deps: { "xk": coeff } }
  const expr = [];
  for (let j = 0; j < n; j++) {
    expr[j] = { constant: 0, deps: {} };
  }

  // variables libres : xj = xj
  for (const col of freeCols) {
    expr[col].deps[`x${col + 1}`] = 1;
  }

  // back-substitution symbolique
  for (let i = m - 1; i >= 0; i--) {
    let pc = pivotColForRow[i];
    if (pc === -1) continue;
    let pivot = A[i][pc];
    if (Math.abs(pivot) < EPS) continue;

    let constant = A[i][n];
    let deps = {};

    for (let j = pc + 1; j < n; j++) {
      if (Math.abs(A[i][j]) > EPS) {
        let coef = A[i][j];
        constant -= coef * expr[j].constant;
        for (let v in expr[j].deps) {
          deps[v] = (deps[v] || 0) - coef * expr[j].deps[v];
        }
      }
    }

    constant /= pivot;
    for (let v in deps) {
      deps[v] /= pivot;
    }

    expr[pc].constant = constant;
    expr[pc].deps = deps;
  }

  // affichage des xj
  const exprLines = [];
  for (let j = 0; j < n; j++) {
    exprLines.push(`x_{${j + 1}} = ${formatExprLatex(expr[j])}`);
  }

  latexLines.push(alignedEqualsLatex(exprLines));
  displayLatex(latexLines);
}

// Générer un système au chargement (si m et n existent déjà)
window.addEventListener('load', () => {
  const mInput = document.getElementById('m');
  const nInput = document.getElementById('n');
  if (mInput && nInput) {
    generateSystem();
  }
});
