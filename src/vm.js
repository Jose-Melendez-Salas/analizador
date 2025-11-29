// src/vm.js

export class VirtualMachine {
    constructor(instructions) {
        this.instructions = instructions;
        this.ip = 0;              // Instruction Pointer
        this.memory = new Map();  // Memoria
        this.stack = [];          // Pila de llamadas
        this.labels = {};         // Mapa de etiquetas
        this.output = [];         // Salida de consola
        this.paramQueue = [];     // Cola de parámetros
        this.maxSteps = 20000;    // Límite de seguridad
    }

    mapLabels() {
        this.labels = {}; // Reiniciar etiquetas
        this.instructions.forEach((inst, index) => {
            if (inst.op === 'LABEL' || inst.op.startsWith('FUNC_') || inst.op.startsWith('END_FUNC_')) {
                const labelName = inst.res || inst.arg1 || inst.op; 
                this.labels[labelName] = index;
            }
        });
    }

    resolve(val) {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number' || typeof val === 'boolean') return val;
        
        if (typeof val === 'string') {
            // Literales de string
            if ((val.startsWith('"') && val.endsWith('"')) || 
                (val.startsWith("'") && val.endsWith("'")) ||
                (val.startsWith("`") && val.endsWith("`"))) {
                return val.slice(1, -1);
            }
            // Literales booleanos en string (por si acaso)
            if (val === 'true') return true;
            if (val === 'false') return false;

            // Variables
            return this.memory.has(val) ? this.memory.get(val) : undefined;
        }
        return val;
    }

    run() {
        this.mapLabels();
        this.output = [];
        this.memory.clear();
        this.ip = 0;
        let steps = 0;

        try {
            while (this.ip < this.instructions.length) {
                if (steps++ > this.maxSteps) throw new Error("Stack Overflow / Bucle Infinito detectado.");

                const inst = this.instructions[this.ip];
                const { op, arg1, arg2, res } = inst;

                switch (op) {
                    case 'ASSIGN':
                        this.memory.set(res, this.resolve(arg1));
                        break;

                    // Aritmética
                    case '+': this.memory.set(res, this.resolve(arg1) + this.resolve(arg2)); break;
                    case '-': this.memory.set(res, this.resolve(arg1) - this.resolve(arg2)); break;
                    case '*': this.memory.set(res, this.resolve(arg1) * this.resolve(arg2)); break;
                    case '/': this.memory.set(res, this.resolve(arg1) / this.resolve(arg2)); break;
                    case '%': this.memory.set(res, this.resolve(arg1) % this.resolve(arg2)); break; // Agregado módulo

                    // Comparación
                    case '>': this.memory.set(res, this.resolve(arg1) > this.resolve(arg2)); break;
                    case '<': this.memory.set(res, this.resolve(arg1) < this.resolve(arg2)); break;
                    case '>=': this.memory.set(res, this.resolve(arg1) >= this.resolve(arg2)); break;
                    case '<=': this.memory.set(res, this.resolve(arg1) <= this.resolve(arg2)); break;
                    case 'EQ': case '===': case 'EQ_STRICT':
                        this.memory.set(res, this.resolve(arg1) === this.resolve(arg2)); break;
                    case 'NEQ': case '!==': 
                        this.memory.set(res, this.resolve(arg1) !== this.resolve(arg2)); break;

                    // Saltos
                    case 'GOTO':
                        if (this.labels[res] !== undefined) {
                            this.ip = this.labels[res];
                            continue;
                        }
                        break;

                    case 'JUMP_IF_FALSE':
                        const condition = this.resolve(arg1);
                        if (!condition) {
                            if (this.labels[res] !== undefined) {
                                this.ip = this.labels[res];
                                continue;
                            }
                        }
                        break;

                    // Funciones y Parámetros
                    case 'PARAM':
                        this.paramQueue.push(this.resolve(arg1));
                        break;

                    case 'PARAM_RECEIVE':
                        const paramVal = this.paramQueue.shift();
                        this.memory.set(res, paramVal);
                        break;

                    case 'CALL':
                        // console.log especial
                         // 1. Manejo de console.log / warn
                        if (arg1 === 'console_log' || arg1 === 'console_warn') {
                            const valToPrint = this.paramQueue.length > 0 ? this.paramQueue.map(v => String(v)).join(' ') : "undefined";
                            const prefix = arg1 === 'console_warn' ? '[WARN] ' : '';
                            this.output.push(prefix + valToPrint);
                            this.paramQueue = [];
                        } 
                        // 2. Manejo de PROMPT (Entrada de usuario)
                        else if (arg1 === 'FUNC_prompt') {
                            // Si hay argumentos, usarlos como mensaje
                            const msg = this.paramQueue.length > 0 ? this.paramQueue.shift() : "Ingrese un valor:";
                            this.paramQueue = []; // Limpiar resto
                            
                            // Usamos el prompt nativo del navegador
                            // NOTA: Esto detendrá la ejecución de JS hasta que el usuario responda
                            const input = window.prompt(String(msg));
                            
                            // Guardamos el resultado en la variable destino (res)
                            // Si el usuario cancela, guardamos "null" o cadena vacía
                            this.memory.set(res, input !== null ? input : "null");
                        }
                        // 3. Manejo de PARSEINT (Convertir texto a número)
                        else if (arg1 === 'FUNC_parseInt') {
                            const val = this.paramQueue.shift();
                            this.paramQueue = [];
                            // Convertir y guardar
                            const num = parseInt(val, 10);
                            this.memory.set(res, isNaN(num) ? 0 : num);
                        }
                        // 4. Llamada a función de usuario normal
                        else {
                            if (this.labels[arg1] !== undefined) {
                                this.stack.push({
                                    retIP: this.ip + 1,
                                    targetRes: res,
                                    memorySnapshot: new Map(this.memory)
                                });
                                this.ip = this.labels[arg1];
                                continue;
                            } else {
                                throw new Error(`Función no definida: ${arg1}`);
                            }
                        }
                        break;

                    case 'RETURN':
                        const retVal = this.resolve(arg1);
                        if (this.stack.length > 0) {
                            const frame = this.stack.pop();
                            this.ip = frame.retIP;
                            // Restaurar memoria base pero mantener cambios globales (simplificación para este nivel)
                            // frame.memorySnapshot.forEach((v, k) => this.memory.set(k, v)); 
                            
                            if (frame.targetRes) {
                                this.memory.set(frame.targetRes, retVal);
                            }
                            continue;
                        } else {
                            this.ip = this.instructions.length; // Terminar programa
                            continue;
                        }
                        break;

                    case 'LABEL':
                    case 'DEF':
                    case 'DEF_METHOD':
                        break;

                    default:
                        console.warn(`Opcode desconocido en VM: ${op}`);
                }
                this.ip++;
            }
        } catch (e) {
            this.output.push(`❌ Error de Ejecución: ${e.message}`);
        }

        return this.output;
    }
}