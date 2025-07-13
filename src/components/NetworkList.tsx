import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { NetworkInfo } from '../types/docker';
import NetworkCard from './NetworkCard';

const NetworkList: React.FC = () => {
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (networks.length === 0) {
    return (
      <div className="network-list empty">
        <div className="empty-state">
          <h3>No networks found</h3>
          <p>No Docker networks are available on this system.</p>
          <button onClick={loadNetworks} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  const systemNetworks = networks.filter(n => ['bridge', 'host', 'none'].includes(n.name));
  const userNetworks = networks.filter(n => !['bridge', 'host', 'none'].includes(n.name));

  return (
    <div className="network-list">
      <div className="network-list-header">
        <h2>Networks ({networks.length})</h2>
        <button onClick={loadNetworks} className="refresh-button">
          🔄 Refresh
        </button>
      </div>
      
      {userNetworks.length > 0 && (
        <div className="network-section">
          <h3 className="section-title">User Networks ({userNetworks.length})</h3>
          <div className="networks-grid">
            {userNetworks.map((network) => (
              <NetworkCard
                key={network.id}
                network={network}
                onUpdate={loadNetworks}
              />
            ))}
          </div>
        </div>
      )}

      {systemNetworks.length > 0 && (
        <div className="network-section">
          <h3 className="section-title">System Networks ({systemNetworks.length})</h3>
          <div className="networks-grid">
            {systemNetworks.map((network) => (
              <NetworkCard
                key={network.id}
                network={network}
                onUpdate={loadNetworks}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkList;