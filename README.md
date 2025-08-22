# CashMate - Premium Finance Tracker App

<div align="center">
  <img src="https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg?auto=compress&cs=tinysrgb&w=400" alt="CashMate Logo" width="200" height="200" style="border-radius: 20px;">
  
  <h3>Your Intelligent Finance Companion</h3>
  <p>A premium, feature-rich personal finance management application built with React and TypeScript</p>
  
  [![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue.svg)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4.1-blue.svg)](https://tailwindcss.com/)
  [![Vite](https://img.shields.io/badge/Vite-5.4.2-purple.svg)](https://vitejs.dev/)
</div>

## ✨ Features

### 🔐 User Authentication & Profiles
- **Secure Login/Registration** - Email and password authentication
- **Social Login** - Google and Facebook integration
- **Multi-user Support** - Individual user profiles and data isolation
- **Profile Management** - User avatar and account settings

### 📊 Dashboard Overview
- **Real-time Balance** - Current financial position at a glance
- **Income vs Expenses** - Monthly comparison with trend analysis
- **Savings Rate** - Automatic calculation of savings percentage
- **Quick Actions** - Fast access to common tasks

### 💰 Income & Expense Tracking
- **Transaction Management** - Add, edit, and delete transactions
- **Category System** - Pre-defined and custom categories
- **Transaction History** - Comprehensive list with search and filters
- **Date Range Filtering** - View transactions by specific periods

### 🎯 Budget Management
- **Monthly Budget Setup** - Set spending limits by category
- **Smart Alerts** - Notifications when approaching budget limits
- **Budget Overview** - Visual progress tracking with color-coded status
- **Overspend Warnings** - Clear indicators when budgets are exceeded

### 📈 Reports & Analytics
- **Interactive Charts** - Pie charts and bar graphs using Chart.js
- **Spending Patterns** - Visual analysis of expense categories
- **Monthly Trends** - 6-month income vs expense comparison
- **Category Breakdown** - Detailed spending analysis

### 🔍 Advanced Features
- **Search & Filter** - Find transactions quickly with multiple filters
- **Export Data** - Download transaction data as PDF
- **Responsive Design** - Optimized for desktop, tablet, and mobile
- **Dark Mode Ready** - Premium UI with gradient themes

## 🚀 Getting Started

### Prerequisites
- Node.js (version 18 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/cashmate.git
   cd cashmate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` to view the application

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## 🛠️ Technology Stack

### Frontend
- **React 18.3.1** - Modern React with hooks and functional components
- **TypeScript 5.5.3** - Type-safe development
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **Vite 5.4.2** - Fast build tool and development server

### UI Components & Icons
- **Lucide React** - Beautiful, customizable icons
- **Headless UI** - Unstyled, accessible UI components
- **Hero Icons** - Additional icon set

### Charts & Visualization
- **Chart.js 4.5.0** - Flexible charting library
- **React Chart.js 2** - React wrapper for Chart.js

### Utilities
- **date-fns** - Modern date utility library
- **html2canvas** - Screenshot functionality
- **jsPDF** - PDF generation for exports

## 📱 User Interface

### Design Philosophy
- **Premium Aesthetics** - Apple-level design attention to detail
- **Glass Morphism** - Modern translucent design elements
- **Gradient Themes** - Beautiful color transitions
- **Micro-interactions** - Smooth animations and hover effects

### Color Palette
- **Primary Blue** - `#1e40af` to `#3b82f6`
- **Accent Teal** - `#0f766e` to `#14b8a6`
- **Success Green** - `#059669` to `#10b981`
- **Warning Red** - `#dc2626` to `#ef4444`
- **Neutral Grays** - `#374151` to `#f9fafb`

### Typography
- **Font Weights** - Light (300), Regular (400), Medium (500), Semibold (600), Bold (700)
- **Line Heights** - 120% for headings, 150% for body text
- **Spacing System** - 8px base unit for consistent spacing

## 🏗️ Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── auth/            # Authentication components
│   ├── dashboard/       # Dashboard-specific components
│   ├── layout/          # Layout components (Sidebar, Header)
│   └── transactions/    # Transaction management components
├── context/             # React Context providers
│   ├── AuthContext.tsx  # Authentication state management
│   └── AppContext.tsx   # Application state management
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
│   └── currency.ts      # LKR currency formatting
├── App.tsx              # Main application component
└── main.tsx            # Application entry point
```

## 💱 Currency Support

CashMate uses **Sri Lankan Rupees (LKR)** as the primary currency with proper formatting:
- **Standard Format**: LKR 25,000.00
- **Compact Format**: LKR 25K (for large amounts)
- **Localized Formatting**: Follows Sri Lankan number formatting conventions

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
VITE_APP_NAME=CashMate
VITE_API_URL=your_api_url_here
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_FACEBOOK_APP_ID=your_facebook_app_id
```

### Customization
- **Categories**: Modify default categories in `src/context/AppContext.tsx`
- **Colors**: Update color scheme in `tailwind.config.js`
- **Currency**: Change currency formatting in `src/utils/currency.ts`

## 📊 Features in Detail

### Dashboard Analytics
- **Balance Tracking** - Real-time calculation of current balance
- **Monthly Comparisons** - Previous month vs current month analysis
- **Savings Rate** - Automatic calculation based on income and expenses
- **Visual Indicators** - Color-coded cards for quick status understanding

### Transaction Management
- **Smart Categories** - Pre-defined categories with custom icons and colors
- **Bulk Operations** - Select and manage multiple transactions
- **Advanced Filtering** - Filter by date, amount, category, and type
- **Export Options** - PDF export with formatted transaction reports

### Budget System
- **Category Budgets** - Set individual limits for each expense category
- **Progress Tracking** - Visual progress bars with percentage indicators
- **Alert System** - Notifications at 70% and 90% of budget limits
- **Overspend Analysis** - Clear indicators when budgets are exceeded

## 🔒 Security Features

- **Input Validation** - All user inputs are validated and sanitized
- **Type Safety** - TypeScript ensures type safety throughout the application
- **Secure Authentication** - Password hashing and secure session management
- **Data Privacy** - User data is isolated and protected

## 🎨 UI/UX Features

### Responsive Design
- **Mobile First** - Optimized for mobile devices
- **Tablet Support** - Perfect layout for tablet screens
- **Desktop Experience** - Full-featured desktop interface

### Accessibility
- **Keyboard Navigation** - Full keyboard accessibility
- **Screen Reader Support** - ARIA labels and semantic HTML
- **Color Contrast** - WCAG compliant color combinations
- **Focus Management** - Clear focus indicators

## 🚀 Performance Optimizations

- **Code Splitting** - Lazy loading of components
- **Image Optimization** - Optimized images from Pexels
- **Bundle Optimization** - Tree shaking and minification
- **Caching Strategy** - Efficient caching of static assets

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📈 Future Enhancements

### Planned Features
- [ ] **Bank Integration** - Connect with Sri Lankan banks
- [ ] **Investment Tracking** - Stock and mutual fund tracking
- [ ] **Bill Reminders** - Automated bill payment reminders
- [ ] **Receipt Scanning** - OCR for receipt data extraction
- [ ] **Multi-currency Support** - Support for USD, EUR, etc.
- [ ] **Team Budgets** - Shared budgets for families
- [ ] **Advanced Analytics** - Predictive spending analysis
- [ ] **Mobile App** - React Native mobile application

### Technical Improvements
- [ ] **Offline Support** - PWA with offline capabilities
- [ ] **Real-time Sync** - WebSocket-based real-time updates
- [ ] **Advanced Security** - Two-factor authentication
- [ ] **API Integration** - RESTful API backend
- [ ] **Database Migration** - PostgreSQL or MongoDB integration

## 🤝 Contributing

We welcome contributions to CashMate! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow TypeScript best practices
- Use Tailwind CSS for styling
- Write comprehensive tests
- Follow the existing code structure
- Update documentation as needed
