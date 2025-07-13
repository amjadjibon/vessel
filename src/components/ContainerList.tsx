import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ContainerInfo, SystemStats, DockerSystemInfo, ContainerStats } from '../types/docker';

const ContainerList: React.FC = () => {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [dockerInfo, setDockerInfo] = useState<DockerSystemInfo | null>(null);
  const [containerStats, setContainerStats] = useState<Map<string, ContainerStats>>(new Map());

  const loadContainers = async () => {
    try {
      setLoading(true);
      setError(null);
      const containerList = await invoke<ContainerInfo[]>('list_containers');
      setContainers(containerList);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load containers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemStats = async () => {
    try {
      const stats = await invoke<SystemStats>('get_system_stats');
      setSystemStats(stats);
      const info = await invoke<DockerSystemInfo>('get_docker_system_info');
      setDockerInfo(info);
    } catch (error) {
      console.error('Failed to load system stats:', error);
    }
  };

  const loadContainerStats = async () => {
    try {
      const runningContainers = containers.filter(c => c.state.toLowerCase() === 'running');
      const statsMap = new Map<string, ContainerStats>();
      
      for (const container of runningContainers) {
        try {
          const stats = await invoke<ContainerStats>('get_container_stats', { containerId: container.id });
          statsMap.set(container.id, stats);
        } catch (error) {
          console.error(`Failed to get stats for container ${container.id}:`, error);
        }
      }
      
      setContainerStats(statsMap);
    } catch (error) {
      console.error('Failed to load container stats:', error);
    }
  };

  useEffect(() => {
    loadContainers();
    loadSystemStats();
  }, []);

  useEffect(() => {
    if (containers.length > 0) {
      loadContainerStats();
      
      // Refresh stats every 3 seconds
      const interval = setInterval(() => {
        loadContainerStats();
        loadSystemStats();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [containers]);

  if (loading) {
    return (
      <div className="container-list loading">
        <div className="loading-spinner"></div>
        <p>Loading containers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-list error">
        <div className="error-message">
          <h3>Failed to load containers</h3>
          <p>{error}</p>
          <button onClick={loadContainers} className="retry-button">
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  if (containers.length === 0) {
    return (
      <div className="container-list empty">
        <div className="empty-state">
          <h3>No containers found</h3>
          <p>No Docker containers are available on this system.</p>
          <button onClick={loadContainers} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-list">
      <div className="container-list-header">
        <h2>Containers</h2>
        <p className="page-subtitle">View all your running containers and applications.</p>
        
        {/* Stats Section */}
        <div className="stats-section">
          <div className="stat-item">
            <span className="stat-label">Container CPU usage</span>
            <span className="stat-value">
              {systemStats ? `${systemStats.cpu_usage.toFixed(2)}%` : 'Loading...'}
            </span>
            <span className="stat-note">
              ({systemStats ? `${systemStats.cpu_count} CPUs` : 'Loading...'} available)
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Container memory usage</span>
            <span className="stat-value">
              {systemStats ? `${systemStats.memory_used_gb.toFixed(2)}GB` : 'Loading...'}
            </span>
            <span className="stat-note">
              of {systemStats ? `${systemStats.memory_total_gb.toFixed(2)}GB` : 'Loading...'}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total containers</span>
            <span className="stat-value">
              {dockerInfo ? dockerInfo.containers_total : containers.length}
            </span>
            <span className="stat-note">
              {dockerInfo ? `${dockerInfo.containers_running} running, ${dockerInfo.containers_stopped} stopped` : 'loading...'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Search containers..." 
              style={{
                padding: '8px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '14px',
                width: '300px'
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#757575' }}>
              <input type="checkbox" defaultChecked />
              Only show running containers
            </label>
          </div>
          <button onClick={loadContainers} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>
      
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="checkbox-col">
                <input type="checkbox" />
              </th>
              <th className="status-col"></th>
              <th>Name</th>
              <th>Container ID</th>
              <th>Image</th>
              <th>Port(s)</th>
              <th>CPU (%)</th>
              <th>Last started</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {containers.map((container) => (
              <ContainerRow
                key={container.id}
                container={container}
                containerStats={containerStats.get(container.id)}
                onUpdate={loadContainers}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface ContainerRowProps {
  container: ContainerInfo;
  containerStats?: ContainerStats;
  onUpdate: () => void;
}

const ContainerRow: React.FC<ContainerRowProps> = ({ container, containerStats, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'remove' | 'pause' | 'unpause') => {
    setIsLoading(true);
    try {
      let command = `${action}_container`;
      let params: any = { containerId: container.id };
      
      if (action === 'remove') {
        // Ask for confirmation before removing
        const confirmed = confirm(`Are you sure you want to remove container "${container.name}"?`);
        if (!confirmed) {
          setIsLoading(false);
          return;
        }
        // Force remove if container is running
        params.force = container.state.toLowerCase() === 'running';
      }
      
      const result = await invoke<string>(command, params);
      console.log(result);
      onUpdate();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
      alert(`Failed to ${action} container: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (state: string) => {
    if (state.toLowerCase() === 'running') {
      return <span className="status-icon running" title="Running"></span>;
    } else {
      return <span className="status-icon stopped" title="Stopped"></span>;
    }
  };

  const formatCreated = (timestamp: number) => {
    const now = Date.now();
    const diff = now - (timestamp * 1000);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const formatPorts = (ports: typeof container.ports) => {
    if (ports.length === 0) return '-';
    return ports.map(port => 
      port.public_port 
        ? `${port.public_port}:${port.private_port}`
        : `${port.private_port}`
    ).join(', ');
  };

  return (
    <tr>
      <td>
        <input type="checkbox" />
      </td>
      <td>
        {getStatusIcon(container.state)}
      </td>
      <td>
        <strong>{container.name}</strong>
      </td>
      <td>
        <span className="container-id-short">{container.id.substring(0, 12)}</span>
      </td>
      <td>
        <span className="image-link">{container.image}</span>
      </td>
      <td>
        {formatPorts(container.ports)}
      </td>
      <td>
        {containerStats ? `${containerStats.cpu_percentage.toFixed(1)}%` : container.state.toLowerCase() === 'running' ? 'Loading...' : '-'}
      </td>
      <td>
        {formatCreated(container.created)}
      </td>
      <td>
        <div className="action-buttons">
          {container.state.toLowerCase() === 'running' ? (
            <>
              <button
                onClick={() => handleAction('stop')}
                disabled={isLoading}
                className="action-btn stop"
                title="Stop container"
              >
                ⏹️
              </button>
              <button
                onClick={() => handleAction('restart')}
                disabled={isLoading}
                className="action-btn restart"
                title="Restart container"
              >
                🔄
              </button>
              <button
                onClick={() => handleAction('pause')}
                disabled={isLoading}
                className="action-btn pause"
                title="Pause container"
              >
                ⏸️
              </button>
            </>
          ) : container.state.toLowerCase() === 'paused' ? (
            <>
              <button
                onClick={() => handleAction('unpause')}
                disabled={isLoading}
                className="action-btn start"
                title="Unpause container"
              >
                ▶️
              </button>
              <button
                onClick={() => handleAction('stop')}
                disabled={isLoading}
                className="action-btn stop"
                title="Stop container"
              >
                ⏹️
              </button>
            </>
          ) : (
            <button
              onClick={() => handleAction('start')}
              disabled={isLoading}
              className="action-btn start"
              title="Start container"
            >
              ▶️
            </button>
          )}
          <button
            onClick={() => handleAction('remove')}
            disabled={isLoading}
            className="action-btn delete"
            title="Remove container"
          >
            🗑️
          </button>
        </div>
      </td>
    </tr>
  );
};

export default ContainerList;