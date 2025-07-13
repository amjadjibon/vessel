import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { VolumeInfo } from '../types/docker';

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
        <h2>Volumes</h2>
        <p className="page-subtitle">Manage your volumes, view usage, and inspect their contents.</p>
        
        {/* Stats Section */}
        <div className="stats-section">
          <div className="stat-item">
            <span className="stat-label">Total volumes</span>
            <span className="stat-value">{volumes.length}</span>
            <span className="stat-note">active and inactive</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Volume storage</span>
            <span className="stat-value">2.1 GB</span>
            <span className="stat-note">estimated usage</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Last scan</span>
            <span className="stat-value">Just now</span>
            <span className="stat-note">auto-scan enabled</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Search volumes..." 
              style={{
                padding: '8px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '14px',
                width: '300px'
              }}
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button style={{
                padding: '6px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px 0 0 4px',
                backgroundColor: '#4A90E2',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer'
              }}>📋 List</button>
              <button style={{
                padding: '6px 12px',
                border: '1px solid #e0e0e0',
                borderLeft: 'none',
                borderRadius: '0 4px 4px 0',
                backgroundColor: 'white',
                color: '#757575',
                fontSize: '12px',
                cursor: 'pointer'
              }}>⊞ Grid</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{
              padding: '8px 16px',
              border: '1px solid #F44336',
              borderRadius: '4px',
              backgroundColor: '#F44336',
              color: 'white',
              fontSize: '14px',
              cursor: 'pointer'
            }}>🗑️ Delete</button>
            <button onClick={loadVolumes} className="refresh-button">
              🔄 Refresh
            </button>
          </div>
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
              <th>Created</th>
              <th>Size</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {volumes.map((volume) => (
              <VolumeRow
                key={volume.name}
                volume={volume}
                onUpdate={loadVolumes}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      {volumes.length > 0 && (
        <div className="table-footer">
          <span className="selection-count">Selected 0 of {volumes.length}</span>
        </div>
      )}
    </div>
  );
};

interface VolumeRowProps {
  volume: VolumeInfo;
  onUpdate: () => void;
}

const VolumeRow: React.FC<VolumeRowProps> = ({ volume, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to remove volume ${volume.name}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await invoke<string>('remove_volume', { volumeName: volume.name });
      console.log(result);
      onUpdate();
    } catch (error) {
      console.error('Failed to remove volume:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCreated = (createdAt?: string) => {
    if (!createdAt) return 'Unknown';
    const now = Date.now();
    const created = new Date(createdAt).getTime();
    const diff = now - created;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);

    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    return 'Today';
  };

  const isActive = Object.keys(volume.labels).length > 0;

  return (
    <tr>
      <td>
        <input type="checkbox" />
      </td>
      <td>
        <span className={`status-icon ${isActive ? 'active' : 'inactive'}`} title={isActive ? 'Active' : 'Inactive'}></span>
      </td>
      <td>
        <strong>{volume.name}</strong>
      </td>
      <td>
        {formatCreated(volume.created_at)}
      </td>
      <td>
        0 Bytes
      </td>
      <td>
        <div className="action-buttons">
          <button
            onClick={handleRemove}
            disabled={isLoading}
            className="action-btn delete"
            title="Remove volume"
          >
            🗑️
          </button>
          <button className="action-btn more" title="More actions">
            ⋯
          </button>
        </div>
      </td>
    </tr>
  );
};

export default VolumeList;