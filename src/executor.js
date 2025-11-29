// src/executor.js

export const executeSafeCode = (userCode) => {
    const logs = []; // Aquí guardaremos lo que el usuario imprima

    // 1. Guardar las funciones originales de la consola
    // Esto es vital para no romper la consola de desarrollador del navegador
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    try {
        // 2. Interceptar (Hook) la consola
        // Cada vez que el código del usuario llame a console.log, ejecutamos esto:
        console.log = (...args) => {
            // Convertimos los argumentos a texto y los guardamos en nuestro array
            logs.push(args.map(arg => String(arg)).join(" "));
            // Opcional: Si quieres que TAMBIÉN salga en la consola real del navegador:
            // originalConsoleLog.apply(console, ["[Usuario]", ...args]);
        };

        console.warn = (...args) => {
            logs.push("[WARN] " + args.map(arg => String(arg)).join(" "));
        };

        console.error = (...args) => {
            logs.push("❌ " + args.map(arg => String(arg)).join(" "));
        };

        // 3. Ejecutar el código
        // 'new Function' crea una función anónima con el cuerpo del código y la ejecuta inmediatamente
        // Esto corre en el motor V8 (o el que use tu navegador), soportando TODO JavaScript moderno.
        new Function(userCode)();

    } catch (error) {
        // 4. Capturar errores de ejecución (Runtime Errors)
        logs.push(`❌ Error de Ejecución: ${error.message}`);
    } finally {
        // 5. RESTAURAR la consola original (¡Muy Importante!)
        // Si no hacemos esto, tu IDE dejaría de imprimir logs reales.
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
    }

    return logs;
};