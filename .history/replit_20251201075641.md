# MIYOMINT - Service Request Platform

## Overview
A professional, responsive service matching platform built with React + Vite + Tailwind CSS + TypeScript. Users can find and connect with certified local professionals for various home services through a guided, mobile-first quote flow with AI-powered service suggestions.

## Project Structure
```
├── src/
│   ├── App.tsx              # Main application component with flexbox layout
│   ├── main.tsx             # React entry point
│   ├── index.css            # Global styles with Tailwind + flexbox
│   ├── vite-env.d.ts        # Vite environment types
│   ├── components/
│   │   ├── QuoteForm.tsx         # Main wizard container with step logic
│   │   ├── HeroSection.tsx       # Hero with professional images
│   │   ├── StepIndicator.tsx     # Visual step progress indicator
│   │   ├── ServiceSelection.tsx  # Service + ZIP input (step 1) with AI search
│   │   ├── QuestionStep.tsx      # Dynamic question rendering
│   │   ├── ContactInfo.tsx       # Name/email/phone (final step)
│   │   ├── ThankYou.tsx          # Submission confirmation
│   │   ├── Button.tsx            # Reusable button with variants
│   │   ├── ProgressBar.tsx       # Step progress indicator
│   │   ├── SectionCard.tsx       # Frosted glass card wrapper
│   │   ├── LegalModal.tsx        # Legal document modal
│   │   └── LegalFooter.tsx       # Minimal footer with legal links
│   ├── lib/
│   │   ├── cn.ts            # Class name merge utility
│   │   ├── aiSuggest.ts     # AI service suggestion API
│   │   └── supabase.ts      # Supabase client (optional)
│   └── types/
│       └── quote.ts         # TypeScript types and service questions
├── attached_assets/
│   ├── stock_images/        # Professional service photos
│   └── generated_images/    # AI-generated contractor background
├── public/
│   └── favicon.svg          # Site favicon
├── index.html               # HTML entry point
├── vite.config.js           # Vite configuration with @assets alias
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies
```

## Technologies
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool with @assets alias
- **Tailwind CSS 4** - Styling
- **Node.js 20** - Runtime

## Features
- **Hero Section** - Professional service images with trust badges
- **Multi-step Quote Wizard** - Service selection → questions → contact
- **AI-Powered Search** - 600ms debounce, skeleton loading, AI-only suggestions
- **20+ Service Categories** - Each with custom question flows
- **ZIP Code Validation** - Local matching for professionals
- **Google Sheets + Database** - Dual submission to Sheets and PostgreSQL
- **Auto-save** - Form progress saved to localStorage (24-hour expiry)
- **Responsive Design** - Mobile-first, works on all screen sizes
- **Step Indicator** - Visual step progress with percentage
- **Stats Section** - Animated counters with intersection observer
- **FAQ Section** - Accordion-style frequently asked questions
- **Thank You Page** - Confetti animation, animated checkmark, next steps
- **Real-time Validation** - Visual feedback icons on form fields
- **Legal Footer** - Minimal footer with Privacy, Terms, Contact links
- **Admin Dashboard** - Full-featured admin panel at /admin
  - Enterprise-grade security (HTTP-only cookies, CSRF protection, rate limiting)
  - Login: username "admin", password from ADMIN_DEFAULT_PASSWORD env variable
  - Modern dark theme with glassmorphism effects
  - Real-time dashboard with 30s polling and new submission notifications
  - Interactive SVG charts (donut charts, bar charts, line charts)
  - Interactive US state map with hover tooltips
  - Submission management with bulk actions, CSV/JSON export
  - Advanced filtering by status, country, service type, date range
  - Reports page with comprehensive analytics
  - Activity logs page with filtering
  - Settings page with password change functionality
  - Keyboard shortcuts (Alt+D/S/R/L/G for navigation)

## Design System
- Background: Light slate-50/white with subtle gradients
- Cards: Frosted glass with `backdrop-blur-xl` and border-slate-200
- Primary: Sky blue gradient (`from-sky-500 to-indigo-600`)
- Success: Emerald (`emerald-400`, `emerald-500`)
- Typography: System fonts, bold headings, clean hierarchy
- Border radius: 2xl/3xl for modern rounded feel
- Shadows: Subtle with colored glows
- Animations: Confetti, shimmer, bounce-in, shake, slide-up, ripple, float, glow

## Search Behavior
- **Debounce**: 600ms delay before triggering AI search
- **Loading**: Skeleton UI with AI analysis message
- **Results**: AI-only suggestions (no keyword fallback)
- **Container**: Fixed 200px min-height to prevent layout shift
- **Typewriter**: Animated placeholder examples

## Type Definitions
- `ServiceType` - Union of 20 service categories
- `QuestionAnswer` - string | string[] | null
- `QuoteFormData` - Form state with typed responses
- `QuestionConfig` - Question structure (id, question, type, options)
- `SERVICE_QUESTIONS` - Record mapping services to questions

