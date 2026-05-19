# Account Drill-down & Budget Settings

This plan adds a detailed account management and visualization layer to the Dirhamku app. It leverages the existing History tab by making the "Account Summary" card clickable, leading to a multi-level drill-down experience with charts and trends. It also adds a budget management setting.

## User Review Required

> [!IMPORTANT]
> **Data Accuracy**: The historical balance trend chart relies on having a complete transaction history. If older transactions are missing, the chart might start at an incorrect value. I will start the calculation from the current balance and work backwards.

> [!NOTE]
> **UI Navigation**: The Account Overview and Detail views will be implemented as overlays within the app container to maintain a single-page app feel.

## Proposed Changes

### 1. [Component] Settings Tab
Modify the settings view to include a monthly budget input.

#### [MODIFY] [index.html](file:///Users/apple/Documents/Dirhamku/dirhamku-firebase/public/index.html)
- Add a new section in `#tab-settings` for "Budget Bulanan".

#### [MODIFY] [app.js](file:///Users/apple/Documents/Dirhamku/dirhamku-firebase/public/app.js)
- Add `saveBudget()` function to update the user profile in Firestore.

---

### 2. [Component] History Tab (Level 1)
Make the account summary card interactive.

#### [MODIFY] [index.html](file:///Users/apple/Documents/Dirhamku/dirhamku-firebase/public/index.html)
- Add `onclick="app.openAccountOverview()"` to the summary card container.

#### [MODIFY] [app.js](file:///Users/apple/Documents/Dirhamku/dirhamku-firebase/public/app.js)
- Update `renderTransactionAccountFilters` to ensure the rendered HTML is clickable.

---

### 3. [Component] Account Overview (Level 2)
A new view showing the total balance trend and a list of accounts.

#### [NEW] [index.html](file:///Users/apple/Documents/Dirhamku/dirhamku-firebase/public/index.html)
- Add `#viewAccountOverview` overlay.
- Include a canvas for the total balance line chart.
- Include period selector buttons (7D, 1M, 3M, YTD, ALL).
- Include a container for account hero cards.

#### [MODIFY] [app.js](file:///Users/apple/Documents/Dirhamku/dirhamku-firebase/public/app.js)
- Add `openAccountOverview()` and `renderAccountOverviewCharts()`.
- Implement `calculateHistoricalBalanceSeries(accountId, period)` to compute chart data.

---

### 4. [Component] Account Detail (Level 3)
A detailed view for a specific account.

#### [NEW] [index.html](file:///Users/apple/Documents/Dirhamku/dirhamku-firebase/public/index.html)
- Add `#viewAccountDetail` overlay.
- Include canvases for Category Pie/Bar charts and Spending Trend Bar chart.
- Include a summary section (Past vs Current Month, Average).
- Include a `#detailTxContainer` for the filtered transaction list.

#### [MODIFY] [app.js](file:///Users/apple/Documents/Dirhamku/dirhamku-firebase/public/app.js)
- Add `openAccountDetail(accountId)` and `renderAccountDetailCharts(accountId)`.
- Implement category click handling to filter the transaction list.
- Add logic for the 6-month horizontal bar chart (Spending Trend).

## Verification Plan

### Automated Tests
- Syntax check for `app.js` using `node --check`.
- Browser verification:
    1. Navigate to Settings, change budget, verify it persists after reload.
    2. Navigate to History, click Account Summary card, verify Account Overview opens.
    3. Change period in Account Overview, verify chart updates.
    4. Click an account card in Overview, verify Account Detail opens.
    5. Click a category in Detail chart, verify transaction list appears.

### Manual Verification
- Verify chart responsiveness on mobile view.
- Ensure back buttons work correctly across all drill-down levels.
- Check that "Transfer" transactions are correctly handled in the balance trend (they should affect individual accounts but not the total portfolio balance).
