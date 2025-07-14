import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ContainerInfo } from '../types/docker';
import { 
  ArrowLeft,
  Square,
  Play,
  RotateCcw,
  Trash2,
  ExternalLink,
  Search,
  Copy,
  RefreshCw,
  ArrowDown,
  Pause,
  PlayCircle,
  ChevronDown,
  Terminal,
  X
} from 'lucide-react';

interface ContainerDetailProps {
  containerId: string;
  onBack: () => void;
}

type TabType = 'logs' | 'inspect' | 'bindMounts' | 'exec' | 'files' | 'stats';

const ContainerDetail: React.FC<ContainerDetailProps> = ({ containerId, onBack }) => {
  const [container, setContainer] = useState<ContainerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const logsRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [inspectData, setInspectData] = useState<any>(null);
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [currentCommand, setCurrentCommand] = useState<string>('');
  const [isTerminalConnected, setIsTerminalConnected] = useState<boolean>(false);
  const [execLoading, setExecLoading] = useState<boolean>(false);
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [selectedShell, setSelectedShell] = useState<string>('/bin/bash');
  const [showDebugBanner, setShowDebugBanner] = useState<boolean>(true);
  const terminalRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadContainerDetails();
  }, [containerId]);

  useEffect(() => {
    // Set up log streaming listeners
    let logUnlisten: any;
    let errorUnlisten: any;
    let endUnlisten: any;

    const setupListeners = async () => {
      // Listen for log stream events
      logUnlisten = await listen(`log-stream-${containerId}`, (event) => {
        const newLogLine = event.payload as string;
        setLogs(prevLogs => {
          const updated = prevLogs + newLogLine;
          // Auto-scroll if enabled
          if (autoScroll) {
            setTimeout(() => scrollToBottom(), 10);
          }
          return updated;
        });
      });

      // Listen for error events
      errorUnlisten = await listen(`log-stream-error-${containerId}`, (event) => {
        console.error('Log stream error:', event.payload);
        setIsStreaming(false);
      });

      // Listen for stream end events
      endUnlisten = await listen(`log-stream-ended-${containerId}`, (event) => {
        console.log('Log stream ended:', event.payload);
        setIsStreaming(false);
      });
    };

    setupListeners();

    // Cleanup listeners when component unmounts or containerId changes
    return () => {
      if (logUnlisten) logUnlisten();
      if (errorUnlisten) errorUnlisten();
      if (endUnlisten) endUnlisten();
      // Stop streaming when component unmounts
      if (isStreaming) {
        stopLogStream();
      }
    };
  }, [containerId, autoScroll, isStreaming]);

  useEffect(() => {
    // Set up terminal/exec event listeners
    let execOutputUnlisten: any;
    let execErrorUnlisten: any;
    let execEndedUnlisten: any;

    const setupExecListeners = async () => {
      // Listen for exec output events
      execOutputUnlisten = await listen(`exec-output-${containerId}`, (event) => {
        const output = event.payload as string;
        setTerminalOutput(prev => prev + output);
        // Auto-scroll terminal to bottom
        setTimeout(() => scrollTerminalToBottom(), 10);
      });

      // Listen for exec error events
      execErrorUnlisten = await listen(`exec-error-${containerId}`, (event) => {
        console.error('Exec error:', event.payload);
        setTerminalOutput(prev => prev + `\n${event.payload as string}\n`);
        setIsTerminalConnected(false);
      });

      // Listen for exec ended events
      execEndedUnlisten = await listen(`exec-ended-${containerId}`, (event) => {
        console.log('Exec ended:', event.payload);
        setTerminalOutput(prev => prev + `\n${event.payload as string}\n`);
        setIsTerminalConnected(false);
      });
    };

    setupExecListeners();

    // Cleanup listeners when component unmounts or containerId changes
    return () => {
      if (execOutputUnlisten) execOutputUnlisten();
      if (execErrorUnlisten) execErrorUnlisten();
      if (execEndedUnlisten) execEndedUnlisten();
    };
  }, [containerId]);

  const loadContainerDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all containers and find the specific one
      const allContainers = await invoke<ContainerInfo[]>('list_containers');
      const containerData = allContainers.find(c => c.id === containerId);
      
      if (!containerData) {
        setError('Container not found');
        return;
      }
      
      setContainer(containerData);
      
      // Load logs if that's the active tab
      if (activeTab === 'logs') {
        await loadLogs();
      }
    } catch (err) {
      setError(err as string);
      console.error('Failed to load container details:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      console.log('Loading logs for container:', containerId);
      
      // First, get historical logs
      const containerLogs = await invoke<string>('get_container_logs', { 
        containerId: containerId,
        tail: 0, // 0 means all logs
        follow: false 
      });
      
      if (containerLogs.trim() === '') {
        setLogs('No logs available for this container.\n\nThis could mean:\n- The container hasn\'t produced any output yet\n- The container was just started\n- The application runs silently\n\nStreaming new logs...\n\n');
      } else {
        setLogs(containerLogs);
        // Auto scroll to bottom after logs are loaded
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }

      // Start streaming new logs
      await startLogStream();
    } catch (err) {
      console.error('Failed to load logs:', err);
      const errorMessage = `Failed to load logs: ${err}

This could happen if:
- The container doesn't exist
- Docker is not running
- The container has no logs
- Permission issues

Try refreshing or check the container status.`;
      setLogs(errorMessage);
    } finally {
      setLogsLoading(false);
    }
  };

  const startLogStream = async () => {
    try {
      console.log('Starting log stream for container:', containerId);
      await invoke('start_log_stream', { containerId });
      setIsStreaming(true);
    } catch (err) {
      console.error('Failed to start log stream:', err);
    }
  };

  const stopLogStream = async () => {
    try {
      console.log('Stopping log stream for container:', containerId);
      await invoke('stop_log_stream', { containerId });
      setIsStreaming(false);
    } catch (err) {
      console.error('Failed to stop log stream:', err);
    }
  };

  const scrollToBottom = () => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  };

  const loadInspectData = async () => {
    try {
      setInspectLoading(true);
      setInspectError(null);
      console.log('Loading inspect data for container:', containerId);
      
      const inspectResult = await invoke<any>('inspect_container', { 
        containerId: containerId 
      });
      
      setInspectData(inspectResult);
    } catch (err) {
      console.error('Failed to load inspect data:', err);
      setInspectError(`Failed to load inspect data: ${err}`);
    } finally {
      setInspectLoading(false);
    }
  };

  const toggleSection = (sectionName: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionName)) {
      newCollapsed.delete(sectionName);
    } else {
      newCollapsed.add(sectionName);
    }
    setCollapsedSections(newCollapsed);
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      if (prev.includes(filter)) {
        return prev.filter(f => f !== filter);
      } else {
        return [...prev, filter];
      }
    });
  };


  const getFilteredInspectData = () => {
    if (!inspectData) return null;
    if (activeFilters.length === 0) return inspectData;

    const filtered: any = {};
    activeFilters.forEach(filter => {
      switch (filter) {
        case 'Platform':
          if (inspectData.Platform) filtered.Platform = inspectData.Platform;
          if (inspectData.Os) filtered.Os = inspectData.Os;
          if (inspectData.Architecture) filtered.Architecture = inspectData.Architecture;
          break;
        case 'Cmd':
          if (inspectData.Config?.Cmd) filtered.Cmd = inspectData.Config.Cmd;
          if (inspectData.Config?.Entrypoint) filtered.Entrypoint = inspectData.Config.Entrypoint;
          break;
        case 'State':
          if (inspectData.State) filtered.State = inspectData.State;
          break;
        case 'Image':
          if (inspectData.Image) filtered.Image = inspectData.Image;
          if (inspectData.Config?.Image) filtered.ImageConfig = inspectData.Config.Image;
          break;
        case 'Network':
          if (inspectData.NetworkSettings) filtered.NetworkSettings = inspectData.NetworkSettings;
          break;
        case 'Mounts':
          if (inspectData.Mounts) filtered.Mounts = inspectData.Mounts;
          break;
        case 'Config':
          if (inspectData.Config) filtered.Config = inspectData.Config;
          break;
        case 'HostConfig':
          if (inspectData.HostConfig) filtered.HostConfig = inspectData.HostConfig;
          break;
        case 'Volumes':
          if (inspectData.Config?.Volumes) filtered.Volumes = inspectData.Config.Volumes;
          break;
        case 'Labels':
          if (inspectData.Config?.Labels) filtered.Labels = inspectData.Config.Labels;
          break;
        default:
          if (inspectData[filter]) filtered[filter] = inspectData[filter];
      }
    });
    return filtered;
  };

  const renderJsonContent = () => {
    const dataToRender = getFilteredInspectData();
    if (!dataToRender) return null;

    if (showRawJson) {
      const jsonString = JSON.stringify(dataToRender, null, 2);
      const lines = jsonString.split('\n');
      return (
        <pre>
          {lines.map((line, index) => (
            <div key={index}>
              <span className="line-number">{index + 1}</span>
              {line}
            </div>
          ))}
        </pre>
      );
    }

    const renderSection = (title: string, data: any) => {
      const isCollapsed = collapsedSections.has(title);
      return (
        <div key={title} className={`json-section ${isCollapsed ? 'collapsed' : ''}`}>
          <div className="json-section-header" onClick={() => toggleSection(title)}>
            <div className="section-toggle">
              <ChevronDown />
            </div>
            {title}
          </div>
          <div className="json-section-content">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>
      );
    };

    if (activeFilters.length === 0) {
      // Show organized sections when no filters are active
      const sections = [
        { title: 'State', data: dataToRender.State },
        { title: 'Image', data: { Image: dataToRender.Image, ImageConfig: dataToRender.Config?.Image } },
        { title: 'Config', data: dataToRender.Config },
        { title: 'HostConfig', data: dataToRender.HostConfig },
        { title: 'NetworkSettings', data: dataToRender.NetworkSettings },
        { title: 'Mounts', data: dataToRender.Mounts },
        { title: 'Platform', data: { Platform: dataToRender.Platform, Os: dataToRender.Os, Architecture: dataToRender.Architecture } }
      ].filter(section => section.data && Object.keys(section.data).length > 0);

      return (
        <div>
          {sections.map(section => renderSection(section.title, section.data))}
        </div>
      );
    } else {
      // Show filtered data as single section
      return <pre>{JSON.stringify(dataToRender, null, 2)}</pre>;
    }
  };

  const scrollTerminalToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  const startTerminalSession = async () => {
    try {
      setExecLoading(true);
      setTerminalOutput('');
      console.log('Starting terminal session for container:', containerId);
      
      // Add welcome message
      setTerminalOutput('Connecting to container...\n\n');
      
      const result = await invoke<string>('start_container_shell', { 
        containerId: containerId 
      });
      
      console.log('Terminal session started:', result);
      setIsTerminalConnected(true);
      setTerminalOutput('Connected to container. Ready for commands.\n\n');
    } catch (err) {
      console.error('Failed to start terminal session:', err);
      setTerminalOutput(prev => prev + `Error: ${err}\n\nThis could happen if:\n- The container is not running\n- No shell is available in the container\n- Permission issues\n\nTry starting the container first.\n\n`);
    } finally {
      setExecLoading(false);
    }
  };

  const executeCommand = async (command: string) => {
    if (!command.trim() || !isTerminalConnected) return;

    try {
      // Add command to history
      setTerminalHistory(prev => [...prev, command]);
      setHistoryIndex(-1);
      
      // Handle built-in commands locally
      const cmd = command.trim().toLowerCase();
      
      if (cmd === 'clear' || cmd === 'cls') {
        setTerminalOutput('');
        setCurrentCommand('');
        return;
      }
      
      if (cmd === 'exit' || cmd === 'quit') {
        setTerminalOutput(prev => prev + `${command}\nConnection closed.\n`);
        setIsTerminalConnected(false);
        setCurrentCommand('');
        return;
      }
      
      // Handle empty command
      if (cmd === '') {
        setCurrentCommand('');
        return;
      }
      
      // Parse command into array and execute
      const commandParts = command.trim().split(/\s+/);
      
      await invoke('exec_container_command', {
        containerId: containerId,
        command: commandParts
      });
      
      setCurrentCommand('');
    } catch (err) {
      console.error('Failed to execute command:', err);
      setTerminalOutput(prev => prev + `Error executing command: ${err}\n`);
    }
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(currentCommand);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminalHistory.length > 0) {
        const newIndex = historyIndex + 1;
        if (newIndex < terminalHistory.length) {
          setHistoryIndex(newIndex);
          setCurrentCommand(terminalHistory[terminalHistory.length - 1 - newIndex]);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(terminalHistory[terminalHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentCommand('');
      }
    }
  };

  const clearTerminal = () => {
    setTerminalOutput('');
  };

  const handleContainerAction = async (action: string) => {
    if (!container) return;
    
    try {
      await invoke(`${action}_container`, { containerId: container.id });
      // Reload container details to get updated status
      await loadContainerDetails();
    } catch (err) {
      console.error(`Failed to ${action} container:`, err);
      alert(`Failed to ${action} container: ${err}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running': return '#4caf50';
      case 'stopped': case 'exited': return '#f44336';
      case 'paused': return '#ff9800';
      default: return '#757575';
    }
  };

  const formatContainerId = (id: string) => {
    return id.substring(0, 12);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'logs':
        return (
          <div className="container-logs">
            <div className="logs-toolbar">
              <div className="logs-info">
                <span className="logs-status">
                  {logsLoading ? 'Loading logs...' : `${logs ? logs.split('\n').filter(line => line.trim() !== '').length : 0} lines`}
                  {isStreaming && <span className="streaming-indicator"> • Streaming</span>}
                </span>
              </div>
              <div className="logs-actions">
                <button 
                  className="icon-button" 
                  title="Refresh logs"
                  onClick={loadLogs}
                  disabled={logsLoading}
                >
                  <RefreshCw className={`icon ${logsLoading ? 'spinning' : ''}`} />
                </button>
                <button 
                  className="icon-button" 
                  title={isStreaming ? "Stop streaming" : "Start streaming"}
                  onClick={isStreaming ? stopLogStream : startLogStream}
                >
                  {isStreaming ? <Pause className="icon" /> : <PlayCircle className="icon" />}
                </button>
                <button className="icon-button" title="Search logs">
                  <Search className="icon" />
                </button>
                <button 
                  className="icon-button" 
                  title="Copy logs"
                  onClick={() => {
                    navigator.clipboard.writeText(logs);
                    alert('Logs copied to clipboard!');
                  }}
                >
                  <Copy className="icon" />
                </button>
                <button 
                  className="icon-button" 
                  title="Scroll to bottom"
                  onClick={scrollToBottom}
                >
                  <ArrowDown className="icon" />
                </button>
                <button 
                  className={`icon-button ${autoScroll ? 'active' : ''}`}
                  title={`Auto-scroll: ${autoScroll ? 'ON' : 'OFF'}`}
                  onClick={() => setAutoScroll(!autoScroll)}
                >
                  Auto
                </button>
                <button className="icon-button" title="Open in external terminal">
                  <ExternalLink className="icon" />
                </button>
              </div>
            </div>
            <div className="logs-content" ref={logsRef}>
              {logsLoading ? (
                <div className="logs-loading">
                  <div className="loading-spinner"></div>
                  <span>Loading container logs...</span>
                </div>
              ) : (
                <pre>{logs}</pre>
              )}
            </div>
          </div>
        );
      case 'inspect':
        return (
          <div className="inspect-container">
            <div className="inspect-toolbar">
              <div className="inspect-filters">
                {['Platform', 'Cmd', 'State', 'Image', 'Network', 'Mounts', 'Config', 'HostConfig', 'Volumes', 'Labels'].map(filter => (
                  <button
                    key={filter}
                    className={`filter-button ${activeFilters.includes(filter) ? 'active' : ''}`}
                    onClick={() => toggleFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <div className="inspect-controls">
                <label className="raw-json-toggle">
                  <input
                    type="checkbox"
                    checked={showRawJson}
                    onChange={(e) => setShowRawJson(e.target.checked)}
                  />
                  Raw JSON
                </label>
                <button 
                  className="icon-button" 
                  title="Refresh inspect data"
                  onClick={loadInspectData}
                  disabled={inspectLoading}
                >
                  <RefreshCw className={`icon ${inspectLoading ? 'spinning' : ''}`} />
                </button>
                <button 
                  className="icon-button" 
                  title="Copy JSON"
                  onClick={() => {
                    if (inspectData) {
                      navigator.clipboard.writeText(JSON.stringify(getFilteredInspectData(), null, 2));
                      alert('JSON copied to clipboard!');
                    }
                  }}
                >
                  <Copy className="icon" />
                </button>
              </div>
            </div>
            <div className="json-viewer">
              {inspectLoading ? (
                <div className="inspect-loading">
                  <div className="loading-spinner"></div>
                  <span>Loading container inspect data...</span>
                </div>
              ) : inspectError ? (
                <div className="inspect-error">
                  <p>Error loading inspect data:</p>
                  <pre>{inspectError}</pre>
                </div>
              ) : inspectData ? (
                renderJsonContent()
              ) : (
                <div className="inspect-empty">
                  <p>No inspect data available. Click refresh to load.</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'bindMounts':
        return <div className="tab-content">Bind mounts information will be displayed here</div>;
      case 'exec':
        return (
          <div className="exec-container">
            {showDebugBanner && (
              <div className="docker-debug-banner">
                <Terminal className="debug-icon" />
                <div className="debug-text">
                  Docker Debug brings the tools you need to debug your container with one click.
                  Requires a paid Docker subscription. <span className="debug-link">Learn more.</span>
                </div>
                <button 
                  className="close-banner"
                  onClick={() => setShowDebugBanner(false)}
                  title="Close banner"
                >
                  <X />
                </button>
              </div>
            )}
            
            <div className="exec-toolbar">
              <div className="exec-info">
                <div className="exec-status">
                  Terminal session for {container?.name || containerId}
                </div>
                <div className="exec-connection-status">
                  <div className={`connection-indicator ${isTerminalConnected ? '' : 'disconnected'}`}></div>
                  {isTerminalConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              
              <div className="exec-actions">
                <select 
                  className="shell-selector"
                  value={selectedShell}
                  onChange={(e) => setSelectedShell(e.target.value)}
                  disabled={isTerminalConnected}
                >
                  <option value="/bin/bash">bash</option>
                  <option value="/bin/sh">sh</option>
                  <option value="/bin/zsh">zsh</option>
                  <option value="/bin/fish">fish</option>
                </select>
                
                <button 
                  className="icon-button" 
                  title="Clear terminal"
                  onClick={clearTerminal}
                >
                  <RefreshCw className="icon" />
                </button>
                
                <button 
                  className="icon-button" 
                  title="Copy terminal output"
                  onClick={() => {
                    navigator.clipboard.writeText(terminalOutput);
                    alert('Terminal output copied to clipboard!');
                  }}
                >
                  <Copy className="icon" />
                </button>
              </div>
            </div>
            
            <div className="terminal" ref={terminalRef}>
              {execLoading ? (
                <div className="exec-loading">
                  <div className="loading-spinner"></div>
                  <span>Connecting to container...</span>
                </div>
              ) : (
                <>
                  {!isTerminalConnected && !terminalOutput && (
                    <div className="terminal-welcome">
                      Welcome to Container Terminal
                      <br />
                      <br />
                      Click "Connect" to start a terminal session in the container.
                      <br />
                      <br />
                      <button 
                        style={{
                          background: '#007acc',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        onClick={startTerminalSession}
                        disabled={execLoading}
                      >
                        Connect to Container
                      </button>
                    </div>
                  )}
                  
                  <div className="terminal-output">
                    {terminalOutput}
                  </div>
                  
                  {isTerminalConnected && (
                    <div className="terminal-input-line">
                      <span className="terminal-prompt">root@container:~$</span>
                      <input
                        type="text"
                        className="terminal-input"
                        value={currentCommand}
                        onChange={(e) => setCurrentCommand(e.target.value)}
                        onKeyDown={handleTerminalKeyDown}
                        placeholder="Type a command and press Enter..."
                        autoFocus
                      />
                      <span className="terminal-cursor"></span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      case 'files':
        return <div className="tab-content">Container file browser will be displayed here</div>;
      case 'stats':
        return <div className="tab-content">Container statistics will be displayed here</div>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="container-detail loading">
        <div className="loading-message">Loading container details...</div>
      </div>
    );
  }

  if (error || !container) {
    return (
      <div className="container-detail error">
        <button onClick={onBack} className="back-button">
          <ArrowLeft className="icon" /> Back to Containers
        </button>
        <div className="error-message">{error || 'Container not found'}</div>
      </div>
    );
  }

  return (
    <div className="container-detail">
      {/* Header with breadcrumb and back button */}
      <div className="container-detail-header">
        <div className="breadcrumb">
          <button onClick={onBack} className="breadcrumb-link">
            Containers
          </button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{container.name}</span>
        </div>
      </div>

      {/* Container info section */}
      <div className="container-info-section">
        <button onClick={onBack} className="back-button-icon">
          <ArrowLeft className="icon" />
        </button>
        
        <div className="container-icon">
          📦
        </div>
        
        <div className="container-details">
          <h1 className="container-name">{container.name}</h1>
          <div className="container-meta">
            <div className="container-id">
              <span className="id-label">ID:</span>
              <code className="id-value">{formatContainerId(container.id)}</code>
            </div>
            <div className="container-image">
              <span className="image-label">Image:</span>
              <span className="image-value">{container.image}</span>
              <ExternalLink className="external-icon" />
            </div>
            {container.ports && container.ports.length > 0 && (
              <div className="container-ports">
                <span className="port-label">Port:</span>
                <a href="#" className="port-link">
                  {container.ports[0].public_port}:{container.ports[0].private_port}
                  <ExternalLink className="external-icon" />
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="container-status-actions">
          <div className="status-section">
            <span className="status-label">STATUS</span>
            <div className="status-value">
              <span 
                className="status-indicator"
                style={{ backgroundColor: getStatusColor(container.status) }}
              />
              {container.status}
            </div>
          </div>
          
          <div className="action-buttons">
            {container.status.toLowerCase() === 'running' ? (
              <button 
                onClick={() => handleContainerAction('stop')}
                className="action-btn stop-btn"
                title="Stop container"
              >
                <Square className="icon" />
              </button>
            ) : (
              <button 
                onClick={() => handleContainerAction('start')}
                className="action-btn start-btn"
                title="Start container"
              >
                <Play className="icon" />
              </button>
            )}
            
            <button 
              onClick={() => handleContainerAction('restart')}
              className="action-btn restart-btn"
              title="Restart container"
            >
              <RotateCcw className="icon" />
            </button>
            
            <button 
              onClick={() => handleContainerAction('remove')}
              className="action-btn delete-btn"
              title="Delete container"
            >
              <Trash2 className="icon" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="container-tabs">
        <div className="tabs-nav">
          {[
            { id: 'logs', label: 'Logs' },
            { id: 'inspect', label: 'Inspect' },
            { id: 'bindMounts', label: 'Bind mounts' },
            { id: 'exec', label: 'Exec' },
            { id: 'files', label: 'Files' },
            { id: 'stats', label: 'Stats' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as TabType);
                if (tab.id === 'logs') {
                  loadLogs();
                } else if (tab.id === 'inspect') {
                  loadInspectData();
                }
              }}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="tab-content-area">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default ContainerDetail;