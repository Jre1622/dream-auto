### **Project Technical Brief**

**1. High-Level Purpose**

The project is a web application for a car dealership. It provides an admin interface to manage vehicle inventory and a public-facing website for customers to browse and view details of the cars for sale.

**2. Inferred Technology Stack**

- **Backend:** Node.js with the Express.js framework.
- **Frontend:** EJS (Embedded JavaScript) for server-side templating and Tailwind CSS for styling.
- **Database:** SQLite for a lightweight, file-based database.
- **Image Storage:** Cloudflare R2 for object storage, accessed via the AWS S3 SDK (`@aws-sdk/client-s3`).
- **Key Libraries:**
    - `dotenv`: To manage environment variables.
    - `multer`: For handling multipart/form-data, primarily for file uploads.
    - `express-rate-limit`: To apply basic rate limiting to prevent abuse.

**3. Setup and Dependencies**

- **Installation:** To install the necessary packages, run the command `npm install` in the project root. This will download all dependencies listed in `package.json`.
- **Running the Project:**
    - To start the web server, run `npm start`.
    - To compile the Tailwind CSS, run `npm run build:css`.
- **Environment Variables:** The application requires a `.env` file in the root directory with the following variables:
    - `PORT`: The port on which the server will run (e.g., 3000).
    - `R2_ENDPOINT`: The endpoint URL for your Cloudflare R2 bucket.
    - `R2_ACCESS_KEY_ID`: Your R2 access key ID.
    - `R2_SECRET_ACCESS_KEY`: Your R2 secret access key.
    - `R2_BUCKET_NAME`: The name of your R2 bucket.
    - `ADMIN_USERNAME`: The username for accessing the admin panel.
    - `ADMIN_PASSWORD`: The password for accessing the admin panel.

**4. Overall Project Structure**

- `server.js`: The application's entry point. It initializes the Express server, configures middleware, and mounts the main routes.
- `package.json`: Defines project metadata, dependencies, and scripts.
- `config/`: Contains configuration files. `r2.js` sets up the S3 client for Cloudflare R2.
- `db/`: Manages database setup. `database.js` connects to SQLite and initializes the schema (`cars` and `car_images` tables).
- `public/`: Holds all static assets accessible by the client, such as CSS, client-side JavaScript, and images.
- `routes/`: Contains the route definitions for the application.
    - `admin.js`: Defines all routes under the `/admin` path for inventory management.
    - `inventory.js`: Defines the public-facing routes under the `/inventory` path.
- `utils/`: Contains reusable utility modules. `imageUpload.js` encapsulates the logic for uploading and managing images with R2 and the database.
- `views/`: Contains all EJS templates for rendering HTML pages.
    - `admin/`: Templates for the admin dashboard (add, edit, view cars).
    - `partials/`: Reusable template fragments like the header and footer.
    - `index.ejs`, `inventory.ejs`, `vehicle-detail.ejs`: Templates for the main public pages.

**5. Core Modules & Responsibilities**

- **`server.js`**: Orchestrates the application by setting up the server, applying middleware for request parsing and static file serving, and delegating routing to the `admin` and `inventory` modules.
- **`db/database.js`**: Responsible for all initial database interactions, including creating the database file, defining the table schemas, and creating indexes to optimize query performance.
- **`routes/admin.js`**: The heart of the admin panel. It secures the admin area using basic authentication, handles all CRUD (Create, Read, Update, Delete) operations for cars, and integrates with `multer` and `imageUpload.js` to manage image uploads.
- **`routes/inventory.js`**: Manages the user-facing inventory. It fetches car data from the database, supports filtering and pagination, and renders the appropriate views for browsing the inventory and viewing specific vehicle details.
- **`utils/imageUpload.js`**: A critical service module that abstracts all complexity related to image handling. Its responsibilities include uploading files to R2, saving image metadata to the database, deleting images from both R2 and the database, and retrieving images for a specific car.

**6. Authentication & Authorization Flow**

- **Authentication:** The application uses HTTP Basic Authentication to protect the `/admin` routes. There is no concept of user accounts for the general public.
- **Authorization:** The `basicAuth` middleware in `routes/admin.js` acts as a gatekeeper. It inspects the `Authorization` header of incoming requests. The credentials are decoded from Base64 and validated against the `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables. If the credentials match, the request is allowed to proceed; otherwise, a `401 Unauthorized` status is returned, prompting the user for credentials.

**7. Key Data Flows & Interactions**

**Example Flow: Adding a New Car**

1.  **Request:** An authenticated admin submits a `POST` request to `/admin/add-car` with the car's details and images.
2.  **File Handling:** The `multer` middleware in `routes/admin.js` intercepts the request, processes the uploaded image files, and makes them available in memory via `req.files`.
3.  **Car Creation:** The route handler inserts the car's textual data (make, model, VIN, etc.) into the `cars` table in the database and retrieves the new car's unique ID.
4.  **Image Processing:** The handler calls the `uploadCarImages` function from `utils/imageUpload.js`, passing the `req.files` array and the new car ID.
5.  **R2 Upload & DB Update:** Inside `uploadCarImages`, a loop iterates through each file:
    a.  The image is uploaded to the Cloudflare R2 bucket.
    b.  Upon successful upload, the public URL and R2 object key are returned.
    c.  A new record is inserted into the `car_images` table, linking the image URL and key to the car ID.
6.  **Response:** The server responds by re-rendering the `add-car` page with a success or failure message, informing the admin of the outcome.