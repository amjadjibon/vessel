import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { VolumeInfo } from '../types/docker';
import { Trash2 } from 'lucide-react';

interface VolumeCardProps {
  volume: VolumeInfo;
  onUpdate: () => void;
}

const VolumeCard: React.FC<VolumeCardProps> = ({ volume, onUpdate }) => {
  const [isLoading, setIsLoading] = React.useState(false);

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
    const date = new Date(createdAt);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const hasLabels = Object.keys(volume.labels).length > 0;
  const hasOptions = Object.keys(volume.options).length > 0;

  return (
    <div className="volume-card">
      <div className="volume-header">
        <div className="volume-name-info">
          <h3 className="volume-name">{volume.name}</h3>
          <span className="driver-badge">{volume.driver}</span>
        </div>
        <div className="volume-actions">
          <button 
            onClick={handleRemove}
            disabled={isLoading}
            className="action-button remove"
          >
            <Trash2 className="action-icon" /> Remove
          </button>
        </div>
      </div>
      
      <div className="volume-details">
        <div className="detail-row">
          <span className="detail-label">Mountpoint:</span>
          <span className="detail-value volume-path">{volume.mountpoint}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Scope:</span>
          <span className="detail-value">{volume.scope}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Created:</span>
          <span className="detail-value">{formatCreated(volume.created_at)}</span>
        </div>
        
        {hasLabels && (
          <div className="detail-section">
            <span className="detail-section-title">Labels:</span>
            <div className="labels-list">
              {Object.entries(volume.labels).map(([key, value]) => (
                <div key={key} className="label-item">
                  <span className="label-key">{key}:</span>
                  <span className="label-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasOptions && (
          <div className="detail-section">
            <span className="detail-section-title">Options:</span>
            <div className="options-list">
              {Object.entries(volume.options).map(([key, value]) => (
                <div key={key} className="option-item">
                  <span className="option-key">{key}:</span>
                  <span className="option-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VolumeCard;