import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ContainerInfo, ContainerStats, ContainerProject } from '../types/docker';

interface ContainerRowProps {
  container: ContainerInfo;
  containerStats?: ContainerStats;
  isSelected: boolean;
  onToggleSelection: () => void;
  onUpdate: () => void;
}

const ContainerRow: React.FC<ContainerRowProps> = ({ container, containerStats, isSelected, onToggleSelection, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'remove' | 'pause' | 'unpause') => {
    setIsLoading(true);
    try {
      let command = `${action}_container`;
      let params: any = { containerId: container.id };
      
      if (action === 'remove') {
        const confirmed = confirm(`Are you sure you want to remove container "${container.name}"?`);
        if (!confirmed) {
          setIsLoading(false);
          return;
        }
        params.force = container.state.toLowerCase() === 'running';
      }
      
      const result = await invoke<string>(command, params);
      console.log(result);
      onUpdate();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
      alert(`Failed to ${action} container: ${error}`);
    } finally {
      setIsLoading(false);
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

  const isRunning = container.state.toLowerCase() === 'running';

  return (
    <tr className={`container-row ${isRunning ? 'running' : 'stopped'} ${container.project ? 'has-project' : ''}`}>
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
      <td className="name-col">
        <div className="container-name">
          <span className="name">{container.service || container.name}</span>
          {container.service && (
            <div className="service-info">
              <small className="container-full-name">{container.name}</small>
            </div>
          )}
        </div>
      </td>
      <td className="container-id-col">
        <code className="container-id">{container.id.substring(0, 12)}</code>
      </td>
      <td className="image-col">
        <span className="image-name">{container.image}</span>
      </td>
      <td className="ports-col">
        <span className="ports">{formatPorts(container.ports)}</span>
      </td>
      <td className="cpu-col">
        {containerStats && isRunning ? `${containerStats.cpu_percentage.toFixed(1)}%` : 
         isRunning ? 'N/A' : 'N/A'}
      </td>
      <td className="memory-usage-col">
        {containerStats && isRunning ? formatMemoryUsage(containerStats.memory_usage) : 
         isRunning ? 'N/A' : 'N/A'}
      </td>
      <td className="memory-percent-col">
        {containerStats && isRunning ? `${containerStats.memory_percentage.toFixed(1)}%` : 
         isRunning ? 'N/A' : 'N/A'}
      </td>
      <td className="disk-reads-col">
        {containerStats && isRunning ? formatDiskReads(containerStats.block_read) : 
         isRunning ? 'N/A' : 'N/A'}
      </td>
      <td className="actions-col">
        <div className="action-buttons">
          {isRunning ? (
            <button
              onClick={() => handleAction('stop')}
              disabled={isLoading}
              className="action-button stop"
              title="Stop container"
            >
              ⏹️
            </button>
          ) : (
            <button
              onClick={() => handleAction('start')}
              disabled={isLoading}
              className="action-button start"
              title="Start container"
            >
              ▶️
            </button>
          )}
          <button
            onClick={() => handleAction('restart')}
            disabled={isLoading}
            className="action-button restart"
            title="Restart container"
          >
            🔄
          </button>
          <button
            onClick={() => handleAction('remove')}
            disabled={isLoading}
            className="action-button remove"
            title="Remove container"
          >
            🗑️
          </button>
        </div>
      </td>
    </tr>
  );
};

interface ProjectHeaderProps {
  project: ContainerProject;
  selectedContainers: Set<string>;
  onToggleExpansion: () => void;
  onToggleSelection: () => void;
  onProjectAction: (projectName: string, action: 'start' | 'stop' | 'restart') => void;
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({ 
  project, 
  selectedContainers, 
  onToggleExpansion, 
  onToggleSelection,
  onProjectAction 
}) => {
  const containerIds = project.containers.map(c => c.id);
  const allSelected = containerIds.length > 0 && containerIds.every(id => selectedContainers.has(id));
  const someSelected = containerIds.some(id => selectedContainers.has(id));
  
  const runningContainers = project.containers.filter(c => c.state.toLowerCase() === 'running').length;
  const totalContainers = project.containers.length;

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
          {project.isExpanded ? '▼' : '▶'}
        </button>
      </td>
      <td colSpan={8} className="project-info-col">
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
            ▶️
          </button>
          <button
            onClick={() => onProjectAction(project.name, 'stop')}
            className="action-button stop"
            title="Stop all containers"
          >
            ⏹️
          </button>
          <button
            onClick={() => onProjectAction(project.name, 'restart')}
            className="action-button restart"
            title="Restart all containers"
          >
            🔄
          </button>
        </div>
      </td>
    </tr>
  );
};

const ContainerList: React.FC = () => {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [projects, setProjects] = useState<ContainerProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerStats, setContainerStats] = useState<Map<string, ContainerStats>>(new Map());
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyRunning, setShowOnlyRunning] = useState(false);

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
            🔄 Retry
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
          <button onClick={loadContainers} className="refresh-button">
            🔄 Refresh
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
              <th>Name</th>
              <th>Container ID</th>
              <th>Image</th>
              <th>Port(s)</th>
              <th>CPU (%)</th>
              <th>Memory usage</th>
              <th>Memory (%)</th>
              <th>Disk reads</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
                      <tbody>
              {filteredProjects.length === 0 && individualContainers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-row">
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
                      />
                      {project.isExpanded && project.containers.map((container) => (
                        <ContainerRow
                          key={container.id}
                          container={container}
                          containerStats={containerStats.get(container.id)}
                          isSelected={selectedContainers.has(container.id)}
                          onToggleSelection={() => toggleContainerSelection(container.id)}
                          onUpdate={loadContainers}
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