import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { versionChecker } from './utils/versionChecker.js'

// Initialiser la vérification de version au démarrage
versionChecker.init().then(() => {
  console.log('✅ Vérification de version initialisée');
}).catch(error => {
  console.error('❌ Erreur initialisation vérification de version:', error);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
