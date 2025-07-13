import { useState } from "react";
import ContainerList from "./components/ContainerList";
import ImageList from "./components/ImageList";
import VolumeList from "./components/VolumeList";
import NetworkList from "./components/NetworkList";
import Terminal from "./components/Terminal";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<'containers' | 'images' | 'volumes' | 'networks' | 'terminal'>('containers');

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚢 Vessel - Docker Desktop Clone</h1>
        <nav className="app-nav">
          <button 
            className={`nav-button ${activeTab === 'containers' ? 'active' : ''}`}
            onClick={() => setActiveTab('containers')}
          >
            📦 Containers
          </button>
          <button 
            className={`nav-button ${activeTab === 'images' ? 'active' : ''}`}
            onClick={() => setActiveTab('images')}
          >
            💿 Images
          </button>
          <button 
            className={`nav-button ${activeTab === 'volumes' ? 'active' : ''}`}
            onClick={() => setActiveTab('volumes')}
          >
            💾 Volumes
          </button>
          <button 
            className={`nav-button ${activeTab === 'networks' ? 'active' : ''}`}
            onClick={() => setActiveTab('networks')}
          >
            🌐 Networks
          </button>
          <button 
            className={`nav-button ${activeTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminal')}
          >
            🖥️ Terminal
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'containers' && <ContainerList />}
        {activeTab === 'images' && <ImageList />}
        {activeTab === 'volumes' && <VolumeList />}
        {activeTab === 'networks' && <NetworkList />}
        {activeTab === 'terminal' && <Terminal />}
      </main>
    </div>
  );
}

export default App;
