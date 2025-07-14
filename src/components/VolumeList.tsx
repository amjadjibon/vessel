import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { VolumeInfo } from '../types/docker';
import DeleteVolumeModal from './DeleteVolumeModal';
import HeaderButton from './HeaderButton';
import { 
  Trash2, 
  Settings, 
  RefreshCw,
  Copy,
  Plus
} from 'lucide-react';
import { useColumnResize, ResizableColumnConfig } from '../hooks/useColumnResize';
import ResizableTableHeader from './ResizableTableHeader';

interface ColumnConfig extends ResizableColumnConfig {}

interface VolumeRowProps {
  volume: VolumeInfo;
  isSelected: boolean;
  onToggleSelection: () => void;
  onUpdate: () => void;
  visibleColumns: ColumnConfig[];
  allColumns: ColumnConfig[];
  getColumnStyle: (columnId: string) => React.CSSProperties;
}

const VolumeRow: React.FC<VolumeRowProps> = ({ volume, isSelected, onToggleSelection, onUpdate, allColumns, getColumnStyle }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleRemove = async () => {
    setIsLoading(true);
    try {
      console.log(`Starting volume removal for: ${volume.name}`);
      const result = await invoke<string>('remove_volume', { volumeName: volume.name });
      console.log('Volume removal result:', result);
      
      // Show success message
      alert(`Volume "${volume.name}" removed successfully!`);
      
      // Refresh the list to show the updated state
      console.log('Refreshing volume list after deletion...');
      await onUpdate();
      console.log('Volume list refreshed successfully');
    } catch (error) {
      console.error('Failed to remove volume:', error);
      console.error('Error type:', typeof error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      const errorMessage = error as string;
      
      // Enhanced error message with troubleshooting hints
      let displayMessage = `Failed to remove volume "${volume.name}": ${errorMessage}`;
      
      if (errorMessage.includes('in use') || errorMessage.includes('volume is in use')) {
        displayMessage += '\n\nTip: This volume might be mounted by a running container. Stop and remove the container first, then try again.';
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
        displayMessage += '\n\nTip: Make sure Docker is running and you have permission to manage Docker volumes.';
      } else if (errorMessage.includes('connect') || errorMessage.includes('socket')) {
        displayMessage += '\n\nTip: Make sure Docker Desktop is running and accessible.';
      } else if (errorMessage.includes('No such volume') || errorMessage.includes('not found')) {
        displayMessage += '\n\nTip: The volume may have already been removed or does not exist.';
      }
      
      alert(displayMessage);
    } finally {
      setIsLoading(false);
      setShowDeleteModal(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const formatCreated = (createdAt?: string) => {
    if (!createdAt) return '-';
    const date = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getColumnValue = (columnId: string) => {
    switch (columnId) {
      case 'name':
        return <span className="volume-name">{volume.name}</span>;
      case 'created':
        return formatCreated(volume.created_at);
      case 'size':
        return formatSize(volume.size);
      case 'driver':
        return volume.driver;
      case 'scope':
        return volume.scope;
      default:
        return null;
    }
  };

  return (
    <>
      <tr className="volume-row">
        <td className="checkbox-col">
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={onToggleSelection}
          />
        </td>
        <td className="status-col">
          <div className="status-indicator active">
            <div className="status-dot"></div>
          </div>
        </td>
        {/* Render all visible columns */}
        {allColumns.filter(column => column.visible).map(column => (
          <td key={column.id} className={column.className || `${column.id}-col`} style={getColumnStyle(column.id)}>
            {getColumnValue(column.id)}
          </td>
        ))}
        <td className="actions-col">
          <div className="action-buttons">
            <button
              className="action-button copy"
              title="Copy volume name"
              onClick={() => navigator.clipboard.writeText(volume.name)}
            >
              <Copy className="icon" />
            </button>
            <button
              onClick={handleDeleteClick}
              disabled={isLoading}
              className="action-button remove"
              title="Remove volume"
            >
              <Trash2 className="icon" />
            </button>
          </div>
        </td>
      </tr>
      
      <DeleteVolumeModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleRemove}
        volumeName={volume.name}
        isLoading={isLoading}
      />
    </>
  );
};

const VolumeList: React.FC = () => {
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVolumes, setSelectedVolumes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVolumeName, setNewVolumeName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const initialColumns: ColumnConfig[] = [
    { id: 'name', label: 'Name', visible: true, className: 'name-col', width: 200, minWidth: 120, maxWidth: 400 },
    { id: 'created', label: 'Created', visible: true, className: 'created-col', width: 150, minWidth: 100, maxWidth: 250 },
    { id: 'size', label: 'Size', visible: true, className: 'size-col', width: 120, minWidth: 80, maxWidth: 200 },
    { id: 'driver', label: 'Driver', visible: false, className: 'driver-col', width: 100, minWidth: 80, maxWidth: 150 },
    { id: 'scope', label: 'Scope', visible: false, className: 'scope-col', width: 100, minWidth: 80, maxWidth: 150 },
  ];

  const {
    columns,
    setColumns,
    isResizing,
    handleMouseDown,
    toggleColumnVisibility,
    getColumnStyle
  } = useColumnResize(initialColumns);

  const loadVolumes = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading volumes...');
      const volumeList = await invoke<VolumeInfo[]>('list_volumes');
      console.log('Volumes loaded successfully:', volumeList.length, 'volumes found');
      setVolumes(volumeList);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load volumes:', err);
      
      // Check if it's a Docker connection issue
      const errorMessage = err as string;
      if (errorMessage.includes('connect') || errorMessage.includes('socket')) {
        console.error('Docker connection issue detected. Make sure Docker Desktop is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  const createVolume = async () => {
    if (!newVolumeName.trim()) {
      alert('Please enter a volume name');
      return;
    }

    setIsCreating(true);
    try {
      const result = await invoke<string>('create_volume', { volumeName: newVolumeName.trim() });
      console.log('Volume creation result:', result);
      
      // Close modal and reset form
      setShowCreateModal(false);
      setNewVolumeName('');
      
      // Show success message
      alert(`Volume "${newVolumeName.trim()}" created successfully!`);
      
      // Refresh the volumes list
      await loadVolumes();
    } catch (error) {
      console.error('Failed to create volume:', error);
      const errorMessage = error as string;
      
      let displayMessage = `Failed to create volume "${newVolumeName.trim()}": ${errorMessage}`;
      
      if (errorMessage.includes('already exists') || errorMessage.includes('name') && errorMessage.includes('conflict')) {
        displayMessage += '\n\nTip: A volume with this name already exists. Choose a different name.';
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
        displayMessage += '\n\nTip: Make sure Docker is running and you have permission to create Docker volumes.';
      } else if (errorMessage.includes('connect') || errorMessage.includes('socket')) {
        displayMessage += '\n\nTip: Make sure Docker Desktop is running and accessible.';
      }
      
      alert(displayMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateModalClose = () => {
    setShowCreateModal(false);
    setNewVolumeName('');
  };

  useEffect(() => {
    loadVolumes();
  }, []);

  // Close column selector and modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showColumnSelector && !target.closest('.column-selector-container')) {
        setShowColumnSelector(false);
      }
      if (showCreateModal && target.classList.contains('modal-overlay')) {
        handleCreateModalClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnSelector, showCreateModal]);

  const toggleVolumeSelection = (volumeName: string) => {
    setSelectedVolumes(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(volumeName)) {
        newSelected.delete(volumeName);
      } else {
        newSelected.add(volumeName);
      }
      return newSelected;
    });
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

  const filteredVolumes = volumes.filter(volume => {
    const matchesSearch = volume.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const visibleColumns = columns.filter(col => col.visible);

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
            <RefreshCw className="icon" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="volume-list">
      <div className="volume-list-header">
        <h2>Volumes</h2>
        <p className="page-subtitle">Manage your volumes, view usage, and inspect their contents. <a href="#">Learn more</a></p>
        
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
                <Settings className="icon" />
              </button>
              {showColumnSelector && (
                <div className="column-selector-dropdown">
                  <div className="column-selector-header">
                    <span>Columns</span>
                  </div>
                  <div className="column-selector-list">
                    {columns.filter(column => column.id !== 'name').map(column => (
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
          <div className="header-actions">
            <HeaderButton onClick={loadVolumes} title="Refresh volumes">
              <RefreshCw className="icon" /> Refresh
            </HeaderButton>
            <HeaderButton onClick={() => setShowCreateModal(true)} title="Create volume">
              <Plus className="icon" /> Create
            </HeaderButton>
          </div>
        </div>
      </div>
      
      <div className="table-container">
        <table className={`data-table ${isResizing ? 'resizing' : ''}`}>
          <ResizableTableHeader
            columns={columns}
            onMouseDown={handleMouseDown}
            getColumnStyle={getColumnStyle}
            isResizing={isResizing}
            staticColumns={
              <>
                <th className="checkbox-col">
                  <input 
                    type="checkbox" 
                    checked={selectedVolumes.size > 0 && selectedVolumes.size === filteredVolumes.length}
                    onChange={() => {
                      if (selectedVolumes.size === filteredVolumes.length) {
                        setSelectedVolumes(new Set());
                      } else {
                        setSelectedVolumes(new Set(filteredVolumes.map(vol => vol.name)));
                      }
                    }}
                  />
                </th>
                <th className="status-col"></th>
              </>
            }
          >
            <th className="actions-col">Actions</th>
          </ResizableTableHeader>
          <tbody>
            {filteredVolumes.length === 0 ? (
              <tr>
                <td colSpan={columns.filter(col => col.visible).length + 3} className="empty-row">
                  <div className="empty-state">
                    <h3>No volumes found</h3>
                    <p>
                      {searchTerm 
                        ? 'No volumes match your search criteria.' 
                        : 'No Docker volumes are available on this system.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredVolumes.map((volume) => (
                <VolumeRow
                  key={volume.name}
                  volume={volume}
                  isSelected={selectedVolumes.has(volume.name)}
                  onToggleSelection={() => toggleVolumeSelection(volume.name)}
                  onUpdate={loadVolumes}
                  visibleColumns={visibleColumns}
                  allColumns={columns}
                  getColumnStyle={getColumnStyle}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Volume Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>New Volume</h3>
              <button 
                className="modal-close"
                onClick={handleCreateModalClose}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="volumeName">Name your volume</label>
                <input
                  id="volumeName"
                  type="text"
                  placeholder="Volume name"
                  value={newVolumeName}
                  onChange={(e) => setNewVolumeName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isCreating && createVolume()}
                  className="volume-name-input"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-button"
                onClick={handleCreateModalClose}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button 
                className="create-button"
                onClick={createVolume}
                disabled={isCreating || !newVolumeName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VolumeList;