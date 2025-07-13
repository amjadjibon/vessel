import { useState, useEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import ContainerList from "./components/ContainerList";
import ImageList from "./components/ImageList";
import VolumeList from "./components/VolumeList";
import NetworkList from "./components/NetworkList";
import Terminal from "./components/Terminal";
import { SystemStats, DockerSystemInfo } from './types/docker';
import "./App.css";

type ActivePage = 'ask_gordon' | 'containers' | 'images' | 'volumes' | 'builds' | 'models' | 'mcp_toolkit' | 'docker_hub' | 'docker_scout' | 'extensions' | 'networks' | 'terminal';

interface NavigationItem {
  key: ActivePage;
  icon: string;
  label: string;
  badge?: string;
  page?: string;
}

function App() {
  const [activePage, setActivePage] = useState<ActivePage>('containers');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [dockerInfo, setDockerInfo] = useState<DockerSystemInfo | null>(null);

  const navigationItems: NavigationItem[] = [
    { key: 'ask_gordon', icon: '✨', label: 'Ask Gordon', badge: 'BETA' },
    { key: 'containers', icon: '📦', label: 'Containers', page: 'containers' },
    { key: 'images', icon: '💿', label: 'Images', page: 'images' },
    { key: 'volumes', icon: '💾', label: 'Volumes', page: 'volumes' },
    { key: 'builds', icon: '🔨', label: 'Builds' },
    { key: 'models', icon: '📦', label: 'Models', badge: 'BETA' },
    { key: 'mcp_toolkit', icon: '🛠️', label: 'MCP Toolkit', badge: 'BETA' },
    { key: 'docker_hub', icon: '🌐', label: 'Docker Hub' },
    { key: 'docker_scout', icon: '🔍', label: 'Docker Scout' },
    { key: 'extensions', icon: '🧩', label: 'Extensions' },
    { key: 'networks', icon: '🌐', label: 'Networks' },
    { key: 'terminal', icon: '🖥️', label: 'Terminal' },
  ];

  useEffect(() => {
    const loadSystemStats = async () => {
      try {
        const stats = await invoke<SystemStats>('get_system_stats');
        setSystemStats(stats);
      } catch (error) {
        console.error('Failed to load system stats:', error);
      }
    };

    const loadDockerInfo = async () => {
      try {
        const info = await invoke<DockerSystemInfo>('get_docker_system_info');
        setDockerInfo(info);
      } catch (error) {
        console.error('Failed to load Docker info:', error);
      }
    };

    loadSystemStats();
    loadDockerInfo();

    // Refresh stats every 5 seconds
    const interval = setInterval(() => {
      loadSystemStats();
      loadDockerInfo();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleNavigation = (key: ActivePage) => {
    setActivePage(key);
  };

  const formatBytes = (bytes: number): string => {
    return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  };

  const renderMainContent = () => {
    switch (activePage) {
      case 'containers':
        return <ContainerList />;
      case 'images':
        return <ImageList />;
      case 'volumes':
        return <VolumeList />;
      case 'networks':
        return <NetworkList />;
      case 'terminal':
        return <Terminal />;
      default:
        return (
          <div className="placeholder-content">
            <h2>{navigationItems.find(item => item.key === activePage)?.label}</h2>
            <p>This feature is coming soon...</p>
          </div>
        );
    }
  };

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
          <div className="logo">
            <span className="logo-text">vessel</span>
            <span className="logo-badge">PERSONAL</span>
          </div>
        </div>
        <div className="header-center">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Search" className="search-input" />
            <span className="search-shortcut">⌘K</span>
          </div>
        </div>
        <div className="header-right">
          <button className="header-button" title="Notifications">🔔</button>
          <button className="header-button" title="Help">❓</button>
          <button className="header-button" title="Settings">⚙️</button>
          <button className="header-button" title="Apps">📱</button>
          <button className="sign-in-button">Sign in</button>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <nav className="sidebar-nav">
            {navigationItems.map((item) => (
              <button
                key={item.key}
                className={`nav-item ${activePage === item.key ? 'active' : ''}`}
                onClick={() => handleNavigation(item.key)}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                {!sidebarCollapsed && (
                  <>
                    <span className="nav-label">{item.label}</span>
                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                  </>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {renderMainContent()}
        </main>
      </div>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-left">
          <div className="status-indicator">
            <span className="status-dot running"></span>
            <span className="status-text">Engine running</span>
          </div>
        </div>
        <div className="footer-center">
          <span className="system-stat">
            RAM {systemStats ? `${systemStats.memory_used_gb.toFixed(2)} GB` : 'Loading...'}
          </span>
          <span className="system-stat">
            CPU {systemStats ? `${systemStats.cpu_usage.toFixed(2)}%` : 'Loading...'}
          </span>
          <span className="system-stat">
            Disk: {systemStats ? `${systemStats.disk_used_gb.toFixed(2)} GB used (${systemStats.disk_total_gb.toFixed(2)} GB total)` : 'Loading...'}
          </span>
        </div>
        <div className="footer-right">
          <button className="footer-button" onClick={() => setActivePage('terminal')}>
            🖥️ Terminal
          </button>
          <button className="footer-button">🔄 Update</button>
        </div>
      </footer>
    </div>
  );
}

export default App;
