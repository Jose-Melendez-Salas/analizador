import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
// Importaciones de lógica existentes:
import { analyzeLexicalSyntactic } from "./lexer-parser.js";
import { analyzeSemantics } from "./semantic-analyzer.js";
// --- NUEVAS IMPORTACIONES ---
import { QuadrupleGenerator } from "./intermediate-gen.js";
import { optimizeCode } from "./optimizer.js";

import {
  Code2, Play, RotateCcw, Upload, Download, Settings,
  AlertCircle, CheckCircle2, XCircle, AlertTriangle,
  Terminal, ChevronUp, ChevronDown, Maximize2, Minimize2,
  FileText, Zap, Brain, Search, Moon, Sun, Palette,
  Layers, Rocket // <--- Iconos agregados para las nuevas fases
} from "lucide-react";

// --- COMPONENTE AUXILIAR PARA VISUALIZAR TABLAS (NUEVO) ---
const QuadrupleTable = ({ data, emptyMessage }) => {
  if (!data || data.length === 0) {
    return <span className="text-slate-500 italic">{emptyMessage}</span>;
  }
  return (
    <div className="flex flex-col h-full w-full border border-slate-700 rounded-lg overflow-hidden">
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-slate-800 text-slate-300 sticky top-0">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Op</th>
              <th className="px-4 py-2">Arg1</th>
              <th className="px-4 py-2">Arg2</th>
              <th className="px-4 py-2">Res</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700 bg-slate-900/50">
            {data.map((row, i) => (
              <tr key={i} className={`hover:bg-slate-800/50 transition-colors ${row.op === 'LABEL' || row.op.startsWith('FUNC') ? 'bg-blue-900/20' : ''}`}>
                <td className="px-4 py-1 text-slate-500 font-mono text-xs">{i}</td>
                <td className={`px-4 py-1 font-mono font-bold ${row.op === 'GOTO' || row.op === 'JUMP_IF_FALSE' ? 'text-pink-400' :
                  row.op === 'LABEL' ? 'text-blue-400' :
                    'text-emerald-400'
                  }`}>{row.op}</td>
                <td className="px-4 py-1 font-mono text-slate-300">{row.arg1 !== null ? String(row.arg1) : '-'}</td>
                <td className="px-4 py-1 font-mono text-slate-300">{row.arg2 !== null ? String(row.arg2) : '-'}</td>
                <td className="px-4 py-1 font-mono text-purple-400">{row.res !== null ? String(row.res) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function IDE() {
  // Estados existentes (MANTENIDOS IGUAL)
  const [code, setCode] = useState(`//  Analizador de JavaScript Avanzado
// Ejemplo de código con diferentes construcciones

class Calculator {
  constructor() {
    this.history = [];
    this.precision = 2;
  }
  
  add(a, b) {
    const result = a + b;
    this.history.push(\`\${a} + \${b} = \${result}\`);
    return parseFloat(result.toFixed(this.precision));
  }
  
  // Error semántico intencional
  divide(a, b) {
    if (b === 0) {
      console.warn("División por cero detectada");
      return Infinity;
    }
    return a / b;
  }
}

// Uso de la clase
const calc = new Calculator();
const sum = calc.add(10, 5);
const division = calc.divide(10, 0);

// Variable no declarada (error semántico)
console.log(undeclaredVariable);

// Función con closure
function createCounter() {
  let count = 0;
  return function() {
    return ++count;
  };
}

const counter = createCounter();
console.log("Contador:", counter());`);

  const [lexicalResult, setLexicalResult] = useState("");
  const [syntacticResult, setSyntacticResult] = useState("");
  const [semanticResult, setSemanticResult] = useState("");

  // --- NUEVOS ESTADOS ---
  const [intermediateCode, setIntermediateCode] = useState([]);
  const [optimizedCode, setOptimizedCode] = useState([]);
  // ----------------------

  const [analysisStats, setAnalysisStats] = useState(null);
  const [activePanel, setActivePanel] = useState("editor");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [showStats, setShowStats] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const editorRef = useRef(null);

  // Análisis automático cuando cambia el código (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (code.trim()) {
        handleRunAnalysis(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [code]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.js') || file.name.endsWith('.txt'))) {
      const reader = new FileReader();
      reader.onload = () => setCode(reader.result);
      reader.readAsText(file);
    } else {
      alert('Por favor, selecciona un archivo .js o .txt');
    }
  };

  const handleRunAnalysis = async (silent = false) => {
    if (!silent) setIsAnalyzing(true);

    try {
      // 1. Análisis léxico y sintáctico
      const lexSyntaxResults = analyzeLexicalSyntactic(code);
      setLexicalResult(lexSyntaxResults.lexicalResult);
      setSyntacticResult(lexSyntaxResults.syntacticResult);

      const ast = lexSyntaxResults.ast;

      // 2. Análisis semántico
      let semResults = { result: "", errorCount: 0, warningCount: 0 };

      // Verificamos AST antes de continuar
      if (ast) {
        semResults = analyzeSemantics(ast);
        setSemanticResult(semResults.result);

        // --- LÓGICA AGREGADA: INTERMEDIO Y OPTIMIZACIÓN ---
        // Solo ejecutamos si no hay errores sintácticos graves
        if (lexSyntaxResults.syntaxErrors === 0) {
          const generator = new QuadrupleGenerator();
          const quads = generator.generate(ast);

          // Auditoría en consola
          console.log("--- CÓDIGO INTERMEDIO ---");
          console.table(quads);

          setIntermediateCode(quads);

          // Optimización
          const optQuads = optimizeCode(quads);
          setOptimizedCode(optQuads);
        } else {
          // Si hay errores, limpiamos las tablas siguientes
          setIntermediateCode([]);
          setOptimizedCode([]);
        }
        // --------------------------------------------------
      }

      // 3. Estadísticas
      const stats = {
        lexicalErrors: lexSyntaxResults.lexicalErrors || 0,
        syntaxErrors: lexSyntaxResults.syntaxErrors || 0,
        semanticErrors: semResults.errorCount || 0,
        warnings: semResults.warningCount || 0,
        linesOfCode: code.split('\n').length,
        tokens: lexSyntaxResults.tokenCount || 0,
        characters: code.length,
        words: code.split(/\s+/).filter(word => word.length > 0).length
      };

      setAnalysisStats(stats);

      if (!silent && (stats.syntaxErrors > 0 || stats.semanticErrors > 0)) {
        if (stats.semanticErrors > 0) setActivePanel("semantic");
        else if (stats.syntaxErrors > 0) setActivePanel("syntactic");
      }

    } catch (error) {
      const errorMsg = "Error durante el análisis: " + error.message;
      setLexicalResult(errorMsg);
      setSyntacticResult(errorMsg);
      setSemanticResult(errorMsg);
    } finally {
      if (!silent) {
        setTimeout(() => setIsAnalyzing(false), 800);
      }
    }
  };

  const handleClearCode = () => {
    setCode("");
    setLexicalResult("");
    setSyntacticResult("");
    setSemanticResult("");
    // Limpiar nuevos estados
    setIntermediateCode([]);
    setOptimizedCode([]);
    setAnalysisStats(null);
  };

  const downloadResults = () => {
    const results = `ANÁLISIS DE CÓDIGO JAVASCRIPT
================================

CÓDIGO ANALIZADO:
${code}

ANÁLISIS LÉXICO:
${lexicalResult}

ANÁLISIS SINTÁCTICO:
${syntacticResult}

ANÁLISIS SEMÁNTICO:
${semanticResult}

ESTADÍSTICAS:
- Líneas: ${analysisStats?.linesOfCode || 0}
- Tokens: ${analysisStats?.tokens || 0}
- Caracteres: ${analysisStats?.characters || 0}
- Errores léxicos: ${analysisStats?.lexicalErrors || 0}
- Errores sintácticos: ${analysisStats?.syntaxErrors || 0}
- Errores semánticos: ${analysisStats?.semanticErrors || 0}
- Advertencias: ${analysisStats?.warnings || 0}
`;

    const blob = new Blob([results], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analisis-javascript-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (errors) => {
    if (errors === 0) return "text-emerald-400";
    if (errors < 3) return "text-yellow-400";
    return "text-red-400";
  };

  const getStatusIcon = (errors) => {
    if (errors === 0) return <CheckCircle2 className="text-emerald-400" size={18} />;
    if (errors < 3) return <AlertTriangle className="text-yellow-400" size={18} />;
    return <XCircle className="text-red-400" size={18} />;
  };

  const panels = [
    { id: "lexical", name: "Léxico", icon: Zap, color: "blue", result: lexicalResult, type: "text" },
    { id: "syntactic", name: "Sintáctico", icon: Search, color: "emerald", result: syntacticResult, type: "text" },
    { id: "semantic", name: "Semántico", icon: Brain, color: "purple", result: semanticResult, type: "text" },
    // --- NUEVOS PANELES AGREGADOS ---
    { id: "intermediate", name: "Intermedio", icon: Layers, color: "orange", result: intermediateCode, type: "table" },
    { id: "optimized", name: "Optimizado", icon: Rocket, color: "pink", result: optimizedCode, type: "table" }
  ];

  return (
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} transition-colors duration-300`}>

      {/* Header Principal */}
      <header className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} border-b px-6 py-4 flex items-center justify-between transition-colors duration-300`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Code2 className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                JavaScript Analyzador muy analítico
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Controles de análisis */}
          <div className="flex items-center gap-2 mr-4">
            <button
              onClick={() => handleRunAnalysis(false)}
              disabled={isAnalyzing}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow-lg disabled:opacity-50"
            >
              {isAnalyzing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <Play size={16} fill="white" />
              )}
              {isAnalyzing ? 'Analizando...' : 'Analizar'}
            </button>

            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>
              <Upload size={16} />
              Subir
              <input
                type="file"
                accept=".js,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            <button
              onClick={handleClearCode}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              <RotateCcw size={16} />
              Limpiar
            </button>
          </div>

          {/* Controles de tema */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Barra de estadísticas mejorada */}
      {analysisStats && showStats && (
        <div className={`${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/50 border-slate-200'} border-b px-6 py-3 transition-colors duration-300`}>
          <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
            <div className="flex items-center gap-2">
              {getStatusIcon(analysisStats.lexicalErrors)}
              <span className={`text-sm font-medium ${getStatusColor(analysisStats.lexicalErrors)}`}>
                Léxico: {analysisStats.lexicalErrors}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(analysisStats.syntaxErrors)}
              <span className={`text-sm font-medium ${getStatusColor(analysisStats.syntaxErrors)}`}>
                Sintáctico: {analysisStats.syntaxErrors}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(analysisStats.semanticErrors)}
              <span className={`text-sm font-medium ${getStatusColor(analysisStats.semanticErrors)}`}>
                Semántico: {analysisStats.semanticErrors}
              </span>
            </div>
            {analysisStats.warnings > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-400" size={16} />
                <span className="text-sm font-medium text-amber-400">
                  Advertencias: {analysisStats.warnings}
                </span>
              </div>
            )}
            <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {analysisStats.linesOfCode} líneas
            </div>
            <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {analysisStats.tokens} tokens
            </div>
            <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {analysisStats.characters.toLocaleString()} caracteres
            </div>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex flex-1 overflow-hidden">

        {/* Panel lateral de navegación */}
        {!sidebarCollapsed && (
          <div className={`w-64 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} border-r flex flex-col transition-colors duration-300`}>
            <div className="p-4">
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Análisis
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setActivePanel("editor")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activePanel === "editor"
                    ? `${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-900'}`
                    : `${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`
                    }`}
                >
                  <FileText size={18} />
                  Editor
                </button>

                {panels.map(panel => {
                  const Icon = panel.icon;
                  const hasErrors = analysisStats && (
                    (panel.id === "lexical" && analysisStats.lexicalErrors > 0) ||
                    (panel.id === "syntactic" && analysisStats.syntaxErrors > 0) ||
                    (panel.id === "semantic" && analysisStats.semanticErrors > 0)
                  );

                  return (
                    <button
                      key={panel.id}
                      onClick={() => setActivePanel(panel.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activePanel === panel.id
                        ? `bg-${panel.color}-500 text-white`
                        : `${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`
                        }`}
                    >
                      <Icon size={18} />
                      {panel.name}
                      {hasErrors && (
                        <div className="ml-auto">
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 mt-auto border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowStats(!showStats)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
              >
                <Palette size={16} />
                {showStats ? 'Ocultar stats' : 'Mostrar stats'}
              </button>
            </div>
          </div>
        )}

        {/* Botón para colapsar sidebar */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`fixed top-1/2 left-${sidebarCollapsed ? '0' : '64'} transform -translate-y-1/2 z-10 p-2 rounded-r-lg ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} transition-all duration-300`}
          style={{ left: sidebarCollapsed ? '0' : '256px' }}
        >
          {sidebarCollapsed ? <ChevronUp className="rotate-90" size={16} /> : <ChevronDown className="rotate-90" size={16} />}
        </button>

        {/* Área de contenido principal */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Editor */}
          {activePanel === "editor" && (
            <div className="flex-1">
              <Editor
                height="100%"
                language="javascript"
                value={code}
                onChange={(value) => setCode(value || "")}
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                options={{
                  fontSize: 14,
                  minimap: { enabled: true },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  lineNumbers: "on",
                  tabSize: 2,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  renderLineHighlight: "all",
                  bracketPairColorization: { enabled: true },
                }}
                onMount={(editor) => (editorRef.current = editor)}
              />
            </div>
          )}

          {/* Paneles de análisis */}
          {panels.map(panel => {
            if (activePanel !== panel.id) return null;

            const Icon = panel.icon;
            return (
              <div key={panel.id} className="flex-1 flex flex-col p-6 overflow-hidden h-full">
                <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                  <div className={`p-2 bg-${panel.color}-500 rounded-lg`}>
                    <Icon className="text-white" size={20} />
                  </div>
                  <h2 className="text-xl font-bold">Análisis {panel.name}</h2>
                </div>

                <div className="flex-1 overflow-hidden">
                  {/* VISUALIZACIÓN CONDICIONAL: TABLA O TEXTO */}
                  {panel.type === "table" ? (
                    <div className={`h-full w-full p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'} overflow-hidden`}>
                      <QuadrupleTable
                        data={panel.result}
                        emptyMessage={isAnalyzing ? "Procesando..." : "Ejecuta el análisis para generar este código."}
                      />
                    </div>
                  ) : (
                    <pre className={`h-full w-full overflow-auto p-4 rounded-lg text-sm font-mono leading-relaxed ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} border transition-colors duration-300`}>
                      {panel.result || (
                        <span className={`${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                          {isAnalyzing ? 'Analizando código...' : 'Ejecuta el análisis para ver los resultados'}
                        </span>
                      )}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default IDE;