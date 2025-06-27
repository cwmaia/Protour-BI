import { getConnection } from '../config/database';

async function addOsItensColumn() {
  const pool = await getConnection();
  try {
    const [columns] = await pool.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'os_itens'"
    );
    console.log('os_itens columns:', (columns as any[]).map(c => c.COLUMN_NAME));
    
    // Check if valor_total_item exists
    const hasValorTotalItem = (columns as any[]).some(c => c.COLUMN_NAME === 'valor_total_item');
    if (!hasValorTotalItem) {
      console.log('Adding valor_total_item column...');
      await pool.execute('ALTER TABLE os_itens ADD COLUMN valor_total_item DECIMAL(10,2) DEFAULT 0');
      
      // Update existing records
      await pool.execute(`
        UPDATE os_itens 
        SET valor_total_item = valor_item * quantidade 
        WHERE valor_total_item = 0
      `);
      
      console.log('Column added and data updated successfully');
    } else {
      console.log('valor_total_item column already exists');
    }
  } finally {
    await pool.end();
  }
}

addOsItensColumn().catch(console.error);