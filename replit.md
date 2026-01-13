# OvertimeTracker - Hours Submission & Approval System

## Overview

OvertimeTracker is an enterprise productivity application for managing overtime hours submission and approval workflows. The system supports role-based access control with three user types: Employees (submit hours), Approvers (review and approve/reject submissions), and Admins (full system management). Key features include department-based organization, multi-level approval workflows, audit logging, and comprehensive reporting.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation
- **Design System**: Material Design 3 principles with Inter font family

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **Build Tool**: esbuild for server bundling, Vite for client
- **API Pattern**: RESTful JSON API with `/api` prefix
- **Session Management**: Express-session with PostgreSQL store (connect-pg-simple)

### Authentication
- **Method**: Replit OpenID Connect (OIDC) integration
- **Session Storage**: PostgreSQL-backed sessions table
- **User Management**: Automatic user upsert on authentication with role assignment

### Role-Based Access Control
- Three roles: `employee`, `approver`, `admin`
- Users can have multiple roles stored in `user_roles` table
- Department-specific approver assignments via `department_approvers` table
- Default role assignment to "employee" for new users

### Data Flow
1. Client makes API requests to Express backend
2. Routes check authentication via Passport middleware
3. Storage layer handles database operations via Drizzle ORM
4. Responses returned as JSON with proper error handling

## External Dependencies

### Database
- **PostgreSQL**: Primary data store
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Schema Location**: `shared/schema.ts` and `shared/models/auth.ts`

### Authentication Provider
- **Replit OIDC**: OpenID Connect authentication via Replit's identity service
- **Required Environment Variables**: 
  - `DATABASE_URL` - PostgreSQL connection string
  - `SESSION_SECRET` - Session encryption key
  - `ISSUER_URL` - OIDC issuer (defaults to https://replit.com/oidc)
  - `REPL_ID` - Replit environment identifier

### Key NPM Dependencies
- `@tanstack/react-query` - Server state management
- `drizzle-orm` / `drizzle-zod` - Database ORM and validation
- `express-session` / `connect-pg-simple` - Session management
- `passport` / `openid-client` - Authentication
- `date-fns` - Date manipulation
- `zod` - Schema validation
- `lucide-react` - Icon library

### Development Tools
- Vite with HMR for development
- Replit-specific plugins for development experience
- TypeScript with strict mode enabled

## Recent Changes

### January 2026
- **Fractional hours support**: Changed `totalHours` column from integer to real (float) type to support decimal values like 7.5 hours
- **Approval state guards**: Added 409 Conflict response when attempting to approve/reject already processed submissions
- **Self-approval restriction**: Users cannot approve their own submissions
- **Department membership APIs**: Added REST endpoints for managing department approvers and employees:
  - `GET/POST/DELETE /api/departments/:id/approvers` - Manage department approvers with enriched user details
  - `GET/POST/DELETE /api/departments/:id/employees` - Manage department employees with enriched user details
- **Audit logging**: All significant actions (submissions, approvals, department changes) are logged

## API Endpoints

### Authentication
- `GET /api/auth/user` - Get current authenticated user
- `GET /api/login` - Initiate OIDC login flow
- `GET /api/logout` - End session

### Departments (Admin only for mutations)
- `GET /api/departments` - List all departments
- `POST /api/departments` - Create department
- `PUT /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Delete department
- `GET /api/departments/:id/approvers` - Get department approvers with user details
- `POST /api/departments/:id/approvers` - Add approver to department
- `DELETE /api/departments/:id/approvers/:userId` - Remove approver
- `GET /api/departments/:id/employees` - Get department employees with user details
- `POST /api/departments/:id/employees` - Add employee to department
- `DELETE /api/departments/:id/employees/:userId` - Remove employee

### Hours Submissions
- `GET /api/submissions` - Get user's submissions
- `POST /api/submissions` - Create hours submission (totalHours: 0.5-24 decimal)

### Approvals (Approver/Admin)
- `GET /api/approvals/pending` - Get pending approvals for user's departments
- `POST /api/submissions/:id/approve` - Approve/reject submission (body: { status, comment })

### Admin
- `GET /api/admin/departments` - Departments with employee/approver counts
- `GET /api/admin/users` - All users with roles
- `GET /api/admin/audit` - Audit logs
- `POST /api/admin/users/:id/roles` - Update user roles