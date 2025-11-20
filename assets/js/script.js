// ---------------------- Web Worker ----------------------

let matrixWorker = null;
let useFractions = true; // affichage fraction par défaut



if (window.Worker) {
  matrixWorker = new Worker("../assets/js/worker.js");

  matrixWorker.onmessage = function (e) {
    const { ok, op, result, error, label } = e.data;

    if (!ok) {
      appendResultHTML("<span style='color:red;'>Erreur (" + op + ") : " + error + "</span>");
      return;
    }

    switch (op) {
      case "inverse":
        lastResultMatrix = result;
        texMatResult(`\\( ${label}^{-1} \\)`, result);
        break;

      case "det":
        appendResultHTML(`déterminant de ${label} = ${result}`);
        break;

      case "power":
        lastResultMatrix = result;
        texMatResult(`\\( ${label}^{${document.getElementById("powerN").value}} \\)`, result);
        break;

      case "scale":
        lastResultMatrix = result;
        texMatResult(`\\( ${document.getElementById("scale").value}\\,${label} \\)`, result);
        break;

      case "sum":
        lastResultMatrix = result;
        texMatResult(`\\( A+B \\)`, result);
        break;

      case "sub":
        lastResultMatrix = result;
        texMatResult(`\\( A-B \\)`, result);
        break;

      case "times":
        lastResultMatrix = result;
        texMatResult(`\\( AB \\)`, result);
        break;

      case "lu":
        // ici result = { L, U }
        lastResultMatrix = result.U; 
        texMatResult("L", result.L);
        texMatResult("U", result.U);
        break;

      case "rang":
        appendResultHTML(`rang de ${label} = ${result}`);
        break;
    }
  };
}

// ---------------------- Text Input ----------------------

// Affiche / cache la zone de texte pour A ou B
function toggleTextMode(matrixId) {
  const div = document.getElementById('text' + matrixId);
  if (!div) return;

  const isHidden = (div.style.display === 'none' || div.style.display === '');
  div.style.display = isHidden ? 'flex' : 'none';
}

// Lit le texte, le transforme en matrice et génère les inputs
function applyTextMatrix(matrixId) {
  const textarea = document.getElementById('textarea' + matrixId);
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) {
    alert("La zone de texte est vide.");
    return;
  }

  // Découpage en lignes
  const rowsText = text.split(/\n+/);
  const matrix = [];
  let nbCols = null;

  for (let r = 0; r < rowsText.length; r++) {
    const row = rowsText[r].trim();
    if (row === "") continue;

    // Découpage par espaces (un ou plusieurs)
    const parts = row.split(/\s+/);
    if (nbCols === null) {
      nbCols = parts.length;
    } else if (parts.length !== nbCols) {
      alert("Toutes les lignes doivent avoir le même nombre de colonnes.");
      return;
    }

    const nums = parts.map((p, i) => {
      const v = parseCell(p); // gère aussi bien 1/4 que 0,25 ou -2/3
      if (Number.isNaN(v)) {
        alert(`Valeur invalide "${p}" à la ligne ${r + 1}, colonne ${i + 1}.`);
        throw new Error("Invalid number");
      }
      return v;
    });
    

    matrix.push(nums);
  }

  if (matrix.length === 0) {
    alert("Aucune ligne valide trouvée.");
    return;
  }

  // Met à jour les champs taille
  const liInput  = document.getElementById('li' + matrixId);
  const clInput  = document.getElementById('cl' + matrixId);
  liInput.value = matrix.length;
  clInput.value = nbCols;

  // Génére la table d'inputs dans matA ou matB
  buildMatrixFromArray(matrixId, matrix);
}

// Construit la matrice HTML à partir d'un tableau JS
function buildMatrixFromArray(matrixId, data) {
  const container = document.getElementById('mat' + matrixId);
  if (!container) return;

  const rows = data.length;
  const cols = data[0].length;

  let html = '<table class="matrix-table">';
  for (let i = 0; i < rows; i++) {
    html += '<tr>';
    for (let j = 0; j < cols; j++) {
      html += `<td><input type="text" inputmode="decimal" id="${matrixId}_${i}_${j}" value="${data[i][j]}"></td>`;

    }
    html += '</tr>';
  }
  html += '</table>';

  container.innerHTML = html;
}



// ---------------------- Utilitaires d'affichage ----------------------

