import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { NetworkInfo } from '../types/docker';

interface NetworkCardProps {
  network: NetworkInfo;
  onUpdate: () => void;
}

const NetworkCard: React.FC<NetworkCardProps> = ({ network, onUpdate }) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleRemove = async () => {
    // Prevent removal of system networks
    if (['bridge', 'host', 'none'].includes(network.name)) {
      alert('Cannot remove system networks (bridge, host, none)');
      return;
    }

    if (!confirm(`Are you sure you want to remove network ${network.name}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await invoke<string>('remove_network', { networkId: network.id });
      console.log(result);
      onUpdate();
    } catch (error) {
      console.error('Failed to remove network:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCreated = (created?: string) => {
    if (!created) return 'Unknown';
    const date = new Date(created);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const isSystemNetwork = ['bridge', 'host', 'none'].includes(network.name);
  const hasContainers = Object.keys(network.containers).length > 0;

  return (
    <div className={`network-card ${isSystemNetwork ? 'system-network' : ''}`}>
      <div className="network-header">
        <div className="network-name-info">
          <h3 className="network-name">{network.name}</h3>
          <div className="network-badges">
            <span className="driver-badge">{network.driver}</span>
            {network.internal && <span className="internal-badge">Internal</span>}
            {network.ingress && <span className="ingress-badge">Ingress</span>}
            {isSystemNetwork && <span className="system-badge">System</span>}
          </div>
        </div>
        <div className="network-actions">
          <button 
            onClick={handleRemove}
            disabled={isLoading || isSystemNetwork}
            className="action-button remove"
            title={isSystemNetwork ? 'Cannot remove system networks' : 'Remove network'}
          >
            🗑️ Remove
          </button>
        </div>
      </div>
      
      <div className="network-details">
        <div className="detail-row">
          <span className="detail-label">Scope:</span>
          <span className="detail-value">{network.scope}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Attachable:</span>
          <span className="detail-value">{network.attachable ? 'Yes' : 'No'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Created:</span>
          <span className="detail-value">{formatCreated(network.created)}</span>
        </div>

        {network.ipam.config.length > 0 && (
          <div className="detail-section">
            <span className="detail-section-title">IPAM Configuration:</span>
            <div className="ipam-list">
              {network.ipam.config.map((config, index) => (
                <div key={index} className="ipam-item">
                  {config.subnet && (
                    <div className="ipam-detail">
                      <span className="ipam-key">Subnet:</span>
                      <span className="ipam-value">{config.subnet}</span>
                    </div>
                  )}
                  {config.gateway && (
                    <div className="ipam-detail">
                      <span className="ipam-key">Gateway:</span>
                      <span className="ipam-value">{config.gateway}</span>
                    </div>
                  )}
                  {config.ip_range && (
                    <div className="ipam-detail">
                      <span className="ipam-key">IP Range:</span>
                      <span className="ipam-value">{config.ip_range}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {hasContainers && (
          <div className="detail-section">
            <span className="detail-section-title">Connected Containers ({Object.keys(network.containers).length}):</span>
            <div className="containers-list">
              {Object.entries(network.containers).map(([id, container]) => (
                <div key={id} className="container-item">
                  <span className="container-name">{container.name || id.substring(0, 12)}</span>
                  {container.ipv4_address && (
                    <span className="container-ip">{container.ipv4_address}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="detail-row">
          <span className="detail-label">ID:</span>
          <span className="detail-value network-id">{network.id.substring(0, 12)}</span>
        </div>
      </div>
    </div>
  );
};

export default NetworkCard;