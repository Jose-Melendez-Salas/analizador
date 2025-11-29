class SymbolTable {
    constructor(parent = null) {
        this.parent = parent;
        this.symbols = new Map();
        this.children = [];
        this.scopeType = 'block'; 
    }

        define(name, info) {
            // Para 'let' y 'const', solo verificar el ámbito actual
            if (info.kind === 'let' || info.kind === 'const') {
                if (this.symbols.has(name)) {
                    return { error: `No se puede volver a declarar una variable con ámbito de bloque. '${name}'` };
                }
            } else if (info.kind === 'var') {
                // Para 'var', buscar en el ámbito de la función actual
                let current = this;
                while (current && current.scopeType !== 'function' && current.scopeType !== 'global') {
                    current = current.parent;
                }
                if (current && current.symbols.has(name)) {
                    return { error: `El identificador '${name}' ya ha sido declarado` };
                }
            }
            
            this.symbols.set(name, info);
            return null;
        }

    lookup(name) {
        if (this.symbols.has(name)) {
            return this.symbols.get(name);
        }
        if (this.parent) {
            return this.parent.lookup(name);
        }
        return null;
    }

    createChild(scopeType = 'block') {
        const child = new SymbolTable(this);
        child.scopeType = scopeType;
        this.children.push(child);
        return child;
    }

    getAllSymbols() {
        const symbols = new Map(this.symbols);
        if (this.parent) {
            const parentSymbols = this.parent.getAllSymbols();
            for (const [name, info] of parentSymbols) {
                if (!symbols.has(name)) {
                    symbols.set(name, info);
                }
            }
        }
        return symbols;
    }
}

class SemanticAnalyzer {
    constructor() {
        this.globalScope = new SymbolTable();
        this.currentScope = this.globalScope;
        this.errors = [];
        this.warnings = [];
        this.functionStack = [];

        // Initialize built-in objects and functions
        this.initializeBuiltins();
    }

    initializeBuiltins() {
        const builtins = [
            // Global objects
            { name: 'console', type: 'object', builtin: true },
            { name: 'window', type: 'object', builtin: true },
            { name: 'document', type: 'object', builtin: true },
            { name: 'Array', type: 'function', builtin: true },
            { name: 'Object', type: 'function', builtin: true },
            { name: 'String', type: 'function', builtin: true },
            { name: 'Number', type: 'function', builtin: true },
            { name: 'Boolean', type: 'function', builtin: true },
            { name: 'Date', type: 'function', builtin: true },
            { name: 'RegExp', type: 'function', builtin: true },
            { name: 'Math', type: 'object', builtin: true },
            { name: 'JSON', type: 'object', builtin: true },

            // Global functions
            { name: 'parseInt', type: 'function', builtin: true, returnType: 'number' }, 
            { name: 'parseFloat', type: 'function', builtin: true, returnType: 'number' },
            { name: 'prompt', type: 'function', builtin: true, returnType: 'string' },
            { name: 'isNaN', type: 'function', builtin: true },
            { name: 'isFinite', type: 'function', builtin: true },
            { name: 'eval', type: 'function', builtin: true },
            { name: 'setTimeout', type: 'function', builtin: true },
            { name: 'setInterval', type: 'function', builtin: true },
            { name: 'clearTimeout', type: 'function', builtin: true },
            { name: 'clearInterval', type: 'function', builtin: true },

            // Global variables
            { name: 'undefined', type: 'undefined', builtin: true },
            { name: 'NaN', type: 'number', builtin: true },
            { name: 'Infinity', type: 'number', builtin: true }
        ];

        builtins.forEach(builtin => {
            this.globalScope.define(builtin.name, {
                type: builtin.type,
                builtin: true,
                initialized: true,
                used: false,
                line: 0,
                column: 0
            });
        });
    }

    addError(message, node = null) {
        this.errors.push({
            type: 'error',
            message,
            line: node?.line || 0,
            column: node?.column || 0,
            node: node?.type || 'unknown'
        });
    }

    addWarning(message, node = null) {
        this.warnings.push({
            type: 'warning',
            message,
            line: node?.line || 0,
            column: node?.column || 0,
            node: node?.type || 'unknown'
        });
    }

    enterScope(scopeType = 'block') {
        this.currentScope = this.currentScope.createChild(scopeType);
    }

