// src/optimizer.js

// Ayudante para saber si es un número
const isNum = (val) => typeof val === 'number' && !isNaN(val);

export const optimizeCode = (instructions) => {
    let currentCode = [...instructions];
    let optimizationPass = 0;
    let hasChanged = true;

    // Bucle de Punto Fijo: Repetimos las optimizaciones hasta que
    // en una pasada completa NO haya cambios.
    while (hasChanged && optimizationPass < 10) { // Limite 10 pasadas por seguridad
        hasChanged = false;
        optimizationPass++;

        const mapTempValues = new Map(); // Para guardar valores de temporales conocidos (t0: 5)
        const activeTemps = new Set();   // Para saber qué temporales se están usando

        // --- FASE 1: ANÁLISIS Y PROPAGACIÓN ---
        // Primero registramos qué constantes tenemos
        for (let i = 0; i < currentCode.length; i++) {
            const inst = currentCode[i];

            // Propagación: Si usamos un temporal que sabemos que es constante, lo reemplazamos
            if (inst.arg1 && typeof inst.arg1 === 'string' && mapTempValues.has(inst.arg1)) {
                inst.arg1 = mapTempValues.get(inst.arg1);
                hasChanged = true;
            }
            if (inst.arg2 && typeof inst.arg2 === 'string' && mapTempValues.has(inst.arg2)) {
                inst.arg2 = mapTempValues.get(inst.arg2);
                hasChanged = true;
            }

            // Si es una asignación directa de un número (t0 = 5), guardamos en el mapa
            if (inst.op === 'ASSIGN' && isNum(inst.arg1) && inst.res && inst.res.startsWith('t')) {
                mapTempValues.set(inst.res, inst.arg1);
            }
        }

        // --- FASE 2: PLEGADO (FOLDING) Y REDUCCIÓN ALGEBRAICA ---
        currentCode = currentCode.map(inst => {
            // Plegado: Si arg1 y arg2 son números, calculamos el resultado YA.
            if (isNum(inst.arg1) && (isNum(inst.arg2) || inst.arg2 === null)) {
                let result = null;
                let computed = false;

                switch (inst.op) {
                    case '+': result = inst.arg1 + inst.arg2; computed = true; break;
                    case '-': result = inst.arg1 - inst.arg2; computed = true; break;
                    case '*': result = inst.arg1 * inst.arg2; computed = true; break;
                    case '/': result = inst.arg1 / inst.arg2; computed = true; break;
                    case '>': result = inst.arg1 > inst.arg2; computed = true; break;
                    case '<': result = inst.arg1 < inst.arg2; computed = true; break;
                    case 'EQ': case '===': result = inst.arg1 === inst.arg2; computed = true; break;
                    // Lógica Booleana (Simulada)
                    // En tu parser asegúrate de emitir 1 (true) o 0 (false) si quieres optimizar lógica
                }

                if (computed) {
                    hasChanged = true;
                    // Convertimos la operación en una asignación simple
                    return { ...inst, op: 'ASSIGN', arg1: result, arg2: null };
                }
            }

            // Reducción Algebraica: x + 0 = x, x * 1 = x, x * 0 = 0
            if (inst.op === '+' && inst.arg2 === 0) { // x + 0
                hasChanged = true;
                return { ...inst, op: 'ASSIGN', arg1: inst.arg1, arg2: null };
            }
            if (inst.op === '*' && inst.arg2 === 1) { // x * 1
                hasChanged = true;
                return { ...inst, op: 'ASSIGN', arg1: inst.arg1, arg2: null };
            }
            if (inst.op === '*' && inst.arg2 === 0) { // x * 0
                hasChanged = true;
                return { ...inst, op: 'ASSIGN', arg1: 0, arg2: null };
            }

            return inst;
        });

        // --- FASE 3: ELIMINACIÓN DE CÓDIGO MUERTO (DEAD CODE) ---
        // 1. Contamos quién usa qué
        activeTemps.clear();
        currentCode.forEach(inst => {
            // Si arg1 o arg2 son temporales (t0, t1...), los marcamos como "USADOS"
            if (typeof inst.arg1 === 'string' && inst.arg1.startsWith('t')) activeTemps.add(inst.arg1);
            if (typeof inst.arg2 === 'string' && inst.arg2.startsWith('t')) activeTemps.add(inst.arg2);
            // Nota: Los PARAM también cuentan como uso
            if (inst.op === 'PARAM' && typeof inst.arg1 === 'string' && inst.arg1.startsWith('t')) activeTemps.add(inst.arg1);
        });

        // 2. Filtramos
        const originalLength = currentCode.length;
        currentCode = currentCode.filter(inst => {
            // Si la instrucción genera un temporal (res = tX)
            if (inst.res && typeof inst.res === 'string' && inst.res.startsWith('t')) {
                // Y ese temporal NO está en la lista de usados
                if (!activeTemps.has(inst.res)) {
                    // Y NO es una llamada a función (porque la llamada tiene efectos secundarios)
                    if (inst.op !== 'CALL') {
                        return false; // ¡ELIMINAR! (Nadie lo usa)
                    }
                }
            }
            return true; // Mantener
        });

        if (currentCode.length !== originalLength) {
            hasChanged = true;
        }
    }

    return currentCode;
};