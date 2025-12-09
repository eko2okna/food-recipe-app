# Food Recipe App
[![Ask Deepwiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/eko2okna/food-recipe-app)
![GitHub last commit](https://img.shields.io/github/last-commit/eko2okna/food-recipe-app) ![GitHub repo size](https://img.shields.io/github/repo-size/eko2okna/food-recipe-app) ![GitHub Repo stars](https://img.shields.io/github/stars/eko2okna/food-recipe-app) 


A full-stack web application designed for users to share, discover, and rate food recipes. It features a simple, clean interface for browsing recipes, a user authentication system, and a dedicated admin panel for user management. The entire application is containerized using Docker for easy setup and deployment.

## Features

*   **User Authentication:** Secure JWT-based login for registered users.
*   **Recipe Management:** Authenticated users can create, read, update, and delete their own recipes.
*   **Recipe Details:** Each recipe includes a title, cooking instructions, an image, and a category (Breakfast, Dinner, Bakes).
*   **Recipe Filtering:** Filter meals by category to easily find what you're looking for.
*   **Rating System:** Users can rate any dish on a scale of 1 to 10. The average rating is displayed for each dish.
*   **Admin Panel:** A separate, secure dashboard for administrators to:
    *   View all registered users.
    *   Add new users.
    *   Delete existing users.
    *   Change user passwords.

## Tech Stack

*   **Frontend:** HTML, CSS, Vanilla JavaScript
*   **Backend:** Node.js, Express.js
*   **Database:** MariaDB
*   **Web Server / Reverse Proxy:** Nginx
*   **Containerization:** Docker, Docker Compose
*   **Authentication:** JSON Web Tokens (JWT)
*   **Password Hashing:** Bcrypt.js
*   **File Uploads:** Multer

## Application Architecture

The application is composed of three main services orchestrated by Docker Compose:
*   `nginx`: Serves the static frontend assets and acts as a reverse proxy, directing API requests (`/api/*`, `/uploads/*`) to the backend service.
*   `backend`: A Node.js/Express application that handles business logic, user authentication, and database interactions. It also manages image uploads.
*   `db`: A MariaDB instance for persistent data storage.

A Docker volume (`dbdata`) ensures that database information persists across container restarts. The `uploads` directory is shared between the `backend` and `nginx` services to handle and serve user-uploaded images.

## Getting Started

Follow these steps to run the application locally using Docker.

### 1. Prerequisites
*   Docker and Docker Compose must be installed on your system.

### 2. Clone the Repository
```bash
git clone https://github.com/eko2okna/food-recipe-app.git
cd food-recipe-app
```

### 3. Configure Environment Variables
Create a `.env` file inside the `backend/` directory by copying the example file.

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set your own secure values for `JWT_SECRET` and `ADMIN_KEY`. The database credentials can remain as they are for the default Docker setup.

```dotenv
# backend/.env
DB_HOST=db
DB_USER=appuser
DB_PASSWORD=apppass
DB_NAME=foodapp

PORT=3300
JWT_SECRET=your_super_secret_jwt_key
ADMIN_KEY=your_secure_admin_key
```

### 4. Seed Initial Users
The database is initialized using `init.sql`. This file creates the tables but requires `INSERT` statements for the initial users, including the special admin user named `igor`.

**a. Generate Password Hashes**

The repository includes a script to generate password hashes.

```bash
# From the project root directory
npm install --prefix ./backend
node backend/gen-hash.js
```
This script will output SQL `INSERT` statements to the console for two sample users, `user1` and `user2`.

**b. Create Admin User**

The admin panel is hardcoded to grant access to a user named `igor`. You must create this user. To do so, you can temporarily modify `backend/gen-hash.js` to create a hash for `igor` as well. For example, to generate hashes for `igor` (password: `adminpass`), `user1` (password: `password`), and `user2` (password: `password`):

```javascript
// backend/gen-hash.js (modified example)
import bcrypt from 'bcryptjs';

async function generateHashes() {
  const hashAdmin = await bcrypt.hash('adminpass', 10);
  const hash1 = await bcrypt.hash('password', 10);
  const hash2 = await bcrypt.hash('password', 10);

  console.log('\nPaste this into init.sql:\n');
  console.log('INSERT INTO users (username, password_hash) VALUES');
  console.log(`('igor', '${hashAdmin}'),`);
  console.log(`('user1', '${hash1}'),`);
  console.log(`('user2', '${hash2}')`);
  console.log('ON DUPLICATE KEY UPDATE username=username;\n');
}

generateHashes();
```
Run `node backend/gen-hash.js` again to get the complete SQL.

**c. Update `init.sql`**

Copy the generated `INSERT INTO ...` SQL statements and paste them at the end of the `init.sql` file, replacing the comment `-- Seed users...`.

### 5. Build and Run the Application
Use Docker Compose to build the images and start all services in detached mode.

```bash
docker-compose up --build -d
```

### 6. Access the Application
*   **Main App:** Open your browser and navigate to `http://localhost`
*   **Admin Panel:** Navigate to `http://localhost/admin`

You can log in with the seeded users (e.g., `user1` / `password`) or as the admin (`igor` / `adminpass`).

## API Endpoints

The backend exposes the following RESTful API endpoints.

| Method   | Endpoint                               | Description                               | Auth Required | Admin Only |
| -------- | -------------------------------------- | ----------------------------------------- |:-------------:|:----------:|
| `POST`   | `/api/login`                           | Log in a user.                            |       No      |     No     |
| `POST`   | `/api/admin/login`                     | Log in an admin (`igor`).                 |       No      |     Yes    |
| `GET`    | `/api/meals`                           | Fetch all dishes with ratings.            |      Yes      |     No     |
| `POST`   | `/api/meals`                           | Add a new dish.                           |      Yes      |     No     |
| `PUT`    | `/api/meals/:id`                       | Edit an existing dish.                    |      Yes      |     No     |
| `DELETE` | `/api/meals/:id`                       | Delete a dish.                            |      Yes      |     No     |
| `POST`   | `/api/ratings`                         | Add or update a rating for a dish.        |      Yes      |     No     |
| `GET`    | `/api/admin/me`                        | Verify admin token validity.              |      Yes      |     Yes    |
| `GET`    | `/api/admin/users`                     | List all users.                           |      Yes      |     Yes    |
| `POST`   | `/api/admin/users`                     | Create a new user.                        |      Yes      |     Yes    |
| `PUT`    | `/api/admin/users/:username/password`  | Change a user's password.                 |      Yes      |     Yes    |
| `DELETE` | `/api/admin/users/:username`           | Delete a user.                            |      Yes      |     Yes    |
