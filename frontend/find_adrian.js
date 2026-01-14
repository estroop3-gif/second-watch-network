const { Client } = require('pg');
const client = new Client({
  host: 'swn-database.c0vossgkunoa.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'secondwatchnetwork',
  user: 'swn_admin',
  password: 'I6YvLh4FIUj2Wp40XeJ0mJVP',
  ssl: { rejectUnauthorized: false }
});

client.connect().then(() => {
  return client.query('SELECT s.text_content FROM backlot_scripts s JOIN backlot_script_highlight_breakdowns h ON h.script_id = s.id WHERE h.highlighted_text = $1 LIMIT 1', ['ADRIAN']);
}).then(result => {
  const text = result.rows[0].text_content || '';
  let pos = 0;
  let count = 0;
  console.log('All ADRIAN occurrences in text_content:');
  while ((pos = text.indexOf('ADRIAN', pos)) !== -1) {
    count++;
    const after = text.slice(pos + 6, pos + 60).replace(/\n/g, ' ').trim();
    console.log('  [' + count + '] Offset ' + pos + ': ADRIAN ' + after);
    pos++;
  }
  console.log('');
  console.log('Highlighted ADRIAN is at offset 2767');
}).finally(() => client.end());
