// worker.js
// Web Worker pour faire les gros calculs de matrices sans bloquer l'interface

// On charge math.js à l'intérieur du worker
importScripts("https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.11.0/math.min.js");
importScripts("https://cdnjs.cloudflare.com/ajax/libs/numeric/1.2.6/numeric.min.js");



// ---------- Fonction utilitaire : rang---------

function computeRank(A, eps = 1e-10) {
  const m = A.length;
  if (m === 0) return 0;
  const n = A[0].length;

  // On copie pour ne pas modifier la matrice d'origine
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

// ---------- Réception des messages depuis la page principale ----------

self.onmessage = function (e) {
  const { op, matrix, otherMatrix, label, power, scalar } = e.data;

  try {
    let result = null;

    switch (op) {
      case "inverse":
        result = math.inv(matrix);
        break;

      case "det":
        result = math.det(matrix);
        break;

      case "power":
        result = math.pow(matrix, power);
        break;

      case "scale":
        result = math.multiply(scalar, matrix);
        break;

      case "sum":
        result = math.add(matrix, otherMatrix);
        break;

      case "sub":
        result = math.subtract(matrix, otherMatrix);
        break;

      case "times":
        result = math.multiply(matrix, otherMatrix);
        break;

      case "lu":
        const lup = math.lup(matrix);
        result = { L: lup.L, U: lup.U };
        break;
      
    
              

      case "rang":
        result = computeRank(matrix);
        break;

      default:
        throw new Error("Opération non supportée : " + op);
    }

    // On renvoie le résultat à la page
    postMessage({
      ok: true,
      op,
      result,
      label
    });

  } catch (err) {
    // En cas d'erreur (matrice non inversible, dimensions incompatibles, etc.)
    postMessage({
      ok: false,
      op,
      error: err.message,
      label
    });
  }
};
