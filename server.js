// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
// Database Client
const client = require('./lib/client');
// Services

// Auth
const ensureAuth = require('./lib/auth/ensure-auth');
const createAuthRoutes = require('./lib/auth/create-auth-routes');
const request = require('superagent');
// Application Setup
const app = express();
app.use(morgan('dev')); // http logging
app.use(cors()); // enable CORS request
app.use(express.json()); // enable reading incoming json data

app.use(express.urlencoded({ extended: true }));


const authRoutes = createAuthRoutes({
    async selectUser(email) {
        const result = await client.query(`
            SELECT id, email, hash, display_name as "displayName"
            FROM users
            WHERE email = $1;
        `, [email]);
        return result.rows[0];
    },
    async insertUser(user, hash) {
        const result = await client.query(`
            INSERT into users (email, hash, display_name)
            VALUES ($1, $2, $3)
            RETURNING id, email, display_name;
        `, [user.email, hash, user.display_name]);
        return result.rows[0];
    }
});




// setup authentication routes
app.use('/api/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api/me', ensureAuth);


// get the api by character name
app.get('/api/character', async (req, res) => {
    try {
        const data = await request.get(`https://rickandmortyapi.com/api/character/?name=${req.query.search}`);

        res.json(data.body);
    } catch (e) {
        console.error(e);
    }

});

// get the favorites
app.get('/api/me/favorites', async (req, res) => {
    try {
        const myQuery = `
            SELECT * FROM favorites
            WHERE user_id=$1`;

        const favorites = await client.query(myQuery, [req.userId]);

        res.json(favorites.rows);
    } catch (e) {
        console.error(e);
    }

});

// add a new favorite
app.post('/api/me/favorites', async (req, res) => {
    try {
        const newFavorite = await client.query(`
            INSERT INTO favorites (name, species, image, user_id)
            values ($1, $2, $3, $4)
            RETURNING *
        
        `, [req.body.name, req.body.species, req.image, req.userId]);

        res.json(newFavorite.rows[0]);

    } catch (e) {
        console.error(e);
    }

});

// delete a favorite
app.delete('/api/me/favorites/:id', async (req, res) => {
    // get the id that was passed in the route:

    try {
        const result = await client.query(`
            DELETE from favorites 
            WHERE id=$1
            RETURNING *
        `, [req.params.id]);


        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});


app.listen(process.env.PORT, () => {
    console.log('listening at ', process.env.PORT);
});