const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_wBAZjF4EWIG7@ep-hidden-pine-ax7lrfvq.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
});
client.connect()
  .then(() => {
    console.log('Connected to Neon successfully!');
    client.end();
  })
  .catch(err => console.error('Connection error', err.stack));
