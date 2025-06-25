# Missing Tables Creation Script

This directory contains scripts to create the missing database tables required for the Locavia BI sync operations.

## Files

- `createMissingTables.sql` - SQL script containing CREATE TABLE statements for all missing tables
- `createMissingTables.ts` - TypeScript script to execute the SQL and create the tables

## Tables Created

The following tables will be created:

1. **condutores** - Drivers information
   - Primary key: codigo_condutor
   - Foreign key: codigo_cliente (references clientes)

2. **veiculos** - Vehicles information
   - Primary key: codigo_mva
   - Indexes on placa, empresa/unidade, grupo, marca

3. **contratos** - Contracts information
   - Primary key: codigo_contrato
   - Foreign keys: codigo_cliente, codigo_condutor, codigo_mva

4. **contrato_master** - Master contracts
   - Primary key: codigo_contrato_master
   - Foreign key: codigo_cliente

5. **reservas** - Reservations
   - Primary key: codigo_reserva
   - Foreign keys: codigo_cliente, codigo_mva, codigo_contrato_gerado

6. **formas_pagamento** - Payment methods
   - Primary key: codigo_forma_pagamento

7. **clientes** - Clients
   - Primary key: codigo_cliente
   - Foreign key: codigo_forma_pagamento

## Usage

To create the missing tables, run:

```bash
npm run db:create-tables
```

This will:
1. Connect to the database
2. Execute all CREATE TABLE statements
3. Set up foreign key constraints
4. Initialize sync metadata for each table
5. Verify the tables were created successfully

## Features

- All tables include proper indexes for performance
- Foreign key constraints maintain referential integrity
- Each table has sync_date, created_at, and updated_at timestamps
- The script is idempotent (safe to run multiple times)
- Continues execution even if some statements fail
- Provides detailed logging of the creation process

## After Creation

Once the tables are created, you can:
1. Run `npm run sync:status` to verify all tables are ready
2. Run `npm run sync:all` to sync data from the API
3. Run `npm run sync:entity <table_name>` to sync individual tables