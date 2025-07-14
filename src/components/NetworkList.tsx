import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { NetworkInfo } from '../types/docker';
import DeleteNetworkModal from './DeleteNetworkModal';
import HeaderButton from './HeaderButton';
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

interface NetworkRowProps {
  network: NetworkInfo;
  isSelected: boolean;
  onToggleSelection: () => void;
  onDeleteRequest: (network: NetworkInfo) => void;
  visibleColumns: ColumnConfig[];
  allColumns: ColumnConfig[];
}

const NetworkRow: React.FC<NetworkRowProps> = ({ network, isSelected, onToggleSelection, onDeleteRequest, allColumns }) => {
  const handleDeleteClick = () => {
    // Prevent removal of system networks
    if (['bridge', 'host', 'none'].includes(network.name)) {
      alert('Cannot remove system networks (bridge, host, none)');
      return;
    }

    onDeleteRequest(network);
  };

  const isSystemNetwork = ['bridge', 'host', 'none'].includes(network.name);
  const subnet = network.ipam.config.length > 0 ? network.ipam.config[0].subnet || '-' : '-';
  const gateway = network.ipam.config.length > 0 ? network.ipam.config[0].gateway || '-' : '-';
  const connectedCount = Object.keys(network.containers).length;

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

  const getColumnValue = (columnId: string) => {
    switch (columnId) {
      case 'name':
        return (
          <div className="network-name-info">
            <span className="network-name">{network.name}</span>
            {isSystemNetwork && <span className="system-badge">System</span>}
          </div>
        );
      case 'networkId':
        return <code className="network-id">{network.id.substring(0, 12)}</code>;
      case 'driver':
        return network.driver;
      case 'scope':
        return network.scope;
      case 'subnet':
        return subnet;
      case 'gateway':
        return gateway;
      case 'created':
        return formatCreated(network.created);
      case 'containers':
        return `${connectedCount} container${connectedCount !== 1 ? 's' : ''}`;
      case 'attachable':
        return network.attachable ? 'Yes' : 'No';
      case 'internal':
        return network.internal ? 'Yes' : 'No';
      default:
        return null;
    }
  };

  return (
    <tr className={`network-row ${isSystemNetwork ? 'system-network' : ''}`}>
      <td className="checkbox-col">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelection}
          disabled={isSystemNetwork}
        />
      </td>
      <td className="status-col">
        <div className={`status-indicator ${isSystemNetwork ? 'system' : 'active'}`}>
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
            title="Copy network ID"
            onClick={() => navigator.clipboard.writeText(network.id)}
          >
            <Copy className="icon" />
          </button>
          <button
            onClick={handleDeleteClick}
            disabled={isSystemNetwork}
            className="action-button remove"
            title={isSystemNetwork ? "Cannot remove system networks" : "Remove network"}
          >
            <Trash2 className="icon" />
          </button>
        </div>
      </td>
    </tr>
  );
};