    exitScope() {
        if (this.currentScope.parent) {
            this.currentScope = this.currentScope.parent;
        }
    }

    analyzeNode(node) {
        if (!node) return;

        switch (node.type) {
            case 'Program':
                this.analyzeProgram(node);
                break;
            case 'VariableDeclaration':
                this.analyzeVariableDeclaration(node);
                break;
            case 'FunctionDeclaration':
                this.analyzeFunctionDeclaration(node);
                break;
            case 'Identifier':
                return this.analyzeIdentifier(node);
            case 'AssignmentExpression':
                this.analyzeAssignmentExpression(node);
                break;
            case 'CallExpression':
                this.analyzeCallExpression(node);
                break;
            case 'MemberExpression':
                this.analyzeMemberExpression(node);
                break;
            case 'BinaryExpression':
                this.analyzeBinaryExpression(node);
                break;
            case 'UnaryExpression':
                this.analyzeUnaryExpression(node);
                break;
            case 'UpdateExpression':
                this.analyzeUpdateExpression(node);
                break;
            case 'LogicalExpression':
                this.analyzeLogicalExpression(node);
                break;
            case 'ConditionalExpression':
                this.analyzeConditionalExpression(node);
                break;
            case 'BlockStatement':
                this.analyzeBlockStatement(node);
                break;
            case 'ExpressionStatement':
                this.analyzeExpressionStatement(node);
                break;
            case 'IfStatement':
                this.analyzeIfStatement(node);
                break;
            case 'WhileStatement':
                this.analyzeWhileStatement(node);
                break;
            case 'ForStatement':
                this.analyzeForStatement(node);
                break;
            case 'ReturnStatement':
                this.analyzeReturnStatement(node);
                break;
            case 'ArrayExpression':
                this.analyzeArrayExpression(node);
                break;
            case 'ObjectExpression':
                this.analyzeObjectExpression(node);
                break;
            case 'ArrowFunctionExpression':
                this.analyzeArrowFunction(node);
                break;

            // 1. Añade soporte para Clases
            case 'ClassDeclaration':
                this.analyzeClassDeclaration(node);
                break;

            // 2. Añade soporte para "new MiClase()"
            case 'NewExpression':
                this.analyzeNewExpression(node);
                break;

            // 3. Añade soporte para Métodos de Clase y Expresiones de Función
            case 'MethodDefinition':
                // Un método de clase es muy similar a una declaración de función
                this.analyzeFunctionDeclaration(node.value);
                break;
            case 'FunctionExpression':
                // Una expresión de función también es similar
                this.analyzeFunctionDeclaration(node);
                return { kind: 'function' };
                break;

            case 'Literal':
                return this.analyzeLiteral(node);
            case 'TemplateLiteral':
                return this.analyzeTemplateLiteral(node);
            default:
                this.addWarning(`Unknown node type: ${node.type}`, node);
        }
    }

    analyzeProgram(node) {
        this.currentScope.scopeType = 'global';

        // First pass: collect all function declarations (hoisting)
        node.body.forEach(stmt => {
            if (stmt.type === 'FunctionDeclaration') {
                this.hoistFunctionDeclaration(stmt);
            }
        });

        // Second pass: analyze all statements
        node.body.forEach(stmt => this.analyzeNode(stmt));

        // Check for unused variables
        this.checkUnusedVariables();
    }

    hoistFunctionDeclaration(node) {
        if (node.id && node.id.name) {
            const error = this.currentScope.define(node.id.name, {
                kind: 'function',       
                dataType: 'function',   
                returnType: 'unknown',
                initialized: true,
                used: false,
                params: node.params ? node.params.map(p => p.name) : [],
                line: node.line || 0,
                column: node.column || 0,
                hoisted: true
            });

            if (error) {
                this.addError(error.error, node);
            }
        }
    }

