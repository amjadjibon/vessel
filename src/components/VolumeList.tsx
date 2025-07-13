import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { VolumeInfo } from '../types/docker';
import { 
  Trash2, 
  Settings, 
  RefreshCw,
  Copy,
  Plus
} from 'lucide-react';

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  className?: string;
}

interface VolumeRowProps {
  volume: VolumeInfo;
  isSelected: boolean;
  onToggleSelection: () => void;
  onUpdate: () => void;
  visibleColumns: ColumnConfig[];
  allColumns: ColumnConfig[];
}

const VolumeRow: React.FC<VolumeRowProps> = ({ volume, isSelected, onToggleSelection, onUpdate, allColumns }) => {
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
      alert(`Failed to remove volume: ${error}`);
    } finally {
      setIsLoading(false);
    }
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
      {/* Always show Name first */}
      <td className="name-col">
        {getColumnValue('name')}
      </td>
      {/* Then show configurable columns */}
      {allColumns.filter(column => column.id !== 'name' && column.visible).map(column => (
        <td key={column.id} className={column.className || `${column.id}-col`}>
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
            onClick={handleRemove}
            disabled={isLoading}
            className="action-button remove"
            title="Remove volume"
          >
            <Trash2 className="icon" />
          </button>
        </div>
      </td>
    </tr>
  );
};

const VolumeList: React.FC = () => {
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVolumes, setSelectedVolumes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'name', label: 'Name', visible: true, className: 'name-col' },
    { id: 'created', label: 'Created', visible: true, className: 'created-col' },
    { id: 'size', label: 'Size', visible: true, className: 'size-col' },
    { id: 'driver', label: 'Driver', visible: false, className: 'driver-col' },
    { id: 'scope', label: 'Scope', visible: false, className: 'scope-col' },
  ]);

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
            <button onClick={loadVolumes} className="refresh-button">
              <RefreshCw className="icon" /> Refresh
            </button>
            <button className="create-button">
              <Plus className="icon" /> Create
            </button>
          </div>
        </div>
      </div>
      
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
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
              <th className="name-col">Name</th>
              {columns.filter(column => column.id !== 'name' && column.visible).map(column => (
                <th key={column.id} className={column.className}>
                  {column.label}
                </th>
              ))}
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVolumes.length === 0 ? (
              <tr>
                <td colSpan={1 + columns.filter(col => col.id !== 'name' && col.visible).length + 3} className="empty-row">
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
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VolumeList;