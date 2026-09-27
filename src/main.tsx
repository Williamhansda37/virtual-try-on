import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Configure Emscripten Module printErr so TFLite C++ INFO logs don't trigger error alerts
if (typeof window !== 'undefined') {
  (window as any).Module = (window as any).Module || {};
  const isTFLiteLog = (msg: any): boolean => {
    return typeof msg === 'string' && (
      msg.includes('Created TensorFlow Lite XNNPACK delegate for CPU') ||
      msg.includes('XNNPACK delegate') ||
      (msg.startsWith('INFO:') && msg.includes('TensorFlow'))
    );
  };

  const origPrintErr = (window as any).Module.printErr;
  (window as any).Module.printErr = (text: string) => {
    if (isTFLiteLog(text)) return;
    if (origPrintErr) origPrintErr(text);
  };

  const origError = console.error;
  console.error = (...args: any[]) => {
    if (args.some(isTFLiteLog)) return;
    origError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

