import { createContext } from 'react';

// Estado del editor que los bloques del lienzo necesitan leer sin recibirlo por props:
// cuál es el inicio, cuál está activo en el simulador y cuántos problemas tiene cada bloque.
export const FlowContext = createContext({ startId: null, activeId: null, issues: {} });
