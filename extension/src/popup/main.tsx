import React from 'react';
import ReactDOM from 'react-dom/client';
import { Popup } from './Popup';
import './popup.css';

const rootEl = document.getElementById('popup-root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
}
