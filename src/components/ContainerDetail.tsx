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
  PlayCircle
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
        return <div className="tab-content">Container inspect data will be displayed here</div>;
      case 'bindMounts':
        return <div className="tab-content">Bind mounts information will be displayed here</div>;
      case 'exec':
        return <div className="tab-content">Terminal/exec interface will be displayed here</div>;
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