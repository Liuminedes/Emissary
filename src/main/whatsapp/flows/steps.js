// src/main/whatsapp/flows/steps.js

export const STEPS = {
  WELCOME:            'WELCOME',
  MENU:               'MENU',

  CATALOG_CATEGORY:   'CATALOG_CATEGORY',
  CATALOG_LIST:       'CATALOG_LIST',
  ITEM_DETAIL:        'ITEM_DETAIL',

  CAPTURE_INTEREST:   'CAPTURE_INTEREST',
  CAPTURE_BUDGET:     'CAPTURE_BUDGET',
  CAPTURE_EMPLOYMENT: 'CAPTURE_EMPLOYMENT',
  CAPTURE_INCOME:     'CAPTURE_INCOME',
  ASK_LEAD_NAME:      'ASK_LEAD_NAME',
  ASK_LEAD_PHONE:     'ASK_LEAD_PHONE',

  DONE:               'DONE',
};

export const RESET_KEYWORDS   = ['menu', 'menú', 'inicio', 'reiniciar'];
export const HANDOFF_KEYWORDS = ['asesor', 'hablar', 'agente', 'persona', 'humano'];

export const BUDGETS = [
  'Económico',
  'Rango medio',
  'Rango alto',
  'Premium',
  'Prefiero que me asesoren',
];

export const EMPLOYMENTS = ['Empleado', 'Independiente', 'Pensionado', 'Otro'];
