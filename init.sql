-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

-- Dishes table
CREATE TABLE IF NOT EXISTS dishes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    recipe TEXT NOT NULL,
    image_path VARCHAR(255),
    author_id INT,
    type ENUM('breakfast', 'dinner', 'bakes') DEFAULT 'dinner',
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Ratings table
CREATE TABLE IF NOT EXISTS ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    dish_id INT,
    rating TINYINT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (dish_id) REFERENCES dishes(id)
);
 
-- Seed users (paste from password generator located in /backend/gen-hash.js)
