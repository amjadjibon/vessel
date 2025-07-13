import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ImageInfo } from '../types/docker';

const ImageList: React.FC = () => {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadImages = async () => {
    try {
      setLoading(true);
      setError(null);
      const imageList = await invoke<ImageInfo[]>('list_images');
      setImages(imageList);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load images:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  const getTotalSize = () => {
    return images.reduce((total, image) => total + image.size, 0);
  };

  const formatSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="image-list loading">
        <div className="loading-spinner"></div>
        <p>Loading images...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="image-list error">
        <div className="error-message">
          <h3>Failed to load images</h3>
          <p>{error}</p>
          <button onClick={loadImages} className="retry-button">
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="image-list empty">
        <div className="empty-state">
          <h3>No images found</h3>
          <p>No Docker images are available on this system.</p>
          <button onClick={loadImages} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="image-list">
      <div className="image-list-header">
        <h2>Images</h2>
        <p className="page-subtitle">View and manage your local and Docker Hub images.</p>
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '16px' }}>
          <button style={{
            padding: '8px 16px',
            border: '1px solid #e0e0e0',
            borderRight: 'none',
            borderRadius: '4px 0 0 4px',
            backgroundColor: '#4A90E2',
            color: 'white',
            fontSize: '14px',
            cursor: 'pointer'
          }}>Local</button>
          <button style={{
            padding: '8px 16px',
            border: '1px solid #e0e0e0',
            borderRadius: '0 4px 4px 0',
            backgroundColor: 'white',
            color: '#757575',
            fontSize: '14px',
            cursor: 'pointer'
          }}>My Hub</button>
        </div>

        {/* Stats Section */}
        <div className="stats-section">
          <div className="stat-item">
            <span className="stat-label">Storage used</span>
            <span className="stat-value">{formatSize(getTotalSize())}</span>
            <span className="stat-note">in use</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total images</span>
            <span className="stat-value">{images.length}</span>
            <span className="stat-note">local images</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Last refresh</span>
            <span className="stat-value">Just now</span>
            <span className="stat-note">auto-refresh enabled</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Search images..." 
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
          <button onClick={loadImages} className="refresh-button">
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
              <th>Tag</th>
              <th>Image ID</th>
              <th>Created</th>
              <th>Size</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {images.map((image) => (
              <ImageRow
                key={image.id}
                image={image}
                onUpdate={loadImages}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface ImageRowProps {
  image: ImageInfo;
  onUpdate: () => void;
}

const ImageRow: React.FC<ImageRowProps> = ({ image, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to remove image ${getDisplayName()}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await invoke<string>('remove_image', { imageId: image.id });
      console.log(result);
      onUpdate();
    } catch (error) {
      console.error('Failed to remove image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayName = () => {
    if (image.repo_tags.length > 0 && image.repo_tags[0] !== '<none>:<none>') {
      const fullTag = image.repo_tags[0];
      const parts = fullTag.split(':');
      return parts[0]; // Return name without tag
    }
    return '<none>';
  };

  const getTag = () => {
    if (image.repo_tags.length > 0 && image.repo_tags[0] !== '<none>:<none>') {
      const fullTag = image.repo_tags[0];
      const parts = fullTag.split(':');
      return parts[1] || 'latest'; // Return tag or 'latest'
    }
    return '<none>';
  };

  const formatSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatCreated = (timestamp: number) => {
    const now = Date.now();
    const diff = now - (timestamp * 1000);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const isDangling = image.repo_tags.length === 0 || image.repo_tags[0] === '<none>:<none>';

  return (
    <tr className={isDangling ? 'dangling-row' : ''}>
      <td>
        <input type="checkbox" />
      </td>
      <td>
        <span className={`status-icon ${isDangling ? 'inactive' : 'active'}`} title={isDangling ? 'Dangling' : 'Active'}></span>
      </td>
      <td>
        <strong>{getDisplayName()}</strong>
      </td>
      <td>
        <span className="image-tag">{getTag()}</span>
      </td>
      <td>
        <span className="image-id-short">{image.id.substring(7, 19)}</span>
      </td>
      <td>
        {formatCreated(image.created)}
      </td>
      <td>
        {formatSize(image.size)}
      </td>
      <td>
        <div className="action-buttons">
          <button
            onClick={handleRemove}
            disabled={isLoading}
            className="action-btn delete"
            title="Remove image"
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

export default ImageList;