        analyzeVariableDeclaration(node) {
            node.declarations.forEach(declarator => {
                if (declarator.id && declarator.id.name) {

                    // 1. Determinamos el TIPO DE DATO del valor inicial ANTES de crear el símbolo.
                    let initialDataType = 'undefined'; // Valor por defecto si no hay inicializador.
                    if (declarator.init) {
                        // Analizamos la expresión a la derecha del '=' (ej. 123, "hola", createCounter()).
                        const initTypeInfo = this.analyzeNode(declarator.init);
                        if (initTypeInfo && initTypeInfo.type) {
                            // El tipo de dato será lo que devuelva el análisis (ej: 'number', 'string', 'function').
                            initialDataType = initTypeInfo.type;
                        }
                    }

                    // 2. Creamos el objeto `varInfo` con las propiedades separadas y claras.
                    const varInfo = {
                        kind: node.kind,              
                        dataType: initialDataType,      
                        initialized: !!declarator.init,
                        used: false,
                        line: declarator.loc.start.line, 
                        column: declarator.loc.start.column
                    };


                    if (node.kind === 'const' && !declarator.init) {
                        this.addError(`Falta el inicializador en la declaración const '${declarator.id.name}'`, declarator);
                    }

                    // Definir el nuevo símbolo en la tabla de símbolos.
                    const error = this.currentScope.define(declarator.id.name, varInfo);
                    if (error) {
                        // Tu lógica para errores de redeclaración se mantiene.
                        const existing = this.currentScope.lookup(declarator.id.name);
                        if (existing && existing.kind !== node.kind) {
                            this.addError(`El identificador '${declarator.id.name}' ya ha sido declarado con un tipo diferente`, declarator);
                        } else {
                            this.addError(error.error, declarator);
                        }
                    }
                }
            });
        }

    analyzeFunctionDeclaration(node) {
        if (node.id && node.id.name) {
            this.enterScope('function');
            this.functionStack.push({
                name: node.id.name,
                hasReturn: false,
                node: node
            });

            // Define parameters in function scope
            if (node.params) {
                node.params.forEach(param => {
                    if (param.name) {
                        this.currentScope.define(param.name, {
                            kind: 'parameter',
                            dataType: 'unknown', 
                            initialized: true,
                            used: false,
                            line: param.line || 0,
                            column: param.column || 0
                        });
                    }
                });
            }

            // Analyze function body
            if (node.body) {
                this.analyzeNode(node.body);
            }

            // Check if function should return a value
            const currentFunction = this.functionStack.pop();
            if (!currentFunction.hasReturn && node.id.name !== 'main') {
                this.addWarning(`La función '${node.id.name}' no tiene una declaración de retorno`, node);
            }

            this.exitScope();
        }
    }

    analyzeIdentifier(node) {
        if (!node.name) return;

        const symbol = this.currentScope.lookup(node.name);
        if (!symbol) {
            this.addError(`La variable '${node.name}' no está definida`, node);
            return { type: 'unknown' };
        }

        // Mark as used
        symbol.used = true;

        // Check if variable is used before initialization
        if (!symbol.initialized && symbol.type !== 'function' && !symbol.builtin) {
            this.addError(`La variable '${node.name}' se utiliza antes de ser inicializada`, node);
        }

        return { type: symbol.type };
    }

    analyzeAssignmentExpression(node) {
        // Analyze right side first
        const rightType = this.analyzeNode(node.right);

        // Check left side
        if (node.left) {
            if (node.left.type === 'Identifier') {
                const symbol = this.currentScope.lookup(node.left.name);
                if (!symbol) {
                    this.addError(`No se puede asignar a la variable no declarada '${node.left.name}'`, node.left);
                } else {
                    // Check const assignment
                    if (symbol.type === 'const' && symbol.initialized) {
                        this.addError(`No se puede asignar a la variable const '${node.left.name}'`, node.left);
                    }

                    // Mark as initialized if it's a variable
                    if (symbol.type === 'variable' || symbol.type === 'const') {
                        symbol.initialized = true;
                    }
                }
            } else {
                // Member expressions, etc.
                this.analyzeNode(node.left);
            }
        }

        // Type checking for specific operators
        if (node.operator === '+=') {
            // Both operands should be compatible for addition
            this.checkArithmeticCompatibility(node.left, node.right, node);
        } else if (['*=', '/=', '-=', '%='].includes(node.operator)) {
            // Should be numeric
            this.checkNumericOperation(node.left, node.right, node);
        }
    }

