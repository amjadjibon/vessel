import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ContainerInfo } from '../types/docker';

const ContainerList: React.FC = () => {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadContainers();
  }, []);

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
            <span className="stat-value">3.50%</span>
            <span className="stat-note">(12 CPUs available)</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Container memory usage</span>
            <span className="stat-value">1.96GB</span>
            <span className="stat-note">of 7.47GB</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total containers</span>
            <span className="stat-value">{containers.length}</span>
            <span className="stat-note">running and stopped</span>
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
  onUpdate: () => void;
}

const ContainerRow: React.FC<ContainerRowProps> = ({ container, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setIsLoading(true);
    try {
      const command = `${action}_container`;
      const result = await invoke<string>(command, { containerId: container.id });
      console.log(result);
      onUpdate();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
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
        3.5%
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
          <button className="action-btn more" title="More actions">
            ⋯
          </button>
        </div>
      </td>
    </tr>
  );
};

export default ContainerList;