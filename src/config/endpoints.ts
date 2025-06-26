// API Endpoint Configuration
// Maps entity names to their correct API endpoints

export const apiEndpoints = {
  // BI endpoints (these use camelCase naming and support pagination)
  dados_veiculos: '/dadosVeiculos',
  dados_clientes: '/dadosClientes',
  
  // Regular endpoints - based on API testing results
  clientes: '/clientes',
  condutores: '/condutores',
  contratomaster: '/contratomaster', // This endpoint exists and returns data
  veiculos: '/veiculos', // Exists but doesn't support pagination params
  reservas: '/reservas', // Exists but doesn't support pagination params
  
  // Corrected endpoints (singular form, no pagination support)
  contratos: '/contrato', // API uses singular form
  formas_pagamento: '/formaPagamento', // API uses singular camelCase form
  
  // OS endpoint (supports pagination)
  os: '/os', // Service orders endpoint with pagination support
} as const;

// Reverse mapping for easy lookup
export const endpointToEntity: Record<string, string> = Object.entries(apiEndpoints).reduce(
  (acc, [entity, endpoint]) => {
    acc[endpoint] = entity;
    return acc;
  },
  {} as Record<string, string>
);

// Helper function to get the correct endpoint for an entity
export function getEndpointForEntity(entityName: string): string {
  const endpoint = apiEndpoints[entityName as keyof typeof apiEndpoints];
  if (!endpoint) {
    throw new Error(`No endpoint configured for entity: ${entityName}`);
  }
  return endpoint;
}