        analyzeCallExpression(node) {
            let calleeSymbol = null;

            // 1. Analizar qué se está llamando (el "callee")
            if (node.callee.type === 'Identifier') {
                // Caso: miFuncion()
                calleeSymbol = this.currentScope.lookup(node.callee.name);

                if (!calleeSymbol) {
                    this.addError(`La función '${node.callee.name}' no está definida`, node.callee);
                    return { type: 'unknown' }; // No podemos continuar si no está definida
                }
                
                // Marcamos el símbolo como usado
                calleeSymbol.used = true;

            } else if (node.callee.type === 'MemberExpression') {

                this.analyzeNode(node.callee);
            } else {
                // Caso: (function(){...})() (IIFE) u otras expresiones
                this.analyzeNode(node.callee);
            }
            
            // 2. Verificar si el "callee" es realmente una función
            if (calleeSymbol && calleeSymbol.dataType !== 'function') { 
                this.addWarning(`'${node.callee.name}' no es una función, su tipo de dato es '${calleeSymbol.dataType}'`, node.callee);
            }

            // 3. Analizar los argumentos de la llamada
            if (node.arguments) {
                node.arguments.forEach(arg => this.analyzeNode(arg));
            }

            // 4. (Opcional) Verificar el número de argumentos si conocemos la firma de la función
            if (calleeSymbol && calleeSymbol.params) {
                if (node.arguments.length !== calleeSymbol.params.length) {
                    this.addWarning(
                        `La función '${node.callee.name}' esperaba ${calleeSymbol.params.length} argumentos, pero recibió ${node.arguments.length}`,
                        node
                    );
                }
            }

            if (calleeSymbol && calleeSymbol.returnType) {
                return { type: calleeSymbol.returnType };
            }

            return { type: 'unknown' };
        }

            analyzeMemberExpression(node) {
                if (node.object) {
                    this.analyzeNode(node.object);
                }

                if (node.computed && node.property) {
                    this.analyzeNode(node.property);
                }

                // Check for common mistakes
                if (node.object && node.object.type === 'Identifier' && node.object.name === 'console') {
                    if (node.property && node.property.name && !['log', 'warn', 'error', 'info', 'debug'].includes(node.property.name)) {
                        this.addWarning(`Método de consola desconocido: ${node.property.name}`, node);
                    }
                }
            }

            analyzeBinaryExpression(node) {
                const left = this.analyzeNode(node.left);
                const right = this.analyzeNode(node.right);

                // Si ambos son 'number', el resultado es 'number'
                if (left && right && left.type === 'number' && right.type === 'number') {
                    return { type: 'number' };
                }
                // Si uno es 'string' y el operador es '+', el resultado es 'string'
                if (node.operator === '+' && (left?.type === 'string' || right?.type === 'string')) {
                    return { type: 'string' };
                }
                // Para comparaciones, el resultado es 'boolean'
                if (['==', '===', '!=', '!==', '>', '<', '>=', '<='].includes(node.operator)) {
                    return { type: 'boolean' };
                }
                
                // Si no se puede inferir, se devuelve un tipo genérico
                return { type: 'any' };
            }

    analyzeUnaryExpression(node) {
        this.analyzeNode(node.argument);

        if (node.operator === '!') {
            // Logical NOT - check for double negation
            if (node.argument && node.argument.type === 'UnaryExpression' && node.argument.operator === '!') {
                this.addWarning('Double negation (!!), consider using Boolean() instead', node);
            }
        } else if (node.operator === 'typeof') {
            // typeof is always safe
        } else if (['+', '-'].includes(node.operator)) {
            // Numeric unary operators
            this.checkNumericOperation(node.argument, null, node);
        } else if (node.operator === 'delete') {
            // Delete operator warnings
            if (node.argument && node.argument.type === 'Identifier') {
                this.addWarning(`Eliminación de identificador '${node.argument.name}' no calificado en modo estricto`, node);
            }
        }
    }

    analyzeUpdateExpression(node) {
        if (node.argument && node.argument.type === 'Identifier') {
            const symbol = this.currentScope.lookup(node.argument.name);
            if (!symbol) {
                this.addError(`No se puede actualizar la variable no declarada '${node.argument.name}'`, node.argument);
            } else if (symbol.type === 'const') {
                this.addError(`No se puede actualizar la variable const '${node.argument.name}'`, node.argument);
            } else {
                symbol.used = true;
            }
        } else if (node.argument) {
            this.analyzeNode(node.argument);
        }
    }

    analyzeLogicalExpression(node) {
        this.analyzeNode(node.left);
        this.analyzeNode(node.right);

        // Check for potential short-circuit issues
        if (node.operator === '&&') {
            // Check if left side is always falsy
            if (this.isAlwaysFalsy(node.left)) {
                this.addWarning('El lado izquierdo de && siempre es falso, el lado derecho nunca se ejecutará', node);
            }
        } else if (node.operator === '||') {
            // Check if left side is always truthy
            if (this.isAlwaysTruthy(node.left)) {
                this.addWarning('El lado izquierdo de || siempre es verdadero, el lado derecho nunca se ejecutará', node);
            }
        }
    }

