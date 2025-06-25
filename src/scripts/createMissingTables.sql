-- Create missing tables for Locavia BI
-- This script creates the tables that are referenced in sync services but don't exist in the database

USE locavia_bi;

-- Condutores table (drivers)
CREATE TABLE IF NOT EXISTS condutores (
    codigo_condutor INT PRIMARY KEY,
    codigo_cliente INT NOT NULL,
    nome_condutor VARCHAR(255) NOT NULL,
    nome_mae VARCHAR(255),
    nome_pai VARCHAR(255),
    numero_registro VARCHAR(50),
    orgao_emissor_habilitacao VARCHAR(50),
    categoria_habilitacao VARCHAR(10),
    data_validade DATE,
    data_primeira_habilitacao DATE,
    numero_seguranca_cnh VARCHAR(50),
    numero_cnh VARCHAR(50),
    codigo_municipio_emissor INT,
    estado CHAR(2),
    codigo_pais INT,
    data_emissao DATE,
    cpf VARCHAR(14),
    celular VARCHAR(20),
    telefone VARCHAR(20),
    email VARCHAR(255),
    sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_codigo_cliente (codigo_cliente),
    INDEX idx_cpf (cpf),
    INDEX idx_numero_cnh (numero_cnh),
    INDEX idx_data_validade (data_validade),
    INDEX idx_sync_date (sync_date)
) ENGINE=InnoDB;

-- Veiculos table (vehicles)
CREATE TABLE IF NOT EXISTS veiculos (
    codigo_mva INT PRIMARY KEY,
    codigo_empresa INT NOT NULL,
    codigo_unidade INT NOT NULL,
    codigo_grupo INT,
    codigo_marca INT,
    modelo VARCHAR(255),
    ano_modelo INT,
    ano_fabricacao INT,
    codigo_combustivel INT,
    cor VARCHAR(50),
    numero_chassi VARCHAR(50),
    placa VARCHAR(10) NOT NULL,
    renavam VARCHAR(50),
    numero_motor VARCHAR(50),
    codigo_categoria INT,
    capacidade_tanque DECIMAL(10,2),
    hodometro INT,
    horimetro INT,
    ativo TINYINT(1) DEFAULT 1,
    codigo_modelo_fipe VARCHAR(50),
    nome_modelo_fipe VARCHAR(255),
    numero_eixos INT,
    capacidade_carga DECIMAL(10,2),
    capacidade_passageiros INT,
    potencia_motor DECIMAL(10,2),
    cilindrada_motor INT,
    data_compra DATE,
    valor_compra DECIMAL(15,2),
    numero_nota_fiscal VARCHAR(50),
    data_venda DATE,
    valor_venda DECIMAL(15,2),
    motivo_venda TEXT,
    sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_placa (placa),
    INDEX idx_empresa_unidade (codigo_empresa, codigo_unidade),
    INDEX idx_codigo_grupo (codigo_grupo),
    INDEX idx_codigo_marca (codigo_marca),
    INDEX idx_ativo (ativo),
    INDEX idx_data_compra (data_compra),
    INDEX idx_data_venda (data_venda),
    INDEX idx_sync_date (sync_date)
) ENGINE=InnoDB;

