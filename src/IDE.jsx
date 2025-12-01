import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";

// --- IMPORTACIONES DE LÓGICA ---
import { analyzeLexicalSyntactic } from "./lexer-parser.js";
import { analyzeSemantics } from "./semantic-analyzer.js";
import { QuadrupleGenerator } from "./intermediate-gen.js";
import { optimizeCode } from "./optimizer.js";
import { executeSafeCode } from "./executor.js";

import {
  Play, RotateCcw, FolderOpen, Search, GitBranch,
  Settings, XCircle, AlertTriangle, CheckCircle2,
  Terminal, MoreHorizontal, ChevronDown, ChevronRight,
  FileJson, X, FileCode, Plus, Save, Copy, Scissors, Clipboard,
  Bug, FilePlus, Trash2, Info, Edit3, Circle, Command, Menu
} from "lucide-react";

function IDE() {
  // --- 1. GESTIÓN DE ARCHIVOS ---
  const [files, setFiles] = useState([
    {
      id: 1,
      name: 'main.js',
      language: 'javascript',
      content: `// VS Code Clone - Responsive Edition\n\nfunction sistema() {\n  return "Funciona en Desktop y Movil";\n}\n\nconsole.log(sistema());`,
      isDirty: false
    }
  ]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  // --- 2. ESTADOS DE INTERFAZ ---
  const [sidebarVisible, setSidebarVisible] = useState(true); // Controla visibilidad del explorer
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeMenu, setActiveMenu] = useState(null);
  const [bottomTab, setBottomTab] = useState("terminal");
  const [contextMenu, setContextMenu] = useState(null);
  const [renamingFileId, setRenamingId] = useState(null);
  const [tempName, setTempName] = useState("");
  const [cursorPosition, setCursorPosition] = useState({ ln: 1, col: 1 });

  // --- 3. ESTADOS DEL COMPILADOR ---
  const [terminalOutput, setTerminalOutput] = useState([
    "Microsoft Windows [Version 10.0.19045] - JS Compiler Shell",
    "(c) Microsoft Corporation. All rights reserved.",
    "",
    "C:\\Users\\Dev\\Project> "
  ]);
  const [terminalInput, setTerminalInput] = useState("");
  const [problems, setProblems] = useState([]);
  const [outputLog, setOutputLog] = useState([]);
  const [debugLog, setDebugLog] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStats, setAnalysisStats] = useState(null);

  // Refs
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const terminalRef = useRef(null);

  // --- DETECCIÓN RESPONSIVA ---
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarVisible(false); // Ocultar sidebar por defecto en móvil
      else setSidebarVisible(true); // Mostrar en escritorio
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Check inicial
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- LÓGICA COMPILADOR ---
  const executeCompilation = async (fileObj) => {
    setIsAnalyzing(true);
    const code = fileObj.content;

    setProblems([]);
    setDebugLog([]);
    setOutputLog(prev => [...prev, `[Running] node "${fileObj.name}"`]);

    try {
      const lexSyntax = analyzeLexicalSyntactic(code);
      let semErrors = 0;
      let newProblems = [];

      if (lexSyntax.lexicalErrors > 0) newProblems.push({ line: 1, message: "Errores Léxicos", type: "error" });
      if (lexSyntax.syntaxErrors > 0) newProblems.push({ line: 1, message: "Errores Sintácticos", type: "error" });

      if (lexSyntax.ast) {
        const semResult = analyzeSemantics(lexSyntax.ast);
        semErrors = semResult.errorCount;
        if (semErrors > 0) newProblems.push({ line: 1, message: "Errores Semánticos", type: "error" });

        if (lexSyntax.syntaxErrors === 0) {
          const gen = new QuadrupleGenerator();
          const quads = gen.generate(lexSyntax.ast);
          optimizeCode(quads);

          setDebugLog([`Target: ${fileObj.name}`, "Optimization: Done"]);

          const logs = executeSafeCode(code);
          setOutputLog(prev => [...prev, `[Done] exited with code=0`]);
          return { success: true, logs: logs };
        } else {
          setOutputLog(prev => [...prev, `[Done] exited with code=1`]);
          return { success: false, logs: ["❌ Build Failed: Syntax Error"] };
        }
      } else {
        return { success: false, logs: ["❌ Fatal Error: Could not parse AST"] };
      }

      setProblems(newProblems);
      setAnalysisStats({
        errors: (lexSyntax.syntaxErrors || 0) + semErrors,
        warnings: 0,
        lines: code.split('\n').length
      });

    } catch (err) {
      return { success: false, logs: [`Stack Trace: ${err.message}`] };
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTerminalInput = async (e) => {
    if (e.key === 'Enter') {
      const input = terminalInput.trim();
      setTerminalOutput(prev => [...prev, `> ${input}`]);
      setTerminalInput("");

      if (!input) return;

      const args = input.split(' ');
      const cmd = args[0].toLowerCase();
      const param = args[1];

      switch (cmd) {
        case 'help': setTerminalOutput(prev => [...prev, "Commands: node, ls, cat, clear, echo"]); break;
        case 'cls':
        case 'clear': setTerminalOutput([]); break;
        case 'ls':
        case 'dir': setTerminalOutput(prev => [...prev, ...files.map(f => `${f.name}  ${f.isDirty ? '*' : ''}`)]); break;
        case 'cat':
          if (!param) setTerminalOutput(prev => [...prev, "Error: missing filename"]);
          else {
            const f = files.find(file => file.name === param);
            if (f) setTerminalOutput(prev => [...prev, ...f.content.split('\n')]);
            else setTerminalOutput(prev => [...prev, `File not found`]);
          }
          break;
        case 'node':
          const target = param ? files.find(f => f.name === param) : files[activeFileIndex];
          if (target) {
            const res = await executeCompilation(target);
            setTerminalOutput(prev => [...prev, ...res.logs.map(l => l.replace('> ', '')), ""]);
            if (!res.success) setBottomTab('problems');
          } else setTerminalOutput(prev => [...prev, `Error: Module not found`]);
          break;
        default: setTerminalOutput(prev => [...prev, `'${cmd}' unknown command.`]);
      }
      setTimeout(() => { if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight; }, 50);
    }
  };

  // --- GESTIÓN DE ARCHIVOS Y UI ---
  const handleContextMenu = (e, index) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, fileIndex: index });
  };

  const startRenaming = (e) => {
    e.stopPropagation();
    const fileToRename = files[contextMenu.fileIndex];
    setRenamingId(fileToRename.id);
    setTempName(fileToRename.name);
    setContextMenu(null);
  };

  const saveRename = () => {
    if (tempName.trim()) {
      const updatedFiles = [...files];
      const target = updatedFiles.find(f => f.id === renamingFileId);
      if (target) {
        target.name = tempName;
        target.language = tempName.endsWith('.json') ? 'json' : 'javascript';
        setFiles(updatedFiles);
      }
    }
    setRenamingId(null);
  };

  const handleNewFile = () => {
    const newId = Date.now();
    const newFile = { id: newId, name: 'Untitled.js', language: 'javascript', content: '// New File\n', isDirty: true };
    setFiles([...files, newFile]);
    setActiveFileIndex(files.length);
    setRenamingId(newId);
    setTempName("Untitled.js");
    setActiveMenu(null);
    if (isMobile) setSidebarVisible(false); // Cerrar sidebar en móvil al crear
  };

  const handleEditorChange = (value) => {
    const updatedFiles = [...files];
    updatedFiles[activeFileIndex].content = value || "";
    updatedFiles[activeFileIndex].isDirty = true;
    setFiles(updatedFiles);
  };

  const handleSave = () => {
    const updatedFiles = [...files];
    updatedFiles[activeFileIndex].isDirty = false;
    setFiles(updatedFiles);
    setOutputLog(prev => [...prev, `[Saved] ${files[activeFileIndex].name}`]);
    setActiveMenu(null);
  };

  const handleCloseFile = (e, index) => {
    if (e) e.stopPropagation();
    if (files.length === 1) {
      setFiles([{ ...files[0], content: "", name: "Untitled-1.js", isDirty: false }]);
      return;
    }
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    if (index === activeFileIndex) setActiveFileIndex(0);
    else if (index < activeFileIndex) setActiveFileIndex(activeFileIndex - 1);
  };

  const handleDeleteFile = () => {
    if (contextMenu) {
      handleCloseFile(null, contextMenu.fileIndex);
      setContextMenu(null);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFiles([...files, { id: Date.now(), name: file.name, language: file.name.endsWith('.json') ? 'json' : 'javascript', content: reader.result, isDirty: false }]);
        setActiveFileIndex(files.length);
      };
      reader.readAsText(file);
    }
  };

  const runActiveFile = () => {
    executeCompilation(files[activeFileIndex]).then(res => {
      setTerminalOutput(prev => [...prev, ...res.logs.map(l => l.replace('> ', '')), ""]);
      if (!res.success) setBottomTab('problems');
    });
  };

  // Helpers UI
  const DropdownMenu = ({ type, children }) => activeMenu !== type ? null : <div className="absolute top-7 left-0 bg-[#252526] border border-[#454545] shadow-xl rounded-b-md z-50 min-w-[200px] py-1">{children}</div>;
  const MenuItem = ({ label, shortcut, icon: Icon, onClick }) => (
    <div className="px-3 py-1.5 flex items-center justify-between text-xs cursor-pointer hover:bg-[#094771] hover:text-white text-[#cccccc]" onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}>
      <div className="flex items-center gap-2">{Icon && <Icon size={14} />} <span>{label}</span></div>
      {shortcut && <span className="text-gray-500 text-[10px] ml-4">{shortcut}</span>}
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#1e1e1e] text-[#cccccc] flex flex-col font-sans overflow-hidden select-none" onClick={() => { setActiveMenu(null); setContextMenu(null); }}>

      {/* 1. TITLE BAR RESPONSIVA */}
      <div className="h-10 md:h-8 bg-[#3c3c3c] flex items-center justify-between px-2 md:px-3 text-xs border-b border-[#252526] flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-4 h-full">
          {/* Botón Menu Móvil */}
          <button className="md:hidden p-1 hover:bg-[#505050] rounded" onClick={() => setSidebarVisible(!sidebarVisible)}>
            <Menu size={18} />
          </button>

          <img src="https://upload.wikimedia.org/wikipedia/commons/9/9a/Visual_Studio_Code_1.35_icon.svg" alt="VS Code" className="w-5 h-5 hidden md:block mr-1" />

          {/* Menú Desktop (Oculto en móvil para ahorrar espacio) */}
          <ul className="hidden md:flex h-full text-[#cccccc]">
            <li className={`relative px-2 flex items-center hover:bg-[#505050] cursor-pointer ${activeMenu === 'file' ? 'bg-[#505050]' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveMenu('file') }}>
              File
              <DropdownMenu type="file">
                <MenuItem label="New File" shortcut="Ctrl+N" icon={FilePlus} onClick={handleNewFile} />
                <MenuItem label="Open File..." shortcut="Ctrl+O" icon={FolderOpen} onClick={() => fileInputRef.current.click()} />
                <div className="h-[1px] bg-[#454545] my-1 mx-2"></div>
                <MenuItem label="Save" shortcut="Ctrl+S" icon={Save} onClick={handleSave} />
              </DropdownMenu>
            </li>
            <li className={`relative px-2 flex items-center hover:bg-[#505050] cursor-pointer ${activeMenu === 'run' ? 'bg-[#505050]' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveMenu('run') }}>
              Run
              <DropdownMenu type="run">
                <MenuItem label="Run Without Debugging" shortcut="Ctrl+F5" icon={Play} onClick={runActiveFile} />
              </DropdownMenu>
            </li>
          </ul>
        </div>

        <div className="text-gray-400 text-[11px] font-medium truncate max-w-[150px] md:max-w-none">{files[activeFileIndex].name}</div>

        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#f1fa8c]"></div>
          <div className="w-3 h-3 rounded-full bg-[#50fa7b]"></div>
          <div className="w-3 h-3 rounded-full bg-[#ff5555]"></div>
        </div>
      </div>

      {/* 2. WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* A. ACTIVITY BAR (Oculta en móvil) */}
        <div className="hidden md:flex w-12 bg-[#333333] flex-col items-center py-2 gap-4 border-r border-[#252526] z-10 flex-shrink-0">
          <div className="border-l-2 pl-3 w-full flex justify-center cursor-pointer border-white opacity-100"><FileCode size={24} className="text-white" /></div>
          <Search size={24} className="text-gray-500 opacity-60 hover:opacity-100 cursor-pointer" />
          <GitBranch size={24} className="text-gray-500 opacity-60 hover:opacity-100 cursor-pointer" />
          <div className="mt-auto mb-2"><Settings size={24} className="text-gray-500 opacity-60 hover:opacity-100 cursor-pointer" /></div>
        </div>

        {/* B. SIDEBAR (DRAWER EN MÓVIL, COLUMNA EN DESKTOP) */}
        <div className={`
            bg-[#252526] flex flex-col border-r border-[#1e1e1e] transition-all duration-300 z-20
            ${isMobile ? 'absolute top-0 bottom-0 left-0 shadow-2xl' : 'relative'}
            ${sidebarVisible ? 'w-64 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full md:translate-x-0 md:w-0 overflow-hidden'}
        `}>
          <div className="h-9 px-4 flex items-center justify-between text-xs font-bold text-gray-400 uppercase flex-shrink-0">
            <span>Explorer</span>
            <MoreHorizontal size={14} className="cursor-pointer" />
          </div>

          <div className="mt-1 flex-1 overflow-y-auto">
            <div className="px-1 py-1 flex items-center gap-0.5 text-xs font-bold text-gray-300 cursor-pointer hover:bg-[#2a2d2e]">
              <ChevronDown size={14} /> <span>PROJECT</span>
            </div>
            {files.map((file, index) => (
              <div key={file.id}
                onClick={() => { setActiveFileIndex(index); if (isMobile) setSidebarVisible(false); }}
                onContextMenu={(e) => handleContextMenu(e, index)}
                className={`pl-5 py-2 md:py-1 flex items-center gap-1.5 text-xs cursor-pointer border-l-[3px] ${activeFileIndex === index ? 'bg-[#37373d] text-white border-[#007acc]' : 'border-transparent text-gray-400 hover:bg-[#2a2d2e]'}`}
              >
                <FileJson size={14} className={activeFileIndex === index ? "text-[#f1fa8c]" : "text-gray-500"} />
                {renamingFileId === file.id ? (
                  <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} onBlur={saveRename} onKeyDown={(e) => e.key === 'Enter' && saveRename()} autoFocus className="bg-[#3c3c3c] text-white border border-[#007acc] outline-none h-5 w-full px-1" onClick={(e) => e.stopPropagation()} />
                ) : (
                  <span className="truncate flex-1">{file.name} {file.isDirty && "●"}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* BACKDROP PARA CERRAR MENU EN MÓVIL */}
        {isMobile && sidebarVisible && (
          <div className="absolute inset-0 bg-black/50 z-10" onClick={() => setSidebarVisible(false)}></div>
        )}

        {/* C. EDITOR AREA */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] min-w-0">
          {/* TABS (Scrollable horizontalmente) */}
          <div className="h-9 bg-[#252526] flex items-center overflow-x-auto custom-scrollbar border-b border-[#1e1e1e] flex-shrink-0">
            {files.map((file, index) => (
              <div key={file.id} onClick={() => setActiveFileIndex(index)} className={`h-full px-3 min-w-[120px] max-w-[200px] flex items-center gap-2 text-xs cursor-pointer border-r border-[#252526] group whitespace-nowrap ${activeFileIndex === index ? 'bg-[#1e1e1e] text-white border-t border-t-[#007acc]' : 'bg-[#2d2d2d] text-gray-500'}`}>
                <FileJson size={14} className={activeFileIndex === index ? "text-[#f1fa8c]" : "text-gray-600"} />
                <span className={`truncate flex-1 ${file.isDirty ? 'italic text-[#e2c08d]' : ''}`}>{file.name}</span>
                {file.isDirty ? <div className="w-2 h-2 rounded-full bg-white group-hover:hidden min-w-[8px]"></div> : null}
                <X size={14} className={`hover:bg-[#444] rounded p-0.5 ${file.isDirty ? 'hidden group-hover:block' : ''}`} onClick={(e) => handleCloseFile(e, index)} />
              </div>
            ))}
            <div onClick={handleNewFile} className="px-3 h-full flex items-center justify-center hover:bg-[#333] cursor-pointer"><Plus size={16} className="text-gray-500" /></div>
            <div className="ml-auto mr-2 md:mr-4"><button onClick={runActiveFile} className="p-1.5 hover:bg-[#333] rounded text-[#50fa7b]">{isAnalyzing ? <RotateCcw className="animate-spin" size={14} /> : <Play size={14} fill="#50fa7b" />}</button></div>
          </div>

          {/* MONACO EDITOR (Responsivo) */}
          <div className="flex-1 relative min-h-0">
            <Editor
              height="100%"
              language="javascript"
              value={files[activeFileIndex].content}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                fontSize: isMobile ? 12 : 14, // Fuente más chica en móvil
                fontFamily: "'Consolas', monospace",
                minimap: { enabled: !isMobile }, // Sin minimapa en móvil
                automaticLayout: true,
                wordWrap: "on", // Ajuste de línea para pantallas chicas
                lineNumbers: "on"
              }}
              onMount={(editor) => { editorRef.current = editor; editor.onDidChangeCursorPosition((e) => setCursorPosition({ ln: e.position.lineNumber, col: e.position.column })); }}
            />
          </div>

          {/* TERMINAL PANEL (Flexible) */}
          <div className={`bg-[#1e1e1e] border-t border-[#3e3e42] flex flex-col transition-all ${isMobile ? 'h-[35%]' : 'h-[30%]'}`}>
            <div className="h-9 flex items-center px-2 md:px-4 gap-4 md:gap-6 text-[10px] md:text-[11px] font-bold text-gray-500 border-b border-[#252526] overflow-x-auto whitespace-nowrap custom-scrollbar flex-shrink-0">
              <span onClick={() => setBottomTab('problems')} className={`cursor-pointer hover:text-white flex gap-1 ${bottomTab === 'problems' ? 'text-white border-b border-white py-2' : ''}`}>PROBLEMS {problems.length > 0 && <span className="bg-[#3e3e42] text-gray-300 px-1.5 rounded-full">{problems.length}</span>}</span>
              <span onClick={() => setBottomTab('output')} className={`cursor-pointer hover:text-white ${bottomTab === 'output' ? 'text-white border-b border-white py-2' : ''}`}>OUTPUT</span>
              <span onClick={() => setBottomTab('terminal')} className={`cursor-pointer hover:text-white ${bottomTab === 'terminal' ? 'text-white border-b border-white py-2' : ''}`}>TERMINAL</span>
              <span onClick={() => setBottomTab('debug')} className={`cursor-pointer hover:text-white ${bottomTab === 'debug' ? 'text-white border-b border-white py-2' : ''}`}>DEBUG</span>
              <div className="ml-auto flex gap-3 opacity-70"><button onClick={() => setTerminalOutput([])}><RotateCcw size={14} /></button><ChevronDown size={14} /><X size={14} /></div>
            </div>

            <div className="flex-1 p-0 overflow-hidden bg-[#1e1e1e] font-mono text-xs md:text-sm">
              {bottomTab === 'problems' && (
                <div className="h-full overflow-auto p-2">
                  {problems.length === 0 ? <div className="text-gray-500 italic p-2">No problems detected.</div> : problems.map((prob, i) => (
                    <div key={i} className="flex gap-2 hover:bg-[#2a2d2e] p-1 cursor-pointer">
                      <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" /> <div><span className="text-gray-300">{prob.message}</span><span className="text-gray-500 text-[10px] ml-2 block md:inline">[{files[activeFileIndex].name} Ln {prob.line}]</span></div>
                    </div>
                  ))}
                </div>
              )}
              {bottomTab === 'terminal' && (
                <div className="h-full overflow-auto p-2 md:p-3 custom-scrollbar" ref={terminalRef} onClick={() => document.getElementById('term-input')?.focus()}>
                  {terminalOutput.map((l, i) => <div key={i} className="mb-0.5 text-[#cccccc] break-all">{l}</div>)}
                  <div className="flex gap-1 items-center">
                    <span className="text-[#50fa7b] text-xs pt-0.5 shrink-0">Dev{'>'}</span>
                    <input id="term-input" className="bg-transparent border-none outline-none text-gray-200 flex-1 min-w-[50px] text-xs md:text-sm h-5" value={terminalInput} onChange={e => setTerminalInput(e.target.value)} onKeyDown={handleTerminalInput} autoComplete="off" />
                  </div>
                </div>
              )}
              {bottomTab === 'output' && (<div className="h-full overflow-auto p-3 text-gray-300 text-xs custom-scrollbar">{outputLog.map((l, i) => <div key={i}>{l}</div>)}</div>)}
              {bottomTab === 'debug' && (<div className="h-full overflow-auto p-3 text-gray-400 text-xs custom-scrollbar">{debugLog.map((l, i) => <div key={i}>{l}</div>)}</div>)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. STATUS BAR (Ocultar info extra en móvil) */}
      <div className="h-6 bg-[#007acc] flex items-center justify-between px-2 md:px-3 text-[10px] md:text-[11px] text-white z-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 hover:bg-[#1f8ad2] px-1.5 h-full cursor-pointer"><GitBranch size={10} /><span className="hidden md:inline">main*</span></div>
          <div className="flex items-center gap-1 hover:bg-[#1f8ad2] px-1.5 h-full cursor-pointer" onClick={() => setBottomTab('problems')}><XCircle size={11} /> {analysisStats?.errors || 0} <AlertTriangle size={11} className="ml-1" /> {analysisStats?.warnings || 0}</div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {isAnalyzing && <span className="animate-pulse">Building...</span>}
          <span className="hover:bg-[#1f8ad2] px-1 cursor-pointer hidden md:inline">Ln {cursorPosition.ln}, Col {cursorPosition.col}</span>
          <span className="hover:bg-[#1f8ad2] px-1 cursor-pointer">{files[activeFileIndex].language === 'javascript' ? 'JS' : 'JSON'}</span>
        </div>
      </div>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div className="fixed bg-[#252526] border border-[#454545] shadow-2xl py-1 rounded z-[100] min-w-[160px] text-xs text-[#cccccc]" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          <div className="px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer" onClick={startRenaming}>Rename</div>
          <div className="px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer" onClick={() => { alert("Copied path!"); setContextMenu(null) }}>Copy Path</div>
          <div className="h-[1px] bg-[#454545] my-1 mx-2"></div>
          <div className="px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer text-red-400" onClick={handleDeleteFile}>Delete</div>
        </div>
      )}
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".js,.txt" />
    </div>
  );
}

export default IDE;