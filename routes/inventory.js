const express = require('express');
const db = require('../db/database');
const router = express.Router();

// GET /inventory - Display inventory with filtering and pagination
router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 9; // Cars per page
  const offset = (page - 1) * limit;
  
  // Get filter parameters
  const { title, price, year, status } = req.query;
  
  // Build WHERE clause
  let whereConditions = [];
  let params = [];
  
  if (title) {
    whereConditions.push('(title LIKE ? OR make LIKE ? OR model LIKE ?)');
    const searchTerm = `%${title}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }
  
  if (price) {
    if (price === '0-4999') {
      whereConditions.push('price <= ?');
      params.push(4999);
    } else if (price === '5000-9999') {
      whereConditions.push('price BETWEEN ? AND ?');
      params.push(5000, 9999);
    } else if (price === '10000+') {
      whereConditions.push('price >= ?');
      params.push(10000);
    }
  }
  
  if (year) {
    if (year === '0-2005') {
      whereConditions.push('year <= ?');
      params.push(2005);
    } else if (year === '2006-2014') {
      whereConditions.push('year BETWEEN ? AND ?');
      params.push(2006, 2014);
    } else if (year === '2015+') {
      whereConditions.push('year >= ?');
      params.push(2015);
    }
  }
  
  if (status) {
    if (status === '0') {
      whereConditions.push('sold = ?');
      params.push(0);
    } else if (status === '1') {
      whereConditions.push('sold = ?');
      params.push(1);
    }
  }
  
  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  
  // Get total count for pagination
  const countQuery = `SELECT COUNT(*) as total FROM cars ${whereClause}`;
  
  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).render('error', { message: 'Database error' });
    }
    
    const totalCars = countResult.total;
    const totalPages = Math.ceil(totalCars / limit);
    
    // Get cars for current page
    const carsQuery = `SELECT * FROM cars ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`;
    const carsParams = [...params, limit, offset];
    
    db.all(carsQuery, carsParams, (err, cars) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).render('error', { message: 'Database error' });
      }
      
      res.render('inventory', {
        cars,
        currentPage: page,
        totalPages,
        totalCars,
        filters: { title, price, year, status }
      });
    });
  });
});

// GET /inventory/:id - Individual car details
router.get('/:id', (req, res) => {
  const carId = req.params.id;
  
  db.get('SELECT * FROM cars WHERE id = ?', [carId], (err, car) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).render('error', { message: 'Database error' });
    }
    
    if (!car) {
      return res.status(404).render('error', { message: 'Car not found' });
    }
    
    res.render('vehicle-detail', { car });
  });
});

module.exports = router;