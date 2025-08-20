# Windows Setup Guide for Locavia Sync Service

This guide provides detailed instructions for setting up the Locavia Sync Service on Windows for Power BI integration.

## Prerequisites Installation

### 1. Install MySQL Server

1. Download MySQL Installer from: https://dev.mysql.com/downloads/installer/
2. Choose "mysql-installer-web-community" (smaller download)
3. During installation:
   - Select "Developer Default" or "Server only"
   - Set root password (remember this!)
   - Configure MySQL Server as Windows Service
   - Port: 3306 (default)
   - Enable "Start MySQL Server at System Startup"

4. Verify installation:
```cmd
mysql --version
```

### 2. Install Node.js

1. Download from: https://nodejs.org/ (LTS version recommended)
2. Run the installer with default settings
3. Verify installation:
```cmd
node --version
npm --version
```

### 3. Install Git

1. Download from: https://git-scm.com/download/win
2. During installation:
   - Select "Git from the command line and also from 3rd-party software"
   - Choose "Use Windows' default console window"
3. Verify installation:
```cmd
git --version
```

### 4. Install Power BI Desktop

1. Download from Microsoft Store: https://aka.ms/pbidesktopstore
2. Or direct download: https://powerbi.microsoft.com/desktop/

## Project Setup

### 1. Open Windows Terminal or PowerShell

```powershell
# If needed, allow script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. Clone the Repository

```powershell
# Navigate to your projects folder
cd C:\Projects

# Clone the repository
git clone https://github.com/yourusername/locavia-sync-service.git
cd locavia-sync-service
```

### 3. Install Dependencies

```powershell
npm install
```

### 4. Configure Database

```powershell
# Connect to MySQL
mysql -u root -p

# Create database and user
CREATE DATABASE locavia_bi;
CREATE USER 'bi_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON locavia_bi.* TO 'bi_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 5. Configure Environment

```powershell
# Copy example environment file
copy .env.example .env

# Edit .env file with notepad or your preferred editor
notepad .env
```

Update the `.env` file with your settings:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=bi_user
DB_PASSWORD=your_secure_password
DB_NAME=locavia_bi

API_BASE_URL=https://apilocavia.infosistemas.com.br:3049
API_CNPJ=12801601000182
API_USERNAME=BI
API_PASSWORD=BI2025
```

### 6. Initialize Database

```powershell
# Create database tables
npm run db:setup
npm run db:create-tables
npm run db:create-os-tables
```

## Running the Service

### Initial Data Sync

```powershell
# Sync current year data (recommended for first run)
npm run sync:year

# Or sync specific year
npm run sync:year -- --year=2024
```

### Regular Operations

```powershell
# Start API server
npm run api:start

# Run incremental sync
npm run sync:os-incremental

# Check sync status
npm run sync:status
```

## Power BI Connection

### 1. Open Power BI Desktop

### 2. Connect to MySQL

1. Click **Get Data** → **More...**
2. Search for "MySQL" and select **MySQL database**
3. Click **Connect**

### 3. Enter Connection Details

- **Server**: `localhost:3306`
- **Database**: `locavia_bi`
- Click **OK**

### 4. Authentication

- Select **Database** authentication
- **User name**: `bi_user` (or your MySQL user)
- **Password**: Your MySQL password
- Click **Connect**

### 5. Select Tables

Choose tables for your report:
- `bi_vehicle_expenses` - Vehicle expense analysis
- `os` - Service orders
- `os_itens` - Service order details
- `bi_dados_veiculos` - Vehicle metrics
- `bi_dados_clientes` - Client metrics

### 6. Create Relationships

In Power BI Model view, create relationships:
- `os.codigo_os` → `os_itens.codigo_os`
- `os.placa` → `bi_dados_veiculos.placa`
- Other relationships as needed

## Scheduled Syncs (Optional)

### Using Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily, weekly, etc.)
4. Action: Start a program
5. Program: `node.exe`
6. Arguments: `C:\Projects\locavia-sync-service\dist\scripts\syncByYear.js`
7. Start in: `C:\Projects\locavia-sync-service`

### Using Node Process Manager (PM2)

```powershell
# Install PM2 globally
npm install -g pm2

# Start the sync service
pm2 start dist/index.js --name locavia-sync

# Save PM2 configuration
pm2 save

# Setup PM2 to start on Windows startup
pm2 startup
```

## Troubleshooting

### MySQL Connection Issues

```powershell
# Check if MySQL is running
Get-Service -Name MySQL*

# Start MySQL if stopped
Start-Service -Name MySQL80

# Test connection
mysql -u bi_user -p locavia_bi
```

### Node.js Memory Issues

For large data syncs, increase memory:
```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run sync:all
```

### Port Conflicts

If port 3306 is in use:
```powershell
# Check what's using the port
netstat -ano | findstr :3306

# Change port in .env file
DB_PORT=3307
```

### Permission Issues

Run PowerShell as Administrator if you encounter permission errors.

## Performance Tips

### 1. Optimize MySQL for Windows

Edit `my.ini` (usually in `C:\ProgramData\MySQL\MySQL Server 8.0\`):
```ini
[mysqld]
innodb_buffer_pool_size=1G
innodb_log_file_size=256M
innodb_flush_method=unbuffered
max_connections=200
```

### 2. Windows Defender Exclusions

Add exclusions for better performance:
1. Open Windows Security
2. Virus & threat protection → Manage settings
3. Add exclusions for:
   - `C:\Projects\locavia-sync-service`
   - `node.exe`
   - MySQL data directory

### 3. Use SSD for Database

Store MySQL data on SSD for better performance.

## Backup and Restore

### Backup Database

```powershell
# Backup to file
mysqldump -u bi_user -p locavia_bi > backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.sql
```

### Restore Database

```powershell
# Restore from backup
mysql -u bi_user -p locavia_bi < backup_20240114.sql
```

## Security Considerations

1. **Windows Firewall**: Keep MySQL port (3306) blocked from external access
2. **User Permissions**: Use dedicated MySQL user, not root
3. **Password Security**: Use strong passwords and store securely
4. **Backup Strategy**: Regular automated backups
5. **Updates**: Keep Node.js, MySQL, and dependencies updated

## Support

For issues specific to Windows setup, check:
- Windows Event Viewer for system errors
- `logs/error.log` for application errors
- MySQL error log in `C:\ProgramData\MySQL\MySQL Server 8.0\Data\`

For general support, open an issue on GitHub.