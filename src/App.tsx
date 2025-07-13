import React, { useState, useEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import ContainerList from "./components/ContainerList";
import ImageList from "./components/ImageList";
import VolumeList from "./components/VolumeList";
import NetworkList from "./components/NetworkList";
import Terminal from "./components/Terminal";
import { SystemStats } from './types/docker';
import { 
  Container, 
  HardDrive, 
  Database, 
  Network, 
  Terminal as TerminalIcon,
  Menu,
  X,
  Search,
  Bell,
  HelpCircle,
  Settings,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import "./App.css";

type ActivePage = 'containers' | 'images' | 'volumes' | 'networks' | 'terminal';

interface NavigationItem {
  key: ActivePage;
  icon: React.ComponentType<any>;
  label: string;
  badge?: string;
  page?: string;
}

function App() {
  const [activePage, setActivePage] = useState<ActivePage>('containers');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);


  const navigationItems: NavigationItem[] = [
    { key: 'containers', icon: Container, label: 'Containers', page: 'containers' },
    { key: 'images', icon: HardDrive, label: 'Images', page: 'images' },
    { key: 'volumes', icon: Database, label: 'Volumes', page: 'volumes' },
    { key: 'networks', icon: Network, label: 'Networks' },
    { key: 'terminal', icon: TerminalIcon, label: 'Terminal' },
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

    loadSystemStats();

    // Refresh stats every 5 seconds
    const interval = setInterval(() => {
      loadSystemStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleNavigation = (key: ActivePage) => {
    setActivePage(key);
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
            {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
          <div className="logo">
            <span className="logo-text">vessel</span>
            <span className="logo-badge">PERSONAL</span>
          </div>
        </div>
        <div className="header-center">
          <div className="search-box">
            <span className="search-icon"><Search size={16} /></span>
            <input type="text" placeholder="Search" className="search-input" />
            <span className="search-shortcut">⌘K</span>
          </div>
        </div>
        <div className="header-right">
          <button className="header-button" title="Notifications"><Bell size={16} /></button>
          <button className="header-button" title="Help"><HelpCircle size={16} /></button>
          <button className="header-button" title="Settings"><Settings size={16} /></button>
          <button className="header-button" title="Apps"><Smartphone size={16} /></button>
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
                <span className="nav-icon">{React.createElement(item.icon, { size: 20 })}</span>
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
            <TerminalIcon size={16} /> Terminal
          </button>
          <button className="footer-button"><RefreshCw size={16} /> Update</button>
        </div>
      </footer>
    </div>
  );
}

export default App;