    analyzeConditionalExpression(node) {
        this.analyzeNode(node.test);
        this.analyzeNode(node.consequent);
        this.analyzeNode(node.alternate);

        // Check for always true/false conditions
        if (this.isAlwaysTruthy(node.test)) {
            this.addWarning('La condición siempre es verdadera, la rama alternativa nunca se ejecutará.', node);
        } else if (this.isAlwaysFalsy(node.test)) {
            this.addWarning('La condición siempre es falsa, la rama consecuente nunca se ejecutará.', node);
        }
    }

    analyzeBlockStatement(node) {
        this.enterScope('block');
        let hasUnreachableCode = false;

        if (node.body) {
            node.body.forEach(stmt => {
                if (hasUnreachableCode) {
                    this.addWarning('Unreachable code detected', stmt);
                }
                this.analyzeNode(stmt);
                if (['ReturnStatement', 'BreakStatement', 'ContinueStatement', 'ThrowStatement'].includes(stmt.type)) {
                    hasUnreachableCode = true;
                }
            });
        }
        this.exitScope();
    }

    analyzeExpressionStatement(node) {
        if (node.expression) {
            this.analyzeNode(node.expression);
        }
    }

    analyzeIfStatement(node) {
        if (node.test) {
            this.analyzeNode(node.test);

            // Check for always true/false conditions
            if (this.isAlwaysTruthy(node.test)) {
                this.addWarning('La condición siempre es verdadera.', node);
            } else if (this.isAlwaysFalsy(node.test)) {
                this.addWarning('La condición siempre es falsa.', node);
            }
        }

        if (node.consequent) {
            this.analyzeNode(node.consequent);
        }

        if (node.alternate) {
            this.analyzeNode(node.alternate);
        }
    }

    analyzeWhileStatement(node) {
        if (node.test) {
            this.analyzeNode(node.test);

            // Check for infinite loops
            if (this.isAlwaysTruthy(node.test)) {
                this.addWarning('Posible bucle infinito: la condición siempre es verdadera.', node);
            }
        }

        if (node.body) {
            this.analyzeNode(node.body);
        }
    }

    analyzeForStatement(node) {
        this.enterScope('block');

        if (node.init) {
            this.analyzeNode(node.init);
        }

        if (node.test) {
            this.analyzeNode(node.test);

            if (this.isAlwaysFalsy(node.test)) {
                this.addWarning('La condición del bucle for siempre es falsa, el bucle no se ejecutará', node);
            }
        }

        if (node.update) {
            this.analyzeNode(node.update);
        }

        if (node.body) {
            this.analyzeNode(node.body);
        }

        this.exitScope();
    }

        analyzeReturnStatement(node) {
            let returnType = 'undefined'; // Si es un 'return;' vacío

            if (node.argument) {
                // Analizamos la expresión que se está retornando
                const typeInfo = this.analyzeNode(node.argument);
                if (typeInfo) {
                    returnType = typeInfo.type;
                }
            }

            // Actualizamos la información de la función actual en la pila
            if (this.functionStack.length > 0) {
                const currentFunctionInfo = this.functionStack[this.functionStack.length - 1];
                currentFunctionInfo.hasReturn = true;

                // Buscamos el símbolo de la función en el ámbito padre para actualizarlo
                const functionSymbol = this.currentScope.parent.lookup(currentFunctionInfo.name);
                if (functionSymbol) {
                    functionSymbol.returnType = returnType;
                }
            } else {
                this.addError('La sentencia "return" está fuera de una función', node);
            }
        }

    analyzeArrayExpression(node) {
        if (node.elements) {
            node.elements.forEach(element => {
                if (element) {
                    this.analyzeNode(element);
                }
            });
        }
    }

