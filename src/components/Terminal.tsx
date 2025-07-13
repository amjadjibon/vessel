import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TerminalOutput, TerminalEntry, TerminalSession } from '../types/docker';

const Terminal: React.FC = () => {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [currentCommand, setCurrentCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initializeTerminal();
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new entries are added in active session
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    // Focus input when active session changes
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeSessionId]);

  const initializeTerminal = async () => {
    try {
      const homeDir = await invoke<string>('get_home_directory');
      const initialSession = createNewSession(homeDir);
      setSessions([initialSession]);
      setActiveSessionId(initialSession.id);
    } catch (error) {
      console.error('Failed to get home directory:', error);
      const fallbackSession = createNewSession('/');
      setSessions([fallbackSession]);
      setActiveSessionId(fallbackSession.id);
    }
  };

  const createNewSession = (directory?: string): TerminalSession => {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const currentCount = sessions.length + 1; // +1 because we're adding a new one
    const sessionName = `Terminal ${currentCount}`;
    
    return {
      id: sessionId,
      name: sessionName,
      currentDirectory: directory || '/',
      entries: [],
      commandHistory: [],
      historyIndex: -1,
      isActive: true,
    };
  };

  const renumberSessions = (sessionList: TerminalSession[]): TerminalSession[] => {
    return sessionList.map((session, index) => ({
      ...session,
      name: session.name.startsWith('Terminal ') ? `Terminal ${index + 1}` : session.name
    }));
  };

  const addNewSession = async () => {
    try {
      const homeDir = await invoke<string>('get_home_directory');
      const newSession = createNewSession(homeDir);
      setSessions(prev => {
        const updated = [...prev, newSession];
        return renumberSessions(updated);
      });
      setActiveSessionId(newSession.id);
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  };

  const closeSession = (sessionId: string) => {
    setSessions(prev => {
      // Cannot close the last terminal
      if (prev.length <= 1) {
        return prev;
      }

      const sessionIndex = prev.findIndex(s => s.id === sessionId);
      const filtered = prev.filter(s => s.id !== sessionId);
      const renumbered = renumberSessions(filtered);
      
      // If we're closing the active session, switch to the previous one or the first one
      if (sessionId === activeSessionId) {
        const targetIndex = sessionIndex > 0 ? sessionIndex - 1 : 0;
        const newActiveSession = renumbered[targetIndex];
        setActiveSessionId(newActiveSession.id);
      }
      
      return renumbered;
    });
  };

  const getActiveSession = (): TerminalSession | undefined => {
    return sessions.find(s => s.id === activeSessionId);
  };

  const startRenameTab = (sessionId: string, currentName: string) => {
    setEditingTabId(sessionId);
    setEditingTabName(currentName);
  };

  const finishRenameTab = () => {
    if (editingTabId && editingTabName.trim()) {
      setSessions(prev => prev.map(session => 
        session.id === editingTabId 
          ? { ...session, name: editingTabName.trim() }
          : session
      ));
    }
    setEditingTabId(null);
    setEditingTabName('');
  };

  const cancelRenameTab = () => {
    setEditingTabId(null);
    setEditingTabName('');
  };

  const executeCommand = async (command: string) => {
    if (!command.trim()) return;

    const activeSession = getActiveSession();
    if (!activeSession) return;

    const entryId = Date.now().toString();
    const newEntry: TerminalEntry = {
      id: entryId,
      command,
      output: { stdout: '', stderr: '', success: false },
      timestamp: new Date(),
      isExecuting: true,
    };

    // Update the active session with the new entry
    setSessions(prev => prev.map(session => 
      session.id === activeSessionId 
        ? {
            ...session,
            entries: [...session.entries, newEntry],
            commandHistory: [...session.commandHistory, command].slice(-100),
            historyIndex: -1,
          }
        : session
    ));

    setIsExecuting(true);

    try {
      let output: TerminalOutput;

      // Handle built-in commands
      if (command.startsWith('cd ')) {
        const path = command.slice(3).trim();
        if (path) {
          const result = await invoke<string>('change_directory', { path });
          output = {
            stdout: result,
            stderr: '',
            success: true,
            exit_code: 0,
          };
          
          // Update current directory in the active session
          const newDir = await invoke<string>('get_current_directory');
          setSessions(prev => prev.map(session => 
            session.id === activeSessionId 
              ? { ...session, currentDirectory: newDir }
              : session
          ));
        } else {
          output = {
            stdout: '',
            stderr: 'cd: missing path argument',
            success: false,
            exit_code: 1,
          };
        }
      } else if (command === 'pwd') {
        output = {
          stdout: activeSession.currentDirectory,
          stderr: '',
          success: true,
          exit_code: 0,
        };
      } else if (command === 'clear') {
        setSessions(prev => prev.map(session => 
          session.id === activeSessionId 
            ? { ...session, entries: [] }
            : session
        ));
        setIsExecuting(false);
        return;
      } else if (command.startsWith('docker ')) {
        // Handle docker commands specially
        const args = command.slice(7).trim().split(/\s+/);
        output = await invoke<TerminalOutput>('execute_docker_command', { args });
      } else {
        // Execute general command
        output = await invoke<TerminalOutput>('execute_command', { command });
      }

      // Update the entry with the output
      setSessions(prev => prev.map(session => 
        session.id === activeSessionId 
          ? {
              ...session,
              entries: session.entries.map(entry =>
                entry.id === entryId
                  ? { ...entry, output, isExecuting: false }
                  : entry
              )
            }
          : session
      ));
    } catch (error) {
      const errorOutput: TerminalOutput = {
        stdout: '',
        stderr: error as string,
        success: false,
        exit_code: 1,
      };

      setSessions(prev => prev.map(session => 
        session.id === activeSessionId 
          ? {
              ...session,
              entries: session.entries.map(entry =>
                entry.id === entryId
                  ? { ...entry, output: errorOutput, isExecuting: false }
                  : entry
              )
            }
          : session
      ));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const activeSession = getActiveSession();
    if (!activeSession) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isExecuting && currentCommand.trim()) {
        executeCommand(currentCommand);
        setCurrentCommand('');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeSession.commandHistory.length > 0) {
        const newIndex = activeSession.historyIndex === -1 
          ? activeSession.commandHistory.length - 1 
          : Math.max(0, activeSession.historyIndex - 1);
        
        setSessions(prev => prev.map(session => 
          session.id === activeSessionId 
            ? { ...session, historyIndex: newIndex }
            : session
        ));
        setCurrentCommand(activeSession.commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeSession.historyIndex !== -1) {
        const newIndex = activeSession.historyIndex + 1;
        if (newIndex >= activeSession.commandHistory.length) {
          setSessions(prev => prev.map(session => 
            session.id === activeSessionId 
              ? { ...session, historyIndex: -1 }
              : session
          ));
          setCurrentCommand('');
        } else {
          setSessions(prev => prev.map(session => 
            session.id === activeSessionId 
              ? { ...session, historyIndex: newIndex }
              : session
          ));
          setCurrentCommand(activeSession.commandHistory[newIndex]);
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Basic tab completion for common commands
      const commonCommands = [
        'docker', 'docker ps', 'docker images', 'docker run', 'docker exec',
        'docker stop', 'docker start', 'docker restart', 'docker rm', 'docker rmi',
        'ls', 'cd', 'pwd', 'clear', 'mkdir', 'rmdir', 'cp', 'mv', 'rm',
        'cat', 'head', 'tail', 'grep', 'find', 'ps', 'top', 'htop'
      ];
      
      const matches = commonCommands.filter(cmd => 
        cmd.startsWith(currentCommand.toLowerCase())
      );
      
      if (matches.length === 1) {
        setCurrentCommand(matches[0]);
      }
    }
  };

  const handleTerminalClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const getPrompt = (directory: string) => {
    const shortDir = directory.split('/').pop() || directory;
    return `vessel@local:${shortDir}$`;
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString();
  };

  const activeSession = getActiveSession();

  return (
    <div className="terminal-page">
      {/* Page Header */}
      <div className="terminal-page-header">
        <h2>Terminal</h2>
        <p className="page-subtitle">Interactive command-line interface with multiple tabs.</p>
        
        {/* Terminal Tabs */}
        <div className="terminal-tabs">
          <div className="tab-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`terminal-tab ${session.id === activeSessionId ? 'active' : ''}`}
                onClick={() => !editingTabId && setActiveSessionId(session.id)}
              >
                {editingTabId === session.id ? (
                  <input
                    type="text"
                    value={editingTabName}
                    onChange={(e) => setEditingTabName(e.target.value)}
                    onBlur={finishRenameTab}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        finishRenameTab();
                      } else if (e.key === 'Escape') {
                        cancelRenameTab();
                      }
                    }}
                    className="tab-rename-input"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    className="tab-name"
                    onDoubleClick={() => startRenameTab(session.id, session.name)}
                    title="Double-click to rename"
                  >
                    {session.name}
                  </span>
                )}
                {sessions.length > 1 && (
                  <button
                    className="tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeSession(session.id);
                    }}
                    title="Close tab"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button 
              className="new-tab-button"
              onClick={addNewSession}
              title="New terminal tab"
            >
              +
            </button>
          </div>
        </div>
        
        {/* Terminal Controls */}
        <div className="terminal-controls-section">
          <div className="terminal-stats">
            <span className="terminal-status">
              <span className="status-dot running"></span>
              Shell: bash ({activeSession?.currentDirectory || '/'})
            </span>
          </div>
          <div className="terminal-actions">
            <button 
              onClick={() => {
                if (activeSession) {
                  setSessions(prev => prev.map(session => 
                    session.id === activeSessionId 
                      ? { ...session, entries: [] }
                      : session
                  ));
                }
              }} 
              className="clear-button"
              title="Clear terminal"
            >
              <span>🗑️</span>
              Clear
            </button>
            <button 
              onClick={() => inputRef.current?.focus()} 
              className="focus-button"
              title="Focus terminal"
            >
              <span>📝</span>
              Focus
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Container */}
      <div className="terminal-container" onClick={handleTerminalClick}>
        <div className="terminal-content" ref={terminalRef}>
          {activeSession && activeSession.entries.length === 0 && (
            <div className="terminal-welcome">
              <p className="welcome-title">🖥️ Vessel Terminal</p>
              <p>Interactive terminal with Docker command support</p>
              <p>Type commands below. Use arrow keys for history navigation.</p>
              <p>Current directory: <code>{activeSession.currentDirectory}</code></p>
            </div>
          )}

          {activeSession?.entries.map((entry) => (
            <div key={entry.id} className="terminal-entry">
              <div className="terminal-command">
                <span className="terminal-prompt">{getPrompt(activeSession.currentDirectory)}</span>
                <span className="terminal-input">{entry.command}</span>
                <span className="terminal-timestamp">{formatTimestamp(entry.timestamp)}</span>
              </div>
              
              {entry.isExecuting ? (
                <div className="terminal-executing">
                  <div className="loading-spinner-small"></div>
                  <span>Executing...</span>
                </div>
              ) : (
                <div className="terminal-output">
                  {entry.output.stdout && (
                    <pre className="terminal-stdout">{entry.output.stdout}</pre>
                  )}
                  {entry.output.stderr && (
                    <pre className="terminal-stderr">{entry.output.stderr}</pre>
                  )}
                  {entry.output.exit_code !== undefined && entry.output.exit_code !== 0 && (
                    <div className="terminal-exit-code">
                      Exit code: {entry.output.exit_code}
                    </div>
                  )}
                </div>
              )}
            </div>
          )) || []}

          <div className="terminal-input-line">
            <span className="terminal-prompt">{getPrompt(activeSession?.currentDirectory || '/')}</span>
            <input
              ref={inputRef}
              type="text"
              value={currentCommand}
              onChange={(e) => setCurrentCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              className="terminal-input-field"
              disabled={isExecuting}
              placeholder={isExecuting ? "Executing..." : "Enter command..."}
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terminal;