# Protour BI Dashboard Application - Project Specification

## Project Overview
Create a modern web-based Business Intelligence dashboard application that visualizes data from two primary sources:
1. **Locavia Database** (MySQL) - Vehicle rental and fleet management data
2. **SAP HANA Database** - Enterprise resource planning data (to be integrated)

The application should provide three main sections:
- Locavia-specific reports
- SAP HANA-specific reports  
- Combined reports (main feature) that merge insights from both data sources

## Technical Requirements

### Database Connections

#### Locavia Database (MySQL)
```javascript
// Connection configuration
const locaviaDB = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '', // Empty password as per current setup
  database: 'locavia_bi'
};
```

Available tables:
- `bi_vehicle_expenses` - Aggregated vehicle expense data (536 vehicles, R$ 1.36M total)
- `bi_dados_veiculos` - Vehicle BI data (3,800+ records)
- `bi_dados_clientes` - Client BI data (2,848+ records)
- `os` / `os_itens` - Service orders and expense details (15,000+ records, 3,539 with expense data)
- `veiculos` - Vehicle master data
- `clientes` - Client records
- `contratos` - Contracts
- `reservas` - Reservations
- `formas_pagamento` - Payment methods

**Data Availability & Recommended Date Range:**
- **Richest Data Period**: September 2022 - February 2023
- **Total Synced Expenses**: R$ 1,361,953.81
- **Coverage**: 536 vehicles with 6,019 expense items
- **Best Months for Analysis**:
  - October 2022: 592 service orders, 288 vehicles
  - February 2023: 983 service orders, 310 vehicles (highest coverage)
  - January 2023: 537 service orders, 248 vehicles

#### SAP HANA Database
- Connection details to be provided
- Will contain ERP data including financial, HR, and operational data

### Technology Stack
- **Frontend**: React.js or Vue.js with a modern UI framework (Material-UI, Ant Design, or Tailwind CSS)
- **Backend**: Node.js with Express.js
- **Database ORM**: Sequelize or TypeORM for database abstraction
- **Charts/Visualization**: Chart.js, Recharts, or Apache ECharts
- **Authentication**: JWT-based simple authentication
- **Deployment**: Docker containerization for easy deployment

## Design Requirements

### Visual Identity
Based on Protour Locação's Instagram presence (https://www.instagram.com/protourlocacao/):
- **Primary Colors**: 
  - Orange (#FF6B35 or similar vibrant orange)
  - Dark Blue/Navy (#1E3A8A)
  - White (#FFFFFF)
- **Secondary Colors**:
  - Light Gray (#F3F4F6) for backgrounds
  - Dark Gray (#374151) for text
- **Typography**: Clean, modern sans-serif (Inter, Roboto, or similar)
- **Style**: Professional yet approachable, with rounded corners and subtle shadows
- **Logo**: Include Protour logo in the header

### Landing Page
Include a hero section with:
```
Welcome to Protour BI Analytics

Your comprehensive fleet management intelligence platform that combines real-time data from Locavia's operational systems with SAP HANA's enterprise insights. Monitor vehicle performance, track expenses, analyze client behavior, and make data-driven decisions to optimize your fleet operations.

Key Features:
• Real-time vehicle expense tracking and analysis
• Client behavior and rental patterns insights
• Predictive maintenance scheduling
• Financial performance dashboards
• Cross-platform data integration
```

### Authentication
- Simple login page with email/username and password
- Session management with JWT tokens
- Role-based access (Admin, Manager, Viewer)

## Locavia Dashboard Components

### 1. Fleet Overview KPI Cards
Display key metrics in card format:
- **Active Fleet Size**: Total vehicles in operation
- **Monthly Revenue**: Current month's rental revenue
- **Utilization Rate**: Percentage of vehicles currently rented
- **Maintenance Alerts**: Vehicles requiring service

### 2. Vehicle Expense Analysis (Area Chart)
- X-axis: Months (Focus on Sep 2022 - Feb 2023 for richest data)
- Y-axis: Total expenses in R$
- Show trend line and monthly comparisons
- Data source: `bi_vehicle_expenses` and `os_itens`
- Note: Data coverage is most complete for Sep 2022 - Feb 2023 period

### 3. Expense Distribution by Category (Pie Chart)
- Break down expenses by type (maintenance, fuel, insurance, etc.)
- Interactive tooltips showing values and percentages
- Data source: `os_itens` grouped by expense categories

### 4. Top 10 High-Maintenance Vehicles (Horizontal Bar Chart)
- Vehicle plate numbers with total expense amounts
- Color-coded by expense severity
- Click to drill down into specific vehicle history
- Data source: `bi_vehicle_expenses`

### 5. Client Rental Patterns (Line Chart)
- Show rental frequency by client segments
- Multiple lines for different client types
- Data source: `bi_dados_clientes` and `reservas`

### 6. Payment Method Distribution (Donut Chart)
- Breakdown of payment methods used
- Show trends over time
- Data source: `formas_pagamento` and transaction data

### 7. Fleet Availability Calendar (Heat Map)
- Daily view of vehicle availability
- Color intensity showing utilization levels
- Data source: `contratos` and `reservas`

### 8. Service Order Timeline (Gantt Chart)
- Visual timeline of maintenance activities
- Shows planned vs actual service dates
- Data source: `os` table with date fields

## Combined Dashboard Ideas
- **Cost per Client Analysis**: Merge Locavia operational costs with SAP HANA financial data
- **ROI by Vehicle Model**: Combine purchase costs (SAP) with operational performance (Locavia)
- **Predictive Profitability**: Use both datasets to forecast vehicle profitability

## Development Guidelines

### API Structure
```javascript
// Example endpoint structure
GET /api/locavia/vehicles/expenses
GET /api/locavia/clients/analytics
GET /api/sap/financial/overview
GET /api/combined/vehicle-roi
```

### Error Handling
- Implement comprehensive error logging
- Graceful fallbacks for database connection issues
- User-friendly error messages

### Performance Considerations
- Implement data caching for frequently accessed metrics
- Use pagination for large datasets
- Consider real-time updates using WebSockets for critical KPIs

### Security
- Encrypt sensitive data in transit and at rest
- Implement rate limiting on API endpoints
- Regular security audits and dependency updates

## Deployment
- Containerize with Docker
- Use environment variables for configuration
- Implement CI/CD pipeline
- Consider cloud deployment (AWS, Azure, or Google Cloud)

## Future Enhancements
- Mobile responsive design
- Export functionality (PDF, Excel)
- Scheduled report generation
- AI-powered insights and anomaly detection
- Integration with additional data sources