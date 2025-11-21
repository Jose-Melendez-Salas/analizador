export class QuadrupleGenerator {
    constructor() {
        this.instructions = []; // Tabla de cuádruplos
        this.tempCount = 0;     // Contadores t0, t1...
        this.labelCount = 0;    // Contadores L0, L1...
    }

    newTemp() {
        return `t${this.tempCount++}`;
    }

    newLabel() {
        return `L${this.labelCount++}`;
    }

    emit(op, arg1, arg2, res) {
        this.instructions.push({
            id: this.instructions.length,
            op,
            arg1: arg1 !== undefined ? arg1 : null,
            arg2: arg2 !== undefined ? arg2 : null,
            res: res !== undefined ? res : null
        });
    }

    generate(ast) {
        this.instructions = [];
        this.tempCount = 0;
        this.labelCount = 0;
        this.traverse(ast);
        return this.instructions;
    }

    traverse(node) {
        if (!node) return null;

        switch (node.type) {
            // --------------------------------------------
            // 1. ESTRUCTURA PRINCIPAL
            // --------------------------------------------
            case 'Program':
            case 'BlockStatement':
                node.body.forEach(stmt => this.traverse(stmt));
                break;

            // --------------------------------------------
            // 2. VARIABLES Y ASIGNACIONES
            // --------------------------------------------
            case 'VariableDeclaration':
                node.declarations.forEach(decl => {
                    if (decl.init) {
                        const val = this.traverse(decl.init);
                        this.emit('ASSIGN', val, null, decl.id.name);
                    }
                });
                break;

            case 'AssignmentExpression': // x = 10
                const value = this.traverse(node.right);
                this.emit('ASSIGN', value, null, node.left.name);
                return node.left.name;

            // --------------------------------------------
            // 3. ARITMÉTICA Y LÓGICA
            // --------------------------------------------
            case 'BinaryExpression':
                const left = this.traverse(node.left);
                const right = this.traverse(node.right);
                const temp = this.newTemp();
                // Mapeamos operadores para que se vean bonitos en la tabla
                let op = node.operator;
                if (op === '==') op = 'EQ';
                if (op === '!=') op = 'NEQ';
                if (op === '===') op = 'EQ_STRICT';

                this.emit(op, left, right, temp);
                return temp;

            case 'NumericLiteral':
            case 'Literal':
                return node.value;

            case 'Identifier':
                return node.name;

            // --------------------------------------------
            // 4. CONTROL DE FLUJO (IF / ELSE)
            // --------------------------------------------
            case 'IfStatement':
                const labelElse = this.newLabel();
                const labelEndIf = this.newLabel();

                const condition = this.traverse(node.test);

                // Si la condicion es falsa, ve al Else
                this.emit('JUMP_IF_FALSE', condition, null, labelElse);

                // Bloque True
                this.traverse(node.consequent);
                this.emit('GOTO', null, null, labelEndIf); // Saltar el else al terminar

                // Bloque Else
                this.emit('LABEL', null, null, labelElse);
                if (node.alternate) {
                    this.traverse(node.alternate);
                }

                this.emit('LABEL', null, null, labelEndIf);
                break;

            // --------------------------------------------
            // 5. BUCLES (WHILE)
            // --------------------------------------------
            case 'WhileStatement':
                const labelStartWhile = this.newLabel();
                const labelEndWhile = this.newLabel();

                this.emit('LABEL', null, null, labelStartWhile); // Inicio ciclo

                const conditionWhile = this.traverse(node.test);
                this.emit('JUMP_IF_FALSE', conditionWhile, null, labelEndWhile); // Salir si falso

                this.traverse(node.body);

                this.emit('GOTO', null, null, labelStartWhile); // Volver al inicio
                this.emit('LABEL', null, null, labelEndWhile); // Salida
                break;

            // --------------------------------------------
            // 6. FUNCIONES (DECLARACIÓN) - LO NUEVO
            // --------------------------------------------
            case 'FunctionDeclaration':
                const funcName = node.id.name;
                const labelFuncStart = `FUNC_${funcName}`;
                const labelFuncEnd = `END_FUNC_${funcName}`;

                // IMPORTANTE: Saltarse la función cuando se lee el código secuencialmente
                this.emit('GOTO', null, null, labelFuncEnd);

                // Inicio de la función
                this.emit('LABEL', null, null, labelFuncStart);

                // Procesar Parámetros (Opcional: para llevar registro)
                node.params.forEach(param => {
                    this.emit('PARAM_RECEIVE', null, null, param.name);
                });

                // Cuerpo de la función
                this.traverse(node.body);

                // Retorno por defecto (void) por si el usuario no puso return
                this.emit('RETURN', null, null, 'void');

                // Fin de la declaración (punto de salto)
                this.emit('LABEL', null, null, labelFuncEnd);
                break;

            // --------------------------------------------
            // 7. RETORNO (RETURN)
            // --------------------------------------------
            case 'ReturnStatement':
                let retVal = null;
                if (node.argument) {
                    retVal = this.traverse(node.argument);
                }
                this.emit('RETURN', retVal, null, null);
                break;

            // --------------------------------------------
            // 8. LLAMADAS A FUNCIÓN (CALL)
            // --------------------------------------------
            case 'CallExpression':
                // 1. Preparar argumentos
                const args = [];
                node.arguments.forEach(arg => {
                    const argTemp = this.traverse(arg);
                    args.push(argTemp);
                });

                // 2. Emitir instrucción PARAM para cada argumento
                args.forEach(arg => {
                    this.emit('PARAM', arg, null, null);
                });

                // 3. Llamar a la función
                const funcToCall = node.callee.name;
                const resultTemp = this.newTemp(); // Donde guardaremos lo que devuelva

                // CALL nombreFunc, numArgs, variableDestino
                this.emit('CALL', `FUNC_${funcToCall}`, args.length, resultTemp);

                return resultTemp;

            default:
                console.warn(`Tipo de nodo no soportado: ${node.type}`);
        }
    }
}