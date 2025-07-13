import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ImageInfo } from '../types/docker';
import { 
  Trash2, 
  Settings, 
  RefreshCw
} from 'lucide-react';

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  className?: string;
}

interface ImageRowProps {
  image: ImageInfo;
  isSelected: boolean;
  onToggleSelection: () => void;
  onUpdate: () => void;
  visibleColumns: ColumnConfig[];
  allColumns: ColumnConfig[];
}

const ImageRow: React.FC<ImageRowProps> = ({ image, isSelected, onToggleSelection, onUpdate, allColumns }) => {
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
      const errorMessage = error as string;
      
      // Check if it's a dependency error and offer force removal
      if (errorMessage.includes('conflict') || errorMessage.includes('being used') || errorMessage.includes('Tip:')) {
        const forceRemove = confirm(`${errorMessage}\n\nWould you like to force remove this image? This will remove the image even if it's being used by containers.`);
        
        if (forceRemove) {
          try {
            const forceResult = await invoke<string>('force_remove_image', { imageId: image.id });
            console.log(forceResult);
            onUpdate();
          } catch (forceError) {
            console.error('Failed to force remove image:', forceError);
            alert(`Failed to force remove image: ${forceError}`);
          }
        }
      } else {
        alert(`Failed to remove image: ${errorMessage}`);
      }
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

  const getTagName = () => {
    if (image.repo_tags.length > 0 && image.repo_tags[0] !== '<none>:<none>') {
      return image.repo_tags[0];
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
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const isDangling = image.repo_tags.length === 0 || image.repo_tags[0] === '<none>:<none>';

  const getStatusIcon = () => {
    return (
      <div className={`status-indicator ${isDangling ? 'dangling' : 'active'}`}>
        <div className="status-dot"></div>
      </div>
    );
  };

  const getColumnValue = (columnId: string) => {
    switch (columnId) {
      case 'tag':
        return (
          <div className="image-tag-info">
            <span className="tag-name">{getTagName()}</span>
            {isDangling && <span className="dangling-badge">Dangling</span>}
          </div>
        );
      case 'imageId':
        return <code className="image-id">{image.id.substring(7, 19)}</code>;
      case 'created':
        return formatCreated(image.created);
      case 'size':
        return formatSize(image.size);
      default:
        return null;
    }
  };

  return (
    <tr className={`image-row ${isDangling ? 'dangling' : ''}`}>
      <td className="checkbox-col">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={onToggleSelection}
        />
      </td>
      <td className="status-col">
        {getStatusIcon()}
      </td>
      {/* Always show Tag first */}
      <td className="tag-col">
        {getColumnValue('tag')}
      </td>
      {/* Then show configurable columns */}
      {allColumns.filter(column => column.id !== 'tag' && column.visible).map(column => (
        <td key={column.id} className={column.className || `${column.id}-col`}>
          {getColumnValue(column.id)}
        </td>
      ))}
      <td className="actions-col">
        <div className="action-buttons">
          <button
            onClick={handleRemove}
            disabled={isLoading}
            className="action-button remove"
            title="Remove image"
          >
            <Trash2 className="action-icon" />
          </button>
        </div>
      </td>
    </tr>
  );
};

const ImageList: React.FC = () => {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'tag', label: 'Tag', visible: true, className: 'tag-col' },
    { id: 'imageId', label: 'Image ID', visible: true, className: 'image-id-col' },
    { id: 'created', label: 'Created', visible: true, className: 'created-col' },
    { id: 'size', label: 'Size', visible: true, className: 'size-col' },
  ]);

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

  // Close column selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showColumnSelector && !target.closest('.column-selector-container')) {
        setShowColumnSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnSelector]);

  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(imageId)) {
        newSelected.delete(imageId);
      } else {
        newSelected.add(imageId);
      }
      return newSelected;
    });
  };

  const toggleColumnVisibility = (columnId: string) => {
    setColumns(prevColumns =>
      prevColumns.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const showAllColumns = () => {
    setColumns(prevColumns =>
      prevColumns.map(col => ({ ...col, visible: true }))
    );
  };

  const hideAllColumns = () => {
    setColumns(prevColumns =>
      prevColumns.map(col => ({ ...col, visible: false }))
    );
  };

  const filteredImages = images.filter(image => {
    const tagName = image.repo_tags.length > 0 && image.repo_tags[0] !== '<none>:<none>' 
      ? image.repo_tags[0] 
      : '<none>';
    
    const matchesSearch = tagName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         image.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const visibleColumns = columns.filter(col => col.visible);
  const totalSize = images.reduce((sum, image) => sum + image.size, 0);
  const formatTotalSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(2);
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
            <RefreshCw className="retry-icon" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="image-list">
      <div className="image-list-header">
        <h2>Images</h2>
        <p className="page-subtitle">View and manage your local and Docker Hub images. <a href="#">Learn more</a></p>
        
        {/* Tabs */}
        <div className="tabs-section">
          <div className="tab active">Local</div>
          <div className="tab">My Hub</div>
        </div>

        {/* Usage Stats */}
        <div className="usage-section">
          <div className="usage-bar">
            <div className="usage-progress" style={{ width: '42%' }}></div>
          </div>
          <div className="usage-text">
            <span>{formatTotalSize(totalSize)} GB / 17.97 GB in use</span>
            <span>{images.length} images</span>
          </div>
        </div>
        
        <div className="controls-section">
          <div className="search-and-filter">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="column-selector-container">
              <button
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="column-selector-button"
                title="Configure columns"
              >
                <Settings className="column-selector-icon" />
              </button>
              {showColumnSelector && (
                <div className="column-selector-dropdown">
                  <div className="column-selector-header">
                    <span>Columns</span>
                  </div>
                  <div className="column-selector-list">
                    {columns.filter(column => column.id !== 'tag').map(column => (
                      <label key={column.id} className="column-selector-item">
                        <input
                          type="checkbox"
                          checked={column.visible}
                          onChange={() => toggleColumnVisibility(column.id)}
                        />
                        <span className="column-label">{column.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="column-selector-actions">
                    <button onClick={hideAllColumns} className="column-action-button">
                      Hide all
                    </button>
                    <button onClick={showAllColumns} className="column-action-button">
                      Show all
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <button onClick={loadImages} className="refresh-button">
            <RefreshCw className="refresh-icon" />
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
                  checked={selectedImages.size > 0 && selectedImages.size === filteredImages.length}
                  onChange={() => {
                    if (selectedImages.size === filteredImages.length) {
                      setSelectedImages(new Set());
                    } else {
                      setSelectedImages(new Set(filteredImages.map(img => img.id)));
                    }
                  }}
                />
              </th>
              <th className="status-col"></th>
              <th className="tag-col">Tag</th>
              {columns.filter(column => column.id !== 'tag' && column.visible).map(column => (
                <th key={column.id} className={column.className}>
                  {column.label}
                </th>
              ))}
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredImages.length === 0 ? (
              <tr>
                <td colSpan={1 + columns.filter(col => col.id !== 'tag' && col.visible).length + 3} className="empty-row">
                  <div className="empty-state">
                    <h3>No images found</h3>
                    <p>
                      {searchTerm 
                        ? 'No images match your search criteria.' 
                        : 'No Docker images are available on this system.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredImages.map((image) => (
                <ImageRow
                  key={image.id}
                  image={image}
                  isSelected={selectedImages.has(image.id)}
                  onToggleSelection={() => toggleImageSelection(image.id)}
                  onUpdate={loadImages}
                  visibleColumns={visibleColumns}
                  allColumns={columns}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ImageList;