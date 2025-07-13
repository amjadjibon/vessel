import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ContainerInfo } from '../types/docker';
import { Play, Square, RotateCcw } from 'lucide-react';

interface ContainerCardProps {
  container: ContainerInfo;
  onUpdate: () => void;
}

const ContainerCard: React.FC<ContainerCardProps> = ({ container, onUpdate }) => {
  const [isLoading, setIsLoading] = React.useState(false);

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

  const getStatusColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
        return '#10b981';
      case 'exited':
        return '#ef4444';
      case 'paused':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const formatCreated = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatPorts = (ports: typeof container.ports) => {
    return ports.map(port => 
      port.public_port 
        ? `${port.public_port}:${port.private_port}/${port.type}`
        : `${port.private_port}/${port.type}`
    ).join(', ');
  };

  return (
    <div className="container-card">
      <div className="container-header">
        <div className="container-name-status">
          <h3 className="container-name">{container.name}</h3>
          <span 
            className="status-badge" 
            style={{ backgroundColor: getStatusColor(container.state) }}
          >
            {container.state}
          </span>
        </div>
        <div className="container-actions">
          <button 
            onClick={() => handleAction('start')}
            disabled={isLoading || container.state === 'running'}
            className="action-button start"
          >
            <Play className="action-icon" /> Start
          </button>
          <button 
            onClick={() => handleAction('stop')}
            disabled={isLoading || container.state !== 'running'}
            className="action-button stop"
          >
            <Square className="action-icon" /> Stop
          </button>
          <button 
            onClick={() => handleAction('restart')}
            disabled={isLoading}
            className="action-button restart"
          >
            <RotateCcw className="action-icon" /> Restart
          </button>
        </div>
      </div>
      
      <div className="container-details">
        <div className="detail-row">
          <span className="detail-label">Image:</span>
          <span className="detail-value">{container.image}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Status:</span>
          <span className="detail-value">{container.status}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Created:</span>
          <span className="detail-value">{formatCreated(container.created)}</span>
        </div>
        {container.ports.length > 0 && (
          <div className="detail-row">
            <span className="detail-label">Ports:</span>
            <span className="detail-value">{formatPorts(container.ports)}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">ID:</span>
          <span className="detail-value container-id">{container.id.substring(0, 12)}</span>
        </div>
      </div>
    </div>
  );
};

export default ContainerCard;