import { useState } from "react";
import ContainerList from "./components/ContainerList";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<'containers' | 'images' | 'volumes'>('containers');

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
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'containers' && <ContainerList />}
        {activeTab === 'images' && (
          <div className="placeholder">
            <h2>Images</h2>
            <p>Image management coming soon...</p>
          </div>
        )}
        {activeTab === 'volumes' && (
          <div className="placeholder">
            <h2>Volumes</h2>
            <p>Volume management coming soon...</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