const NetworkList: React.FC = () => {
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNetworks, setSelectedNetworks] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [networkToDelete, setNetworkToDelete] = useState<NetworkInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'name', label: 'Name', visible: true, className: 'name-col' },
    { id: 'networkId', label: 'Network ID', visible: true, className: 'network-id-col' },
    { id: 'driver', label: 'Driver', visible: true, className: 'driver-col' },
    { id: 'scope', label: 'Scope', visible: true, className: 'scope-col' },
    { id: 'subnet', label: 'Subnet', visible: false, className: 'subnet-col' },
    { id: 'gateway', label: 'Gateway', visible: false, className: 'gateway-col' },
    { id: 'created', label: 'Created', visible: false, className: 'created-col' },
    { id: 'containers', label: 'Containers', visible: false, className: 'containers-col' },
    { id: 'attachable', label: 'Attachable', visible: false, className: 'attachable-col' },
    { id: 'internal', label: 'Internal', visible: false, className: 'internal-col' },
  ]);

  const loadNetworks = async () => {
    try {
      setLoading(true);
      setError(null);
      const networkList = await invoke<NetworkInfo[]>('list_networks');
      setNetworks(networkList);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load networks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNetworks();
  }, []);

  const handleDeleteRequest = (network: NetworkInfo) => {
    setNetworkToDelete(network);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!networkToDelete) return;

    setIsDeleting(true);
    try {
      const result = await invoke<string>('remove_network', { networkId: networkToDelete.id });
      console.log('Network removal result:', result);
      alert(`Network "${networkToDelete.name}" removed successfully!`);
      setShowDeleteModal(false);
      setNetworkToDelete(null);
      await loadNetworks();
    } catch (error) {
      console.error('Failed to remove network:', error);
      const errorMessage = error as string;
      
      let displayMessage = `Failed to remove network "${networkToDelete.name}": ${errorMessage}`;
      
      if (errorMessage.includes('in use') || errorMessage.includes('has active endpoints')) {
        displayMessage += '\n\nTip: This network is being used by running containers. Stop and disconnect containers from this network first.';
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
        displayMessage += '\n\nTip: Make sure Docker is running and you have permission to manage Docker networks.';
      } else if (errorMessage.includes('connect') || errorMessage.includes('socket')) {
        displayMessage += '\n\nTip: Make sure Docker Desktop is running and accessible.';
      }
      
      alert(displayMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setNetworkToDelete(null);
  };

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

  const toggleNetworkSelection = (networkId: string) => {
    setSelectedNetworks(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(networkId)) {
        newSelected.delete(networkId);
      } else {
        newSelected.add(networkId);
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

  const isSystemNetwork = (networkName: string): boolean => {
    return ['bridge', 'host', 'none'].includes(networkName);
  };

  const filteredNetworks = networks.filter(network => {
    const matchesSearch = network.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         network.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const visibleColumns = columns.filter(col => col.visible);

  if (loading) {
    return (
      <div className="network-list loading">
        <div className="loading-spinner"></div>
        <p>Loading networks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="network-list error">
        <div className="error-message">
          <h3>Failed to load networks</h3>
          <p>{error}</p>
          <button onClick={loadNetworks} className="retry-button">
            <RefreshCw className="icon" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="network-list">
      <div className="network-list-header">
        <h2>Networks</h2>
        <p className="page-subtitle">Manage your Docker networks and configure connectivity between containers. <a href="#">Learn more</a></p>
        
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
            <HeaderButton onClick={loadNetworks} title="Refresh networks">
              <RefreshCw className="icon" /> Refresh
            </HeaderButton>
            <HeaderButton onClick={() => {}} title="Create network">
              <Plus className="icon" /> Create
            </HeaderButton>
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
                  checked={selectedNetworks.size > 0 && selectedNetworks.size === filteredNetworks.filter(n => !isSystemNetwork(n.name)).length}
                  onChange={() => {
                    const selectableNetworks = filteredNetworks.filter(n => !isSystemNetwork(n.name));
                    if (selectedNetworks.size === selectableNetworks.length) {
                      setSelectedNetworks(new Set());
                    } else {
                      setSelectedNetworks(new Set(selectableNetworks.map(net => net.id)));
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
            {filteredNetworks.length === 0 ? (
              <tr>
                <td colSpan={1 + columns.filter(col => col.id !== 'name' && col.visible).length + 3} className="empty-row">
                  <div className="empty-state">
                    <h3>No networks found</h3>
                    <p>
                      {searchTerm 
                        ? 'No networks match your search criteria.' 
                        : 'No Docker networks are available on this system.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredNetworks.map((network) => (
                <NetworkRow
                  key={network.id}
                  network={network}
                  isSelected={selectedNetworks.has(network.id)}
                  onToggleSelection={() => toggleNetworkSelection(network.id)}
                  onDeleteRequest={handleDeleteRequest}
                  visibleColumns={visibleColumns}
                  allColumns={columns}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <DeleteNetworkModal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        networkName={networkToDelete?.name || ''}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default NetworkList;