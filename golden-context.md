### **Project Technical Brief**

**1. High-Level Purpose**

Dream Auto is a car dealership inventory management system and customer-facing website designed for indie hackers and small dealerships. The system provides a complete solution for managing vehicle inventory, showcasing cars to potential buyers, and handling the full lifecycle of vehicle listings. It enables dealership staff to efficiently add, edit, and manage car listings with multiple images, while providing customers with an intuitive browsing experience to search, filter, and view detailed vehicle information.

**2. Inferred Technology Stack**

- **Backend Runtime**: Node.js (v18+ recommended)
- **Web Framework**: Express.js 5.x
- **Database**: SQLite 3.x with persistent file storage
- **Template Engine**: EJS (Embedded JavaScript) for server-side rendering
- **CSS Framework**: Tailwind CSS 4.x with JIT compilation
- **Cloud Storage**: Cloudflare R2 for scalable image hosting
- **File Upload**: Multer for handling multipart form data
- **Security**: express-rate-limit for API protection
- **AWS SDK**: @aws-sdk/client-s3 for Cloudflare R2 integration
- **Environment Management**: dotenv for configuration management

**3. Setup and Dependencies**

**Installation Process:**

```bash
npm install
```

**Build Process:**

```bash
npm run build:css  # Compiles Tailwind CSS
```

**Environment Variables Required (.env):**

```bash
# Admin Credentials
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password

# Cloudflare R2 Configuration
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name

# Dealership Configuration
DEALERSHIP_PHONE="+1-555-123-4567"
PORT=3000
```

**Running the Application:**

```bash
npm start
```

**4. Overall Project Structure**

```
dream-auto/
├── config/                 # Configuration management
│   └── r2.js              # Cloudflare R2 client configuration
├── db/                    # Database layer
│   ├── database.js        # SQLite connection and schema
│   └── database.db        # SQLite database file (auto-created)
├── public/                # Static assets served by Express
│   ├── css/
│   │   ├── input.css      # Tailwind CSS source
│   │   └── output.css     # Compiled Tailwind CSS
│   ├── favicon/           # Favicon assets
│   ├── images/            # Static images
│   └── js/                # Client-side JavaScript
├── routes/                # Express route definitions
│   ├── admin.js           # Admin dashboard routes
│   └── inventory.js       # Public inventory routes
├── utils/                 # Utility modules
│   └── imageUpload.js     # Image processing and R2 management
├── views/                 # EJS templates
│   ├── admin/             # Admin dashboard templates
│   │   ├── add-car.ejs    # Add vehicle form
│   │   ├── dashboard.ejs  # Admin dashboard
│   │   └── edit-car.ejs   # Edit vehicle form
│   ├── partials/          # Reusable template components
│   │   ├── footer.ejs     # Site footer
│   │   └── header.ejs     # Site header
│   ├── financing.ejs      # Financing information page
│   ├── index.ejs          # Homepage
│   ├── inventory.ejs      # Inventory listing
│   └── vehicle-detail.ejs # Individual vehicle page
├── .env                   # Environment variables
├── .gitignore            # Git ignore rules
├── package.json          # Dependencies and scripts
└── server.js            # Application entry point
```

**5. Core Modules & Responsibilities**

**Database Module (`db/database.js`)**

- Manages SQLite database connection and lifecycle
- Defines and initializes database schema
- Creates optimized indexes for query performance
- Handles table creation for cars and car_images
- Provides database instance for query execution

**Admin Router (`routes/admin.js`)**

- **Authentication**: HTTP Basic Auth with environment credentials
- **Rate Limiting**: 10 requests per 15-minute window
- **CRUD Operations**: Full vehicle management (Create, Read, Update, Delete)
- **Image Management**: Upload, delete, reorder vehicle images
- **Inventory Status**: Toggle sold/available status
- **Routes**:
  - `GET /admin` - Dashboard with all vehicles
  - `GET /admin/add-car` - Add vehicle form
  - `POST /admin/add-car` - Process new vehicle with images
  - `GET /admin/edit-car/:id` - Edit vehicle form
  - `POST /admin/edit-car/:id` - Update vehicle and images
  - `POST /admin/delete-car/:id` - Delete vehicle
  - `POST /admin/toggle-sold/:id` - Toggle sold status
  - `POST /admin/delete-image/:imageId` - Delete specific image
  - `POST /admin/update-images-order` - Batch update image order

