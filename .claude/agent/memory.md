# Sage's Private Notes

## Project Understanding
- Data sync service from Locavia API to MySQL for BI purposes
- API Base: https://apilocavia.infosistemas.com.br:3049
- Auth: POST to /v1/auth/access-token with CNPJ, username, password
- Credentials stored: cnpj: 12801601000182, username: BI, password: BI2025
- Auth successful - tokens expire in ~24 hours (86400 seconds)

## API Endpoints Discovered
Key entities for BI:
- /cartao - Card data
- /condutores - Drivers data (GET list, GET by id, POST, PATCH)
- /clientes - Clients data (full CRUD, areas, categories, attachments)
- /formaPagamento - Payment methods
- /fornecedores - Suppliers data
- /produtos - Products data
- /veiculos - Vehicles data (brands, groups, models, rates)
- /reservas - Reservations data
- /contrato - Contracts data
- /contratomaster - Master contracts
- /os - Service orders
- /vendaveiculo - Vehicle sales
- /recebimento - Receivables
- /atendimento - Service attendance
- /dadosVeiculos - Vehicle BI data (specific endpoint for BI!)
- /dadosClientes - Client BI data (specific endpoint for BI!)
- /tarifas - Rates/Tariffs

## Technical Decisions Log
- Database: MySQL chosen for BI compatibility
- Architecture: Job-based sync system for scalability
- TypeScript for type safety with API responses
- JWT token obtained, need refresh every 24h
- Found dedicated BI endpoints - prioritize these
- Pagination supported on most endpoints (pagina, linhas params)

## Concerns to Address
- API rate limiting not documented - implement exponential backoff
- Pagination params: pagina (page), linhas (rows)
- Token refresh strategy - refresh before 20h mark
- Handle partial sync failures gracefully
- Priority sync: dadosVeiculos and dadosClientes for BI