## Running the Project
```bash
npm run dev
```
Server runs on port 5000.

## Environment Variables
- `OPENAI_API_KEY` - **Required** for AI service suggestions (secret)
- `ADMIN_DEFAULT_PASSWORD` - **Required** for initial admin setup (secret, must meet password policy)
- `COOKIE_SECRET` - **Recommended** for production cookie signing (secret, auto-generated if missing)
- `VITE_SUPABASE_URL` - Supabase project URL (optional)
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key (optional)
- `VITE_SUGGEST_URL` - AI suggestion API endpoint override (optional, defaults to `/api/suggest`)

## Backend Architecture

### Express Server (Port 3001)
- **File Upload System**: Multer-based photo upload (max 6 photos, 2MB each, 2.5MB total)
- **AI Service Suggestions**: OpenAI GPT-4o-mini powered smart search
- **Storage System**: Local file storage with security validation
  - MIME type and extension validation
  - Security headers (X-Content-Type-Options, CSP)
  - Files served from /uploads directory

### API Endpoints
- `POST /api/suggest` - AI-powered service suggestions
  - Input: `{ query: string }`
  - Returns: `{ suggestions: [{ service, reason }] }`
  - Uses OpenAI GPT-4o-mini with gpt-5 compatible prompt
  - Graceful fallback on API failures
- `POST /api/upload/photos` - Upload multiple photos (FormData)
  - Returns: `{ success, count, files: [{ url, key, provider }] }`
- `POST /api/submit` - Save form submission to database
  - Input: `{ serviceType, zipCode, name, email, phone, answers, photoUrls }`
  - Returns: `{ success, submissionId }`
- `GET /health` - Server health check

### Admin Dashboard API (Protected)
Authentication uses HTTP-only cookies with CSRF token protection.
- `POST /api/admin/login` - Admin authentication (returns session cookie + CSRF token)
- `POST /api/admin/logout` - End session (requires CSRF)
- `GET /api/admin/me` - Get current admin user + refresh CSRF token
- `GET /api/admin/submissions` - List submissions with pagination/filtering
- `GET /api/admin/submissions/:id` - Get submission details with notes
- `PATCH /api/admin/submissions/:id` - Update submission status/notes (requires CSRF)
- `POST /api/admin/submissions/:id/notes` - Add note to submission (requires CSRF)
- `DELETE /api/admin/submissions/:id` - Delete submission (requires CSRF)
- `GET /api/admin/stats` - Dashboard statistics and charts data
- `POST /api/admin/change-password` - Change admin password (requires CSRF)

### Security Implementation
- **Session Management**: HTTP-only cookies with secure flag, 8-hour duration
- **CSRF Protection**: Token-based validation for all state-changing requests
- **Rate Limiting**: Login (5/15min), Submit (10/hr), Upload (30/hr), General (100/15min)
- **Account Lockout**: 5 failed login attempts = 15 minute lockout
- **Password Policy**: 8+ chars with uppercase, lowercase, digit, special character
- **Input Sanitization**: XSS prevention with HTML entity encoding
- **File Upload Security**: Magic bytes validation, size limits, type whitelist
- **Security Headers**: Helmet (CSP, HSTS, X-Content-Type-Options, XSS Protection)
- **Session IP Validation**: Prevents session hijacking across IPs
- **bcrypt Hashing**: 12 rounds for password storage

### Vite Proxy Configuration
- Frontend (port 5000) proxies `/api/*` requests to backend (port 3001)
- Enables seamless frontend-backend communication in development

### Frontend Integration
- PhotoUpload component connects to backend API
- Async upload with loading states
- Error handling with user feedback
- Uploaded URLs stored in form data

### Deployment Notes
- **Replit**: Works out of the box with Object Storage
- **Vercel**: Requires @vercel/blob package + env vars
- See `DEPLOYMENT.md` for full Vercel migration guide

## Recent Changes (November 28, 2025)
- **Mobile Background Update**:
  - ✅ Replaced single contractor image with 4 service photos (Roofing, Electrical, HVAC, Remodeling)
  - ✅ Photos displayed as 2x2 grid with overlay gradient for readability
  - ✅ Matches desktop's right-side hero images

- **Photo Upload Fix**:
  - ✅ Implemented local file storage for development
  - ✅ Added security: MIME type validation, extension validation
  - ✅ Added security headers (X-Content-Type-Options, Content-Security-Policy)
  - ✅ Files served from /uploads with proper Content-Type headers

- **OpenAI API Integration**:
  - ✅ **Active AI Suggestions**: Backend endpoint using OpenAI GPT-4o-mini
  - ✅ **Backend Route**: `POST /api/suggest` returns AI-powered service matches
  - ✅ **Vite Proxy**: Frontend seamlessly connects to backend API
  - ✅ **Tested**: "my roof is leaking" → returns Roofing, Drywall, Handyman
  - Cost: ~$0.001 per search query

