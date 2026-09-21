import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { CommerceLab, CommerceLabControl } from './commerce/CommerceLab';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('ThirdSight root element was not found.');
}

const path=window.location.pathname.replace(/\/+$/,'')||'/';
const surface=path==='/commerce-lab/control'
  ? <CommerceLabControl />
  : path.startsWith('/commerce-lab')
    ? <CommerceLab />
    : <App />;

createRoot(rootElement).render(
  <StrictMode>
    {surface}
  </StrictMode>,
);