function appendResultHTML(html) {
  const res = document.getElementById("res");
  if (!res) return;

  const div = document.createElement("div");
  div.className = "result-item";
  div.innerHTML = html;

  // On ajoute en haut (dernier résultat en premier)
  if (res.firstChild) {
    res.insertBefore(div, res.firstChild);
  } else {
    res.appendChild(div);
  }

  // Option : limiter le nombre de résultats (ici 30)
  while (res.children.length > 30) {
    res.removeChild(res.lastChild);
  }

  // Re-rendu MathJax uniquement sur le nouveau bloc
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([div]);
  }
}

// Affichage LaTeX d'une matrice
function texMatResult(label, matrix) {
  const li = matrix.length;
  let latex = label + " = \\(\\begin{bmatrix}";

  for (let i = 0; i < li; i++) {
    const row = matrix[i].map(formatEntryForLatex).join(" & ");
    latex += row;
    if (i < li - 1) latex += " \\\\ ";
  }

  latex += "\\end{bmatrix} \\)";
  appendResultHTML(latex);
}


// Formate un nombre (ou fraction math.js) en LaTeX, avec fraction si possible
function formatEntryForLatex(x) {
  // Si l'utilisateur ne veut PAS les fractions alors décimal direct
  if (!useFractions) {
    if (typeof x === "number") {
      return math.format(x, { notation: "fixed", precision: 4 });
    }
    return String(x);
  }

  // --- Mode FRACTION activé ---

  // 1) Valeur fraction math.js
  if (typeof math !== "undefined" && math.isFraction && math.isFraction(x)) {
    if (x.d === 1) return String(x.n);
    return `\\dfrac{${x.n}}{${x.d}}`;
  }

  // 2) Nombre classique
  if (typeof x === "number") {
    if (Math.abs(x) < 1e-12) return "0";

    const r = Math.round(x);
    if (Math.abs(x - r) < 1e-10) return String(r);

    try {
      const frac = math.fraction(x);
      if (frac.d <= 1000) {
        return `\\dfrac{${frac.n}}{${frac.d}}`;
      }
    } catch (e) {}

    return math.format(x, { notation: "fixed", precision: 4 });
  }

  return String(x);
}


function toggleFractions() {
  useFractions = !useFractions;
  const btn = document.getElementById("toggleFractionBtn");
  btn.textContent = "Fractions : " + (useFractions ? "ON" : "OFF");

}



// ---------------------- Génération des matrices ----------------------

function generateA() {
  let li = parseInt(document.getElementById("liA").value);
  let cl = parseInt(document.getElementById("clA").value);

  let html = "<table class='matrix-table'>";

  for (let i = 0; i < li; i++) {
    html += "<tr>";
    for (let j = 0; j < cl; j++) {
      html += "<td><input type='text' inputmode='decimal'></td>";
    }
    html += "</tr>";
  }

  html += "</table>";

  document.getElementById("matA").innerHTML = html;
}

function generateB() {
  let li = parseInt(document.getElementById("liB").value);
  let cl = parseInt(document.getElementById("clB").value);

  let html = "<table class='matrix-table'>";

  for (let i = 0; i < li; i++) {
    html += "<tr>";
    for (let j = 0; j < cl; j++) {
      html += "<td><input type='text' inputmode='decimal'></td>";
    }
    html += "</tr>";
  }

  html += "</table>";

  document.getElementById("matB").innerHTML = html;
}


// ---------------------- Récupération des matrices ----------------------

//Parsing des cellules (gère 1/4, 2/3, etc.)
function parseCell(str) {
  if (str == null) return NaN;
  str = String(str).trim();
  if (str === '') return 0; // case vide -> 0, à adapter si besoin

  // On tente d'utiliser math.js si disponible pour gérer des expressions comme "1/4"
  if (typeof math !== 'undefined' && math.evaluate) {
    try {
      return math.evaluate(str);
    } catch (e) {
      // si math.js n'arrive pas à parser, on retombe sur parseFloat
    }
  }

  const v = parseFloat(str.replace(',', '.'));
  return isNaN(v) ? NaN : v;
}


function getMatrixA() {
  const li = parseInt(document.getElementById("liA").value);
  const cl = parseInt(document.getElementById("clA").value);
  const inputs = document.querySelectorAll("#matA input");

  let matrix = [];
  for (let i = 0; i < li; i++) {
    matrix[i] = [];
    for (let j = 0; j < cl; j++) {
      const index = i * cl + j;
      const value = parseCell(inputs[index]?.value);
      matrix[i][j] = isNaN(value) ? 0 : value;
    }
  }
  return matrix;
}


