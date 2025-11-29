// src/optimizer.js

const isNum = (val) => typeof val === 'number' && !isNaN(val);
// Helper para saber si es literal booleano o numérico
const isLiteral = (val) => isNum(val) || val === true || val === false;

export const optimizeCode = (instructions) => {
    let currentCode = [...instructions];
    let optimizationPass = 0;
    let hasChanged = true;

    while (hasChanged && optimizationPass < 10) {
        hasChanged = false;
        optimizationPass++;

        const mapTempValues = new Map();
        const activeTemps = new Set();

        // --- FASE 1: PROPAGACIÓN DE CONSTANTES ---
        for (let i = 0; i < currentCode.length; i++) {
            const inst = currentCode[i];

            // Reemplazar arg1 si es un temporal conocido
            if (inst.arg1 && typeof inst.arg1 === 'string' && mapTempValues.has(inst.arg1)) {
                inst.arg1 = mapTempValues.get(inst.arg1);
                hasChanged = true;
            }
            // Reemplazar arg2 si es un temporal conocido
            if (inst.arg2 && typeof inst.arg2 === 'string' && mapTempValues.has(inst.arg2)) {
                inst.arg2 = mapTempValues.get(inst.arg2);
                hasChanged = true;
            }

            // Si es una asignación directa de un valor literal a un temporal, registrar
            if (inst.op === 'ASSIGN' && isLiteral(inst.arg1) && inst.res && inst.res.startsWith('t')) {
                mapTempValues.set(inst.res, inst.arg1);
            }
        }

        // --- FASE 2: PLEGADO DE CONSTANTES (FOLDING) ---
        currentCode = currentCode.map(inst => {
            // Solo plegamos si ambos argumentos son literales (números o booleanos)
            if (isLiteral(inst.arg1) && (isLiteral(inst.arg2) || inst.arg2 === null)) {
                let result = null;
                let computed = false;

                switch (inst.op) {
                    case '+': result = inst.arg1 + inst.arg2; computed = true; break;
                    case '-': result = inst.arg1 - inst.arg2; computed = true; break;
                    case '*': result = inst.arg1 * inst.arg2; computed = true; break;
                    case '/': 
                        if (inst.arg2 !== 0) { result = inst.arg1 / inst.arg2; computed = true; }
                        break;
                    case '>': result = inst.arg1 > inst.arg2; computed = true; break;
                    case '<': result = inst.arg1 < inst.arg2; computed = true; break;
                    case '>=': result = inst.arg1 >= inst.arg2; computed = true; break;
                    case '<=': result = inst.arg1 <= inst.arg2; computed = true; break;
                    case 'EQ': case '===': case 'EQ_STRICT': result = inst.arg1 === inst.arg2; computed = true; break;
                    case 'NEQ': case '!==': result = inst.arg1 !== inst.arg2; computed = true; break;
                }

                if (computed) {
                    hasChanged = true;
                    // Retornamos una nueva instrucción de asignación con el resultado calculado
                    return { ...inst, op: 'ASSIGN', arg1: result, arg2: null };
                }
            }

            // Reducciones algebraicas simples
            if (inst.op === '+' && inst.arg2 === 0) { // x + 0 = x
                hasChanged = true;
                return { ...inst, op: 'ASSIGN', arg1: inst.arg1, arg2: null };
            }
            if (inst.op === '*' && inst.arg2 === 1) { // x * 1 = x
                hasChanged = true;
                return { ...inst, op: 'ASSIGN', arg1: inst.arg1, arg2: null };
            }
            if (inst.op === '*' && inst.arg2 === 0) { // x * 0 = 0
                hasChanged = true;
                return { ...inst, op: 'ASSIGN', arg1: 0, arg2: null };
            }

            return inst;
        });

        // --- FASE 3: ELIMINACIÓN DE CÓDIGO MUERTO ---
        // 1. Identificar temporales usados
        activeTemps.clear();
        currentCode.forEach(inst => {
            if (typeof inst.arg1 === 'string' && inst.arg1.startsWith('t')) activeTemps.add(inst.arg1);
            if (typeof inst.arg2 === 'string' && inst.arg2.startsWith('t')) activeTemps.add(inst.arg2);
            // El argumento de un IF o PARAM cuenta como uso
            if ((inst.op === 'PARAM' || inst.op === 'RETURN' || inst.op === 'JUMP_IF_FALSE') && 
                typeof inst.arg1 === 'string' && inst.arg1.startsWith('t')) {
                activeTemps.add(inst.arg1);
            }
        });

        // 2. Filtrar instrucciones inútiles
        const lenBefore = currentCode.length;
        currentCode = currentCode.filter(inst => {
            // Si la instrucción produce un temporal (res = tX)
            if (inst.res && typeof inst.res === 'string' && inst.res.startsWith('t')) {
                // Y ese temporal NO se usa más adelante
                if (!activeTemps.has(inst.res)) {
                    // Y NO es una llamada a función (porque CALL tiene efectos secundarios)
                    if (inst.op !== 'CALL') {
                        return false; // Eliminar
                    }
                }
            }
            return true;
        });

        if (currentCode.length !== lenBefore) hasChanged = true;
    }

    return currentCode;
};