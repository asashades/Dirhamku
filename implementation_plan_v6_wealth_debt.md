# Implementation Plan v6: Net Worth, Assets & Debt Management 

This implementation plan outlines the architectural updates, UI components, and business logic required to add the Wealth features (Net Worth tracking, Assets, and Debt management) to Dirhamku.

## 1. Database & Architecure Updates (Firestore)
- **New Collections**: 
  - `users/{uid}/assets`
  - `users/{uid}/debts`
- **Debt Object Scheme**:
  - `id`, `name`, `amountBorrowed`, `amountPaid`, `dueDate`, `icon`, `status` (BORROWED / LENT / PAID), `records` (subcollection or array of transaction IDs).
- **Transaction Handling**:
  - Add logic in `app.js` when saving a transaction to handle `type: 'debt_payment'`. 
  - A Debt Payment will deduct from the selected originating `accountId` (wallet) but will **NOT** be tallied as `expense` (spending) on the dashboard charts. It acts like a transfer where the destination is a Debt entity.

## 2. Navigation & Shell UI
- **Bottom Navigation**: Add a new "Wealth/Net Worth" item to the bottom navigation bar (`id="bottomNav"`) replacing or next to Settings.
- **Tab Container**: Add `<div id="tab-wealth">` below the existing tabs, to act as the primary Net Worth dashboard.

## 3. Net Worth Dashboard UI (`#tab-wealth`)
- **Header & Main Chart**:
  - Top indicator for trend (red/green arrow) followed by "Net Worth" and a timeframe selector pill.
  - Line Chart (using Chart.js) with thin vertical grids plotting historical Net Worth (Assets + Balances - Debts).
- **Financial Summary Card**: 
  - Card with 3 parallel columns: *Total Balance*, *Total Assets*, *Total Debts*.
  - Horizontal stacked bar underneath to visualize the ratio of the three categories with a legend.
- **Monthly Net Worth Bar Chart**:
  - Section titled "Net Worth" with a "Month" filter.
  - A historical monthly bar chart showing Net Worth per month (e.g., thick bars indicating monthly position).
- **Insight & Warning Cards**:
  - Bottom area with 2 vertical cards. 
  - Left icon (warning/info), title (e.g., "Menurun", "Rasio Utang Tinggi"), and detailed text or progress bar showing health status.

## 4. Main Debt View (`#viewDebt` Overlay)
- **Header Area**:
  - Title "Debt", Filter menu icon.
  - Large typography for *Total Remaining Debt* nominal, trend indicator, and timeframe selector.
- **Debts Bottom Sheet List**:
  - Sub-header "Debts" with a toggle pill (Grid vs. List view).
  - **Debt Item Card**: Category icon, Title, Progress bar (X% paid), nominal money, and Due Date.
- **Floating Action Button (FAB)**:
  - Big circular "+" button at bottom right to add a new Debt record.

## 5. Debt Details Overlay (`#viewDebtDetail`)
Triggered when clicking a specific Debt Item.
- **Top App Bar**: Back navigation (left), "Debt Details" (center), Actions [✓ (Mark Done), Edit, Delete] (right).
- **Hero Main Info Card**:
  - Top row: Debt Category Icon, Debt Title, Due date subtitle, and a pill badge with clock and "% Paid".
  - Bottom row: Large Typography for Nominal Amount ("Remaining Debt").
- **Progress & Summary Cards** (3 rows):
  - *Card 1 (Progress)*: Text "Paid / Total" on left, Percentage on right, and a progress bar below.
  - *Card 2 (Breakdown)*: 3 rows for Total Debt, Remaining Debt, Paid.
  - *Card 3 (Status)*: Active Status icon, "BORROWED" text, Status pill.
- **Records Section**:
  - Header: "Debt Records" with entries count badge.
  - *Empty State*: Rounded icon, Bold "No Records Yet", and subtitle text.
  - *Filled State*: List of payment history.
- **Detail FAB (+)**:
  - Button to add a record specifically for this debt.
  - Prompts: "Payment" or "Borrow More".
  - If Payment: Provides selector "Payment from (Account/Wallet)". Translates to the `debt_payment` transaction type mentioned in step 1.

## 6. Logic & Chart Wiring
- Connect the existing Accounts arrays to the Net Worth equations.
- Setup `Chart.js` instances for:
  - Net Worth Historical Line Chart.
  - Net Worth Monthly Bar Chart.
- Create dynamically updating horizontal stacked bars (using Tailwind width percentages or inline styles based on math).
- Build the Empty States logic and ensure accurate propagation between paying a Debt and the Wallet's balance reflecting the deduction.