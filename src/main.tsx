import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import ThirdSightDesktop from './desktop/ThirdSightDesktop';
import { CommerceLab, CommerceLabControl } from './commerce/CommerceLab';
import ThirdSightLanding from './marketing/ThirdSightLanding';
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
    : path==='/app'||path.startsWith('/app/')
      ? <ThirdSightDesktop />
      : path==='/legacy'
        ? <App />
        : <ThirdSightLanding />;

createRoot(rootElement).render(
  <StrictMode>
    {surface}
  </StrictMode>,
);
