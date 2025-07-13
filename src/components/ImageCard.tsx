import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ImageInfo } from '../types/docker';
import { Trash2 } from 'lucide-react';

interface ImageCardProps {
  image: ImageInfo;
  onUpdate: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, onUpdate }) => {
  const [isLoading, setIsLoading] = React.useState(false);

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
      return image.repo_tags[0];
    }
    return image.id.substring(7, 19); // Remove 'sha256:' prefix and show first 12 chars
  };

  const formatSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatCreated = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const isDangling = image.repo_tags.length === 0 || image.repo_tags[0] === '<none>:<none>';

  return (
    <div className={`image-card ${isDangling ? 'dangling' : ''}`}>
      <div className="image-header">
        <div className="image-name-info">
          <h3 className="image-name">{getDisplayName()}</h3>
          {isDangling && <span className="dangling-badge">Dangling</span>}
        </div>
        <div className="image-actions">
          <button 
            onClick={handleRemove}
            disabled={isLoading}
            className="action-button remove"
          >
            <Trash2 className="action-icon" /> Remove
          </button>
        </div>
      </div>
      
      <div className="image-details">
        {image.repo_tags.length > 1 && (
          <div className="detail-row">
            <span className="detail-label">Tags:</span>
            <span className="detail-value">{image.repo_tags.slice(1).join(', ')}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Size:</span>
          <span className="detail-value">{formatSize(image.size)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Virtual Size:</span>
          <span className="detail-value">{formatSize(image.virtual_size)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Created:</span>
          <span className="detail-value">{formatCreated(image.created)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">ID:</span>
          <span className="detail-value image-id">{image.id.substring(7, 19)}</span>
        </div>
      </div>
    </div>
  );
};

export default ImageCard;