// lexer-parser.js
// Analizador Léxico y Sintáctico usando Acorn

import * as acorn from 'acorn';

// Función principal que tu IDE llamará
export function analyzeLexicalSyntactic(code) {
    try {
        // 1. ANÁLISIS SINTÁCTICO CON ACORN
        // Acorn hace el análisis léxico y sintáctico en un solo paso.
        // Si hay un error de sintaxis, lanzará una excepción.
        const ast = acorn.parse(code, {
            ecmaVersion: 'latest', // Soporta la última versión de JavaScript
            locations: true,       // Incluye información de línea y columna
            sourceType: 'module'   // Permite usar 'import' y 'export'
        });

        // 2. FORMATEO DE RESULTADOS (SI NO HAY ERRORES)
        // Como Acorn tuvo éxito, no hay errores léxicos ni sintácticos.

        // Reporte Léxico (simulado, ya que Acorn no separa los tokens fácilmente aquí)
        const lexicalResult = `=== ANÁLISIS LÉXICO (con Acorn) ===\n\n` +
            `✅ El análisis léxico se completó sin errores.\n` +
            `(Acorn procesa tokens internamente para construir el AST).\n`;

        // Reporte Sintáctico
        const syntacticResult = `=== ANÁLISIS SINTÁCTICO (con Acorn) ===\n\n` +
            `✅ El código es sintácticamente válido.\n\n` +
            `ÁRBOL SINTÁCTICO ABSTRACTO (AST):\n` +
            JSON.stringify(ast, null, 2); // Convierte el AST a un string legible

        // Contar tokens es complejo con Acorn. Daremos un conteo aproximado.
        const tokenCount = code.split(/\s+/).filter(Boolean).length;

        // 3. RETORNO DE LA ESTRUCTURA ESPERADA POR EL IDE
        return {
            lexicalResult,
            syntacticResult,
            lexicalErrors: 0,
            syntaxErrors: 0,
            tokenCount,
            ast: ast // MUY IMPORTANTE: Devolvemos el AST para el analizador semántico
        };

    } catch (error) {
        // 4. MANEJO DE ERRORES DE SINTAXIS
        // Si Acorn falla, captura la excepción aquí.
        const errorMessage = `Error de Sintaxis: ${error.message}\n` +
            `Línea: ${error.loc.line}, Columna: ${error.loc.column}`;

        return {
            lexicalResult: "Error durante el análisis léxico. Ver errores sintácticos.",
            syntacticResult: `=== ANÁLISIS SINTÁCTICO (con Acorn) ===\n\n` +
                           `❌ ERRORES SINTÁCTICOS ENCONTRADOS:\n` +
                           `1. ${errorMessage}\n`,
            lexicalErrors: 0, // Los errores de Acorn son principalmente sintácticos
            syntaxErrors: 1,
            tokenCount: 0,
            ast: null // No se pudo generar el AST
        };
    }
}