function getMatrixB() {
  const li = parseInt(document.getElementById("liB").value);
  const cl = parseInt(document.getElementById("clB").value);
  const inputs = document.querySelectorAll("#matB input");

  let matrix = [];
  for (let i = 0; i < li; i++) {
    matrix[i] = [];
    for (let j = 0; j < cl; j++) {
      const index = i * cl + j;
      const value = parseCell(inputs[index]?.value);
      matrix[i][j] = isNaN(value) ? 0 : value;
    }
  }
  return matrix;
}


// ---------------------- Injection d'une matrice dans A ou B ----------------------

function setMatrixA(matrix) {
  const li = matrix.length;
  const cl = matrix[0]?.length || 0;

  document.getElementById("liA").value = li;
  document.getElementById("clA").value = cl;

  let html = "<table class='matrix-table'>";
  for (let i = 0; i < li; i++) {
    html += "<tr>";
    for (let j = 0; j < cl; j++) {
      const val = matrix[i][j] != null ? matrix[i][j] : 0;
      html += `<td><input type='number' value='${val}'></td>`;
    }
    html += "</tr>";
  }
  html += "</table>";
  document.getElementById("matA").innerHTML = html;
}

function setMatrixB(matrix) {
  const li = matrix.length;
  const cl = matrix[0]?.length || 0;

  document.getElementById("liB").value = li;
  document.getElementById("clB").value = cl;

  let html = "<table class='matrix-table'>";
  for (let i = 0; i < li; i++) {
    html += "<tr>";
    for (let j = 0; j < cl; j++) {
      const val = matrix[i][j] != null ? matrix[i][j] : 0;
      html += `<td><input type='number' value='${val}'></td>`;
    }
    html += "</tr>";
  }
  html += "</table>";
  document.getElementById("matB").innerHTML = html;
}

// Choix matrice A ou B
function matChoice() {
  let choice = document.getElementById("matrixChoice").value;
  if (choice === "A") {
    return [getMatrixA(), "A"];
  } else {
    return [getMatrixB(), "B"];
  }
}

// ---------------------- Fonction de rang locale (fallback) ----------------------

function computeRankLocal(A, eps = 1e-10) {
  const m = A.length;
  if (m === 0) return 0;
  const n = A[0].length;

  const M = A.map(row => row.slice());

  let rank = 0;
  let row = 0;
  let col = 0;

  while (row < m && col < n) {
    let pivotRow = row;
    let maxAbs = Math.abs(M[row][col]);

    for (let i = row + 1; i < m; i++) {
      const val = Math.abs(M[i][col]);
      if (val > maxAbs) {
        maxAbs = val;
        pivotRow = i;
      }
    }

    if (maxAbs < eps) {
      col++;
      continue;
    }

    if (pivotRow !== row) {
      const temp = M[row];
      M[row] = M[pivotRow];
      M[pivotRow] = temp;
    }

    const pivot = M[row][col];
    for (let j = col; j < n; j++) {
      M[row][j] /= pivot;
    }

    for (let i = 0; i < m; i++) {
      if (i !== row) {
        const factor = M[i][col];
        if (Math.abs(factor) > eps) {
          for (let j = col; j < n; j++) {
            M[i][j] -= factor * M[row][j];
          }
        }
      }
    }

    rank++;
    row++;
    col++;
  }

  return rank;
}

// ---------------------- Opérations matricielles ----------------------

function lu() {
  const [matrix, label] = matChoice();
  if (!matrix || matrix.length === 0) return;

  if (matrixWorker) {
    matrixWorker.postMessage({ op: "lu", matrix, label });
  } else {
    const lup = math.lup(matrix);
    lastResultMatrix = lup.U; // par exemple
    texMatResult("L", lup.L);
    texMatResult("U", lup.U);
  }
}

function transposeL() {
  const [matrix, label] = matChoice();
  if (!matrix || matrix.length === 0) return;

  const trans = math.transpose(matrix);
  lastResultMatrix = trans;
  texMatResult(`\\( ${label}^{T} \\)`, trans);
}

function power() {
  const [matrix, label] = matChoice();
  if (!matrix || matrix.length === 0) return;

  const p = parseFloat(document.getElementById("powerN").value);

  if (matrixWorker) {
    matrixWorker.postMessage({ op: "power", matrix, label, power: p });
  } else {
    const mpow = math.pow(matrix, p);
    lastResultMatrix = mpow;
    texMatResult(`\\( ${label}^{${p}} \\)`, mpow);
  }
}