-- Contratos table (contracts)
CREATE TABLE IF NOT EXISTS contratos (
    codigo_contrato INT PRIMARY KEY,
    codigo_empresa INT NOT NULL,
    codigo_unidade INT NOT NULL,
    codigo_grupo_contratos INT,
    codigo_mva INT,
    tipo_tarifa VARCHAR(50),
    periodo_tarifa INT,
    valor_km_rodado DECIMAL(10,2),
    franquia_km_rodado INT,
    valor_locacao DECIMAL(15,2),
    data_hora_inicio_real DATETIME,
    data_hora_termino_real DATETIME,
    data_fecham_contrato DATETIME,
    usuario_abertura_contrato INT,
    codigo_condutor INT,
    inserido_por INT,
    codigo_cliente INT,
    razao_social VARCHAR(255),
    email VARCHAR(255),
    celular VARCHAR(20),
    codigo_contrato_original INT,
    codigo_contrato_prox INT,
    fechado TINYINT(1) DEFAULT 0,
    fechamento_nao_realizado_faturamento_master TINYINT(1) DEFAULT 0,
    sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_empresa_unidade (codigo_empresa, codigo_unidade),
    INDEX idx_codigo_grupo_contratos (codigo_grupo_contratos),
    INDEX idx_codigo_mva (codigo_mva),
    INDEX idx_codigo_cliente (codigo_cliente),
    INDEX idx_codigo_condutor (codigo_condutor),
    INDEX idx_data_inicio (data_hora_inicio_real),
    INDEX idx_data_termino (data_hora_termino_real),
    INDEX idx_fechado (fechado),
    INDEX idx_sync_date (sync_date)
) ENGINE=InnoDB;

-- ContratoMaster table (master contracts)
CREATE TABLE IF NOT EXISTS contrato_master (
    codigo_contrato_master INT PRIMARY KEY,
    codigo_empresa INT NOT NULL,
    codigo_unidade INT NOT NULL,
    codigo_cliente INT,
    razao_social VARCHAR(255),
    email VARCHAR(255),
    telefone VARCHAR(20),
    data_hora_inicio DATETIME,
    data_hora_termino DATETIME,
    tipo_contrato VARCHAR(50),
    valor_total DECIMAL(15,2),
    status_contrato VARCHAR(50),
    observacoes TEXT,
    criado_por INT,
    data_criacao DATETIME,
    atualizado_por INT,
    data_atualizacao DATETIME,
    sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_empresa_unidade (codigo_empresa, codigo_unidade),
    INDEX idx_codigo_cliente (codigo_cliente),
    INDEX idx_data_inicio (data_hora_inicio),
    INDEX idx_data_termino (data_hora_termino),
    INDEX idx_status_contrato (status_contrato),
    INDEX idx_tipo_contrato (tipo_contrato),
    INDEX idx_sync_date (sync_date)
) ENGINE=InnoDB;

-- Reservas table (reservations)
CREATE TABLE IF NOT EXISTS reservas (
    codigo_reserva INT PRIMARY KEY,
    codigo_empresa INT NOT NULL,
    codigo_unidade INT NOT NULL,
    codigo_cliente INT,
    razao_social VARCHAR(255),
    codigo_grupo INT,
    codigo_mva INT,
    data_hora_inicio_prevista DATETIME,
    data_hora_termino_prevista DATETIME,
    valor_previsto DECIMAL(15,2),
    status_reserva VARCHAR(50),
    observacoes TEXT,
    criado_por INT,
    data_criacao DATETIME,
    codigo_contrato_gerado INT,
    sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_empresa_unidade (codigo_empresa, codigo_unidade),
    INDEX idx_codigo_cliente (codigo_cliente),
    INDEX idx_codigo_grupo (codigo_grupo),
    INDEX idx_codigo_mva (codigo_mva),
    INDEX idx_data_inicio (data_hora_inicio_prevista),
    INDEX idx_data_termino (data_hora_termino_prevista),
    INDEX idx_status_reserva (status_reserva),
    INDEX idx_codigo_contrato_gerado (codigo_contrato_gerado),
    INDEX idx_sync_date (sync_date)
) ENGINE=InnoDB;

-- Formas_pagamento table (payment methods)
CREATE TABLE IF NOT EXISTS formas_pagamento (
    codigo_forma_pagamento INT PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    tipo_pagamento VARCHAR(50),
    ativo TINYINT(1) DEFAULT 1,
    prazo_dias INT,
    taxa_juros DECIMAL(5,2),
    desconto_percentual DECIMAL(5,2),
    sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tipo_pagamento (tipo_pagamento),
    INDEX idx_ativo (ativo),
    INDEX idx_sync_date (sync_date)
) ENGINE=InnoDB;

