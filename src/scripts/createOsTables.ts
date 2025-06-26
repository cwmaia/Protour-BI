import { getConnection } from '../config/database';
import logger from '../utils/logger';

const OS_TABLES_SQL = `
-- OS (Service Orders) table
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
    INDEX idx_sync_date (sync_date),
    INDEX idx_empresa_unidade (codigo_empresa, codigo_unidade)
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

-- BI aggregated vehicle expenses table
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
`;

async function createOsTables() {
  try {
    logger.info('Creating OS tables...');
    
    // Initialize database connection
    const pool = await getConnection();
    
    // Split and execute each CREATE TABLE statement
    const statements = OS_TABLES_SQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.execute(statement);
      }
    }
    
    // Add OS to sync_metadata if not exists
    await pool.execute(`
      INSERT IGNORE INTO sync_metadata (entity_name, sync_status, created_at, updated_at)
      VALUES ('os', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    logger.info('OS tables created successfully!');
    
    // Check tables
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('os', 'os_itens', 'bi_vehicle_expenses')
    `);
    
    logger.info('Created tables:', (tables as any[]).map(t => t.TABLE_NAME));
    
    process.exit(0);
  } catch (error) {
    logger.error('Error creating OS tables:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  createOsTables();
}