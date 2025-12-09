// backend/index.js
import 'dotenv/config';
import express from 'express';
import mariadb from 'mariadb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3300;
const JWT_SECRET = process.env.JWT_SECRET || 'secretkey';
const ADMIN_KEY = process.env.ADMIN_KEY || 'adminkey';

app.use(cors());

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  connectionLimit: 5
});

export default pool;

// User authentication middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch {
    res.status(403).json({ message: 'Invalid token' });
  }
}

// Admin authentication middleware
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key && key === ADMIN_KEY) return next();
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(403).json({ message: 'Access to admin panel denied' });
  try {
    const data = jwt.verify(token, JWT_SECRET);
    if (data?.username !== 'igor') return res.status(403).json({ message: 'Access to admin panel denied' });
    req.user = data;
    next();
  } catch {
    return res.status(403).json({ message: 'Access to admin panel denied' });
  }
}

// User login
app.post('/api/login', async (req, res) => {
  console.log('BODY:', req.body);
  const { username, password } = req.body;
  const conn = await pool.getConnection();
  const rows = await conn.query('SELECT * FROM users WHERE username = ?', [username]);
  conn.release();
  console.log('Found user:', rows.length > 0 ? 'YES' : 'NO');
  const user = rows[0];
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  console.log('Comparing password, hash:', user.password_hash);
  const match = await bcrypt.compare(password, user.password_hash);
  console.log('Password match:', match);
  if (!match) return res.status(400).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
  res.json({ token });
});