**Inventory Router (`routes/inventory.js`)**

- **Public Access**: No authentication required
- **Filtering**: Advanced filtering by title, price range, year range, sold status
- **Pagination**: 9 vehicles per page with pagination controls
- **Image Integration**: Automatic primary image selection
- **Routes**:
  - `GET /inventory` - Filtered inventory listing
  - `GET /inventory/:id` - Individual vehicle details

**Image Upload Utility (`utils/imageUpload.js`)**

- **Cloud Storage**: Cloudflare R2 integration for scalable image hosting
- **Image Processing**: Validates file types (JPEG, PNG, WebP) and sizes
- **Database Integration**: Maintains image metadata in car_images table
- **Primary Image Management**: Automatic primary image selection based on display order
- **Batch Operations**: Supports multiple image uploads and batch ordering
- **Cleanup**: Automatic R2 and database cleanup on image deletion

**Server Module (`server.js`)**

- **Application Setup**: Express configuration and middleware
- **Static Serving**: Serves public assets (CSS, JS, images)
- **Template Configuration**: EJS setup with global variables
- **Route Mounting**: Connects admin and inventory routers
- **Database Integration**: Initializes database on startup
- **Error Handling**: Graceful error handling for database queries

**6. Authentication & Authorization Flow**

**Admin Authentication:**

- **Method**: HTTP Basic Authentication
- **Credentials**: Stored in environment variables (ADMIN_USERNAME, ADMIN_PASSWORD)
- **Scope**: All /admin/\* routes require authentication
- **Rate Limiting**: 10 requests per 15-minute window per IP
- **Security**: Credentials transmitted over HTTPS (recommended for production)

**Public Access:**

- **Inventory Routes**: No authentication required
- **Vehicle Details**: Publicly accessible
- **Image Access**: Public Cloudflare R2 URLs

**7. Key Data Flows & Interactions**

**Adding a New Vehicle (Admin Flow):**

1. **Admin Access**: Authenticated admin navigates to /admin/add-car
2. **Form Submission**: Admin submits vehicle details and up to 20 images
3. **Validation**: Server validates VIN uniqueness, image types, and sizes
4. **Database Insert**: Vehicle metadata inserted into cars table
5. **Image Processing**: Each image uploaded to Cloudflare R2
6. **Metadata Storage**: Image URLs and metadata stored in car_images table
7. **Primary Image**: First uploaded image automatically set as primary
8. **Confirmation**: Success message displayed with upload summary

**Customer Browsing Flow:**

1. **Landing Page**: Customer visits homepage, sees featured vehicles
2. **Inventory Browse**: Customer navigates to /inventory with optional filters
3. **Filter Application**: Server builds dynamic SQL queries based on filters
4. **Pagination**: Results paginated (9 per page) with navigation
5. **Image Display**: Primary images fetched from Cloudflare R2
6. **Detail View**: Customer clicks vehicle for detailed view
7. **Gallery Display**: All vehicle images displayed in order

**Image Management Flow:**

1. **Upload**: Images uploaded to Cloudflare R2 with unique keys
2. **Database Link**: Image metadata linked to vehicle in car_images table
3. **Ordering**: Display order maintained for gallery presentation
4. **Primary Selection**: First image (display_order=1) automatically primary
5. **Deletion**: Images removed from both R2 and database
6. **Reordering**: Batch updates supported for gallery management

**Database Schema Overview:**

- **cars table**: Stores vehicle metadata (title, year, make, model, price, etc.)
- **car_images table**: Stores image metadata (URL, key, display order, primary flag)
- **Indexes**: Optimized for filtering by sold status, make, year, price, and featured status
- **Relationships**: One-to-many relationship between cars and car_images

**Performance Optimizations:**

- **Database Indexes**: Strategic indexes for common query patterns
- **Image CDN**: Cloudflare R2 provides global CDN for fast image delivery
- **Query Optimization**: Single JOIN queries for fetching vehicles with primary images
- **Pagination**: Limits result sets for inventory browsing
