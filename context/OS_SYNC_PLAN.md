# OS (Service Orders) Sync Implementation Plan

## Overview
OS (Ordem de Serviço) represents vehicle maintenance and expense records. Each OS is linked to a vehicle via the `placa` (license plate) field, making it possible to calculate total expenses per vehicle.

## API Endpoint Details
- **Endpoint**: `/os`
- **Method**: GET
- **Pagination**: Supports `pagina` and `linhas` parameters
- **Key Fields**:
  - `codigoOS`: Unique identifier
  - `placa`: Vehicle license plate (links to vehicles)
  - `dataAbertura`: Service order date
  - `codigoFornecedor`: Supplier code
  - `numeroDocumento`: Document number
  - `itens`: Array of expense items (only in detail endpoint)

## Implementation Plan

### Phase 1: Database Schema
Create two tables:
1. **os** - Main service orders table
2. **os_itens** - Service order items (normalized)
3. **bi_vehicle_expenses** - Aggregated view for BI

### Phase 2: Sync Service
1. Create `OsSyncService` extending `BaseSyncService`
2. Implement two-step sync:
   - Fetch all OS records from `/os`
   - For each OS, fetch details from `/os/{id}` to get items
3. Handle rate limiting with delays between detail fetches

### Phase 3: Data Correlation
1. Join OS data with vehicles using `placa` field
2. Calculate aggregated expenses per vehicle
3. Create materialized view or update bi_dados_veiculos

### Phase 4: BI Integration
Options:
1. **Option A**: Add expense columns to bi_dados_veiculos
2. **Option B**: Create separate bi_vehicle_expenses table
3. **Option C**: Both - detailed table + summary in bi_dados_veiculos

## Database Schema

```sql
-- Main OS table
CREATE TABLE IF NOT EXISTS os (
    codigo_os INT PRIMARY KEY,
    codigo_empresa INT NOT NULL,
    codigo_unidade INT NOT NULL,
    data_abertura DATE,
    placa VARCHAR(10),
    codigo_fornecedor INT,
    numero_documento VARCHAR(50),
    valor_total DECIMAL(15,2) DEFAULT 0,
    quantidade_itens INT DEFAULT 0,
    sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_placa (placa),
    INDEX idx_data_abertura (data_abertura),
    INDEX idx_codigo_fornecedor (codigo_fornecedor),
    INDEX idx_sync_date (sync_date)
) ENGINE=InnoDB;

-- OS items table
CREATE TABLE IF NOT EXISTS os_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_os INT NOT NULL,
    numero_item INT NOT NULL,
    valor_item DECIMAL(15,2),
    quantidade INT,
    valor_total_item DECIMAL(15,2) GENERATED ALWAYS AS (valor_item * quantidade) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_os_item (codigo_os, numero_item),
    FOREIGN KEY (codigo_os) REFERENCES os(codigo_os) ON DELETE CASCADE,
    INDEX idx_codigo_os (codigo_os)
) ENGINE=InnoDB;

-- BI aggregated expenses view
CREATE TABLE IF NOT EXISTS bi_vehicle_expenses (
    placa VARCHAR(10) PRIMARY KEY,
    codigo_mva INT,
    total_expenses DECIMAL(15,2),
    expense_count INT,
    first_expense_date DATE,
    last_expense_date DATE,
    avg_expense_value DECIMAL(15,2),
    max_expense_value DECIMAL(15,2),
    total_items INT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_codigo_mva (codigo_mva),
    INDEX idx_total_expenses (total_expenses),
    INDEX idx_last_updated (last_updated)
) ENGINE=InnoDB;
```

## Sync Strategy

### Step 1: Fetch OS List
```typescript
// Paginate through all OS records
for await (const batch of apiClient.paginate<OS>('/os', 200)) {
    // Process batch
}
```

### Step 2: Fetch OS Details
```typescript
// For each OS, fetch detailed items
for (const os of osList) {
    const details = await apiClient.get<OSDetail>(`/os/${os.codigoOS}`);
    // Insert items
}
```

### Step 3: Aggregate Expenses
```sql
-- Update bi_vehicle_expenses
INSERT INTO bi_vehicle_expenses (placa, codigo_mva, total_expenses, expense_count, ...)
SELECT 
    o.placa,
    v.codigo_mva,
    SUM(oi.valor_total_item) as total_expenses,
    COUNT(DISTINCT o.codigo_os) as expense_count,
    MIN(o.data_abertura) as first_expense_date,
    MAX(o.data_abertura) as last_expense_date,
    AVG(oi.valor_total_item) as avg_expense_value,
    MAX(oi.valor_total_item) as max_expense_value,
    COUNT(oi.id) as total_items
FROM os o
JOIN os_itens oi ON o.codigo_os = oi.codigo_os
LEFT JOIN veiculos v ON o.placa = v.placa
GROUP BY o.placa
ON DUPLICATE KEY UPDATE
    total_expenses = VALUES(total_expenses),
    expense_count = VALUES(expense_count),
    ...
```

## Type Definitions

```typescript
interface OS {
    codigoOS: number;
    codigoEmpresa: number;
    codigoUnidade: number;
    dataAbertura: string;
    placa: string;
    codigoFornecedor: number;
    numeroDocumento: string;
}

interface OSItem {
    numeroItem: number;
    valorItem: number;
    quantidade: number;
}

interface OSDetail extends OS {
    itens: OSItem[];
}
```

## Expected Benefits

1. **Complete Vehicle Cost Analysis**: Total cost of ownership per vehicle
2. **Expense Trends**: Track maintenance costs over time
3. **Supplier Analysis**: Identify top suppliers and costs
4. **ROI Calculations**: Compare revenue vs expenses per vehicle
5. **Predictive Maintenance**: Identify vehicles with high maintenance costs

## Performance Considerations

1. **Rate Limiting**: Add 500ms delay between detail fetches
2. **Batch Processing**: Process items in batches of 100
3. **Index Optimization**: Ensure proper indexes on join columns
4. **Incremental Sync**: Only fetch new/updated OS records

## Success Metrics

- All OS records synced successfully
- Zero data loss during sync
- Expense totals correctly calculated per vehicle
- Query performance < 1 second for expense reports
- 100% vehicle-expense correlation where placa matches

## Next Session Prompt

"Implement the OS (Service Orders) sync service to capture vehicle expenses. Create:
1. Database tables for os, os_itens, and bi_vehicle_expenses
2. OsSyncService that fetches OS data and items
3. Aggregation logic to calculate total expenses per vehicle
4. Update bi_dados_veiculos with expense summary columns if feasible
Focus on correlating expenses with vehicles using the placa field and providing BI-ready expense analytics."