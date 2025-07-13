import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { VolumeInfo } from '../types/docker';
import VolumeCard from './VolumeCard';

const VolumeList: React.FC = () => {
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVolumes = async () => {
    try {
      setLoading(true);
      setError(null);
      const volumeList = await invoke<VolumeInfo[]>('list_volumes');
      setVolumes(volumeList);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load volumes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVolumes();
  }, []);

  if (loading) {
    return (
      <div className="volume-list loading">
        <div className="loading-spinner"></div>
        <p>Loading volumes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="volume-list error">
        <div className="error-message">
          <h3>Failed to load volumes</h3>
          <p>{error}</p>
          <button onClick={loadVolumes} className="retry-button">
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  if (volumes.length === 0) {
    return (
      <div className="volume-list empty">
        <div className="empty-state">
          <h3>No volumes found</h3>
          <p>No Docker volumes are available on this system.</p>
          <button onClick={loadVolumes} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="volume-list">
      <div className="volume-list-header">
        <h2>Volumes ({volumes.length})</h2>
        <button onClick={loadVolumes} className="refresh-button">
          🔄 Refresh
        </button>
      </div>
      
      <div className="volumes-grid">
        {volumes.map((volume) => (
          <VolumeCard
            key={volume.name}
            volume={volume}
            onUpdate={loadVolumes}
          />
        ))}
      </div>
    </div>
  );
};

export default VolumeList;