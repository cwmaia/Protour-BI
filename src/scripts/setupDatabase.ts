import mysql from 'mysql2/promise';
import logger from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase(): Promise<void> {
  logger.info('Starting database setup...');
  
  let connection: mysql.Connection | null = null;
  
  try {
    // Create a connection without specifying the database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });
    
    logger.info('Connected to MySQL server');
    
    // Create database
    await connection.query('CREATE DATABASE IF NOT EXISTS locavia_bi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    logger.info('Database created or already exists');
    
    // Use database
    await connection.query('USE locavia_bi');
    logger.info('Switched to locavia_bi database');
    
    // Create tables directly with SQL
    const createTableQueries = [
      // Sync metadata table
      `CREATE TABLE IF NOT EXISTS sync_metadata (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_name VARCHAR(100) NOT NULL,
        last_sync_at TIMESTAMP NULL,
        sync_status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
        records_synced INT DEFAULT 0,
        error_message TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_entity_status (entity_name, sync_status),
        INDEX idx_last_sync (last_sync_at)
      ) ENGINE=InnoDB`,
      
      // Sync audit log table
      `CREATE TABLE IF NOT EXISTS sync_audit_log (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        entity_name VARCHAR(100) NOT NULL,
        operation VARCHAR(50) NOT NULL,
        record_count INT DEFAULT 0,
        status VARCHAR(50) NOT NULL,
        error_message TEXT NULL,
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP NULL,
        duration_seconds INT GENERATED ALWAYS AS (TIMESTAMPDIFF(SECOND, started_at, completed_at)) STORED,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_entity_operation (entity_name, operation),
        INDEX idx_status (status),
        INDEX idx_started_at (started_at)
      ) ENGINE=InnoDB`,
      
      // BI Vehicle data
      `CREATE TABLE IF NOT EXISTS bi_dados_veiculos (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        placa VARCHAR(10) NOT NULL,
        codigo_mva INT,
        chassi VARCHAR(50),
        renavam VARCHAR(50),
        codigo_empresa INT,
        codigo_unidade INT,
        descricao_unidade VARCHAR(255),
        codigo_marca INT,
        marca_veiculo VARCHAR(100),
        modelo VARCHAR(255),
        ano_modelo INT,
        letra VARCHAR(10),
        descricao_grupo VARCHAR(100),
        valor_compra DECIMAL(15,2),
        status VARCHAR(50),
        data_compra DATE,
        nf_compra VARCHAR(50),
        valor_entrada DECIMAL(15,2),
        data_venda DATE,
        valor_venda DECIMAL(15,2),
        dias_em_posse INT,
        codigo_fipe VARCHAR(50),
        valor_fipe DECIMAL(15,2),
        numero_contrato_alienacao VARCHAR(100),
        inicio_financiamento DATE,
        valor_compra_veiculo DECIMAL(15,2),
        valor_total_compra_veiculo DECIMAL(15,2),
        valor_alienado DECIMAL(15,2),
        valor_media_parcela_alienacao DECIMAL(15,2),
        valor_total_alienacao_quitado DECIMAL(15,2),
        valor_total_alienacao_aberto DECIMAL(15,2),
        numero_parcelas_total INT,
        quantidade_parcelas_quitadas INT,
        quantidade_parcelas_abertas INT,
        valor_media_parcela_do_veiculo DECIMAL(15,2),
        financiado_por VARCHAR(255),
        primeiro_vencimento DATE,
        ultimo_vencimento DATE,
        situacao_contrato_alienacao VARCHAR(50),
        razao_social VARCHAR(255),
        nome_fantasia VARCHAR(255),
        veiculo_substituido VARCHAR(10),
        contrato_master INT,
        data_inicio_contrato DATE,
        data_termino_contrato DATE,
        periodo_locacao_master VARCHAR(50),
        ultimo_contrato VARCHAR(50),
        periodo_locacao_veiculo VARCHAR(50),
        total_recebido DECIMAL(15,2),
        parcelas_recebidas INT,
        total_a_receber DECIMAL(15,2),
        parcelas_a_receber INT,
        valor_tarifa_locacao_atual DECIMAL(15,2),
        sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_placa_sync (placa, sync_date),
        INDEX idx_empresa_unidade (codigo_empresa, codigo_unidade),
        INDEX idx_status (status),
        INDEX idx_contrato_master (contrato_master),
        INDEX idx_sync_date (sync_date)
      ) ENGINE=InnoDB`,
      
      // BI Client data
      `CREATE TABLE IF NOT EXISTS bi_dados_clientes (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        razao_social VARCHAR(255) NOT NULL,
        descricao_unidade VARCHAR(255),
        numero_documento VARCHAR(100),
        data_emissao DATE,
        descricao_tipo_documento VARCHAR(100),
        valor_bruto DECIMAL(15,2),
        valor_documento DECIMAL(15,2),
        data_vencimento DATE,
        nome_fantasia VARCHAR(255),
        area_atuacao VARCHAR(255),
        previsao VARCHAR(50),
        valor_centro_receita DECIMAL(15,2),
        descricao_centro_receita VARCHAR(255),
        codigo_forma_pagamento INT,
        sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_razao_social (razao_social),
        INDEX idx_documento (numero_documento),
        INDEX idx_data_emissao (data_emissao),
        INDEX idx_data_vencimento (data_vencimento),
        INDEX idx_sync_date (sync_date)
      ) ENGINE=InnoDB`
    ];
    
    // Execute all create table queries
    for (const query of createTableQueries) {
      await connection.query(query);
      const tableMatch = query.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (tableMatch) {
        logger.info(`Created/verified table: ${tableMatch[1]}`);
      }
    }
    
    logger.info('All tables created successfully');
    
    // Initialize sync metadata
    const entities = [
      'clientes',
      'veiculos',
      'condutores',
      'contratos',
      'contratomaster',
      'reservas',
      'formas_pagamento',
      'dados_veiculos',
      'dados_clientes'
    ];
    
    for (const entity of entities) {
      await connection.query(
        `INSERT INTO sync_metadata (entity_name, sync_status) 
         VALUES (?, 'pending') 
         ON DUPLICATE KEY UPDATE entity_name = entity_name`,
        [entity]
      );
    }
    
    logger.info('Sync metadata initialized for all entities');
    logger.info('Database setup completed successfully');
    
  } catch (error) {
    logger.error('Database setup failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      logger.info('Setup completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Setup failed:', error);
      process.exit(1);
    });
}

export default setupDatabase;