    analyzeObjectExpression(node) {
        const keys = new Set();

        if (node.properties) {
            node.properties.forEach(property => {
                if (property.key) {
                    let keyName = null;
                    if (property.key.type === 'Identifier') {
                        keyName = property.key.name;
                    } else if (property.key.type === 'Literal') {
                        keyName = property.key.value;
                    }

                    if (keyName !== null) {
                        if (keys.has(keyName)) {
                            this.addWarning(`Clave duplicada '${keyName}' en literal de objeto`, property);
                        }
                        keys.add(keyName);
                    }
                }

                if (property.value) {
                    this.analyzeNode(property.value);
                }
            });
        }
    }

                analyzeArrowFunction(node) {
                this.enterScope('function'); // Las arrow functions crean un ámbito

                // Los parámetros se añaden al nuevo ámbito
                node.params.forEach(param => {
                    // ... lógica para definir parámetros
                });

                // Analizar el cuerpo
                this.analyzeNode(node.body);
                
                this.exitScope();
            }

    // Añade estos dos nuevos métodos a tu clase SemanticAnalyzer

        analyzeClassDeclaration(node) {
            if (node.id) {
                // Define el nombre de la clase en el ámbito actual
                this.currentScope.define(node.id.name, {
                    type: 'class',
                    initialized: true,
                    used: false, // Se marcará si se usa con 'new'
                    line: node.loc.start.line,
                    column: node.loc.start.column
                });
            }

            // Entra a un nuevo ámbito para la clase
            this.enterScope('class');
            
            // Analiza el cuerpo de la clase (que contendrá MethodDefinition)
            if (node.body && node.body.body) {
                node.body.body.forEach(method => this.analyzeNode(method));
            }
            
            this.exitScope();
        }

        analyzeNewExpression(node) {
            // Analiza la clase que se está instanciando (ej. 'Calculator')
            if (node.callee) {
                this.analyzeNode(node.callee);
            }
            // Analiza los argumentos del constructor
            if (node.arguments) {
                node.arguments.forEach(arg => this.analyzeNode(arg));
            }
        }



    analyzeLiteral(node) {
        return { type: typeof node.value };
    }

    analyzeTemplateLiteral(node) {
        return { type: 'string' };
    }

    checkArithmeticCompatibility(left, right, node) {
  
        if (left && left.type === 'Literal' && typeof left.value === 'string' &&
            right && right.type === 'Literal' && typeof right.value === 'number') {
            this.addWarning('La adición de una cadena y un número puede producir resultados inesperados', node);
        }
    }

    checkNumericOperation(left, right, node) {
        // Check if operands are likely to be numeric
        if (left && left.type === 'Literal' && typeof left.value === 'string') {
            this.addWarning('Operación numérica en valor de cadena', node);
        }
        if (right && right.type === 'Literal' && typeof right.value === 'string') {
            this.addWarning('Operación numérica en valor de cadena', node);
        }
    }

    checkComparisonCompatibility(left, right, node) {
        // Check for potential type coercion issues
        if (left && right &&
            left.type === 'Literal' && right.type === 'Literal' &&
            typeof left.value !== typeof right.value) {
            this.addWarning('Comparar diferentes tipos puede producir resultados inesperados', node);
        }
    }

    isAlwaysTruthy(node) {
        if (!node) return false;

        if (node.type === 'Literal') {
            return !!node.value && node.value !== 0 && node.value !== '';
        }

        if (node.type === 'Identifier' && node.name === 'true') {
            return true;
        }

        return false;
    }

    isAlwaysFalsy(node) {
        if (!node) return false;

        if (node.type === 'Literal') {
            return !node.value || node.value === 0 || node.value === '';
        }

        if (node.type === 'Identifier' && (node.name === 'false' || node.name === 'undefined' || node.name === 'null')) {
            return true;
        }

        return false;
    }

    checkUnusedVariables() {
        const checkScope = (scope) => {
            scope.symbols.forEach((info, name) => {
                if (!info.used && !info.builtin && info.kind !== 'function') {
                    this.addWarning(`La variable '${name}' está declarada pero nunca se utiliza`, {
                        line: info.line,
                        column: info.column
                    });
                }
            });

            scope.children.forEach(child => checkScope(child));
        };

        checkScope(this.globalScope);
    }