-- Clientes table (clients)
CREATE TABLE IF NOT EXISTS clientes (
    codigo_cliente INT PRIMARY KEY,
    codigo_empresa INT NOT NULL,
    codigo_unidade INT NOT NULL,
    codigo_forma_pagamento INT,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(18),
    cpf VARCHAR(14),
    ie VARCHAR(20),
    rg VARCHAR(20),
    orgao_emissor VARCHAR(20),
    complemento_identidade VARCHAR(50),
    sexo CHAR(1),
    email VARCHAR(255),
    celular VARCHAR(20),
    telefone VARCHAR(20),
    data_nascimento DATE,
    nome_pai VARCHAR(255),
    nome_mae VARCHAR(255),
    tipo_pessoa CHAR(1),
    area_atuacao VARCHAR(255),
    numero_funcionarios INT,
    porte_empresa VARCHAR(50),
    faturamento_anual DECIMAL(15,2),
    website VARCHAR(255),
    observacoes TEXT,
    sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_empresa_unidade (codigo_empresa, codigo_unidade),
    INDEX idx_codigo_forma_pagamento (codigo_forma_pagamento),
    INDEX idx_cnpj (cnpj),
    INDEX idx_cpf (cpf),
    INDEX idx_tipo_pessoa (tipo_pessoa),
    INDEX idx_razao_social (razao_social),
    INDEX idx_sync_date (sync_date)
) ENGINE=InnoDB;

-- Foreign key constraints will be added after all tables are created
-- Note: These constraints are commented out to avoid errors during initial creation
-- They can be added manually later if needed

-- ALTER TABLE condutores
--     ADD CONSTRAINT fk_condutores_cliente FOREIGN KEY (codigo_cliente) REFERENCES clientes(codigo_cliente) ON DELETE CASCADE;

-- ALTER TABLE contratos
--     ADD CONSTRAINT fk_contratos_cliente FOREIGN KEY (codigo_cliente) REFERENCES clientes(codigo_cliente) ON DELETE CASCADE,
--     ADD CONSTRAINT fk_contratos_condutor FOREIGN KEY (codigo_condutor) REFERENCES condutores(codigo_condutor) ON DELETE SET NULL,
--     ADD CONSTRAINT fk_contratos_veiculo FOREIGN KEY (codigo_mva) REFERENCES veiculos(codigo_mva) ON DELETE SET NULL;

-- ALTER TABLE contrato_master
--     ADD CONSTRAINT fk_contrato_master_cliente FOREIGN KEY (codigo_cliente) REFERENCES clientes(codigo_cliente) ON DELETE CASCADE;

-- ALTER TABLE reservas
--     ADD CONSTRAINT fk_reservas_cliente FOREIGN KEY (codigo_cliente) REFERENCES clientes(codigo_cliente) ON DELETE CASCADE,
--     ADD CONSTRAINT fk_reservas_veiculo FOREIGN KEY (codigo_mva) REFERENCES veiculos(codigo_mva) ON DELETE SET NULL,
--     ADD CONSTRAINT fk_reservas_contrato FOREIGN KEY (codigo_contrato_gerado) REFERENCES contratos(codigo_contrato) ON DELETE SET NULL;

-- ALTER TABLE clientes
--     ADD CONSTRAINT fk_clientes_forma_pagamento FOREIGN KEY (codigo_forma_pagamento) REFERENCES formas_pagamento(codigo_forma_pagamento) ON DELETE SET NULL;

-- Insert initial sync metadata for new tables
INSERT INTO sync_metadata (entity_name, sync_status) VALUES
    ('condutores', 'pending'),
    ('veiculos', 'pending'),
    ('contratos', 'pending'),
    ('contratomaster', 'pending'),
    ('reservas', 'pending'),
    ('formas_pagamento', 'pending'),
    ('clientes', 'pending')
ON DUPLICATE KEY UPDATE sync_status = 'pending';