- **Major Feature Additions**:
  - **Form Validations**: ZIP code real-time regex validation with color feedback (green/amber/default), phone formatting (555-123-4567), email autocomplete with common providers
  - **Enhanced Animations**: 
    - Dramatic hover effects on service cards (scale, translate, shadows), slide-in-right transitions
    - **Scrolling Testimonials**: Continuous right-to-left scrolling customer reviews in footer (40s cycle, 6 reviews with 5-star ratings)
    - **Typewriter Effect**: Auto-typing placeholder in search input - writes and erases examples like "my roof is leaking...", "fix sink clog...", etc. (6 rotating examples)
  - **Skeleton Screens**: Animated pulse loading states for AI search with 2 placeholder cards
  - **Photo Upload Step**: NEW drag & drop photo upload (max 6 photos) before contact info, mobile camera support, preview grid with remove, skip option
  - **Testimonials & Trust**: 
    - 5-star rating system, 3 verified customer reviews, certification badges (Licensed, Background Checked, Top Rated) - desktop only
    - Compact certification badges (smaller icons, reduced spacing)
  - **SEO Optimization**: Comprehensive meta tags (OG, Twitter Card), JSON-LD structured data, sitemap.xml, robots.txt

- **Mobile Optimization**: Comprehensive spacing/padding reduction across all components - entire form now fits on mobile without scrolling
  - QuestionStep: Reduced spacing (space-y-4/6), smaller fonts (text-xl/2xl/3xl responsive), compact input padding
  - ServiceSelection: Progressive spacing (space-y-3/6/8), optimized search input and suggestion cards for mobile
  - HeroSection: Tighter spacing (space-y-3/4/6), smaller trust badges and fonts on mobile, testimonials hidden on mobile
  - ThankYou: Responsive spacing and font sizes (text-2xl/3xl/4xl)
  - Global: Faster animations (0.35s fadeIn, 8px translateY), new slide-in-right animations

- **Desktop Enhancements**: ZIP input and Continue button unified at same height (h-14) on desktop for polished appearance
- **Search UX Improvements**: 1-second debounce, skeleton screen loading, max 2 AI results, fixed-height container (200px) prevents screen jumping
- **Footer Visibility**: Fixed mobile footer visibility with z-50, clean minimal design (slate-950 bg, subtle border, text-xs/sm)
- **Layout Structure**: Implemented flexbox layout in App.tsx and index.css for proper footer positioning (mt-auto)
- **AI Search Fallback**: Smart fallback to keyword matching when AI service fails, showing max 2 relevant results
- Enhanced service selection with SVG icons (sky-400 color)
- Type-safe form responses with QuestionAnswer type

## Recent Updates (November 30, 2025)

### Admin Panel Enhancements
- **Professionals Management** (`/admin` → Settings → Professionals)
  - Full CRUD for service professionals/contractors
  - Status workflow: pending → approved/rejected → suspended
  - Service types, ZIP code coverage, license tracking
  - Insurance verification and background check badges
  
- **Multi-Admin Support** (`/admin` → Settings → Admin Users)
  - Create additional admin accounts with roles (admin/editor/viewer)
  - Role-based permissions (only admins can manage users)
  - Password policy enforcement (8+ chars, mixed case, numbers, special chars)
  
- **Webhook Integration** (`/admin` → Settings → Webhooks)
  - External system notifications (Slack, Zapier, custom endpoints)
  - Event types: submission.created, professional.approved, etc.
  - Secret key generation for secure webhook signing
  - Test webhook functionality with retry tracking
  
- **Export Functionality**
  - CSV and JSON export of all submissions
  - Activity logging for all admin actions

### New Database Tables
- `professionals` - Contractor/service provider registry
- `service_categories` - Service type management
- `webhooks` - External notification endpoints
- `email_templates` - Notification templates (placeholder)

### New Admin API Routes
- `GET/POST/PATCH/DELETE /api/admin/professionals` - Professional management
- `GET/POST/PATCH/DELETE /api/admin/service-categories` - Category management  
- `GET/POST/PATCH/DELETE /api/admin/webhooks` - Webhook configuration
- `POST /api/admin/webhooks/:id/test` - Test webhook delivery
- `GET/POST/DELETE /api/admin/admin-users` - Multi-admin management
- `GET /api/admin/export/submissions` - Data export (CSV/JSON)
- `GET /api/admin/system-info` - System statistics

## User Preferences
- Dark navy theme with gradient accents
- Mobile-first responsive design (entire form fits on screen without scrolling)
- Frosted glass card aesthetics
- Professional service photography
- Step-by-step guided flow
- Clean, modern, minimal UI
- Footer must be visible but not visually dominant