function inverse() {
  const [matrix, label] = matChoice();
  if (!matrix || matrix.length === 0) return;

  const li = matrix.length;
  const cl = matrix[0].length;

  if (li !== cl) {
    appendResultHTML("<span style='color:red;'>Il faut une matrice carrée pour calculer l'inverse.</span>");
    return;
  }

  if (matrixWorker) {
    matrixWorker.postMessage({ op: "inverse", matrix, label });
  } else {
    try {
      const inv = math.inv(matrix);
      lastResultMatrix = inv;
      texMatResult(`\\( ${label}^{-1} \\)`, inv);
    } catch (err) {
      appendResultHTML("<span style='color:red;'>La matrice n'est pas inversible (det = 0).</span>");
    }
  }
}

function rang() {
  const [matrix, label] = matChoice();
  if (!matrix || matrix.length === 0) return;

  if (matrixWorker) {
    matrixWorker.postMessage({ op: "rang", matrix, label });
  } else {
    const r = computeRankLocal(matrix);
    appendResultHTML(`rang de ${label} = ${r}`);
  }
}

function determinant() {
  const [matrix, label] = matChoice();
  if (!matrix || matrix.length === 0) return;

  const li = matrix.length;
  const cl = matrix[0].length;

  if (li !== cl) {
    appendResultHTML("<span style='color:red;'>Il faut une matrice carrée.</span>");
    return;
  }

  if (matrixWorker) {
    matrixWorker.postMessage({ op: "det", matrix, label });
  } else {
    const det = math.det(matrix);
    appendResultHTML(`déterminant de ${label} = ${det}`);
  }
}

function matScale() {
  const [matrix, label] = matChoice();
  if (!matrix || matrix.length === 0) return;

  const lambda = parseFloat(document.getElementById("scale").value);

  if (matrixWorker) {
    matrixWorker.postMessage({ op: "scale", matrix, label, scalar: lambda });
  } else {
    const scaling = math.multiply(lambda, matrix);
    lastResultMatrix = scaling;
    texMatResult(`\\( ${lambda}\\,${label} \\)`, scaling);
  }
}

function sum() {
  const A = getMatrixA();
  const B = getMatrixB();

  if (matrixWorker) {
    matrixWorker.postMessage({ op: "sum", matrix: A, otherMatrix: B, label: "A+B" });
  } else {
    const S = math.add(A, B);
    lastResultMatrix = S;
    texMatResult("\\( A+B \\)", S);
  }
}

function sub() {
  const A = getMatrixA();
  const B = getMatrixB();

  if (matrixWorker) {
    matrixWorker.postMessage({ op: "sub", matrix: A, otherMatrix: B, label: "A-B" });
  } else {
    const R = math.subtract(A, B);
    lastResultMatrix = R;
    texMatResult("\\( A-B \\)", R);
  }
}

function times() {
  const A = getMatrixA();
  const B = getMatrixB();

  if (matrixWorker) {
    matrixWorker.postMessage({ op: "times", matrix: A, otherMatrix: B, label: "AB" });
  } else {
    const P = math.multiply(A, B);
    lastResultMatrix = P;
    texMatResult("\\( AB \\)", P);
  }
}

// ---------------------- Opération personnalisée (main thread) ----------------------

function customOperation() {
  const expr = document.getElementById("customOp").value.trim();

  if (!expr) {
    appendResultHTML("<span style='color:red;'>Veuillez entrer une expression (ex : A+4*B).</span>");
    return;
  }

  const A = getMatrixA();
  const B = getMatrixB();

  try {
    const result = math.evaluate(expr, { A, B });

    if (typeof result === "number") {
      appendResultHTML("Résultat de " + expr + " = " + result);
    } else {
      lastResultMatrix = result;
      texMatResult(`\\( ${expr} \\)`, result);
    }
  } catch (err) {
    console.error(err);
    appendResultHTML("<span style='color:red;'>Erreur dans l'expression : " + err.message + "</span>");
  }
}

// ---------------------- Nettoyage ----------------------

function clean() {
  const res = document.getElementById("res");
  if (res) res.innerHTML = "";
}

// ---------------------- Initialisation ----------------------

window.onload = function () {
  document.getElementById("liA").value = 3;
  document.getElementById("clA").value = 3;
  document.getElementById("liB").value = 3;
  document.getElementById("clB").value = 3;

  generateA();
  generateB();
};