    generateReport() {
        let report = "=== ANÁLISIS SEMÁNTICO ===\n\n";

        report += `Errores semánticos: ${this.errors.length}\n`;
        report += `Advertencias: ${this.warnings.length}\n\n`;

        if (this.errors.length > 0) {
            report += "ERRORES SEMÁNTICOS:\n";
            this.errors.forEach((error, index) => {
                report += `${index + 1}. [Línea ${error.line}, Columna ${error.column}] ${error.message}\n`;
                if (error.node !== 'unknown') {
                    report += `   Tipo de nodo: ${error.node}\n`;
                }
            });
            report += "\n";
        }

        if (this.warnings.length > 0) {
            report += "ADVERTENCIAS:\n";
            this.warnings.forEach((warning, index) => {
                report += `${index + 1}. [Línea ${warning.line}, Columna ${warning.column}] ${warning.message}\n`;
                if (warning.node !== 'unknown') {
                    report += `   Tipo de nodo: ${warning.node}\n`;
                }
            });
            report += "\n";
        }

        // Symbol table report
        report += "TABLA DE SÍMBOLOS:\n";
        report += "Nombre\t\t\tTipo\t\tÁmbito\t\tUsado\tInicializado\n";
        report += "─".repeat(80) + "\n";


        const generateSymbolReport = (scope, scopeName, depth = 0) => {
            const indent = "  ".repeat(depth);
            scope.symbols.forEach((info, name) => {
                if (!info.builtin) {
                    const nameCol = (indent + name).padEnd(24);

                    // --- LÍNEA CORREGIDA ---
                    // Usamos 'kind' (o 'type' como respaldo si aún existe en algún lado)
                    const kindToDisplay = info.kind || info.type || 'desconocido'; 
                    const typeCol = kindToDisplay.padEnd(12);
                    // --- FIN DE LA CORRECCIÓN ---

                    const scopeCol = scopeName.padEnd(12);
                    const usedCol = info.used ? "✓" : "✗";
                    const initCol = info.initialized ? "✓" : "✗";

                    report += `${nameCol}\t${typeCol}\t${scopeCol}\t${usedCol}\t${initCol}\n`;
                }
            });

            scope.children.forEach((child, index) => {
                const childName = `${scopeName}.${child.scopeType}${index}`;
                generateSymbolReport(child, childName, depth + 1);
            });
        };

        generateSymbolReport(this.globalScope, "global");

        // Statistics
        report += "\nESTADÍSTICAS:\n";
        const allSymbols = this.globalScope.getAllSymbols();
        const stats = {
            variables: 0,
            constants: 0,
            functions: 0,
            parameters: 0,
            unused: 0
        };

        const countSymbols = (scope) => {
            scope.symbols.forEach((info) => {
                if (!info.builtin) {
           switch (info.kind) { // Usamos info.kind en lugar de info.type
                case 'let':
                case 'var':
                    stats.variables++;
                    break;
                case 'const':
                    stats.constants++;
                    break;
                case 'function':
                case 'class': // Las clases también cuentan como funciones en este contexto
                    stats.functions++;
                    break;
                case 'parameter':
                    stats.parameters++;
                    break;
            }

                    if (!info.used) {
                        stats.unused++;
                    }
                }
            });

            scope.children.forEach(child => countSymbols(child));
        };

        countSymbols(this.globalScope);

        report += `Variables: ${stats.variables}\n`;
        report += `Constantes: ${stats.constants}\n`;
        report += `Funciones: ${stats.functions}\n`;
        report += `Parámetros: ${stats.parameters}\n`;
        report += `Símbolos sin usar: ${stats.unused}\n`;

        return report;
    }
}


// Main semantic analysis function - MODIFICADA
export function analyzeSemantics(ast) { // <--- AHORA RECIBE EL AST
    try {
        // Si no hay AST (por un error de sintaxis), no hagas nada.
        if (!ast) {
            return {
                result: "No se pudo realizar el análisis semántico porque el código contiene errores de sintaxis.",
                errorCount: 0,
                warningCount: 0,
                errors: [],
                warnings: []
            };
        }

        const analyzer = new SemanticAnalyzer();
        analyzer.analyzeNode(ast); 

        const report = analyzer.generateReport();

        return {
            result: report,
            errorCount: analyzer.errors.length,
            warningCount: analyzer.warnings.length,
            errors: analyzer.errors,
            warnings: analyzer.warnings,
            symbolTable: analyzer.globalScope
        };

    } catch (error) {
        return {
            result: `Error crítico durante el análisis semántico: ${error.message}\n\nStack trace:\n${error.stack}`,
            errorCount: 1,
            warningCount: 0,
            errors: [{ message: error.message, line: 0, column: 0 }],
            warnings: []
        };
    }
}
