import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { NetworkInfo } from '../types/docker';

interface NetworkRowProps {
  network: NetworkInfo;
  isSelected: boolean;
  onToggleSelection: () => void;
  onUpdate: () => void;
}

const NetworkRow: React.FC<NetworkRowProps> = ({ network, isSelected, onToggleSelection, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);

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
      alert(`Failed to remove network: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isSystemNetwork = ['bridge', 'host', 'none'].includes(network.name);
  const subnet = network.ipam.config.length > 0 ? network.ipam.config[0].subnet || '-' : '-';
  const gateway = network.ipam.config.length > 0 ? network.ipam.config[0].gateway || '-' : '-';
  const connectedCount = Object.keys(network.containers).length;

  return (
    <tr className={`network-row ${isSystemNetwork ? 'system-network' : ''}`}>
      <td className="checkbox-col">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelection}
        />
      </td>
      <td className="network-name">
        <div className="name-container">
          <span className="name">{network.name}</span>
          {network.internal && <span className="badge internal">Internal</span>}
          {network.ingress && <span className="badge ingress">Ingress</span>}
          {isSystemNetwork && <span className="badge system">System</span>}
        </div>
      </td>
      <td className="network-id">
        <code>{network.id.substring(0, 12)}</code>
      </td>
      <td className="driver">
        <span className="driver-badge">{network.driver}</span>
      </td>
      <td className="scope">{network.scope}</td>
      <td className="subnet">
        <code>{subnet}</code>
      </td>
      <td className="gateway">
        <code>{gateway}</code>
      </td>
      <td className="connected">
        <span className="connected-count">
          {connectedCount} container{connectedCount !== 1 ? 's' : ''}
        </span>
      </td>
      <td className="actions-col">
        <div className="actions">
          <button
            onClick={handleRemove}
            disabled={isLoading || isSystemNetwork}
            className="action-button remove"
            title={isSystemNetwork ? 'Cannot remove system networks' : 'Remove network'}
          >
            {isLoading ? '⏳' : '🗑️'}
          </button>
        </div>
      </td>
    </tr>
  );
};

const NetworkList: React.FC = () => {
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNetworks, setSelectedNetworks] = useState<Set<string>>(new Set());

  const loadNetworks = async () => {
    try {
      setLoading(true);
      setError(null);
      const networkList = await invoke<NetworkInfo[]>('list_networks');
      setNetworks(networkList);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load networks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNetworks();
  }, []);

  const toggleNetworkSelection = (networkId: string) => {
    setSelectedNetworks(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(networkId)) {
        newSelected.delete(networkId);
      } else {
        newSelected.add(networkId);
      }
      return newSelected;
    });
  };

  const isSystemNetwork = (networkName: string): boolean => {
    return ['bridge', 'host', 'none'].includes(networkName);
  };

  if (loading) {
    return (
      <div className="network-list loading">
        <div className="loading-spinner"></div>
        <p>Loading networks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="network-list error">
        <div className="error-message">
          <h3>Failed to load networks</h3>
          <p>{error}</p>
          <button onClick={loadNetworks} className="retry-button">
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="network-list">
      <div className="network-list-header">
        <h2>Networks</h2>
        <p className="page-subtitle">Manage Docker networks and network configuration.</p>
        
        {/* Stats Section */}
        <div className="stats-section">
          <div className="stat-item">
            <span className="stat-label">Total networks</span>
            <span className="stat-value">{networks.length}</span>
            <span className="stat-note">across all types</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">User networks</span>
            <span className="stat-value">{networks.filter(n => !isSystemNetwork(n.name)).length}</span>
            <span className="stat-note">custom networks</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">System networks</span>
            <span className="stat-value">{networks.filter(n => isSystemNetwork(n.name)).length}</span>
            <span className="stat-note">built-in networks</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span className="results-count">{networks.length} networks</span>
          </div>
          <button onClick={loadNetworks} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>
      
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="checkbox-col">
                <input 
                  type="checkbox" 
                  checked={selectedNetworks.size > 0 && selectedNetworks.size === networks.length}
                  onChange={() => {
                    if (selectedNetworks.size === networks.length) {
                      setSelectedNetworks(new Set());
                    } else {
                      setSelectedNetworks(new Set(networks.map(n => n.id)));
                    }
                  }}
                />
              </th>
              <th>Name</th>
              <th>Network ID</th>
              <th>Driver</th>
              <th>Scope</th>
              <th>Subnet</th>
              <th>Gateway</th>
              <th>Connected</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {networks.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-row">
                  <div className="empty-state">
                    <h3>No networks found</h3>
                    <p>No Docker networks are available on this system.</p>
                  </div>
                </td>
              </tr>
            ) : (
              networks.map((network) => (
                <NetworkRow
                  key={network.id}
                  network={network}
                  isSelected={selectedNetworks.has(network.id)}
                  onToggleSelection={() => toggleNetworkSelection(network.id)}
                  onUpdate={loadNetworks}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NetworkList;