// Admin: add users
app.post('/api/admin/users', adminAuth, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Provide username and password' });
  }
  const conn = await pool.getConnection();
  try {
    const existing = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'User already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    await conn.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    res.json({ message: 'User added' });
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// Admin: list users
app.get('/api/admin/users', adminAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query('SELECT id, username FROM users ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// Admin: delete user by username
app.delete('/api/admin/users/:username', adminAuth, async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ message: 'Missing username' });

  // Do not allow deleting igor (admin) account
  if (username === 'igor') {
    return res.status(403).json({ message: 'Cannot delete administrator account' });
  }

  const conn = await pool.getConnection();
  try {
    const userRows = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User does not exist' });
    }
    const userId = userRows[0].id;

    // Delete user's ratings, then the user
    await conn.query('DELETE FROM ratings WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// Admin: change user password
app.put('/api/admin/users/:username/password', adminAuth, async (req, res) => {
  const { username } = req.params;
  const { new_password } = req.body;
  if (!username || !new_password) {
    return res.status(400).json({ message: 'Provide username and new password' });
  }
  const conn = await pool.getConnection();
  try {
    const userRows = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User does not exist' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await conn.query('UPDATE users SET password_hash = ? WHERE username = ?', [hash, username]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// Admin-only login (only user "igor")
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Provide username and password' });
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });
    if (user.username !== 'igor') return res.status(403).json({ message: 'Access denied' });
    const token = jwt.sign({ id: user.id, username: user.username, role: 'admin' }, JWT_SECRET);
    res.json({ token });
  } catch (err) {
    console.error('Error in /api/admin/login:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// Admin verification for dashboard
app.get('/api/admin/me', auth, (req, res) => {
  if (req.user?.username !== 'igor') return res.status(403).json({ message: 'Access denied' });
  res.json({ ok: true, username: req.user.username });
});

// Fetch dishes list with ratings
app.get('/api/meals', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const dishes = await conn.query(
      'SELECT d.id, d.title, d.recipe, d.image_path, d.type, d.author_id, u.username AS author_username FROM dishes d LEFT JOIN users u ON u.id = d.author_id ORDER BY d.id DESC'
    );

    if (dishes.length === 0) {
      return res.json([]);
    }

    const dishIds = dishes.map(d => d.id);
    const placeholders = dishIds.map(() => '?').join(',');
    const ratings = await conn.query(
      `SELECT r.dish_id, u.username, r.rating
       FROM ratings r
       JOIN users u ON u.id = r.user_id
       WHERE r.dish_id IN (${placeholders})
       ORDER BY r.dish_id ASC`, dishIds
    );

    const byDish = new Map();
    for (const r of ratings) {
      if (!byDish.has(r.dish_id)) byDish.set(r.dish_id, []);
      byDish.get(r.dish_id).push({ username: r.username, rating: r.rating });
    }

    const result = dishes.map(d => {
      const list = byDish.get(d.id) || [];
      const avg = list.length ? (list.reduce((sum, x) => sum + Number(x.rating), 0) / list.length) : null;
      return {
        id: d.id,
        title: d.title,
        recipe: d.recipe,
        image_path: d.image_path,
        type: d.type,
        author_id: d.author_id,
        author_username: d.author_username || null,
        ratings: list, // [{ username, rating }]
        average_rating: avg,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error in /api/meals:', err);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    conn.release();
  }
});

// Add dish
app.post('/api/meals', auth, upload.single('image'), async (req, res) => {
  const { title, recipe, type } = req.body;
  const imagePath = req.file ? req.file.path : null;
  const conn = await pool.getConnection();
  await conn.query(
    'INSERT INTO dishes (title, recipe, image_path, author_id, type) VALUES (?, ?, ?, ?, ?)',
    [title, recipe, imagePath, req.user.id, type]
  );
  conn.release();
  res.json({ message: 'Added' });
});

// Edit dish (title, recipe, optional image)
app.put('/api/meals/:id', auth, upload.single('image'), async (req, res) => {
  console.log('PUT /api/meals/:id', req.params.id);

  const mealId = req.params.id;
  const { title, recipe, type } = req.body;
  const imagePath = req.file ? req.file.path : null;

  const conn = await pool.getConnection();

  try {
    // Check if the dish belongs to the user
    const rows = await conn.query('SELECT author_id, image_path FROM dishes WHERE id = ?', [mealId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Dish not found' });
    if (rows[0].author_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });

    // If there is a new image, remove the old file (if any)
    if (imagePath && rows[0].image_path) {
      fs.unlink(rows[0].image_path, (err) => {
        if (err) console.error('Error removing old image:', err);
      });
    }

    // Update data (note image_path — if new provided, replace; otherwise keep old)
    await conn.query(
      'UPDATE dishes SET title = ?, recipe = ?, image_path = COALESCE(?, image_path), type = ? WHERE id = ?',
      [title, recipe, imagePath, type, mealId]
    );

    res.json({ message: 'Dish updated' });
  } finally {
    conn.release();
  }
});

// Delete dish
app.delete('/api/meals/:id', auth, async (req, res) => {
  console.log('DELETE /api/meals/:id', req.params.id);
  
  const mealId = req.params.id;
  const conn = await pool.getConnection();

  try {
    const rows = await conn.query('SELECT author_id, image_path FROM dishes WHERE id = ?', [mealId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Dish not found' });
    if (rows[0].author_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });

    // Delete image file if it exists
    if (rows[0].image_path) {
      fs.unlink(rows[0].image_path, (err) => {
        if (err) console.error('Error deleting image:', err);
      });
    }

    // Delete dish and related ratings
    await conn.query('DELETE FROM ratings WHERE dish_id = ?', [mealId]);
    await conn.query('DELETE FROM dishes WHERE id = ?', [mealId]);

    res.json({ message: 'Dish deleted' });
  } finally {
    conn.release();
  }
});

// Add/update dish rating
app.post('/api/ratings', auth, async (req, res) => {
  let conn;
  try {
    console.log('POST /api/ratings, user:', req.user.id, 'body:', req.body);

    const { dish_id, rating } = req.body;

    if (!dish_id) {
      return res.status(400).json({ error: 'Missing dish ID' });
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 10) {
      return res.status(400).json({ error: 'Rating must be an integer from 1 to 10' });
    }

    conn = await pool.getConnection();

    await conn.query('DELETE FROM ratings WHERE user_id = ? AND dish_id = ?', [req.user.id, dish_id]);
    await conn.query('INSERT INTO ratings (user_id, dish_id, rating) VALUES (?, ?, ?)', [req.user.id, dish_id, numericRating]);

    res.json({ message: 'Rated' });
  } catch (err) {
    console.error('Error in /api/ratings:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Something went wrong' });
    }
  } finally {
    if (conn) {
      try {
        await conn.release();
      } catch (releaseErr) {
        console.error('Error releasing connection:', releaseErr);
      }
    }
  }
});



app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
