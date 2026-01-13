# Design Guidelines: Hours Submission & Approval System

## Design Approach

**Selected System:** Material Design 3  
**Justification:** Enterprise productivity application requiring robust form handling, data tables, and role-based dashboards. Material Design provides excellent patterns for information-dense interfaces with clear hierarchies.

**Key Principles:**
- Clarity over aesthetics - efficiency is paramount
- Consistent component patterns across all roles
- Clear visual hierarchy for approval workflows
- Mobile-responsive for on-the-go submissions

## Typography

**Font Family:** Google Fonts - Inter (primary), Roboto Mono (data/numbers)

**Hierarchy:**
- Page Titles: 32px, Semi-Bold
- Section Headers: 24px, Medium  
- Card Titles: 18px, Medium
- Body Text: 16px, Regular
- Table Headers: 14px, Medium, Uppercase
- Captions/Labels: 14px, Regular
- Data/Numbers: 16px, Roboto Mono

## Layout System

**Spacing Units:** Tailwind units 2, 4, 6, 8, 12, 16 (e.g., p-4, gap-6, mb-8)

**Container Structure:**
- App shell with persistent sidebar navigation (w-64)
- Main content area with max-w-7xl centered
- Cards with p-6 padding
- Form sections with space-y-6
- Table rows with py-4 padding

## Component Library

### Navigation
**Sidebar (Desktop):**
- Fixed left sidebar (w-64, h-screen)
- Logo/company name at top (p-6)
- Role-based menu items with icons
- Active state indicator (left border accent)
- User profile section at bottom

**Mobile:** Collapsible hamburger menu with overlay

### Dashboards

**Employee Dashboard:**
- Stats cards row: Total hours submitted, Pending approvals, Approved this month (grid-cols-3 gap-6)
- Quick submit card with prominent CTA
- Recent submissions table (5 rows max)
- "View All" link to full ledger

**Approver Dashboard:**
- Pending approvals count banner
- Filter bar: Department dropdown, date range
- Approval queue table with inline actions
- Bulk actions toolbar

**Admin Dashboard:**
- Overview stats grid (4 columns): Total employees, Departments, Pending approvals, This month's hours
- Quick actions card: Manage users, Departments, Reports
- Recent activity feed
- System-wide filters

### Forms

**Hours Submission Form:**
- Two-column layout (md:grid-cols-2 gap-6)
- Left: Department selector, Date picker, Time inputs (from/to OR total hours toggle)
- Right: Notes textarea (full height)
- Calculation preview card showing computed hours
- Bottom action bar: Cancel, Submit buttons (space-x-4)

**Form Inputs:**
- Floating labels
- Helper text below (text-sm)
- Error states with inline messaging
- Dropdowns with search capability

### Data Tables

**Structure:**
- Sticky header row
- Alternating row backgrounds for scannability
- Right-aligned actions column
- Status badges (Pending, Approved, Rejected)
- Sort indicators in headers
- Pagination footer

**Status Badges:**
- Pill-shaped (rounded-full, px-4 py-1)
- Text-sm, Medium weight
- Icon prefix for state

### Modals & Overlays

**Approval Modal:**
- Header with employee name and submission details
- Details grid: Department, Date, Hours, Notes
- Action section: Approve/Reject buttons
- Comments textarea (required for rejection)
- Timestamp display

**Confirmation Dialogs:**
- Centered, max-w-md
- Icon at top
- Clear heading and description
- Primary/Secondary action buttons

### Reports Section

**Layout:**
- Filter panel (sticky top): Date range, Department, Employee dropdowns
- Action bar: Generate Report, Export CSV buttons
- Results area:
  - Summary cards (grid-cols-4)
  - Detailed table below
  - Expandable rows for drill-down

### Audit Log View

**Timeline Design:**
- Vertical timeline with connecting line
- Event cards with:
  - Timestamp (left, text-sm)
  - Action icon
  - Description and actor
  - Changed fields (if applicable)
- Filters: Action type, Date range, User

## Special Interactions

**Inline Editing (Admin):**
- Click-to-edit table cells
- Auto-save with loading indicator
- Audit trail automatically logged

**Bulk Actions:**
- Checkbox column in tables
- Floating action bar appears on selection
- Shows count and available actions

**Empty States:**
- Centered icon and message
- Helpful CTA when applicable
- Suggests next action

## Responsive Behavior

**Desktop (lg+):** Full sidebar, multi-column layouts
**Tablet (md):** Collapsible sidebar, 2-column forms
**Mobile (base):** Hidden sidebar, stacked single-column, priority information first

**Mobile-Specific Optimizations:**
- Bottom navigation bar for key actions
- Swipe actions on table rows
- Expandable cards instead of tables
- Prominent FAB for quick submission

## Images

No hero images required. This is a functional enterprise application.

**Icons:** Material Icons via CDN - use throughout for actions, navigation, and status indicators