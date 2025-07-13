import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ContainerInfo } from '../types/docker';
import ContainerCard from './ContainerCard';

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
        <h2>Containers ({containers.length})</h2>
        <button onClick={loadContainers} className="refresh-button">
          🔄 Refresh
        </button>
      </div>
      
      <div className="containers-grid">
        {containers.map((container) => (
          <ContainerCard
            key={container.id}
            container={container}
            onUpdate={loadContainers}
          />
        ))}
      </div>
    </div>
  );
};

export default ContainerList;