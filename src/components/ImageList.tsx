import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ImageInfo } from '../types/docker';
import ImageCard from './ImageCard';

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
        <div className="image-stats">
          <h2>Images ({images.length})</h2>
          <span className="total-size">Total size: {formatSize(getTotalSize())}</span>
        </div>
        <button onClick={loadImages} className="refresh-button">
          🔄 Refresh
        </button>
      </div>
      
      <div className="images-grid">
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            onUpdate={loadImages}
          />
        ))}
      </div>
    </div>
  );
};

export default ImageList;