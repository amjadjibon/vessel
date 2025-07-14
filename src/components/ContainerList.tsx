import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ContainerInfo, ContainerStats, ContainerProject } from '../types/docker';
import DeleteContainerModal from './DeleteContainerModal';
import HeaderButton from './HeaderButton';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Trash2, 
  Settings, 
  RefreshCw, 
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  className?: string;
}

interface ContainerRowProps {
  container: ContainerInfo;
  containerStats?: ContainerStats;
  isSelected: boolean;
  onToggleSelection: () => void;
  onUpdate: () => void;
  onContainerSelect?: (containerId: string) => void;
  visibleColumns: ColumnConfig[];
  allColumns: ColumnConfig[];
}

const ContainerRow: React.FC<ContainerRowProps> = ({ container, containerStats, isSelected, onToggleSelection, onUpdate, onContainerSelect, allColumns }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'remove' | 'pause' | 'unpause') => {
    if (action === 'remove') {
      setShowDeleteModal(true);
      return;
    }
    
    setIsLoading(true);
    try {
      let command = `${action}_container`;
      let params: any = { containerId: container.id };
      
      const result = await invoke<string>(command, params);
      console.log(`Container ${action} result:`, result);
      
      // Show success message
      const actionPastTense = action === 'restart' ? 'restarted' : `${action}ed`;
      alert(`Container "${container.name}" ${actionPastTense} successfully!`);
      
      await onUpdate();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
      const errorMessage = error as string;
      
      let displayMessage = `Failed to ${action} container "${container.name}": ${errorMessage}`;
      
      if (errorMessage.includes('not running') && action === 'stop') {
        displayMessage += '\n\nTip: This container is already stopped.';
      } else if (errorMessage.includes('already running') && action === 'start') {
        displayMessage += '\n\nTip: This container is already running.';
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
        displayMessage += '\n\nTip: Make sure Docker is running and you have permission to manage Docker containers.';
      } else if (errorMessage.includes('connect') || errorMessage.includes('socket')) {
        displayMessage += '\n\nTip: Make sure Docker Desktop is running and accessible.';
      }
      
      alert(displayMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    setIsLoading(true);
    try {
      const params: any = { 
        containerId: container.id,
        force: container.state.toLowerCase() === 'running'
      };
      
      const result = await invoke<string>('remove_container', params);
      console.log(`Container remove result:`, result);
      
      alert(`Container "${container.name}" removed successfully!`);
      await onUpdate();
    } catch (error) {
      console.error('Failed to remove container:', error);
      const errorMessage = error as string;
      
      let displayMessage = `Failed to remove container "${container.name}": ${errorMessage}`;
      
      if (errorMessage.includes('in use')) {
        displayMessage += '\n\nTip: Stop the container first before removing it, or use force removal.';
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
        displayMessage += '\n\nTip: Make sure Docker is running and you have permission to manage Docker containers.';
      } else if (errorMessage.includes('connect') || errorMessage.includes('socket')) {
        displayMessage += '\n\nTip: Make sure Docker Desktop is running and accessible.';
      }
      
      alert(displayMessage);
    } finally {
      setIsLoading(false);
      setShowDeleteModal(false);
    }
  };

  const getStatusIcon = (state: string) => {
    const isRunning = state.toLowerCase() === 'running';
    return (
      <div className={`status-indicator ${isRunning ? 'running' : 'stopped'}`}>
        <div className="status-dot"></div>
      </div>
    );
  };

  const formatPorts = (ports: typeof container.ports) => {
    if (ports.length === 0) return '-';
    return ports.map(port => 
      port.public_port 
        ? `${port.public_port}:${port.private_port}`
        : `${port.private_port}`
    ).join(', ');
  };

  const formatMemoryUsage = (usage: number) => {
    if (usage < 1024) return `${usage.toFixed(1)}B`;
    if (usage < 1024 * 1024) return `${(usage / 1024).toFixed(1)}KB`;
    if (usage < 1024 * 1024 * 1024) return `${(usage / (1024 * 1024)).toFixed(1)}MB`;
    return `${(usage / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  };

  const formatDiskReads = (reads: number) => {
    if (reads < 1024) return `${reads.toFixed(1)}B`;
    if (reads < 1024 * 1024) return `${(reads / 1024).toFixed(1)}KB`;
    if (reads < 1024 * 1024 * 1024) return `${(reads / (1024 * 1024)).toFixed(1)}MB`;
    return `${(reads / (1024 * 1024 * 1024)).toFixed(1)}GB`;
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

  const isRunning = container.state.toLowerCase() === 'running';

  const getColumnValue = (columnId: string) => {
    switch (columnId) {
      case 'name':
        return (
          <div className="container-name">
            <span className="name">{container.service || container.name}</span>
            {container.service && (
              <div className="service-info">
                <small className="container-full-name">{container.name}</small>
              </div>
            )}
          </div>
        );
      case 'containerId':
        return <code className="container-id">{container.id.substring(0, 12)}</code>;
      case 'image':
        return <span className="image-name">{container.image}</span>;
      case 'ports':
        return <span className="ports">{formatPorts(container.ports)}</span>;
      case 'cpu':
        return containerStats && isRunning ? `${containerStats.cpu_percentage.toFixed(1)}%` : 
               isRunning ? 'N/A' : 'N/A';
      case 'memoryUsage':
        return containerStats && isRunning ? 
               `${formatMemoryUsage(containerStats.memory_usage)} / ${formatMemoryUsage(containerStats.memory_limit)}` : 
               isRunning ? 'N/A' : 'N/A';
      case 'memoryPercent':
        return containerStats && isRunning ? `${containerStats.memory_percentage.toFixed(1)}%` : 
               isRunning ? 'N/A' : 'N/A';
      case 'diskReads':
        return containerStats && isRunning ? 
               `${formatDiskReads(containerStats.block_read)} / ${formatDiskReads(containerStats.block_write)}` : 
               isRunning ? 'N/A' : 'N/A';
      case 'networkIO':
        return containerStats && isRunning ? 
               `${formatDiskReads(containerStats.network_rx)} / ${formatDiskReads(containerStats.network_tx)}` : 
               isRunning ? 'N/A' : 'N/A';
      case 'pids':
        return containerStats && isRunning ? 'N/A' : 'N/A'; // PIDS not available in current stats
      case 'lastStarted':
        return formatCreated(container.created);
      default:
        return null;
    }
  };

  return (
    <>
      <tr 
        className={`container-row ${isRunning ? 'running' : 'stopped'} ${container.project ? 'has-project' : ''} ${onContainerSelect ? 'clickable' : ''}`}
        onClick={(e) => {
          // Only trigger container select if clicking on the row itself, not on interactive elements
          const target = e.target as HTMLElement;
          if (onContainerSelect && !target.closest('input, button, .action-button')) {
            onContainerSelect(container.id);
          }
        }}
      >
        <td className="checkbox-col">
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={onToggleSelection}
          />
        </td>
        <td className="status-col">
          {getStatusIcon(container.state)}
        </td>
        {/* Always show Name and Image first */}
        <td className="name-col">
          {getColumnValue('name')}
        </td>
        <td className="image-col">
          {getColumnValue('image')}
        </td>
        {/* Then show configurable columns */}
        {allColumns.filter(column => !['name', 'image'].includes(column.id) && column.visible).map(column => (
          <td key={column.id} className={column.className || `${column.id}-col`}>
            {getColumnValue(column.id)}
          </td>
        ))}
        <td className="actions-col">
          <div className="action-buttons">
            {isRunning ? (
              <button
                onClick={() => handleAction('stop')}
                disabled={isLoading}
                className="action-button stop"
                title="Stop container"
              >
                <Square className="action-icon" />
              </button>
            ) : (
              <button
                onClick={() => handleAction('start')}
                disabled={isLoading}
                className="action-button start"
                title="Start container"
              >
                <Play className="action-icon" />
              </button>
            )}
            <button
              onClick={() => handleAction('restart')}
              disabled={isLoading}
              className="action-button restart"
              title="Restart container"
            >
              <RotateCcw className="action-icon" />
            </button>
            <button
              onClick={() => handleAction('remove')}
              disabled={isLoading}
              className="action-button remove"
              title="Remove container"
            >
              <Trash2 className="action-icon" />
            </button>
          </div>
        </td>
      </tr>
      
      <DeleteContainerModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleRemove}
        containerName={container.name}
        isLoading={isLoading}
      />
    </>
  );
};

interface ProjectHeaderProps {
  project: ContainerProject;
  selectedContainers: Set<string>;
  onToggleExpansion: () => void;
  onToggleSelection: () => void;
  onProjectAction: (projectName: string, action: 'start' | 'stop' | 'restart') => void;
  visibleColumns: ColumnConfig[];
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({ 
  project, 
  selectedContainers, 
  onToggleExpansion, 
  onToggleSelection,
  onProjectAction,
  visibleColumns
}) => {
  const containerIds = project.containers.map(c => c.id);
  const allSelected = containerIds.length > 0 && containerIds.every(id => selectedContainers.has(id));
  const someSelected = containerIds.some(id => selectedContainers.has(id));
  
  const runningContainers = project.containers.filter(c => c.state.toLowerCase() === 'running').length;
  const totalContainers = project.containers.length;

  const visibleColumnCount = 2 + visibleColumns.filter(col => !['name', 'image'].includes(col.id) && col.visible).length; // 2 for Name and Image

  return (
    <tr className="project-header">
      <td className="checkbox-col">
        <input 
          type="checkbox" 
          checked={allSelected}
          ref={input => {
            if (input) input.indeterminate = someSelected && !allSelected;
          }}
          onChange={onToggleSelection}
        />
      </td>
      <td className="status-col">
        <button 
          className="expand-button"
          onClick={onToggleExpansion}
          title={project.isExpanded ? "Collapse" : "Expand"}
        >
          {project.isExpanded ? <ChevronDown className="expand-icon" /> : <ChevronRight className="expand-icon" />}
        </button>
      </td>
      <td colSpan={visibleColumnCount} className="project-info-col">
        <div className="project-info">
          <strong className="project-name">{project.name}</strong>
          <span className="project-stats">
            {runningContainers} of {totalContainers} running
          </span>
        </div>
      </td>
      <td className="actions-col">
        <div className="project-actions">
          <button
            onClick={() => onProjectAction(project.name, 'start')}
            className="action-button start"
            title="Start all containers"
          >
            <Play className="action-icon" />
          </button>
          <button
            onClick={() => onProjectAction(project.name, 'stop')}
            className="action-button stop"
            title="Stop all containers"
          >
            <Square className="action-icon" />
          </button>
          <button
            onClick={() => onProjectAction(project.name, 'restart')}
            className="action-button restart"
            title="Restart all containers"
          >
            <RotateCcw className="action-icon" />
          </button>
        </div>
      </td>
    </tr>
  );
};

interface ContainerListProps {
  onContainerSelect?: (containerId: string) => void;
}

const ContainerList: React.FC<ContainerListProps> = ({ onContainerSelect }) => {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [projects, setProjects] = useState<ContainerProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerStats, setContainerStats] = useState<Map<string, ContainerStats>>(new Map());
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyRunning, setShowOnlyRunning] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'name', label: 'Name', visible: true, className: 'name-col' },
    { id: 'image', label: 'Image', visible: true, className: 'image-col' },
    { id: 'containerId', label: 'Container ID', visible: true, className: 'container-id-col' },
    { id: 'ports', label: 'Port(s)', visible: true, className: 'ports-col' },
    { id: 'cpu', label: 'CPU (%)', visible: true, className: 'cpu-col' },
    { id: 'memoryUsage', label: 'Memory usage/limit', visible: true, className: 'memory-usage-col' },
    { id: 'memoryPercent', label: 'Memory (%)', visible: true, className: 'memory-percent-col' },
    { id: 'diskReads', label: 'Disk read/write', visible: true, className: 'disk-reads-col' },
    { id: 'networkIO', label: 'Network I/O', visible: false, className: 'network-io-col' },
    { id: 'pids', label: 'PIDS', visible: false, className: 'pids-col' },
    { id: 'lastStarted', label: 'Last started', visible: false, className: 'last-started-col' },
  ]);

  const groupContainersByProject = (containers: ContainerInfo[]): ContainerProject[] => {
    const projectMap = new Map<string, ContainerInfo[]>();
    
    containers.forEach(container => {
      // Only group containers that have a project
      if (container.project) {
        const projectName = container.project;
        if (!projectMap.has(projectName)) {
          projectMap.set(projectName, []);
        }
        projectMap.get(projectName)!.push(container);
      }
    });

    return Array.from(projectMap.entries()).map(([name, containers]) => ({
      name,
      containers: containers.sort((a, b) => a.name.localeCompare(b.name)),
      isExpanded: true,
      isSelected: false,
    })).sort((a, b) => a.name.localeCompare(b.name));
  };

  const loadContainers = async () => {
    try {
      setLoading(true);
      setError(null);
      const containerList = await invoke<ContainerInfo[]>('list_containers');
      setContainers(containerList);
      setProjects(groupContainersByProject(containerList));
    } catch (err) {
      setError(err as string);
      console.error('Failed to load containers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadContainerStats = async () => {
    try {
      const runningContainers = containers.filter(c => c.state.toLowerCase() === 'running');
      const statsMap = new Map<string, ContainerStats>();
      
      for (const container of runningContainers) {
        try {
          const stats = await invoke<ContainerStats>('get_container_stats', { containerId: container.id });
          statsMap.set(container.id, stats);
        } catch (error) {
          console.error(`Failed to get stats for container ${container.id}:`, error);
        }
      }
      
      setContainerStats(statsMap);
    } catch (error) {
      console.error('Failed to load container stats:', error);
    }
  };

  useEffect(() => {
    loadContainers();
  }, []);

  useEffect(() => {
    if (containers.length > 0) {
      loadContainerStats();
      
      const interval = setInterval(() => {
        loadContainerStats();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [containers]);

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

  const toggleProjectExpansion = (projectName: string) => {
    setProjects(prevProjects =>
      prevProjects.map(project =>
        project.name === projectName
          ? { ...project, isExpanded: !project.isExpanded }
          : project
      )
    );
  };

  const toggleProjectSelection = (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    if (!project) return;

    const containerIds = project.containers.map(c => c.id);
    
    setSelectedContainers(prev => {
      const newSelected = new Set(prev);
      const allSelected = containerIds.every(id => newSelected.has(id));
      
      if (allSelected) {
        containerIds.forEach(id => newSelected.delete(id));
      } else {
        containerIds.forEach(id => newSelected.add(id));
      }
      
      return newSelected;
    });
  };

  const handleProjectAction = async (projectName: string, action: 'start' | 'stop' | 'restart') => {
    const project = projects.find(p => p.name === projectName);
    if (!project) return;

    const promises = project.containers.map(container =>
      invoke<string>(`${action}_container`, { containerId: container.id })
        .catch(error => console.error(`Failed to ${action} container ${container.name}:`, error))
    );

    try {
      await Promise.all(promises);
      loadContainers();
    } catch (error) {
      console.error(`Failed to ${action} project containers:`, error);
    }
  };

  const toggleContainerSelection = (containerId: string) => {
    setSelectedContainers(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(containerId)) {
        newSelected.delete(containerId);
      } else {
        newSelected.add(containerId);
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

  const filteredProjects = projects.map(project => ({
    ...project,
    containers: project.containers.filter(container => {
      const matchesSearch = container.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           container.image.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           container.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRunningFilter = !showOnlyRunning || container.state.toLowerCase() === 'running';
      
      return matchesSearch && matchesRunningFilter;
    })
  })).filter(project => project.containers.length > 0);

  // Get individual containers (those without projects)
  const individualContainers = containers.filter(container => {
    if (container.project) return false; // Skip containers that have projects
    
    const matchesSearch = container.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         container.image.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         container.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRunningFilter = !showOnlyRunning || container.state.toLowerCase() === 'running';
    
    return matchesSearch && matchesRunningFilter;
  });

  const totalFilteredContainers = filteredProjects.reduce((sum, project) => sum + project.containers.length, 0) + individualContainers.length;

  const visibleColumns = columns.filter(col => col.visible);

  if (loading) {
    return (
      <div className="container-list loading">
        <div className="loading-spinner"></div>
        <p>Loading containers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-list error">
        <div className="error-message">
          <h3>Failed to load containers</h3>
          <p>{error}</p>
          <button onClick={loadContainers} className="retry-button">
            <RefreshCw className="retry-icon" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-list">
      <div className="container-list-header">
        <h2>Containers</h2>
        <p className="page-subtitle">View all your running containers and applications. <a href="#">Learn more</a></p>
        
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
                    {columns.filter(column => !['name', 'image'].includes(column.id)).map(column => (
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
            <div className="filter-container">
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={showOnlyRunning}
                  onChange={(e) => setShowOnlyRunning(e.target.checked)}
                />
                Only show running containers
              </label>
            </div>
          </div>
          <HeaderButton onClick={loadContainers} title="Refresh containers">
            <RefreshCw className="icon" /> Refresh
          </HeaderButton>
        </div>
      </div>
      
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="checkbox-col">
                <input 
                  type="checkbox" 
                  checked={selectedContainers.size > 0 && selectedContainers.size === totalFilteredContainers}
                  onChange={() => {
                    if (selectedContainers.size === totalFilteredContainers) {
                      setSelectedContainers(new Set());
                    } else {
                      const projectIds = filteredProjects.flatMap(project => project.containers.map(c => c.id));
                      const individualIds = individualContainers.map(c => c.id);
                      const allIds = [...projectIds, ...individualIds];
                      setSelectedContainers(new Set(allIds));
                    }
                  }}
                />
              </th>
              <th className="status-col"></th>
              <th className="name-col">Name</th>
              <th className="image-col">Image</th>
              {columns.filter(column => !['name', 'image'].includes(column.id) && column.visible).map(column => (
                <th key={column.id} className={column.className}>
                  {column.label}
                </th>
              ))}
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length === 0 && individualContainers.length === 0 ? (
              <tr>
                <td colSpan={2 + columns.filter(col => !['name', 'image'].includes(col.id) && col.visible).length + 3} className="empty-row">
                  <div className="empty-state">
                    <h3>No containers found</h3>
                    <p>
                      {searchTerm || showOnlyRunning 
                        ? 'No containers match your search criteria.' 
                        : 'No Docker containers are available on this system.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {filteredProjects.map((project) => (
                  <React.Fragment key={project.name}>
                    <ProjectHeader 
                      project={project}
                      selectedContainers={selectedContainers}
                      onToggleExpansion={() => toggleProjectExpansion(project.name)}
                      onToggleSelection={() => toggleProjectSelection(project.name)}
                      onProjectAction={handleProjectAction}
                      visibleColumns={visibleColumns}
                    />
                    {project.isExpanded && project.containers.map((container) => (
                      <ContainerRow
                        key={container.id}
                        container={container}
                        containerStats={containerStats.get(container.id)}
                        isSelected={selectedContainers.has(container.id)}
                        onToggleSelection={() => toggleContainerSelection(container.id)}
                        onUpdate={loadContainers}
                        onContainerSelect={onContainerSelect}
                        visibleColumns={visibleColumns}
                        allColumns={columns}
                      />
                    ))}
                  </React.Fragment>
                ))}
                {individualContainers.map((container) => (
                  <ContainerRow
                    key={container.id}
                    container={container}
                    containerStats={containerStats.get(container.id)}
                    isSelected={selectedContainers.has(container.id)}
                    onToggleSelection={() => toggleContainerSelection(container.id)}
                    onUpdate={loadContainers}
                    visibleColumns={visibleColumns}
                    allColumns={columns}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContainerList;