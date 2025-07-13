import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TerminalOutput, TerminalEntry } from '../types/docker';

const Terminal: React.FC = () => {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentDirectory, setCurrentDirectory] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCurrentDirectory();
    // Focus input on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new entries are added
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [entries]);

  const loadCurrentDirectory = async () => {
    try {
      const dir = await invoke<string>('get_current_directory');
      setCurrentDirectory(dir);
    } catch (error) {
      console.error('Failed to get current directory:', error);
      setCurrentDirectory('/');
    }
  };

  const executeCommand = async (command: string) => {
    if (!command.trim()) return;

    const entryId = Date.now().toString();
    const newEntry: TerminalEntry = {
      id: entryId,
      command,
      output: { stdout: '', stderr: '', success: false },
      timestamp: new Date(),
      isExecuting: true,
    };

    setEntries(prev => [...prev, newEntry]);
    setIsExecuting(true);

    // Add to command history
    setCommandHistory(prev => {
      const newHistory = [...prev, command];
      return newHistory.slice(-100); // Keep last 100 commands
    });
    setHistoryIndex(-1);

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
          await loadCurrentDirectory(); // Update current directory
        } else {
          output = {
            stdout: '',
            stderr: 'cd: missing path argument',
            success: false,
            exit_code: 1,
          };
        }
      } else if (command === 'pwd') {
        const dir = await invoke<string>('get_current_directory');
        output = {
          stdout: dir,
          stderr: '',
          success: true,
          exit_code: 0,
        };
      } else if (command === 'clear') {
        setEntries([]);
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
      setEntries(prev =>
        prev.map(entry =>
          entry.id === entryId
            ? { ...entry, output, isExecuting: false }
            : entry
        )
      );
    } catch (error) {
      const errorOutput: TerminalOutput = {
        stdout: '',
        stderr: error as string,
        success: false,
        exit_code: 1,
      };

      setEntries(prev =>
        prev.map(entry =>
          entry.id === entryId
            ? { ...entry, output: errorOutput, isExecuting: false }
            : entry
        )
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isExecuting && currentCommand.trim()) {
        executeCommand(currentCommand);
        setCurrentCommand('');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
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

  const getPrompt = () => {
    const shortDir = currentDirectory.split('/').pop() || currentDirectory;
    return `vessel@local:${shortDir}$`;
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString();
  };

  return (
    <div className="terminal-page">
      {/* Page Header */}
      <div className="terminal-page-header">
        <h2>Terminal</h2>
        <p className="page-subtitle">Run Docker commands and system operations directly.</p>
        
        {/* Terminal Controls */}
        <div className="terminal-controls-section">
          <div className="terminal-stats">
            <span className="terminal-status">
              <span className="status-dot running"></span>
              Shell: bash ({currentDirectory})
            </span>
          </div>
          <div className="terminal-actions">
            <button 
              onClick={() => setEntries([])} 
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
          <div className="terminal-welcome">
            <p className="welcome-title">🖥️ Vessel Terminal</p>
            <p>Interactive terminal with Docker command support</p>
            <p>Type commands below. Use arrow keys for history navigation.</p>
            <p>Current directory: <code>{currentDirectory}</code></p>
          </div>

        {entries.map((entry) => (
          <div key={entry.id} className="terminal-entry">
            <div className="terminal-command">
              <span className="terminal-prompt">{getPrompt()}</span>
              <span className="terminal-input">{entry.command}</span>
              <span className="terminal-timestamp">{formatTimestamp(entry.timestamp)}</span>
            </div>
            
            {entry.isExecuting ? (
              <div className="terminal-executing">
                <span className="loading-spinner-small"></span>
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
        ))}

          <div className="terminal-input-line">
            <span className="terminal-prompt">{getPrompt()}</span>
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